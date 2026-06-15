import { shouldKeepRecipeForCooker } from '@/companion/domain/cookers';
import {
  DEFAULT_BEVERAGE_SORT_RULES,
  DEFAULT_RECIPE_SORT_RULES,
  type BeverageSortKey,
  type RecipeSortKey,
  type ServiceOrderSortMode,
  type SortRule,
} from '@/companion/preferences';
import type { NightBusinessOrder, NormalBusinessOrder, RuntimeSets } from '@/companion/types';
import {
  DEFAULT_RECOMMENDATION_DATA,
  buildRecommendationDataIndexes,
} from '@/lib/recommendation-data';
import type {
  IIngredient,
  INormalBeverageResult,
  INormalRecipeResult,
  IRareBeverageResult,
  IRareRecipeResult,
  TRating,
} from '@/lib/types';

const DEFAULT_DATA_INDEXES = buildRecommendationDataIndexes(DEFAULT_RECOMMENDATION_DATA);
const LOW_STOCK_RESOURCE_THRESHOLD = 5;
const EXTRA_INGREDIENT_RESOURCE_WEIGHT = 2;

export function sortNightOrders(
  orders: NightBusinessOrder[],
  mode: ServiceOrderSortMode = 'ordered',
): NightBusinessOrder[] {
  const groupFirstSeen = buildOrderGroupFirstSeen(orders);
  return [...orders].sort((left, right) => compareNightOrders(left, right, mode, groupFirstSeen));
}

export function sortNightOrderRows<T extends { order: NightBusinessOrder }>(
  rows: T[],
  mode: ServiceOrderSortMode,
): T[] {
  const groupFirstSeen = buildOrderGroupFirstSeen(rows.map((row) => row.order));
  return [...rows].sort((left, right) => compareNightOrders(left.order, right.order, mode, groupFirstSeen));
}

export function sortNormalOrders(orders: NormalBusinessOrder[]): NormalBusinessOrder[] {
  return [...orders].sort(compareNormalOrdersByTime);
}

export function compareNormalRecipesForMod(a: INormalRecipeResult, b: INormalRecipeResult) {
  if (a.totalCoverage !== b.totalCoverage) return b.totalCoverage - a.totalCoverage;
  if (a.ingredientCost !== b.ingredientCost) return b.ingredientCost - a.ingredientCost;
  return a.recipe.id - b.recipe.id;
}

export function compareNormalBeveragesForMod(a: INormalBeverageResult, b: INormalBeverageResult) {
  if (a.totalCoverage !== b.totalCoverage) return b.totalCoverage - a.totalCoverage;
  if (a.beverage.price !== b.beverage.price) return b.beverage.price - a.beverage.price;
  return a.beverage.id - b.beverage.id;
}

export function compareRareRecipesForService(
  a: IRareRecipeResult,
  b: IRareRecipeResult,
  ownedIngredientQty: Record<number, number> = {},
  rules: SortRule<RecipeSortKey>[] = DEFAULT_RECIPE_SORT_RULES,
  runtimeSets: RuntimeSets | null = null,
  indexes: ReturnType<typeof buildRecommendationDataIndexes> = DEFAULT_DATA_INDEXES,
) {
  const sortRules = rules.length > 0 ? rules : DEFAULT_RECIPE_SORT_RULES;
  for (const rule of sortRules) {
    if (!rule.enabled) continue;
    const diff = getRecipeSortValue(a, rule.key, ownedIngredientQty, runtimeSets, indexes)
      - getRecipeSortValue(b, rule.key, ownedIngredientQty, runtimeSets, indexes);
    if (diff !== 0) return rule.direction === 'asc' ? diff : -diff;
  }
  return a.recipe.id - b.recipe.id;
}

