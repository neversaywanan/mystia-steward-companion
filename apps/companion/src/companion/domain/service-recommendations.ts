import { buildRuntimeSets } from '@/companion/domain/cookers';
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
import type { RareCustomerCatalogItem, PlaceName } from '@/lib/catalog-types';
import { ALL_PLACES } from '@/lib/catalog-types';
import {
  buildRareBeverageCandidates,
  buildRareFoodCandidates,
  buildRareOrderPlansFromCandidates,
  serializeRecommendationSortProfile,
  type BeverageCandidate,
  type FoodCandidate,
  type RecommendationBudgetContext,
  type RecommendationBudgetPolicy,
  type RecommendationBudgetResult,
  type RareBeverageRecommendation,
  type RareOrderRecommendationPlan,
  type RareRecipeRecommendation,
  type RecommendationPlanSortContext,
  type RecommendationRuntimeContext,
} from '@/recommendation-engine';

const NON_ORDERABLE_RARE_FOOD_TAGS = new Set(['流行喜爱', '流行厌恶']);
const EXECUTION_FOOD_CANDIDATE_LIMIT = 24;
const EXECUTION_BEVERAGE_CANDIDATE_LIMIT = 16;

export interface RecommendationCacheStore {
  orders: Map<string, CachedRecommendation>;
  foodCandidates: Map<string, FoodCandidate[]>;
  beverageCandidates: Map<string, BeverageCandidate[]>;
}

export function createRecommendationCacheStore(): RecommendationCacheStore {
  return {
    orders: new Map<string, CachedRecommendation>(),
    foodCandidates: new Map<string, FoodCandidate[]>(),
    beverageCandidates: new Map<string, BeverageCandidate[]>(),
  };
}

