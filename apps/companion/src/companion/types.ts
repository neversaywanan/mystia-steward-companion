import type { RuntimeDataCatalogSnapshot } from '@/lib/recommendation-data';
import type {
  ICustomerRare,
  IRareBeverageResult,
  IRareRecipeResult,
} from '@/lib/types';
import type { RareOrderRecommendationPlan } from '@/recommendation-engine';

export type ModTab = 'overview' | 'normal' | 'rare' | 'service' | 'tasks' | 'inventory' | 'help' | 'logs' | 'settings';
export type OverviewTab = 'status' | 'inventory' | 'actions';
export type SettingsTab = 'window' | 'recommendation' | 'automation' | 'debug';
export type RareGuestInvitationScope = 'current' | 'all';
export type MissionStatusFilter = 'available' | 'tracking' | 'fulfilled';

export interface RecommendationStateSnapshot {
  availableRecipeIds: number[];
  availableBeverageIds: number[];
  availableIngredientIds: number[];
  availableRareCustomerIds?: number[];
  ownedIngredientQty: Record<string, number>;
  ownedBeverageQty: Record<string, number>;
  placedCookerTypeIds?: number[];
  placedCookers?: PlacedCookerSnapshot[];
  placedCookerStatus?: string;
  popularFoodTag: string | null;
  popularHateFoodTag: string | null;
  famousShopEnabled: boolean;
}

export interface PlacedCookerSnapshot {
  controllerIndex: number;
  typeIds: number[];
  typeNames: string[];
  name: string;
  isOpen: boolean;
  source: string;
}

export interface NightBusinessGuest {
  deskCode: number;
  guestId: number | null;
  guestName: string;
  source: string;
  fund?: number | null;
  baseFundCarry?: number | null;
  maxFundCarry?: number | null;
  extraFundByBuff?: number | null;
  willPayMoney?: boolean | null;
}

export interface NightBusinessOrder {
  deskCode: number;
  guestId: number | null;
  guestName: string;
  foodTagId: number;
  foodTag: string;
  beverageTagId: number;
  beverageTag: string;
  source: string;
  firstSeenAtUtc?: string | null;
  lastSeenAtUtc?: string | null;
  hasServedFood?: boolean;
  hasServedBeverage?: boolean;
}

export interface NightBusinessContext {
  place: string | null;
  placeLabel: string | null;
  activeRareGuests: NightBusinessGuest[];
  orders: NightBusinessOrder[];
  source: string;
  error: string | null;
}

export interface RuntimeMissionInfo {
  label: string;
  title: string;
  characterLabel: string;
  characterName: string;
  places?: string[];
  source: string;
  status?: MissionStatusFilter | 'finished';
  started: boolean;
  finished: boolean;
  targetRecipeId?: number | null;
  targetRecipeName?: string | null;
}

export interface RuntimeMissionServeTarget {
  guestId: number;
  guestName: string;
  guestLabel: string;
  missionLabel: string;
  missionTitle: string;
  recipeId: number;
  recipeName: string;
  status: MissionStatusFilter | 'finished';
  source: string;
}

export interface RuntimeMissionContext {
  availableMissions: RuntimeMissionInfo[];
  serveTargets?: RuntimeMissionServeTarget[];
  source: string;
  error: string | null;
}

export interface NormalBusinessOrder {
  orderKey?: string;
  deskCode: number;
  guestName: string;
  foodId: number;
  foodName: string;
  beverageId: number;
  beverageName: string;
  hasServedFood: boolean;
  hasServedBeverage: boolean;
  hasStoredFood?: boolean;
  hasStoredFoodReceipt?: boolean;
  storedFoodCount?: number;
  storedFoodStatus?: string;
  isFulfilled: boolean;
  firstSeenAtUtc?: string | null;
  source: string;
}

export interface NormalBusinessContext {
  orders: NormalBusinessOrder[];
  source: string;
  error: string | null;
}

