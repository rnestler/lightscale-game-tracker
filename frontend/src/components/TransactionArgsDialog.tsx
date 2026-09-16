// Generated with Lightscale AI. This file belongs to the owner of the generated application. See LICENSE.
import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { FormUserSelect } from './ui/form-field';
import { fireAndForget } from '../utils/errorHandling';

export interface ArgSelectOption {
  value: string;
  label: string;
}

export type ArgFieldSpec =
  | { kind: 'number'; name: string; label: string; decimal: boolean }
  | { kind: 'text'; name: string; label: string }
  | { kind: 'textarea'; name: string; label: string }
  | { kind: 'boolean'; name: string; label: string }
  | { kind: 'date'; name: string; label: string }
  | { kind: 'datetime'; name: string; label: string }
  | { kind: 'user'; name: string; label: string }
  | {
      kind: 'select';
      name: string;
      label: string;
      options: ArgSelectOption[];
      placeholder: string;
    };

interface TransactionArgsDialogProps {
  open: boolean;
  title: string;
  submitLabel: string;
  cancelLabel: string;
  isBusy: boolean;
  fields: ArgFieldSpec[];
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (values: Record<string, string | boolean>) => void | Promise<void>;
}

function initialValues(fields: ArgFieldSpec[]): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = {};
  for (const field of fields) {
    values[field.name] = field.kind === 'boolean' ? false : '';
  }
  return values;
}

function hasMissingValue(
  fields: ArgFieldSpec[],
  values: Record<string, string | boolean>
): boolean {
  return fields.some((field) => {
    if (field.kind === 'boolean') {
      return false;
    }
    return String(values[field.name]).trim() === '';
  });
}

export function pickedRecord<Row extends { id: string }>(rows: readonly Row[], id: string): Row {
  const picked = rows.find((row) => row.id === id);
  if (picked === undefined) {
    throw new Error(`The picked record '${id}' is no longer loaded`);
  }
  return picked;
}

export function TransactionArgsDialog({
  open,
  title,
  submitLabel,
  cancelLabel,
  isBusy,
  fields,
  errorMessage,
  onClose,
  onSubmit,
}: TransactionArgsDialogProps): JSX.Element {
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    initialValues(fields)
  );
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setValues(initialValues(fields));
    }
    wasOpenRef.current = open;
  });

  function setValue(name: string, value: string | boolean): void {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(): void {
    fireAndForget(onSubmit(values));
  }

  const disabled = isBusy || hasMissingValue(fields, values);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4">
            {fields.map((field) => (
              <div key={field.name} className="flex flex-col gap-1.5">
                {field.kind !== 'boolean' && (
                  <Label htmlFor={field.name} className="flex items-center gap-1">
                    {field.label}
                    <span className="text-destructive-text">*</span>
                  </Label>
                )}
                {field.kind === 'boolean' ? (
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      id={field.name}
                      type="checkbox"
                      checked={values[field.name] === true}
                      onChange={(event) => {
                        setValue(field.name, event.target.checked);
                      }}
                      className="h-4 w-4 rounded border-input"
                    />
                    {field.label}
                  </label>
                ) : field.kind === 'textarea' ? (
                  <Textarea
                    id={field.name}
                    value={String(values[field.name])}
                    onChange={(event) => {
                      setValue(field.name, event.target.value);
                    }}
                  />
                ) : field.kind === 'user' ? (
                  <FormUserSelect
                    value={String(values[field.name])}
                    onChange={(value) => {
                      setValue(field.name, value);
                    }}
                  />
                ) : field.kind === 'select' ? (
                  <select
                    id={field.name}
                    value={String(values[field.name])}
                    onChange={(event) => {
                      setValue(field.name, event.target.value);
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">{field.placeholder}</option>
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={field.name}
                    type={
                      field.kind === 'number'
                        ? 'number'
                        : field.kind === 'date'
                          ? 'date'
                          : field.kind === 'datetime'
                            ? 'datetime-local'
                            : 'text'
                    }
                    step={field.kind === 'number' ? (field.decimal ? 'any' : '1') : undefined}
                    inputMode={
                      field.kind === 'number' ? (field.decimal ? 'decimal' : 'numeric') : undefined
                    }
                    value={String(values[field.name])}
                    onChange={(event) => {
                      setValue(field.name, event.target.value);
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          {errorMessage !== null && (
            <p className="text-sm text-destructive-text pt-2">{errorMessage}</p>
          )}
          <div className="flex justify-end gap-3 pt-6">
            <Button variant="outline" onClick={onClose} className="rounded-md h-10 px-4 text-sm">
              {cancelLabel}
            </Button>
            <Button
              variant="default"
              disabled={disabled}
              onClick={handleSubmit}
              className="rounded-md h-10 px-4 text-sm"
            >
              {submitLabel}
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
