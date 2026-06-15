import { buildRuntimeSets, normalizeCookerName, shouldKeepRecipeForCooker } from '@/companion/domain/cookers';
import {
  promoteFavoriteBeverages,
  promoteFavoriteRecipes,
  recipeResultKey,
} from '@/companion/domain/favorites';
import {
  compareRareBeveragesForService,
  compareRareRecipesForService,
  sortNightOrders,
} from '@/companion/domain/sorting';
import {
  MAX_FOCUS_RECOMMENDATION_ROWS,
  serializeSortRules,
  type CompanionPreferences,
} from '@/companion/preferences';
import type {
  CachedRecommendation,
  FavoriteData,
  NightBusinessOrder,
  OrderRecommendation,
  RecommendationIssue,
  RecommendationStateSnapshot,
  RuntimeMissionServeTarget,
  RuntimeRareCustomer,
  RuntimeSets,
} from '@/companion/types';
import {
  DEFAULT_RECOMMENDATION_DATA,
  buildRecommendationDataIndexes,
  type RecommendationDataSet,
} from '@/lib/recommendation-data';
import {
  getAllRareCustomers,
  rankBeveragesForRare,
  rankPreferenceBeveragesForRare,
  rankPreferenceRecipesForRare,
  rankRecipesForRare,
} from '@/lib/rare-recommend';
import type { ICustomerRare, IRareRecipeResult, TPlace } from '@/lib/types';
import { ALL_PLACES } from '@/lib/types';

const NON_ORDERABLE_RARE_FOOD_TAGS = new Set(['流行喜爱', '流行厌恶']);

