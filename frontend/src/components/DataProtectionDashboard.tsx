import type { JSX } from 'react';
import { useState, useEffect, useRef } from 'react';
import { apiBaseUrl } from '../config/apiConfig.js';
import {
  ShieldCheck,
  Search,
  Trash2,
  UserX,
  FileText,
  PencilLine,
  ListChecks,
  Globe,
  Download,
} from 'lucide-react';
import { ConfirmDeleteDialog } from './ui/ConfirmDelete';

interface PendingErasure {
  id: string;
  resolution: 'anonymize' | 'delete';
}

interface PrivacyInquiry {
  id: string;
  userId: string;
  email: string;
  kind: string;
  status: string;
  verified: boolean;
  requestedAt: string;
  resolution: string;
  resolvedAt: string;
}

interface Subject {
  email: string;
  name: string;
  attributes: Record<string, string>;
  userId: string | null;
}

function subjectLabel(subject: Subject): string {
  if (subject.email !== '') {
    return subject.email;
  }
  if (subject.name !== '') {
    return subject.name;
  }
  const values = Object.values(subject.attributes);
  return values.length > 0 ? values.join(' ') : '—';
}

function subjectDetail(subject: Subject): string {
  if (subject.email !== '') {
    return subject.name;
  }
  return Object.entries(subject.attributes)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' · ');
}

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
  return JSON.stringify(value);
}

function kindLabel(kind: string): string {
  if (kind === 'access') {
    return 'Access';
  }
  if (kind === 'rectification') {
    return 'Rectification';
  }
  if (kind === 'erasure') {
    return 'Erasure';
  }
  return kind;
}

