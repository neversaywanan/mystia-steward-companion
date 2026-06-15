import type { IIngredient, IRecipe } from '@/lib/types';
import type { RuntimeTagPriorityRule } from '@/lib/recommendation-data';
import type { ResolvedTags } from '@/recommendation-engine/types';

const FALLBACK_TAG_PRIORITY_RULES: RuntimeTagPriorityRule[] = [
  { id: 1, tagIds: [], tags: ['肉', '素'] },
  { id: 2, tagIds: [], tags: ['重油', '清淡'] },
  { id: 3, tagIds: [], tags: ['饱腹', '下酒'] },
  { id: 4, tagIds: [], tags: ['大份', '小巧'] },
  { id: 5, tagIds: [], tags: ['灼热', '凉爽'] },
];

export function resolveTagPriority(
  rawTags: string[],
  runtimeRules: RuntimeTagPriorityRule[],
): ResolvedTags {
  const uniqueRawTags = uniqueStrings(rawTags);
  const active = new Set(uniqueRawTags);
  const suppressed = new Set<string>();
  const rules = runtimeRules.length > 0 ? runtimeRules : FALLBACK_TAG_PRIORITY_RULES;

  for (const rule of rules) {
    const matchingTags = rule.tags.filter((tag) => active.has(tag));
    if (matchingTags.length <= 1) continue;
    const strongest = matchingTags[0];
    for (const tag of matchingTags) {
      if (tag === strongest) continue;
      active.delete(tag);
      suppressed.add(tag);
    }
  }

  return {
    activeTags: uniqueRawTags.filter((tag) => active.has(tag)),
    suppressedTags: uniqueRawTags.filter((tag) => suppressed.has(tag)),
  };
}

export function resolveFoodTags({
  recipe,
  extraIngredients,
  popularFoodTag,
  popularHateFoodTag,
  famousShopEnabled,
  tagPriorityRules,
}: {
  recipe: IRecipe;
  extraIngredients: IIngredient[];
  popularFoodTag: string | null;
  popularHateFoodTag: string | null;
  famousShopEnabled: boolean;
  tagPriorityRules: RuntimeTagPriorityRule[];
}): ResolvedTags {
  const rawTags = [
    ...recipe.positiveTags,
    ...buildFoodDynamicTags(recipe, extraIngredients),
    ...extraIngredients.flatMap((ingredient) => ingredient.tags),
  ];
  const resolved = resolveTagPriority(rawTags, tagPriorityRules);
  const active = new Set(resolved.activeTags);
  if (famousShopEnabled && active.has('招牌')) active.add('流行喜爱');
  if (popularFoodTag && active.has(popularFoodTag)) active.add('流行喜爱');
  if (popularHateFoodTag && active.has(popularHateFoodTag)) active.add('流行厌恶');

  return {
    activeTags: [...active],
    suppressedTags: resolved.suppressedTags,
  };
}

export function hasForbiddenIngredientTag(
  ingredient: IIngredient,
  recipe: IRecipe,
): boolean {
  return ingredient.tags.some((tag) => recipe.negativeTags.includes(tag));
}

function buildFoodDynamicTags(recipe: IRecipe, extraIngredients: IIngredient[]): string[] {
  const tags: string[] = [];
  if (!recipe.positiveTags.includes('不可加价')) {
    if (recipe.price < 20) tags.push('实惠');
    if (recipe.price > 60) tags.push('昂贵');
  }
  if (recipe.ingredients.length + extraIngredients.length >= 5) tags.push('大份');
  return tags;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = value.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}
