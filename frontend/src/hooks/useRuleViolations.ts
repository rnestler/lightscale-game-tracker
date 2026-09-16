import { useCallback, useEffect, useMemo, useState } from 'react';
import { httpClient } from '../api/httpClient';
import { getErrorMessage } from '../utils/errorHandling';
import { fieldLabels, recordPlural } from '../utils/recordNames';

export type RuleViolationKind = 'unique' | 'exclusive' | 'check' | 'required' | 'capacity';

export interface RuleViolationGroup {
  table: string;
  label: string;
  kind: RuleViolationKind;
  identity: string;
  message: string;
  fields: string[];
  count: number;
  limit: number;
}

interface RuleViolationPayload {
  groups: RuleViolationGroup[];
  rows: Array<{ id: string; groups: number[] }>;
  ruleSetVersion: string;
  scanned: boolean;
}

export interface TableRuleViolations {
  groups: RuleViolationGroup[];
  rows: Map<string, RuleViolationGroup[]>;
  ruleSetVersion: string;
  failure: string;
  reload: () => void;
  reportUnavailable: () => void;
}

const UNAVAILABLE = 'The records could not be checked just now. Please try again later.';

const KIND_LABELS: Record<RuleViolationKind, string> = {
  unique: 'Duplicate values',
  exclusive: 'Overlapping intervals',
  check: 'Violated condition',
  required: 'Missing value',
  capacity: 'Limit exceeded',
};

export function ruleKindLabel(group: RuleViolationGroup): string {
  return KIND_LABELS[group.kind];
}

export function ruleKey(group: RuleViolationGroup): string {
  return `${group.table}:${group.kind}:${group.identity}`;
}

function ruleSubject(group: RuleViolationGroup): string {
  return group.fields.length === 0
    ? recordPlural(group.table)
    : fieldLabels(group.table, group.fields);
}

export function ruleSentence(group: RuleViolationGroup): string {
  switch (group.kind) {
    case 'unique':
      return `Duplicate values are no longer allowed for ${ruleSubject(group)} — ${group.count} ${group.count === 1 ? 'record shares' : 'records share'} a value.`;
    case 'exclusive':
      return `Records may no longer overlap in ${ruleSubject(group)} — ${group.count} ${group.count === 1 ? 'record overlaps' : 'records overlap'} another.`;
    case 'check':
      return group.message !== ''
        ? `A new condition applies: ${group.message} — ${group.count} ${group.count === 1 ? 'record does' : 'records do'} not meet it.`
        : `${group.count} ${group.count === 1 ? 'record does' : 'records do'} not meet a condition on ${ruleSubject(group)}.`;
    case 'required':
      return `${ruleSubject(group)} is now a required field — ${group.count} ${group.count === 1 ? 'record has' : 'records have'} no value yet.`;
    case 'capacity':
      return `At most ${group.limit} ${group.limit === 1 ? 'record' : 'records'} may be stored — ${group.count} ${group.count === 1 ? 'is' : 'are'} stored.`;
    default:
      throw new Error('Unknown rule violation kind');
  }
}

export function ruleRecordSentence(group: RuleViolationGroup): string {
  switch (group.kind) {
    case 'unique':
      return `This record shares its ${ruleSubject(group)} with another record.`;
    case 'exclusive':
      return `This record overlaps another record in ${ruleSubject(group)}.`;
    case 'check':
      return group.message !== ''
        ? `This record does not meet this condition: ${group.message}`
        : `This record does not meet a condition on ${ruleSubject(group)}.`;
    case 'required':
      return `This record has no ${ruleSubject(group)} yet.`;
    case 'capacity':
      throw new Error('A breached record limit marks no individual record');
    default:
      throw new Error('Unknown rule violation kind');
  }
}

export function ruleConsequence(group: RuleViolationGroup): string {
  switch (group.kind) {
    case 'unique':
      return "These records can't be saved again until the duplicates are resolved.";
    case 'exclusive':
      return "These records can't be saved again until the overlap is resolved.";
    case 'check':
      return "These records can't be saved again until the condition is met.";
    case 'required':
      return "Until filled in, these records can't be saved, and anything calculated from the field treats it as empty.";
    case 'capacity':
      return "New entries can't be added until the count is below the limit.";
    default:
      throw new Error('Unknown rule violation kind');
  }
}

function compareCodeUnits(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

export function ruleSignature(
  groups: readonly RuleViolationGroup[],
  ruleSetVersion: string
): string {
  const identities: string[] = [];
  for (const group of groups) {
    identities.push(`${group.kind}:${group.identity}`);
  }
  identities.sort(compareCodeUnits);
  return [ruleSetVersion, ...identities].join('|');
}

const DISMISSED_KEY_PREFIX = 'lightscale.ruleViolationsDismissed.';

export function storedDismissal(collection: string): string {
  return window.localStorage.getItem(DISMISSED_KEY_PREFIX + collection) ?? '';
}

export function rememberDismissal(collection: string, signature: string): void {
  window.localStorage.setItem(DISMISSED_KEY_PREFIX + collection, signature);
}

const NO_ROWS = new Map<string, RuleViolationGroup[]>();

function failureText(error: unknown): string {
  const mapped = getErrorMessage(error, UNAVAILABLE);
  return mapped === '' ? UNAVAILABLE : mapped;
}

function markedRows(payload: RuleViolationPayload): Map<string, RuleViolationGroup[]> {
  const rows = new Map<string, RuleViolationGroup[]>();
  for (const row of payload.rows) {
    const marked: RuleViolationGroup[] = [];
    for (const index of row.groups) {
      const group = payload.groups.at(index);
      if (!Number.isInteger(index) || index < 0 || group === undefined) {
        throw new Error(`A marked record names rule ${index}, which the payload does not carry`);
      }
      marked.push(group);
    }
    rows.set(row.id, marked);
  }
  return rows;
}

export function useRuleViolations(collection: string): TableRuleViolations {
  const [payload, setPayload] = useState<RuleViolationPayload | null>(null);
  const [failure, setFailure] = useState('');
  const [round, setRound] = useState(0);

  const reload = useCallback((): void => {
    setRound((previous) => previous + 1);
  }, []);

  const reportUnavailable = useCallback((): void => {
    setPayload(null);
    setFailure(UNAVAILABLE);
  }, []);

  useEffect(() => {
    let listening = true;
    httpClient
      .get<RuleViolationPayload | undefined>(`/api/rule-violations/${collection}`)
      .then((loaded) => {
        if (!listening) {
          return;
        }
        if (loaded === undefined) {
          setPayload(null);
          setFailure(UNAVAILABLE);
          return;
        }
        setPayload(loaded);
        setFailure('');
      })
      .catch((error: unknown) => {
        if (listening) {
          setPayload(null);
          setFailure(failureText(error));
        }
      });
    return (): void => {
      listening = false;
    };
  }, [collection, round]);

  return useMemo(() => {
    if (payload === null) {
      return { groups: [], rows: NO_ROWS, ruleSetVersion: '', failure, reload, reportUnavailable };
    }
    return {
      groups: payload.groups,
      rows: markedRows(payload),
      ruleSetVersion: payload.ruleSetVersion,
      failure,
      reload,
      reportUnavailable,
    };
  }, [payload, failure, reload, reportUnavailable]);
}
