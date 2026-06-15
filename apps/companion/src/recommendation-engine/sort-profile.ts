export type RecommendationSortPresetId = 'balanced' | 'resources' | 'profit' | 'simple';
export type RecommendationBucketPolicy = 'strict' | 'allowPreferenceFallback';
export type RecommendationObjectiveDirection = 'asc' | 'desc';

export type RecommendationObjectiveKey =
  | 'mission'
  | 'favorite'
  | 'foodPreference'
  | 'beveragePreference'
  | 'negativeRisk'
  | 'extraCount'
  | 'resourcePressure'
  | 'totalCost'
  | 'profit'
  | 'beverageStock'
  | 'cookerAvailable';

export interface RecommendationObjectiveDefinition {
  key: RecommendationObjectiveKey;
  label: string;
  description: string;
  direction: RecommendationObjectiveDirection;
}

export interface RecommendationObjectiveRule {
  key: RecommendationObjectiveKey;
  enabled: boolean;
  weight: number;
  direction: RecommendationObjectiveDirection;
}

export interface RecommendationSortProfile {
  preset: RecommendationSortPresetId;
  bucketPolicy: RecommendationBucketPolicy;
  objectives: RecommendationObjectiveRule[];
}

export interface RecommendationPlanSortContext {
  favoriteRecipeKeys?: Set<string>;
  favoriteBeverageIds?: Set<number>;
  missionRecipeId?: number | null;
}

export interface RecommendationSortPreset {
  id: RecommendationSortPresetId;
  label: string;
  profile: RecommendationSortProfile;
}

export const RECOMMENDATION_OBJECTIVE_DEFINITIONS: RecommendationObjectiveDefinition[] = [
  {
    key: 'mission',
    label: '优先任务料理',
    description: '当前订单命中投喂任务料理时靠前。',
    direction: 'desc',
  },
  {
    key: 'favorite',
    label: '优先收藏方案',
    description: '已收藏的料理方案或酒水靠前。',
    direction: 'desc',
  },
  {
    key: 'foodPreference',
    label: '料理偏好命中',
    description: '命中更多稀客喜好料理标签。',
    direction: 'desc',
  },
  {
    key: 'beveragePreference',
    label: '酒水偏好命中',
    description: '命中更多稀客喜好酒水标签。',
    direction: 'desc',
  },
  {
    key: 'negativeRisk',
    label: '减少厌恶标签',
    description: '包含更少稀客厌恶料理标签。',
    direction: 'asc',
  },
  {
    key: 'extraCount',
    label: '减少加料数量',
    description: '更少额外食材，操作更快。',
    direction: 'asc',
  },
  {
    key: 'resourcePressure',
    label: '少用低库存食材',
    description: '降低低库存食材消耗压力。',
    direction: 'asc',
  },
  {
    key: 'totalCost',
    label: '降低食材成本',
    description: '优先更低基础配方和加料成本。',
    direction: 'asc',
  },
  {
    key: 'profit',
    label: '提高预计利润',
    description: '按料理、酒水价格扣除食材成本估算。',
    direction: 'desc',
  },
  {
    key: 'beverageStock',
    label: '优先酒水库存',
    description: '已有库存更多的酒水靠前。',
    direction: 'desc',
  },
  {
    key: 'cookerAvailable',
    label: '当前厨具可做',
    description: '厨具可用的料理方案靠前。',
    direction: 'desc',
  },
];

export const DEFAULT_RECOMMENDATION_SORT_PROFILE = buildRecommendationSortProfile('balanced');
export const RECOMMENDATION_SORT_PRESETS: RecommendationSortPreset[] = [
  {
    id: 'balanced',
    label: '均衡',
    profile: DEFAULT_RECOMMENDATION_SORT_PROFILE,
  },
  {
    id: 'resources',
    label: '省材料',
    profile: buildRecommendationSortProfile('resources'),
  },
  {
    id: 'profit',
    label: '高收益',
    profile: buildRecommendationSortProfile('profit'),
  },
  {
    id: 'simple',
    label: '少操作',
    profile: buildRecommendationSortProfile('simple'),
  },
];

