from __future__ import annotations

from fastapi import APIRouter, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field

from api.support import require_identity, resolve_image_base_url
from services.auth_service import auth_service
from services.channel_service import channel_service
from services.image_service import record_image_result
from services.log_service import LoggedCall
from services.observability import request_id_from_request
from services.protocol import (
    anthropic_v1_messages,
    openai_v1_chat_complete,
    openai_v1_image_edit,
    openai_v1_image_generations,
    openai_v1_models,
    openai_v1_response,
)


class ImageGenerationRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    model: str = "gpt-image-2"
    n: int = Field(default=1, ge=1, le=4)
    size: str | None = None
    response_format: str = "b64_json"
    history_disabled: bool = True
    stream: bool | None = None


class ChatCompletionRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    model: str | None = None
    prompt: str | None = None
    n: int | None = None
    stream: bool | None = None
    modalities: list[str] | None = None
    messages: list[dict[str, object]] | None = None


class PromptAssistantRequest(BaseModel):
    goal: str = Field(..., min_length=1, max_length=2000)
    style: str = Field(default="", max_length=120)
    mode: str = Field(default="generate", max_length=40)
    size: str = Field(default="", max_length=40)


class ResponseCreateRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    model: str | None = None
    input: object | None = None
    tools: list[dict[str, object]] | None = None
    tool_choice: object | None = None
    stream: bool | None = None


class AnthropicMessageRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    model: str | None = None
    messages: list[dict[str, object]] | None = None
    system: object | None = None
    stream: bool | None = None


