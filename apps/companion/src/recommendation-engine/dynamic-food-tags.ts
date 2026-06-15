import type { IngredientCatalogItem, RecipeCatalogItem } from '@/lib/catalog-types';

const ECONOMICAL_PRICE_LIMIT = 20;
const EXPENSIVE_PRICE_LIMIT = 60;
const LARGE_PORTION_INGREDIENT_COUNT = 5;

export function buildDynamicFoodTags({
  recipe,
  extraIngredients,
}: {
  recipe: RecipeCatalogItem;
  extraIngredients: IngredientCatalogItem[];
}): string[] {
  const tags: string[] = [];
  if (!recipe.positiveTags.includes('不可加价')) {
    if (recipe.price < ECONOMICAL_PRICE_LIMIT) tags.push('实惠');
    if (recipe.price > EXPENSIVE_PRICE_LIMIT) tags.push('昂贵');
  }
  if (recipe.ingredients.length + extraIngredients.length >= LARGE_PORTION_INGREDIENT_COUNT) {
    tags.push('大份');
  }
  return tags;
}
