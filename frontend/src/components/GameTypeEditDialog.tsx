import type { JSX } from 'react';
import { useState } from 'react';
import type * as $Domain from '../types/domain';
import { usePermissions, canUpdateField, canCreateField } from '../hooks/usePermissions';
import { useGames } from '../hooks/useGames';
import { toast } from '../utils/toast';

import { getErrorMessage, refusalFieldErrors, runWithToast } from '../utils/errorHandling';
import { textValue } from '../utils/recordValues';
import { Button } from './ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { FormField, FormRichTextEditor } from './ui/form-field';
import { ErrorMessage } from './ui/error-message';
import { ChevronDownIcon, Loader2Icon } from 'lucide-react';

interface GameTypeEditDialogProps {
  open: boolean;
  editing: $Domain.GameType | null;
  isBusy: boolean;
  onClose: () => void;
  onSaved?: () => void;
  defaults?: Partial<{
    name: string;
    category: string;
    rulesVariant: string;
    defaultRating: number;
    description: string;
  }>;
  onSave?: (data: {
    name: string;
    category: string;
    rulesVariant: string;
    defaultRating: number;
    description: string;
  }) => Promise<{ id: string } | void>;
}

type FormErrors = Partial<Record<string, string>>;
const SELECT_OPTION_STYLE = { backgroundColor: 'var(--background)', color: 'var(--foreground)' };

