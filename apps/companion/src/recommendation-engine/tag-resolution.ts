import type { IngredientCatalogItem, RecipeCatalogItem } from '@/lib/catalog-types';
import type { RuntimeTagPriorityRule } from '@/lib/recommendation-data';
import { buildDynamicFoodTags } from '@/recommendation-engine/dynamic-food-tags';
import type { ResolvedTags } from '@/recommendation-engine/types';

export const PROJECT_VERIFIED_TAG_PRIORITY_RULES: RuntimeTagPriorityRule[] = [
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

  for (const rule of getEffectiveTagPriorityRules(runtimeRules)) {
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
  recipe: RecipeCatalogItem;
  extraIngredients: IngredientCatalogItem[];
  popularFoodTag: string | null;
  popularHateFoodTag: string | null;
  famousShopEnabled: boolean;
  tagPriorityRules: RuntimeTagPriorityRule[];
}): ResolvedTags {
  const rawTags = [
    ...recipe.positiveTags,
    ...buildDynamicFoodTags({ recipe, extraIngredients }),
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

export function findTagsThatCanSuppress(
  activeTags: string[],
  tagsToSuppress: string[],
  runtimeRules: RuntimeTagPriorityRule[],
): string[] {
  const active = new Set(activeTags);
  const target = new Set(tagsToSuppress);
  const candidates: string[] = [];

  for (const rule of getEffectiveTagPriorityRules(runtimeRules)) {
    for (let index = 1; index < rule.tags.length; index += 1) {
      const suppressedTag = rule.tags[index];
      if (!active.has(suppressedTag) || !target.has(suppressedTag)) continue;
      candidates.push(...rule.tags.slice(0, index));
    }
  }

  return uniqueStrings(candidates);
}

export function hasForbiddenIngredientTag(
  ingredient: IngredientCatalogItem,
  recipe: RecipeCatalogItem,
): boolean {
  return ingredient.tags.some((tag) => recipe.negativeTags.includes(tag));
}

function getEffectiveTagPriorityRules(runtimeRules: RuntimeTagPriorityRule[]): RuntimeTagPriorityRule[] {
  return runtimeRules.length > 0 ? runtimeRules : PROJECT_VERIFIED_TAG_PRIORITY_RULES;
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
