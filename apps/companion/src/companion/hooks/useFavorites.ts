import { useCallback, useEffect, useState } from 'react';
import {
  addBeverageFavorite,
  addRecipeFavorite,
  readFavorites,
  removeBeverageFavorite,
  removeRecipeFavorite,
} from '@/companion/api';
import {
  beverageFavoriteKey,
  emptyFavoriteData,
  findBeverageFavorite,
  findRecipeFavorite,
  normalizeFavoriteData,
  recipeFavoriteKey,
} from '@/companion/domain/favorites';
import type {
  FavoriteData,
  ToggleBeverageFavorite,
  ToggleRecipeFavorite,
} from '@/companion/types';

interface UseFavoritesOptions {
  apiToken: string;
  connectionPaused: boolean;
  normalizedEndpoint: string;
}

export function useFavorites({ apiToken, connectionPaused, normalizedEndpoint }: UseFavoritesOptions) {
  const [favorites, setFavorites] = useState<FavoriteData>(() => emptyFavoriteData());
  const [favoriteError, setFavoriteError] = useState('');
  const [favoriteBusyKey, setFavoriteBusyKey] = useState('');

  const refreshFavorites = useCallback(async () => {
    if (!apiToken) {
      setFavorites(emptyFavoriteData());
      return;
    }
    if (connectionPaused) return;

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => abortController.abort(), 2800);

    try {
      const data = await readFavorites(normalizedEndpoint, apiToken, abortController.signal);
      setFavorites(normalizeFavoriteData(data));
      setFavoriteError('');
    } catch (err) {
      setFavoriteError(err instanceof Error ? err.message : String(err));
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [apiToken, connectionPaused, normalizedEndpoint]);

  const toggleRecipeFavorite = useCallback<ToggleRecipeFavorite>(async (customer, foodTag, recipe) => {
    if (!apiToken || !foodTag) return;
    const existing = findRecipeFavorite(favorites, customer.id, foodTag, recipe);
    const busyKey = existing?.id ?? recipeFavoriteKey(customer.id, foodTag, recipe);
    setFavoriteBusyKey(busyKey);
    setFavoriteError('');

    try {
      const response = existing
        ? await removeRecipeFavorite(normalizedEndpoint, apiToken, existing.id)
        : await addRecipeFavorite(normalizedEndpoint, apiToken, customer, foodTag, recipe);
      if (!response.ok) throw new Error(response.error || '收藏更新失败');
      setFavorites(normalizeFavoriteData(response.favorites));
    } catch (err) {
      setFavoriteError(err instanceof Error ? err.message : String(err));
    } finally {
      setFavoriteBusyKey('');
    }
  }, [apiToken, favorites, normalizedEndpoint]);

  const toggleBeverageFavorite = useCallback<ToggleBeverageFavorite>(async (customer, beverageTag, beverage) => {
    if (!apiToken || !beverageTag) return;
    const existing = findBeverageFavorite(favorites, customer.id, beverageTag, beverage);
    const busyKey = existing?.id ?? beverageFavoriteKey(customer.id, beverageTag, beverage);
    setFavoriteBusyKey(busyKey);
    setFavoriteError('');

    try {
      const response = existing
        ? await removeBeverageFavorite(normalizedEndpoint, apiToken, existing.id)
        : await addBeverageFavorite(normalizedEndpoint, apiToken, customer, beverageTag, beverage);
      if (!response.ok) throw new Error(response.error || '收藏更新失败');
      setFavorites(normalizeFavoriteData(response.favorites));
    } catch (err) {
      setFavoriteError(err instanceof Error ? err.message : String(err));
    } finally {
      setFavoriteBusyKey('');
    }
  }, [apiToken, favorites, normalizedEndpoint]);

  useEffect(() => {
    void refreshFavorites();
  }, [refreshFavorites]);

  return {
    favorites,
    favoriteError,
    favoriteBusyKey,
    refreshFavorites,
    toggleRecipeFavorite,
    toggleBeverageFavorite,
  };
}
