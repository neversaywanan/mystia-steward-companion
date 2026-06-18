export interface RareGuestAvatarPresentation {
  avatarPath: string | null;
  initial: string;
  variantIndex: number;
}

const AVATAR_VARIANT_COUNT = 8;

const AVATAR_PATH_BY_GUEST_ID = new Map<number, string>([
  [1, '/assets/rare-guests/rumia.svg'],
  [2001, '/assets/rare-guests/mokou.svg'],
  [4008, '/assets/rare-guests/remilia.svg'],
]);

const AVATAR_PATH_BY_GUEST_NAME = new Map<string, string>([
  ['露米娅', '/assets/rare-guests/rumia.svg'],
  ['藤原妹红', '/assets/rare-guests/mokou.svg'],
  ['蕾米莉亚', '/assets/rare-guests/remilia.svg'],
  ['蕾米莉亚·斯卡蕾特', '/assets/rare-guests/remilia.svg'],
]);

export function resolveRareGuestAvatar({
  guestId,
  name,
}: {
  guestId?: number | null;
  name: string;
}): RareGuestAvatarPresentation {
  const normalizedName = name.trim();
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
    initial: [...normalizedName][0] ?? '?',
    variantIndex: seed % AVATAR_VARIANT_COUNT,
  };
}

function hashName(name: string): number {
  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  }
  return hash;
}
