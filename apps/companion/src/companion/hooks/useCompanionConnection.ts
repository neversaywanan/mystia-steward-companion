import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readSnapshot } from '@/companion/api';
import {
  normalizeEndpoint,
  persistApiToken,
  persistEndpoint,
  readStoredApiToken,
  readStoredEndpoint,
} from '@/companion/storage';
import type { LocalApiSnapshot } from '@/companion/types';
import { isTauriRuntime } from '@/lib/tauri-runtime';
import type { RuntimeDataCatalogSnapshot } from '@/lib/recommendation-data';

export const CONNECTION_RETRY_DELAYS_MS = [2000, 5000, 10000, 30000];

export function useCompanionConnection(snapshotRefreshIntervalMs: number) {
  const [endpoint, setEndpoint] = useState(readStoredEndpoint);
  const [endpointDraft, setEndpointDraft] = useState(endpoint);
  const [apiToken, setApiToken] = useState(readStoredApiToken);
  const [snapshot, setSnapshot] = useState<LocalApiSnapshot | null>(null);
  const [cachedRuntimeData, setCachedRuntimeData] = useState<RuntimeDataCatalogSnapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [connectionPaused, setConnectionPaused] = useState(false);
  const [connectionFailureCount, setConnectionFailureCount] = useState(0);
  const [lastConnectedAt, setLastConnectedAt] = useState<Date | null>(null);
  const refreshInFlightRef = useRef(false);

  const normalizedEndpoint = useMemo(() => normalizeEndpoint(endpoint), [endpoint]);
  const normalizedEndpointDraft = useMemo(() => normalizeEndpoint(endpointDraft), [endpointDraft]);

  const applyEndpointConnection = useCallback(() => {
    setEndpoint(normalizedEndpointDraft);
    setEndpointDraft(normalizedEndpointDraft);
    setConnectionPaused(false);
    setConnectionFailureCount(0);
    setError('');
    setSnapshot(null);
    setCachedRuntimeData(null);
  }, [normalizedEndpointDraft]);

  const pauseConnection = useCallback(() => {
    setConnectionPaused(true);
    setLoading(false);
    setError('已停止自动重连。');
  }, []);

  const refresh = useCallback(async (manual = false) => {
    if (!apiToken) {
      setError('未收到本地 API Token。请从游戏内启动或按 F8 唤起伴随窗口。');
      setLoading(false);
      return;
    }
    if (!manual && connectionPaused) return;
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    const showLoading = manual || !snapshot;
    if (showLoading) setLoading(true);
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => abortController.abort(), 2800);

    try {
      const data = await readSnapshot(normalizedEndpoint, apiToken, abortController.signal);
      setSnapshot(data);
      setError('');
      setConnectionPaused(false);
      setConnectionFailureCount(0);
      setLastConnectedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setConnectionFailureCount((current) => Math.min(current + 1, CONNECTION_RETRY_DELAYS_MS.length));
    } finally {
      window.clearTimeout(timeoutId);
      refreshInFlightRef.current = false;
      if (showLoading) setLoading(false);
    }
  }, [apiToken, connectionPaused, normalizedEndpoint, snapshot]);

  useEffect(() => {
    persistEndpoint(normalizedEndpoint);
  }, [normalizedEndpoint]);

  useEffect(() => {
    persistApiToken(apiToken);
  }, [apiToken]);

  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.runtimeData?.isComplete) {
      setCachedRuntimeData(snapshot.runtimeData);
    }
  }, [snapshot]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let disposed = false;
    import('@tauri-apps/api/core')
      .then(async ({ invoke }) => {
        const [launchEndpoint, launchToken] = await Promise.all([
          invoke<string | null>('launch_api_endpoint'),
          invoke<string | null>('launch_api_token'),
        ]);
        return { launchEndpoint, launchToken };
      })
      .then(({ launchEndpoint, launchToken }) => {
        if (!disposed && launchEndpoint) {
          const normalizedLaunchEndpoint = normalizeEndpoint(launchEndpoint);
          setEndpoint(normalizedLaunchEndpoint);
          setEndpointDraft(normalizedLaunchEndpoint);
        }
        if (!disposed && launchToken) {
          setApiToken(launchToken);
          setConnectionPaused(false);
          setConnectionFailureCount(0);
        }
      })
      .catch(() => {
        // Browser mode does not expose launch arguments.
      });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!apiToken || connectionPaused) return;
    const retryIndex = Math.max(0, Math.min(connectionFailureCount - 1, CONNECTION_RETRY_DELAYS_MS.length - 1));
    const delay = error
      ? CONNECTION_RETRY_DELAYS_MS[retryIndex]
      : snapshot
        ? snapshotRefreshIntervalMs
        : 0;
    const timer = window.setTimeout(() => {
      void refresh();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [
    apiToken,
    connectionFailureCount,
    connectionPaused,
    error,
    refresh,
    snapshot,
    snapshotRefreshIntervalMs,
  ]);

  return {
    endpointDraft,
    setEndpointDraft,
    apiToken,
    setApiToken,
    snapshot,
    cachedRuntimeData,
    error,
    loading,
    connectionPaused,
    connectionFailureCount,
    lastConnectedAt,
    normalizedEndpoint,
    applyEndpointConnection,
    pauseConnection,
    refresh,
  };
}