export function DataProtectionDashboard(): JSX.Element {
  const [inquiries, setInquiries] = useState<PrivacyInquiry[]>([]);
  const [query, setQuery] = useState('');
  const [report, setReport] = useState<PersonalDataReport | null>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Record<string, PersonalResourceReport[]>>({});
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [pendingErasure, setPendingErasure] = useState<PendingErasure | null>(null);

  const fetchInquiries = async (): Promise<void> => {
    const response = await fetch(`${apiBaseUrl}/api/admin/privacy-inquiries`, {
      credentials: 'include',
    });
    if (response.ok) {
      const data = (await response.json()) as { inquiries: PrivacyInquiry[] };
      setInquiries(data.inquiries);
    }
  };

  const fetchSubjects = async (): Promise<void> => {
    const response = await fetch(`${apiBaseUrl}/api/admin/privacy-subjects`, {
      credentials: 'include',
    });
    if (response.ok) {
      const data = (await response.json()) as { subjects: Subject[] };
      setSubjects(data.subjects);
    }
  };

  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) {
      return;
    }
    loadedRef.current = true;
    fetchInquiries().catch(() => undefined);
    fetchSubjects().catch(() => undefined);
  }, []);

  const subjectReportUrl = (subject: Subject): string => {
    const params = new URLSearchParams();
    if (subject.email !== '') {
      params.set('email', subject.email);
    }
    if (subject.userId !== null) {
      params.set('userId', subject.userId);
    }
    if (Object.keys(subject.attributes).length > 0) {
      params.set('attributes', JSON.stringify(subject.attributes));
    }
    return `/api/admin/privacy-subjects/report?${params.toString()}`;
  };

  const pdfUrl = (url: string): string => {
    return `${apiBaseUrl}${url}${url.includes('?') ? '&' : '?'}format=pdf`;
  };

  const showReport = async (url: string): Promise<void> => {
    setReport(null);
    setLookupMessage(null);
    setReportUrl(url);
    const response = await fetch(`${apiBaseUrl}${url}`, { credentials: 'include' });
    if (response.ok) {
      const data = (await response.json()) as { report: PersonalDataReport };
      setReport(data.report);
    } else {
      setLookupMessage('No matching user.');
    }
  };

  const matchesQuery = (subject: Subject): boolean => {
    const term = query.trim().toLowerCase();
    if (term === '') {
      return true;
    }
    if (subject.email.toLowerCase().includes(term) || subject.name.toLowerCase().includes(term)) {
      return true;
    }
    return Object.values(subject.attributes).some((value) => value.toLowerCase().includes(term));
  };

  const filteredSubjects = subjects.filter(matchesQuery);

  const reviewCandidates = async (id: string): Promise<void> => {
    const response = await fetch(`${apiBaseUrl}/api/admin/privacy-inquiries/${id}/candidates`, {
      credentials: 'include',
    });
    if (response.ok) {
      const data = (await response.json()) as { candidates: PersonalResourceReport[] };
      setCandidates((prev) => ({ ...prev, [id]: data.candidates }));
    }
  };

  const toggleSelect = (id: string, key: string): void => {
    setSelected((prev) => {
      const current = prev[id] ?? [];
      const next = current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key];
      return { ...prev, [id]: next };
    });
  };

  const buildGranted = (id: string): Record<string, string[]> => {
    const result: Record<string, string[]> = {};
    for (const entry of selected[id] ?? []) {
      const parts = entry.split('::');
      if (parts.length === 2) {
        const [resource, recordId] = parts;
        const list = result[resource] ?? [];
        list.push(recordId);
        result[resource] = list;
      }
    }
    return result;
  };

  const resolve = async (
    id: string,
    resolution: 'report' | 'amend' | 'anonymize' | 'delete'
  ): Promise<void> => {
    setActionError(null);
    setNotice(null);
    const response = await fetch(`${apiBaseUrl}/api/admin/privacy-inquiries/${id}/resolve`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution, granted: buildGranted(id) }),
    });
    if (response.ok) {
      setNotice(resolution === 'report' ? 'Report sent to the requester.' : 'Request resolved.');
      await fetchInquiries();
    } else {
      setActionError('Could not resolve the request.');
    }
  };

  const hasReport = report !== null && report.resources.length > 0;

  return (
    <div className="px-4 sm:px-6 lg:px-8 xl:px-10 py-6 lg:py-8 flex flex-col gap-6 sm:gap-8">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-lg border border-border bg-secondary flex items-center justify-center shrink-0">
          <ShieldCheck className="h-5 w-5 text-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground" data-ls="f5aa6dd444">
            Data Protection
          </h1>
          <p className="text-sm text-muted-foreground">
            Inspect personal data and resolve erasure requests.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
        <Globe className="h-5 w-5 text-muted-foreground shrink-0" />
        <span className="text-sm text-foreground">Guest requests: open at /privacy</span>
      </div>

      {notice !== null && (
        <div className="rounded-lg border border-border bg-secondary p-3 text-sm text-foreground">
          {notice}
        </div>
      )}
      {actionError !== null && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground">
          {actionError}
        </div>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">Erasure requests</h2>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {inquiries.length === 0 ? (
            <div className="px-5 py-6 text-sm text-muted-foreground">No erasure requests.</div>
          ) : (
            <div className="divide-y divide-border">
              {inquiries.map((entry) => {
                const entryCandidates = candidates[entry.id];
                const entrySelected = selected[entry.id] ?? [];
                return (
                  <div key={entry.id} className="flex flex-col gap-3 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-foreground">{entry.email}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-foreground">
                            {kindLabel(entry.kind)}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                            {entry.status}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {entry.requestedAt.slice(0, 10)}
                          </span>
                        </div>
                      </div>
                      {entry.status === 'pending' && !entry.verified && (
                        <span className="text-xs text-muted-foreground">
                          Awaiting email verification
                        </span>
                      )}
                      {entry.status === 'pending' && entry.verified && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              resolve(entry.id, 'report').catch(() => undefined);
                            }}
                            className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                          >
                            <FileText className="h-4 w-4" />
                            Send report
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              resolve(entry.id, 'amend').catch(() => undefined);
                            }}
                            className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                          >
                            <PencilLine className="h-4 w-4" />
                            Mark amended
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              reviewCandidates(entry.id).catch(() => undefined);
                            }}
                            className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                          >
                            <ListChecks className="h-4 w-4" />
                            Review matches
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingErasure({ id: entry.id, resolution: 'anonymize' });
                            }}
                            className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                          >
                            <UserX className="h-4 w-4" />
                            Anonymize
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingErasure({ id: entry.id, resolution: 'delete' });
                            }}
                            className="inline-flex items-center gap-1.5 h-9 rounded-lg bg-destructive px-3 text-sm font-medium text-destructive-foreground hover:opacity-90"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          showReport(`/api/admin/privacy-inquiries/${entry.id}/report`).catch(
                            () => undefined
                          );
                        }}
                        className="inline-flex items-center gap-1.5 h-8 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        View report
                      </button>
                      <a
                        href={pdfUrl(`/api/admin/privacy-inquiries/${entry.id}/report`)}
                        className="inline-flex items-center gap-1.5 h-8 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download PDF
                      </a>
                    </div>
                    {entry.id in candidates && (
                      <div className="rounded-lg border border-border bg-secondary p-3 flex flex-col gap-3">
                        <p className="text-xs text-muted-foreground">
                          Select matches to include when you anonymize or delete.
                        </p>
                        {entryCandidates.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No further matches to review.
                          </p>
                        ) : (
                          <div className="flex flex-col gap-3">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Possible matches
                            </span>
                            {entryCandidates.map((group) => (
                              <div key={group.resource} className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-foreground">
                                  {group.resource}
                                </span>
                                {group.records.map((record) => {
                                  const key = `${group.resource}::${record.id}`;
                                  return (
                                    <label
                                      key={record.id}
                                      className="flex items-start gap-2 text-sm text-foreground"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={entrySelected.includes(key)}
                                        onChange={() => {
                                          toggleSelect(entry.id, key);
                                        }}
                                        className="mt-1"
                                      />
                                      <span className="break-words">
                                        {Object.entries(record.fields)
                                          .map(
                                            ([field, value]) =>
                                              `${field}: ${formatFieldValue(value)}`
                                          )
                                          .join(' · ')}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">Look up a data subject</h2>
        <div className="relative w-80 max-w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            placeholder="Search by email or name"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          />
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {filteredSubjects.length === 0 ? (
            <div className="px-5 py-6 text-sm text-muted-foreground">No matching user.</div>
          ) : (
            <div className="divide-y divide-border">
              {filteredSubjects.map((subject) => (
                <div
                  key={subjectReportUrl(subject)}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">
                      {subjectLabel(subject)}
                    </span>
                    {subjectDetail(subject) !== '' && (
                      <span className="text-xs text-muted-foreground">
                        {subjectDetail(subject)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        showReport(subjectReportUrl(subject)).catch(() => undefined);
                      }}
                      className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      <FileText className="h-4 w-4" />
                      View report
                    </button>
                    <a
                      href={pdfUrl(subjectReportUrl(subject))}
                      className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      <Download className="h-4 w-4" />
                      Download PDF
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {lookupMessage !== null && (
          <div className="rounded-lg border border-border bg-secondary p-3 text-sm text-foreground">
            {lookupMessage}
          </div>
        )}

        {report !== null && !hasReport && (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            No personal data found for this user.
          </div>
        )}

        {hasReport && (
          <div className="flex flex-col gap-4">
            {reportUrl !== null && (
              <a
                href={pdfUrl(reportUrl)}
                className="self-start inline-flex items-center gap-1.5 h-9 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </a>
            )}
            {report.resources.map((group) => (
              <div
                key={group.resource}
                className="rounded-lg border border-border bg-card overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <h3 className="text-sm font-semibold text-foreground">{group.resource}</h3>
                  <span className="text-xs text-muted-foreground">{group.records.length}</span>
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
      </section>
      <ConfirmDeleteDialog
        open={pendingErasure !== null}
        title={pendingErasure?.resolution === 'anonymize' ? 'Anonymize' : 'Delete'}
        description={
          pendingErasure?.resolution === 'anonymize'
            ? 'Anonymize this user’s personal data? Records are kept but personal fields are scrubbed.'
            : 'Delete this user’s owned records and account? This cannot be undone.'
        }
        cancelLabel={'Cancel'}
        deleteLabel={pendingErasure?.resolution === 'anonymize' ? 'Anonymize' : 'Delete'}
        onCancel={() => {
          setPendingErasure(null);
        }}
        onConfirm={() => {
          if (pendingErasure !== null) {
            resolve(pendingErasure.id, pendingErasure.resolution).catch(() => undefined);
          }
          setPendingErasure(null);
        }}
      />
    </div>
  );
}
