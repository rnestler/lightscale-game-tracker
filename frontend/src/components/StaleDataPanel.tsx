import type { JSX } from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Archive, EyeOff, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { apiBaseUrl } from '../config/apiConfig';
import { usePermissions } from '../hooks/usePermissions';
import { fireAndForget } from '../utils/errorHandling';
import { ConfirmDeleteDialog } from './ui/ConfirmDelete';

interface PendingRemoval {
  label: string;
  description: string;
  run: () => void;
}

function RemovalDialog({
  pending,
  onClose,
}: {
  pending: PendingRemoval | null;
  onClose: () => void;
}): JSX.Element {
  return (
    <ConfirmDeleteDialog
      open={pending !== null}
      title={pending?.label ?? ''}
      description={pending?.description ?? ''}
      cancelLabel={'Cancel'}
      deleteLabel={pending?.label ?? ''}
      onCancel={onClose}
      onConfirm={() => {
        if (pending !== null) {
          pending.run();
        }
        onClose();
      }}
    />
  );
}

interface StaleColumn {
  column: string;
  label: string;
}

interface FieldData {
  column: string;
  label: string;
  value: string;
  stale: boolean;
}

interface StaleRow {
  id: string;
  values: Record<string, string>;
}

interface StaleTableData {
  columns: StaleColumn[];
  rows: StaleRow[];
}

interface StaleOverviewTable {
  table: string;
  label: string;
  orphan: boolean;
  columns: StaleColumn[];
  rowCount: number;
}

async function clearStale(table: string, column: string | null): Promise<boolean> {
  const response = await fetch(`${apiBaseUrl}/api/admin/stale-data/clear`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(column === null ? { table } : { table, column }),
  });
  return response.ok;
}

async function deleteStaleRecord(table: string, id: string): Promise<boolean> {
  const response = await fetch(`${apiBaseUrl}/api/admin/stale-data/delete-record`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, id }),
  });
  return response.ok;
}

function ReadonlyField({ field }: { field: FieldData }): JSX.Element {
  return (
    <div className="rounded-xl border border-border/60 bg-background px-4 py-3">
      <span className="text-sm font-medium text-foreground">{field.label}</span>
      <p className="mt-1 break-words font-mono text-xs text-muted-foreground">
        {field.value || '—'}
      </p>
    </div>
  );
}

function StaleField({ field, onClear }: { field: FieldData; onClear: () => void }): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-background px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{field.label}</span>
          <span className="rounded-full ui-chip-warning px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            {'stale'}
          </span>
        </div>
        <p className="mt-1 break-words font-mono text-xs text-muted-foreground">
          {field.value || '—'}
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground ui-control-ghost ui-control-danger-soft transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {'Clear'}
      </button>
    </div>
  );
}

