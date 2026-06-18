import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { resolveRareGuestAvatar } from '../src/lib/rare-guest-avatar.ts';

test('known guest ids resolve bundled avatar artwork', () => {
  assert.match(resolveRareGuestAvatar({ guestId: 1, name: '露米娅' }).avatarPath ?? '', /rumia\.svg$/);
  assert.match(resolveRareGuestAvatar({ guestId: 2001, name: '藤原妹红' }).avatarPath ?? '', /mokou\.svg$/);
  assert.match(resolveRareGuestAvatar({ guestId: 4008, name: '蕾米莉亚' }).avatarPath ?? '', /remilia\.svg$/);
});

test('known names resolve artwork when runtime id is unavailable', () => {
  assert.match(resolveRareGuestAvatar({ guestId: null, name: '  蕾米莉亚  ' }).avatarPath ?? '', /remilia\.svg$/);
});

test('runtime identity aliases resolve the corresponding bundled avatar', () => {
  assert.match(resolveRareGuestAvatar({ guestId: null, name: 'Rumia' }).avatarPath ?? '', /rumia\.svg$/);
  assert.match(resolveRareGuestAvatar({ guestId: null, name: 'Mokou' }).avatarPath ?? '', /mokou\.svg$/);
  assert.match(resolveRareGuestAvatar({ guestId: 22, name: 'Remilia' }).avatarPath ?? '', /remilia\.svg$/);
});

test('known avatars are module-managed illustrations without text placeholders', async () => {
  const avatarPaths = [
    resolveRareGuestAvatar({ guestId: 1, name: '露米娅' }).avatarPath,
    resolveRareGuestAvatar({ guestId: 2001, name: '藤原妹红' }).avatarPath,
    resolveRareGuestAvatar({ guestId: 4008, name: '蕾米莉亚' }).avatarPath,
  ];

  for (const avatarPath of avatarPaths) {
    assert.ok(avatarPath);
    const avatarUrl = new URL(avatarPath, import.meta.url);
    const artwork = await readFile(avatarUrl, 'utf8');
    assert.match(artwork, /<svg\b/);
    assert.doesNotMatch(artwork, /<text\b/);
  }
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

test('unknown latin guest names preserve their display-case initial', () => {
  const avatar = resolveRareGuestAvatar({ guestId: null, name: ' Alice ' });
  assert.equal(avatar.initial, 'A');
  assert.equal(avatar.avatarPath, null);
});
