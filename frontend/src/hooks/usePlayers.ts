import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type * as $Domain from '../types/domain';
import { playersApi } from '../api/playersApi';
import { getErrorMessage } from '../utils/errorHandling';
import type { FileUploadValue, FileValue } from '../types/file';
import { useAuth } from './useAuth';
import { referenceStore } from '../api/referenceStore';
import { DEFAULT_PAGE_SIZE } from '../api/pagination';
import type { QuerySort } from '../api/pagination';

interface UsePlayersReturn {
  players: $Domain.Player[];
  total: number;
  isInitializing: boolean;
  isBusy: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  errorMessage: string | null;
  reloadPlayers: () => Promise<void>;
  loadMore: () => Promise<void>;
  loadAll: () => Promise<void>;
  createPlayer: (input: {
    nickname: string;
    fullName: string;
    emailAddress: string;
    avatar?: FileUploadValue | FileValue | null;
    bio?: string;
    joinedDate?: string;
    userAccountId?: string;
  }) => Promise<$Domain.Player>;
  updatePlayer: (input: {
    id: string;
    nickname: string;
    fullName: string;
    emailAddress: string;
    avatar: FileUploadValue | FileValue | null;
    bio: string;
    joinedDate: string;
    userAccountId: string;
  }) => Promise<void>;
  deletePlayer: (id: string) => Promise<void>;
}

interface UsePlayersOptions {
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

export function usePlayers(options?: UsePlayersOptions): UsePlayersReturn {
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

  const players = useMemo(() => {
    const knownIds = [...ids, ...storeSnapshot.created('Player').filter((id) => !ids.includes(id))];
    return knownIds
      .map((id) => storeSnapshot.get<$Domain.Player>('Player', id))
      .filter((r): r is $Domain.Player => r !== undefined);
  }, [ids, storeSnapshot]);

  const fetchPlayers = useCallback(async (): Promise<void> => {
    if (paged) {
      const firstPage = await playersApi.query({
        limit: pageSize,
        sort,
        filter: { search: '', fields: [] },
      });
      if (firstPage.ids.length > 0) {
        const records = await playersApi.multiGet(firstPage.ids);
        for (const record of records) {
          referenceStore.set('Player', record);
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
      const loadedIds = await playersApi.list();
      if (loadedIds.length > 0) {
        const records = await playersApi.multiGet(loadedIds);
        for (const record of records) {
          referenceStore.set('Player', record);
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

  const reloadPlayers = useCallback(async (): Promise<void> => {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await fetchPlayers();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      throw error;
    } finally {
      setIsBusy(false);
      setIsInitializing(false);
    }
  }, [fetchPlayers]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (nextCursor === null) {
      return;
    }
    setIsLoadingMore(true);
    setErrorMessage(null);
    try {
      const nextPage = await playersApi.query({
        limit: pageSize,
        sort,
        filter: { search: '', fields: [] },
        cursor: nextCursor,
      });
      if (nextPage.ids.length > 0) {
        const records = await playersApi.multiGet(nextPage.ids);
        for (const record of records) {
          referenceStore.set('Player', record);
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
      const loadedIds = await playersApi.list();
      if (loadedIds.length > 0) {
        const records = await playersApi.multiGet(loadedIds);
        for (const record of records) {
          referenceStore.set('Player', record);
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
    if (loadedFetchRef.current === fetchPlayers) {
      return;
    }
    loadedFetchRef.current = fetchPlayers;
    fetchPlayers()
      .catch((error) => {
        setErrorMessage(getErrorMessage(error));
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, [autoLoad, isReady, fetchPlayers]);

  const createPlayer = useCallback(
    async (input: {
      nickname: string;
      fullName: string;
      emailAddress: string;
      avatar?: FileUploadValue | FileValue | null;
      bio?: string;
      joinedDate?: string;
      userAccountId?: string;
    }): Promise<$Domain.Player> => {
      setIsBusy(true);
      try {
        const createdPlayer = await playersApi.create(input);
        const storedPlayer = referenceStore.set('Player', createdPlayer);
        referenceStore.register('Player', storedPlayer.id);
        loadedPages.clear();
        setTotal((previous) => previous + 1);
        return storedPlayer;
      } finally {
        setIsBusy(false);
      }
    },
    []
  );

  const updatePlayer = useCallback(
    async (input: {
      id: string;
      nickname: string;
      fullName: string;
      emailAddress: string;
      avatar: FileUploadValue | FileValue | null;
      bio: string;
      joinedDate: string;
      userAccountId: string;
    }): Promise<void> => {
      setIsBusy(true);
      try {
        const updatedPlayer = await playersApi.update(input);
        referenceStore.set('Player', updatedPlayer);
      } finally {
        setIsBusy(false);
      }
    },
    []
  );

  const deletePlayer = useCallback(async (id: string): Promise<void> => {
    setIsBusy(true);
    try {
      await playersApi.delete(id);
      referenceStore.delete('Player', id);
      loadedPages.clear();
      setIds((previous) => previous.filter((i) => i !== id));
      setTotal((previous) => (previous > 0 ? previous - 1 : 0));
    } finally {
      setIsBusy(false);
    }
  }, []);

  return {
    players,
    total,
    isInitializing,
    isBusy,
    isLoadingMore,
    hasMore,
    errorMessage,
    reloadPlayers,
    loadMore,
    loadAll,
    createPlayer,
    updatePlayer,
    deletePlayer,
  };
}
