import type {
  OrderPreparationResponse,
  RareAutomationBeverageTarget,
  RareAutomationRecipeTarget,
} from '@/companion/automation-state';
import { readLocalApiJson, readLocalApiJsonWithTimeout } from '@/companion/local-api';
import type { CompanionPreferences } from '@/companion/preferences';
import { normalizeEditableQuantity } from '@/companion/preferences';
import { serializeRareGuestInvitationLevels } from '@/companion/storage';
import type {
  DiagnosticPackageResponse,
  FavoriteData,
  FavoriteMutationResponse,
  GameUiPinningTarget,
  InventoryBulkEditResponse,
  InventoryEditResponse,
  LocalApiFolderResponse,
  LocalApiLogSettings,
  LocalApiLogs,
  LocalApiSnapshot,
  NightBusinessOrder,
  NormalBusinessOrder,
  OrderRecommendation,
  RareGuestInvitationResponse,
  RareGuestInvitationScope,
  RareOrderDismissResponse,
} from '@/companion/types';
import {
  DEFAULT_RECOMMENDATION_DATA,
  buildRecommendationDataIndexes,
  type RecommendationDataSet,
} from '@/lib/recommendation-data';
import type {
  RareCustomerCatalogItem,
} from '@/lib/catalog-types';
import type { RareBeverageRecommendation, RareRecipeRecommendation } from '@/recommendation-engine';

const RARE_TRAY_BACKLOG_REUSE_SECONDS = 30;

export async function readSnapshot(
  endpoint: string,
  apiToken: string,
  options: { signal: AbortSignal; timeoutMs: number },
): Promise<LocalApiSnapshot> {
  return readLocalApiJson<LocalApiSnapshot>(endpoint, apiToken, '/snapshot', {
    signal: options.signal,
    tauriTimeoutMs: options.timeoutMs,
  });
}

export async function readLogs(endpoint: string, apiToken: string, signal: AbortSignal): Promise<LocalApiLogs> {
  return readLocalApiJson<LocalApiLogs>(endpoint, apiToken, '/logs', signal);
}

export async function readAutomationLogs(endpoint: string, apiToken: string, signal: AbortSignal): Promise<LocalApiLogs> {
  return readLocalApiJson<LocalApiLogs>(endpoint, apiToken, '/logs/automation', signal);
}

export async function readLogSettings(endpoint: string, apiToken: string, signal: AbortSignal): Promise<LocalApiLogSettings> {
  return readLocalApiJson<LocalApiLogSettings>(endpoint, apiToken, '/logs/settings', signal);
}

export async function writeLogSettings(
  endpoint: string,
  apiToken: string,
  next: { logAccess?: boolean; diagnostics?: boolean; nativeConsole?: boolean },
  signal: AbortSignal,
): Promise<LocalApiLogSettings> {
  const params = new URLSearchParams();
  if (typeof next.logAccess === 'boolean') params.set('logAccess', String(next.logAccess));
  if (typeof next.diagnostics === 'boolean') params.set('diagnostics', String(next.diagnostics));
  if (typeof next.nativeConsole === 'boolean') params.set('nativeConsole', String(next.nativeConsole));
  return readLocalApiJson<LocalApiLogSettings>(endpoint, apiToken, `/logs/config?${params.toString()}`, signal);
}

export async function openLogFolder(
  endpoint: string,
  apiToken: string,
  target: 'log' | 'diagnostics' | 'automation',
  signal: AbortSignal,
): Promise<LocalApiFolderResponse> {
  return readLocalApiJson<LocalApiFolderResponse>(endpoint, apiToken, `/logs/open-folder?target=${target}`, signal);
}

export async function exportDiagnosticPackage(
  endpoint: string,
  apiToken: string,
  signal: AbortSignal,
): Promise<DiagnosticPackageResponse> {
  return readLocalApiJson<DiagnosticPackageResponse>(endpoint, apiToken, '/logs/export-diagnostics?open=true', signal);
}

export async function inviteAllAvailableRareGuests(
  endpoint: string,
  apiToken: string,
  scope: RareGuestInvitationScope,
  levels: number[],
): Promise<RareGuestInvitationResponse> {
  const params = new URLSearchParams({ scope });
  appendRareGuestInvitationLevels(params, levels);
  return mutateRareGuestInvitation(endpoint, apiToken, `/rare-guests/invite-all?${params.toString()}`);
}

export async function fetchAvailableRareGuestInvitations(
  endpoint: string,
  apiToken: string,
  scope: RareGuestInvitationScope,
): Promise<RareGuestInvitationResponse> {
  const params = new URLSearchParams({ scope });
  return mutateRareGuestInvitation(endpoint, apiToken, `/rare-guests/invitations?${params.toString()}`);
}

export async function inviteAvailableRareGuest(
  endpoint: string,
  apiToken: string,
  guestId: number,
  scope: RareGuestInvitationScope,
): Promise<RareGuestInvitationResponse> {
  const params = new URLSearchParams({ guestId: String(guestId), scope });
  return mutateRareGuestInvitation(endpoint, apiToken, `/rare-guests/invite?${params.toString()}`);
}