def create_router() -> APIRouter:
    router = APIRouter()

    def successful_image_count(result: object) -> int:
        if not isinstance(result, dict) or not isinstance(result.get("data"), list):
            return 0
        return sum(
            1
            for item in result.get("data") or []
            if isinstance(item, dict) and (item.get("b64_json") or item.get("url"))
        )

    def reserve_image_quota(identity: dict[str, object], amount: int, request_id: str) -> str | None:
        if identity.get("role") != "user":
            return None
        try:
            auth_service.reserve_quota(str(identity.get("id") or ""), amount, request_id)
        except ValueError as exc:
            raise HTTPException(status_code=429, detail={"error": str(exc)}) from exc
        return request_id

    def finalize_quota(request_id: str | None, count: int) -> None:
        if not request_id:
            return
        if count > 0:
            auth_service.confirm_quota(request_id, count)
        else:
            auth_service.release_quota(request_id)

    def finalize_image_result(
            identity: dict[str, object],
            result: dict[str, object],
            *,
            prompt: str,
            mode: str,
            model: str,
            size: str | None,
            channel: str,
            request_id: str,
    ) -> int:
        count = successful_image_count(result)
        if count <= 0:
            return 0
        record_image_result(
            identity,
            result,
            prompt=prompt,
            mode=mode,
            model=model,
            size=size,
            channel=channel,
            quota_cost=1 if identity.get("role") == "user" else 0,
            request_id=request_id,
        )
        return count

    def require_internal_pool_enabled() -> None:
        if not channel_service.is_internal_pool_enabled():
            raise HTTPException(
                status_code=503,
                detail={"error": "internal account pool is disabled and no external channel completed the request"},
            )

    @router.get("/v1/models")
    async def list_models(authorization: str | None = Header(default=None)):
        require_identity(authorization)
        try:
            return await run_in_threadpool(openai_v1_models.list_models)
        except Exception as exc:
            raise HTTPException(status_code=502, detail={"error": str(exc)}) from exc

    @router.post("/v1/images/generations")
    async def generate_images(
            body: ImageGenerationRequest,
            request: Request,
            authorization: str | None = Header(default=None),
    ):
        identity = require_identity(authorization)
        if identity.get("role") == "user" and body.stream:
            raise HTTPException(status_code=400, detail={"error": "stream is not supported for personal image tasks"})
        request_id = request_id_from_request(request)
        quota_request_id = reserve_image_quota(identity, int(body.n or 1), request_id)
        payload = body.model_dump(mode="python")
        payload["base_url"] = resolve_image_base_url(request)
        payload["request_id"] = request_id
        call = LoggedCall(identity, "/v1/images/generations", body.model, "文生图", request_id=request_id)
        try:
            if not body.stream:
                routed = await run_in_threadpool(channel_service.call_generation, payload)
                if routed is not None:
                    result, channel_name = routed
                    call.log("渠道调用完成", result)
                    count = finalize_image_result(
                        identity,
                        result,
                        prompt=body.prompt,
                        mode="generate",
                        model=body.model,
                        size=body.size,
                        channel=channel_name,
                        request_id=request_id,
                    )
                    finalize_quota(quota_request_id, count)
                    return result
            require_internal_pool_enabled()
            result = await call.run(openai_v1_image_generations.handle, payload)
            count = 0
            if isinstance(result, dict):
                count = finalize_image_result(
                    identity,
                    result,
                    prompt=body.prompt,
                    mode="generate",
                    model=body.model,
                    size=body.size,
                    channel="internal_pool",
                    request_id=request_id,
                )
            finalize_quota(quota_request_id, count)
            return result
        except Exception:
            if quota_request_id:
                auth_service.release_quota(quota_request_id)
            raise

    @router.post("/v1/images/edits")
    async def edit_images(
            request: Request,
            authorization: str | None = Header(default=None),
            image: list[UploadFile] | None = File(default=None),
            image_list: list[UploadFile] | None = File(default=None, alias="image[]"),
            prompt: str = Form(...),
            model: str = Form(default="gpt-image-2"),
            n: int = Form(default=1),
            size: str | None = Form(default=None),
            response_format: str = Form(default="b64_json"),
            stream: bool | None = Form(default=None),
    ):
        identity = require_identity(authorization)
        if identity.get("role") == "user" and stream:
            raise HTTPException(status_code=400, detail={"error": "stream is not supported for personal image tasks"})
        if n < 1 or n > 4:
            raise HTTPException(status_code=400, detail={"error": "n must be between 1 and 4"})
        uploads = [*(image or []), *(image_list or [])]
        if not uploads:
            raise HTTPException(status_code=400, detail={"error": "image file is required"})
        images: list[tuple[bytes, str, str]] = []
        for upload in uploads:
            image_data = await upload.read()
            if not image_data:
                raise HTTPException(status_code=400, detail={"error": "image file is empty"})
            images.append((image_data, upload.filename or "image.png", upload.content_type or "image/png"))
        request_id = request_id_from_request(request)
        quota_request_id = reserve_image_quota(identity, int(n or 1), request_id)
        payload = {
            "prompt": prompt,
            "images": images,
            "model": model,
            "n": n,
            "size": size,
            "response_format": response_format,
            "stream": stream,
            "base_url": resolve_image_base_url(request),
            "request_id": request_id,
        }
        call = LoggedCall(identity, "/v1/images/edits", model, "图生图", request_id=request_id)
        try:
            if not stream:
                routed = await run_in_threadpool(channel_service.call_edit, payload)
                if routed is not None:
                    result, channel_name = routed
                    call.log("渠道调用完成", result)
                    count = finalize_image_result(
                        identity,
                        result,
                        prompt=prompt,
                        mode="edit",
                        model=model,
                        size=size,
                        channel=channel_name,
                        request_id=request_id,
                    )
                    finalize_quota(quota_request_id, count)
                    return result
            require_internal_pool_enabled()
            result = await call.run(openai_v1_image_edit.handle, payload)
            count = 0
            if isinstance(result, dict):
                count = finalize_image_result(
                    identity,
                    result,
                    prompt=prompt,
                    mode="edit",
                    model=model,
                    size=size,
                    channel="internal_pool",
                    request_id=request_id,
                )
            finalize_quota(quota_request_id, count)
            return result
        except Exception:
            if quota_request_id:
                auth_service.release_quota(quota_request_id)
            raise

    @router.post("/v1/chat/completions")
    async def create_chat_completion(
            body: ChatCompletionRequest,
            request: Request,
            authorization: str | None = Header(default=None),
    ):
        identity = require_identity(authorization)
        if identity.get("role") == "user":
            raise HTTPException(status_code=403, detail={"error": "personal users can only use image features"})
        payload = body.model_dump(mode="python")
        model = str(payload.get("model") or "auto")
        request_id = request_id_from_request(request)
        payload["request_id"] = request_id
        call = LoggedCall(identity, "/v1/chat/completions", model, "文本生成", request_id=request_id)
        return await call.run(openai_v1_chat_complete.handle, payload)

    @router.post("/api/me/prompt-assistant")
    async def create_prompt_assistant_result(
            body: PromptAssistantRequest,
            request: Request,
            authorization: str | None = Header(default=None),
    ):
        identity = require_identity(authorization)
        if identity.get("role") != "user":
            raise HTTPException(status_code=403, detail={"error": "user permission required"})
        request_id = request_id_from_request(request)
        mode_label = "图生图" if body.mode == "edit" else "文生图"
        payload = {
            "model": "auto",
            "stream": False,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "你是颜值AI的商业摄影提示词助手。只输出可直接用于图片生成的一段中文提示词，"
                        "不要解释，不要寒暄。提示词需要包含主体、场景、光线、构图、质感、镜头语言、商业用途和负面约束。"
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"创作模式：{mode_label}\n"
                        f"目标比例：{body.size or '未指定'}\n"
                        f"风格偏好：{body.style or '高级商业视觉'}\n"
                        f"用户需求：{body.goal.strip()}"
                    ),
                },
            ],
            "request_id": request_id,
        }
        call = LoggedCall(identity, "/api/me/prompt-assistant", "auto", "提示词助手", request_id=request_id)
        result = await call.run(openai_v1_chat_complete.handle, payload)
        content = ""
        if isinstance(result, dict):
            choices = result.get("choices")
            first = choices[0] if isinstance(choices, list) and choices else {}
            if isinstance(first, dict):
                message = first.get("message")
                if isinstance(message, dict):
                    content = str(message.get("content") or "").strip()
        if not content:
            raise HTTPException(status_code=502, detail={"error": "prompt assistant returned empty content"})
        return {"prompt": content, "raw": result if isinstance(result, dict) else None}

    @router.post("/v1/responses")
    async def create_response(
            body: ResponseCreateRequest,
            request: Request,
            authorization: str | None = Header(default=None),
    ):
        identity = require_identity(authorization)
        if identity.get("role") == "user":
            raise HTTPException(status_code=403, detail={"error": "personal users can only use image features"})
        payload = body.model_dump(mode="python")
        model = str(payload.get("model") or "auto")
        request_id = request_id_from_request(request)
        payload["request_id"] = request_id
        call = LoggedCall(identity, "/v1/responses", model, "Responses", request_id=request_id)
        return await call.run(openai_v1_response.handle, payload)

    @router.post("/v1/messages")
    async def create_message(
            body: AnthropicMessageRequest,
            request: Request,
            authorization: str | None = Header(default=None),
            x_api_key: str | None = Header(default=None, alias="x-api-key"),
            anthropic_version: str | None = Header(default=None, alias="anthropic-version"),
    ):
        identity = require_identity(authorization or (f"Bearer {x_api_key}" if x_api_key else None))
        if identity.get("role") == "user":
            raise HTTPException(status_code=403, detail={"error": "personal users can only use image features"})
        payload = body.model_dump(mode="python")
        model = str(payload.get("model") or "auto")
        request_id = request_id_from_request(request)
        payload["request_id"] = request_id
        call = LoggedCall(identity, "/v1/messages", model, "Messages", request_id=request_id)
        return await call.run(anthropic_v1_messages.handle, payload, sse="anthropic")

    return router
