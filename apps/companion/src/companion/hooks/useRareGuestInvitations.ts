import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchAvailableRareGuestInvitations,
  inviteAllAvailableRareGuests,
  inviteAvailableRareGuest,
} from '@/companion/api';
import {
  persistRareGuestInvitationLevels,
  persistRareGuestInvitationScope,
  readStoredRareGuestInvitationLevels,
  readStoredRareGuestInvitationScope,
} from '@/companion/storage';
import type {
  LocalApiSnapshot,
  ModTab,
  RareGuestInvitationResponse,
  RareGuestInvitationScope,
} from '@/companion/types';

interface UseRareGuestInvitationsOptions {
  apiToken: string;
  normalizedEndpoint: string;
  snapshot: LocalApiSnapshot | null;
  tab: ModTab;
  refresh: (manual?: boolean) => Promise<void>;
}

export function useRareGuestInvitations({
  apiToken,
  normalizedEndpoint,
  snapshot,
  tab,
  refresh,
}: UseRareGuestInvitationsOptions) {
  const [rareGuestInvitationScope, setRareGuestInvitationScopeState] = useState<RareGuestInvitationScope>(() =>
    readStoredRareGuestInvitationScope(),
  );
  const [rareGuestInvitationLevels, setRareGuestInvitationLevels] = useState<number[]>(() =>
    readStoredRareGuestInvitationLevels(),
  );
  const [rareGuestInvitationResult, setRareGuestInvitationResult] = useState<RareGuestInvitationResponse | null>(null);
  const [rareGuestInvitationError, setRareGuestInvitationError] = useState('');
  const [rareGuestInvitationBusyKey, setRareGuestInvitationBusyKey] = useState('');
  const lastRefreshSignatureRef = useRef('');

  const setRareGuestInvitationScope = useCallback((scope: RareGuestInvitationScope) => {
    setRareGuestInvitationScopeState(scope);
    setRareGuestInvitationResult(null);
    lastRefreshSignatureRef.current = '';
  }, []);

  const loadRareGuestInvitations = useCallback(async () => {
    if (!apiToken) {
      setRareGuestInvitationError('未收到本地 API Token。请从游戏内启动或按 F8 唤起伴随窗口。');
      return;
    }

    setRareGuestInvitationBusyKey('list');
    setRareGuestInvitationError('');
    try {
      const response = await fetchAvailableRareGuestInvitations(
        normalizedEndpoint,
        apiToken,
        rareGuestInvitationScope,
      );
      setRareGuestInvitationResult(response);
      if (!response.ok) {
        setRareGuestInvitationError(response.error || response.status || '读取可邀请稀客失败');
      }
    } catch (err) {
      setRareGuestInvitationError(err instanceof Error ? err.message : String(err));
    } finally {
      setRareGuestInvitationBusyKey('');
    }
  }, [apiToken, normalizedEndpoint, rareGuestInvitationScope]);

  const inviteAllRareGuests = useCallback(async () => {
    if (!apiToken) {
      setRareGuestInvitationError('未收到本地 API Token。请从游戏内启动或按 F8 唤起伴随窗口。');
      return;
    }

    setRareGuestInvitationBusyKey('all');
    setRareGuestInvitationError('');
    try {
      const response = await inviteAllAvailableRareGuests(
        normalizedEndpoint,
        apiToken,
        rareGuestInvitationScope,
        rareGuestInvitationLevels,
      );
      setRareGuestInvitationResult(response);
      if (!response.ok) {
        setRareGuestInvitationError(response.error || response.status || '稀客邀请失败');
      }
      await refresh(true);
    } catch (err) {
      setRareGuestInvitationError(err instanceof Error ? err.message : String(err));
    } finally {
      setRareGuestInvitationBusyKey('');
    }
  }, [apiToken, normalizedEndpoint, rareGuestInvitationLevels, rareGuestInvitationScope, refresh]);

  const inviteRareGuest = useCallback(async (guestId: number) => {
    if (!apiToken) {
      setRareGuestInvitationError('未收到本地 API Token。请从游戏内启动或按 F8 唤起伴随窗口。');
      return;
    }

    const busyKey = `guest:${guestId}`;
    setRareGuestInvitationBusyKey(busyKey);
    setRareGuestInvitationError('');
    try {
      const response = await inviteAvailableRareGuest(normalizedEndpoint, apiToken, guestId, rareGuestInvitationScope);
      setRareGuestInvitationResult(response);
      if (!response.ok) {
        setRareGuestInvitationError(response.error || response.status || '稀客邀请失败');
      }
      await refresh(true);
    } catch (err) {
      setRareGuestInvitationError(err instanceof Error ? err.message : String(err));
    } finally {
      setRareGuestInvitationBusyKey('');
    }
  }, [apiToken, normalizedEndpoint, rareGuestInvitationScope, refresh]);

  useEffect(() => {
    persistRareGuestInvitationScope(rareGuestInvitationScope);
  }, [rareGuestInvitationScope]);

  useEffect(() => {
    persistRareGuestInvitationLevels(rareGuestInvitationLevels);
  }, [rareGuestInvitationLevels]);

  useEffect(() => {
    const currentSnapshot = snapshot;
    if (tab !== 'tasks' || !currentSnapshot || !currentSnapshot.runtimeLoaded || !apiToken) return;
    if (rareGuestInvitationBusyKey) return;
    if (!currentSnapshot.activeDayMapLabel && !currentSnapshot.activeDayMapName) return;
    const signature = `${rareGuestInvitationScope}|${currentSnapshot.activeDayMapLabel ?? ''}|${currentSnapshot.activeSceneName ?? ''}`;
    if (lastRefreshSignatureRef.current === signature && rareGuestInvitationResult) return;
    lastRefreshSignatureRef.current = signature;
    void loadRareGuestInvitations();
  }, [
    apiToken,
    loadRareGuestInvitations,
    rareGuestInvitationBusyKey,
    rareGuestInvitationResult,
    rareGuestInvitationScope,
    snapshot,
    tab,
  ]);

  return {
    rareGuestInvitationScope,
    setRareGuestInvitationScope,
    rareGuestInvitationLevels,
    setRareGuestInvitationLevels,
    rareGuestInvitationResult,
    rareGuestInvitationError,
    rareGuestInvitationBusyKey,
    loadRareGuestInvitations,
    inviteAllRareGuests,
    inviteRareGuest,
  };
}
