import type { JSX, ReactNode } from 'react';
import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import type { RuleViolationGroup, TableRuleViolations } from '../hooks/useRuleViolations';
import {
  rememberDismissal,
  ruleConsequence,
  ruleKey,
  ruleRecordSentence,
  ruleSentence,
  ruleSignature,
  storedDismissal,
} from '../hooks/useRuleViolations';

function BannerFrame({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="flex items-start gap-3 border-b ui-warning-notice px-4 py-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 ui-warning-text" />
      {children}
    </div>
  );
}

export function RuleViolationsBanner({
  collection,
  violations,
  filtering,
  onFilter,
}: {
  collection: string;
  violations: TableRuleViolations;
  filtering: boolean;
  onFilter: (only: boolean) => void;
}): JSX.Element | null {
  const [dismissed, setDismissed] = useState(() => storedDismissal(collection));
  const signature = ruleSignature(violations.groups, violations.ruleSetVersion);

  if (violations.failure !== '') {
    return (
      <BannerFrame>
        <p className="min-w-0 flex-1 break-words text-sm text-foreground">{violations.failure}</p>
      </BannerFrame>
    );
  }
  if (violations.groups.length === 0 || dismissed === signature) {
    return null;
  }
  return (
    <BannerFrame>
      <div className="min-w-0 flex-1">
        {violations.groups.map((group) => (
          <div key={ruleKey(group)} className="mt-2 first:mt-0">
            <p className="break-words text-sm text-foreground">{ruleSentence(group)}</p>
            <p className="break-words text-xs text-muted-foreground">{ruleConsequence(group)}</p>
          </div>
        ))}
        {violations.rows.size > 0 && (
          <button
            type="button"
            className="text-xs font-semibold ui-warning-text underline-offset-4 hover:underline mt-2"
            onClick={() => {
              onFilter(!filtering);
            }}
          >
            {filtering ? 'Show all' : 'Show only these'}
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label={'Dismiss'}
        title={'Dismiss'}
        className="shrink-0 ui-warning-text hover:opacity-70"
        onClick={() => {
          rememberDismissal(collection, signature);
          setDismissed(signature);
          onFilter(false);
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </BannerFrame>
  );
}

export function RuleViolationMarker({
  groups,
}: {
  groups: RuleViolationGroup[];
}): JSX.Element | null {
  if (groups.length === 0) {
    return null;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={'Breaks a rule'}
          className="inline-block h-2 w-2 rounded-full ui-warning-fill"
        />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs flex-col items-start gap-1">
        {groups.map((group) => (
          <span key={ruleKey(group)} className="block">
            <span className="block text-popover-foreground">{ruleRecordSentence(group)}</span>
            <span className="block text-muted-foreground">{ruleConsequence(group)}</span>
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}
