import type { JSX } from 'react';
import { FormulaLines, type FormulaLine } from './FormulaLines';
import { ArrowDown, Cog, Play, Workflow } from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';

type ChipStyle = 'code' | 'action' | 'ai';
interface Chip {
  text: string;
  style: ChipStyle;
}
interface StepPrompt {
  transaction: string;
  index: number;
  reads: string;
}
interface StepEmail {
  name: string;
  label: string;
}
interface ChainStep {
  cause: string;
  icon: string;
  iconClass: string;
  kindLabel: string;
  title: string;
  chips: Chip[];
  steps: FormulaLine[];
  prompts: StepPrompt[];
  emails: StepEmail[];
}
interface Chain {
  title: string;
  threads: ChainStep[][];
}
interface FunctionGroup {
  title: string;
  steps: FormulaLine[];
}
interface CalculationItem {
  key: string;
  lines: FormulaLine[];
  note: string;
  anchor: string;
  helpers: FunctionGroup[];
}
interface CalculationGroup {
  record: string;
  items: CalculationItem[];
}

const CHAINS: Chain[] = [
  {
    title: 'Start Match',
    threads: [
      [
        {
          cause: '',
          icon: 'cog',
          iconClass: 'text-muted-foreground',
          kindLabel: 'Transaction',
          title: 'Start Match',
          chips: [
            { text: 'Start Match', style: 'action' },
            { text: 'updates Match: Status', style: 'code' },
          ],
          steps: [
            {
              head: 'requires',
              operator: false,
              parts: [
                { text: 'Status', name: true },
                { text: ' = Scheduled · "Match must be scheduled to start"', name: false },
              ],
              level: 0,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Status', name: true },
                { text: ' ← In Progress', name: false },
              ],
              level: 0,
            },
          ],
          prompts: [],
          emails: [],
        },
      ],
    ],
  },
  {
    title: 'Dispute Result',
    threads: [
      [
        {
          cause: '',
          icon: 'cog',
          iconClass: 'text-muted-foreground',
          kindLabel: 'Transaction',
          title: 'Dispute Result',
          chips: [
            { text: 'Dispute Result', style: 'action' },
            { text: 'updates Match: Status', style: 'code' },
          ],
          steps: [
            {
              head: 'requires',
              operator: false,
              parts: [
                { text: 'Status', name: true },
                { text: ' = Completed · "Only completed matches can be disputed"', name: false },
              ],
              level: 0,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Status', name: true },
                { text: ' ← Disputed', name: false },
              ],
              level: 0,
            },
          ],
          prompts: [],
          emails: [],
        },
      ],
    ],
  },
  {
    title: 'Cancel Match',
    threads: [
      [
        {
          cause: '',
          icon: 'cog',
          iconClass: 'text-muted-foreground',
          kindLabel: 'Transaction',
          title: 'Cancel Match',
          chips: [
            { text: 'Cancel Match', style: 'action' },
            { text: 'updates Match: Status', style: 'code' },
          ],
          steps: [
            {
              head: 'requires',
              operator: false,
              parts: [
                { text: 'Status', name: true },
                { text: ' = Scheduled or ', name: false },
                { text: 'Status', name: true },
                {
                  text: ' = In Progress · "Only scheduled or in-progress matches can be cancelled"',
                  name: false,
                },
              ],
              level: 0,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Status', name: true },
                { text: ' ← Cancelled', name: false },
              ],
              level: 0,
            },
          ],
          prompts: [],
          emails: [],
        },
      ],
    ],
  },
  {
    title: 'Record & Complete Match',
    threads: [
      [
        {
          cause: '',
          icon: 'cog',
          iconClass: 'text-muted-foreground',
          kindLabel: 'Transaction',
          title: 'Record & Complete Match',
          chips: [
            { text: 'Record & Complete Match', style: 'action' },
            {
              text: 'updates Leaderboard Entry: Current Rating · Matches Played · Wins · Losses · Draws · Last Activity',
              style: 'code',
            },
            { text: 'creates Leaderboard Entry', style: 'code' },
            {
              text: 'updates Match: Status · Outcome · P1 Score · P2 Score · P1 Rating Change · P2 Rating Change',
              style: 'code',
            },
          ],
          steps: [
            {
              head: 'requires',
              operator: false,
              parts: [
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Status', name: true },
                { text: ' = Scheduled or ', name: false },
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Status', name: true },
                {
                  text: ' = In Progress · "Match must be scheduled or in progress to complete"',
                  name: false,
                },
              ],
              level: 0,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'p1Rating', name: true },
                { text: ' ← ', name: false },
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Game', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Starting Rating (Default 1200)', name: true },
              ],
              level: 0,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'p2Rating', name: true },
                { text: ' ← ', name: false },
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Game', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Starting Rating (Default 1200)', name: true },
              ],
              level: 0,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'p1Found', name: true },
                { text: ' ← no', name: false },
              ],
              level: 0,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'p2Found', name: true },
                { text: ' ← no', name: false },
              ],
              level: 0,
            },
            {
              head: 'for each',
              operator: false,
              parts: [
                { text: 'entry', name: true },
                { text: ' of ', name: false },
                { text: 'Leaderboards', name: true },
              ],
              level: 0,
            },
            {
              head: 'if',
              operator: false,
              parts: [
                { text: 'Game', name: true },
                { text: ' = ', name: false },
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Game', name: true },
                { text: ' and ', name: false },
                { text: 'Player', name: true },
                { text: ' = ', name: false },
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Player 1', name: true },
              ],
              level: 1,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'p1Rating', name: true },
                { text: ' ← ', name: false },
                { text: 'Current Rating', name: true },
              ],
              level: 2,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'p1Found', name: true },
                { text: ' ← yes', name: false },
              ],
              level: 2,
            },
            {
              head: 'if',
              operator: false,
              parts: [
                { text: 'Game', name: true },
                { text: ' = ', name: false },
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Game', name: true },
                { text: ' and ', name: false },
                { text: 'Player', name: true },
                { text: ' = ', name: false },
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Player 2', name: true },
              ],
              level: 1,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'p2Rating', name: true },
                { text: ' ← ', name: false },
                { text: 'Current Rating', name: true },
              ],
              level: 2,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'p2Found', name: true },
                { text: ' ← yes', name: false },
              ],
              level: 2,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'delta1', name: true },
                { text: ' ← ', name: false },
                { text: 'Compute rating change', name: true },
                { text: '(', name: false },
                { text: 'p1Rating', name: true },
                { text: ', ', name: false },
                { text: 'p2Rating', name: true },
                { text: ', ', name: false },
                { text: 'Outcome', name: true },
                { text: ')', name: false },
              ],
              level: 0,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'delta2', name: true },
                { text: ' ← 0 − ', name: false },
                { text: 'delta1', name: true },
              ],
              level: 0,
            },
            { head: 'if', operator: false, parts: [{ text: 'p1Found', name: true }], level: 0 },
            {
              head: 'for each',
              operator: false,
              parts: [
                { text: 'entry', name: true },
                { text: ' of ', name: false },
                { text: 'Leaderboards', name: true },
              ],
              level: 1,
            },
            {
              head: 'if',
              operator: false,
              parts: [
                { text: 'Game', name: true },
                { text: ' = ', name: false },
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Game', name: true },
                { text: ' and ', name: false },
                { text: 'Player', name: true },
                { text: ' = ', name: false },
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Player 1', name: true },
              ],
              level: 2,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Current Rating', name: true },
                { text: ' ← ', name: false },
                { text: 'Current Rating', name: true },
                { text: ' + ', name: false },
                { text: 'delta1', name: true },
              ],
              level: 3,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Matches Played', name: true },
                { text: ' ← ', name: false },
                { text: 'Matches Played', name: true },
                { text: ' + 1', name: false },
              ],
              level: 3,
            },
            {
              head: 'if',
              operator: false,
              parts: [
                { text: 'Outcome', name: true },
                { text: ' = Player 1 Victory', name: false },
              ],
              level: 3,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Wins', name: true },
                { text: ' ← ', name: false },
                { text: 'Wins', name: true },
                { text: ' + 1', name: false },
              ],
              level: 4,
            },
            { head: 'otherwise', operator: false, parts: [], level: 3 },
            {
              head: 'if',
              operator: false,
              parts: [
                { text: 'Outcome', name: true },
                { text: ' = Player 2 Victory', name: false },
              ],
              level: 4,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Losses', name: true },
                { text: ' ← ', name: false },
                { text: 'Losses', name: true },
                { text: ' + 1', name: false },
              ],
              level: 5,
            },
            { head: 'otherwise', operator: false, parts: [], level: 4 },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Draws', name: true },
                { text: ' ← ', name: false },
                { text: 'Draws', name: true },
                { text: ' + 1', name: false },
              ],
              level: 5,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Last Activity', name: true },
                { text: ' ← now', name: false },
              ],
              level: 3,
            },
            { head: 'otherwise', operator: false, parts: [], level: 0 },
            {
              head: 'adds',
              operator: false,
              parts: [
                { text: 'Leaderboard Entry', name: true },
                { text: ' (', name: false },
              ],
              level: 1,
            },
            {
              head: '',
              operator: false,
              parts: [
                { text: 'Player', name: true },
                { text: ': ', name: false },
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Player 1', name: true },
                { text: ',', name: false },
              ],
              level: 2,
            },
            {
              head: '',
              operator: false,
              parts: [
                { text: 'Game', name: true },
                { text: ': ', name: false },
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Game', name: true },
                { text: ',', name: false },
              ],
              level: 2,
            },
            {
              head: '',
              operator: false,
              parts: [
                { text: 'Current Rating', name: true },
                { text: ': ', name: false },
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Game', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Starting Rating (Default 1200)', name: true },
                { text: ' + ', name: false },
                { text: 'delta1', name: true },
                { text: ',', name: false },
              ],
              level: 2,
            },
            {
              head: '',
              operator: false,
              parts: [
                { text: 'Matches Played', name: true },
                { text: ': 1,', name: false },
              ],
              level: 2,
            },
            {
              head: '',
              operator: false,
              parts: [
                { text: 'Wins', name: true },
                { text: ': if ', name: false },
                { text: 'Outcome', name: true },
                { text: ' = Player 1 Victory then 1 otherwise 0,', name: false },
              ],
              level: 2,
            },
            {
              head: '',
              operator: false,
              parts: [
                { text: 'Losses', name: true },
                { text: ': if ', name: false },
                { text: 'Outcome', name: true },
                { text: ' = Player 2 Victory then 1 otherwise 0,', name: false },
              ],
              level: 2,
            },
            {
              head: '',
              operator: false,
              parts: [
                { text: 'Draws', name: true },
                { text: ': if ', name: false },
                { text: 'Outcome', name: true },
                { text: ' = Draw then 1 otherwise 0,', name: false },
              ],
              level: 2,
            },
            {
              head: '',
              operator: false,
              parts: [
                { text: 'Last Activity', name: true },
                { text: ': now)', name: false },
              ],
              level: 2,
            },
            { head: 'if', operator: false, parts: [{ text: 'p2Found', name: true }], level: 0 },
            {
              head: 'for each',
              operator: false,
              parts: [
                { text: 'entry', name: true },
                { text: ' of ', name: false },
                { text: 'Leaderboards', name: true },
              ],
              level: 1,
            },
            {
              head: 'if',
              operator: false,
              parts: [
                { text: 'Game', name: true },
                { text: ' = ', name: false },
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Game', name: true },
                { text: ' and ', name: false },
                { text: 'Player', name: true },
                { text: ' = ', name: false },
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Player 2', name: true },
              ],
              level: 2,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Current Rating', name: true },
                { text: ' ← ', name: false },
                { text: 'Current Rating', name: true },
                { text: ' + ', name: false },
                { text: 'delta2', name: true },
              ],
              level: 3,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Matches Played', name: true },
                { text: ' ← ', name: false },
                { text: 'Matches Played', name: true },
                { text: ' + 1', name: false },
              ],
              level: 3,
            },
            {
              head: 'if',
              operator: false,
              parts: [
                { text: 'Outcome', name: true },
                { text: ' = Player 2 Victory', name: false },
              ],
              level: 3,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Wins', name: true },
                { text: ' ← ', name: false },
                { text: 'Wins', name: true },
                { text: ' + 1', name: false },
              ],
              level: 4,
            },
            { head: 'otherwise', operator: false, parts: [], level: 3 },
            {
              head: 'if',
              operator: false,
              parts: [
                { text: 'Outcome', name: true },
                { text: ' = Player 1 Victory', name: false },
              ],
              level: 4,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Losses', name: true },
                { text: ' ← ', name: false },
                { text: 'Losses', name: true },
                { text: ' + 1', name: false },
              ],
              level: 5,
            },
            { head: 'otherwise', operator: false, parts: [], level: 4 },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Draws', name: true },
                { text: ' ← ', name: false },
                { text: 'Draws', name: true },
                { text: ' + 1', name: false },
              ],
              level: 5,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Last Activity', name: true },
                { text: ' ← now', name: false },
              ],
              level: 3,
            },
            { head: 'otherwise', operator: false, parts: [], level: 0 },
            {
              head: 'adds',
              operator: false,
              parts: [
                { text: 'Leaderboard Entry', name: true },
                { text: ' (', name: false },
              ],
              level: 1,
            },
            {
              head: '',
              operator: false,
              parts: [
                { text: 'Player', name: true },
                { text: ': ', name: false },
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Player 2', name: true },
                { text: ',', name: false },
              ],
              level: 2,
            },
            {
              head: '',
              operator: false,
              parts: [
                { text: 'Game', name: true },
                { text: ': ', name: false },
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Game', name: true },
                { text: ',', name: false },
              ],
              level: 2,
            },
            {
              head: '',
              operator: false,
              parts: [
                { text: 'Current Rating', name: true },
                { text: ': ', name: false },
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Game', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Starting Rating (Default 1200)', name: true },
                { text: ' + ', name: false },
                { text: 'delta2', name: true },
                { text: ',', name: false },
              ],
              level: 2,
            },
            {
              head: '',
              operator: false,
              parts: [
                { text: 'Matches Played', name: true },
                { text: ': 1,', name: false },
              ],
              level: 2,
            },
            {
              head: '',
              operator: false,
              parts: [
                { text: 'Wins', name: true },
                { text: ': if ', name: false },
                { text: 'Outcome', name: true },
                { text: ' = Player 2 Victory then 1 otherwise 0,', name: false },
              ],
              level: 2,
            },
            {
              head: '',
              operator: false,
              parts: [
                { text: 'Losses', name: true },
                { text: ': if ', name: false },
                { text: 'Outcome', name: true },
                { text: ' = Player 1 Victory then 1 otherwise 0,', name: false },
              ],
              level: 2,
            },
            {
              head: '',
              operator: false,
              parts: [
                { text: 'Draws', name: true },
                { text: ': if ', name: false },
                { text: 'Outcome', name: true },
                { text: ' = Draw then 1 otherwise 0,', name: false },
              ],
              level: 2,
            },
            {
              head: '',
              operator: false,
              parts: [
                { text: 'Last Activity', name: true },
                { text: ': now)', name: false },
              ],
              level: 2,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Status', name: true },
                { text: ' ← Completed', name: false },
              ],
              level: 0,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'Outcome', name: true },
                { text: ' ← ', name: false },
                { text: 'Outcome', name: true },
              ],
              level: 0,
            },
            {
              head: 'if',
              operator: false,
              parts: [
                { text: 'Outcome', name: true },
                { text: ' = Player 1 Victory', name: false },
              ],
              level: 0,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'P1 Score', name: true },
                { text: ' ← 1', name: false },
              ],
              level: 1,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'P2 Score', name: true },
                { text: ' ← −1', name: false },
              ],
              level: 1,
            },
            { head: 'otherwise', operator: false, parts: [], level: 0 },
            {
              head: 'if',
              operator: false,
              parts: [
                { text: 'Outcome', name: true },
                { text: ' = Player 2 Victory', name: false },
              ],
              level: 1,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'P1 Score', name: true },
                { text: ' ← −1', name: false },
              ],
              level: 2,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'P2 Score', name: true },
                { text: ' ← 1', name: false },
              ],
              level: 2,
            },
            { head: 'otherwise', operator: false, parts: [], level: 1 },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'P1 Score', name: true },
                { text: ' ← 0.5', name: false },
              ],
              level: 2,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'P2 Score', name: true },
                { text: ' ← 0.5', name: false },
              ],
              level: 2,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'P1 Rating Change', name: true },
                { text: ' ← ', name: false },
                { text: 'delta1', name: true },
              ],
              level: 0,
            },
            {
              head: 'sets',
              operator: false,
              parts: [
                { text: 'Match', name: true },
                { text: ' ↳ ', name: false },
                { text: 'P2 Rating Change', name: true },
                { text: ' ← ', name: false },
                { text: 'delta2', name: true },
              ],
              level: 0,
            },
          ],
          prompts: [],
          emails: [],
        },
      ],
    ],
  },
];
const CALCULATIONS: CalculationGroup[] = [
  {
    record: 'Match',
    items: [
      {
        key: 'Match.title',
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
      {
        key: 'Match.gameDisplayName',
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
    ],
  },
  {
    record: 'Leaderboard Entry',
    items: [
      {
        key: 'LeaderboardEntry.playerNickname',
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
    ],
  },
  {
    record: 'Game',
    items: [
      {
        key: 'GameType.displayName',
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
      {
        key: 'GameType.leaderboard',
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
    ],
  },
];
const FUNCTIONS: FunctionGroup[] = [
  {
    title: 'Compute rating change(Player 1 rating, Player 2 rating, Outcome)',
    steps: [
      {
        head: 'sets',
        operator: false,
        parts: [
          { text: 'expected', name: true },
          { text: ' ←', name: false },
        ],
        level: 0,
      },
      {
        head: '',
        operator: false,
        parts: [
          { text: '500 + (((', name: false },
          { text: 'Player 1 rating', name: true },
          { text: ' − ', name: false },
          { text: 'Player 2 rating', name: true },
          { text: ') × 5 ÷ 4) without decimals)', name: false },
        ],
        level: 1,
      },
      {
        head: 'if',
        operator: false,
        parts: [
          { text: 'expected', name: true },
          { text: ' > 900', name: false },
        ],
        level: 0,
      },
      {
        head: 'sets',
        operator: false,
        parts: [
          { text: 'expected', name: true },
          { text: ' ← 900', name: false },
        ],
        level: 1,
      },
      { head: 'otherwise', operator: false, parts: [], level: 0 },
      {
        head: 'if',
        operator: false,
        parts: [
          { text: 'expected', name: true },
          { text: ' < 100', name: false },
        ],
        level: 1,
      },
      {
        head: 'sets',
        operator: false,
        parts: [
          { text: 'expected', name: true },
          { text: ' ← 100', name: false },
        ],
        level: 2,
      },
      {
        head: 'sets',
        operator: false,
        parts: [
          { text: 'actual', name: true },
          { text: ' ← 500', name: false },
        ],
        level: 0,
      },
      {
        head: 'if',
        operator: false,
        parts: [
          { text: 'Outcome', name: true },
          { text: ' = Player 1 Victory', name: false },
        ],
        level: 0,
      },
      {
        head: 'sets',
        operator: false,
        parts: [
          { text: 'actual', name: true },
          { text: ' ← 1000', name: false },
        ],
        level: 1,
      },
      { head: 'otherwise', operator: false, parts: [], level: 0 },
      {
        head: 'if',
        operator: false,
        parts: [
          { text: 'Outcome', name: true },
          { text: ' = Player 2 Victory', name: false },
        ],
        level: 1,
      },
      {
        head: 'sets',
        operator: false,
        parts: [
          { text: 'actual', name: true },
          { text: ' ← 0', name: false },
        ],
        level: 2,
      },
      {
        head: 'returns',
        operator: false,
        parts: [
          { text: '(32 × (', name: false },
          { text: 'actual', name: true },
          { text: ' − ', name: false },
          { text: 'expected', name: true },
          { text: ') ÷ 1000) without decimals', name: false },
        ],
        level: 0,
      },
    ],
  },
];

const ICONS: Record<string, typeof Cog> = {
  cog: Cog,
};

function chipClass(style: ChipStyle): string {
  switch (style) {
    case 'code':
      return 'inline-flex items-center rounded border border-border bg-background px-1.5 py-0.5 text-xs text-muted-foreground';
    case 'action':
      return 'inline-flex items-center gap-1 rounded ui-series-1-chip px-1.5 py-0.5 text-xs font-medium';
    case 'ai':
      return 'inline-flex items-center gap-1 rounded ui-series-5-chip px-1.5 py-0.5 text-xs font-medium';
  }
}

function StepChip({ chip }: { chip: Chip }): JSX.Element {
  return (
    <span className={chipClass(chip.style)}>
      {chip.style === 'action' && <Play className="h-3 w-3" />}
      {chip.text}
    </span>
  );
}

function StepNode({ step }: { step: ChainStep }): JSX.Element {
  const Icon = ICONS[step.icon] ?? Cog;
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-muted px-3 py-2">
      <span className={`mt-0.5 ${step.iconClass}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {step.kindLabel}
        </span>
        <span className="text-sm font-medium">{step.title}</span>
        {step.chips.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1.5">
            {step.chips.map((chip, chipIndex) => (
              <StepChip key={chipIndex} chip={chip} />
            ))}
          </span>
        )}
        {step.steps.length > 0 && (
          <div className="mt-2 text-xs leading-relaxed">
            <FormulaLines lines={step.steps} />
          </div>
        )}
      </div>
    </div>
  );
}

function CalculationsSection(): JSX.Element {
  return (
    <section>
      <p className="text-xs text-muted-foreground">
        These values are never typed in. The software recalculates them whenever the values they
        depend on change.
      </p>
      <div className="mt-3 grid gap-4">
        {CALCULATIONS.map((group) => (
          <div key={group.record} className="rounded-md border border-border bg-muted px-4 py-3">
            <p className="text-xs font-semibold">{group.record}</p>
            <div className="mt-1 divide-y divide-border">
              {group.items.map((item) => (
                <div
                  key={item.key}
                  data-ls={item.anchor}
                  className="py-2.5 text-sm leading-relaxed"
                >
                  <FormulaLines lines={item.lines} />
                </div>
              ))}
            </div>
          </div>
        ))}
        {FUNCTIONS.map((group) => (
          <div key={group.title} className="rounded-md border border-border bg-muted px-4 py-3">
            <p className="text-xs font-semibold">{group.title}</p>
            <div className="mt-1 py-2.5 text-sm leading-relaxed">
              <FormulaLines lines={group.steps} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AutomationManagement(): JSX.Element {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold flex items-center gap-2" data-ls="259002a93f">
        <Workflow className="h-6 w-6" />
        Automations
      </h1>
      <p className="text-muted-foreground mb-6">
        What the software calculates, what starts each process, and what it changes
      </p>
      <Tabs.Root defaultValue="processes">
        <Tabs.List className="flex gap-1 border-b border-border">
          <Tabs.Trigger
            value="processes"
            className="px-3 py-2 text-sm font-medium text-muted-foreground aria-selected:border-b-2 aria-selected:border-primary aria-selected:text-foreground"
            data-ls="fb0ef85c16"
          >
            Processes
          </Tabs.Trigger>
          <Tabs.Trigger
            value="calculations"
            className="px-3 py-2 text-sm font-medium text-muted-foreground aria-selected:border-b-2 aria-selected:border-primary aria-selected:text-foreground"
            data-ls="f9e91e1255"
          >
            Calculations
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="processes" className="pt-3">
          <div className="grid gap-4">
            {CHAINS.map((chain, chainIndex) => (
              <div key={chainIndex} className="rounded-lg border border-border bg-card p-4">
                <p className="font-medium">{chain.title}</p>
                {chain.threads.map((thread, threadIndex) => (
                  <div
                    key={threadIndex}
                    className={
                      threadIndex > 0 ? 'mt-4 border-t border-dashed border-border pt-4' : 'mt-3'
                    }
                  >
                    {thread.map((step, stepIndex) => (
                      <div key={stepIndex}>
                        {stepIndex > 0 && (
                          <div className="flex items-center gap-2 py-1 pl-6 text-xs text-muted-foreground">
                            <ArrowDown className="h-3.5 w-3.5" />
                            <span>{step.cause}</span>
                          </div>
                        )}
                        <StepNode step={step} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Tabs.Content>
        <Tabs.Content value="calculations" className="pt-3">
          <CalculationsSection />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
