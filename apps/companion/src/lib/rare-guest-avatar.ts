export interface RareGuestAvatarPresentation {
  avatarPath: string | null;
  initial: string;
  variantIndex: number;
}

const AVATAR_VARIANT_COUNT = 8;

const RUMIA_AVATAR_URL = new URL('../assets/rare-guests/rumia.svg', import.meta.url).href;
const MOKOU_AVATAR_URL = new URL('../assets/rare-guests/mokou.svg', import.meta.url).href;
const REMILIA_AVATAR_URL = new URL('../assets/rare-guests/remilia.svg', import.meta.url).href;

const RARE_GUEST_AVATARS = [
  {
    avatarPath: RUMIA_AVATAR_URL,
    guestIds: [1, 1002],
    names: ['露米娅', 'rumia'],
  },
  {
    avatarPath: MOKOU_AVATAR_URL,
    guestIds: [2001],
    names: ['藤原妹红', 'mokou', 'fujiwara mokou', 'fujiwara no mokou'],
  },
  {
    avatarPath: REMILIA_AVATAR_URL,
    guestIds: [22, 4008],
    names: ['蕾米莉亚', '蕾米莉亚·斯卡蕾特', 'remilia', 'remilia scarlet'],
  },
] as const;

const AVATAR_PATH_BY_GUEST_NAME = new Map<string, string>(
  RARE_GUEST_AVATARS.flatMap(({ avatarPath, names }) => (
    names.map((name) => [normalizeGuestName(name), avatarPath] as const)
  )),
);

const AVATAR_PATH_BY_GUEST_ID = new Map<number, string>(
  RARE_GUEST_AVATARS.flatMap(({ avatarPath, guestIds }) => (
    guestIds.map((guestId) => [guestId, avatarPath] as const)
  )),
);

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
  const avatarPath = AVATAR_PATH_BY_GUEST_NAME.get(normalizedName)
    ?? (normalizedGuestId === null ? null : AVATAR_PATH_BY_GUEST_ID.get(normalizedGuestId))
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
    .normalize('NFKC')
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
