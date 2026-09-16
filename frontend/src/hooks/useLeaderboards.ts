import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type * as $Domain from '../types/domain';
import { leaderboardsApi } from '../api/leaderboardsApi';
import { getErrorMessage } from '../utils/errorHandling';
import { useAuth } from './useAuth';
import { referenceStore } from '../api/referenceStore';
import { DEFAULT_PAGE_SIZE } from '../api/pagination';
import type { QuerySort } from '../api/pagination';

interface UseLeaderboardsReturn {
  leaderboards: $Domain.LeaderboardEntry[];
  total: number;
  isInitializing: boolean;
  isBusy: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  errorMessage: string | null;
  reloadLeaderboards: () => Promise<void>;
  loadMore: () => Promise<void>;
  loadAll: () => Promise<void>;
  createLeaderboardEntry: (input: {
    playerId: string;
    gameId: string;
    rating?: number;
    matchesPlayed?: number;
    wins?: number;
    losses?: number;
    draws?: number;
    lastPlayedAt?: string;
  }) => Promise<$Domain.LeaderboardEntry>;
  updateLeaderboardEntry: (input: {
    id: string;
    playerId: string;
    gameId: string;
    rating: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    lastPlayedAt: string;
  }) => Promise<void>;
  deleteLeaderboardEntry: (id: string) => Promise<void>;
}

interface UseLeaderboardsOptions {
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

export function useLeaderboards(options?: UseLeaderboardsOptions): UseLeaderboardsReturn {
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

  const leaderboards = useMemo(() => {
    const knownIds = [
      ...ids,
      ...storeSnapshot.created('LeaderboardEntry').filter((id) => !ids.includes(id)),
    ];
    return knownIds
      .map((id) => storeSnapshot.get<$Domain.LeaderboardEntry>('LeaderboardEntry', id))
      .filter((r): r is $Domain.LeaderboardEntry => r !== undefined);
  }, [ids, storeSnapshot]);

  const fetchLeaderboards = useCallback(async (): Promise<void> => {
    if (paged) {
      const firstPage = await leaderboardsApi.query({
        limit: pageSize,
        sort,
        filter: { search: '', fields: [] },
      });
      if (firstPage.ids.length > 0) {
        const records = await leaderboardsApi.multiGet(firstPage.ids);
        for (const record of records) {
          referenceStore.set('LeaderboardEntry', record);
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
      const loadedIds = await leaderboardsApi.list();
      if (loadedIds.length > 0) {
        const records = await leaderboardsApi.multiGet(loadedIds);
        for (const record of records) {
          referenceStore.set('LeaderboardEntry', record);
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

  const reloadLeaderboards = useCallback(async (): Promise<void> => {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await fetchLeaderboards();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      throw error;
    } finally {
      setIsBusy(false);
      setIsInitializing(false);
    }
  }, [fetchLeaderboards]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (nextCursor === null) {
      return;
    }
    setIsLoadingMore(true);
    setErrorMessage(null);
    try {
      const nextPage = await leaderboardsApi.query({
        limit: pageSize,
        sort,
        filter: { search: '', fields: [] },
        cursor: nextCursor,
      });
      if (nextPage.ids.length > 0) {
        const records = await leaderboardsApi.multiGet(nextPage.ids);
        for (const record of records) {
          referenceStore.set('LeaderboardEntry', record);
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
      const loadedIds = await leaderboardsApi.list();
      if (loadedIds.length > 0) {
        const records = await leaderboardsApi.multiGet(loadedIds);
        for (const record of records) {
          referenceStore.set('LeaderboardEntry', record);
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
    if (loadedFetchRef.current === fetchLeaderboards) {
      return;
    }
    loadedFetchRef.current = fetchLeaderboards;
    fetchLeaderboards()
      .catch((error) => {
        setErrorMessage(getErrorMessage(error));
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, [autoLoad, isReady, fetchLeaderboards]);

  const createLeaderboardEntry = useCallback(
    async (input: {
      playerId: string;
      gameId: string;
      rating?: number;
      matchesPlayed?: number;
      wins?: number;
      losses?: number;
      draws?: number;
      lastPlayedAt?: string;
    }): Promise<$Domain.LeaderboardEntry> => {
      setIsBusy(true);
      try {
        const createdLeaderboardEntry = await leaderboardsApi.create(input);
        const storedLeaderboardEntry = referenceStore.set(
          'LeaderboardEntry',
          createdLeaderboardEntry
        );
        referenceStore.register('LeaderboardEntry', storedLeaderboardEntry.id);
        loadedPages.clear();
        setTotal((previous) => previous + 1);
        return storedLeaderboardEntry;
      } finally {
        setIsBusy(false);
      }
    },
    []
  );

  const updateLeaderboardEntry = useCallback(
    async (input: {
      id: string;
      playerId: string;
      gameId: string;
      rating: number;
      matchesPlayed: number;
      wins: number;
      losses: number;
      draws: number;
      lastPlayedAt: string;
    }): Promise<void> => {
      setIsBusy(true);
      try {
        const updatedLeaderboardEntry = await leaderboardsApi.update(input);
        referenceStore.set('LeaderboardEntry', updatedLeaderboardEntry);
      } finally {
        setIsBusy(false);
      }
    },
    []
  );

  const deleteLeaderboardEntry = useCallback(async (id: string): Promise<void> => {
    setIsBusy(true);
    try {
      await leaderboardsApi.delete(id);
      referenceStore.delete('LeaderboardEntry', id);
      loadedPages.clear();
      setIds((previous) => previous.filter((i) => i !== id));
      setTotal((previous) => (previous > 0 ? previous - 1 : 0));
    } finally {
      setIsBusy(false);
    }
  }, []);

  return {
    leaderboards,
    total,
    isInitializing,
    isBusy,
    isLoadingMore,
    hasMore,
    errorMessage,
    reloadLeaderboards,
    loadMore,
    loadAll,
    createLeaderboardEntry,
    updateLeaderboardEntry,
    deleteLeaderboardEntry,
  };
}
