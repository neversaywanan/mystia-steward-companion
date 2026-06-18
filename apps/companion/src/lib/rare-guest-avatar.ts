export interface RareGuestAvatarPresentation {
  avatarPath: string | null;
  initial: string;
  variantIndex: number;
}

const AVATAR_VARIANT_COUNT = 8;

const RUMIA_AVATAR_URL = new URL('../assets/rare-guests/rumia.svg', import.meta.url).href;
const MOKOU_AVATAR_URL = new URL('../assets/rare-guests/mokou.svg', import.meta.url).href;
const REMILIA_AVATAR_URL = new URL('../assets/rare-guests/remilia.svg', import.meta.url).href;

const AVATAR_PATH_BY_GUEST_ID = new Map<number, string>([
  [1, RUMIA_AVATAR_URL],
  [22, REMILIA_AVATAR_URL],
  [2001, MOKOU_AVATAR_URL],
  [4008, REMILIA_AVATAR_URL],
]);

const AVATAR_PATH_BY_GUEST_NAME = new Map<string, string>([
  ['露米娅', RUMIA_AVATAR_URL],
  ['rumia', RUMIA_AVATAR_URL],
  ['藤原妹红', MOKOU_AVATAR_URL],
  ['mokou', MOKOU_AVATAR_URL],
  ['fujiwara mokou', MOKOU_AVATAR_URL],
  ['fujiwara no mokou', MOKOU_AVATAR_URL],
  ['蕾米莉亚', REMILIA_AVATAR_URL],
  ['蕾米莉亚·斯卡蕾特', REMILIA_AVATAR_URL],
  ['remilia', REMILIA_AVATAR_URL],
  ['remilia scarlet', REMILIA_AVATAR_URL],
]);

export function resolveRareGuestAvatar({
  guestId,
  name,
}: {
  guestId?: number | null;
  name: string;
}): RareGuestAvatarPresentation {
  const displayName = name.trim();
  const normalizedName = normalizeGuestName(displayName);
  const normalizedGuestId = typeof guestId === 'number' && Number.isFinite(guestId)
    ? Math.trunc(guestId)
    : null;
  const avatarPath = normalizedGuestId === null
    ? AVATAR_PATH_BY_GUEST_NAME.get(normalizedName) ?? null
    : AVATAR_PATH_BY_GUEST_ID.get(normalizedGuestId)
      ?? AVATAR_PATH_BY_GUEST_NAME.get(normalizedName)
      ?? null;
  const seed = normalizedGuestId === null ? hashName(normalizedName) : Math.abs(normalizedGuestId);

  return {
    avatarPath,
    initial: [...displayName][0] ?? '?',
    variantIndex: seed % AVATAR_VARIANT_COUNT,
  };
}

function normalizeGuestName(name: string): string {
  return name
    .trim()
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-US');
}

function hashName(name: string): number {
  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  }
  return hash;
}