export async function dismissRuntimeRareOrder(
  endpoint: string,
  apiToken: string,
  order: NightBusinessOrder,
): Promise<RareOrderDismissResponse> {
  const params = new URLSearchParams({
    deskCode: String(order.deskCode),
    guestName: order.guestName,
    foodTagId: String(order.foodTagId),
    beverageTagId: String(order.beverageTagId),
  });
  if (order.guestId != null) params.set('guestId', String(order.guestId));

  return readLocalApiJsonWithTimeout<RareOrderDismissResponse>(
    endpoint,
    apiToken,
    `/orders/rare/dismiss?${params.toString()}`,
    2500,
  );
}

export async function writeInventoryQuantity(
  endpoint: string,
  apiToken: string,
  itemType: 'ingredient' | 'beverage',
  itemId: number,
  quantity: number,
): Promise<InventoryEditResponse> {
  const params = new URLSearchParams({
    type: itemType,
    id: String(itemId),
    qty: String(normalizeEditableQuantity(quantity)),
  });
  return readLocalApiJsonWithTimeout<InventoryEditResponse>(
    endpoint,
    apiToken,
    `/inventory/set?${params.toString()}`,
    3200,
  );
}

export async function writeInventoryBulkQuantity(
  endpoint: string,
  apiToken: string,
  itemType: 'ingredient' | 'beverage',
  itemIds: number[],
  quantity: number,
): Promise<InventoryBulkEditResponse> {
  const params = new URLSearchParams({
    type: itemType,
    ids: itemIds.join(','),
    qty: String(normalizeEditableQuantity(quantity)),
  });
  return readLocalApiJsonWithTimeout<InventoryBulkEditResponse>(
    endpoint,
    apiToken,
    `/inventory/bulk-set?${params.toString()}`,
    8000,
  );
}

export async function publishGameUiPinningTarget(
  endpoint: string,
  apiToken: string,
  enabled: boolean,
  highlightEnabled: boolean,
  target: GameUiPinningTarget | null,
): Promise<void> {
  const params = new URLSearchParams({
    enabled: String(enabled),
    highlightEnabled: String(highlightEnabled),
    recipeId: target ? String(target.recipeId) : '-1',
    recipeName: target?.recipeName ?? '',
    ingredientIds: target ? target.ingredientIds.join(',') : '',
    beverageId: target ? String(target.beverageId) : '-1',
    beverageName: target?.beverageName ?? '',
    cookerTypeId: target ? String(target.cookerTypeId) : '-1',
    cookerName: target?.cookerName ?? '',
  });
  await readLocalApiJsonWithTimeout<{ ok: boolean }>(
    endpoint,
    apiToken,
    `/ui-pinning/target?${params.toString()}`,
    2200,
  );
}

export async function prepareNextRareOrder(
  endpoint: string,
  apiToken: string,
  item: OrderRecommendation,
  recipeTarget: RareAutomationRecipeTarget | null,
  beverageTarget: RareAutomationBeverageTarget | null,
  preferences: CompanionPreferences,
): Promise<OrderPreparationResponse> {
  return rareOrderAction(
    endpoint,
    apiToken,
    '/orders/prepare-next',
    item,
    recipeTarget,
    beverageTarget,
    preferences,
  );
}

export async function completeFirstRareOrder(
  endpoint: string,
  apiToken: string,
  item: OrderRecommendation,
  recipeTarget: RareAutomationRecipeTarget | null,
  beverageTarget: RareAutomationBeverageTarget | null,
  preferences: CompanionPreferences,
): Promise<OrderPreparationResponse> {
  return rareOrderAction(
    endpoint,
    apiToken,
    '/orders/complete-first',
    item,
    recipeTarget,
    beverageTarget,
    preferences,
  );
}

export async function completeFirstNormalOrder(
  endpoint: string,
  apiToken: string,
  order: NormalBusinessOrder,
  preferences: CompanionPreferences,
  data: RecommendationDataSet = DEFAULT_RECOMMENDATION_DATA,
): Promise<OrderPreparationResponse> {
  const indexes = buildRecommendationDataIndexes(data);
  const recipe = indexes.recipeByFoodId.get(order.foodId)
    ?? data.recipes.find((item) => item.recipeId === order.foodId)
    ?? null;
  const params = new URLSearchParams({
    orderKey: order.orderKey ?? '',
    deskCode: String(order.deskCode),
    guestName: order.guestName || '普客',
    foodId: String(order.foodId),
    recipeId: recipe ? String(recipe.recipeId) : '-1',
    recipeName: order.foodName || recipe?.name || '',
    beverageId: String(order.beverageId),
    beverageName: order.beverageName || indexes.beverageNameById.get(order.beverageId) || '',
    autoTakeBeverage: String(preferences.autoNormalTakeBeverage),
    autoStartCooking: String(preferences.autoNormalStartCooking),
    autoCollectCooking: String(preferences.autoNormalCollectCooking),
    autoDeliverFood: String(preferences.autoNormalDeliverFood),
    autoCompleteOrder: String(preferences.autoNormalCompleteOrder),
    stopOnError: String(preferences.autoNormalStopOnError),
  });
  return readLocalApiJsonWithTimeout<OrderPreparationResponse>(
    endpoint,
    apiToken,
    `/orders/normal/complete-first?${params.toString()}`,
    5000,
  );
}

