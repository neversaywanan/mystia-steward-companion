import { useEffect, useMemo } from 'react';
import { Card, CardContent, EmptyRow, EmptyState, ListPanel, SelectBox } from '@/components/ui-kit';
import {
  beverageFavoriteKey,
  findBeverageFavorite,
  findRecipeFavorite,
  recipeFavoriteKey,
} from '@/companion/domain/favorites';
import {
  buildRecommendationPlanSortContext,
  buildRecommendationRuntimeContext,
  deriveBeverageRowsFromPlans,
  deriveRecipeRowsFromPlans,
  isOrderableRareFoodTag,
  isSelectableRareCustomer,
  mergeRareCustomers,
} from '@/companion/domain/service-recommendations';
import type { CompanionPreferences } from '@/companion/preferences';
import type { FavoriteData, RecommendationStateSnapshot, RuntimeSets, ToggleBeverageFavorite, ToggleRecipeFavorite } from '@/companion/types';
import { BeverageRecommendationRow, PlaceToolbar, RecipeRecommendationRow, RuntimeUnavailable } from '@/companion/pages/shared';
import { DENSE_THREE_COLUMN_GRID, DENSE_TWO_COLUMN_GRID, MAX_RECOMMENDATION_ROWS, RECOMMENDATION_SCROLL_AREA } from '@/companion/pages/shared-constants';
import { buildRecommendationDataIndexes, getRareCustomersByPlace, type RecommendationDataSet } from '@/lib/recommendation-data';
import type { ICustomerRare, TPlace } from '@/lib/types';
import { buildRareOrderPlans } from '@/recommendation-engine';

