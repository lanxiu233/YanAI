import webConfig from "@/constants/common-env";

const API_ASSET_PREFIXES = ["/images/", "/prompt-assets/"];

export function resolveApiAssetUrl(value?: string | null) {
  const url = String(value || "").trim();
  if (!url || !API_ASSET_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    return url;
  }

  const apiBase = webConfig.apiUrl.replace(/\/$/, "");
  return apiBase ? `${apiBase}${url}` : url;
}