export function buildOrderRecommendations(
  orders: NightBusinessOrder[],
  runtime: RecommendationStateSnapshot | null | undefined,
  rareCustomersById: Map<number, ICustomerRare>,
  cache: Map<string, CachedRecommendation>,
  favorites: FavoriteData,
  preferences: CompanionPreferences,
  missionServeTargets: RuntimeMissionServeTarget[] = [],
  data: RecommendationDataSet = DEFAULT_RECOMMENDATION_DATA,
): { recommendations: OrderRecommendation[]; recommendationIssues: RecommendationIssue[] } {
  if (orders.length === 0) return { recommendations: [], recommendationIssues: [] };
  const sortedOrders = sortNightOrders(orders, preferences.serviceOrderSortMode);
  if (!runtime) {
    return {
      recommendations: [],
      recommendationIssues: sortedOrders.map((order) => ({ order, message: '运行时推荐数据暂不可用。' })),
    };
  }

  const runtimeSets = buildRuntimeSets(runtime, data);
  if (!runtimeSets) return { recommendations: [], recommendationIssues: [] };

  const dataIndexes = buildRecommendationDataIndexes(data);
  const stateSignature = `${data.source}:${data.status}|${buildRecommendationStateSignature(runtime, preferences)}`;
  const recommendations: OrderRecommendation[] = [];
  const recommendationIssues: RecommendationIssue[] = [];

  for (const order of sortedOrders) {
    const customer = findRareCustomer(order, rareCustomersById);
    const foodTag = order.foodTag.trim();
    const beverageTag = order.beverageTag.trim();

    if (!customer) {
      recommendationIssues.push({ order, message: '无法把该稀客映射到本地稀客数据。' });
      continue;
    }
    if (!foodTag || !beverageTag) {
      recommendationIssues.push({ order, message: '该点单缺少料理 Tag 或酒水 Tag。' });
      continue;
    }

    const cacheKey = `${stateSignature}|${customer.id}|${foodTag}|${beverageTag}`;
    let cached = cache.get(cacheKey);
    if (!cached) {
      const recipes = rankRecipesForRare(
        customer,
        foodTag,
        beverageTag,
        runtimeSets.recipeIds,
        runtimeSets.ingredientIds,
        new Set<number>(),
        runtime.popularFoodTag,
        runtime.popularHateFoodTag,
        4,
        runtimeSets.ownedIngredientQty,
        runtime.famousShopEnabled,
        {},
        data,
      )
        .filter((recipe) => shouldKeepRecipeForCooker(recipe, runtimeSets, preferences.filterMissingCookers))
        .sort((a, b) => compareRareRecipesForService(
          a,
          b,
          runtimeSets.ownedIngredientQty,
          preferences.recipeSortRules,
          runtimeSets,
          dataIndexes,
        ));

      const preferenceRecipes = recipes.length >= 3
        ? []
        : rankPreferenceRecipesForRare(
          customer,
          foodTag,
          beverageTag,
          runtimeSets.recipeIds,
          runtimeSets.ingredientIds,
          new Set<number>(),
          runtime.popularFoodTag,
          runtime.popularHateFoodTag,
          4,
          runtimeSets.ownedIngredientQty,
          runtime.famousShopEnabled,
          data,
        )
          .filter((recipe) => shouldKeepRecipeForCooker(recipe, runtimeSets, preferences.filterMissingCookers))
          .sort((a, b) => compareRareRecipesForService(
            a,
            b,
            runtimeSets.ownedIngredientQty,
            preferences.recipeSortRules,
            runtimeSets,
            dataIndexes,
          ));

      const beverages = rankBeveragesForRare(customer, beverageTag, runtimeSets.beverageIds, data)
        .sort((a, b) => compareRareBeveragesForService(
          a,
          b,
          runtimeSets.ownedBeverageQty,
          preferences.beverageSortRules,
        ));

      const preferenceBeverages = beverages.length >= 3
        ? []
        : rankPreferenceBeveragesForRare(customer, beverageTag, runtimeSets.beverageIds, data)
          .sort((a, b) => compareRareBeveragesForService(
            a,
            b,
            runtimeSets.ownedBeverageQty,
            preferences.beverageSortRules,
          ));

      cached = { customer, recipes, beverages, preferenceRecipes, preferenceBeverages };
      cache.set(cacheKey, cached);
      trimRecommendationCache(cache);
    }

    const missionTarget = preferences.prioritizeMissionRecipes
      ? findMissionServeTargetForOrder(order, missionServeTargets)
      : null;
    let recipeRows = promoteFavoriteRecipes(cached.recipes, favorites, customer.id, foodTag);
    let preferenceRecipeRows = cached.preferenceRecipes;
    if (missionTarget) {
      const missionRecipe = findOrBuildMissionRecipe(
        missionTarget.recipeId,
        recipeRows,
        preferenceRecipeRows,
        customer,
        foodTag,
        beverageTag,
        runtime,
        runtimeSets,
        preferences,
        data,
      );
      if (missionRecipe) {
        recipeRows = promoteMissionRecipe(
          addRecipeRowIfMissing(recipeRows, missionRecipe),
          missionTarget.recipeId,
        );
        preferenceRecipeRows = preferenceRecipeRows.filter((row) => row.recipe.id !== missionTarget.recipeId);
      }
    }

    recommendations.push({
      order,
      customer: cached.customer,
      recipes: recipeRows.slice(0, MAX_FOCUS_RECOMMENDATION_ROWS),
      beverages: promoteFavoriteBeverages(cached.beverages, favorites, customer.id, beverageTag).slice(0, MAX_FOCUS_RECOMMENDATION_ROWS),
      preferenceRecipes: preferenceRecipeRows.slice(0, MAX_FOCUS_RECOMMENDATION_ROWS),
      preferenceBeverages: cached.preferenceBeverages.slice(0, MAX_FOCUS_RECOMMENDATION_ROWS),
    });
  }

  return { recommendations, recommendationIssues };
}

