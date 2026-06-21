import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createNightBusinessContinuityState,
  stabilizeNightBusinessSnapshot,
} from '../src/companion/domain/night-business-continuity.ts';

const ORDER = {
  deskCode: 3,
  guestId: 1,
  guestName: '露米娅',
  foodTagId: 12,
  foodTag: '肉',
  beverageTagId: 22,
  beverageTag: '中酒精',
  source: 'RuntimeCapture',
};

const GUEST = {
  deskCode: 3,
  guestId: 1,
  guestName: '露米娅',
  source: 'Desk',
};

function snapshot({
  capturedAtUtc,
  orders = [ORDER],
  activeRareGuests = [GUEST],
  activeSceneName = 'NightScene.Work',
  orderRemovalVersion = 0,
}) {
  return {
    pluginVersion: 'test',
    capturedAtUtc,
    activeSceneName,
    runtimeLoaded: true,
    status: 'test',
    runtimeSource: 'test',
    recommendationState: null,
    nightBusiness: {
      place: '妖怪兽道',
      placeLabel: '妖怪兽道',
      activeRareGuests,
      orders,
      orderRemovalVersion,
      source: 'test',
      error: null,
    },
  };
}

function advance(previousSnapshot, nextSnapshot, state) {
  return stabilizeNightBusinessSnapshot({ previousSnapshot, nextSnapshot, state });
}

test('preserves the last known order across one empty frame and accepts recovery', () => {
  const initial = snapshot({ capturedAtUtc: '2026-06-20T12:00:00.000Z' });
  const empty = snapshot({
    capturedAtUtc: '2026-06-20T12:00:01.000Z',
    orders: [],
    activeRareGuests: [],
  });
  const recovered = snapshot({ capturedAtUtc: '2026-06-20T12:00:02.000Z' });

  const held = advance(initial, empty, createNightBusinessContinuityState());
  assert.deepEqual(held.snapshot.nightBusiness.orders, [ORDER]);
  assert.deepEqual(held.snapshot.nightBusiness.activeRareGuests, [GUEST]);
  assert.equal(held.usedLastKnownGood, true);

  const restored = advance(held.snapshot, recovered, held.state);
  assert.deepEqual(restored.snapshot.nightBusiness.orders, [ORDER]);
  assert.equal(restored.usedLastKnownGood, false);
  assert.equal(restored.state.consecutiveEmptySnapshots, 0);
});

test('accepts empty orders after two distinct empty backend frames', () => {
  const initial = snapshot({ capturedAtUtc: '2026-06-20T12:00:00.000Z' });
  const firstEmpty = snapshot({ capturedAtUtc: '2026-06-20T12:00:01.000Z', orders: [], activeRareGuests: [] });
  const secondEmpty = snapshot({ capturedAtUtc: '2026-06-20T12:00:02.000Z', orders: [], activeRareGuests: [] });

  const held = advance(initial, firstEmpty, createNightBusinessContinuityState());
  const cleared = advance(held.snapshot, secondEmpty, held.state);

  assert.equal(held.usedLastKnownGood, true);
  assert.deepEqual(cleared.snapshot.nightBusiness.orders, []);
  assert.equal(cleared.usedLastKnownGood, false);
});

test('does not count repeated polling of the same empty backend frame twice', () => {
  const initial = snapshot({ capturedAtUtc: '2026-06-20T12:00:00.000Z' });
  const cachedEmpty = snapshot({ capturedAtUtc: '2026-06-20T12:00:01.000Z', orders: [], activeRareGuests: [] });

  const firstPoll = advance(initial, cachedEmpty, createNightBusinessContinuityState());
  const secondPoll = advance(firstPoll.snapshot, cachedEmpty, firstPoll.state);

  assert.deepEqual(secondPoll.snapshot.nightBusiness.orders, [ORDER]);
  assert.equal(secondPoll.state.consecutiveEmptySnapshots, 1);
  assert.equal(secondPoll.usedLastKnownGood, true);
});

test('clears immediately when the backend reports an explicit order removal', () => {
  const initial = snapshot({ capturedAtUtc: '2026-06-20T12:00:00.000Z', orderRemovalVersion: 4 });
  const completed = snapshot({
    capturedAtUtc: '2026-06-20T12:00:01.000Z',
    orders: [],
    activeRareGuests: [],
    orderRemovalVersion: 5,
  });

  const result = advance(initial, completed, createNightBusinessContinuityState());
  assert.deepEqual(result.snapshot.nightBusiness.orders, []);
  assert.equal(result.usedLastKnownGood, false);
});

test('clears immediately when the active scene changes', () => {
  const initial = snapshot({ capturedAtUtc: '2026-06-20T12:00:00.000Z' });
  const leftNightScene = snapshot({
    capturedAtUtc: '2026-06-20T12:00:01.000Z',
    activeSceneName: 'DayScene.HumanVillage',
    orders: [],
    activeRareGuests: [],
  });

  const result = advance(initial, leftNightScene, createNightBusinessContinuityState());
  assert.deepEqual(result.snapshot.nightBusiness.orders, []);
  assert.equal(result.usedLastKnownGood, false);
});
