import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type * as $Domain from '../types/domain';
import { gamesApi } from '../api/gamesApi';
import { getErrorMessage } from '../utils/errorHandling';
import { useAuth } from './useAuth';
import { referenceStore } from '../api/referenceStore';
import { DEFAULT_PAGE_SIZE } from '../api/pagination';
import type { QuerySort } from '../api/pagination';

interface UseGamesReturn {
  games: $Domain.GameType[];
  total: number;
  isInitializing: boolean;
  isBusy: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  errorMessage: string | null;
  reloadGames: () => Promise<void>;
  loadMore: () => Promise<void>;
  loadAll: () => Promise<void>;
  createGameType: (input: {
    name: string;
    category?: string;
    rulesVariant?: string;
    defaultRating?: number;
    description?: string;
  }) => Promise<$Domain.GameType>;
  updateGameType: (input: {
    id: string;
    name: string;
    category: string;
    rulesVariant: string;
    defaultRating: number;
    description: string;
  }) => Promise<void>;
  deleteGameType: (id: string) => Promise<void>;
}

interface UseGamesOptions {
  autoLoad?: boolean;
  paged?: boolean;
  pageSize?: number;
  sortField?: string;
  sortDirection?: 'ascending' | 'descending';
  sort?: QuerySort[];
}

interface LoadedPage {
  ids: string[];
  nextCursor: string | null;
  total: number;
}

const loadedPages = new Map<string, LoadedPage>();

function pageKey(paged: boolean, pageSize: number, sortKey: string): string {
  return paged ? `${pageSize}:${sortKey}` : 'all';
}