export function compareRareBeveragesForService(
  a: IRareBeverageResult,
  b: IRareBeverageResult,
  ownedBeverageQty: Record<number, number> = {},
  rules: SortRule<BeverageSortKey>[] = DEFAULT_BEVERAGE_SORT_RULES,
) {
  const sortRules = rules.length > 0 ? rules : DEFAULT_BEVERAGE_SORT_RULES;
  for (const rule of sortRules) {
    if (!rule.enabled) continue;
    const diff = getBeverageSortValue(a, rule.key, ownedBeverageQty)
      - getBeverageSortValue(b, rule.key, ownedBeverageQty);
    if (diff !== 0) return rule.direction === 'asc' ? diff : -diff;
  }
  return a.beverage.id - b.beverage.id;
}

function compareNormalOrdersByTime(left: NormalBusinessOrder, right: NormalBusinessOrder): number {
  const leftSeenAt = getNormalOrderSeenTime(left);
  const rightSeenAt = getNormalOrderSeenTime(right);
  if (leftSeenAt !== rightSeenAt) return leftSeenAt - rightSeenAt;
  if (left.deskCode !== right.deskCode) return left.deskCode - right.deskCode;
  const foodCompare = left.foodName.localeCompare(right.foodName, 'zh-Hans-CN');
  if (foodCompare !== 0) return foodCompare;
  return left.beverageName.localeCompare(right.beverageName, 'zh-Hans-CN');
}

