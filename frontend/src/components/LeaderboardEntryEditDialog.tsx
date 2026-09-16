import type { JSX } from 'react';
import { useState } from 'react';
import type * as $Domain from '../types/domain';
import { usePermissions, canUpdateField, canCreateField } from '../hooks/usePermissions';
import { useLeaderboards } from '../hooks/useLeaderboards';
import { usePlayers } from '../hooks/usePlayers';
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
import { FormField, FormSelect, FormDateTimePicker } from './ui/form-field';
import { useAvailability } from '../hooks/useAvailability';
import { ErrorMessage } from './ui/error-message';
import { PlayerEditDialog } from './PlayerEditDialog';
import { GameTypeEditDialog } from './GameTypeEditDialog';
import { Loader2Icon } from 'lucide-react';

interface LeaderboardEntryEditDialogProps {
  open: boolean;
  editing: $Domain.LeaderboardEntry | null;
  isBusy: boolean;
  onClose: () => void;
  onSaved?: () => void;
  defaults?: Partial<{
    playerId: string;
    gameId: string;
    rating: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    lastPlayedAt: string;
  }>;
  onSave?: (data: {
    playerId: string;
    gameId: string;
    rating: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    lastPlayedAt: string;
  }) => Promise<{ id: string } | void>;
}

type FormErrors = Partial<Record<string, string>>;

