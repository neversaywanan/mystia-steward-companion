import type { LocalApiSnapshot, NightBusinessContext } from '@/companion/types';

export const EMPTY_NIGHT_BUSINESS_CONFIRMATION_FRAMES = 2;

export interface NightBusinessContinuityState {
  consecutiveEmptySnapshots: number;
  lastEmptySnapshotKey: string | null;
}

export function createNightBusinessContinuityState(): NightBusinessContinuityState {
  return {
    consecutiveEmptySnapshots: 0,
    lastEmptySnapshotKey: null,
  };
}

export function stabilizeNightBusinessSnapshot({
  previousSnapshot,
  nextSnapshot,
  state,
}: {
  previousSnapshot: LocalApiSnapshot | null;
  nextSnapshot: LocalApiSnapshot;
  state: NightBusinessContinuityState;
}): {
  snapshot: LocalApiSnapshot;
  state: NightBusinessContinuityState;
  usedLastKnownGood: boolean;
} {
  const previousNight = previousSnapshot?.nightBusiness;
  const nextNight = nextSnapshot.nightBusiness;
  const sceneChanged = previousSnapshot !== null
    && previousSnapshot.activeSceneName !== nextSnapshot.activeSceneName;

  if (
    !previousNight
    || !nextNight
    || previousNight.orders.length === 0
    || nextNight.orders.length > 0
    || sceneChanged
    || hasExplicitOrderRemoval(previousNight, nextNight)
  ) {
    return acceptedSnapshot(nextSnapshot);
  }

  const emptySnapshotKey = buildEmptySnapshotKey(nextSnapshot);
  const consecutiveEmptySnapshots = state.lastEmptySnapshotKey === emptySnapshotKey
    ? state.consecutiveEmptySnapshots
    : state.consecutiveEmptySnapshots + 1;

  if (consecutiveEmptySnapshots >= EMPTY_NIGHT_BUSINESS_CONFIRMATION_FRAMES) {
    return acceptedSnapshot(nextSnapshot);
  }

  return {
    snapshot: {
      ...nextSnapshot,
      nightBusiness: {
        ...nextNight,
        activeRareGuests: previousNight.activeRareGuests,
        orders: previousNight.orders,
      },
    },
    state: {
      consecutiveEmptySnapshots,
      lastEmptySnapshotKey: emptySnapshotKey,
    },
    usedLastKnownGood: true,
  };
}

function acceptedSnapshot(snapshot: LocalApiSnapshot) {
  return {
    snapshot,
    state: createNightBusinessContinuityState(),
    usedLastKnownGood: false,
  };
}

function hasExplicitOrderRemoval(
  previousNight: NightBusinessContext,
  nextNight: NightBusinessContext,
): boolean {
  return typeof previousNight.orderRemovalVersion === 'number'
    && typeof nextNight.orderRemovalVersion === 'number'
    && nextNight.orderRemovalVersion > previousNight.orderRemovalVersion;
}

function buildEmptySnapshotKey(snapshot: LocalApiSnapshot): string {
  return `${snapshot.activeSceneName}|${snapshot.capturedAtUtc}`;
}
