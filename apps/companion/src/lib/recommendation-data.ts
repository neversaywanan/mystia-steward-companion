import type {
  IBeverage,
  ICustomerNormal,
  ICustomerRare,
  IIngredient,
  IRecipe,
  TPlace,
} from '@/lib/types';
import { ALL_PLACES } from '@/lib/types';

const NON_ORDERABLE_RARE_FOOD_TAGS = new Set(['流行喜爱', '流行厌恶']);

export interface RecommendationDataSet {
  recipes: IRecipe[];
  ingredients: IIngredient[];
  beverages: IBeverage[];
  normalCustomers: ICustomerNormal[];
  rareCustomers: ICustomerRare[];
  foodTagIdMap: Record<string, string>;
  beverageTagIdMap: Record<string, string>;
  tagPriorityRules: RuntimeTagPriorityRule[];
  source: 'runtime' | 'unavailable';
  status: string;
}

export interface RuntimeTagPriorityRule {
  id: number;
  tagIds: number[];
  tags: string[];
}

export const DEFAULT_RECOMMENDATION_DATA: RecommendationDataSet = {
  recipes: [],
  ingredients: [],
  beverages: [],
  normalCustomers: [],
  rareCustomers: [],
  foodTagIdMap: {},
  beverageTagIdMap: {},
  tagPriorityRules: [],
  source: 'unavailable',
  status: '等待游戏运行时数据',
};

export interface RuntimeDataCatalogSnapshot {
  isComplete: boolean;
  source: string;
  status: string;
  recipes: Array<Partial<IRecipe> & { id: number; recipeId: number; name: string }>;
  ingredients: Array<Partial<IIngredient> & { id: number; name: string }>;
  beverages: Array<Partial<IBeverage> & { id: number; name: string }>;
  normalCustomers: Array<Partial<ICustomerNormal> & { id: number; name: string }>;
  rareCustomers: Array<Partial<ICustomerRare> & { id: number; name: string }>;
  foodTagIdMap?: Record<string, string>;
  beverageTagIdMap?: Record<string, string>;
  tagPriorityRules?: RuntimeTagPriorityRule[];
}

export function buildRecommendationDataSet(
  runtimeData: RuntimeDataCatalogSnapshot | null | undefined,
): RecommendationDataSet {
  if (!runtimeData?.isComplete) return DEFAULT_RECOMMENDATION_DATA;

  const recipes = runtimeData.recipes
    .map(normalizeRuntimeRecipe)
    .filter((item): item is IRecipe => item !== null);
  const ingredients = runtimeData.ingredients
    .map(normalizeRuntimeIngredient)
    .filter((item): item is IIngredient => item !== null);
  const beverages = runtimeData.beverages
    .map(normalizeRuntimeBeverage)
    .filter((item): item is IBeverage => item !== null);
  const normalCustomers = runtimeData.normalCustomers
    .map(normalizeRuntimeNormalCustomer)
    .filter((item): item is ICustomerNormal => item !== null);
  const rareCustomers = runtimeData.rareCustomers
    .map(normalizeRuntimeRareCustomerData)
    .filter((item): item is ICustomerRare => item !== null);

  if (
    recipes.length === 0
    || ingredients.length === 0
    || beverages.length === 0
    || normalCustomers.length === 0
    || rareCustomers.length === 0
  ) {
    return {
      ...DEFAULT_RECOMMENDATION_DATA,
      status: runtimeData.status || runtimeData.source || '运行时数据不完整',
    };
  }

  return {
    recipes,
    ingredients,
    beverages,
    normalCustomers,
    rareCustomers,
    foodTagIdMap: normalizeStringRecord(runtimeData.foodTagIdMap),
    beverageTagIdMap: normalizeStringRecord(runtimeData.beverageTagIdMap),
    tagPriorityRules: normalizeRuntimeTagPriorityRules(runtimeData.tagPriorityRules),
    source: 'runtime',
    status: runtimeData.status || runtimeData.source || 'game runtime',
  };
}

export function buildRecommendationDataIndexes(data: RecommendationDataSet) {
  return {
    ingredientByName: new Map(data.ingredients.map((ingredient) => [ingredient.name, ingredient])),
    ingredientIdByName: new Map(data.ingredients.map((ingredient) => [ingredient.name, ingredient.id])),
    ingredientNameById: new Map(data.ingredients.map((ingredient) => [ingredient.id, ingredient.name])),
    beverageNameById: new Map(data.beverages.map((beverage) => [beverage.id, beverage.name])),
    recipeByFoodId: new Map(data.recipes.map((recipe) => [recipe.id, recipe])),
    foodTagNameById: new Map(Object.entries(data.foodTagIdMap).map(([id, tag]) => [Number(id), tag])),
    beverageTagNameById: new Map(Object.entries(data.beverageTagIdMap).map(([id, tag]) => [Number(id), tag])),
  };
}

export function getRareCustomersByPlace(
  place: TPlace,
  data: RecommendationDataSet = DEFAULT_RECOMMENDATION_DATA,
): ICustomerRare[] {
  return data.rareCustomers.filter((customer) => customer.places.includes(place));
}

export function getAllRareCustomers(
  data: RecommendationDataSet = DEFAULT_RECOMMENDATION_DATA,
): ICustomerRare[] {
  return data.rareCustomers;
}

