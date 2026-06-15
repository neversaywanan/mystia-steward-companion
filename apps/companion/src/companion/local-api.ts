import { isTauriRuntime } from '@/lib/tauri-runtime';

interface LocalApiRequestOptions {
  signal?: AbortSignal;
  tauriTimeoutMs?: number;
}

export async function readLocalApiJson<T>(
  endpoint: string,
  apiToken: string,
  path: string,
  options?: AbortSignal | LocalApiRequestOptions,
): Promise<T> {
  const targetEndpoint = `${endpoint}${path}`;
  const requestOptions = normalizeRequestOptions(options);
  if (isTauriRuntime()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const payload = await invoke<string>('fetch_snapshot', {
      endpoint: targetEndpoint,
      token: apiToken,
      timeoutMs: requestOptions.tauriTimeoutMs,
    });
    return JSON.parse(payload) as T;
  }

  const headers = new Headers();
  if (apiToken) headers.set('X-Mystia-Steward-Companion-Token', apiToken);
  const response = await fetch(targetEndpoint, {
    cache: 'no-store',
    headers,
    signal: requestOptions.signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  return await response.json() as T;
}

export async function readLocalApiJsonWithTimeout<T>(
  endpoint: string,
  apiToken: string,
  path: string,
  timeoutMs: number,
): Promise<T> {
  const abortController = new AbortController();
  const timeoutId = window.setTimeout(() => abortController.abort(), timeoutMs);

  try {
    return await readLocalApiJson<T>(endpoint, apiToken, path, {
      signal: abortController.signal,
      tauriTimeoutMs: timeoutMs,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function normalizeRequestOptions(options: AbortSignal | LocalApiRequestOptions | undefined): LocalApiRequestOptions {
  if (!options) return {};
  if (options instanceof AbortSignal) return { signal: options };
  return options;
}