export async function readFavorites(endpoint: string, apiToken: string, signal: AbortSignal): Promise<FavoriteData> {
  return readLocalApiJson<FavoriteData>(endpoint, apiToken, '/favorites', signal);
}

export async function addRecipeFavorite(
  endpoint: string,
  apiToken: string,
  customer: RareCustomerCatalogItem,
  foodTag: string,
  recipe: RareRecipeRecommendation,
): Promise<FavoriteMutationResponse> {
  const params = new URLSearchParams({
    customerId: String(customer.id),
    customerName: customer.name,
    foodTag,
    recipeId: String(recipe.recipe.id),
    extraIngredientIds: recipe.extraIngredients.map((ingredient) => ingredient.id).join(','),
  });
  return mutateFavorite(endpoint, apiToken, `/favorites/add-recipe?${params.toString()}`);
}

export async function removeRecipeFavorite(
  endpoint: string,
  apiToken: string,
  id: string,
): Promise<FavoriteMutationResponse> {
  const params = new URLSearchParams({ id });
  return mutateFavorite(endpoint, apiToken, `/favorites/remove-recipe?${params.toString()}`);
}

export async function addBeverageFavorite(
  endpoint: string,
  apiToken: string,
  customer: RareCustomerCatalogItem,
  beverageTag: string,
  beverage: RareBeverageRecommendation,
): Promise<FavoriteMutationResponse> {
  const params = new URLSearchParams({
    customerId: String(customer.id),
    customerName: customer.name,
    beverageTag,
    beverageId: String(beverage.beverage.id),
  });
  return mutateFavorite(endpoint, apiToken, `/favorites/add-beverage?${params.toString()}`);
}

export async function removeBeverageFavorite(
  endpoint: string,
  apiToken: string,
  id: string,
): Promise<FavoriteMutationResponse> {
  const params = new URLSearchParams({ id });
  return mutateFavorite(endpoint, apiToken, `/favorites/remove-beverage?${params.toString()}`);
}

function appendRareGuestInvitationLevels(params: URLSearchParams, levels: number[]) {
  const serialized = serializeRareGuestInvitationLevels(levels);
  if (serialized) params.set('levels', serialized);
}

async function mutateRareGuestInvitation(
  endpoint: string,
  apiToken: string,
  path: string,
): Promise<RareGuestInvitationResponse> {
  return readLocalApiJsonWithTimeout<RareGuestInvitationResponse>(endpoint, apiToken, path, 5000);
}

async function rareOrderAction(
  endpoint: string,
  apiToken: string,
  path: string,
  item: OrderRecommendation,
  recipeTarget: RareAutomationRecipeTarget | null,
  beverageTarget: RareAutomationBeverageTarget | null,
  preferences: CompanionPreferences,
): Promise<OrderPreparationResponse> {
  const params = new URLSearchParams({
    deskCode: String(item.order.deskCode),
    guestId: item.order.guestId == null ? '' : String(item.order.guestId),
    guestName: item.order.guestName,
    foodTag: item.order.foodTag,
    beverageTag: item.order.beverageTag,
    foodId: recipeTarget ? String(recipeTarget.foodId) : '-1',
    recipeId: recipeTarget ? String(recipeTarget.recipeId) : '-1',
    recipeName: recipeTarget?.recipeName ?? '',
    extraIngredientIds: recipeTarget ? recipeTarget.extraIngredientIds.join(',') : '',
    acceptableFoodIds: recipeTarget ? recipeTarget.acceptableFoodIds.join(',') : '',
    trayBacklogMinSeconds: String(RARE_TRAY_BACKLOG_REUSE_SECONDS),
    beverageId: beverageTarget ? String(beverageTarget.beverageId) : '-1',
    beverageName: beverageTarget?.beverageName ?? '',
    autoTakeBeverage: String(preferences.autoPrepTakeBeverage),
    autoStartCooking: String(preferences.autoPrepStartCooking),
    autoCollectCooking: String(preferences.autoPrepCollectCooking),
    favoritesOnly: String(preferences.autoPrepFavoritesOnly),
    stopOnError: String(preferences.autoPrepStopOnError),
    recipeFavorite: String(Boolean(recipeTarget?.favorite)),
    beverageFavorite: String(Boolean(beverageTarget?.favorite)),
  });
  return readLocalApiJsonWithTimeout<OrderPreparationResponse>(
    endpoint,
    apiToken,
    `${path}?${params.toString()}`,
    5000,
  );
}

async function mutateFavorite(
  endpoint: string,
  apiToken: string,
  path: string,
): Promise<FavoriteMutationResponse> {
  return readLocalApiJsonWithTimeout<FavoriteMutationResponse>(endpoint, apiToken, path, 3200);
}