export function ModRarePanel({
  runtime,
  runtimeSets,
  runtimeRareCustomers,
  selectedPlace,
  detectedPlace,
  data,
  rareCustomerId,
  requiredFoodTag,
  requiredBeverageTag,
  favorites,
  favoriteBusyKey,
  favoriteError,
  preferences,
  onPlaceChange,
  onFollowDetectedPlace,
  onRareCustomerChange,
  onFoodTagChange,
  onBeverageTagChange,
  onToggleRecipeFavorite,
  onToggleBeverageFavorite,
}: {
  runtime: RecommendationStateSnapshot | null;
  runtimeSets: RuntimeSets | null;
  runtimeRareCustomers: ICustomerRare[];
  selectedPlace: TPlace | null;
  detectedPlace: TPlace | null;
  data: RecommendationDataSet;
  rareCustomerId: number | null;
  requiredFoodTag: string;
  requiredBeverageTag: string;
  favorites: FavoriteData;
  favoriteBusyKey: string;
  favoriteError: string;
  preferences: CompanionPreferences;
  onPlaceChange: (place: TPlace) => void;
  onFollowDetectedPlace: () => void;
  onRareCustomerChange: (customerId: number | null) => void;
  onFoodTagChange: (tag: string) => void;
  onBeverageTagChange: (tag: string) => void;
  onToggleRecipeFavorite: ToggleRecipeFavorite;
  onToggleBeverageFavorite: ToggleBeverageFavorite;
}) {
  const dataIndexes = useMemo(() => buildRecommendationDataIndexes(data), [data]);
  const customers = useMemo(() => {
    if (!selectedPlace) return [];
    return mergeRareCustomers(
      getRareCustomersByPlace(selectedPlace, data).filter((customer) =>
        isSelectableRareCustomer(customer),
      ),
      runtimeRareCustomers.filter((customer) => (
        customer.places.includes(selectedPlace) && isSelectableRareCustomer(customer)
      )),
    );
  }, [data, runtimeRareCustomers, selectedPlace]);
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === rareCustomerId) ?? customers[0] ?? null,
    [customers, rareCustomerId],
  );
  const selectedFoodTags = useMemo(
    () => selectedCustomer?.positiveTags.filter(isOrderableRareFoodTag) ?? [],
    [selectedCustomer],
  );
  const selectedBeverageTags = useMemo(
    () => selectedCustomer?.beverageTags ?? [],
    [selectedCustomer],
  );
  const foodTag = requiredFoodTag && selectedFoodTags.includes(requiredFoodTag)
    ? requiredFoodTag
    : selectedFoodTags[0] ?? '';
  const beverageTag = requiredBeverageTag && selectedBeverageTags.includes(requiredBeverageTag)
    ? requiredBeverageTag
    : selectedBeverageTags[0] ?? '';

  useEffect(() => {
    if (!selectedCustomer) {
      if (rareCustomerId !== null) onRareCustomerChange(null);
      return;
    }
    if (rareCustomerId !== selectedCustomer.id) onRareCustomerChange(selectedCustomer.id);
    if (requiredFoodTag !== foodTag) onFoodTagChange(foodTag);
    if (requiredBeverageTag !== beverageTag) onBeverageTagChange(beverageTag);
  }, [
    beverageTag,
    foodTag,
    onBeverageTagChange,
    onFoodTagChange,
    onRareCustomerChange,
    rareCustomerId,
    requiredBeverageTag,
    requiredFoodTag,
    selectedCustomer,
  ]);

  const plans = useMemo(() => {
    if (!runtime || !runtimeSets || !selectedCustomer || !foodTag || !beverageTag) return [];
    return buildRareOrderPlans({
      data,
      customer: selectedCustomer,
      requiredFoodTag: foodTag,
      requiredBeverageTag: beverageTag,
      context: buildRecommendationRuntimeContext(runtime, runtimeSets, preferences, data),
      sortProfile: preferences.recommendationSortProfile,
      sortContext: buildRecommendationPlanSortContext(favorites, selectedCustomer.id, foodTag, beverageTag),
      limit: MAX_RECOMMENDATION_ROWS * 4,
    });
  }, [beverageTag, data, favorites, foodTag, preferences, runtime, runtimeSets, selectedCustomer]);

  const recipes = useMemo(() => {
    if (!selectedCustomer || !foodTag) return [];
    return deriveRecipeRowsFromPlans(plans, true, preferences.recipeVariantLimitPerBase)
      .slice(0, MAX_RECOMMENDATION_ROWS);
  }, [foodTag, plans, preferences.recipeVariantLimitPerBase, selectedCustomer]);

  const beverages = useMemo(() => {
    if (!selectedCustomer || !beverageTag) return [];
    return deriveBeverageRowsFromPlans(plans, true)
      .slice(0, MAX_RECOMMENDATION_ROWS);
  }, [beverageTag, plans, selectedCustomer]);

  if (!runtime || !runtimeSets) return <RuntimeUnavailable />;

  return (
    <div className="space-y-4">
      <PlaceToolbar
        selectedPlace={selectedPlace}
        detectedPlace={detectedPlace}
        onPlaceChange={onPlaceChange}
        onFollowDetectedPlace={onFollowDetectedPlace}
      />

      {!selectedPlace && <EmptyState text="请选择地区后查看稀客推荐" />}

      {selectedPlace && customers.length === 0 && <EmptyState text="该地区没有稀客" />}

      {selectedPlace && selectedCustomer && (
        <>
          <Card>
            <CardContent className={`${DENSE_THREE_COLUMN_GRID} p-4 text-sm`}>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">稀客</div>
                <SelectBox
                  value={String(selectedCustomer.id)}
                  aria-label="稀客"
                  searchable
                  className="w-full"
                  options={customers.map((customer) => ({ value: String(customer.id), label: customer.name }))}
                  onValueChange={(value) => onRareCustomerChange(Number(value))}
                />
              </div>

              <div>
                <div className="mb-1 text-xs text-muted-foreground">点单料理 Tag</div>
                <SelectBox
                  value={foodTag}
                  aria-label="点单料理 Tag"
                  searchable
                  className="w-full"
                  options={selectedFoodTags.map((tag) => ({ value: tag, label: tag }))}
                  onValueChange={onFoodTagChange}
                />
              </div>

              <div>
                <div className="mb-1 text-xs text-muted-foreground">点单酒水 Tag</div>
                <SelectBox
                  value={beverageTag}
                  aria-label="点单酒水 Tag"
                  searchable
                  className="w-full"
                  options={selectedBeverageTags.map((tag) => ({ value: tag, label: tag }))}
                  onValueChange={onBeverageTagChange}
                />
              </div>
            </CardContent>
          </Card>
          {favoriteError && (
            <div className="rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {favoriteError}
            </div>
          )}

          <div className={DENSE_TWO_COLUMN_GRID}>
            <ListPanel title={`料理推荐 (${recipes.length})`} contentClassName={RECOMMENDATION_SCROLL_AREA}>
              {recipes.length === 0 && <EmptyRow text="暂无满足点单的料理" />}
              <div className="space-y-2">
                {recipes.map((recipe, index) => (
                  <RecipeRecommendationRow
                    key={`${recipe.recipe.id}-${index}`}
                    recipe={recipe}
                    index={index}
                    ownedIngredientQty={runtimeSets.ownedIngredientQty}
                    ingredientIdByName={dataIndexes.ingredientIdByName}
                    favorite={findRecipeFavorite(favorites, selectedCustomer.id, foodTag, recipe)}
                    favoriteKey={recipeFavoriteKey(selectedCustomer.id, foodTag, recipe)}
                    favoriteBusyKey={favoriteBusyKey}
                    onToggleFavorite={() => onToggleRecipeFavorite(selectedCustomer, foodTag, recipe)}
                  />
                ))}
              </div>
            </ListPanel>

            <ListPanel title={`酒水推荐 (${beverages.length})`} contentClassName={RECOMMENDATION_SCROLL_AREA}>
              {beverages.length === 0 && <EmptyRow text="暂无满足点单的酒水" />}
              <div className="space-y-2">
                {beverages.map((beverage, index) => (
                  <BeverageRecommendationRow
                    key={beverage.beverage.id}
                    beverage={beverage}
                    index={index}
                    ownedBeverageQty={runtimeSets.ownedBeverageQty}
                    favorite={findBeverageFavorite(favorites, selectedCustomer.id, beverageTag, beverage)}
                    favoriteKey={beverageFavoriteKey(selectedCustomer.id, beverageTag, beverage)}
                    favoriteBusyKey={favoriteBusyKey}
                    onToggleFavorite={() => onToggleBeverageFavorite(selectedCustomer, beverageTag, beverage)}
                  />
                ))}
              </div>
            </ListPanel>
          </div>
        </>
      )}
    </div>
  );
}