export function toRuntimeRareCustomer(customer: RuntimeRareCustomer): ICustomerRare {
  const name = (customer.name || '').trim();
  return {
    id: customer.id,
    name,
    description: `运行时稀客数据: ${customer.runtimeStringId || customer.source || customer.id}`,
    dlc: 0,
    places: normalizeRuntimePlaces(customer.places),
    price: [0, 0],
    enduranceLimit: 1,
    positiveTags: dedupeStrings(customer.positiveTags).filter(isOrderableRareFoodTag),
    negativeTags: dedupeStrings(customer.negativeTags),
    beverageTags: dedupeStrings(customer.beverageTags),
    positiveTagMapping: {},
    beverageTagMapping: {},
    collection: false,
    evaluation: {},
    spellCards: {
      positive: [],
      negative: [],
    },
  };
}

export function isUsableRareCustomer(customer: ICustomerRare): boolean {
  return isUsableRareCustomerName(customer.name)
    && customer.positiveTags.some(isOrderableRareFoodTag)
    && customer.beverageTags.length > 0;
}

export function isSelectableRareCustomer(customer: ICustomerRare): boolean {
  return isUsableRareCustomer(customer) && customer.places.length > 0;
}

export function buildRareCustomerMap(
  runtimeRareCustomers: ICustomerRare[],
  data: RecommendationDataSet = DEFAULT_RECOMMENDATION_DATA,
): Map<number, ICustomerRare> {
  const map = new Map(getAllRareCustomers(data).map((customer) => [customer.id, customer]));
  for (const customer of runtimeRareCustomers) {
    if (!map.has(customer.id)) map.set(customer.id, customer);
  }
  return map;
}

export function mergeRareCustomers(localCustomers: ICustomerRare[], runtimeRareCustomers: ICustomerRare[]): ICustomerRare[] {
  const seen = new Set<number>();
  const result: ICustomerRare[] = [];
  for (const customer of [...localCustomers, ...runtimeRareCustomers]) {
    if (seen.has(customer.id)) continue;
    seen.add(customer.id);
    result.push(customer);
  }
  return result;
}

export function normalizePlace(value: string | null | undefined): TPlace | null {
  return ALL_PLACES.includes(value as TPlace) ? value as TPlace : null;
}

export function isOrderableRareFoodTag(tag: string): boolean {
  return !NON_ORDERABLE_RARE_FOOD_TAGS.has(tag);
}

function findRareCustomer(order: NightBusinessOrder, rareCustomersById: Map<number, ICustomerRare>) {
  if (order.guestId != null) {
    const byId = rareCustomersById.get(order.guestId);
    if (byId) return byId;
  }

  return [...rareCustomersById.values()].find((customer) => customer.name === order.guestName) ?? null;
}

function findMissionServeTargetForOrder(
  order: NightBusinessOrder,
  targets: RuntimeMissionServeTarget[],
): RuntimeMissionServeTarget | null {
  if (!targets.length) return null;
  return targets.find((target) =>
    target.status !== 'finished'
    && target.recipeId >= 0
    && (
      (order.guestId != null && target.guestId === order.guestId)
      || (!!target.guestName && target.guestName === order.guestName)
    )
  ) ?? null;
}

function findOrBuildMissionRecipe(
  recipeId: number,
  rows: IRareRecipeResult[],
  preferenceRows: IRareRecipeResult[],
  customer: ICustomerRare,
  foodTag: string,
  beverageTag: string,
  runtime: RecommendationStateSnapshot,
  runtimeSets: RuntimeSets,
  preferences: CompanionPreferences,
  data: RecommendationDataSet,
): IRareRecipeResult | null {
  const existing = [...rows, ...preferenceRows].find((row) => row.recipe.id === recipeId);
  if (existing) return existing;
  const dataIndexes = buildRecommendationDataIndexes(data);

  const forced = rankRecipesForRare(
    customer,
    foodTag,
    beverageTag,
    runtimeSets.recipeIds,
    runtimeSets.ingredientIds,
    new Set<number>(),
    runtime.popularFoodTag,
    runtime.popularHateFoodTag,
    4,
    runtimeSets.ownedIngredientQty,
    runtime.famousShopEnabled,
    {
      allowPreferenceFallback: true,
      minFoodScore: 1,
      forcedRecipeIds: new Set([recipeId]),
    },
    data,
  )
    .filter((recipe) => recipe.recipe.id === recipeId)
    .filter((recipe) => shouldKeepRecipeForCooker(recipe, runtimeSets, preferences.filterMissingCookers))
    .sort((a, b) => compareRareRecipesForService(
      a,
      b,
      runtimeSets.ownedIngredientQty,
      preferences.recipeSortRules,
      runtimeSets,
      dataIndexes,
    ));

  return forced[0] ?? null;
}

