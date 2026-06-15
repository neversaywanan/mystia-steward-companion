export {
  buildNormalBeverageRecommendations,
  buildNormalFoodRecommendations,
  compareNormalBeverageRecommendations,
  compareNormalFoodRecommendations,
  getNormalCustomersByPlace,
} from '@/recommendation-engine/normal-coverage';
export {
  buildRareBeverageCandidates,
  buildRareFoodCandidates,
  buildRareOrderPlans,
  buildRareOrderPlansFromCandidates,
  sortRareOrderPlans,
} from '@/recommendation-engine/rare-orders';
export {
  PROJECT_VERIFIED_TAG_PRIORITY_RULES,
  findTagsThatCanSuppress,
  hasForbiddenIngredientTag,
  resolveFoodTags,
  resolveTagPriority,
} from '@/recommendation-engine/tag-resolution';
export {
  DEFAULT_RECOMMENDATION_SORT_PROFILE,
  RECOMMENDATION_OBJECTIVE_DEFINITIONS,
  RECOMMENDATION_SORT_PRESETS,
  buildDefaultRecommendationSortProfile,
  normalizeRecommendationSortProfile,
  serializeRecommendationSortProfile,
} from '@/recommendation-engine/sort-profile';
export type {
  BeverageCandidate,
  ConditionResult,
  FoodCandidate,
  CustomerCoverageSummary,
  NormalBeverageRecommendation,
  NormalRecipeRecommendation,
  RareBeverageRecommendation,
  RareOrderRecommendationPlan,
  RareRecipeRecommendation,
  RareTagOrderDemand,
  RecommendationBudgetContext,
  RecommendationBudgetPolicy,
  RecommendationBudgetResult,
  RecommendationBucket,
  RecommendationDemand,
  RecommendationExclusions,
  RecommendationRuntimeContext,
  ResolvedTags,
} from '@/recommendation-engine/types';
export type {
  NormalCoverageRuntimeContext,
} from '@/recommendation-engine/normal-coverage';
export type {
  RecommendationBucketPolicy,
  RecommendationObjectiveDefinition,
  RecommendationObjectiveDirection,
  RecommendationObjectiveKey,
  RecommendationObjectiveRule,
  RecommendationPlanSortContext,
  RecommendationSortPreset,
  RecommendationSortPresetId,
  RecommendationSortProfile,
} from '@/recommendation-engine/sort-profile';
