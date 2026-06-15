import { buildRuntimeSets, normalizeCookerName } from '@/companion/domain/cookers';
import { normalizeIdList, recipeResultKey } from '@/companion/domain/favorites';
import { sortNightOrders } from '@/companion/domain/sorting';
import {
  MAX_FOCUS_RECOMMENDATION_ROWS,
  type CompanionPreferences,
} from '@/companion/preferences';
import type {
  CachedRecommendation,
  FavoriteData,
  NightBusinessGuest,
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
  getAllRareCustomers,
  type RecommendationDataSet,
} from '@/lib/recommendation-data';
import type { ICustomerRare, IRareBeverageResult, IRareRecipeResult, TPlace } from '@/lib/types';
import { ALL_PLACES } from '@/lib/types';
import {
  buildRareOrderPlans,
  serializeRecommendationSortProfile,
  type BeverageCandidate,
  type FoodCandidate,
  type RecommendationBudgetContext,
  type RareOrderRecommendationPlan,
  type RecommendationPlanSortContext,
  type RecommendationRuntimeContext,
} from '@/recommendation-engine';

const NON_ORDERABLE_RARE_FOOD_TAGS = new Set(['流行喜爱', '流行厌恶']);

export function buildOrderRecommendations(
  orders: NightBusinessOrder[],
  runtime: RecommendationStateSnapshot | null | undefined,
  rareCustomersById: Map<number, ICustomerRare>,
  cache: Map<string, CachedRecommendation>,
  favorites: FavoriteData,
  preferences: CompanionPreferences,
  activeRareGuests: NightBusinessGuest[] = [],
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

    const missionTarget = preferences.prioritizeMissionRecipes
      ? findMissionServeTargetForOrder(order, missionServeTargets)
      : null;
    const sortContext = buildRecommendationPlanSortContext(
      favorites,
      customer.id,
      foodTag,
      beverageTag,
      missionTarget?.recipeId ?? null,
    );
    const budgetContext = findBudgetContextForOrder(order, activeRareGuests);
    const cacheKey = [
      stateSignature,
      customer.id,
      foodTag,
      beverageTag,
      serializeRecommendationPlanSortContext(sortContext),
      serializeBudgetContext(budgetContext),
    ].join('|');
    let cached = cache.get(cacheKey);
    if (!cached) {
      const plans = buildRareOrderPlans({
        data,
        customer,
        requiredFoodTag: foodTag,
        requiredBeverageTag: beverageTag,
        context: buildRecommendationRuntimeContext(runtime, runtimeSets, preferences, data, { budget: budgetContext }),
        sortProfile: preferences.recommendationSortProfile,
        sortContext,
        limit: MAX_FOCUS_RECOMMENDATION_ROWS * 4,
      });
      cached = {
        customer,
        plans,
        recipes: deriveRecipeRowsFromPlans(plans, true, preferences.recipeVariantLimitPerBase),
        beverages: deriveBeverageRowsFromPlans(plans, true),
        preferenceRecipes: deriveRecipeRowsFromPlans(plans, false, preferences.recipeVariantLimitPerBase),
        preferenceBeverages: deriveBeverageRowsFromPlans(plans, false),
      };
      cache.set(cacheKey, cached);
      trimRecommendationCache(cache);
    }

    const recipeRows = markMissionRecipeRows(cached.recipes, missionTarget?.recipeId ?? null);
    const preferenceRecipeRows = markMissionRecipeRows(cached.preferenceRecipes, missionTarget?.recipeId ?? null);

    recommendations.push({
      order,
      customer: cached.customer,
      plans: cached.plans,
      recipes: recipeRows.slice(0, MAX_FOCUS_RECOMMENDATION_ROWS),
      beverages: cached.beverages.slice(0, MAX_FOCUS_RECOMMENDATION_ROWS),
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

export function buildRecommendationPlanSortContext(
  favorites: FavoriteData,
  customerId: number,
  foodTag: string,
  beverageTag: string,
  missionRecipeId: number | null = null,
): RecommendationPlanSortContext {
  return {
    favoriteRecipeKeys: new Set(
      favorites.recipes
        .filter((favorite) => favorite.customerId === customerId && favorite.foodTag === foodTag)
        .map((favorite) => buildRecipeSortKey(favorite.recipeId, favorite.extraIngredientIds)),
    ),
    favoriteBeverageIds: new Set(
      favorites.beverages
        .filter((favorite) => favorite.customerId === customerId && favorite.beverageTag === beverageTag)
        .map((favorite) => favorite.beverageId),
    ),
    missionRecipeId,
  };
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

function findBudgetContextForOrder(
  order: NightBusinessOrder,
  activeRareGuests: NightBusinessGuest[],
): RecommendationBudgetContext | null {
  if (activeRareGuests.length === 0) return null;
  const guest = findActiveRareGuestForOrder(order, activeRareGuests);
  if (!guest) return null;

  return {
    remainingBudget: normalizeRemainingBudget(guest.fund),
    source: 'runtime-active-guest',
    willPayMoney: guest.willPayMoney ?? null,
  };
}

function findActiveRareGuestForOrder(
  order: NightBusinessOrder,
  activeRareGuests: NightBusinessGuest[],
): NightBusinessGuest | null {
  if (order.guestId != null) {
    const byId = activeRareGuests.find((guest) => guest.guestId === order.guestId);
    if (byId) return byId;
  }

  const orderGuestName = normalizeGuestName(order.guestName);
  const byDeskAndName = activeRareGuests.find((guest) =>
    guest.deskCode === order.deskCode && normalizeGuestName(guest.guestName) === orderGuestName,
  );
  if (byDeskAndName) return byDeskAndName;

  const sameDesk = activeRareGuests.filter((guest) => guest.deskCode === order.deskCode);
  return sameDesk.length === 1 ? sameDesk[0] : null;
}

function normalizeGuestName(value: string): string {
  return value.trim();
}

function normalizeRemainingBudget(value: number | null | undefined): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.trunc(value ?? 0));
}

function markMissionRecipeRows(rows: IRareRecipeResult[], recipeId: number | null): IRareRecipeResult[] {
  if (recipeId == null) return rows;
  return rows.map((row) => (row.recipe.id === recipeId ? markMissionPriorityRecipe(row) : row));
}

function markMissionPriorityRecipe(recipe: IRareRecipeResult): IRareRecipeResult {
  return recipe.missionPriority ? recipe : { ...recipe, missionPriority: true };
}

export function buildRecommendationRuntimeContext(
  runtime: RecommendationStateSnapshot,
  runtimeSets: RuntimeSets,
  preferences: CompanionPreferences,
  data: RecommendationDataSet,
  options: { budget?: RecommendationBudgetContext | null } = {},
): RecommendationRuntimeContext {
  return {
    availableRecipeIds: runtimeSets.recipeIds,
    availableIngredientIds: runtimeSets.ingredientIds,
    availableBeverageIds: runtimeSets.beverageIds,
    disabledIngredientIds: new Set<number>(),
    excludedIngredientIds: new Set(preferences.recommendationExclusions.excludedIngredientIds),
    excludedBeverageIds: new Set(preferences.recommendationExclusions.excludedBeverageIds),
    ownedIngredientQty: runtimeSets.ownedIngredientQty,
    ownedBeverageQty: runtimeSets.ownedBeverageQty,
    placedCookerNames: runtimeSets.placedCookerNames,
    hasCookerSnapshot: runtimeSets.hasCookerSnapshot,
    popularFoodTag: runtime.popularFoodTag,
    popularHateFoodTag: runtime.popularHateFoodTag,
    famousShopEnabled: runtime.famousShopEnabled,
    tagPriorityRules: data.tagPriorityRules,
    maxExtraIngredients: 4,
    filterMissingCookers: preferences.filterMissingCookers,
    budget: options.budget ?? null,
    budgetPolicy: preferences.recommendationBudgetPolicy,
  };
}

export function deriveRecipeRowsFromPlans(
  plans: RareOrderRecommendationPlan[],
  requireOrderTag: boolean,
  variantLimitPerBase = Number.POSITIVE_INFINITY,
): IRareRecipeResult[] {
  const rows: IRareRecipeResult[] = [];
  const seen = new Set<string>();
  const baseRecipeCounts = new Map<number, number>();
  for (const plan of plans) {
    if (!plan.food) continue;
    if (plan.bucket === 'blocked') continue;
    if (plan.food.meetsRequiredFood !== requireOrderTag) continue;
    const row = toRareRecipeResult(plan.food);
    const key = recipeResultKey(row);
    if (seen.has(key)) continue;
    const currentBaseCount = baseRecipeCounts.get(row.recipe.id) ?? 0;
    if (currentBaseCount >= variantLimitPerBase) continue;
    seen.add(key);
    baseRecipeCounts.set(row.recipe.id, currentBaseCount + 1);
    rows.push(row);
  }
  return rows;
}

export function deriveBeverageRowsFromPlans(
  plans: RareOrderRecommendationPlan[],
  requireOrderTag: boolean,
): IRareBeverageResult[] {
  const rows: IRareBeverageResult[] = [];
  const seen = new Set<number>();
  for (const plan of plans) {
    if (!plan.beverage) continue;
    if (plan.bucket === 'blocked') continue;
    if (plan.beverage.meetsRequiredBeverage !== requireOrderTag) continue;
    if (seen.has(plan.beverage.beverage.id)) continue;
    seen.add(plan.beverage.beverage.id);
    rows.push(toRareBeverageResult(plan.beverage));
  }
  return rows;
}

export function toRareRecipeResult(food: FoodCandidate): IRareRecipeResult {
  return {
    recipe: food.recipe,
    extraIngredients: food.extraIngredients,
    extraIngredientReasonTags: food.extraIngredientReasonTags,
    allTags: food.activeTags,
    cancelledTags: food.suppressedTags,
    meetsRequiredFood: food.meetsRequiredFood,
    baseCost: food.baseCost,
    extraCost: food.extraCost,
  };
}

function toRareBeverageResult(beverage: BeverageCandidate): IRareBeverageResult {
  return {
    beverage: beverage.beverage,
    meetsRequiredBev: beverage.meetsRequiredBeverage,
    matchedTags: beverage.matchedTags,
  };
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
    `planSort:${serializeRecommendationSortProfile(preferences.recommendationSortProfile)}`,
    `budgetPolicy:${preferences.recommendationBudgetPolicy}`,
    `recipeVariantLimit:${preferences.recipeVariantLimitPerBase}`,
    `exclusions:${serializeRecommendationExclusions(preferences.recommendationExclusions.excludedIngredientIds, preferences.recommendationExclusions.excludedBeverageIds)}`,
    placedCookers,
  ].join('|');
}

function serializeRecommendationPlanSortContext(context: RecommendationPlanSortContext): string {
  return [
    `mission:${context.missionRecipeId ?? ''}`,
    `recipeFav:${[...(context.favoriteRecipeKeys ?? [])].sort().join(';')}`,
    `bevFav:${[...(context.favoriteBeverageIds ?? [])].sort((left, right) => left - right).join(',')}`,
  ].join('|');
}

function serializeBudgetContext(context: RecommendationBudgetContext | null): string {
  if (!context) return 'budget:none';
  return [
    'budget',
    context.source,
    context.remainingBudget ?? '',
    context.willPayMoney == null ? '' : context.willPayMoney ? '1' : '0',
  ].join(':');
}

function serializeRecommendationExclusions(ingredientIds: number[], beverageIds: number[]): string {
  return [
    ingredientIds.join(','),
    beverageIds.join(','),
  ].join('/');
}

function buildRecipeSortKey(recipeId: number, extraIngredientIds: number[]): string {
  return `${recipeId}:${normalizeIdList(extraIngredientIds).join(',')}`;
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
