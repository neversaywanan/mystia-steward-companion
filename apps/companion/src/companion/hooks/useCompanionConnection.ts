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
const INITIAL_PROBE_TIMEOUT_MS = 700;
const AUTO_POLL_TIMEOUT_MS = 1800;
const MANUAL_REFRESH_TIMEOUT_MS = 2800;

export function useCompanionConnection(snapshotRefreshIntervalMs: number) {
  const [endpoint, setEndpoint] = useState(readStoredEndpoint);
  const [endpointDraft, setEndpointDraft] = useState(endpoint);
  const [apiToken, setApiToken] = useState(readStoredApiToken);
  const [snapshot, setSnapshot] = useState<LocalApiSnapshot | null>(null);
  const [cachedRuntimeData, setCachedRuntimeData] = useState<RuntimeDataCatalogSnapshot | null>(null);
  const [error, setError] = useState('');
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [connectionProbing, setConnectionProbing] = useState(false);
  const [connectionPaused, setConnectionPaused] = useState(false);
  const [connectionFailureCount, setConnectionFailureCount] = useState(0);
  const [lastConnectedAt, setLastConnectedAt] = useState<Date | null>(null);
  const latestRequestIdRef = useRef(0);
  const inFlightRequestIdRef = useRef<number | null>(null);

  const normalizedEndpoint = useMemo(() => normalizeEndpoint(endpoint), [endpoint]);
  const normalizedEndpointDraft = useMemo(() => normalizeEndpoint(endpointDraft), [endpointDraft]);

  const applyEndpointConnection = useCallback(() => {
    latestRequestIdRef.current += 1;
    inFlightRequestIdRef.current = null;
    setEndpoint(normalizedEndpointDraft);
    setEndpointDraft(normalizedEndpointDraft);
    setConnectionPaused(false);
    setConnectionFailureCount(0);
    setError('');
    setSnapshot(null);
    setCachedRuntimeData(null);
    setManualRefreshing(false);
    setConnectionProbing(false);
  }, [normalizedEndpointDraft]);

  const pauseConnection = useCallback(() => {
    latestRequestIdRef.current += 1;
    inFlightRequestIdRef.current = null;
    setConnectionPaused(true);
    setManualRefreshing(false);
    setConnectionProbing(false);
    setError('已停止自动重连。');
  }, []);

  const refresh = useCallback(async (manual = false) => {
    if (!apiToken) {
      setError('未收到本地 API Token。请从游戏内启动或按 F8 唤起伴随窗口。');
      setManualRefreshing(false);
      setConnectionProbing(false);
      return;
    }
    if (!manual && connectionPaused) return;
    if (inFlightRequestIdRef.current !== null && !manual) return;

    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    inFlightRequestIdRef.current = requestId;
    const timeoutMs = manual
      ? MANUAL_REFRESH_TIMEOUT_MS
      : snapshot
        ? AUTO_POLL_TIMEOUT_MS
        : INITIAL_PROBE_TIMEOUT_MS;
    if (manual) {
      setManualRefreshing(true);
    } else if (!snapshot) {
      setConnectionProbing(true);
    }
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const data = await readSnapshot(normalizedEndpoint, apiToken, {
        signal: abortController.signal,
        timeoutMs,
      });
      if (latestRequestIdRef.current !== requestId) return;
      setSnapshot(data);
      setError('');
      setConnectionPaused(false);
      setConnectionFailureCount(0);
      setLastConnectedAt(new Date());
    } catch (err) {
      if (latestRequestIdRef.current !== requestId) return;
      setError(err instanceof Error ? err.message : String(err));
      setConnectionFailureCount((current) => Math.min(current + 1, CONNECTION_RETRY_DELAYS_MS.length));
    } finally {
      window.clearTimeout(timeoutId);
      if (inFlightRequestIdRef.current === requestId) {
        inFlightRequestIdRef.current = null;
      }
      if (latestRequestIdRef.current === requestId) {
        if (manual) setManualRefreshing(false);
        if (!manual && !snapshot) setConnectionProbing(false);
      }
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
    loading: manualRefreshing,
    connectionProbing,
    connectionPaused,
    connectionFailureCount,
    lastConnectedAt,
    normalizedEndpoint,
    applyEndpointConnection,
    pauseConnection,
    refresh,
  };
}