export function buildOrderRecommendations(
  orders: NightBusinessOrder[],
  runtime: RecommendationStateSnapshot | null | undefined,
  rareCustomersById: Map<number, RareCustomerCatalogItem>,
  caches: RecommendationCacheStore,
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

  const recommendations: OrderRecommendation[] = [];
  const recommendationIssues: RecommendationIssue[] = [];
  const candidateContext = buildRecommendationRuntimeContext(runtime, runtimeSets, preferences, data);

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

    const missionTarget = findMissionServeTargetForOrder(order, missionServeTargets);
    const sortContext = buildRecommendationPlanSortContext(
      favorites,
      customer.id,
      foodTag,
      beverageTag,
      missionTarget?.recipeId ?? null,
    );
    const budgetContext = findBudgetContextForOrder(order, activeRareGuests);
    const foodCandidateKey = buildFoodCandidateCacheKey(data, customer, foodTag, candidateContext);
    const beverageCandidateKey = buildBeverageCandidateCacheKey(data, customer, beverageTag, candidateContext);
    let foodCandidates = caches.foodCandidates.get(foodCandidateKey);
    if (!foodCandidates) {
      foodCandidates = buildRareFoodCandidates(
        data,
        buildRareTagOrderDemand(customer, foodTag, beverageTag),
        candidateContext,
      );
      caches.foodCandidates.set(foodCandidateKey, foodCandidates);
      trimCache(caches.foodCandidates, 48);
    }
    let beverageCandidates = caches.beverageCandidates.get(beverageCandidateKey);
    if (!beverageCandidates) {
      beverageCandidates = buildRareBeverageCandidates(
        data,
        buildRareTagOrderDemand(customer, foodTag, beverageTag),
        candidateContext,
      );
      caches.beverageCandidates.set(beverageCandidateKey, beverageCandidates);
      trimCache(caches.beverageCandidates, 48);
    }
    const cacheKey = [
      foodCandidateKey,
      beverageCandidateKey,
      `sort:${serializeRecommendationSortProfile(preferences.recommendationSortProfile)}`,
      serializeRecommendationPlanSortContext(sortContext),
      `budgetPolicy:${preferences.recommendationBudgetPolicy}`,
      serializeBudgetContext(budgetContext),
      `recipeVariantLimit:${preferences.recipeVariantLimitPerBase}`,
    ].join('|');
    let cached = caches.orders.get(cacheKey);
    if (!cached) {
      const orderRuntimeContext = buildRecommendationRuntimeContext(
        runtime,
        runtimeSets,
        preferences,
        data,
        { budget: budgetContext },
      );
      const executionFoodCandidates = selectExecutionFoodCandidates(foodCandidates, beverageCandidates, orderRuntimeContext.budget, orderRuntimeContext.budgetPolicy);
      const executionBeverageCandidates = selectExecutionBeverageCandidates(beverageCandidates, foodCandidates, orderRuntimeContext.budget, orderRuntimeContext.budgetPolicy);
      const plans = buildRareOrderPlansFromCandidates({
        data,
        customer,
        requiredFoodTag: foodTag,
        requiredBeverageTag: beverageTag,
        context: orderRuntimeContext,
        foodCandidates: executionFoodCandidates,
        beverageCandidates: executionBeverageCandidates,
        sortProfile: preferences.recommendationSortProfile,
        sortContext,
      });
      const preparationPlan = findPreparationPlan(plans);
      cached = {
        customer,
        preparationPlan,
        budget: findRecommendationBudget(plans, preparationPlan),
        blockedMessages: buildBlockedPlanMessages(plans),
        recipes: deriveRecipeRowsFromFoodCandidates(foodCandidates, beverageCandidates, {
          requireOrderTag: true,
          variantLimitPerBase: preferences.recipeVariantLimitPerBase,
          limit: MAX_FOCUS_RECOMMENDATION_ROWS,
          budget: orderRuntimeContext.budget,
          budgetPolicy: orderRuntimeContext.budgetPolicy,
        }),
        beverages: deriveBeverageRowsFromCandidates(beverageCandidates, foodCandidates, {
          requireOrderTag: true,
          limit: MAX_FOCUS_RECOMMENDATION_ROWS,
          budget: orderRuntimeContext.budget,
          budgetPolicy: orderRuntimeContext.budgetPolicy,
        }),
        preferenceRecipes: deriveRecipeRowsFromFoodCandidates(foodCandidates, beverageCandidates, {
          requireOrderTag: false,
          variantLimitPerBase: preferences.recipeVariantLimitPerBase,
          limit: MAX_FOCUS_RECOMMENDATION_ROWS,
          budget: orderRuntimeContext.budget,
          budgetPolicy: orderRuntimeContext.budgetPolicy,
        }),
        preferenceBeverages: deriveBeverageRowsFromCandidates(beverageCandidates, foodCandidates, {
          requireOrderTag: false,
          limit: MAX_FOCUS_RECOMMENDATION_ROWS,
          budget: orderRuntimeContext.budget,
          budgetPolicy: orderRuntimeContext.budgetPolicy,
        }),
      };
      caches.orders.set(cacheKey, cached);
      trimCache(caches.orders, 24);
    }

    const recipeRows = markMissionRecipeRows(cached.recipes, missionTarget?.recipeId ?? null);
    const preferenceRecipeRows = markMissionRecipeRows(cached.preferenceRecipes, missionTarget?.recipeId ?? null);

    recommendations.push({
      order,
      customer: cached.customer,
      preparationPlan: cached.preparationPlan,
      budget: cached.budget,
      blockedMessages: cached.blockedMessages,
      recipes: recipeRows,
      beverages: cached.beverages,
      preferenceRecipes: preferenceRecipeRows,
      preferenceBeverages: cached.preferenceBeverages,
    });
  }

  return { recommendations, recommendationIssues };
}

