import type { IBeverage, ICustomerRare, IIngredient, IRecipe } from '@/lib/types';
import type { RuntimeTagPriorityRule } from '@/lib/recommendation-data';

export type RecommendationDemand =
  | RareTagOrderDemand
  | NormalExactOrderDemand
  | NormalCoverageDemand;

export interface RareTagOrderDemand {
  type: 'rare-tag-order';
  customer: ICustomerRare;
  requiredFoodTag: string;
  requiredBeverageTag: string;
}

export interface NormalExactOrderDemand {
  type: 'normal-exact-order';
  foodId: number;
  beverageId: number;
}

export interface NormalCoverageDemand {
  type: 'normal-coverage';
  customerIds: number[];
}

export interface RecommendationRuntimeContext {
  availableRecipeIds: Set<number>;
  availableIngredientIds: Set<number>;
  availableBeverageIds: Set<number>;
  disabledIngredientIds: Set<number>;
  excludedIngredientIds: Set<number>;
  excludedBeverageIds: Set<number>;
  ownedIngredientQty: Record<number, number>;
  ownedBeverageQty: Record<number, number>;
  placedCookerNames: Set<string>;
  hasCookerSnapshot: boolean;
  popularFoodTag: string | null;
  popularHateFoodTag: string | null;
  famousShopEnabled: boolean;
  tagPriorityRules: RuntimeTagPriorityRule[];
  maxExtraIngredients: number;
  filterMissingCookers: boolean;
  budget: RecommendationBudgetContext | null;
  budgetPolicy: RecommendationBudgetPolicy;
}

export type RecommendationBudgetPolicy = 'block' | 'warn' | 'ignore';

export interface RecommendationExclusions {
  excludedIngredientIds: number[];
  excludedBeverageIds: number[];
}

export interface RecommendationBudgetContext {
  remainingBudget: number | null;
  source: 'runtime-active-guest' | 'manual' | 'unknown';
  willPayMoney?: boolean | null;
}

export interface RecommendationBudgetResult {
  estimatedPrice: number;
  remainingBudget: number | null;
  overBudget: number;
  policy: RecommendationBudgetPolicy;
  source: RecommendationBudgetContext['source'];
  willPayMoney?: boolean | null;
}

export type ConditionStatus = 'pass' | 'fail' | 'warn' | 'boost' | 'info';
export type ConditionSeverity = 'hard' | 'soft' | 'info';
export type ConditionTarget = 'food' | 'beverage' | 'plan';

export interface ConditionResult {
  id: string;
  target: ConditionTarget;
  status: ConditionStatus;
  severity: ConditionSeverity;
  label: string;
  detail: string;
}

export interface ResolvedTags {
  activeTags: string[];
  suppressedTags: string[];
}

export interface FoodCandidate {
  recipe: IRecipe;
  extraIngredients: IIngredient[];
  extraIngredientReasonTags: Record<number, string[]>;
  activeTags: string[];
  suppressedTags: string[];
  matchedPositiveTags: string[];
  matchedNegativeTags: string[];
  meetsRequiredFood: boolean;
  baseCost: number;
  extraCost: number;
  resourcePressure: number;
  cookerAvailable: boolean;
  conditionResults: ConditionResult[];
}

export interface BeverageCandidate {
  beverage: IBeverage;
  activeTags: string[];
  matchedTags: string[];
  meetsRequiredBeverage: boolean;
  ownedQuantity: number;
  conditionResults: ConditionResult[];
}

export type RecommendationBucket = 'complete' | 'tradeoff' | 'preference' | 'blocked';

export interface RareOrderRecommendationPlan {
  demand: RareTagOrderDemand;
  food: FoodCandidate | null;
  beverage: BeverageCandidate | null;
  bucket: RecommendationBucket;
  estimatedPrice: number;
  budget: RecommendationBudgetResult | null;
  conditionResults: ConditionResult[];
  reasons: string[];
  warnings: string[];
}
