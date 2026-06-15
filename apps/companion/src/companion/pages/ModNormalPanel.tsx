import { useMemo } from 'react';
import { TagBadge } from '@/components/TagBadge';
import { EmptyRow, EmptyState, ListPanel } from '@/components/ui-kit';
import { compareNormalBeveragesForMod, compareNormalRecipesForMod } from '@/companion/domain/sorting';
import type { RecommendationStateSnapshot, RuntimeSets } from '@/companion/types';
import { NormalBeverageRow, NormalRecipeRow, PlaceToolbar, RuntimeUnavailable } from '@/companion/pages/shared';
import { DENSE_ITEM_GRID, DENSE_TWO_COLUMN_GRID, MAX_RECOMMENDATION_ROWS, RECOMMENDATION_SCROLL_AREA } from '@/companion/pages/shared-constants';
import { computeNormalBeverageResults, computeNormalRecipeResults, getNormalCustomersByPlace } from '@/lib/normal-recommend';
import { buildRecommendationDataIndexes, type RecommendationDataSet } from '@/lib/recommendation-data';
import type { TPlace } from '@/lib/types';

export function ModNormalPanel({
  runtime,
  runtimeSets,
  selectedPlace,
  detectedPlace,
  data,
  onPlaceChange,
  onFollowDetectedPlace,
}: {
  runtime: RecommendationStateSnapshot | null;
  runtimeSets: RuntimeSets | null;
  selectedPlace: TPlace | null;
  detectedPlace: TPlace | null;
  data: RecommendationDataSet;
  onPlaceChange: (place: TPlace) => void;
  onFollowDetectedPlace: () => void;
}) {
  const dataIndexes = useMemo(() => buildRecommendationDataIndexes(data), [data]);
  const recipes = useMemo(() => {
    if (!runtime || !runtimeSets || !selectedPlace) return [];
    return computeNormalRecipeResults(
      selectedPlace,
      runtimeSets.recipeIds,
      runtimeSets.unavailableIngredientIds,
      runtime.popularFoodTag,
      runtime.popularHateFoodTag,
      runtime.famousShopEnabled,
      data,
    )
      .sort(compareNormalRecipesForMod)
      .slice(0, MAX_RECOMMENDATION_ROWS);
  }, [data, runtime, runtimeSets, selectedPlace]);

  const beverages = useMemo(() => {
    if (!runtimeSets || !selectedPlace) return [];
    return computeNormalBeverageResults(selectedPlace, runtimeSets.beverageIds, data)
      .sort(compareNormalBeveragesForMod)
      .slice(0, MAX_RECOMMENDATION_ROWS);
  }, [data, runtimeSets, selectedPlace]);

  const customers = useMemo(
    () => (selectedPlace ? getNormalCustomersByPlace(selectedPlace, data) : []),
    [data, selectedPlace],
  );

  if (!runtime || !runtimeSets) return <RuntimeUnavailable />;

  return (
    <div className="space-y-4">
      <PlaceToolbar
        selectedPlace={selectedPlace}
        detectedPlace={detectedPlace}
        onPlaceChange={onPlaceChange}
        onFollowDetectedPlace={onFollowDetectedPlace}
      />

      {!selectedPlace && <EmptyState text="请选择地区后查看普客推荐" />}

      {selectedPlace && (
        <div className={DENSE_TWO_COLUMN_GRID}>
          <ListPanel title={`料理推荐 (${recipes.length})`} contentClassName={RECOMMENDATION_SCROLL_AREA}>
            {recipes.length === 0 && <EmptyRow text="暂无可推荐料理" />}
            <div className="space-y-2">
              {recipes.map((recipe, index) => (
                <NormalRecipeRow
                  key={recipe.recipe.id}
                  recipe={recipe}
                  index={index}
                  ownedIngredientQty={runtimeSets.ownedIngredientQty}
                  ingredientIdByName={dataIndexes.ingredientIdByName}
                />
              ))}
            </div>
          </ListPanel>

          <ListPanel title={`酒水推荐 (${beverages.length})`} contentClassName={RECOMMENDATION_SCROLL_AREA}>
            {beverages.length === 0 && <EmptyRow text="暂无可推荐酒水" />}
            <div className="space-y-2">
              {beverages.map((beverage, index) => (
                <NormalBeverageRow
                  key={beverage.beverage.id}
                  beverage={beverage}
                  index={index}
                  ownedBeverageQty={runtimeSets.ownedBeverageQty}
                />
              ))}
            </div>
          </ListPanel>
        </div>
      )}

      {selectedPlace && (
        <ListPanel title={`地区普客 (${customers.length})`} contentClassName="min-h-[8rem]">
          <div className={DENSE_ITEM_GRID}>
            {customers.map((customer) => (
              <div key={customer.id} className="rounded-md border border-border/80 p-2 text-sm">
                <div className="font-medium">{customer.name}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {customer.positiveTags.map((tag) => <TagBadge key={tag} tag={tag} variant="preferred" />)}
                  {customer.beverageTags.map((tag) => <TagBadge key={tag} tag={tag} variant="default" />)}
                </div>
              </div>
            ))}
          </div>
        </ListPanel>
      )}
    </div>
  );
}
