import type { JSX } from 'react';
import { useState } from 'react';
import type * as $Domain from '../types/domain';
import { usePermissions, canUpdateField, canCreateField } from '../hooks/usePermissions';
import { useMatches } from '../hooks/useMatches';
import { useGames } from '../hooks/useGames';
import { usePlayers } from '../hooks/usePlayers';
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
import { FormField, FormSelect, FormDateTimePicker, FormRichTextEditor } from './ui/form-field';
import { ErrorMessage } from './ui/error-message';
import { GameTypeEditDialog } from './GameTypeEditDialog';
import { PlayerEditDialog } from './PlayerEditDialog';
import { ChevronDownIcon, Loader2Icon } from 'lucide-react';

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

type FormErrors = Partial<Record<string, string>>;
const SELECT_OPTION_STYLE = { backgroundColor: 'var(--background)', color: 'var(--foreground)' };

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
  const matchesHook = useMatches({ autoLoad: false });
  const { games, createGameType, isBusy: isBusyGameType } = useGames();
  const { players, createPlayer, isBusy: isBusyPlayer } = usePlayers();
  const [game$, setGame$] = useState('');
  const [scheduledAt$, setScheduledAt$] = useState(new Date().toISOString());
  const [playerOne$, setPlayerOne$] = useState('');
  const [playerTwo$, setPlayerTwo$] = useState('');
  const [status$, setStatus$] = useState('scheduled');
  const [outcome$, setOutcome$] = useState('playerOneWin');
  const [notes$, setNotes$] = useState('');
  const [game$CreateOpen, setGame$CreateOpen] = useState(false);
  const [playerOne$CreateOpen, setPlayerOne$CreateOpen] = useState(false);
  const [playerTwo$CreateOpen, setPlayerTwo$CreateOpen] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [rootError, setRootError] = useState<string | null>(null);
  const [seededKey, setSeededKey] = useState<string | null>(null);
  const seedKey = open ? (editing?.id ?? 'new') : null;
  if (seededKey !== seedKey) {
    setSeededKey(seedKey);
    if (seedKey !== null && editing) {
      setGame$(textValue(editing.gameId));
      setScheduledAt$(textValue(editing.scheduledAt));
      setPlayerOne$(textValue(editing.playerOneId));
      setPlayerTwo$(textValue(editing.playerTwoId));
      setStatus$(textValue(editing.status));
      setOutcome$(textValue(editing.outcome));
      setNotes$(textValue(editing.notes));
      setErrors({});
      setRootError(null);
    } else if (seedKey !== null) {
      setGame$(defaults.gameId ?? '');
      setScheduledAt$(defaults.scheduledAt ?? new Date().toISOString());
      setPlayerOne$(defaults.playerOneId ?? '');
      setPlayerTwo$(defaults.playerTwoId ?? '');
      setStatus$(defaults.status ?? 'scheduled');
      setOutcome$(defaults.outcome ?? 'playerOneWin');
      setNotes$(defaults.notes ?? '');
      setErrors({});
      setRootError(null);
    }
  }
  async function submit(): Promise<void> {
    const newErrors: FormErrors = {};
    if (!game$.trim()) {
      newErrors.game = 'Game is required.';
    }
    if (!scheduledAt$.trim()) {
      newErrors.scheduledAt = 'Date & Time is required.';
    }
    if (!playerOne$.trim()) {
      newErrors.playerOne = 'Player 1 is required.';
    }
    if (!playerTwo$.trim()) {
      newErrors.playerTwo = 'Player 2 is required.';
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    const data = {
      gameId: game$,
      scheduledAt: scheduledAt$,
      playerOneId: playerOne$,
      playerTwoId: playerTwo$,
      status: status$,
      outcome: outcome$,
      notes: notes$,
    };
    try {
      if (onSave) {
        await onSave(data);
      } else {
        if (editing) {
          await matchesHook.updateMatch({ id: editing.id, ...data });
        } else {
          await matchesHook.createMatch(data);
        }
        toast(editing !== null ? 'Changes saved.' : 'Match created.');
        await matchesHook.reloadMatches();
      }
      if (onSaved) {
        onSaved();
      }
      onClose();
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
        setRootError(getErrorMessage(error, 'Save failed'));
      } else {
        setErrors(fieldErrors);
      }
    }
  }
  const selectedLabel = editing ? 'Edit match' : 'New match';
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{selectedLabel}</DialogTitle>
          <DialogDescription>
            Fill in the match details below. Required fields are marked with an asterisk.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            runWithToast(submit());
          }}
        >
          <DialogBody>
            <div data-ls="a015ebf2e5" className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2 sm:items-start">
                {(editing ? canUpdateField : canCreateField)(permissions, 'matches', 'gameId') && (
                  <FormField data-ls="622ba8e006" label="Game" required error={errors.game}>
                    <FormSelect
                      value={game$}
                      onChange={setGame$}
                      options={games.map((gameTypeOption) => ({
                        value: gameTypeOption.id,
                        label: String(gameTypeOption.name).trim() || 'GameType',
                      }))}
                      placeholder="Select game..."
                      onCreateNew={
                        permissions?.['games']?.create
                          ? (): void => {
                              setGame$CreateOpen(true);
                            }
                          : undefined
                      }
                      createNewLabel="+ Create new game"
                    />
                  </FormField>
                )}
                {(editing ? canUpdateField : canCreateField)(
                  permissions,
                  'matches',
                  'scheduledAt'
                ) && (
                  <FormField
                    data-ls="839fdcad42"
                    label="Date &amp; Time"
                    required
                    error={errors.scheduledAt}
                  >
                    <FormDateTimePicker value={scheduledAt$} onChange={setScheduledAt$} />
                  </FormField>
                )}
              </div>
              <div className="grid gap-6 sm:grid-cols-2 sm:items-start">
                {(editing ? canUpdateField : canCreateField)(
                  permissions,
                  'matches',
                  'playerOneId'
                ) && (
                  <FormField
                    data-ls="4f99c48650"
                    label="Player 1"
                    required
                    error={errors.playerOne}
                  >
                    <FormSelect
                      value={playerOne$}
                      onChange={setPlayerOne$}
                      options={players.map((playerOption) => ({
                        value: playerOption.id,
                        label: String(playerOption.nickname).trim() || 'Player',
                      }))}
                      placeholder="Select player..."
                      onCreateNew={
                        permissions?.['players']?.create
                          ? (): void => {
                              setPlayerOne$CreateOpen(true);
                            }
                          : undefined
                      }
                      createNewLabel="+ Create new player"
                    />
                  </FormField>
                )}
                {(editing ? canUpdateField : canCreateField)(
                  permissions,
                  'matches',
                  'playerTwoId'
                ) && (
                  <FormField
                    data-ls="e57526bdac"
                    label="Player 2"
                    required
                    error={errors.playerTwo}
                  >
                    <FormSelect
                      value={playerTwo$}
                      onChange={setPlayerTwo$}
                      options={players.map((playerOption) => ({
                        value: playerOption.id,
                        label: String(playerOption.nickname).trim() || 'Player',
                      }))}
                      placeholder="Select player..."
                      onCreateNew={
                        permissions?.['players']?.create
                          ? (): void => {
                              setPlayerTwo$CreateOpen(true);
                            }
                          : undefined
                      }
                      createNewLabel="+ Create new player"
                    />
                  </FormField>
                )}
              </div>
              <div className="grid gap-6 sm:grid-cols-2 sm:items-start">
                {(editing ? canUpdateField : canCreateField)(permissions, 'matches', 'status') && (
                  <FormField data-ls="37cc2ba2e2" label="Status" error={errors.status}>
                    <div className="relative">
                      <select
                        value={status$}
                        onChange={(e) => {
                          setStatus$(e.target.value);
                        }}
                        className={`flex h-10 w-full rounded-md border border-input bg-transparent pl-3 pr-9 py-2 text-sm ring-offset-background hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${status$ === '' ? 'text-muted-foreground' : 'text-foreground'}`}
                      >
                        <option value="" style={SELECT_OPTION_STYLE}>
                          Select status...
                        </option>
                        <option value="scheduled" style={SELECT_OPTION_STYLE}>
                          Scheduled
                        </option>
                        <option value="inProgress" style={SELECT_OPTION_STYLE}>
                          In Progress
                        </option>
                        <option value="completed" style={SELECT_OPTION_STYLE}>
                          Completed
                        </option>
                        <option value="disputed" style={SELECT_OPTION_STYLE}>
                          Disputed
                        </option>
                        <option value="cancelled" style={SELECT_OPTION_STYLE}>
                          Cancelled
                        </option>
                      </select>
                      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </FormField>
                )}
                {(editing ? canUpdateField : canCreateField)(permissions, 'matches', 'outcome') && (
                  <FormField data-ls="08b00ff0fb" label="Outcome" error={errors.outcome}>
                    <div className="relative">
                      <select
                        value={outcome$}
                        onChange={(e) => {
                          setOutcome$(e.target.value);
                        }}
                        className={`flex h-10 w-full rounded-md border border-input bg-transparent pl-3 pr-9 py-2 text-sm ring-offset-background hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${outcome$ === '' ? 'text-muted-foreground' : 'text-foreground'}`}
                      >
                        <option value="" style={SELECT_OPTION_STYLE}>
                          Select outcome...
                        </option>
                        <option value="playerOneWin" style={SELECT_OPTION_STYLE}>
                          Player 1 Victory
                        </option>
                        <option value="playerTwoWin" style={SELECT_OPTION_STYLE}>
                          Player 2 Victory
                        </option>
                        <option value="draw" style={SELECT_OPTION_STYLE}>
                          Draw
                        </option>
                      </select>
                      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </FormField>
                )}
              </div>
              {(editing ? canUpdateField : canCreateField)(permissions, 'matches', 'notes') && (
                <FormField data-ls="26411d7f69" label="Match Notes" error={errors.notes}>
                  <FormRichTextEditor value={notes$} onChange={setNotes$} />
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
              data-ls="f01e28e274"
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
                'Create match'
              )}
            </Button>
          </DialogFooter>
        </form>
        {game$CreateOpen && (
          <GameTypeEditDialog
            open={game$CreateOpen}
            editing={null}
            isBusy={isBusyGameType}
            onClose={() => {
              setGame$CreateOpen(false);
            }}
            onSave={async (data) => {
              const created = await createGameType(data);
              setGame$(created.id);
              setGame$CreateOpen(false);
            }}
          />
        )}
        {playerOne$CreateOpen && (
          <PlayerEditDialog
            open={playerOne$CreateOpen}
            editing={null}
            isBusy={isBusyPlayer}
            onClose={() => {
              setPlayerOne$CreateOpen(false);
            }}
            onSave={async (data) => {
              const created = await createPlayer(data);
              setPlayerOne$(created.id);
              setPlayerOne$CreateOpen(false);
            }}
          />
        )}
        {playerTwo$CreateOpen && (
          <PlayerEditDialog
            open={playerTwo$CreateOpen}
            editing={null}
            isBusy={isBusyPlayer}
            onClose={() => {
              setPlayerTwo$CreateOpen(false);
            }}
            onSave={async (data) => {
              const created = await createPlayer(data);
              setPlayerTwo$(created.id);
              setPlayerTwo$CreateOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