export interface RuntimeRareCustomer {
  id: number;
  runtimeStringId: string;
  name: string;
  places: string[];
  positiveTags: string[];
  negativeTags: string[];
  beverageTags: string[];
  source: string;
}

export interface LocalApiSnapshot {
  pluginVersion: string;
  capturedAtUtc: string;
  activeSceneName: string;
  activeDayMapLabel?: string;
  activeDayMapName?: string;
  runtimeLoaded: boolean;
  status: string;
  runtimeSource: string;
  runtimeSceneReadinessStatus?: string;
  runtimeUiPinningStatus?: string;
  recommendationState: RecommendationStateSnapshot | null;
  nightBusiness: NightBusinessContext | null;
  runtimeMissions?: RuntimeMissionContext | null;
  normalBusiness?: NormalBusinessContext | null;
  runtimeRareCustomers?: RuntimeRareCustomer[];
  runtimeData?: RuntimeDataCatalogSnapshot;
  performanceMs?: Record<string, number>;
}

export interface RuntimeSets {
  recipeIds: Set<number>;
  beverageIds: Set<number>;
  ingredientIds: Set<number>;
  unavailableIngredientIds: Set<number>;
  ownedIngredientQty: Record<number, number>;
  ownedBeverageQty: Record<number, number>;
  placedCookerTypeIds: Set<number>;
  placedCookerNames: Set<string>;
  hasCookerSnapshot: boolean;
}

export interface CachedRecommendation {
  customer: ICustomerRare;
  plans: RareOrderRecommendationPlan[];
  recipes: IRareRecipeResult[];
  beverages: IRareBeverageResult[];
  preferenceRecipes: IRareRecipeResult[];
  preferenceBeverages: IRareBeverageResult[];
}

export interface OrderRecommendation extends CachedRecommendation {
  order: NightBusinessOrder;
}

export interface RecommendationIssue {
  order: NightBusinessOrder;
  message: string;
}

export interface LocalApiLogs {
  capturedAtUtc: string;
  path: string;
  exists: boolean;
  enabled: boolean;
  maxLines?: number;
  maxBytes?: number;
  lines: string[];
  error: string | null;
}

export interface LocalApiLogSettings {
  logAccessEnabled: boolean;
  logOutputPath: string;
  logOutputDirectory: string;
  maxLogLines?: number;
  maxLogBytes?: number;
  nightBusinessDiagnosticsEnabled: boolean;
  nightBusinessDiagnosticsPath: string;
  nightBusinessDiagnosticsDirectory: string;
  nativeBepInExConsoleEnabled: boolean;
  nativeBepInExConsoleVisible: boolean;
}

export interface LocalApiFolderResponse {
  ok: boolean;
  directory: string;
  error: string | null;
}

export interface DiagnosticPackageResponse {
  ok: boolean;
  path: string;
  directory: string;
  files: string[];
  error: string | null;
}

export interface InventoryEditResponse {
  ok: boolean;
  type: 'ingredient' | 'beverage';
  id: number;
  requestedQuantity: number;
  previousQuantity: number;
  quantity: number;
  changed: boolean;
  error: string | null;
}

export interface InventoryBulkEditResponse {
  ok: boolean;
  type: 'ingredient' | 'beverage';
  requestedQuantity: number;
  total: number;
  changed: number;
  unchanged: number;
  failed: number;
  errors: string[];
  error: string | null;
}

export interface FavoriteData {
  version: number;
  recipes: FavoriteRecipeEntry[];
  beverages: FavoriteBeverageEntry[];
}

