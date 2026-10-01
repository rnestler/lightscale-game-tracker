import { i18n } from '../i18n/text';
import type { JSX } from 'react';
import { useState, useEffect, useRef } from 'react';
import { apiBaseUrl } from '../config/apiConfig';
import { ErrorMessage } from './ui/error-message';
import { fireAndForget } from '../utils/errorHandling';
import { ShieldCheck, Trash2, Mail, Archive } from 'lucide-react';

export function AccessSettings(): JSX.Element {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requireEmailVerification, setRequireEmailVerification] = useState(false);
  const [allowAccountDeletion, setAllowAccountDeletion] = useState(true);
  const [inviteOnly, setInviteOnly] = useState(false);
  const [showStaleData, setShowStaleData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = async (): Promise<void> => {
    const response = await fetch(`${apiBaseUrl}/api/admin/auth-settings`, {
      credentials: 'include',
    });
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as {
      requireEmailVerification: boolean;
      allowAccountDeletion: boolean;
      inviteOnly: boolean;
      showStaleData: boolean;
    };
    setRequireEmailVerification(data.requireEmailVerification);
    setAllowAccountDeletion(data.allowAccountDeletion);
    setInviteOnly(data.inviteOnly);
    setShowStaleData(data.showStaleData);
  };

  const updateSetting = async (
    patch: Record<string, boolean>,
    apply: () => void
  ): Promise<void> => {
    setIsSaving(true);
    const response = await fetch(`${apiBaseUrl}/api/admin/auth-settings`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setIsSaving(false);
    if (!response.ok) {
      setErrorMessage(i18n.chrome.failedToUpdateSettings);
      return;
    }
    apply();
  };

  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) {
      return;
    }
    loadedRef.current = true;
    fireAndForget(fetchSettings());
  }, []);

  return (
    <div className="w-full min-w-0 px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 xl:py-10 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold mb-2 break-words" data-ls="8b914f1827">
          {i18n.chrome.accessTitle}
        </h1>
        <p className="text-muted-foreground">{i18n.chrome.accessSubtitle}</p>
      </div>

      {errorMessage && (
        <div className="mb-4">
          <ErrorMessage message={errorMessage} />
        </div>
      )}

      <div className="mb-6 bg-card border border-border rounded-lg p-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <ShieldCheck className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold break-words">
              {i18n.chrome.requireEmailVerificationLabel}
            </h3>
            <p className="text-sm text-muted-foreground break-words">
              {i18n.chrome.requireEmailVerificationDescription}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={requireEmailVerification}
          aria-label={i18n.chrome.requireEmailVerificationLabel}
          disabled={isSaving}
          onClick={() => {
            fireAndForget(
              updateSetting({ requireEmailVerification: !requireEmailVerification }, () => {
                setRequireEmailVerification(!requireEmailVerification);
              })
            );
          }}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${requireEmailVerification ? 'bg-primary' : 'bg-muted'}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${requireEmailVerification ? 'translate-x-5' : 'translate-x-0.5'}`}
          />
        </button>
      </div>

      <div className="mb-6 bg-card border border-border rounded-lg p-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Trash2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold break-words">
              {i18n.chrome.allowAccountDeletionLabel}
            </h3>
            <p className="text-sm text-muted-foreground break-words">
              {i18n.chrome.allowAccountDeletionDescription}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={allowAccountDeletion}
          aria-label={i18n.chrome.allowAccountDeletionLabel}
          disabled={isSaving}
          onClick={() => {
            fireAndForget(
              updateSetting({ allowAccountDeletion: !allowAccountDeletion }, () => {
                setAllowAccountDeletion(!allowAccountDeletion);
              })
            );
          }}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${allowAccountDeletion ? 'bg-primary' : 'bg-muted'}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${allowAccountDeletion ? 'translate-x-5' : 'translate-x-0.5'}`}
          />
        </button>
      </div>

      <div className="mb-6 bg-card border border-border rounded-lg p-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Mail className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold break-words">{i18n.chrome.inviteOnlyLabel}</h3>
            <p className="text-sm text-muted-foreground break-words">
              {i18n.chrome.inviteOnlyDescription}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={inviteOnly}
          aria-label={i18n.chrome.inviteOnlyLabel}
          disabled={isSaving}
          onClick={() => {
            fireAndForget(
              updateSetting({ inviteOnly: !inviteOnly }, () => {
                setInviteOnly(!inviteOnly);
              })
            );
          }}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${inviteOnly ? 'bg-primary' : 'bg-muted'}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${inviteOnly ? 'translate-x-5' : 'translate-x-0.5'}`}
          />
        </button>
      </div>

      <div className="mb-6 bg-card border border-border rounded-lg p-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Archive className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold break-words">
              {i18n.chrome.showStaleDataLabel}
            </h3>
            <p className="text-sm text-muted-foreground break-words">
              {i18n.chrome.showStaleDataDescription}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={showStaleData}
          aria-label={i18n.chrome.showStaleDataLabel}
          disabled={isSaving}
          onClick={() => {
            fireAndForget(
              updateSetting({ showStaleData: !showStaleData }, () => {
                setShowStaleData(!showStaleData);
              })
            );
          }}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${showStaleData ? 'bg-primary' : 'bg-muted'}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${showStaleData ? 'translate-x-5' : 'translate-x-0.5'}`}
          />
        </button>
      </div>
    </div>
  );
}
