import { i18n } from '../i18n/text';
import { useState, type JSX } from 'react';
import { useGames } from '../hooks/useGames';
import { Input } from './ui/input';
import { FormField, FormRichTextEditor } from './ui/form-field';
import { usePermissions } from '../hooks/usePermissions';
import { refusalFieldErrors, runWithToast } from '../utils/errorHandling';
import type * as $Domain from '../types/domain';
import { ChevronDownIcon, Loader2Icon } from 'lucide-react';
import { toast } from '../utils/toast';
import { Button } from './ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  focusFirstField,
} from './ui/dialog';
type FormErrors = Partial<Record<string, string>>;
const SELECT_OPTION_STYLE = { backgroundColor: 'var(--background)', color: 'var(--foreground)' };
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
  const { reloadGames, createGameType, updateGameType } = useGames({ autoLoad: false });
  const canSubmitEditGameType = editing
    ? (permissions?.['games']?.update ?? false)
    : (permissions?.['games']?.create ?? false);
  const [editGameTypeName$, setEditGameTypeName$] = useState(defaults.name ?? '');
  const [editGameTypeCategory$, setEditGameTypeCategory$] = useState(defaults.category ?? 'chess');
  const [editGameTypeRulesVariant$, setEditGameTypeRulesVariant$] = useState(
    defaults.rulesVariant ?? ''
  );
  const [editGameTypeDefaultRating$, setEditGameTypeDefaultRating$] = useState(
    defaults.defaultRating !== undefined ? String(defaults.defaultRating) : '1200'
  );
  const [editGameTypeDescription$, setEditGameTypeDescription$] = useState(
    defaults.description ?? ''
  );
  const [editGameTypeErrors, setEditGameTypeErrors] = useState<FormErrors>({});
  const [editGameTypeSeededId, setEditGameTypeSeededId] = useState<string | null>(null);
  const editGameTypeSeedKey = open ? (editing?.id ?? 'new') : null;
  if (editGameTypeSeededId !== editGameTypeSeedKey) {
    setEditGameTypeSeededId(editGameTypeSeedKey);
    if (editGameTypeSeedKey !== null) {
      setEditGameTypeName$(editing ? editing.name : (defaults.name ?? ''));
      setEditGameTypeCategory$(editing ? editing.category : (defaults.category ?? 'chess'));
      setEditGameTypeRulesVariant$(editing ? editing.rulesVariant : (defaults.rulesVariant ?? ''));
      setEditGameTypeDefaultRating$(
        editing
          ? String(editing.defaultRating)
          : defaults.defaultRating !== undefined
            ? String(defaults.defaultRating)
            : '1200'
      );
      setEditGameTypeDescription$(editing ? editing.description : (defaults.description ?? ''));
      setEditGameTypeErrors({});
    }
  }
  async function submitEditGameType(): Promise<void> {
    const newErrors: FormErrors = {};
    if (!editGameTypeName$.trim()) {
      newErrors.name = i18n.fill(i18n.chrome.fieldRequired, { label: i18n.word('GameType.name') });
    }
    if (!editGameTypeCategory$.trim()) {
      newErrors.category = i18n.fill(i18n.chrome.fieldRequired, {
        label: i18n.word('GameType.category'),
      });
    }
    setEditGameTypeErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    try {
      const draft = {
        name: editGameTypeName$,
        category: editGameTypeCategory$,
        rulesVariant: editGameTypeRulesVariant$,
        defaultRating:
          editGameTypeDefaultRating$.trim() === ''
            ? 0
            : Math.trunc(parseFloat(editGameTypeDefaultRating$)),
        description: editGameTypeDescription$,
      };
      if (onSave) {
        await onSave(draft);
      } else if (editing) {
        await updateGameType({ ...editing, ...draft });
        toast(i18n.chrome.itemSaved);
      } else {
        await createGameType(draft);
        toast(i18n.fill(i18n.chrome.itemCreated, { name: i18n.word('GameType') }));
      }
      if (!onSave) {
        await reloadGames();
      }
      if (onSaved) {
        onSaved();
      }
      onClose();
      setEditGameTypeErrors({});
    } catch (error) {
      const fieldErrors = refusalFieldErrors(error, [
        'name',
        'category',
        'rulesVariant',
        'defaultRating',
        'description',
      ]);
      if (fieldErrors === null) {
        throw error;
      }
      setEditGameTypeErrors(fieldErrors);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing
              ? i18n.fill(i18n.chrome.editLabel, { name: i18n.word('GameType') })
              : i18n.fill(i18n.chrome.newLabel, { name: i18n.word('GameType') })}
          </DialogTitle>
          <DialogDescription>
            {i18n.fill(i18n.chrome.editDescription, { name: i18n.word('GameType') })}
          </DialogDescription>
        </DialogHeader>
        {editing?._sample && (
          <p role="note" className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
            {i18n.chrome.sampleConversion}
          </p>
        )}
        <form
          ref={focusFirstField}
          className="flex flex-1 flex-col min-h-0"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            submitEvent.stopPropagation();
            runWithToast(submitEditGameType());
          }}
        >
          <DialogBody>
            <div className="@container flex flex-col gap-6" data-ls="0a4b39be94">
              <div className="grid grid-cols-1 gap-6 @md:grid-cols-2">
                <FormField
                  data-ls="285a6dac7c"
                  label={i18n.word('GameType.name')}
                  required
                  error={editGameTypeErrors.name}
                >
                  <Input
                    type="text"
                    value={editGameTypeName$}
                    onChange={(e) => {
                      setEditGameTypeName$(e.target.value);
                    }}
                    autoComplete="off"
                  />
                </FormField>
                <FormField
                  data-ls="30ec169544"
                  label={i18n.word('GameType.category')}
                  required
                  error={editGameTypeErrors.category}
                >
                  <div className="relative">
                    <select
                      value={editGameTypeCategory$}
                      onChange={(e) => {
                        setEditGameTypeCategory$(e.target.value);
                      }}
                      className={`flex h-10 w-full min-w-0 rounded-md border border-input bg-transparent pl-3 pr-9 py-2 text-sm ring-offset-background hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${editGameTypeCategory$ === '' ? 'text-muted-foreground' : 'text-foreground'}`}
                    >
                      <option value="" disabled hidden style={SELECT_OPTION_STYLE}>
                        {i18n.fill(i18n.chrome.selectPlaceholder, {
                          name: i18n.word('GameType.category'),
                        })}
                      </option>
                      <option value="chess" style={SELECT_OPTION_STYLE}>
                        {i18n.word("'Chess & Variants'")}
                      </option>
                      <option value="billiards" style={SELECT_OPTION_STYLE}>
                        {i18n.word("'Billiards / Pool'")}
                      </option>
                      <option value="tableTennis" style={SELECT_OPTION_STYLE}>
                        {i18n.word("'Table Tennis'")}
                      </option>
                      <option value="darts" style={SELECT_OPTION_STYLE}>
                        {i18n.word("'Darts'")}
                      </option>
                      <option value="boardGames" style={SELECT_OPTION_STYLE}>
                        {i18n.word("'Board Games'")}
                      </option>
                      <option value="cardGames" style={SELECT_OPTION_STYLE}>
                        {i18n.word("'Card Games'")}
                      </option>
                      <option value="custom" style={SELECT_OPTION_STYLE}>
                        {i18n.word("'Custom / Other'")}
                      </option>
                    </select>
                    <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </FormField>
              </div>
              <div className="grid grid-cols-1 gap-6 @md:grid-cols-2">
                <FormField
                  data-ls="8095e212ec"
                  label={i18n.word('GameType.rulesVariant')}
                  error={editGameTypeErrors.rulesVariant}
                >
                  <Input
                    type="text"
                    value={editGameTypeRulesVariant$}
                    onChange={(e) => {
                      setEditGameTypeRulesVariant$(e.target.value);
                    }}
                    autoComplete="off"
                  />
                </FormField>
                <FormField
                  data-ls="ac7d048665"
                  label={i18n.word('GameType.defaultRating')}
                  error={editGameTypeErrors.defaultRating}
                >
                  <Input
                    type="number"
                    step="1"
                    inputMode="numeric"
                    value={editGameTypeDefaultRating$}
                    onChange={(e) => {
                      setEditGameTypeDefaultRating$(e.target.value);
                    }}
                    autoComplete="off"
                  />
                </FormField>
              </div>
              <FormField
                data-ls="7c3d9b930c"
                label={i18n.word('GameType.description')}
                error={editGameTypeErrors.description}
              >
                <FormRichTextEditor
                  value={editGameTypeDescription$}
                  onChange={setEditGameTypeDescription$}
                />
              </FormField>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="rounded-md h-10 px-4 text-sm"
            >
              {i18n.chrome.cancel}
            </Button>
            {canSubmitEditGameType && (
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
                    {i18n.chrome.savingIndicator}
                  </span>
                ) : editing?._sample ? (
                  i18n.chrome.saveAsNormalRecord
                ) : editing ? (
                  i18n.chrome.saveChanges
                ) : (
                  i18n.fill(i18n.chrome.createItem, { name: i18n.word('GameType') })
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