export function toRuntimeRareCustomer(customer: RuntimeRareCustomer): RareCustomerCatalogItem {
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

export function isUsableRareCustomer(customer: RareCustomerCatalogItem): boolean {
  return isUsableRareCustomerName(customer.name)
    && customer.positiveTags.some(isOrderableRareFoodTag)
    && customer.beverageTags.length > 0;
}

export function isSelectableRareCustomer(customer: RareCustomerCatalogItem): boolean {
  return isUsableRareCustomer(customer) && customer.places.length > 0;
}

export function buildRareCustomerMap(
  runtimeRareCustomers: RareCustomerCatalogItem[],
  data: RecommendationDataSet = DEFAULT_RECOMMENDATION_DATA,
): Map<number, RareCustomerCatalogItem> {
  const map = new Map(getAllRareCustomers(data).map((customer) => [customer.id, customer]));
  for (const customer of runtimeRareCustomers) {
    if (!map.has(customer.id)) map.set(customer.id, customer);
  }
  return map;
}

export function mergeRareCustomers(localCustomers: RareCustomerCatalogItem[], runtimeRareCustomers: RareCustomerCatalogItem[]): RareCustomerCatalogItem[] {
  const seen = new Set<number>();
  const result: RareCustomerCatalogItem[] = [];
  for (const customer of [...localCustomers, ...runtimeRareCustomers]) {
    if (seen.has(customer.id)) continue;
    seen.add(customer.id);
    result.push(customer);
  }
  return result;
}

export function normalizePlace(value: string | null | undefined): PlaceName | null {
  return ALL_PLACES.includes(value as PlaceName) ? value as PlaceName : null;
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

function findRareCustomer(order: NightBusinessOrder, rareCustomersById: Map<number, RareCustomerCatalogItem>) {
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

function markMissionRecipeRows(rows: RareRecipeRecommendation[], recipeId: number | null): RareRecipeRecommendation[] {
  if (recipeId == null) return rows;
  return rows.map((row) => (row.recipe.id === recipeId ? markMissionPriorityRecipe(row) : row));
}

function markMissionPriorityRecipe(recipe: RareRecipeRecommendation): RareRecipeRecommendation {
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

function selectExecutionFoodCandidates(
  foodCandidates: FoodCandidate[],
  beverageCandidates: BeverageCandidate[],
  budget: RecommendationBudgetContext | null,
  budgetPolicy: RecommendationBudgetPolicy,
): FoodCandidate[] {
  const eligible = foodCandidates.filter((food) =>
    candidateHasNoHardFailures(food.conditionResults)
    && canPairFoodWithinBudget(food, beverageCandidates, budget, budgetPolicy),
  );
  return eligible.slice(0, EXECUTION_FOOD_CANDIDATE_LIMIT);
}

function selectExecutionBeverageCandidates(
  beverageCandidates: BeverageCandidate[],
  foodCandidates: FoodCandidate[],
  budget: RecommendationBudgetContext | null,
  budgetPolicy: RecommendationBudgetPolicy,
): BeverageCandidate[] {
  const eligible = beverageCandidates.filter((beverage) =>
    candidateHasNoHardFailures(beverage.conditionResults)
    && canPairBeverageWithinBudget(beverage, foodCandidates, budget, budgetPolicy),
  );
  return eligible.slice(0, EXECUTION_BEVERAGE_CANDIDATE_LIMIT);
}

function findPreparationPlan(plans: RareOrderRecommendationPlan[]): RareOrderRecommendationPlan | null {
  return plans.find((plan) => plan.bucket !== 'blocked') ?? null;
}

function findRecommendationBudget(
  plans: RareOrderRecommendationPlan[],
  preparationPlan: RareOrderRecommendationPlan | null,
): RecommendationBudgetResult | null {
  return preparationPlan?.budget ?? plans.find((plan) => plan.budget)?.budget ?? null;
}

function buildBlockedPlanMessages(plans: RareOrderRecommendationPlan[]): string[] {
  if (plans.length === 0 || plans.some((plan) => plan.bucket !== 'blocked')) return [];

  const messages = plans.flatMap((plan) =>
    plan.conditionResults
      .filter((result) => result.status === 'fail' && result.severity === 'hard')
      .map((result) => result.detail),
  );
  return [...new Set(messages)].slice(0, 3);
}

export function deriveRecipeRowsFromFoodCandidates(
  foodCandidates: FoodCandidate[],
  beverageCandidates: BeverageCandidate[],
  {
    requireOrderTag,
    variantLimitPerBase = Number.POSITIVE_INFINITY,
    limit = Number.POSITIVE_INFINITY,
    budget = null,
    budgetPolicy = 'ignore',
  }: {
    requireOrderTag: boolean;
    variantLimitPerBase?: number;
    limit?: number;
    budget?: RecommendationBudgetContext | null;
    budgetPolicy?: RecommendationBudgetPolicy;
  },
): RareRecipeRecommendation[] {
  const rows: RareRecipeRecommendation[] = [];
  const seen = new Set<string>();
  const baseRecipeCounts = new Map<number, number>();
  const rowLimit = normalizeDerivedRowLimit(limit);
  const baseLimit = normalizeDerivedRowLimit(variantLimitPerBase);
  if (rowLimit <= 0 || baseLimit <= 0) return rows;

  for (const food of foodCandidates) {
    if (food.meetsRequiredFood !== requireOrderTag) continue;
    if (!candidateHasNoHardFailures(food.conditionResults)) continue;
    if (!canPairFoodWithinBudget(food, beverageCandidates, budget, budgetPolicy)) continue;

    const row = toRareRecipeResult(food);
    const key = recipeResultKey(row);
    if (seen.has(key)) continue;
    const currentBaseCount = baseRecipeCounts.get(row.recipe.id) ?? 0;
    if (currentBaseCount >= baseLimit) continue;
    seen.add(key);
    baseRecipeCounts.set(row.recipe.id, currentBaseCount + 1);
    rows.push(row);
    if (rows.length >= rowLimit) break;
  }

  return rows;
}

export function deriveBeverageRowsFromCandidates(
  beverageCandidates: BeverageCandidate[],
  foodCandidates: FoodCandidate[],
  {
    requireOrderTag,
    limit = Number.POSITIVE_INFINITY,
    budget = null,
    budgetPolicy = 'ignore',
  }: {
    requireOrderTag: boolean;
    limit?: number;
    budget?: RecommendationBudgetContext | null;
    budgetPolicy?: RecommendationBudgetPolicy;
  },
): RareBeverageRecommendation[] {
  const rows: RareBeverageRecommendation[] = [];
  const seen = new Set<number>();
  const rowLimit = normalizeDerivedRowLimit(limit);
  if (rowLimit <= 0) return rows;

  for (const beverage of beverageCandidates) {
    if (beverage.meetsRequiredBeverage !== requireOrderTag) continue;
    if (!candidateHasNoHardFailures(beverage.conditionResults)) continue;
    if (!canPairBeverageWithinBudget(beverage, foodCandidates, budget, budgetPolicy)) continue;
    if (seen.has(beverage.beverage.id)) continue;
    seen.add(beverage.beverage.id);
    rows.push(toRareBeverageResult(beverage));
    if (rows.length >= rowLimit) break;
  }

  return rows;
}

export function deriveRecipeRowsFromPlans(
  plans: RareOrderRecommendationPlan[],
  {
    requireOrderTag,
    variantLimitPerBase = Number.POSITIVE_INFINITY,
    limit = Number.POSITIVE_INFINITY,
  }: {
    requireOrderTag: boolean;
    variantLimitPerBase?: number;
    limit?: number;
  },
): RareRecipeRecommendation[] {
  const rows: RareRecipeRecommendation[] = [];
  const seen = new Set<string>();
  const baseRecipeCounts = new Map<number, number>();
  const rowLimit = normalizeDerivedRowLimit(limit);
  const baseLimit = normalizeDerivedRowLimit(variantLimitPerBase);
  if (rowLimit <= 0 || baseLimit <= 0) return rows;

  for (const plan of plans) {
    if (!plan.food) continue;
    if (plan.bucket === 'blocked') continue;
    if (plan.food.meetsRequiredFood !== requireOrderTag) continue;
    const row = toRareRecipeResult(plan.food);
    const key = recipeResultKey(row);
    if (seen.has(key)) continue;
    const currentBaseCount = baseRecipeCounts.get(row.recipe.id) ?? 0;
    if (currentBaseCount >= baseLimit) continue;
    seen.add(key);
    baseRecipeCounts.set(row.recipe.id, currentBaseCount + 1);
    rows.push(row);
    if (rows.length >= rowLimit) break;
  }
  return rows;
}

export function deriveBeverageRowsFromPlans(
  plans: RareOrderRecommendationPlan[],
  {
    requireOrderTag,
    limit = Number.POSITIVE_INFINITY,
  }: {
    requireOrderTag: boolean;
    limit?: number;
  },
): RareBeverageRecommendation[] {
  const rows: RareBeverageRecommendation[] = [];
  const seen = new Set<number>();
  const rowLimit = normalizeDerivedRowLimit(limit);
  if (rowLimit <= 0) return rows;

  for (const plan of plans) {
    if (!plan.beverage) continue;
    if (plan.bucket === 'blocked') continue;
    if (plan.beverage.meetsRequiredBeverage !== requireOrderTag) continue;
    if (seen.has(plan.beverage.beverage.id)) continue;
    seen.add(plan.beverage.beverage.id);
    rows.push(toRareBeverageResult(plan.beverage));
    if (rows.length >= rowLimit) break;
  }
  return rows;
}

function normalizeDerivedRowLimit(value: number): number {
  if (!Number.isFinite(value)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.trunc(value));
}

function candidateHasNoHardFailures(results: { status: string; severity: string }[]): boolean {
  return !results.some((result) => result.status === 'fail' && result.severity === 'hard');
}

function canPairFoodWithinBudget(
  food: FoodCandidate,
  beverageCandidates: BeverageCandidate[],
  budget: RecommendationBudgetContext | null,
  budgetPolicy: RecommendationBudgetPolicy,
): boolean {
  if (budgetPolicy === 'block' && budget?.willPayMoney === false) return false;
  if (!isBudgetBlockingPairing(budget, budgetPolicy)) return true;
  return beverageCandidates.some((beverage) =>
    candidateHasNoHardFailures(beverage.conditionResults)
    && isWithinBlockingBudget(food.recipe.price + beverage.beverage.price, budget),
  );
}

function canPairBeverageWithinBudget(
  beverage: BeverageCandidate,
  foodCandidates: FoodCandidate[],
  budget: RecommendationBudgetContext | null,
  budgetPolicy: RecommendationBudgetPolicy,
): boolean {
  if (budgetPolicy === 'block' && budget?.willPayMoney === false) return false;
  if (!isBudgetBlockingPairing(budget, budgetPolicy)) return true;
  return foodCandidates.some((food) =>
    candidateHasNoHardFailures(food.conditionResults)
    && isWithinBlockingBudget(food.recipe.price + beverage.beverage.price, budget),
  );
}

function isBudgetBlockingPairing(
  budget: RecommendationBudgetContext | null,
  budgetPolicy: RecommendationBudgetPolicy,
): budget is RecommendationBudgetContext {
  return budgetPolicy === 'block'
    && budget != null
    && budget.willPayMoney !== false
    && Number.isFinite(budget.remainingBudget);
}

function isWithinBlockingBudget(estimatedPrice: number, budget: RecommendationBudgetContext): boolean {
  const remainingBudget = Math.max(0, Math.trunc(budget.remainingBudget ?? 0));
  return Math.max(0, estimatedPrice) <= remainingBudget;
}

export function toRareRecipeResult(food: FoodCandidate): RareRecipeRecommendation {
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

function toRareBeverageResult(beverage: BeverageCandidate): RareBeverageRecommendation {
  return {
    beverage: beverage.beverage,
    meetsRequiredBev: beverage.meetsRequiredBeverage,
    matchedTags: beverage.matchedTags,
  };
}

function buildRareTagOrderDemand(customer: RareCustomerCatalogItem, requiredFoodTag: string, requiredBeverageTag: string) {
  return {
    type: 'rare-tag-order' as const,
    customer,
    requiredFoodTag,
    requiredBeverageTag,
  };
}

function buildFoodCandidateCacheKey(
  data: RecommendationDataSet,
  customer: RareCustomerCatalogItem,
  requiredFoodTag: string,
  context: RecommendationRuntimeContext,
): string {
  return [
    'foodCandidates',
    serializeDataSignature(data),
    serializeRareCustomerFoodProfile(customer),
    `requiredFood:${requiredFoodTag}`,
    `recipes:${serializeNumberSet(context.availableRecipeIds)}`,
    `ingredients:${serializeNumberSet(context.availableIngredientIds)}`,
    `excludedIngredients:${serializeNumberSet(context.excludedIngredientIds)}`,
    `ownedIngredients:${serializeNumberRecord(context.ownedIngredientQty)}`,
    `cookers:${serializeStringSet(context.placedCookerNames)}`,
    `hasCookers:${context.hasCookerSnapshot ? '1' : '0'}`,
    `filterCookers:${context.filterMissingCookers ? '1' : '0'}`,
    `popular:${context.popularFoodTag ?? ''}`,
    `popularHate:${context.popularHateFoodTag ?? ''}`,
    `famous:${context.famousShopEnabled ? '1' : '0'}`,
    `tagRules:${serializeTagPriorityRules(context.tagPriorityRules)}`,
    `extraSlots:${context.maxExtraIngredients}`,
  ].join('|');
}

function buildBeverageCandidateCacheKey(
  data: RecommendationDataSet,
  customer: RareCustomerCatalogItem,
  requiredBeverageTag: string,
  context: RecommendationRuntimeContext,
): string {
  return [
    'beverageCandidates',
    serializeDataSignature(data),
    serializeRareCustomerBeverageProfile(customer),
    `requiredBeverage:${requiredBeverageTag}`,
    `beverages:${serializeNumberSet(context.availableBeverageIds)}`,
    `excludedBeverages:${serializeNumberSet(context.excludedBeverageIds)}`,
    `ownedBeverages:${serializeNumberRecord(context.ownedBeverageQty)}`,
  ].join('|');
}

function serializeDataSignature(data: RecommendationDataSet): string {
  return `${data.source}:${data.status}`;
}

function serializeRareCustomerFoodProfile(customer: RareCustomerCatalogItem): string {
  return [
    `customer:${customer.id}`,
    `positive:${serializeStringList(customer.positiveTags)}`,
    `negative:${serializeStringList(customer.negativeTags)}`,
  ].join(';');
}

function serializeRareCustomerBeverageProfile(customer: RareCustomerCatalogItem): string {
  return [
    `customer:${customer.id}`,
    `beverages:${serializeStringList(customer.beverageTags)}`,
  ].join(';');
}

function serializeTagPriorityRules(rules: RecommendationDataSet['tagPriorityRules']): string {
  return rules
    .map((rule) => [
      rule.id,
      serializeNumberList(rule.tagIds),
      serializeStringList(rule.tags),
    ].join(':'))
    .sort()
    .join(';');
}

function serializeNumberSet(values: Set<number>): string {
  return serializeNumberList([...values]);
}

function serializeNumberList(values: number[]): string {
  return [...values].sort((left, right) => left - right).join(',');
}

function serializeStringSet(values: Set<string>): string {
  return serializeStringList([...values]);
}

function serializeStringList(values: string[]): string {
  return [...values].sort().join(',');
}

function serializeNumberRecord(values: Record<number, number>): string {
  return Object.entries(values)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([id, qty]) => `${id}:${qty}`)
    .join(',');
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

function buildRecipeSortKey(recipeId: number, extraIngredientIds: number[]): string {
  return `${recipeId}:${normalizeIdList(extraIngredientIds).join(',')}`;
}

function trimCache<TValue>(cache: Map<string, TValue>, maxSize: number) {
  if (cache.size <= maxSize) return;
  const keysToDelete = [...cache.keys()].slice(0, cache.size - maxSize);
  for (const key of keysToDelete) cache.delete(key);
}

function normalizeRuntimePlaces(places: string[]): PlaceName[] {
  const normalized = places
    .map((place) => normalizePlace(place))
    .filter((place): place is PlaceName => Boolean(place));
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
