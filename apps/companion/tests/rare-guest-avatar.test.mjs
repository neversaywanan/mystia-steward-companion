import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  RARE_GUEST_AVATARS,
  resolveRareGuestAvatar,
} from '../src/lib/rare-guest-avatar.ts';

test('all 69 site catalog guests resolve to their sprite-sheet position by name and id', () => {
  assert.equal(RARE_GUEST_AVATARS.length, 69);

  RARE_GUEST_AVATARS.forEach((guest, spriteIndex) => {
    assert.equal(resolveRareGuestAvatar({ guestId: null, name: guest.name }).spriteIndex, spriteIndex);
    assert.equal(resolveRareGuestAvatar({ guestId: guest.guestId, name: '' }).spriteIndex, spriteIndex);
  });
});

test('bundled rare-guest sprite sheet has the expected 10 by 7 cell geometry', async () => {
  const png = await readFile(new URL('../public/assets/sprites/customer_rare.png', import.meta.url));
  assert.deepEqual([...png.subarray(1, 4)], [80, 78, 71]);
  assert.equal(png.readUInt32BE(16), 1840);
  assert.equal(png.readUInt32BE(20), 1288);
});

test('known names remain authoritative when runtime ids use a different catalog namespace', () => {
  assert.equal(resolveRareGuestAvatar({ guestId: 1, name: '藤原妹红' }).title, '藤原妹红');
  assert.equal(resolveRareGuestAvatar({ guestId: 1002, name: '露米娅' }).title, '露米娅');
});

test('an explicit unknown name does not borrow an avatar from a conflicting id namespace', () => {
  const avatar = resolveRareGuestAvatar({ guestId: 1001, name: '米斯蒂娅' });
  assert.equal(avatar.spriteIndex, null);
  assert.equal(avatar.initial, '米');
});

test('runtime aliases resolve the corresponding site avatar', () => {
  assert.equal(resolveRareGuestAvatar({ guestId: null, name: 'Rumia' }).title, '露米娅');
  assert.equal(resolveRareGuestAvatar({ guestId: null, name: 'Mokou' }).title, '藤原妹红');
  assert.equal(resolveRareGuestAvatar({ guestId: 22, name: 'Guest 22' }).title, '蕾米莉亚');
  assert.equal(resolveRareGuestAvatar({ guestId: 16, name: 'Tewi_HardSell' }).title, '因幡帝');
});

test('official ids do not retain the previous three-avatar placeholder mapping', () => {
  assert.equal(resolveRareGuestAvatar({ guestId: 1002, name: 'Guest 1002' }).title, '爱丽丝');
  assert.equal(resolveRareGuestAvatar({ guestId: 2001, name: 'Guest 2001' }).title, '水桥帕露西');
  assert.equal(resolveRareGuestAvatar({ guestId: 24, name: 'Guest 24' }).title, '藤原妹红');
});

test('unknown guests receive a deterministic initial fallback', () => {
  const first = resolveRareGuestAvatar({ guestId: null, name: ' 米斯蒂娅 ' });
  const second = resolveRareGuestAvatar({ guestId: null, name: '米斯蒂娅' });

  assert.equal(first.spriteIndex, null);
  assert.equal(first.initial, '米');
  assert.equal(first.variantIndex, second.variantIndex);
  assert.ok(first.variantIndex >= 0 && first.variantIndex < 8);
});

test('blank guest names use a safe placeholder fallback', () => {
  const avatar = resolveRareGuestAvatar({ guestId: null, name: '   ' });
  assert.equal(avatar.initial, '?');
  assert.equal(avatar.spriteIndex, null);
});

test('missing guest names use a safe placeholder fallback', () => {
  const avatar = resolveRareGuestAvatar({ guestId: null, name: null });
  assert.equal(avatar.initial, '?');
  assert.equal(avatar.spriteIndex, null);
});

test('unknown latin guest names preserve their display-case initial', () => {
  const avatar = resolveRareGuestAvatar({ guestId: null, name: ' Mystia ' });
  assert.equal(avatar.initial, 'M');
  assert.equal(avatar.spriteIndex, null);
});
