import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type * as $Domain from '../types/domain';
import { matchesApi } from '../api/matchesApi';
import { getErrorMessage } from '../utils/errorHandling';
import { useAuth } from './useAuth';
import { referenceStore } from '../api/referenceStore';
import { DEFAULT_PAGE_SIZE } from '../api/pagination';
import type { QuerySort } from '../api/pagination';

interface UseMatchesReturn {
  matches: $Domain.Match[];
  total: number;
  isInitializing: boolean;
  isBusy: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  errorMessage: string | null;
  reloadMatches: () => Promise<void>;
  loadMore: () => Promise<void>;
  loadAll: () => Promise<void>;
  createMatch: (input: {
    gameId: string;
    playerOneId: string;
    playerTwoId: string;
    scheduledAt?: string;
    status?: string;
    outcome?: string;
    notes?: string;
  }) => Promise<$Domain.Match>;
  updateMatch: (input: {
    id: string;
    gameId: string;
    playerOneId: string;
    playerTwoId: string;
    scheduledAt: string;
    status: string;
    outcome: string;
    notes: string;
  }) => Promise<void>;
  deleteMatch: (id: string) => Promise<void>;
}

interface UseMatchesOptions {
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

export function useMatches(options?: UseMatchesOptions): UseMatchesReturn {
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

  const matches = useMemo(() => {
    const knownIds = [...ids, ...storeSnapshot.created('Match').filter((id) => !ids.includes(id))];
    return knownIds
      .map((id) => storeSnapshot.get<$Domain.Match>('Match', id))
      .filter((r): r is $Domain.Match => r !== undefined);
  }, [ids, storeSnapshot]);

  const fetchMatches = useCallback(async (): Promise<void> => {
    if (paged) {
      const firstPage = await matchesApi.query({
        limit: pageSize,
        sort,
        filter: { search: '', fields: [] },
      });
      if (firstPage.ids.length > 0) {
        const records = await matchesApi.multiGet(firstPage.ids);
        for (const record of records) {
          referenceStore.set('Match', record);
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
      const loadedIds = await matchesApi.list();
      if (loadedIds.length > 0) {
        const records = await matchesApi.multiGet(loadedIds);
        for (const record of records) {
          referenceStore.set('Match', record);
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

  const reloadMatches = useCallback(async (): Promise<void> => {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await fetchMatches();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      throw error;
    } finally {
      setIsBusy(false);
      setIsInitializing(false);
    }
  }, [fetchMatches]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (nextCursor === null) {
      return;
    }
    setIsLoadingMore(true);
    setErrorMessage(null);
    try {
      const nextPage = await matchesApi.query({
        limit: pageSize,
        sort,
        filter: { search: '', fields: [] },
        cursor: nextCursor,
      });
      if (nextPage.ids.length > 0) {
        const records = await matchesApi.multiGet(nextPage.ids);
        for (const record of records) {
          referenceStore.set('Match', record);
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
      const loadedIds = await matchesApi.list();
      if (loadedIds.length > 0) {
        const records = await matchesApi.multiGet(loadedIds);
        for (const record of records) {
          referenceStore.set('Match', record);
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
    if (loadedFetchRef.current === fetchMatches) {
      return;
    }
    loadedFetchRef.current = fetchMatches;
    fetchMatches()
      .catch((error) => {
        setErrorMessage(getErrorMessage(error));
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, [autoLoad, isReady, fetchMatches]);

  const createMatch = useCallback(
    async (input: {
      gameId: string;
      playerOneId: string;
      playerTwoId: string;
      scheduledAt?: string;
      status?: string;
      outcome?: string;
      notes?: string;
    }): Promise<$Domain.Match> => {
      setIsBusy(true);
      try {
        const createdMatch = await matchesApi.create(input);
        const storedMatch = referenceStore.set('Match', createdMatch);
        referenceStore.register('Match', storedMatch.id);
        loadedPages.clear();
        setTotal((previous) => previous + 1);
        return storedMatch;
      } finally {
        setIsBusy(false);
      }
    },
    []
  );

  const updateMatch = useCallback(
    async (input: {
      id: string;
      gameId: string;
      playerOneId: string;
      playerTwoId: string;
      scheduledAt: string;
      status: string;
      outcome: string;
      notes: string;
    }): Promise<void> => {
      setIsBusy(true);
      try {
        const updatedMatch = await matchesApi.update(input);
        referenceStore.set('Match', updatedMatch);
      } finally {
        setIsBusy(false);
      }
    },
    []
  );

  const deleteMatch = useCallback(async (id: string): Promise<void> => {
    setIsBusy(true);
    try {
      await matchesApi.delete(id);
      referenceStore.delete('Match', id);
      loadedPages.clear();
      setIds((previous) => previous.filter((i) => i !== id));
      setTotal((previous) => (previous > 0 ? previous - 1 : 0));
    } finally {
      setIsBusy(false);
    }
  }, []);

  return {
    matches,
    total,
    isInitializing,
    isBusy,
    isLoadingMore,
    hasMore,
    errorMessage,
    reloadMatches,
    loadMore,
    loadAll,
    createMatch,
    updateMatch,
    deleteMatch,
  };
}