function normalizeRuntimeRecipe(value: RuntimeDataCatalogSnapshot['recipes'][number]): IRecipe | null {
  if (!Number.isFinite(value.id) || !Number.isFinite(value.recipeId) || !value.name) return null;
  return {
    id: value.id,
    recipeId: value.recipeId,
    name: value.name,
    description: value.description ?? '',
    ingredients: normalizeStringArray(value.ingredients),
    positiveTags: normalizeStringArray(value.positiveTags),
    negativeTags: normalizeStringArray(value.negativeTags),
    cooker: value.cooker ?? '',
    baseCookTime: value.baseCookTime ?? 0,
    dlc: value.dlc ?? 0,
    level: value.level ?? 0,
    price: value.price ?? 0,
    from: value.from ?? {},
  };
}

function normalizeRuntimeIngredient(value: RuntimeDataCatalogSnapshot['ingredients'][number]): IIngredient | null {
  if (!Number.isFinite(value.id) || !value.name) return null;
  return {
    id: value.id,
    name: value.name,
    description: value.description ?? '',
    type: value.type ?? '',
    tags: normalizeStringArray(value.tags),
    dlc: value.dlc ?? 0,
    level: value.level ?? 0,
    price: value.price ?? 0,
    from: value.from ?? {},
  };
}

function normalizeRuntimeBeverage(value: RuntimeDataCatalogSnapshot['beverages'][number]): IBeverage | null {
  if (!Number.isFinite(value.id) || !value.name) return null;
  return {
    id: value.id,
    name: value.name,
    description: value.description ?? '',
    tags: normalizeStringArray(value.tags),
    dlc: value.dlc ?? 0,
    level: value.level ?? 0,
    price: value.price ?? 0,
    from: value.from ?? {},
  };
}

function normalizeRuntimeNormalCustomer(
  value: RuntimeDataCatalogSnapshot['normalCustomers'][number],
): ICustomerNormal | null {
  if (!Number.isFinite(value.id) || !isUsableRuntimeName(value.name)) return null;
  const places = normalizePlaces(value.places);
  const positiveTags = normalizeStringArray(value.positiveTags);
  const beverageTags = normalizeStringArray(value.beverageTags);
  if (places.length === 0 || (positiveTags.length === 0 && beverageTags.length === 0)) return null;

  return {
    id: value.id,
    name: value.name,
    description: value.description ?? '',
    dlc: value.dlc ?? 0,
    places,
    positiveTags,
    beverageTags,
  };
}

function normalizeRuntimeRareCustomerData(
  value: RuntimeDataCatalogSnapshot['rareCustomers'][number],
): ICustomerRare | null {
  if (!Number.isFinite(value.id) || !isUsableRuntimeName(value.name)) return null;
  const places = normalizePlaces(value.places);
  const positiveTags = normalizeStringArray(value.positiveTags).filter(isOrderableRareFoodTag);
  const beverageTags = normalizeStringArray(value.beverageTags);
  if (places.length === 0 || positiveTags.length === 0 || beverageTags.length === 0) return null;

  return {
    id: value.id,
    name: value.name,
    description: value.description ?? '',
    dlc: value.dlc ?? 0,
    places,
    price: value.price ?? [0, 0],
    enduranceLimit: value.enduranceLimit ?? 1,
    positiveTags,
    negativeTags: normalizeStringArray(value.negativeTags),
    beverageTags,
    positiveTagMapping: value.positiveTagMapping ?? {},
    beverageTagMapping: value.beverageTagMapping ?? {},
    collection: value.collection ?? false,
    evaluation: value.evaluation ?? {},
    spellCards: value.spellCards ?? { positive: [], negative: [] },
  };
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item).trim()).filter(Boolean))]
    : [];
}

function normalizeStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value)
    .map(([key, item]) => [String(key).trim(), String(item).trim()] as const)
    .filter(([key, item]) => key.length > 0 && item.length > 0);
  return Object.fromEntries(entries);
}

function normalizeRuntimeTagPriorityRules(value: unknown): RuntimeTagPriorityRule[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Partial<RuntimeTagPriorityRule>;
      const id = Number(record.id);
      const tagIds = normalizeNumberArray(record.tagIds);
      const tags = normalizeStringArray(record.tags);
      if (!Number.isFinite(id) || id < 0 || tagIds.length === 0 || tags.length === 0) return null;
      return {
        id: Math.trunc(id),
        tagIds,
        tags,
      };
    })
    .filter((item): item is RuntimeTagPriorityRule => item !== null);
}

function normalizeNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const result: number[] = [];
  for (const item of value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item >= 0)
    .map((item) => Math.trunc(item))) {
    if (seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

function normalizePlaces(value: unknown): TPlace[] {
  const places = normalizeStringArray(value)
    .filter((place): place is TPlace => (ALL_PLACES as string[]).includes(place));
  return places;
}

function isUsableRuntimeName(value: unknown): value is string {
  const name = String(value ?? '').trim();
  return Boolean(name)
    && name !== 'missing'
    && name !== 'null'
    && !name.includes('?')
    && !name.startsWith('#');
}

function isOrderableRareFoodTag(tag: string): boolean {
  return Boolean(tag) && !NON_ORDERABLE_RARE_FOOD_TAGS.has(tag);
}
