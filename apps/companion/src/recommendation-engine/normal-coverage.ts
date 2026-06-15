import type {
  IngredientCatalogItem,
  NormalCustomerCatalogItem,
  PlaceName,
  RecipeCatalogItem,
} from '@/lib/catalog-types';
import type { RecommendationDataSet, RuntimeTagPriorityRule } from '@/lib/recommendation-data';
import {
  resolveFoodTags,
} from '@/recommendation-engine/tag-resolution';
import type {
  ConditionResult,
  CustomerCoverageSummary,
  NormalBeverageRecommendation,
  NormalRecipeRecommendation,
} from '@/recommendation-engine/types';

export interface NormalCoverageRuntimeContext {
  availableRecipeIds: Set<number>;
  availableBeverageIds: Set<number>;
  disabledIngredientIds: Set<number>;
  popularFoodTag: string | null;
  popularHateFoodTag: string | null;
  famousShopEnabled: boolean;
  tagPriorityRules: RuntimeTagPriorityRule[];
}

export function getNormalCustomersByPlace(
  data: RecommendationDataSet,
  place: PlaceName,
): NormalCustomerCatalogItem[] {
  return data.normalCustomers.filter((customer) => customer.places.includes(place));
}

export function buildNormalFoodRecommendations({
  data,
  place,
  context,
}: {
  data: RecommendationDataSet;
  place: PlaceName;
  context: NormalCoverageRuntimeContext;
}): NormalRecipeRecommendation[] {
  const customers = getNormalCustomersByPlace(data, place);
  if (customers.length === 0) return [];

  const ingredientsByName = new Map(data.ingredients.map((ingredient) => [ingredient.name, ingredient]));
  const rows: NormalRecipeRecommendation[] = [];

  for (const recipe of data.recipes) {
    if (!context.availableRecipeIds.has(recipe.id)) continue;
    if (!hasUsableBaseIngredients(recipe, ingredientsByName, context.disabledIngredientIds)) continue;

    const resolvedTags = resolveFoodTags({
      recipe,
      extraIngredients: [],
      popularFoodTag: context.popularFoodTag,
      popularHateFoodTag: context.popularHateFoodTag,
      famousShopEnabled: context.famousShopEnabled,
      tagPriorityRules: context.tagPriorityRules,
    });
    const coverage = buildCustomerCoverage(customers, resolvedTags.activeTags, (customer) => customer.positiveTags);
    const matchedTags = uniqueStrings(coverage.flatMap((item) => item.matchedTags));
    const ingredientCost = calculateBaseIngredientCost(recipe, ingredientsByName);

    rows.push({
      recipe,
      activeTags: resolvedTags.activeTags,
      suppressedTags: resolvedTags.suppressedTags,
      customerCoverage: coverage,
      totalCoverage: sumCoverage(coverage),
      coveredCustomerCount: countCoveredCustomers(coverage),
      profit: recipe.price - ingredientCost,
      matchedTags,
      ingredientCost,
      conditionResults: buildNormalFoodConditions(recipe, coverage, resolvedTags.suppressedTags),
    });
  }

  return rows.sort(compareNormalFoodRecommendations);
}

export function buildNormalBeverageRecommendations({
  data,
  place,
  context,
}: {
  data: RecommendationDataSet;
  place: PlaceName;
  context: NormalCoverageRuntimeContext;
}): NormalBeverageRecommendation[] {
  const customers = getNormalCustomersByPlace(data, place);
  if (customers.length === 0) return [];

  const rows: NormalBeverageRecommendation[] = [];

  for (const beverage of data.beverages) {
    if (!context.availableBeverageIds.has(beverage.id)) continue;

    const coverage = buildCustomerCoverage(customers, beverage.tags, (customer) => customer.beverageTags);
    const matchedTags = uniqueStrings(coverage.flatMap((item) => item.matchedTags));

    rows.push({
      beverage,
      activeTags: uniqueStrings(beverage.tags),
      customerCoverage: coverage,
      totalCoverage: sumCoverage(coverage),
      coveredCustomerCount: countCoveredCustomers(coverage),
      matchedTags,
      conditionResults: buildNormalBeverageConditions(beverage.name, coverage),
    });
  }

  return rows.sort(compareNormalBeverageRecommendations);
}

