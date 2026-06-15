import type { CompanionPreferences } from '@/companion/preferences';
import type {
  FavoriteData,
  NightBusinessGuest,
  NightBusinessOrder,
  OrderRecommendation,
  RecommendationIssue,
  RecommendationStateSnapshot,
  RuntimeMissionServeTarget,
} from '@/companion/types';
import type { RecommendationDataSet } from '@/lib/recommendation-data';
import type { ICustomerRare } from '@/lib/types';

export interface OrderRecommendationResult {
  recommendations: OrderRecommendation[];
  recommendationIssues: RecommendationIssue[];
}

export interface OrderRecommendationWorkerPayload {
  orders: NightBusinessOrder[];
  runtime: RecommendationStateSnapshot | null;
  runtimeRareCustomers: ICustomerRare[];
  favorites: FavoriteData;
  preferences: CompanionPreferences;
  activeRareGuests: NightBusinessGuest[];
  missionServeTargets: RuntimeMissionServeTarget[];
  data: RecommendationDataSet;
}

export interface OrderRecommendationWorkerRequest {
  requestId: number;
  payload: OrderRecommendationWorkerPayload;
}

export type OrderRecommendationWorkerResponse =
  | {
    requestId: number;
    ok: true;
    result: OrderRecommendationResult;
  }
  | {
    requestId: number;
    ok: false;
    error: string;
  };
