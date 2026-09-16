import { useEffect, useState, type JSX, type ReactNode } from 'react';
import { httpClient } from '../api/httpClient';
import { currencyLoaded, setViewerCurrency } from '../config/currency';
import { getErrorMessage } from '../utils/errorHandling';
import { ErrorMessage } from './ui/error-message';

export function CurrencyGate({ children }: { children: ReactNode }): JSX.Element | null {
  const [loaded, setLoaded] = useState(currencyLoaded());
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (loaded) {
      return;
    }
    httpClient
      .get<{ currency: string }>('/api/viewer-currency')
      .then(({ currency }) => {
        setViewerCurrency(currency);
        setLoaded(true);
      })
      .catch((error: unknown) => {
        setFailure(getErrorMessage(error));
      });
  }, [loaded]);

  if (failure !== null) {
    return (
      <div className="p-6">
        <ErrorMessage message={failure} />
      </div>
    );
  }
  return loaded ? <>{children}</> : null;
}