export function useGames(options?: UseGamesOptions): UseGamesReturn {
  const autoLoad = options?.autoLoad ?? true;
  const paged = options?.paged ?? false;
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const sortField = options?.sortField ?? 'id';
  const sortDirection = options?.sortDirection ?? 'ascending';
  const sortKey = JSON.stringify(options?.sort ?? [{ field: sortField, direction: sortDirection }]);
  const sort = useMemo(() => JSON.parse(sortKey) as QuerySort[], [sortKey]);
  const cached = loadedPages.get(pageKey(paged, pageSize, sortKey));
  const [ids, setIds] = useState<string[]>(cached?.ids ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(cached?.nextCursor ?? null);
  const [total, setTotal] = useState(cached?.total ?? 0);
  const [isInitializing, setIsInitializing] = useState(autoLoad && cached === undefined);
  const [isBusy, setIsBusy] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { isReady } = useAuth();
  const loadedFetchRef = useRef<(() => Promise<void>) | null>(null);
  const storeSnapshot = useSyncExternalStore(referenceStore.subscribe, referenceStore.getSnapshot);

  const games = useMemo(() => {
    const knownIds = [
      ...ids,
      ...storeSnapshot.created('GameType').filter((id) => !ids.includes(id)),
    ];
    return knownIds
      .map((id) => storeSnapshot.get<$Domain.GameType>('GameType', id))
      .filter((r): r is $Domain.GameType => r !== undefined);
  }, [ids, storeSnapshot]);

  const fetchGames = useCallback(async (): Promise<void> => {
    if (paged) {
      const firstPage = await gamesApi.query({
        limit: pageSize,
        sort,
        filter: { search: '', fields: [] },
      });
      if (firstPage.ids.length > 0) {
        const records = await gamesApi.multiGet(firstPage.ids);
        for (const record of records) {
          referenceStore.set('GameType', record);
        }
      }
      const page = {
        ids: firstPage.ids,
        nextCursor: firstPage.nextCursor ?? null,
        total: firstPage.total ?? firstPage.ids.length,
      };
      loadedPages.set(pageKey(paged, pageSize, sortKey), page);
      setIds(page.ids);
      setNextCursor(page.nextCursor);
      setTotal(page.total);
    } else {
      const loadedIds = await gamesApi.list();
      if (loadedIds.length > 0) {
        const records = await gamesApi.multiGet(loadedIds);
        for (const record of records) {
          referenceStore.set('GameType', record);
        }
      }
      loadedPages.set(pageKey(paged, pageSize, sortKey), {
        ids: loadedIds,
        nextCursor: null,
        total: loadedIds.length,
      });
      setIds(loadedIds);
      setNextCursor(null);
      setTotal(loadedIds.length);
    }
  }, [paged, pageSize, sortKey, sort]);

  const reloadGames = useCallback(async (): Promise<void> => {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await fetchGames();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      throw error;
    } finally {
      setIsBusy(false);
      setIsInitializing(false);
    }
  }, [fetchGames]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (nextCursor === null) {
      return;
    }
    setIsLoadingMore(true);
    setErrorMessage(null);
    try {
      const nextPage = await gamesApi.query({
        limit: pageSize,
        sort,
        filter: { search: '', fields: [] },
        cursor: nextCursor,
      });
      if (nextPage.ids.length > 0) {
        const records = await gamesApi.multiGet(nextPage.ids);
        for (const record of records) {
          referenceStore.set('GameType', record);
        }
      }
      loadedPages.clear();
      setIds((previous) => [...previous, ...nextPage.ids.filter((id) => !previous.includes(id))]);
      setNextCursor(nextPage.nextCursor ?? null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, pageSize, sort]);

  const loadAll = useCallback(async (): Promise<void> => {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const loadedIds = await gamesApi.list();
      if (loadedIds.length > 0) {
        const records = await gamesApi.multiGet(loadedIds);
        for (const record of records) {
          referenceStore.set('GameType', record);
        }
      }
      loadedPages.clear();
      setIds(loadedIds);
      setNextCursor(null);
      setTotal(loadedIds.length);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsBusy(false);
      setIsInitializing(false);
    }
  }, []);

  const hasMore = nextCursor !== null;

  useEffect(() => {
    if (!autoLoad) {
      return;
    }
    if (!isReady) {
      return;
    }
    if (loadedFetchRef.current === fetchGames) {
      return;
    }
    loadedFetchRef.current = fetchGames;
    fetchGames()
      .catch((error) => {
        setErrorMessage(getErrorMessage(error));
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, [autoLoad, isReady, fetchGames]);

  const createGameType = useCallback(
    async (input: {
      name: string;
      category?: string;
      rulesVariant?: string;
      defaultRating?: number;
      description?: string;
    }): Promise<$Domain.GameType> => {
      setIsBusy(true);
      try {
        const createdGameType = await gamesApi.create(input);
        const storedGameType = referenceStore.set('GameType', createdGameType);
        referenceStore.register('GameType', storedGameType.id);
        loadedPages.clear();
        setTotal((previous) => previous + 1);
        return storedGameType;
      } finally {
        setIsBusy(false);
      }
    },
    []
  );

  const updateGameType = useCallback(
    async (input: {
      id: string;
      name: string;
      category: string;
      rulesVariant: string;
      defaultRating: number;
      description: string;
    }): Promise<void> => {
      setIsBusy(true);
      try {
        const updatedGameType = await gamesApi.update(input);
        referenceStore.set('GameType', updatedGameType);
      } finally {
        setIsBusy(false);
      }
    },
    []
  );

  const deleteGameType = useCallback(async (id: string): Promise<void> => {
    setIsBusy(true);
    try {
      await gamesApi.delete(id);
      referenceStore.delete('GameType', id);
      loadedPages.clear();
      setIds((previous) => previous.filter((i) => i !== id));
      setTotal((previous) => (previous > 0 ? previous - 1 : 0));
    } finally {
      setIsBusy(false);
    }
  }, []);

  return {
    games,
    total,
    isInitializing,
    isBusy,
    isLoadingMore,
    hasMore,
    errorMessage,
    reloadGames,
    loadMore,
    loadAll,
    createGameType,
    updateGameType,
    deleteGameType,
  };
}