export function compareNormalFoodRecommendations(
  left: NormalRecipeRecommendation,
  right: NormalRecipeRecommendation,
): number {
  if (left.totalCoverage !== right.totalCoverage) return right.totalCoverage - left.totalCoverage;
  if (left.coveredCustomerCount !== right.coveredCustomerCount) return right.coveredCustomerCount - left.coveredCustomerCount;
  if (left.ingredientCost !== right.ingredientCost) return right.ingredientCost - left.ingredientCost;
  if (left.profit !== right.profit) return right.profit - left.profit;
  return left.recipe.id - right.recipe.id;
}

export function compareNormalBeverageRecommendations(
  left: NormalBeverageRecommendation,
  right: NormalBeverageRecommendation,
): number {
  if (left.totalCoverage !== right.totalCoverage) return right.totalCoverage - left.totalCoverage;
  if (left.coveredCustomerCount !== right.coveredCustomerCount) return right.coveredCustomerCount - left.coveredCustomerCount;
  if (left.beverage.price !== right.beverage.price) return right.beverage.price - left.beverage.price;
  return left.beverage.id - right.beverage.id;
}

function hasUsableBaseIngredients(
  recipe: RecipeCatalogItem,
  ingredientsByName: Map<string, IngredientCatalogItem>,
  disabledIngredientIds: Set<number>,
): boolean {
  return recipe.ingredients.every((name) => {
    const ingredient = ingredientsByName.get(name);
    return ingredient !== undefined && !disabledIngredientIds.has(ingredient.id);
  });
}

function calculateBaseIngredientCost(
  recipe: RecipeCatalogItem,
  ingredientsByName: Map<string, IngredientCatalogItem>,
): number {
  return recipe.ingredients.reduce((sum, name) => sum + (ingredientsByName.get(name)?.price ?? 0), 0);
}

function buildCustomerCoverage(
  customers: NormalCustomerCatalogItem[],
  activeTags: string[],
  getWantedTags: (customer: NormalCustomerCatalogItem) => string[],
): CustomerCoverageSummary[] {
  return customers.map((customer) => {
    const matchedTags = getWantedTags(customer).filter((tag) => activeTags.includes(tag));
    return {
      customerId: customer.id,
      customerName: customer.name,
      matchedTagCount: matchedTags.length,
      matchedTags,
    };
  });
}

function buildNormalFoodConditions(
  recipe: RecipeCatalogItem,
  coverage: CustomerCoverageSummary[],
  suppressedTags: string[],
): ConditionResult[] {
  const results: ConditionResult[] = [{
    id: 'normal.food.coverage',
    target: 'food',
    status: coverage.some((item) => item.matchedTagCount > 0) ? 'boost' : 'info',
    severity: 'soft',
    label: '普客覆盖',
    detail: buildCoverageDetail(coverage),
  }];

  if (recipe.cooker) {
    results.push({
      id: 'normal.food.cooker',
      target: 'food',
      status: 'info',
      severity: 'info',
      label: '厨具',
      detail: `需要 ${recipe.cooker}`,
    });
  }

  if (suppressedTags.length > 0) {
    results.push({
      id: 'normal.food.suppressed-tags',
      target: 'food',
      status: 'info',
      severity: 'info',
      label: '标签优先级',
      detail: `压制 ${suppressedTags.join('、')}`,
    });
  }

  return results;
}

function buildNormalBeverageConditions(
  beverageName: string,
  coverage: CustomerCoverageSummary[],
): ConditionResult[] {
  return [{
    id: 'normal.beverage.coverage',
    target: 'beverage',
    status: coverage.some((item) => item.matchedTagCount > 0) ? 'boost' : 'info',
    severity: 'soft',
    label: '普客覆盖',
    detail: `${beverageName}: ${buildCoverageDetail(coverage)}`,
  }];
}

function buildCoverageDetail(coverage: CustomerCoverageSummary[]): string {
  const covered = coverage.filter((item) => item.matchedTagCount > 0);
  if (covered.length === 0) return '未命中当前地区普客偏好。';
  return covered
    .map((item) => `${item.customerName} ${item.matchedTags.join('、')}`)
    .join('；');
}

function sumCoverage(coverage: CustomerCoverageSummary[]): number {
  return coverage.reduce((sum, item) => sum + item.matchedTagCount, 0);
}

function countCoveredCustomers(coverage: CustomerCoverageSummary[]): number {
  return coverage.filter((item) => item.matchedTagCount > 0).length;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}
