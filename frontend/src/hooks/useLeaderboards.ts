import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type * as $Domain from '../types/domain';
import { leaderboardsApi } from '../api/leaderboardsApi';
import { getErrorMessage } from '../utils/errorHandling';
import { useAuth } from './useAuth';
import { referenceStore, sameIds } from '../api/referenceStore';
import { DEFAULT_PAGE_SIZE, readRows } from '../api/pagination';
import type { QuerySort, RowPage } from '../api/pagination';

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
const pendingPages = new Map<string, Promise<LoadedPage>>();
let pageGeneration = 0;
let pageRevision = 0;

function pageKey(paged: boolean, pageSize: number, sortKey: string): string {
  return paged ? `${pageSize}:${sortKey}` : 'all';
}

function clearPages(): void {
  loadedPages.clear();
  pendingPages.clear();
  pageGeneration += 1;
}

async function queryIds(
  limit: number,
  cursor: string | undefined,
  sort: QuerySort[]
): Promise<RowPage<string>> {
  const page = await leaderboardsApi.query({
    limit,
    sort,
    filter: { search: '', fields: [] },
    cursor,
  });
  return { rows: page.ids, nextCursor: page.nextCursor ?? null, total: page.total };
}

async function readPage(paged: boolean, rows: number, sort: QuerySort[]): Promise<LoadedPage> {
  const requested = referenceStore.revision();
  if (paged) {
    const page = await readRows(rows, null, (limit, cursor) => queryIds(limit, cursor, sort));
    if (page.rows.length > 0) {
      const records = await leaderboardsApi.multiGet(page.rows);
      if (requested === referenceStore.revision()) {
        for (const record of records) {
          referenceStore.set('LeaderboardEntry', record);
        }
      }
    }
    return { ids: page.rows, nextCursor: page.nextCursor, total: page.total ?? page.rows.length };
  }
  const loadedIds = await leaderboardsApi.list();
  if (loadedIds.length > 0) {
    const records = await leaderboardsApi.multiGet(loadedIds);
    if (requested === referenceStore.revision()) {
      for (const record of records) {
        referenceStore.set('LeaderboardEntry', record);
      }
    }
  }
  return { ids: loadedIds, nextCursor: null, total: loadedIds.length };
}

async function trackPage(
  key: string,
  generation: number,
  load: Promise<LoadedPage>
): Promise<LoadedPage> {
  try {
    const page = await load;
    if (generation === pageGeneration) {
      loadedPages.set(key, page);
    }
    return page;
  } finally {
    if (generation === pageGeneration) {
      pendingPages.delete(key);
    }
  }
}

function loadPage(
  paged: boolean,
  pageSize: number,
  sortKey: string,
  sort: QuerySort[]
): Promise<LoadedPage> {
  if (pageRevision !== referenceStore.revision()) {
    pageRevision = referenceStore.revision();
    clearPages();
  }
  const key = pageKey(paged, pageSize, sortKey);
  const pending = pendingPages.get(key);
  if (pending !== undefined) {
    return pending;
  }
  const load = trackPage(key, pageGeneration, readPage(paged, pageSize, sort));
  pendingPages.set(key, load);
  return load;
}