export interface FavoriteRecipeEntry {
  id: string;
  customerId: number;
  customerName: string;
  foodTag: string;
  recipeId: number;
  extraIngredientIds: number[];
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface FavoriteBeverageEntry {
  id: string;
  customerId: number;
  customerName: string;
  beverageTag: string;
  beverageId: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface FavoriteMutationResponse {
  ok: boolean;
  favorites: FavoriteData;
  error: string | null;
}

export interface RareGuestInvitationEntry {
  id: number;
  name: string;
  runtimeName: string;
  reason: string;
  status?: string;
  canInvite?: boolean;
  isCurrentScene?: boolean;
  kizunaLevel?: number;
  sceneLabels?: string[];
  sceneNames?: string[];
}

export interface RareGuestInvitationResponse {
  ok: boolean;
  runtimeAvailable: boolean;
  status: string;
  error: string | null;
  candidateCount: number;
  usableCount: number;
  existingSlotCount: number;
  existingControlledCount: number;
  scheduledSlotCount: number;
  invitedCount: number;
  skippedCount: number;
  source?: string;
  diagnostics?: string;
  scope?: RareGuestInvitationScope;
  currentMapLabel?: string;
  currentMapName?: string;
  candidates?: RareGuestInvitationEntry[];
  available: RareGuestInvitationEntry[];
  existingInvited: RareGuestInvitationEntry[];
  invited: RareGuestInvitationEntry[];
  skipped: RareGuestInvitationEntry[];
}

export interface RareOrderDismissResponse {
  ok: boolean;
  removed: number;
  status: string;
  error: string | null;
}

export interface GameUiPinningTarget {
  signature: string;
  recipeId: number;
  recipeName: string;
  ingredientIds: number[];
  beverageId: number;
  beverageName: string;
  cookerTypeId: number;
  cookerName: string;
}

export interface RareAutoOrderDiagnostic {
  orderKey: string;
  title: string;
  foodTag: string;
  beverageTag: string;
  recipeName: string;
  beverageName: string;
  stepLabel: string;
  stepSeconds: number;
  nextAction: string;
  retryCount: number;
  rollbackCount: number;
  lastError: string;
  prepared: boolean;
  beverageHandled: boolean;
  hasServedFood: boolean;
  hasServedBeverage: boolean;
  paused: boolean;
}

export interface NormalAutoOrderDiagnostic {
  orderKey: string;
  title: string;
  foodName: string;
  beverageName: string;
  source: string;
  stepLabel: string;
  stepSeconds: number;
  nextAction: string;
  retryCount: number;
  rollbackCount: number;
  lastError: string;
  prepared: boolean;
  beverageHandled: boolean;
  collected: boolean;
  storedFoodCount: number;
  hasStoredFoodReceipt: boolean;
  storedFoodStatus: string;
  foodDelivered: boolean;
  completed: boolean;
  paused: boolean;
  hasServedFood: boolean;
  hasServedBeverage: boolean;
}

export interface AutomationCookerCycle {
  bucket: number;
  used: Map<string, number>;
  labels: Map<string, string[]>;
}

export interface CookerRequirement {
  key: string;
  label: string;
}

export interface CookerReservationResult {
  ok: boolean;
  message: string;
}

export interface NormalCookerDemand {
  counts: Map<string, number>;
  labels: Map<string, string[]>;
}

export interface AutomationCookerResourceRow {
  key: string;
  label: string;
  capacity: number;
  normalReserved: number;
  rareReserved: number;
  labels: string[];
}

export interface AutomationTrayResourceRow {
  key: string;
  label: string;
  count: number;
  labels: string[];
}

export interface AutomationResourceOverview {
  cookers: AutomationCookerResourceRow[];
  tray: AutomationTrayResourceRow[];
}

export type ToggleRecipeFavorite = (customer: ICustomerRare, foodTag: string, recipe: IRareRecipeResult) => Promise<void>;
export type ToggleBeverageFavorite = (customer: ICustomerRare, beverageTag: string, beverage: IRareBeverageResult) => Promise<void>;

export interface AutomationLogEntry {
  raw: string;
  timestamp: string;
  action: string;
  target: string;
  desk: string;
  orderKey: string;
  food: string;
  guest: string;
  message: string;
}