export function buildDefaultRecommendationSortProfile(
  preset: RecommendationSortPresetId = 'balanced',
): RecommendationSortProfile {
  return buildRecommendationSortProfile(preset);
}

export function normalizeRecommendationSortProfile(value: unknown): RecommendationSortProfile {
  const record = isRecord(value) ? value : {};
  const preset = isRecommendationSortPresetId(record.preset) ? record.preset : 'balanced';
  const baseProfile = buildRecommendationSortProfile(preset);
  const bucketPolicy = record.bucketPolicy === 'allowPreferenceFallback'
    ? 'allowPreferenceFallback'
    : baseProfile.bucketPolicy;
  const overrides = Array.isArray(record.objectives) ? record.objectives : [];
  const overrideByKey = new Map<string, Record<string, unknown>>();

  for (const item of overrides) {
    if (!isRecord(item) || typeof item.key !== 'string') continue;
    overrideByKey.set(item.key, item);
  }

  return {
    preset,
    bucketPolicy,
    objectives: baseProfile.objectives.map((rule) => {
      const override = overrideByKey.get(rule.key);
      return {
        key: rule.key,
        enabled: typeof override?.enabled === 'boolean' ? override.enabled : rule.enabled,
        weight: clampObjectiveWeight(typeof override?.weight === 'number' ? override.weight : rule.weight),
        direction: override?.direction === 'asc' || override?.direction === 'desc'
          ? override.direction
          : rule.direction,
      };
    }),
  };
}

export function serializeRecommendationSortProfile(profile: RecommendationSortProfile): string {
  const normalized = normalizeRecommendationSortProfile(profile);
  return JSON.stringify({
    preset: normalized.preset,
    bucketPolicy: normalized.bucketPolicy,
    objectives: normalized.objectives,
  });
}

function buildRecommendationSortProfile(preset: RecommendationSortPresetId): RecommendationSortProfile {
  return {
    preset,
    bucketPolicy: 'strict',
    objectives: RECOMMENDATION_OBJECTIVE_DEFINITIONS.map((definition) => ({
      key: definition.key,
      enabled: true,
      weight: getPresetWeight(preset, definition.key),
      direction: definition.direction,
    })),
  };
}

function getPresetWeight(
  preset: RecommendationSortPresetId,
  key: RecommendationObjectiveKey,
): number {
  const weights: Record<RecommendationSortPresetId, Record<RecommendationObjectiveKey, number>> = {
    balanced: {
      mission: 100,
      favorite: 90,
      foodPreference: 70,
      beveragePreference: 60,
      negativeRisk: 90,
      extraCount: 45,
      resourcePressure: 55,
      totalCost: 30,
      profit: 35,
      beverageStock: 35,
      cookerAvailable: 60,
    },
    resources: {
      mission: 100,
      favorite: 70,
      foodPreference: 55,
      beveragePreference: 45,
      negativeRisk: 90,
      extraCount: 65,
      resourcePressure: 100,
      totalCost: 70,
      profit: 20,
      beverageStock: 80,
      cookerAvailable: 60,
    },
    profit: {
      mission: 100,
      favorite: 55,
      foodPreference: 60,
      beveragePreference: 50,
      negativeRisk: 85,
      extraCount: 25,
      resourcePressure: 35,
      totalCost: 25,
      profit: 100,
      beverageStock: 25,
      cookerAvailable: 50,
    },
    simple: {
      mission: 100,
      favorite: 80,
      foodPreference: 50,
      beveragePreference: 45,
      negativeRisk: 90,
      extraCount: 100,
      resourcePressure: 45,
      totalCost: 45,
      profit: 25,
      beverageStock: 40,
      cookerAvailable: 70,
    },
  };

  return weights[preset][key];
}

function clampObjectiveWeight(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.trunc(value)));
}

function isRecommendationSortPresetId(value: unknown): value is RecommendationSortPresetId {
  return value === 'balanced' || value === 'resources' || value === 'profit' || value === 'simple';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}