export function useLeaderboards(options?: UseLeaderboardsOptions): UseLeaderboardsReturn {
  const autoLoad = options?.autoLoad ?? true;
  const paged = options?.paged ?? false;
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const sortField = options?.sortField ?? 'id';
  const sortDirection = options?.sortDirection ?? 'ascending';
  const sortKey = JSON.stringify(options?.sort ?? [{ field: sortField, direction: sortDirection }]);
  const sort = useMemo(() => JSON.parse(sortKey) as QuerySort[], [sortKey]);
  const cached =
    pageRevision === referenceStore.revision()
      ? loadedPages.get(pageKey(paged, pageSize, sortKey))
      : undefined;
  const [ids, setIds] = useState<string[]>(cached?.ids ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(cached?.nextCursor ?? null);
  const [total, setTotal] = useState(cached?.total ?? 0);
  const [hasLoaded, setHasLoaded] = useState(cached !== undefined);
  const isInitializing = autoLoad && !hasLoaded;
  const [isBusy, setIsBusy] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { isReady } = useAuth();
  const loadedFetchRef = useRef<(() => Promise<void>) | null>(null);
  const loadedRows = useRef(0);
  const loadedAll = useRef(false);
  const storeView = useSyncExternalStore(referenceStore.subscribe, () =>
    referenceStore.view<$Domain.LeaderboardEntry>('LeaderboardEntry')
  );
  const revision = useSyncExternalStore(referenceStore.subscribe, referenceStore.revision);

  const leaderboards = useMemo(() => {
    const knownIds = [...ids, ...storeView.created().filter((id) => !ids.includes(id))];
    return knownIds
      .map((id) => storeView.get(id))
      .filter((r): r is $Domain.LeaderboardEntry => r !== undefined);
  }, [ids, storeView]);

  useEffect(() => {
    loadedRows.current = ids.length;
  }, [ids]);

  const fetchLeaderboards = useCallback(async (): Promise<void> => {
    const requested = referenceStore.revision();
    const rows = Math.max(pageSize, loadedRows.current);
    const page = await loadPage(paged && !loadedAll.current, rows, sortKey, sort);
    if (requested !== referenceStore.revision()) {
      return;
    }
    setIds((current) => (sameIds(current, page.ids) ? current : page.ids));
    setNextCursor(page.nextCursor);
    setTotal(page.total);
  }, [paged, pageSize, sortKey, sort, revision]);

  const reloadLeaderboards = useCallback(async (): Promise<void> => {
    setIsBusy(true);
    setErrorMessage(null);
    const requested = referenceStore.revision();
    try {
      await fetchLeaderboards();
    } catch (error) {
      if (requested !== referenceStore.revision()) {
        return;
      }
      setErrorMessage(getErrorMessage(error));
      throw error;
    } finally {
      setIsBusy(false);
      setHasLoaded(true);
    }
  }, [fetchLeaderboards]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (nextCursor === null) {
      return;
    }
    setIsLoadingMore(true);
    setErrorMessage(null);
    loadedRows.current += pageSize;
    const requested = referenceStore.revision();
    try {
      const nextPage = await readRows(pageSize, nextCursor, (limit, cursor) =>
        queryIds(limit, cursor, sort)
      );
      if (nextPage.rows.length > 0) {
        const records = await leaderboardsApi.multiGet(nextPage.rows);
        if (requested === referenceStore.revision()) {
          for (const record of records) {
            referenceStore.set('LeaderboardEntry', record);
          }
        }
      }
      if (requested !== referenceStore.revision()) {
        return;
      }
      clearPages();
      setIds((previous) => [...previous, ...nextPage.rows.filter((id) => !previous.includes(id))]);
      setNextCursor(nextPage.nextCursor);
    } catch (error) {
      if (requested !== referenceStore.revision()) {
        return;
      }
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, pageSize, sort]);

  const loadAll = useCallback(async (): Promise<void> => {
    loadedAll.current = true;
    setIsBusy(true);
    setErrorMessage(null);
    const requested = referenceStore.revision();
    try {
      await fetchLeaderboards();
    } catch (error) {
      if (requested !== referenceStore.revision()) {
        return;
      }
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsBusy(false);
      setHasLoaded(true);
    }
  }, [fetchLeaderboards]);

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
    const requested = referenceStore.revision();
    fetchLeaderboards()
      .catch((error) => {
        if (requested === referenceStore.revision()) {
          setErrorMessage(getErrorMessage(error));
        }
      })
      .finally(() => {
        setHasLoaded(true);
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
        clearPages();
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
      clearPages();
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