export function GameTypeEditDialog({
  open,
  editing,
  isBusy,
  onClose,
  onSaved,
  onSave,
  defaults = {},
}: GameTypeEditDialogProps): JSX.Element {
  const { permissions } = usePermissions();
  const gamesHook = useGames({ autoLoad: false });
  const [name$, setName$] = useState('');
  const [category$, setCategory$] = useState('chess');
  const [rulesVariant$, setRulesVariant$] = useState('');
  const [defaultRating$, setDefaultRating$] = useState('1200');
  const [description$, setDescription$] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [rootError, setRootError] = useState<string | null>(null);
  const [seededKey, setSeededKey] = useState<string | null>(null);
  const seedKey = open ? (editing?.id ?? 'new') : null;
  if (seededKey !== seedKey) {
    setSeededKey(seedKey);
    if (seedKey !== null && editing) {
      setName$(textValue(editing.name));
      setCategory$(textValue(editing.category));
      setRulesVariant$(textValue(editing.rulesVariant));
      setDefaultRating$(textValue(editing.defaultRating));
      setDescription$(textValue(editing.description));
      setErrors({});
      setRootError(null);
    } else if (seedKey !== null) {
      setName$(defaults.name ?? '');
      setCategory$(defaults.category ?? 'chess');
      setRulesVariant$(defaults.rulesVariant ?? '');
      setDefaultRating$(
        defaults.defaultRating !== undefined ? String(defaults.defaultRating) : '1200'
      );
      setDescription$(defaults.description ?? '');
      setErrors({});
      setRootError(null);
    }
  }
  async function submit(): Promise<void> {
    const newErrors: FormErrors = {};
    if (!name$.trim()) {
      newErrors.name = 'Game Name is required.';
    }
    if (!category$.trim()) {
      newErrors.category = 'Category is required.';
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    const data = {
      name: name$,
      category: category$,
      rulesVariant: rulesVariant$,
      defaultRating: defaultRating$.trim() === '' ? 0 : Math.trunc(parseFloat(defaultRating$)),
      description: description$,
    };
    try {
      if (onSave) {
        await onSave(data);
      } else {
        if (editing) {
          await gamesHook.updateGameType({ id: editing.id, ...data });
        } else {
          await gamesHook.createGameType(data);
        }
        toast(editing !== null ? 'Changes saved.' : 'Game created.');
        await gamesHook.reloadGames();
      }
      if (onSaved) {
        onSaved();
      }
      onClose();
    } catch (error) {
      const fieldErrors = refusalFieldErrors(error, [
        'name',
        'category',
        'rulesVariant',
        'defaultRating',
        'description',
      ]);
      if (fieldErrors === null) {
        setRootError(getErrorMessage(error, 'Save failed'));
      } else {
        setErrors(fieldErrors);
      }
    }
  }
  const selectedLabel = editing ? 'Edit game' : 'New game';
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{selectedLabel}</DialogTitle>
          <DialogDescription>
            Fill in the game details below. Required fields are marked with an asterisk.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            runWithToast(submit());
          }}
        >
          <DialogBody>
            <div data-ls="0a4b39be94" className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2 sm:items-start">
                {(editing ? canUpdateField : canCreateField)(permissions, 'games', 'name') && (
                  <FormField data-ls="285a6dac7c" label="Game Name" required error={errors.name}>
                    <Input
                      type="text"
                      value={name$}
                      onChange={(e) => {
                        setName$(e.target.value);
                      }}
                      autoComplete="off"
                    />
                  </FormField>
                )}
                {(editing ? canUpdateField : canCreateField)(permissions, 'games', 'category') && (
                  <FormField data-ls="30ec169544" label="Category" required error={errors.category}>
                    <div className="relative">
                      <select
                        value={category$}
                        onChange={(e) => {
                          setCategory$(e.target.value);
                        }}
                        className={`flex h-10 w-full rounded-md border border-input bg-transparent pl-3 pr-9 py-2 text-sm ring-offset-background hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${category$ === '' ? 'text-muted-foreground' : 'text-foreground'}`}
                      >
                        <option value="" disabled hidden style={SELECT_OPTION_STYLE}>
                          Select category...
                        </option>
                        <option value="chess" style={SELECT_OPTION_STYLE}>
                          Chess &amp; Variants
                        </option>
                        <option value="billiards" style={SELECT_OPTION_STYLE}>
                          Billiards / Pool
                        </option>
                        <option value="tableTennis" style={SELECT_OPTION_STYLE}>
                          Table Tennis
                        </option>
                        <option value="darts" style={SELECT_OPTION_STYLE}>
                          Darts
                        </option>
                        <option value="boardGames" style={SELECT_OPTION_STYLE}>
                          Board Games
                        </option>
                        <option value="cardGames" style={SELECT_OPTION_STYLE}>
                          Card Games
                        </option>
                        <option value="custom" style={SELECT_OPTION_STYLE}>
                          Custom / Other
                        </option>
                      </select>
                      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </FormField>
                )}
              </div>
              <div className="grid gap-6 sm:grid-cols-2 sm:items-start">
                {(editing ? canUpdateField : canCreateField)(
                  permissions,
                  'games',
                  'rulesVariant'
                ) && (
                  <FormField
                    data-ls="8095e212ec"
                    label="Variant / Ruleset"
                    error={errors.rulesVariant}
                  >
                    <Input
                      type="text"
                      value={rulesVariant$}
                      onChange={(e) => {
                        setRulesVariant$(e.target.value);
                      }}
                      autoComplete="off"
                    />
                  </FormField>
                )}
                {(editing ? canUpdateField : canCreateField)(
                  permissions,
                  'games',
                  'defaultRating'
                ) && (
                  <FormField
                    data-ls="ac7d048665"
                    label="Starting Rating (Default 1200)"
                    error={errors.defaultRating}
                  >
                    <Input
                      type="number"
                      step="1"
                      inputMode="numeric"
                      value={defaultRating$}
                      onChange={(e) => {
                        setDefaultRating$(e.target.value);
                      }}
                      autoComplete="off"
                    />
                  </FormField>
                )}
              </div>
              {(editing ? canUpdateField : canCreateField)(permissions, 'games', 'description') && (
                <FormField
                  data-ls="7c3d9b930c"
                  label="Overview &amp; Rules"
                  error={errors.description}
                >
                  <FormRichTextEditor value={description$} onChange={setDescription$} />
                </FormField>
              )}
              {rootError !== null && <ErrorMessage message={rootError} />}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="rounded-md h-10 px-4 text-sm"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              data-ls="30778e7559"
              variant="default"
              disabled={isBusy}
              className="rounded-md shadow-sm h-10 px-4 text-sm"
            >
              {isBusy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  {'Saving...'}
                </span>
              ) : editing ? (
                'Save changes'
              ) : (
                'Create game'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
