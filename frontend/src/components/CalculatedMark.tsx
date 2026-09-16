import type { JSX } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { FormulaLines, type FormulaLine } from './FormulaLines';

interface Helper {
  title: string;
  steps: FormulaLine[];
}
interface Calculation {
  lines: FormulaLine[];
  note: string;
  anchor: string;
  helpers: Helper[];
}

const CALCULATIONS: Partial<Record<string, Calculation>> = {
  'Match.title': {
    lines: [
      {
        head: '',
        operator: false,
        parts: [
          { text: 'Match Matchup', name: true },
          { text: ' =', name: false },
        ],
        level: 0,
      },
      {
        head: '',
        operator: false,
        parts: [
          { text: '"{', name: false },
          { text: 'Game', name: true },
          { text: ' ↳ ', name: false },
          { text: 'Display Name', name: true },
          { text: '}: {', name: false },
          { text: 'Player 1', name: true },
          { text: ' ↳ ', name: false },
          { text: 'Nickname / Handle', name: true },
          { text: '} vs {', name: false },
          { text: 'Player 2', name: true },
          { text: ' ↳ ', name: false },
          { text: 'Nickname / Handle', name: true },
          { text: '}"', name: false },
        ],
        level: 1,
      },
    ],
    note: 'Recalculated from Game ↳ Display Name, Player 1 ↳ Nickname / Handle, Player 2 ↳ Nickname / Handle. Cannot be typed in.',
    anchor: '0f04ccc836',
    helpers: [],
  },
  'Match.gameDisplayName': {
    lines: [
      {
        head: '',
        operator: false,
        parts: [
          { text: 'Game Display Name', name: true },
          { text: ' = ', name: false },
          { text: 'Game', name: true },
          { text: ' ↳ ', name: false },
          { text: 'Display Name', name: true },
        ],
        level: 0,
      },
    ],
    note: 'Recalculated from Game ↳ Display Name. Cannot be typed in.',
    anchor: 'f073c574c2',
    helpers: [],
  },
  'LeaderboardEntry.playerNickname': {
    lines: [
      {
        head: '',
        operator: false,
        parts: [
          { text: 'Player Nickname', name: true },
          { text: ' = ', name: false },
          { text: 'Player', name: true },
          { text: ' ↳ ', name: false },
          { text: 'Nickname / Handle', name: true },
        ],
        level: 0,
      },
    ],
    note: 'Recalculated from Player ↳ Nickname / Handle. Cannot be typed in.',
    anchor: '947e44f631',
    helpers: [],
  },
  'GameType.displayName': {
    lines: [
      {
        head: '',
        operator: false,
        parts: [
          { text: 'Display Name', name: true },
          { text: ' = "{', name: false },
          { text: 'Game Name', name: true },
          { text: '} ({', name: false },
          { text: 'Variant / Ruleset', name: true },
          { text: '})"', name: false },
        ],
        level: 0,
      },
    ],
    note: 'Recalculated from Game Name, Variant / Ruleset. Cannot be typed in.',
    anchor: '2867822a57',
    helpers: [],
  },
  'GameType.leaderboard': {
    lines: [
      {
        head: '',
        operator: false,
        parts: [
          { text: 'Game Leaderboard', name: true },
          { text: ' = ', name: false },
          { text: 'Leaderboards', name: true },
          { text: ' where ', name: false },
          { text: 'Game', name: true },
          { text: ' = this game', name: false },
        ],
        level: 0,
      },
    ],
    note: 'Recalculated from Leaderboards. Cannot be typed in.',
    anchor: '32418ad075',
    helpers: [],
  },
};

export function CalculatedMark({ id }: { id: string }): JSX.Element {
  const calculation = CALCULATIONS[id];
  if (calculation === undefined) {
    throw new Error(`Unknown calculation ${id}`);
  }
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="Show calculation"
          className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded border border-border bg-background align-middle text-[10px] italic leading-none text-muted-foreground hover:text-foreground"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          ƒ
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          sideOffset={6}
          align="start"
          collisionPadding={16}
          className="z-50 w-[40rem] max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-md"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Calculated
          </p>
          <div data-ls={calculation.anchor} className="mt-2 text-sm leading-relaxed">
            <FormulaLines lines={calculation.lines} />
          </div>
          {calculation.helpers.map((helper) => (
            <div
              key={helper.title}
              className="mt-3 border-t border-border pt-3 text-sm leading-relaxed"
            >
              <p className="mb-1 font-medium">{helper.title}</p>
              <FormulaLines lines={helper.steps} />
            </div>
          ))}
          <p className="mt-3 text-xs text-muted-foreground">{calculation.note}</p>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
