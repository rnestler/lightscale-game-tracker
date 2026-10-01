import { i18n } from '../i18n/text';
import { useCallback, useState } from 'react';
import type * as $Domain from '../types/domain';
import { transactionMethodsApi } from '../api/transactionMethodsApi';
import { referenceStore } from '../api/referenceStore';
import { fireAndForget, getErrorMessage } from '../utils/errorHandling';
import { toast } from '../utils/toast';

interface UseStartMatchTransactionReturn {
  execute: (match: $Domain.Match, afterSuccess: () => void) => void;
  isBusy: boolean;
  errorMessage: string | null;
}

export function useStartMatchTransaction(): UseStartMatchTransactionReturn {
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const execute = useCallback((match: $Domain.Match, afterSuccess: () => void): void => {
    fireAndForget(
      (async (): Promise<void> => {
        setIsBusy(true);
        setErrorMessage(null);
        try {
          await transactionMethodsApi.startMatch(match);
        } catch (error) {
          const message = getErrorMessage(error);
          setErrorMessage(message);
          toast(message, 'error');
          return;
        } finally {
          setIsBusy(false);
        }
        referenceStore.invalidate();
        afterSuccess();
        toast(i18n.chrome.done, 'success');
      })()
    );
  }, []);

  return { execute, isBusy, errorMessage };
}

interface UseDisputeMatchTransactionReturn {
  execute: (match: $Domain.Match, afterSuccess: () => void) => void;
  isBusy: boolean;
  errorMessage: string | null;
}

export function useDisputeMatchTransaction(): UseDisputeMatchTransactionReturn {
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const execute = useCallback((match: $Domain.Match, afterSuccess: () => void): void => {
    fireAndForget(
      (async (): Promise<void> => {
        setIsBusy(true);
        setErrorMessage(null);
        try {
          await transactionMethodsApi.disputeMatch(match);
        } catch (error) {
          const message = getErrorMessage(error);
          setErrorMessage(message);
          toast(message, 'error');
          return;
        } finally {
          setIsBusy(false);
        }
        referenceStore.invalidate();
        afterSuccess();
        toast(i18n.chrome.done, 'success');
      })()
    );
  }, []);

  return { execute, isBusy, errorMessage };
}

interface UseCancelMatchTransactionReturn {
  execute: (match: $Domain.Match, afterSuccess: () => void) => void;
  isBusy: boolean;
  errorMessage: string | null;
}

export function useCancelMatchTransaction(): UseCancelMatchTransactionReturn {
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const execute = useCallback((match: $Domain.Match, afterSuccess: () => void): void => {
    fireAndForget(
      (async (): Promise<void> => {
        setIsBusy(true);
        setErrorMessage(null);
        try {
          await transactionMethodsApi.cancelMatch(match);
        } catch (error) {
          const message = getErrorMessage(error);
          setErrorMessage(message);
          toast(message, 'error');
          return;
        } finally {
          setIsBusy(false);
        }
        referenceStore.invalidate();
        afterSuccess();
        toast(i18n.chrome.done, 'success');
      })()
    );
  }, []);

  return { execute, isBusy, errorMessage };
}

interface UseCompleteMatchTransactionReturn {
  execute: (match: $Domain.Match, outcome: string, afterSuccess: () => void) => void;
  isBusy: boolean;
  errorMessage: string | null;
}

export function useCompleteMatchTransaction(): UseCompleteMatchTransactionReturn {
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const execute = useCallback(
    (match: $Domain.Match, outcome: string, afterSuccess: () => void): void => {
      fireAndForget(
        (async (): Promise<void> => {
          setIsBusy(true);
          setErrorMessage(null);
          try {
            await transactionMethodsApi.completeMatch(match, outcome);
          } catch (error) {
            const message = getErrorMessage(error);
            setErrorMessage(message);
            toast(message, 'error');
            return;
          } finally {
            setIsBusy(false);
          }
          referenceStore.invalidate();
          afterSuccess();
          toast(i18n.chrome.done, 'success');
        })()
      );
    },
    []
  );

  return { execute, isBusy, errorMessage };
}
