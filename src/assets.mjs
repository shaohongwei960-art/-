const baseUrl = import.meta.env?.BASE_URL || '/';

export function assetUrl(path = '') {
  return `${baseUrl}${String(path).replace(/^\/+/, '')}`;
}
