import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveRareGuestAvatar } from '../src/lib/rare-guest-avatar.ts';

test('known guest ids resolve bundled avatar artwork', () => {
  assert.equal(resolveRareGuestAvatar({ guestId: 1, name: '露米娅' }).avatarPath, '/assets/rare-guests/rumia.svg');
  assert.equal(resolveRareGuestAvatar({ guestId: 2001, name: '藤原妹红' }).avatarPath, '/assets/rare-guests/mokou.svg');
  assert.equal(resolveRareGuestAvatar({ guestId: 4008, name: '蕾米莉亚' }).avatarPath, '/assets/rare-guests/remilia.svg');
});

test('known names resolve artwork when runtime id is unavailable', () => {
  assert.equal(resolveRareGuestAvatar({ guestId: null, name: '  蕾米莉亚  ' }).avatarPath, '/assets/rare-guests/remilia.svg');
});

test('unknown guests receive a deterministic initial fallback', () => {
  const first = resolveRareGuestAvatar({ guestId: null, name: ' 米斯蒂娅 ' });
  const second = resolveRareGuestAvatar({ guestId: null, name: '米斯蒂娅' });

  assert.equal(first.avatarPath, null);
  assert.equal(first.initial, '米');
  assert.equal(first.variantIndex, second.variantIndex);
  assert.ok(first.variantIndex >= 0 && first.variantIndex < 8);
});

test('blank guest names use a safe placeholder fallback', () => {
  const avatar = resolveRareGuestAvatar({ guestId: null, name: '   ' });
  assert.equal(avatar.initial, '?');
  assert.equal(avatar.avatarPath, null);
});
