import { i18n } from '../i18n/text';
import { useState, type JSX } from 'react';
import { useGames } from '../hooks/useGames';
import { useMatches } from '../hooks/useMatches';
import { usePlayers } from '../hooks/usePlayers';
import { FormField, FormDateTimePicker, FormRichTextEditor, FormSelect } from './ui/form-field';
import { usePermissions } from '../hooks/usePermissions';
import { GameTypeEditDialog } from './GameTypeEditDialog';
import { PlayerEditDialog } from './PlayerEditDialog';
import { refusalFieldErrors, runWithToast } from '../utils/errorHandling';
import type * as $Domain from '../types/domain';
import { ChevronDownIcon, Loader2Icon } from 'lucide-react';
import { toast } from '../utils/toast';
import { Skeleton } from './ui/skeleton';
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
interface MatchEditDialogProps {
  open: boolean;
  editing: $Domain.Match | null;
  isBusy: boolean;
  onClose: () => void;
  onSaved?: () => void;
  defaults?: Partial<{
    gameId: string;
    scheduledAt: string;
    playerOneId: string;
    playerTwoId: string;
    status: string;
    outcome: string;
    notes: string;
  }>;
  onSave?: (data: {
    gameId: string;
    scheduledAt: string;
    playerOneId: string;
    playerTwoId: string;
    status: string;
    outcome: string;
    notes: string;
  }) => Promise<{ id: string } | void>;
}

