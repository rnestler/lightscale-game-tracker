import { i18n } from '../i18n/text';
import type { JSX } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { FormulaLines, type FormulaLine } from './FormulaLines';

interface Helper {
  name: string;
  title: string;
  steps: FormulaLine[];
}
interface Calculation {
  lines: FormulaLine[];
  note: string;
  anchor: string;
  helpers: Helper[];
}

function calculations(): Partial<Record<string, Calculation>> {
  return {
    'Match.title': {
      lines: [
        {
          head: '',
          operator: false,
          parts: [
            { text: i18n.word('Match.title'), name: true },
            { text: i18n.word("' ='"), name: false },
          ],
          level: 0,
        },
        {
          head: '',
          operator: false,
          parts: [
            { text: i18n.word("'\"\\{'"), name: false },
            { text: i18n.word('Match.game'), name: true },
            { text: i18n.word("' ↳ '"), name: false },
            { text: i18n.word('GameType.displayName'), name: true },
            { text: i18n.word("'\\}: \\{'"), name: false },
            { text: i18n.word('Match.playerOne'), name: true },
            { text: i18n.word("' ↳ '"), name: false },
            { text: i18n.word('Player.nickname'), name: true },
            { text: i18n.word("'\\} vs \\{'"), name: false },
            { text: i18n.word('Match.playerTwo'), name: true },
            { text: i18n.word("' ↳ '"), name: false },
            { text: i18n.word('Player.nickname'), name: true },
            { text: i18n.word("'\\}\"'"), name: false },
          ],
          level: 1,
        },
      ],
      note: i18n.fill(i18n.chrome.calculationNote, {
        fields: [
          `${i18n.word('Match.game')}${i18n.word("' ↳ '")}${i18n.word('GameType.displayName')}`,
          `${i18n.word('Match.playerOne')}${i18n.word("' ↳ '")}${i18n.word('Player.nickname')}`,
          `${i18n.word('Match.playerTwo')}${i18n.word("' ↳ '")}${i18n.word('Player.nickname')}`,
        ].join(', '),
      }),
      anchor: '0f04ccc836',
      helpers: [],
    },
    'Match.gameDisplayName': {
      lines: [
        {
          head: '',
          operator: false,
          parts: [
            { text: i18n.word('Match.gameDisplayName'), name: true },
            { text: i18n.word("' = '"), name: false },
            { text: i18n.word('Match.game'), name: true },
            { text: i18n.word("' ↳ '"), name: false },
            { text: i18n.word('GameType.displayName'), name: true },
          ],
          level: 0,
        },
      ],
      note: i18n.fill(i18n.chrome.calculationNote, {
        fields: [
          `${i18n.word('Match.game')}${i18n.word("' ↳ '")}${i18n.word('GameType.displayName')}`,
        ].join(', '),
      }),
      anchor: 'f073c574c2',
      helpers: [],
    },
    'LeaderboardEntry.playerNickname': {
      lines: [
        {
          head: '',
          operator: false,
          parts: [
            { text: i18n.word('LeaderboardEntry.playerNickname'), name: true },
            { text: i18n.word("' = '"), name: false },
            { text: i18n.word('LeaderboardEntry.player'), name: true },
            { text: i18n.word("' ↳ '"), name: false },
            { text: i18n.word('Player.nickname'), name: true },
          ],
          level: 0,
        },
      ],
      note: i18n.fill(i18n.chrome.calculationNote, {
        fields: [
          `${i18n.word('LeaderboardEntry.player')}${i18n.word("' ↳ '")}${i18n.word('Player.nickname')}`,
        ].join(', '),
      }),
      anchor: '947e44f631',
      helpers: [],
    },
    'GameType.displayName': {
      lines: [
        {
          head: '',
          operator: false,
          parts: [
            { text: i18n.word('GameType.displayName'), name: true },
            { text: i18n.word("' = \"\\{'"), name: false },
            { text: i18n.word('GameType.name'), name: true },
            { text: i18n.word("'\\} (\\{'"), name: false },
            { text: i18n.word('GameType.rulesVariant'), name: true },
            { text: i18n.word("'\\})\"'"), name: false },
          ],
          level: 0,
        },
      ],
      note: i18n.fill(i18n.chrome.calculationNote, {
        fields: [`${i18n.word('GameType.name')}`, `${i18n.word('GameType.rulesVariant')}`].join(
          ', '
        ),
      }),
      anchor: '2867822a57',
      helpers: [],
    },
    'GameType.leaderboard': {
      lines: [
        {
          head: '',
          operator: false,
          parts: [
            { text: i18n.word('GameType.leaderboard'), name: true },
            { text: i18n.word("' = '"), name: false },
            { text: i18n.word('leaderboards'), name: true },
            { text: i18n.word("' where '"), name: false },
            { text: i18n.word('LeaderboardEntry.game'), name: true },
            { text: i18n.word("' = this game'"), name: false },
          ],
          level: 0,
        },
      ],
      note: i18n.fill(i18n.chrome.calculationNote, {
        fields: [`${i18n.word('leaderboards')}`].join(', '),
      }),
      anchor: '32418ad075',
      helpers: [],
    },
  };
}

export function CalculatedMark({ id }: { id: string }): JSX.Element {
  const calculation = calculations()[id];
  if (calculation === undefined) {
    throw new Error(`Unknown calculation ${id}`);
  }
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={i18n.chrome.calculatedMarkLabel}
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
            {i18n.chrome.calculatedLabel}
          </p>
          <div data-ls={calculation.anchor} className="mt-2 text-sm leading-relaxed">
            <FormulaLines lines={calculation.lines} />
          </div>
          {calculation.helpers.map((helper) => (
            <div
              key={helper.name}
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
