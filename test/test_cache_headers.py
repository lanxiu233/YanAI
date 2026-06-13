from api.cache_headers import (
    ASSET_CACHE_CONTROL,
    HTML_CACHE_CONTROL,
    IMMUTABLE_CACHE_CONTROL,
    cache_control_for_asset_path,
)


def test_next_static_assets_are_immutable() -> None:
    assert cache_control_for_asset_path("_next/static/chunks/app.js") == IMMUTABLE_CACHE_CONTROL


def test_exported_images_are_cacheable() -> None:
    assert cache_control_for_asset_path("landing-hero-portrait.png") == ASSET_CACHE_CONTROL
    assert cache_control_for_asset_path("banana-prompt-quicker/images/demo.webp") == ASSET_CACHE_CONTROL


def test_html_shell_revalidates() -> None:
    assert cache_control_for_asset_path("") == HTML_CACHE_CONTROL
    assert cache_control_for_asset_path("image/index.html") == HTML_CACHE_CONTROL
