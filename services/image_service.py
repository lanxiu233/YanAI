from __future__ import annotations

from datetime import datetime
from pathlib import Path
import uuid
from urllib.parse import urlparse

from services.config import config
from services.observability import get_current_request_id
from services.repositories.base import ImageRecordRepository
from services.storage.base import StorageBackend


def _clean(value: object) -> str:
    return str(value or "").strip()


def _int_or_zero(value: object) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def _normalize_page(page: int, page_size: int) -> tuple[int, int]:
    try:
        normalized_page = max(1, int(page or 1))
    except (TypeError, ValueError):
        normalized_page = 1
    try:
        normalized_page_size = int(page_size or 48)
    except (TypeError, ValueError):
        normalized_page_size = 48
    return normalized_page, max(1, min(200, normalized_page_size))


def _record_to_item(record: dict[str, object], base_url: str) -> dict[str, object]:
    url = _clean(record.get("url"))
    parsed_path = urlparse(url).path
    record_id = _clean(record.get("record_id") or record.get("id"))
    name = Path(parsed_path).name or record_id or "image.png"
    size = _int_or_zero(record.get("size"))
    image_size = _clean(record.get("image_size"))
    if not image_size and record.get("size") is not None and size == 0:
        image_size = _clean(record.get("size"))
    if parsed_path.startswith("/images/"):
        local_path = config.images_dir / parsed_path.removeprefix("/images/")
        if local_path.exists() and local_path.is_file():
            size = local_path.stat().st_size
            if not url.startswith("http"):
                url = f"{base_url.rstrip('/')}{parsed_path}"
    created_at = _clean(record.get("created_at")) or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    day = created_at[:10]
    return {
        "id": record_id,
        "record_id": record_id,
        "name": name,
        "date": day,
        "size": size,
        "url": url,
        "created_at": created_at,
        "owner_user_id": record.get("owner_user_id"),
        "owner_name": record.get("owner_name"),
        "owner_email": record.get("owner_email"),
        "prompt": record.get("prompt"),
        "mode": record.get("mode"),
        "model": record.get("model"),
        "image_size": image_size,
        "channel": record.get("channel"),
        "request_id": record.get("request_id"),
        "quota_cost": _int_or_zero(record.get("quota_cost")),
    }


def _group_items(items: list[dict[str, object]]) -> list[dict[str, object]]:
    groups: dict[str, list[dict[str, object]]] = {}
    for item in items:
        groups.setdefault(str(item["date"]), []).append(item)
    return [{"date": key, "items": value} for key, value in groups.items()]


def _image_record_source() -> ImageRecordRepository | StorageBackend:
    get_repository_provider = getattr(config, "get_repository_provider", None)
    repositories = get_repository_provider() if callable(get_repository_provider) else None
    if repositories is not None:
        return repositories.image_records
    return config.get_storage_backend()


