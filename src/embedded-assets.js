// The standalone HTML carries its model and decoder files inside the document.
// Blob URLs keep Three.js loaders and Web Workers working under file://.
const payloadElement = document.getElementById('assembly-assets');
const payload = payloadElement ? JSON.parse(payloadElement.textContent) : null;
if (payloadElement) payloadElement.remove();
const objectURLs = new Map();

function decodeBase64(value) {
  const decoded = atob(value);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return bytes;
}

export function embeddedModel() {
  if (!payload?.model) return null;
  const model = { name: payload.model.name, buffer: decodeBase64(payload.model.data).buffer };
  delete payload.model;
  return model;
}

export function resolveEmbeddedAsset(url) {
  if (!payload) return null;
  const pathname = new URL(url, location.href).pathname;
  const entry = Object.keys(payload.files).find(key => pathname.endsWith('/' + key));
  if (!entry) throw new Error('请将外部纹理和缓冲区嵌入 GLB 后再打开');
  if (!objectURLs.has(entry)) {
    const asset = payload.files[entry];
    const blob = new Blob([decodeBase64(asset.data)], { type: asset.type });
    objectURLs.set(entry, URL.createObjectURL(blob));
    delete asset.data;
  }
  return objectURLs.get(entry);
}

export function disposeEmbeddedAssets() {
  objectURLs.forEach(url => URL.revokeObjectURL(url));
  objectURLs.clear();
}
