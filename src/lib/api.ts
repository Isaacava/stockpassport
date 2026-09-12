const DEFAULT_API_BASE = '';

/**
 * StockPassport runs its API as same-origin Vercel Functions.
 * VITE_API_BASE_URL is retained only for explicit local/testing overrides.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE).replace(/\/$/, '');

export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function readJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const raw = await response.text();
  let data: unknown = null;

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message = typeof data === 'object' && data !== null && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
      ? (data as { error: string }).error
      : raw.trim() || `Request failed with HTTP ${response.status}.`;
    throw new Error(message);
  }

  if (data === null) {
    const hint = contentType ? ` (${contentType})` : '';
    throw new Error(`The StockPassport API returned an invalid response${hint}.`);
  }

  return data as T;
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    cache: 'no-store',
    headers: {
      ...(init?.headers ?? {}),
      Accept: 'application/json',
    },
  });
  return readJson<T>(response);
}