def _list_files(base_url: str, start_date: str = "", end_date: str = "", seen_urls: set[str] | None = None) -> list[dict[str, object]]:
    config.cleanup_old_images()
    seen = seen_urls or set()
    items = []
    root = config.images_dir
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(root).as_posix()
        parts = rel.split("/")
        day = "-".join(parts[:3]) if len(parts) >= 4 else datetime.fromtimestamp(path.stat().st_mtime).strftime("%Y-%m-%d")
        if start_date and day < start_date:
            continue
        if end_date and day > end_date:
            continue
        url = f"{base_url.rstrip('/')}/images/{rel}"
        if url in seen:
            continue
        items.append({
            "name": path.name,
            "date": day,
            "size": path.stat().st_size,
            "url": url,
            "created_at": datetime.fromtimestamp(path.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
        })
    items.sort(key=lambda item: str(item["created_at"]), reverse=True)
    return items


def list_images(
    base_url: str,
    start_date: str = "",
    end_date: str = "",
    owner_user_id: str = "",
    channel: str = "",
    request_id: str = "",
    page: int = 1,
    page_size: int = 48,
) -> dict[str, object]:
    storage = _image_record_source()
    normalized_page, normalized_page_size = _normalize_page(page, page_size)
    if isinstance(storage, ImageRecordRepository):
        try:
            result = storage.query(
                start_date=start_date.strip(),
                end_date=end_date.strip(),
                owner_user_id=owner_user_id.strip(),
                channel=channel.strip(),
                request_id=request_id.strip(),
                page=normalized_page,
                page_size=normalized_page_size,
            )
            items = [_record_to_item(record, base_url) for record in result.get("items", []) if isinstance(record, dict)]
            pagination = {
                "page": int(result.get("page") or normalized_page),
                "page_size": int(result.get("page_size") or normalized_page_size),
                "total": int(result.get("total") or 0),
                "page_count": int(result.get("page_count") or 1),
            }
            return {"items": items, "groups": _group_items(items), "pagination": pagination}
        except Exception:
            pass

    try:
        if isinstance(storage, ImageRecordRepository):
            records = storage.list()
        else:
            records = storage.load_image_records()
    except Exception:
        records = []
    items = []
    for record in records:
        if not isinstance(record, dict):
            continue
        created_at = _clean(record.get("created_at"))
        day = created_at[:10]
        if owner_user_id and _clean(record.get("owner_user_id")) != owner_user_id:
            continue
        if channel and _clean(record.get("channel")) != channel:
            continue
        if request_id and _clean(record.get("request_id")) != request_id:
            continue
        if start_date and day < start_date:
            continue
        if end_date and day > end_date:
            continue
        items.append(_record_to_item(record, base_url))
    seen_urls = {str(item.get("url") or "") for item in items}
    if not owner_user_id:
        items.extend(_list_files(base_url, start_date, end_date, seen_urls))
    items.sort(key=lambda item: str(item["created_at"]), reverse=True)
    total = len(items)
    page_count = max(1, (total + normalized_page_size - 1) // normalized_page_size)
    safe_page = min(normalized_page, page_count)
    start = (safe_page - 1) * normalized_page_size
    page_items = items[start:start + normalized_page_size]
    return {
        "items": page_items,
        "groups": _group_items(page_items),
        "pagination": {
            "page": safe_page,
            "page_size": normalized_page_size,
            "total": total,
            "page_count": page_count,
        },
    }


def record_image_result(
    identity: dict[str, object],
    result: dict[str, object],
    *,
    prompt: str,
    mode: str,
    model: str,
    size: str | None = None,
    channel: str = "internal_pool",
    quota_cost: int = 0,
    request_id: str = "",
) -> list[dict[str, object]]:
    data = result.get("data") if isinstance(result, dict) else None
    if not isinstance(data, list):
        return []
    storage = _image_record_source()
    records: list[dict[str, object]] = []
    if not isinstance(storage, ImageRecordRepository):
        try:
            records = storage.load_image_records()
        except Exception:
            records = []
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    owner_role = _clean(identity.get("role"))
    owner_user_id = _clean(identity.get("id")) if owner_role == "user" else ""
    normalized_request_id = _clean(request_id) or get_current_request_id()
    created: list[dict[str, object]] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        url = _clean(item.get("url"))
        if not url:
            continue
        record_id = uuid.uuid4().hex
        record = {
            "id": record_id,
            "record_id": record_id,
            "owner_user_id": owner_user_id,
            "owner_role": owner_role,
            "owner_name": identity.get("name"),
            "owner_email": identity.get("email"),
            "prompt": prompt,
            "mode": mode,
            "model": model,
            "image_size": size or "",
            "channel": channel,
            "request_id": normalized_request_id,
            "url": url,
            "created_at": now,
            "quota_cost": quota_cost if owner_user_id else 0,
        }
        created.append(record)
    if created:
        if isinstance(storage, ImageRecordRepository):
            for record in created:
                storage.insert(record)
        else:
            storage.save_image_records([*created, *[record for record in records if isinstance(record, dict)]])
    return created