export function MatchEditDialog({
  open,
  editing,
  isBusy,
  onClose,
  onSaved,
  onSave,
  defaults = {},
}: MatchEditDialogProps): JSX.Element {
  const { permissions } = usePermissions();
  const { games, isInitializing: gamesInitializing, createGameType } = useGames({ autoLoad: open });
  const { reloadMatches, createMatch, updateMatch } = useMatches({ autoLoad: false });
  const {
    players,
    isInitializing: playersInitializing,
    createPlayer,
  } = usePlayers({ autoLoad: open });
  const canSubmitEditMatch = editing
    ? (permissions?.['matches']?.update ?? false)
    : (permissions?.['matches']?.create ?? false);
  const [editMatchGame$, setEditMatchGame$] = useState(defaults.gameId ?? '');
  const [editMatchScheduledAt$, setEditMatchScheduledAt$] = useState(
    defaults.scheduledAt ?? new Date().toISOString()
  );
  const [editMatchPlayerOne$, setEditMatchPlayerOne$] = useState(defaults.playerOneId ?? '');
  const [editMatchPlayerTwo$, setEditMatchPlayerTwo$] = useState(defaults.playerTwoId ?? '');
  const [editMatchStatus$, setEditMatchStatus$] = useState(defaults.status ?? 'scheduled');
  const [editMatchOutcome$, setEditMatchOutcome$] = useState(defaults.outcome ?? 'playerOneWin');
  const [editMatchNotes$, setEditMatchNotes$] = useState(defaults.notes ?? '');
  const [editMatchGame$CreateOpen, setEditMatchGame$CreateOpen] = useState(false);
  const [editMatchPlayerOne$CreateOpen, setEditMatchPlayerOne$CreateOpen] = useState(false);
  const [editMatchPlayerTwo$CreateOpen, setEditMatchPlayerTwo$CreateOpen] = useState(false);
  const [editMatchErrors, setEditMatchErrors] = useState<FormErrors>({});
  const [editMatchSeededId, setEditMatchSeededId] = useState<string | null>(null);
  const editMatchSeedKey = open ? (editing?.id ?? 'new') : null;
  if (editMatchSeededId !== editMatchSeedKey) {
    setEditMatchSeededId(editMatchSeedKey);
    if (editMatchSeedKey !== null) {
      setEditMatchGame$(editing ? editing.gameId : (defaults.gameId ?? ''));
      setEditMatchScheduledAt$(
        editing ? editing.scheduledAt : (defaults.scheduledAt ?? new Date().toISOString())
      );
      setEditMatchPlayerOne$(editing ? editing.playerOneId : (defaults.playerOneId ?? ''));
      setEditMatchPlayerTwo$(editing ? editing.playerTwoId : (defaults.playerTwoId ?? ''));
      setEditMatchStatus$(editing ? editing.status : (defaults.status ?? 'scheduled'));
      setEditMatchOutcome$(editing ? editing.outcome : (defaults.outcome ?? 'playerOneWin'));
      setEditMatchNotes$(editing ? editing.notes : (defaults.notes ?? ''));
      setEditMatchErrors({});
    }
  }
  async function submitEditMatch(): Promise<void> {
    const newErrors: FormErrors = {};
    if (!editMatchGame$.trim()) {
      newErrors.game = i18n.fill(i18n.chrome.fieldRequired, { label: i18n.word('Match.game') });
    }
    if (!editMatchScheduledAt$.trim()) {
      newErrors.scheduledAt = i18n.fill(i18n.chrome.fieldRequired, {
        label: i18n.word('Match.scheduledAt'),
      });
    }
    if (!editMatchPlayerOne$.trim()) {
      newErrors.playerOne = i18n.fill(i18n.chrome.fieldRequired, {
        label: i18n.word('Match.playerOne'),
      });
    }
    if (!editMatchPlayerTwo$.trim()) {
      newErrors.playerTwo = i18n.fill(i18n.chrome.fieldRequired, {
        label: i18n.word('Match.playerTwo'),
      });
    }
    setEditMatchErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    try {
      const draft = {
        gameId: editMatchGame$,
        scheduledAt: editMatchScheduledAt$,
        playerOneId: editMatchPlayerOne$,
        playerTwoId: editMatchPlayerTwo$,
        status: editMatchStatus$,
        outcome: editMatchOutcome$,
        notes: editMatchNotes$,
      };
      if (onSave) {
        await onSave(draft);
      } else if (editing) {
        await updateMatch({ ...editing, ...draft });
        toast(i18n.chrome.itemSaved);
      } else {
        await createMatch(draft);
        toast(i18n.fill(i18n.chrome.itemCreated, { name: i18n.word('Match') }));
      }
      if (!onSave) {
        await reloadMatches();
      }
      if (onSaved) {
        onSaved();
      }
      onClose();
      setEditMatchErrors({});
    } catch (error) {
      const fieldErrors = refusalFieldErrors(error, [
        'game',
        'scheduledAt',
        'playerOne',
        'playerTwo',
        'status',
        'outcome',
        'notes',
      ]);
      if (fieldErrors === null) {
        throw error;
      }
      setEditMatchErrors(fieldErrors);
    }
  }
  if (gamesInitializing || playersInitializing) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing
                ? i18n.fill(i18n.chrome.editLabel, { name: i18n.word('Match') })
                : i18n.fill(i18n.chrome.newLabel, { name: i18n.word('Match') })}
            </DialogTitle>
            <DialogDescription>
              {i18n.fill(i18n.chrome.editDescription, { name: i18n.word('Match') })}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div
              role="status"
              aria-label={i18n.chrome.loading}
              className="rounded-xl border border-border bg-card p-4 space-y-3"
            >
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing
              ? i18n.fill(i18n.chrome.editLabel, { name: i18n.word('Match') })
              : i18n.fill(i18n.chrome.newLabel, { name: i18n.word('Match') })}
          </DialogTitle>
          <DialogDescription>
            {i18n.fill(i18n.chrome.editDescription, { name: i18n.word('Match') })}
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
            runWithToast(submitEditMatch());
          }}
        >
          <DialogBody>
            <div className="@container flex flex-col gap-6" data-ls="a015ebf2e5">
              <div className="grid grid-cols-1 gap-6 @md:grid-cols-2">
                <FormField
                  data-ls="622ba8e006"
                  label={i18n.word('Match.game')}
                  required
                  error={editMatchErrors.game}
                >
                  <FormSelect
                    value={editMatchGame$}
                    onChange={setEditMatchGame$}
                    options={games.map((gameTypeOption) => ({
                      value: gameTypeOption.id,
                      label: String(gameTypeOption.name).trim() || 'GameType',
                    }))}
                    placeholder={i18n.fill(i18n.chrome.selectPlaceholder, {
                      name: i18n.word('GameType'),
                    })}
                    onCreateNew={
                      permissions?.['games']?.create
                        ? (): void => {
                            setEditMatchGame$CreateOpen(true);
                          }
                        : undefined
                    }
                    createNewLabel={i18n.fill(i18n.chrome.createNewItem, {
                      name: i18n.word('GameType'),
                    })}
                  />
                </FormField>
                <FormField
                  data-ls="839fdcad42"
                  label={i18n.word('Match.scheduledAt')}
                  required
                  error={editMatchErrors.scheduledAt}
                >
                  <FormDateTimePicker
                    value={editMatchScheduledAt$}
                    onChange={setEditMatchScheduledAt$}
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-1 gap-6 @md:grid-cols-2">
                <FormField
                  data-ls="4f99c48650"
                  label={i18n.word('Match.playerOne')}
                  required
                  error={editMatchErrors.playerOne}
                >
                  <FormSelect
                    value={editMatchPlayerOne$}
                    onChange={setEditMatchPlayerOne$}
                    options={players.map((playerOption) => ({
                      value: playerOption.id,
                      label: String(playerOption.nickname).trim() || 'Player',
                    }))}
                    placeholder={i18n.fill(i18n.chrome.selectPlaceholder, {
                      name: i18n.word('Player'),
                    })}
                    onCreateNew={
                      permissions?.['players']?.create
                        ? (): void => {
                            setEditMatchPlayerOne$CreateOpen(true);
                          }
                        : undefined
                    }
                    createNewLabel={i18n.fill(i18n.chrome.createNewItem, {
                      name: i18n.word('Player'),
                    })}
                  />
                </FormField>
                <FormField
                  data-ls="e57526bdac"
                  label={i18n.word('Match.playerTwo')}
                  required
                  error={editMatchErrors.playerTwo}
                >
                  <FormSelect
                    value={editMatchPlayerTwo$}
                    onChange={setEditMatchPlayerTwo$}
                    options={players.map((playerOption) => ({
                      value: playerOption.id,
                      label: String(playerOption.nickname).trim() || 'Player',
                    }))}
                    placeholder={i18n.fill(i18n.chrome.selectPlaceholder, {
                      name: i18n.word('Player'),
                    })}
                    onCreateNew={
                      permissions?.['players']?.create
                        ? (): void => {
                            setEditMatchPlayerTwo$CreateOpen(true);
                          }
                        : undefined
                    }
                    createNewLabel={i18n.fill(i18n.chrome.createNewItem, {
                      name: i18n.word('Player'),
                    })}
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-1 gap-6 @md:grid-cols-2">
                <FormField
                  data-ls="37cc2ba2e2"
                  label={i18n.word('Match.status')}
                  error={editMatchErrors.status}
                >
                  <div className="relative">
                    <select
                      value={editMatchStatus$}
                      onChange={(e) => {
                        setEditMatchStatus$(e.target.value);
                      }}
                      className={`flex h-10 w-full min-w-0 rounded-md border border-input bg-transparent pl-3 pr-9 py-2 text-sm ring-offset-background hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${editMatchStatus$ === '' ? 'text-muted-foreground' : 'text-foreground'}`}
                    >
                      <option value="" style={SELECT_OPTION_STYLE}>
                        {i18n.fill(i18n.chrome.selectPlaceholder, {
                          name: i18n.word('Match.status'),
                        })}
                      </option>
                      <option value="scheduled" style={SELECT_OPTION_STYLE}>
                        {i18n.word("'Scheduled'")}
                      </option>
                      <option value="inProgress" style={SELECT_OPTION_STYLE}>
                        {i18n.word("'In Progress'")}
                      </option>
                      <option value="completed" style={SELECT_OPTION_STYLE}>
                        {i18n.word("'Completed'")}
                      </option>
                      <option value="disputed" style={SELECT_OPTION_STYLE}>
                        {i18n.word("'Disputed'")}
                      </option>
                      <option value="cancelled" style={SELECT_OPTION_STYLE}>
                        {i18n.word("'Cancelled'")}
                      </option>
                    </select>
                    <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </FormField>
                <FormField
                  data-ls="08b00ff0fb"
                  label={i18n.word('Match.outcome')}
                  error={editMatchErrors.outcome}
                >
                  <div className="relative">
                    <select
                      value={editMatchOutcome$}
                      onChange={(e) => {
                        setEditMatchOutcome$(e.target.value);
                      }}
                      className={`flex h-10 w-full min-w-0 rounded-md border border-input bg-transparent pl-3 pr-9 py-2 text-sm ring-offset-background hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${editMatchOutcome$ === '' ? 'text-muted-foreground' : 'text-foreground'}`}
                    >
                      <option value="" style={SELECT_OPTION_STYLE}>
                        {i18n.fill(i18n.chrome.selectPlaceholder, {
                          name: i18n.word('Match.outcome'),
                        })}
                      </option>
                      <option value="playerOneWin" style={SELECT_OPTION_STYLE}>
                        {i18n.word("'Player 1 Victory'")}
                      </option>
                      <option value="playerTwoWin" style={SELECT_OPTION_STYLE}>
                        {i18n.word("'Player 2 Victory'")}
                      </option>
                      <option value="draw" style={SELECT_OPTION_STYLE}>
                        {i18n.word("'Draw'")}
                      </option>
                    </select>
                    <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </FormField>
              </div>
              <FormField
                data-ls="26411d7f69"
                label={i18n.word('Match.notes')}
                error={editMatchErrors.notes}
              >
                <FormRichTextEditor value={editMatchNotes$} onChange={setEditMatchNotes$} />
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
            {canSubmitEditMatch && (
              <Button
                type="submit"
                data-ls="f01e28e274"
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
                  i18n.fill(i18n.chrome.createItem, { name: i18n.word('Match') })
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
        {editMatchGame$CreateOpen && (
          <GameTypeEditDialog
            open={editMatchGame$CreateOpen}
            editing={null}
            isBusy={false}
            onClose={() => {
              setEditMatchGame$CreateOpen(false);
            }}
            onSave={async (data) => {
              const created = await createGameType(data);
              setEditMatchGame$(created.id);
              setEditMatchGame$CreateOpen(false);
            }}
          />
        )}
        {editMatchPlayerOne$CreateOpen && (
          <PlayerEditDialog
            open={editMatchPlayerOne$CreateOpen}
            editing={null}
            isBusy={false}
            onClose={() => {
              setEditMatchPlayerOne$CreateOpen(false);
            }}
            onSave={async (data) => {
              const created = await createPlayer(data);
              setEditMatchPlayerOne$(created.id);
              setEditMatchPlayerOne$CreateOpen(false);
            }}
          />
        )}
        {editMatchPlayerTwo$CreateOpen && (
          <PlayerEditDialog
            open={editMatchPlayerTwo$CreateOpen}
            editing={null}
            isBusy={false}
            onClose={() => {
              setEditMatchPlayerTwo$CreateOpen(false);
            }}
            onSave={async (data) => {
              const created = await createPlayer(data);
              setEditMatchPlayerTwo$(created.id);
              setEditMatchPlayerTwo$CreateOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