export function LeaderboardEntryEditDialog({
  open,
  editing,
  isBusy,
  onClose,
  onSaved,
  onSave,
  defaults = {},
}: LeaderboardEntryEditDialogProps): JSX.Element {
  const { permissions } = usePermissions();
  const leaderboardsHook = useLeaderboards({ autoLoad: false });
  const { players, createPlayer, isBusy: isBusyPlayer } = usePlayers();
  const { games, createGameType, isBusy: isBusyGameType } = useGames();
  const [player$, setPlayer$] = useState('');
  const [game$, setGame$] = useState('');
  const [rating$, setRating$] = useState('1200');
  const [matchesPlayed$, setMatchesPlayed$] = useState('0');
  const [wins$, setWins$] = useState('0');
  const [losses$, setLosses$] = useState('0');
  const [draws$, setDraws$] = useState('0');
  const [lastPlayedAt$, setLastPlayedAt$] = useState(new Date().toISOString());
  const [player$CreateOpen, setPlayer$CreateOpen] = useState(false);
  const [game$CreateOpen, setGame$CreateOpen] = useState(false);
  const availability = useAvailability({
    resource: 'leaderboards',
    rules: [['playerId', 'gameId']],
    values: { playerId: player$, gameId: game$ },
    domains: {},
    excludeId: editing !== null ? editing.id : null,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [rootError, setRootError] = useState<string | null>(null);
  const [seededKey, setSeededKey] = useState<string | null>(null);
  const seedKey = open ? (editing?.id ?? 'new') : null;
  if (seededKey !== seedKey) {
    setSeededKey(seedKey);
    if (seedKey !== null && editing) {
      setPlayer$(textValue(editing.playerId));
      setGame$(textValue(editing.gameId));
      setRating$(textValue(editing.rating));
      setMatchesPlayed$(textValue(editing.matchesPlayed));
      setWins$(textValue(editing.wins));
      setLosses$(textValue(editing.losses));
      setDraws$(textValue(editing.draws));
      setLastPlayedAt$(textValue(editing.lastPlayedAt));
      setErrors({});
      setRootError(null);
    } else if (seedKey !== null) {
      setPlayer$(defaults.playerId ?? '');
      setGame$(defaults.gameId ?? '');
      setRating$(defaults.rating !== undefined ? String(defaults.rating) : '1200');
      setMatchesPlayed$(
        defaults.matchesPlayed !== undefined ? String(defaults.matchesPlayed) : '0'
      );
      setWins$(defaults.wins !== undefined ? String(defaults.wins) : '0');
      setLosses$(defaults.losses !== undefined ? String(defaults.losses) : '0');
      setDraws$(defaults.draws !== undefined ? String(defaults.draws) : '0');
      setLastPlayedAt$(defaults.lastPlayedAt ?? new Date().toISOString());
      setErrors({});
      setRootError(null);
    }
  }
  async function submit(): Promise<void> {
    const newErrors: FormErrors = {};
    if (!player$.trim()) {
      newErrors.player = 'Player is required.';
    }
    if (!game$.trim()) {
      newErrors.game = 'Game is required.';
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    const data = {
      playerId: player$,
      gameId: game$,
      rating: rating$.trim() === '' ? 0 : Math.trunc(parseFloat(rating$)),
      matchesPlayed: matchesPlayed$.trim() === '' ? 0 : Math.trunc(parseFloat(matchesPlayed$)),
      wins: wins$.trim() === '' ? 0 : Math.trunc(parseFloat(wins$)),
      losses: losses$.trim() === '' ? 0 : Math.trunc(parseFloat(losses$)),
      draws: draws$.trim() === '' ? 0 : Math.trunc(parseFloat(draws$)),
      lastPlayedAt: lastPlayedAt$,
    };
    try {
      if (onSave) {
        await onSave(data);
      } else {
        if (editing) {
          await leaderboardsHook.updateLeaderboardEntry({ id: editing.id, ...data });
        } else {
          await leaderboardsHook.createLeaderboardEntry(data);
        }
        toast(editing !== null ? 'Changes saved.' : 'Leaderboard Entry created.');
        await leaderboardsHook.reloadLeaderboards();
      }
      if (onSaved) {
        onSaved();
      }
      onClose();
    } catch (error) {
      const fieldErrors = refusalFieldErrors(error, [
        'player',
        'game',
        'rating',
        'matchesPlayed',
        'wins',
        'losses',
        'draws',
        'lastPlayedAt',
      ]);
      if (fieldErrors === null) {
        setRootError(getErrorMessage(error, 'Save failed'));
      } else {
        setErrors(fieldErrors);
      }
    }
  }
  const selectedLabel = editing ? 'Edit leaderboard entry' : 'New leaderboard entry';
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{selectedLabel}</DialogTitle>
          <DialogDescription>
            Fill in the leaderboard entry details below. Required fields are marked with an
            asterisk.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            runWithToast(submit());
          }}
        >
          <DialogBody>
            <div data-ls="473b98de18" className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2 sm:items-start">
                {(editing ? canUpdateField : canCreateField)(
                  permissions,
                  'leaderboards',
                  'playerId'
                ) && (
                  <FormField data-ls="c4b3c34cfd" label="Player" required error={errors.player}>
                    <FormSelect
                      value={player$}
                      onChange={(value: string) => {
                        if (value !== player$) {
                          setGame$('');
                        }
                        setPlayer$(value);
                      }}
                      options={players.map((playerOption) => ({
                        value: playerOption.id,
                        label: String(playerOption.nickname).trim() || 'Player',
                      }))}
                      placeholder="Select player..."
                      disabled={availability.locked('playerId')}
                      unavailable={availability.taken('playerId')}
                      onOpen={availability.refresh}
                      currentValue={editing?.playerId}
                      onCreateNew={
                        permissions?.['players']?.create
                          ? (): void => {
                              setPlayer$CreateOpen(true);
                            }
                          : undefined
                      }
                      createNewLabel="+ Create new player"
                    />
                  </FormField>
                )}
                {(editing ? canUpdateField : canCreateField)(
                  permissions,
                  'leaderboards',
                  'gameId'
                ) && (
                  <FormField data-ls="db745f60dd" label="Game" required error={errors.game}>
                    <FormSelect
                      value={game$}
                      onChange={setGame$}
                      options={games.map((gameTypeOption) => ({
                        value: gameTypeOption.id,
                        label: String(gameTypeOption.name).trim() || 'GameType',
                      }))}
                      placeholder="Select game..."
                      disabled={availability.locked('gameId')}
                      unavailable={availability.taken('gameId')}
                      onOpen={availability.refresh}
                      currentValue={editing?.gameId}
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
              </div>
              <div className="grid gap-6 sm:grid-cols-2 sm:items-start">
                {(editing ? canUpdateField : canCreateField)(
                  permissions,
                  'leaderboards',
                  'rating'
                ) && (
                  <FormField data-ls="30e4676e04" label="Current Rating" error={errors.rating}>
                    <Input
                      type="number"
                      step="1"
                      inputMode="numeric"
                      value={rating$}
                      onChange={(e) => {
                        setRating$(e.target.value);
                      }}
                      autoComplete="off"
                    />
                  </FormField>
                )}
                {(editing ? canUpdateField : canCreateField)(
                  permissions,
                  'leaderboards',
                  'matchesPlayed'
                ) && (
                  <FormField
                    data-ls="b391712d5d"
                    label="Matches Played"
                    error={errors.matchesPlayed}
                  >
                    <Input
                      type="number"
                      step="1"
                      inputMode="numeric"
                      value={matchesPlayed$}
                      onChange={(e) => {
                        setMatchesPlayed$(e.target.value);
                      }}
                      autoComplete="off"
                    />
                  </FormField>
                )}
              </div>
              <div className="grid gap-6 sm:grid-cols-3 sm:items-start">
                {(editing ? canUpdateField : canCreateField)(
                  permissions,
                  'leaderboards',
                  'wins'
                ) && (
                  <FormField data-ls="1c9242efb7" label="Wins" error={errors.wins}>
                    <Input
                      type="number"
                      step="1"
                      inputMode="numeric"
                      value={wins$}
                      onChange={(e) => {
                        setWins$(e.target.value);
                      }}
                      autoComplete="off"
                    />
                  </FormField>
                )}
                {(editing ? canUpdateField : canCreateField)(
                  permissions,
                  'leaderboards',
                  'losses'
                ) && (
                  <FormField data-ls="ce5526379f" label="Losses" error={errors.losses}>
                    <Input
                      type="number"
                      step="1"
                      inputMode="numeric"
                      value={losses$}
                      onChange={(e) => {
                        setLosses$(e.target.value);
                      }}
                      autoComplete="off"
                    />
                  </FormField>
                )}
                {(editing ? canUpdateField : canCreateField)(
                  permissions,
                  'leaderboards',
                  'draws'
                ) && (
                  <FormField data-ls="11e27a750c" label="Draws" error={errors.draws}>
                    <Input
                      type="number"
                      step="1"
                      inputMode="numeric"
                      value={draws$}
                      onChange={(e) => {
                        setDraws$(e.target.value);
                      }}
                      autoComplete="off"
                    />
                  </FormField>
                )}
              </div>
              {(editing ? canUpdateField : canCreateField)(
                permissions,
                'leaderboards',
                'lastPlayedAt'
              ) && (
                <FormField data-ls="2288be5155" label="Last Activity" error={errors.lastPlayedAt}>
                  <FormDateTimePicker value={lastPlayedAt$} onChange={setLastPlayedAt$} />
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
              data-ls="10348e84da"
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
                'Create leaderboard entry'
              )}
            </Button>
          </DialogFooter>
        </form>
        {player$CreateOpen && (
          <PlayerEditDialog
            open={player$CreateOpen}
            editing={null}
            isBusy={isBusyPlayer}
            onClose={() => {
              setPlayer$CreateOpen(false);
            }}
            onSave={async (data) => {
              const created = await createPlayer(data);
              setPlayer$(created.id);
              setPlayer$CreateOpen(false);
            }}
          />
        )}
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
      </DialogContent>
    </Dialog>
  );
}
