import type { FavoriteBeverageEntry, FavoriteData, FavoriteRecipeEntry } from '@/companion/types';
import type { IRareBeverageResult, IRareRecipeResult } from '@/lib/types';

export function promoteFavoriteRecipes(
  rows: IRareRecipeResult[],
  favorites: FavoriteData,
  customerId: number,
  foodTag: string,
): IRareRecipeResult[] {
  const matchingFavorites = favorites.recipes
    .filter((favorite) => favorite.customerId === customerId && favorite.foodTag === foodTag)
    .sort(compareFavoriteUpdatedDesc);
  if (matchingFavorites.length === 0) return rows;

  const used = new Set<string>();
  const promoted: IRareRecipeResult[] = [];
  for (const favorite of matchingFavorites) {
    const row = rows.find((candidate) => isRecipeFavoriteMatch(favorite, candidate));
    if (!row) continue;
    const key = recipeResultKey(row);
    if (used.has(key)) continue;
    used.add(key);
    promoted.push(row);
  }

  if (promoted.length === 0) return rows;
  return [...promoted, ...rows.filter((row) => !used.has(recipeResultKey(row)))];
}

export function promoteFavoriteBeverages(
  rows: IRareBeverageResult[],
  favorites: FavoriteData,
  customerId: number,
  beverageTag: string,
): IRareBeverageResult[] {
  const matchingFavorites = favorites.beverages
    .filter((favorite) => favorite.customerId === customerId && favorite.beverageTag === beverageTag)
    .sort(compareFavoriteUpdatedDesc);
  if (matchingFavorites.length === 0) return rows;

  const used = new Set<number>();
  const promoted: IRareBeverageResult[] = [];
  for (const favorite of matchingFavorites) {
    const row = rows.find((candidate) => candidate.beverage.id === favorite.beverageId);
    if (!row || used.has(row.beverage.id)) continue;
    used.add(row.beverage.id);
    promoted.push(row);
  }

  if (promoted.length === 0) return rows;
  return [...promoted, ...rows.filter((row) => !used.has(row.beverage.id))];
}

export function compareFavoriteRecipeResults(
  left: IRareRecipeResult,
  right: IRareRecipeResult,
  favorites: FavoriteData,
  customerId: number,
  foodTag: string,
): number {
  const leftFavorite = findRecipeFavorite(favorites, customerId, foodTag, left);
  const rightFavorite = findRecipeFavorite(favorites, customerId, foodTag, right);
  if (!leftFavorite && !rightFavorite) return 0;
  if (leftFavorite && !rightFavorite) return -1;
  if (!leftFavorite && rightFavorite) return 1;
  if (!leftFavorite || !rightFavorite) return 0;
  return compareFavoriteUpdatedDesc(leftFavorite, rightFavorite);
}

export function compareFavoriteBeverageResults(
  left: IRareBeverageResult,
  right: IRareBeverageResult,
  favorites: FavoriteData,
  customerId: number,
  beverageTag: string,
): number {
  const leftFavorite = findBeverageFavorite(favorites, customerId, beverageTag, left);
  const rightFavorite = findBeverageFavorite(favorites, customerId, beverageTag, right);
  if (!leftFavorite && !rightFavorite) return 0;
  if (leftFavorite && !rightFavorite) return -1;
  if (!leftFavorite && rightFavorite) return 1;
  if (!leftFavorite || !rightFavorite) return 0;
  return compareFavoriteUpdatedDesc(leftFavorite, rightFavorite);
}

export function findRecipeFavorite(
  favorites: FavoriteData,
  customerId: number,
  foodTag: string,
  recipe: IRareRecipeResult,
): FavoriteRecipeEntry | null {
  return favorites.recipes.find((favorite) =>
    favorite.customerId === customerId
    && favorite.foodTag === foodTag
    && isRecipeFavoriteMatch(favorite, recipe)
  ) ?? null;
}

export function findBeverageFavorite(
  favorites: FavoriteData,
  customerId: number,
  beverageTag: string,
  beverage: IRareBeverageResult,
): FavoriteBeverageEntry | null {
  return favorites.beverages.find((favorite) =>
    favorite.customerId === customerId
    && favorite.beverageTag === beverageTag
    && favorite.beverageId === beverage.beverage.id
  ) ?? null;
}

export function recipeFavoriteKey(customerId: number, foodTag: string, recipe: IRareRecipeResult) {
  return `recipe:${customerId}:${foodTag}:${recipeResultKey(recipe)}`;
}

export function beverageFavoriteKey(customerId: number, beverageTag: string, beverage: IRareBeverageResult) {
  return `beverage:${customerId}:${beverageTag}:${beverage.beverage.id}`;
}

export function recipeResultKey(recipe: IRareRecipeResult) {
  return `${recipe.recipe.id}:${normalizeIdList(recipe.extraIngredients.map((ingredient) => ingredient.id)).join(',')}`;
}

export function emptyFavoriteData(): FavoriteData {
  return {
    version: 1,
    recipes: [],
    beverages: [],
  };
}

export function normalizeFavoriteData(data: FavoriteData | null | undefined): FavoriteData {
  return {
    version: Math.max(1, data?.version ?? 1),
    recipes: (data?.recipes ?? []).map((entry) => ({
      ...entry,
      extraIngredientIds: normalizeIdList(entry.extraIngredientIds ?? []),
    })),
    beverages: data?.beverages ?? [],
  };
}

export function normalizeIdList(ids: number[]): number[] {
  return [...new Set(ids.filter((id) => Number.isFinite(id) && id >= 0).map((id) => Math.trunc(id)))].sort((a, b) => a - b);
}

function isRecipeFavoriteMatch(favorite: FavoriteRecipeEntry, recipe: IRareRecipeResult): boolean {
  return favorite.recipeId === recipe.recipe.id
    && normalizeIdList(favorite.extraIngredientIds).join(',') === normalizeIdList(recipe.extraIngredients.map((ingredient) => ingredient.id)).join(',');
}

function compareFavoriteUpdatedDesc<T extends { updatedAtUtc: string }>(left: T, right: T): number {
  const leftTime = Date.parse(left.updatedAtUtc || '');
  const rightTime = Date.parse(right.updatedAtUtc || '');
  return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
}
