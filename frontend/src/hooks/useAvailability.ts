import { useEffect, useState } from 'react';
import { apiBaseUrl } from '../config/apiConfig';

interface UseAvailabilityInput {
  resource: string;
  rules: string[][];
  values: Record<string, string>;
  domains: Record<string, string[]>;
  excludeId: string | null;
}

export interface Availability {
  locked: (field: string) => boolean;
  taken: (field: string) => string[];
  refresh: () => void;
}

interface FetchSpec {
  rule: string[];
  field: string;
  known: Record<string, string>;
  domains: Record<string, string[]>;
}

type AvailabilityRequest = [
  string,
  string[][],
  Record<string, string>,
  Record<string, string[]>,
  string | null,
];

function fetchSpecs(
  rules: string[][],
  values: Record<string, string>,
  domains: Record<string, string[]>
): FetchSpec[] {
  const specs: FetchSpec[] = [];
  for (const rule of rules) {
    for (const [index, field] of rule.entries()) {
      const upstream = rule.slice(0, index);
      if (upstream.every((entry) => Boolean(values[entry]))) {
        const known: Record<string, string> = {};
        for (const entry of upstream) {
          known[entry] = values[entry];
        }
        const specDomains: Record<string, string[]> = {};
        for (const entry of rule.slice(index + 1)) {
          if (entry in domains) {
            specDomains[entry] = domains[entry];
          }
        }
        specs.push({ rule, field, known, domains: specDomains });
      }
    }
  }
  return specs;
}

export function useAvailability({
  resource,
  rules,
  values,
  domains,
  excludeId,
}: UseAvailabilityInput): Availability {
  const [takenByField, setTakenByField] = useState<Record<string, string[]>>({});
  const [version, setVersion] = useState(0);
  const signature = JSON.stringify([resource, rules, values, domains, excludeId]);

  useEffect(() => {
    let cancelled = false;
    const [requestResource, requestRules, requestValues, requestDomains, requestExcludeId] =
      JSON.parse(signature) as AvailabilityRequest;
    async function load(): Promise<void> {
      const next: Record<string, string[]> = {};
      await Promise.all(
        fetchSpecs(requestRules, requestValues, requestDomains).map(async (spec) => {
          const response = await fetch(`${apiBaseUrl}/${requestResource}/availability`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              rule: spec.rule,
              field: spec.field,
              known: spec.known,
              domains: spec.domains,
              ...(requestExcludeId !== null ? { excludeId: requestExcludeId } : {}),
            }),
          });
          if (!response.ok) {
            return;
          }
          const body = (await response.json()) as { taken?: unknown };
          const takenValues = Array.isArray(body.taken) ? body.taken.map(String) : [];
          next[spec.field] = [...(next[spec.field] ?? []), ...takenValues];
        })
      );
      if (!cancelled) {
        setTakenByField(next);
      }
    }
    load().catch((error: unknown) => {
      console.error('availability load failed', error);
    });
    return (): void => {
      cancelled = true;
    };
  }, [signature, version]);

  function locked(field: string): boolean {
    return rules.some((rule) => {
      const index = rule.indexOf(field);
      return index > 0 && rule.slice(0, index).some((entry) => !values[entry]);
    });
  }

  function taken(field: string): string[] {
    return takenByField[field] ?? [];
  }

  function refresh(): void {
    setVersion((current) => current + 1);
  }

  return { locked, taken, refresh };
}
