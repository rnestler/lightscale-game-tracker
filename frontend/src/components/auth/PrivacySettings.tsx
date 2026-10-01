import { i18n } from '../../i18n/text';
import type { JSX } from 'react';
import { useState, useEffect } from 'react';
import { apiBaseUrl } from '../../config/apiConfig.js';
import { Download, Trash2, ShieldCheck } from 'lucide-react';

interface PersonalRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface PersonalResourceReport {
  resource: string;
  records: PersonalRecord[];
}

interface PersonalDataReport {
  userId: string;
  resources: PersonalResourceReport[];
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => formatFieldValue(entry)).join(', ');
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([field, entry]) => `${field}: ${formatFieldValue(entry)}`)
      .join(', ');
  }
  return JSON.stringify(value);
}

export function PrivacySettings({
  canRequestErasure,
}: {
  canRequestErasure: boolean;
}): JSX.Element {
  const [report, setReport] = useState<PersonalDataReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [erasure, setErasure] = useState<'idle' | 'requested' | 'pending'>('idle');
  const error = requestError ?? loadError;

  useEffect(() => {
    const load = async (): Promise<void> => {
      const response = await fetch(`${apiBaseUrl}/api/account/personal-data`, {
        credentials: 'include',
      });
      if (!response.ok) {
        setLoadError(i18n.chrome.privacyLoadFailed);
        setIsLoading(false);
        return;
      }
      const data = (await response.json()) as { report: PersonalDataReport };
      setReport(data.report);
      setIsLoading(false);
    };
    load().catch(() => {
      setLoadError(i18n.chrome.privacyLoadFailed);
      setIsLoading(false);
    });
  }, []);

  const downloadJson = (): void => {
    if (report === null) {
      return;
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'personal-data.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const requestErasure = async (): Promise<void> => {
    setRequestError(null);
    const response = await fetch(`${apiBaseUrl}/api/account/erasure-request`, {
      method: 'POST',
      credentials: 'include',
    });
    if (response.status === 409) {
      setErasure('pending');
      return;
    }
    if (response.ok) {
      setErasure('requested');
      return;
    }
    setRequestError(i18n.fill(i18n.chrome.errorRequestFailed, { status: response.status }));
  };

  const hasData = report !== null && report.resources.length > 0;

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-foreground">{i18n.chrome.privacyTitle}</h3>
        <p className="text-sm text-muted-foreground">{i18n.chrome.privacyDescription}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={downloadJson}
          disabled={!hasData}
          className="inline-flex items-center gap-2 h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="h-4 w-4" />
          {i18n.chrome.privacyDownload}
        </button>
        {canRequestErasure && (
          <button
            type="button"
            onClick={() => {
              requestErasure().catch(() => {
                setRequestError(i18n.chrome.guestPrivacyError);
              });
            }}
            disabled={erasure !== 'idle'}
            className="inline-flex items-center gap-2 h-10 rounded-lg border border-destructive/40 px-4 text-sm font-medium text-destructive-text hover:bg-destructive/5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4" />
            {i18n.chrome.privacyRequestErasure}
          </button>
        )}
      </div>

      {erasure === 'requested' && (
        <div className="rounded-lg border border-border bg-secondary p-3 text-sm text-foreground">
          {i18n.chrome.privacyErasureRequested}
        </div>
      )}
      {erasure === 'pending' && (
        <div className="rounded-lg border border-border bg-secondary p-3 text-sm text-foreground">
          {i18n.chrome.privacyErasurePending}
        </div>
      )}
      {error !== null && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground">
          {error}
        </div>
      )}

      {!isLoading && !hasData && error === null && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          <ShieldCheck className="h-5 w-5" />
          {i18n.chrome.privacyNoData}
        </div>
      )}

      {!isLoading && hasData && (
        <div className="flex flex-col gap-6">
          {report.resources.map((group) => (
            <div
              key={group.resource}
              className="rounded-lg border border-border bg-card overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h4 className="min-w-0 truncate text-sm font-semibold text-foreground">
                  {group.resource}
                </h4>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {group.records.length}
                </span>
              </div>
              <div className="divide-y divide-border">
                {group.records.map((record) => (
                  <div key={record.id} className="px-5 py-4">
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                      {Object.entries(record.fields).map(([field, value]) => (
                        <div key={field} className="flex flex-col gap-0.5">
                          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                            {field}
                          </dt>
                          <dd className="text-sm text-foreground break-words">
                            {formatFieldValue(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