function getNormalOrderSeenTime(order: NormalBusinessOrder): number {
  if (!order.firstSeenAtUtc) return Number.MAX_SAFE_INTEGER;
  const time = Date.parse(order.firstSeenAtUtc);
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function compareNightOrders(
  left: NightBusinessOrder,
  right: NightBusinessOrder,
  mode: ServiceOrderSortMode = 'ordered',
  groupFirstSeen: Map<string, number> | null = null,
): number {
  if (mode === 'guest') {
    const leftGroupKey = getOrderGuestGroupKey(left);
    const rightGroupKey = getOrderGuestGroupKey(right);
    if (leftGroupKey !== rightGroupKey) {
      const leftGroupSeenAt = groupFirstSeen?.get(leftGroupKey) ?? getOrderSeenTime(left);
      const rightGroupSeenAt = groupFirstSeen?.get(rightGroupKey) ?? getOrderSeenTime(right);
      if (leftGroupSeenAt !== rightGroupSeenAt) return leftGroupSeenAt - rightGroupSeenAt;
      const groupCompare = compareOrderGroupIdentity(left, right);
      if (groupCompare !== 0) return groupCompare;
    }
  }

  return compareNightOrdersByTime(left, right);
}

function compareNightOrdersByTime(left: NightBusinessOrder, right: NightBusinessOrder): number {
  const leftSeenAt = getOrderSeenTime(left);
  const rightSeenAt = getOrderSeenTime(right);
  if (leftSeenAt !== rightSeenAt) return leftSeenAt - rightSeenAt;
  if (left.deskCode !== right.deskCode) return left.deskCode - right.deskCode;
  return left.guestName.localeCompare(right.guestName, 'zh-Hans-CN');
}

function buildOrderGroupFirstSeen(orders: NightBusinessOrder[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const order of orders) {
    const key = getOrderGuestGroupKey(order);
    const seenAt = getOrderSeenTime(order);
    const current = result.get(key);
    if (current === undefined || seenAt < current) result.set(key, seenAt);
  }
  return result;
}

function getOrderGuestGroupKey(order: NightBusinessOrder): string {
  if (order.guestId !== null && order.guestId !== undefined && order.guestId >= 0) {
    return `id:${order.guestId}`;
  }
  return `name:${order.guestName.trim()}|desk:${order.deskCode}`;
}

function compareOrderGroupIdentity(left: NightBusinessOrder, right: NightBusinessOrder): number {
  const nameCompare = left.guestName.localeCompare(right.guestName, 'zh-Hans-CN');
  if (nameCompare !== 0) return nameCompare;
  const leftGuestId = left.guestId ?? Number.MAX_SAFE_INTEGER;
  const rightGuestId = right.guestId ?? Number.MAX_SAFE_INTEGER;
  if (leftGuestId !== rightGuestId) return leftGuestId - rightGuestId;
  return left.deskCode - right.deskCode;
}

function getOrderSeenTime(order: NightBusinessOrder): number {
  const value = order.firstSeenAtUtc ?? order.lastSeenAtUtc;
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function getRecipeSortValue(
  result: IRareRecipeResult,
  key: RecipeSortKey,
  ownedIngredientQty: Record<number, number>,
  runtimeSets: RuntimeSets | null,
  indexes: ReturnType<typeof buildRecommendationDataIndexes>,
): number {
  switch (key) {
    case 'requiredTag':
      return result.meetsRequiredFood ? 1 : 0;
    case 'foodScore':
      return result.foodScore;
    case 'rating':
      return getRatingRank(result.rating);
    case 'extraCount':
      return result.extraIngredients.length;
    case 'resourcePressure':
      return getRareRecipeResourcePressure(result, ownedIngredientQty, indexes);
    case 'recipePrice':
      return result.recipe.price;
    case 'extraCost':
      return result.extraCost;
    case 'baseCost':
      return result.baseCost;
    case 'totalCost':
      return result.baseCost + result.extraCost;
    case 'profit':
      return result.recipe.price - result.baseCost - result.extraCost;
    case 'cookerAvailable':
      return isRecipeCookerAvailableForSort(result, runtimeSets) ? 1 : 0;
    case 'recipeId':
      return result.recipe.id;
  }
  return 0;
}

function getRatingRank(rating: TRating): number {
  switch (rating) {
    case 'ExGood':
      return 5;
    case 'Good':
      return 4;
    case 'Normal':
      return 3;
    case 'Bad':
      return 2;
    case 'ExBad':
      return 1;
  }
  return 0;
}

function isRecipeCookerAvailableForSort(
  result: IRareRecipeResult,
  runtimeSets: RuntimeSets | null,
): boolean {
  if (!runtimeSets?.hasCookerSnapshot) return true;
  return shouldKeepRecipeForCooker(result, runtimeSets, true);
}

function getRareRecipeResourcePressure(
  result: IRareRecipeResult,
  ownedIngredientQty: Record<number, number>,
  indexes: ReturnType<typeof buildRecommendationDataIndexes> = DEFAULT_DATA_INDEXES,
): number {
  const basePressure = result.recipe.ingredients.reduce((sum, ingredientName) => {
    const ingredient = indexes.ingredientByName.get(ingredientName);
    return sum + (ingredient ? getIngredientResourcePressure(ingredient, ownedIngredientQty) : 0);
  }, 0);

  const extraPressure = result.extraIngredients.reduce(
    (sum, ingredient) => sum + getIngredientResourcePressure(ingredient, ownedIngredientQty),
    0,
  );

  return basePressure + extraPressure * EXTRA_INGREDIENT_RESOURCE_WEIGHT;
}

function getIngredientResourcePressure(
  ingredient: IIngredient,
  ownedIngredientQty: Record<number, number>,
): number {
  const qty = Math.max(0, Math.trunc(ownedIngredientQty[ingredient.id] ?? 0));
  const stockPenalty = qty <= 0
    ? (LOW_STOCK_RESOURCE_THRESHOLD + 1) * 100
    : Math.max(0, LOW_STOCK_RESOURCE_THRESHOLD + 1 - qty) * 100;
  return stockPenalty + ingredient.price;
}

function getBeverageSortValue(
  result: IRareBeverageResult,
  key: BeverageSortKey,
  ownedBeverageQty: Record<number, number>,
): number {
  switch (key) {
    case 'requiredTag':
      return result.meetsRequiredBev ? 1 : 0;
    case 'bevScore':
      return result.bevScore;
    case 'beveragePrice':
      return result.beverage.price;
    case 'ownedQuantity':
      return ownedBeverageQty[result.beverage.id] ?? 0;
    case 'beverageId':
      return result.beverage.id;
  }
  return 0;
}
