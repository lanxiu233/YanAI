from __future__ import annotations

from pathlib import Path

from fastapi.staticfiles import StaticFiles

IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable"
ASSET_CACHE_CONTROL = "public, max-age=2592000"
HTML_CACHE_CONTROL = "no-cache"

CACHEABLE_SUFFIXES = {
    ".avif",
    ".css",
    ".gif",
    ".ico",
    ".jpeg",
    ".jpg",
    ".js",
    ".png",
    ".svg",
    ".webp",
    ".woff",
    ".woff2",
}


def cache_control_for_asset_path(path: str) -> str:
    clean_path = path.strip("/")
    suffix = Path(clean_path).suffix.lower()

    if not clean_path or suffix == ".html":
        return HTML_CACHE_CONTROL

    if clean_path.startswith("_next/static/"):
        return IMMUTABLE_CACHE_CONTROL

    if suffix in CACHEABLE_SUFFIXES:
        return ASSET_CACHE_CONTROL

    return HTML_CACHE_CONTROL


class CachedStaticFiles(StaticFiles):
    def __init__(self, *args, cache_control: str = ASSET_CACHE_CONTROL, **kwargs):
        super().__init__(*args, **kwargs)
        self.cache_control = cache_control

    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers.setdefault("Cache-Control", self.cache_control)
        return response