function addRecipeRowIfMissing(rows: IRareRecipeResult[], recipe: IRareRecipeResult): IRareRecipeResult[] {
  return rows.some((row) => recipeResultKey(row) === recipeResultKey(recipe)) ? rows : [...rows, recipe];
}

function promoteMissionRecipe(rows: IRareRecipeResult[], recipeId: number): IRareRecipeResult[] {
  const target = rows.find((row) => row.recipe.id === recipeId);
  if (!target) return rows;
  return [markMissionPriorityRecipe(target), ...rows.filter((row) => row !== target)];
}

function markMissionPriorityRecipe(recipe: IRareRecipeResult): IRareRecipeResult {
  return recipe.missionPriority ? recipe : { ...recipe, missionPriority: true };
}

function buildRecommendationStateSignature(runtime: RecommendationStateSnapshot, preferences: CompanionPreferences) {
  const ownedQty = Object.entries(runtime.ownedIngredientQty)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([id, qty]) => `${id}:${qty}`)
    .join(',');
  const ownedBeverageQty = Object.entries(runtime.ownedBeverageQty)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([id, qty]) => `${id}:${qty}`)
    .join(',');
  const placedCookers = [
    ...(runtime.placedCookerTypeIds ?? []).map((id) => `id:${id}`),
    ...(runtime.placedCookers ?? []).flatMap((cooker) =>
      [cooker.name, ...(cooker.typeNames ?? [])].map((name) => `name:${normalizeCookerName(name)}`),
    ),
  ].filter(Boolean).sort().join(',');

  return [
    runtime.availableRecipeIds.join(','),
    runtime.availableBeverageIds.join(','),
    runtime.availableIngredientIds.join(','),
    (runtime.availableRareCustomerIds ?? []).join(','),
    ownedQty,
    ownedBeverageQty,
    runtime.popularFoodTag ?? '',
    runtime.popularHateFoodTag ?? '',
    runtime.famousShopEnabled ? '1' : '0',
    preferences.filterMissingCookers ? 'filterCooker:1' : 'filterCooker:0',
    preferences.prioritizeMissionRecipes ? 'missionRecipe:1' : 'missionRecipe:0',
    `recipeSort:${serializeSortRules(preferences.recipeSortRules)}`,
    `beverageSort:${serializeSortRules(preferences.beverageSortRules)}`,
    placedCookers,
  ].join('|');
}

function trimRecommendationCache(cache: Map<string, CachedRecommendation>) {
  if (cache.size <= 24) return;
  const keysToDelete = [...cache.keys()].slice(0, cache.size - 24);
  for (const key of keysToDelete) cache.delete(key);
}

function normalizeRuntimePlaces(places: string[]): TPlace[] {
  const normalized = places
    .map((place) => normalizePlace(place))
    .filter((place): place is TPlace => Boolean(place));
  return [...new Set(normalized)];
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isUsableRareCustomerName(value: string): boolean {
  const name = value.trim();
  return Boolean(name)
    && name !== 'missing'
    && name !== 'null'
    && !name.includes('?')
    && !name.startsWith('#')
    && !/^[A-Za-z0-9_]+$/.test(name);
}
