/**
 * API service — thin wrapper for the FastAPI backend.
 */

const BASE = import.meta.env.VITE_API_URL || '/api';

async function fetchJSON(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, options);
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
    return res.json();
}

export function fetchAssets() {
    return fetchJSON('/assets');
}

export function fetchAssetDetail(id) {
    return fetchJSON(`/assets/${id}`);
}

export function fetchAssetMetrics(id) {
    return fetchJSON(`/assets/${id}/metrics`);
}

export function fetchNetwork() {
    return fetchJSON('/network');
}

/** Toggle an RMU's state (open ↔ closed). */
export function toggleRmu(rmuId) {
    return fetchJSON(`/rmu/${rmuId}/toggle`, { method: 'POST' });
}
