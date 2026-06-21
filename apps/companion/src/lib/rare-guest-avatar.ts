export interface RareGuestAvatarPresentation {
  initial: string;
  spriteIndex: number | null;
  title: string | null;
  variantIndex: number;
}

export const RARE_GUEST_AVATAR_SPRITE_URL = '/assets/sprites/customer_rare.png';
export const RARE_GUEST_AVATAR_SPRITE_CONFIG = { columns: 10, rows: 7 } as const;

export const RARE_GUEST_AVATARS = [
  { guestId: 0, name: '莉格露' },
  { guestId: 1, name: '露米娅' },
  { guestId: 2, name: '橙' },
  { guestId: 3, name: '稗田阿求' },
  { guestId: 4, name: '上白泽慧音' },
  { guestId: 5, name: '茨木华扇' },
  { guestId: 7, name: '博丽灵梦' },
  { guestId: 8, name: '伊吹萃香' },
  { guestId: 9, name: '比那名居天子' },
  { guestId: 10, name: '雾雨魔理沙' },
  { guestId: 15, name: '红美铃' },
  { guestId: 28, name: '琪露诺' },
  { guestId: 27, name: '帕秋莉' },
  { guestId: 24, name: '藤原妹红' },
  { guestId: 25, name: '蓬莱山辉夜' },
  { guestId: 29, name: '因幡帝' },
  { guestId: 1000, name: '河城荷取' },
  { guestId: 1001, name: '犬走椛' },
  { guestId: 1005, name: '东风谷早苗' },
  { guestId: 1002, name: '爱丽丝' },
  { guestId: 1004, name: '矢田寺成美' },
  { guestId: 2000, name: '黑谷山女' },
  { guestId: 2001, name: '水桥帕露西' },
  { guestId: 2002, name: '星熊勇仪' },
  { guestId: 2003, name: '古明地觉' },
  { guestId: 2004, name: '火焰猫燐' },
  { guestId: 2005, name: '灵乌路空' },
  { guestId: 3000, name: '多多良小伞' },
  { guestId: 3001, name: '村纱水蜜' },
  { guestId: 3002, name: '封兽鵺' },
  { guestId: 3003, name: '物部布都' },
  { guestId: 3004, name: '霍青娥' },
  { guestId: 3005, name: '苏我屠自古' },
  { guestId: 4000, name: '射命丸文' },
  { guestId: 4001, name: '梅蒂欣' },
  { guestId: 4002, name: '风见幽香' },
  { guestId: 4003, name: '鬼人正邪' },
  { guestId: 4004, name: '少名针妙丸' },
  { guestId: 4005, name: '今泉影狼' },
  { guestId: 5000, name: '铃仙' },
  { guestId: 5001, name: '绵月丰姬' },
  { guestId: 5002, name: '绵月依姬' },
  { guestId: 5003, name: '爱莲' },
  { guestId: 5004, name: '魅魔' },
  { guestId: 5005, name: '露易兹' },
  { guestId: 6, name: '森近霖之助' },
  { guestId: 4008, name: '蕾米莉亚' },
  { guestId: 39, name: '魂魄妖梦' },
  { guestId: 40, name: '西行寺幽幽子' },
  { guestId: 30, name: '萌澄果' },
  { guestId: 31, name: '蹦蹦跳跳的三妖精' },
  { guestId: 36, name: '冴月麟' },
  { guestId: 37, name: '立空汐' },
  { guestId: 38, name: '时焉侑' },
  { guestId: 41, name: '秦心' },
  { guestId: 1003, name: '饕餮尤魔' },
  { guestId: 2006, name: '古明地恋' },
  { guestId: 3009, name: '二岩猯藏' },
  { guestId: 5012, name: '八云紫' },
  { guestId: 9000, name: '大妖精' },
  { guestId: 9001, name: '小恶魔' },
  { guestId: 9002, name: '芙兰朵露' },
  { guestId: 9003, name: '八意永琳' },
  { guestId: 9004, name: '神绮' },
  { guestId: 10000, name: '秋静叶' },
  { guestId: 10001, name: '秋穰子' },
  { guestId: 10002, name: '八云蓝' },
  { guestId: 11000, name: '雪' },
  { guestId: 11001, name: '舞' },
] as const;

type RareGuestAvatar = (typeof RARE_GUEST_AVATARS)[number] & { spriteIndex: number };

const avatars = RARE_GUEST_AVATARS.map((guest, spriteIndex): RareGuestAvatar => ({ ...guest, spriteIndex }));
const avatarByGuestId = new Map<number, RareGuestAvatar>(avatars.map((guest) => [guest.guestId, guest]));
const avatarByGuestName = new Map(avatars.map((guest) => [normalizeGuestName(guest.name), guest]));

const avatarAliases = new Map<string, RareGuestAvatar>([
  ['alice', avatarByGuestName.get('爱丽丝')!],
  ['alice margatroid', avatarByGuestName.get('爱丽丝')!],
  ['fujiwara mokou', avatarByGuestName.get('藤原妹红')!],
  ['fujiwara no mokou', avatarByGuestName.get('藤原妹红')!],
  ['mokou', avatarByGuestName.get('藤原妹红')!],
  ['remilia', avatarByGuestName.get('蕾米莉亚')!],
  ['remilia scarlet', avatarByGuestName.get('蕾米莉亚')!],
  ['rumia', avatarByGuestName.get('露米娅')!],
  ['tewi', avatarByGuestName.get('因幡帝')!],
  ['tewi hardsell', avatarByGuestName.get('因幡帝')!],
  ['tewi inaba', avatarByGuestName.get('因幡帝')!],
  ['因幡てゐ', avatarByGuestName.get('因幡帝')!],
  ['蕾米莉亚 斯卡蕾特', avatarByGuestName.get('蕾米莉亚')!],
  ['蕾米莉亚·斯卡蕾特', avatarByGuestName.get('蕾米莉亚')!],
]);

const runtimeIdAliases = new Map<number, RareGuestAvatar>([
  [16, avatarByGuestName.get('因幡帝')!],
  [22, avatarByGuestName.get('蕾米莉亚')!],
]);

const AVATAR_VARIANT_COUNT = 8;

export function resolveRareGuestAvatar({
  guestId,
  name,
}: {
  guestId?: number | null;
  name?: string | null;
}): RareGuestAvatarPresentation {
  const displayName = typeof name === 'string' ? name.trim() : '';
  const normalizedName = normalizeGuestName(displayName);
  const normalizedGuestId = typeof guestId === 'number' && Number.isFinite(guestId)
    ? Math.trunc(guestId)
    : null;
  const byName = avatarByGuestName.get(normalizedName) ?? avatarAliases.get(normalizedName);
  const canUseIdFallback = normalizedName === ''
    || /^guest \d+$/.test(normalizedName)
    || normalizedName === 'special guest';
  const match = byName
    ?? (!canUseIdFallback || normalizedGuestId === null ? null : avatarByGuestId.get(normalizedGuestId))
    ?? (!canUseIdFallback || normalizedGuestId === null ? null : runtimeIdAliases.get(normalizedGuestId))
    ?? null;
  const seed = normalizedGuestId === null ? hashName(normalizedName) : Math.abs(normalizedGuestId);

  return {
    initial: [...displayName][0] ?? '?',
    spriteIndex: match?.spriteIndex ?? null,
    title: match?.name ?? null,
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