export function StaleDataPanel({
  table,
  recordId,
  visibleColumns,
}: {
  table: string;
  recordId: string | null;
  visibleColumns: string[];
}): JSX.Element | null {
  const { showStaleData } = usePermissions();
  const [hidden, setHidden] = useState<FieldData[]>([]);
  const [stale, setStale] = useState<FieldData[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<PendingRemoval | null>(null);
  const visibleKey = visibleColumns.join('\u0000');

  const load = useCallback(async (): Promise<void> => {
    if (recordId === null) {
      const response = await fetch(
        `${apiBaseUrl}/api/admin/stale-data/${encodeURIComponent(table)}`,
        { credentials: 'include' }
      );
      if (!response.ok) {
        setHidden([]);
        setStale([]);
        return;
      }
      const data = (await response.json()) as StaleTableData;
      const values = data.rows[0]?.values ?? {};
      setHidden([]);
      setStale(
        data.columns
          .map((column) => ({
            column: column.column,
            label: column.label,
            value: values[column.column] ?? '',
            stale: true,
          }))
          .filter((field) => field.value !== '')
      );
      return;
    }
    const response = await fetch(
      `${apiBaseUrl}/api/admin/stale-data/${encodeURIComponent(table)}/record/${encodeURIComponent(recordId)}`,
      { credentials: 'include' }
    );
    if (!response.ok) {
      setHidden([]);
      setStale([]);
      return;
    }
    const data = (await response.json()) as { columns: FieldData[] };
    const visibleSet = new Set(visibleKey.split('\u0000'));
    setHidden(
      data.columns.filter(
        (column) => !column.stale && !visibleSet.has(column.column) && column.value !== ''
      )
    );
    setStale(data.columns.filter((column) => column.stale && column.value !== ''));
  }, [table, recordId, visibleKey]);

  const loadedRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!showStaleData || loadedRef.current === load) {
      return;
    }
    loadedRef.current = load;
    fireAndForget(load());
  }, [showStaleData, load]);

  if (!showStaleData || (hidden.length === 0 && stale.length === 0)) {
    return null;
  }

  const clear = (column: string): void => {
    setPending({
      label: 'Clear',
      description: 'Permanently clear this backed-up data? This cannot be undone.',
      run: () => {
        fireAndForget(
          clearStale(table, column).then((ok) => {
            if (ok) {
              fireAndForget(load());
            }
          })
        );
      },
    });
  };

  const deleteRecord = (): void => {
    if (recordId === null) {
      return;
    }
    setPending({
      label: 'Delete stale data',
      description: 'Permanently delete all backed-up data for this record? This cannot be undone.',
      run: () => {
        fireAndForget(
          deleteStaleRecord(table, recordId).then((ok) => {
            if (ok) {
              fireAndForget(load());
            }
          })
        );
      },
    });
  };

  const total = hidden.length + stale.length;

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground ui-control-ghost transition-colors"
      >
        <Archive className="h-3.5 w-3.5 ui-warning-text" />
        <span>{'Stale & hidden data'}</span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
          {total}
        </span>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="mt-3 flex max-h-[28rem] flex-col gap-3 overflow-y-auto pr-1">
          {hidden.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <EyeOff className="h-4 w-4 text-muted-foreground" />
                <h3 className="ui-display text-sm font-semibold tracking-tight text-foreground">
                  {'Hidden fields'}
                </h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {'Stored data not shown on this record. Only visible to admins.'}
              </p>
              <div className="mt-4 flex flex-col gap-2.5">
                {hidden.map((field) => (
                  <ReadonlyField key={field.column} field={field} />
                ))}
              </div>
            </section>
          )}
          {stale.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Archive className="h-4 w-4 ui-warning-text" />
                    <h3 className="ui-display text-sm font-semibold tracking-tight text-foreground">
                      {'Stale data'}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {
                      'Backed-up values from fields that were removed or changed. Only visible to admins.'
                    }
                  </p>
                </div>
                {recordId !== null && (
                  <button
                    type="button"
                    onClick={deleteRecord}
                    className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground ui-control-ghost ui-control-danger-soft transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {'Delete stale data'}
                  </button>
                )}
              </div>
              <div className="mt-4 flex flex-col gap-2.5">
                {stale.map((field) => (
                  <StaleField
                    key={field.column}
                    field={field}
                    onClear={() => {
                      clear(field.column);
                    }}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
      <RemovalDialog
        pending={pending}
        onClose={() => {
          setPending(null);
        }}
      />
    </div>
  );
}

export function StaleDataView(): JSX.Element | null {
  const { isAdmin } = usePermissions();
  const [tables, setTables] = useState<StaleOverviewTable[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<StaleTableData>({ columns: [], rows: [] });
  const [pending, setPending] = useState<PendingRemoval | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const response = await fetch(`${apiBaseUrl}/api/admin/stale-data`, { credentials: 'include' });
    if (!response.ok) {
      setTables([]);
      return;
    }
    const data = (await response.json()) as { tables: StaleOverviewTable[] };
    setTables(data.tables);
  }, []);

  const loadDetail = useCallback(async (tableName: string): Promise<void> => {
    const response = await fetch(
      `${apiBaseUrl}/api/admin/stale-data/${encodeURIComponent(tableName)}`,
      { credentials: 'include' }
    );
    if (!response.ok) {
      setDetail({ columns: [], rows: [] });
      return;
    }
    const data = (await response.json()) as StaleTableData;
    setDetail(data);
  }, []);

  const loadedRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!isAdmin || loadedRef.current === load) {
      return;
    }
    loadedRef.current = load;
    fireAndForget(load());
  }, [isAdmin, load]);

  if (!isAdmin) {
    return null;
  }

  const toggle = (table: string): void => {
    if (expanded === table) {
      setExpanded(null);
      setDetail({ columns: [], rows: [] });
      return;
    }
    setExpanded(table);
    fireAndForget(loadDetail(table));
  };

  const clearColumn = (table: string, column: string): void => {
    setPending({
      label: 'Clear',
      description: 'Permanently clear this backed-up data? This cannot be undone.',
      run: () => {
        fireAndForget(
          clearStale(table, column).then((ok) => {
            if (ok) {
              fireAndForget(load());
              if (expanded === table) {
                fireAndForget(loadDetail(table));
              }
            }
          })
        );
      },
    });
  };

  const clearTable = (table: string): void => {
    setPending({
      label: 'Clear all',
      description:
        'Permanently delete all leftover data in this deleted resource? This cannot be undone.',
      run: () => {
        fireAndForget(
          clearStale(table, null).then((ok) => {
            if (ok) {
              setExpanded(null);
              fireAndForget(load());
            }
          })
        );
      },
    });
  };

  const deleteRow = (table: string, id: string): void => {
    setPending({
      label: 'Clear',
      description: 'Permanently delete this record? This cannot be undone.',
      run: () => {
        fireAndForget(
          deleteStaleRecord(table, id).then((ok) => {
            if (ok) {
              fireAndForget(load());
              fireAndForget(loadDetail(table));
            }
          })
        );
      },
    });
  };

  return (
    <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 xl:py-10">
      <RemovalDialog
        pending={pending}
        onClose={() => {
          setPending(null);
        }}
      />
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2.5">
          <Archive className="h-5 w-5 ui-warning-text" />
          <h1 className="ui-display text-2xl font-semibold tracking-tight" data-ls="3caea0a2d5">
            {'Stale data'}
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {'Leftover data from removed fields and deleted resources. Only visible to admins.'}
        </p>
        {tables.length === 0 ? (
          <p className="mt-10 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            {'No stale data.'}
          </p>
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            {tables.map((entry) => (
              <div
                key={entry.table}
                className="rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="ui-display text-base font-semibold tracking-tight text-foreground">
                        {entry.label}
                      </h2>
                      {entry.orphan && (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive-text">
                          {'deleted'}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entry.rowCount} {'records'}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {entry.rowCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          toggle(entry.table);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground ui-control-ghost transition-colors"
                      >
                        {expanded === entry.table ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                        {'Inspect'}
                      </button>
                    )}
                    {entry.orphan && (
                      <button
                        type="button"
                        onClick={() => {
                          clearTable(entry.table);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground ui-control-ghost ui-control-danger-soft transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {'Clear all'}
                      </button>
                    )}
                  </div>
                </div>
                {entry.columns.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {'Removed fields'}
                    </p>
                    <div className="mt-2 flex flex-col gap-2">
                      {entry.columns.map((column) => (
                        <div
                          key={column.column}
                          className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background px-4 py-2.5"
                        >
                          <span className="text-sm text-foreground">{column.label}</span>
                          <button
                            type="button"
                            onClick={() => {
                              clearColumn(entry.table, column.column);
                            }}
                            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground ui-control-ghost ui-control-danger-soft transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {'Clear'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {expanded === entry.table && (
                  <div className="mt-4 border-t border-border/60 pt-4">
                    {detail.rows.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{'No records.'}</p>
                    ) : (
                      <div className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1">
                        {detail.rows.map((row) => (
                          <div
                            key={row.id}
                            className="rounded-xl border border-border/60 bg-background px-4 py-3"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {row.id}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  deleteRow(entry.table, row.id);
                                }}
                                className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground ui-control-ghost ui-control-danger-soft transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {'Clear'}
                              </button>
                            </div>
                            <dl className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                              {detail.columns.map((column) => (
                                <div key={column.column} className="min-w-0">
                                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    {column.label}
                                  </dt>
                                  <dd className="break-words font-mono text-xs text-foreground">
                                    {row.values[column.column] || '—'}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
