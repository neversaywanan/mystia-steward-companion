export const GITHUB_BEVERAGE_SPRITE_URL = '/assets/sprites/beverage.png';
export const GITHUB_BEVERAGE_SPRITE_CONFIG = { columns: 10, cellSize: 26, rows: 5 } as const;

export const GITHUB_BEVERAGE_SPRITES = [
  { spriteIndex: 0, beverageId: 0, name: '绿茶' },
  { spriteIndex: 1, beverageId: 1, name: '果味High Ball' },
  { spriteIndex: 2, beverageId: 2, name: '果味SOUR' },
  { spriteIndex: 3, beverageId: 3, name: '淇' },
  { spriteIndex: 4, beverageId: 4, name: '超ZUN啤酒' },
  { spriteIndex: 5, beverageId: 5, name: '日月星' },
  { spriteIndex: 6, beverageId: 6, name: '梅酒' },
  { spriteIndex: 7, beverageId: 7, name: '天狗踊' },
  { spriteIndex: 8, beverageId: 8, name: '猩红恶魔' },
  { spriteIndex: 9, beverageId: 9, name: '神之麦' },
  { spriteIndex: 10, beverageId: 10, name: '水獭祭' },
  { spriteIndex: 11, beverageId: 11, name: '晓' },
  { spriteIndex: 12, beverageId: 12, name: '雀酒' },
  { spriteIndex: 13, beverageId: 13, name: '红魔馆红茶' },
  { spriteIndex: 14, beverageId: 14, name: '阿芙加朵' },
  { spriteIndex: 15, beverageId: 15, name: '红雾' },
  { spriteIndex: 16, beverageId: 16, name: '尼格罗尼' },
  { spriteIndex: 17, beverageId: 17, name: '教父' },
  { spriteIndex: 18, beverageId: 18, name: '风祝' },
  { spriteIndex: 19, beverageId: 19, name: '冬酿' },
  { spriteIndex: 20, beverageId: 20, name: '十四夜' },
  { spriteIndex: 21, beverageId: 21, name: '火鼠裘' },
  { spriteIndex: 22, beverageId: 22, name: '玉露茶' },
  { spriteIndex: 23, beverageId: 23, name: '月面火箭' },
  { spriteIndex: 24, beverageId: 24, name: '牛奶' },
  { spriteIndex: 25, beverageId: 25, name: '红柚果汁' },
  { spriteIndex: 26, beverageId: 26, name: '波子汽水' },
  { spriteIndex: 27, beverageId: 27, name: '冰山毛玉冻柠' },
  { spriteIndex: 28, beverageId: 28, name: '“大冰棍儿！”' },
  { spriteIndex: 29, beverageId: 1000, name: '大吟酿' },
  { spriteIndex: 30, beverageId: 1001, name: '咖啡' },
  { spriteIndex: 31, beverageId: 1002, name: '妖精雨露' },
  { spriteIndex: 32, beverageId: 1003, name: '古法奶油冰沙' },
  { spriteIndex: 33, beverageId: 1004, name: '普通健身茶' },
  { spriteIndex: 34, beverageId: 2000, name: '鬼杀' },
  { spriteIndex: 35, beverageId: 2001, name: '气保健' },
  { spriteIndex: 36, beverageId: 2002, name: '古明地冰激凌' },
  { spriteIndex: 37, beverageId: 3000, name: '杨枝甘露' },
  { spriteIndex: 38, beverageId: 3001, name: '麒麟' },
  { spriteIndex: 39, beverageId: 4000, name: '天地无用' },
  { spriteIndex: 40, beverageId: 4001, name: '伶人醉' },
  { spriteIndex: 41, beverageId: 5000, name: '海的女儿' },
  { spriteIndex: 42, beverageId: 5001, name: '魔界咖啡' },
  { spriteIndex: 43, beverageId: 5002, name: '莫吉托爆浆球' },
  { spriteIndex: 44, beverageId: 5003, name: '太空啤酒' },
  { spriteIndex: 45, beverageId: 5004, name: '卫星冰咖啡' },
  { spriteIndex: 46, beverageId: 11000, name: '姜汁汽水' },
  { spriteIndex: 47, beverageId: 11001, name: '根汁啤酒' },
] as const;

const beverageSpriteById = new Map<number, (typeof GITHUB_BEVERAGE_SPRITES)[number]>(
  GITHUB_BEVERAGE_SPRITES.map((entry) => [entry.beverageId, entry]),
);

const beverageSpriteByName = new Map<string, (typeof GITHUB_BEVERAGE_SPRITES)[number]>(
  GITHUB_BEVERAGE_SPRITES.map((entry) => [entry.name, entry]),
);

const beverageSpriteAliases = new Map<string, (typeof GITHUB_BEVERAGE_SPRITES)[number]>([
  ['冰镇果露', GITHUB_BEVERAGE_SPRITES[27]],
  ['红茶', GITHUB_BEVERAGE_SPRITES[13]],
  ['番茄汁', GITHUB_BEVERAGE_SPRITES[8]],
]);

export function resolveGithubBeverageSprite(beverage: {
  id?: number | null;
  name?: string | null;
}) {
  if (typeof beverage.id === 'number') {
    const byId = beverageSpriteById.get(beverage.id);
    if (byId) return byId;
  }

  const normalizedName = beverage.name?.trim();
  if (!normalizedName) return null;
  return beverageSpriteByName.get(normalizedName) ?? beverageSpriteAliases.get(normalizedName) ?? null;
}
