import { i18n } from '../i18n/text';
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

function unavailable(): string {
  return i18n.chrome.ruleViolationsUnavailable;
}

const KIND_LABELS: Record<RuleViolationKind, () => string> = {
  unique: (): string => i18n.chrome.ruleViolationsUnique,
  exclusive: (): string => i18n.chrome.ruleViolationsExclusive,
  check: (): string => i18n.chrome.ruleViolationsCheck,
  required: (): string => i18n.chrome.ruleViolationsRequired,
  capacity: (): string => i18n.chrome.ruleViolationsCapacity,
};

export function ruleKindLabel(group: RuleViolationGroup): string {
  return KIND_LABELS[group.kind]();
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
      return i18n.fill(i18n.chrome.ruleViolationsUniqueSentence, {
        fields: ruleSubject(group),
        count: group.count,
      });
    case 'exclusive':
      return i18n.fill(i18n.chrome.ruleViolationsExclusiveSentence, {
        fields: ruleSubject(group),
        count: group.count,
      });
    case 'check':
      return group.message !== ''
        ? i18n.fill(i18n.chrome.ruleViolationsCheckSentence, {
            condition: group.message,
            count: group.count,
          })
        : i18n.fill(i18n.chrome.ruleViolationsCheckFieldsSentence, {
            fields: ruleSubject(group),
            count: group.count,
          });
    case 'required':
      return i18n.fill(i18n.chrome.ruleViolationsRequiredSentence, {
        field: ruleSubject(group),
        count: group.count,
      });
    case 'capacity':
      return i18n.fill(i18n.chrome.ruleViolationsCapacitySentence, {
        limit: group.limit,
        stored: group.count,
      });
    default:
      throw new Error('Unknown rule violation kind');
  }
}

export function ruleRecordSentence(group: RuleViolationGroup): string {
  switch (group.kind) {
    case 'unique':
      return i18n.fill(i18n.chrome.ruleViolationsUniqueRecordSentence, {
        subject: ruleSubject(group),
      });
    case 'exclusive':
      return i18n.fill(i18n.chrome.ruleViolationsExclusiveRecordSentence, {
        subject: ruleSubject(group),
      });
    case 'check':
      return group.message !== ''
        ? i18n.fill(i18n.chrome.ruleViolationsCheckRecordSentence, { subject: group.message })
        : i18n.fill(i18n.chrome.ruleViolationsCheckFieldsRecordSentence, {
            fields: ruleSubject(group),
          });
    case 'required':
      return i18n.fill(i18n.chrome.ruleViolationsRequiredRecordSentence, {
        subject: ruleSubject(group),
      });
    case 'capacity':
      throw new Error('A breached record limit marks no individual record');
    default:
      throw new Error('Unknown rule violation kind');
  }
}

export function ruleConsequence(group: RuleViolationGroup): string {
  switch (group.kind) {
    case 'unique':
      return i18n.chrome.ruleViolationsUniqueConsequence;
    case 'exclusive':
      return i18n.chrome.ruleViolationsExclusiveConsequence;
    case 'check':
      return i18n.chrome.ruleViolationsCheckConsequence;
    case 'required':
      return i18n.chrome.ruleViolationsRequiredConsequence;
    case 'capacity':
      return i18n.chrome.ruleViolationsCapacityConsequence;
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
  const mapped = getErrorMessage(error, unavailable());
  return mapped === '' ? unavailable() : mapped;
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
    setFailure(unavailable());
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
          setFailure(unavailable());
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
