import { i18n } from '../i18n/text';
import { useState, type JSX } from 'react';
import { useGames } from '../hooks/useGames';
import { useLeaderboards } from '../hooks/useLeaderboards';
import { usePlayers } from '../hooks/usePlayers';
import { useAvailability } from '../hooks/useAvailability';
import { Input } from './ui/input';
import { FormField, FormDateTimePicker, FormSelect } from './ui/form-field';
import { usePermissions } from '../hooks/usePermissions';
import { GameTypeEditDialog } from './GameTypeEditDialog';
import { PlayerEditDialog } from './PlayerEditDialog';
import { refusalFieldErrors, runWithToast } from '../utils/errorHandling';
import type * as $Domain from '../types/domain';
import { Loader2Icon } from 'lucide-react';
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
  const { games, isInitializing: gamesInitializing, createGameType } = useGames({ autoLoad: open });
  const { reloadLeaderboards, createLeaderboardEntry, updateLeaderboardEntry } = useLeaderboards({
    autoLoad: false,
  });
  const {
    players,
    isInitializing: playersInitializing,
    createPlayer,
  } = usePlayers({ autoLoad: open });
  const canSubmitEditLeaderboardEntry = editing
    ? (permissions?.['leaderboards']?.update ?? false)
    : (permissions?.['leaderboards']?.create ?? false);
  const [editLeaderboardEntryPlayer$, setEditLeaderboardEntryPlayer$] = useState(
    defaults.playerId ?? ''
  );
  const [editLeaderboardEntryGame$, setEditLeaderboardEntryGame$] = useState(defaults.gameId ?? '');
  const [editLeaderboardEntryRating$, setEditLeaderboardEntryRating$] = useState(
    defaults.rating !== undefined ? String(defaults.rating) : '1200'
  );
  const [editLeaderboardEntryMatchesPlayed$, setEditLeaderboardEntryMatchesPlayed$] = useState(
    defaults.matchesPlayed !== undefined ? String(defaults.matchesPlayed) : '0'
  );
  const [editLeaderboardEntryWins$, setEditLeaderboardEntryWins$] = useState(
    defaults.wins !== undefined ? String(defaults.wins) : '0'
  );
  const [editLeaderboardEntryLosses$, setEditLeaderboardEntryLosses$] = useState(
    defaults.losses !== undefined ? String(defaults.losses) : '0'
  );
  const [editLeaderboardEntryDraws$, setEditLeaderboardEntryDraws$] = useState(
    defaults.draws !== undefined ? String(defaults.draws) : '0'
  );
  const [editLeaderboardEntryLastPlayedAt$, setEditLeaderboardEntryLastPlayedAt$] = useState(
    defaults.lastPlayedAt ?? new Date().toISOString()
  );
  const availability = useAvailability({
    resource: 'leaderboards',
    rules: [['playerId', 'gameId']],
    values: { playerId: editLeaderboardEntryPlayer$, gameId: editLeaderboardEntryGame$ },
    domains: {},
    excludeId: editing?.id ?? null,
  });
  const [editLeaderboardEntryPlayer$CreateOpen, setEditLeaderboardEntryPlayer$CreateOpen] =
    useState(false);
  const [editLeaderboardEntryGame$CreateOpen, setEditLeaderboardEntryGame$CreateOpen] =
    useState(false);
  const [editLeaderboardEntryErrors, setEditLeaderboardEntryErrors] = useState<FormErrors>({});
  const [editLeaderboardEntrySeededId, setEditLeaderboardEntrySeededId] = useState<string | null>(
    null
  );
  const editLeaderboardEntrySeedKey = open ? (editing?.id ?? 'new') : null;
  if (editLeaderboardEntrySeededId !== editLeaderboardEntrySeedKey) {
    setEditLeaderboardEntrySeededId(editLeaderboardEntrySeedKey);
    if (editLeaderboardEntrySeedKey !== null) {
      setEditLeaderboardEntryPlayer$(editing ? editing.playerId : (defaults.playerId ?? ''));
      setEditLeaderboardEntryGame$(editing ? editing.gameId : (defaults.gameId ?? ''));
      setEditLeaderboardEntryRating$(
        editing
          ? String(editing.rating)
          : defaults.rating !== undefined
            ? String(defaults.rating)
            : '1200'
      );
      setEditLeaderboardEntryMatchesPlayed$(
        editing
          ? String(editing.matchesPlayed)
          : defaults.matchesPlayed !== undefined
            ? String(defaults.matchesPlayed)
            : '0'
      );
      setEditLeaderboardEntryWins$(
        editing ? String(editing.wins) : defaults.wins !== undefined ? String(defaults.wins) : '0'
      );
      setEditLeaderboardEntryLosses$(
        editing
          ? String(editing.losses)
          : defaults.losses !== undefined
            ? String(defaults.losses)
            : '0'
      );
      setEditLeaderboardEntryDraws$(
        editing
          ? String(editing.draws)
          : defaults.draws !== undefined
            ? String(defaults.draws)
            : '0'
      );
      setEditLeaderboardEntryLastPlayedAt$(
        editing ? editing.lastPlayedAt : (defaults.lastPlayedAt ?? new Date().toISOString())
      );
      setEditLeaderboardEntryErrors({});
    }
  }
  async function submitEditLeaderboardEntry(): Promise<void> {
    const newErrors: FormErrors = {};
    if (!editLeaderboardEntryPlayer$.trim()) {
      newErrors.player = i18n.fill(i18n.chrome.fieldRequired, {
        label: i18n.word('LeaderboardEntry.player'),
      });
    }
    if (!editLeaderboardEntryGame$.trim()) {
      newErrors.game = i18n.fill(i18n.chrome.fieldRequired, {
        label: i18n.word('LeaderboardEntry.game'),
      });
    }
    setEditLeaderboardEntryErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    try {
      const draft = {
        playerId: editLeaderboardEntryPlayer$,
        gameId: editLeaderboardEntryGame$,
        rating:
          editLeaderboardEntryRating$.trim() === ''
            ? 0
            : Math.trunc(parseFloat(editLeaderboardEntryRating$)),
        matchesPlayed:
          editLeaderboardEntryMatchesPlayed$.trim() === ''
            ? 0
            : Math.trunc(parseFloat(editLeaderboardEntryMatchesPlayed$)),
        wins:
          editLeaderboardEntryWins$.trim() === ''
            ? 0
            : Math.trunc(parseFloat(editLeaderboardEntryWins$)),
        losses:
          editLeaderboardEntryLosses$.trim() === ''
            ? 0
            : Math.trunc(parseFloat(editLeaderboardEntryLosses$)),
        draws:
          editLeaderboardEntryDraws$.trim() === ''
            ? 0
            : Math.trunc(parseFloat(editLeaderboardEntryDraws$)),
        lastPlayedAt: editLeaderboardEntryLastPlayedAt$,
      };
      if (onSave) {
        await onSave(draft);
      } else if (editing) {
        await updateLeaderboardEntry({ ...editing, ...draft });
        toast(i18n.chrome.itemSaved);
      } else {
        await createLeaderboardEntry(draft);
        toast(i18n.fill(i18n.chrome.itemCreated, { name: i18n.word('LeaderboardEntry') }));
      }
      if (!onSave) {
        await reloadLeaderboards();
      }
      if (onSaved) {
        onSaved();
      }
      onClose();
      setEditLeaderboardEntryErrors({});
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
        throw error;
      }
      setEditLeaderboardEntryErrors(fieldErrors);
    }
  }
  if (gamesInitializing || playersInitializing) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing
                ? i18n.fill(i18n.chrome.editLabel, { name: i18n.word('LeaderboardEntry') })
                : i18n.fill(i18n.chrome.newLabel, { name: i18n.word('LeaderboardEntry') })}
            </DialogTitle>
            <DialogDescription>
              {i18n.fill(i18n.chrome.editDescription, { name: i18n.word('LeaderboardEntry') })}
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
              ? i18n.fill(i18n.chrome.editLabel, { name: i18n.word('LeaderboardEntry') })
              : i18n.fill(i18n.chrome.newLabel, { name: i18n.word('LeaderboardEntry') })}
          </DialogTitle>
          <DialogDescription>
            {i18n.fill(i18n.chrome.editDescription, { name: i18n.word('LeaderboardEntry') })}
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
            runWithToast(submitEditLeaderboardEntry());
          }}
        >
          <DialogBody>
            <div className="@container flex flex-col gap-6" data-ls="473b98de18">
              <div className="grid grid-cols-1 gap-6 @md:grid-cols-2">
                <FormField
                  data-ls="c4b3c34cfd"
                  label={i18n.word('LeaderboardEntry.player')}
                  required
                  error={editLeaderboardEntryErrors.player}
                >
                  <FormSelect
                    value={editLeaderboardEntryPlayer$}
                    onChange={(value: string) => {
                      if (value !== editLeaderboardEntryPlayer$) {
                        setEditLeaderboardEntryGame$('');
                      }
                      setEditLeaderboardEntryPlayer$(value);
                    }}
                    options={players.map((playerOption) => ({
                      value: playerOption.id,
                      label: String(playerOption.nickname).trim() || 'Player',
                    }))}
                    placeholder={i18n.fill(i18n.chrome.selectPlaceholder, {
                      name: i18n.word('Player'),
                    })}
                    disabled={availability.locked('playerId')}
                    unavailable={availability.taken('playerId')}
                    onOpen={availability.refresh}
                    currentValue={editing?.playerId}
                    onCreateNew={
                      permissions?.['players']?.create
                        ? (): void => {
                            setEditLeaderboardEntryPlayer$CreateOpen(true);
                          }
                        : undefined
                    }
                    createNewLabel={i18n.fill(i18n.chrome.createNewItem, {
                      name: i18n.word('Player'),
                    })}
                  />
                </FormField>
                <FormField
                  data-ls="db745f60dd"
                  label={i18n.word('LeaderboardEntry.game')}
                  required
                  error={editLeaderboardEntryErrors.game}
                >
                  <FormSelect
                    value={editLeaderboardEntryGame$}
                    onChange={setEditLeaderboardEntryGame$}
                    options={games.map((gameTypeOption) => ({
                      value: gameTypeOption.id,
                      label: String(gameTypeOption.name).trim() || 'GameType',
                    }))}
                    placeholder={i18n.fill(i18n.chrome.selectPlaceholder, {
                      name: i18n.word('GameType'),
                    })}
                    disabled={availability.locked('gameId')}
                    unavailable={availability.taken('gameId')}
                    onOpen={availability.refresh}
                    currentValue={editing?.gameId}
                    onCreateNew={
                      permissions?.['games']?.create
                        ? (): void => {
                            setEditLeaderboardEntryGame$CreateOpen(true);
                          }
                        : undefined
                    }
                    createNewLabel={i18n.fill(i18n.chrome.createNewItem, {
                      name: i18n.word('GameType'),
                    })}
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-1 gap-6 @md:grid-cols-2">
                <FormField
                  data-ls="30e4676e04"
                  label={i18n.word('LeaderboardEntry.rating')}
                  error={editLeaderboardEntryErrors.rating}
                >
                  <Input
                    type="number"
                    step="1"
                    inputMode="numeric"
                    value={editLeaderboardEntryRating$}
                    onChange={(e) => {
                      setEditLeaderboardEntryRating$(e.target.value);
                    }}
                    autoComplete="off"
                  />
                </FormField>
                <FormField
                  data-ls="b391712d5d"
                  label={i18n.word('LeaderboardEntry.matchesPlayed')}
                  error={editLeaderboardEntryErrors.matchesPlayed}
                >
                  <Input
                    type="number"
                    step="1"
                    inputMode="numeric"
                    value={editLeaderboardEntryMatchesPlayed$}
                    onChange={(e) => {
                      setEditLeaderboardEntryMatchesPlayed$(e.target.value);
                    }}
                    autoComplete="off"
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-1 gap-6 @md:grid-cols-3">
                <FormField
                  data-ls="1c9242efb7"
                  label={i18n.word('LeaderboardEntry.wins')}
                  error={editLeaderboardEntryErrors.wins}
                >
                  <Input
                    type="number"
                    step="1"
                    inputMode="numeric"
                    value={editLeaderboardEntryWins$}
                    onChange={(e) => {
                      setEditLeaderboardEntryWins$(e.target.value);
                    }}
                    autoComplete="off"
                  />
                </FormField>
                <FormField
                  data-ls="ce5526379f"
                  label={i18n.word('LeaderboardEntry.losses')}
                  error={editLeaderboardEntryErrors.losses}
                >
                  <Input
                    type="number"
                    step="1"
                    inputMode="numeric"
                    value={editLeaderboardEntryLosses$}
                    onChange={(e) => {
                      setEditLeaderboardEntryLosses$(e.target.value);
                    }}
                    autoComplete="off"
                  />
                </FormField>
                <FormField
                  data-ls="11e27a750c"
                  label={i18n.word('LeaderboardEntry.draws')}
                  error={editLeaderboardEntryErrors.draws}
                >
                  <Input
                    type="number"
                    step="1"
                    inputMode="numeric"
                    value={editLeaderboardEntryDraws$}
                    onChange={(e) => {
                      setEditLeaderboardEntryDraws$(e.target.value);
                    }}
                    autoComplete="off"
                  />
                </FormField>
              </div>
              <FormField
                data-ls="2288be5155"
                label={i18n.word('LeaderboardEntry.lastPlayedAt')}
                error={editLeaderboardEntryErrors.lastPlayedAt}
              >
                <FormDateTimePicker
                  value={editLeaderboardEntryLastPlayedAt$}
                  onChange={setEditLeaderboardEntryLastPlayedAt$}
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
            {canSubmitEditLeaderboardEntry && (
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
                    {i18n.chrome.savingIndicator}
                  </span>
                ) : editing?._sample ? (
                  i18n.chrome.saveAsNormalRecord
                ) : editing ? (
                  i18n.chrome.saveChanges
                ) : (
                  i18n.fill(i18n.chrome.createItem, { name: i18n.word('LeaderboardEntry') })
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
        {editLeaderboardEntryPlayer$CreateOpen && (
          <PlayerEditDialog
            open={editLeaderboardEntryPlayer$CreateOpen}
            editing={null}
            isBusy={false}
            onClose={() => {
              setEditLeaderboardEntryPlayer$CreateOpen(false);
            }}
            onSave={async (data) => {
              const created = await createPlayer(data);
              setEditLeaderboardEntryPlayer$(created.id);
              setEditLeaderboardEntryPlayer$CreateOpen(false);
            }}
          />
        )}
        {editLeaderboardEntryGame$CreateOpen && (
          <GameTypeEditDialog
            open={editLeaderboardEntryGame$CreateOpen}
            editing={null}
            isBusy={false}
            onClose={() => {
              setEditLeaderboardEntryGame$CreateOpen(false);
            }}
            onSave={async (data) => {
              const created = await createGameType(data);
              setEditLeaderboardEntryGame$(created.id);
              setEditLeaderboardEntryGame$CreateOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
