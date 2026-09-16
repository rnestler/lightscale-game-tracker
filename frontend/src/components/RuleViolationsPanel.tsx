import type { JSX } from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import { httpClient } from '../api/httpClient';
import { usePermissions } from '../hooks/usePermissions';
import { getErrorMessage } from '../utils/errorHandling';
import { recordPlural } from '../utils/recordNames';
import type { RuleViolationGroup } from '../hooks/useRuleViolations';
import { ruleConsequence, ruleKey, ruleKindLabel, ruleSentence } from '../hooks/useRuleViolations';

const REACHABLE_VIEWS = new Set<string>([
  'dashboard',
  'gameLeaderboards',
  'games',
  'leaderboards',
  'matches',
  'players',
]);

const UNAVAILABLE = 'The records could not be checked just now. Please try again later.';

function failureText(error: unknown): string {
  const mapped = getErrorMessage(error, UNAVAILABLE);
  return mapped === '' ? UNAVAILABLE : mapped;
}

function chipClasses(group: RuleViolationGroup): string {
  return group.kind === 'capacity'
    ? 'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-destructive/10 text-destructive-text'
    : 'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ui-chip-warning';
}

export function RuleViolationsView({
  onNavigate,
}: {
  onNavigate: (view: string) => void;
}): JSX.Element | null {
  const { isAdmin } = usePermissions();
  const [groups, setGroups] = useState<RuleViolationGroup[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failure, setFailure] = useState('');

  const load = useCallback(async (): Promise<void> => {
    const data = await httpClient.get<{ groups: RuleViolationGroup[] }>(
      '/api/admin/rule-violations?kinds=unique,exclusive,check,required,capacity'
    );
    setGroups(data.groups);
    setFailure('');
    setLoaded(true);
  }, []);

  const loadedRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!isAdmin || loadedRef.current === load) {
      return;
    }
    loadedRef.current = load;
    load().catch((error: unknown) => {
      setGroups([]);
      setFailure(failureText(error));
      setLoaded(true);
    });
  }, [isAdmin, load]);

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 xl:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="h-5 w-5 ui-warning-text" />
          <h1 className="ui-display text-2xl font-semibold tracking-tight" data-ls="23cee10733">
            {'Rule violations'}
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {
            'Existing records that conflict with rules added later. New entries are already checked; resolve these records to fully enforce the rules. Only visible to admins.'
          }
        </p>
        {loaded && groups.length === 0 && (
          <p className="mt-10 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            {failure !== '' ? failure : 'No rule violations.'}
          </p>
        )}
        {groups.length > 0 && (
          <div className="mt-6 flex flex-col gap-4">
            {groups.map((group) => (
              <section
                key={ruleKey(group)}
                className="rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="ui-display text-base font-semibold tracking-tight text-foreground">
                    {recordPlural(group.table)}
                  </h2>
                  <span className={chipClasses(group)}>{ruleKindLabel(group)}</span>
                </div>
                <p className="mt-2 break-words text-sm text-foreground">{ruleSentence(group)}</p>
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  {ruleConsequence(group)}
                </p>
                {REACHABLE_VIEWS.has(group.label) && (
                  <button
                    type="button"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                    onClick={() => {
                      onNavigate(group.label);
                    }}
                  >
                    {`Show in ${recordPlural(group.table)}`}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
