import { i18n } from '../i18n/text';
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
  cause: string | null;
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
  name: string;
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
  name: string;
  items: CalculationItem[];
}

function automationChains(): Chain[] {
  return [
    {
      title: i18n.word("'Start Match'"),
      threads: [
        [
          {
            cause: null,
            icon: 'cog',
            iconClass: 'text-muted-foreground',
            kindLabel: i18n.chrome.automationKindTransaction,
            title: i18n.word("'Start Match'"),
            chips: [
              { text: i18n.word("'Start Match'"), style: 'action' },
              {
                text: `${i18n.chrome.automationCauseUpdates} ${i18n.word('Match')}: ${[i18n.word('Match.status')].join(' · ')}`,
                style: 'code',
              },
            ],
            steps: [
              {
                head: i18n.word("'requires'"),
                operator: false,
                parts: [
                  { text: i18n.word('Match.status'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('MatchStatus.scheduled'), name: true },
                  { text: i18n.word('\' · "Match must be scheduled to start"\''), name: false },
                ],
                level: 0,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('Match.status'), name: true },
                  { text: i18n.word("' ← '"), name: false },
                  { text: i18n.word('MatchStatus.inProgress'), name: true },
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
      title: i18n.word("'Dispute Result'"),
      threads: [
        [
          {
            cause: null,
            icon: 'cog',
            iconClass: 'text-muted-foreground',
            kindLabel: i18n.chrome.automationKindTransaction,
            title: i18n.word("'Dispute Result'"),
            chips: [
              { text: i18n.word("'Dispute Result'"), style: 'action' },
              {
                text: `${i18n.chrome.automationCauseUpdates} ${i18n.word('Match')}: ${[i18n.word('Match.status')].join(' · ')}`,
                style: 'code',
              },
            ],
            steps: [
              {
                head: i18n.word("'requires'"),
                operator: false,
                parts: [
                  { text: i18n.word('Match.status'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('MatchStatus.completed'), name: true },
                  {
                    text: i18n.word('\' · "Only completed matches can be disputed"\''),
                    name: false,
                  },
                ],
                level: 0,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('Match.status'), name: true },
                  { text: i18n.word("' ← '"), name: false },
                  { text: i18n.word('MatchStatus.disputed'), name: true },
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
      title: i18n.word("'Cancel Match'"),
      threads: [
        [
          {
            cause: null,
            icon: 'cog',
            iconClass: 'text-muted-foreground',
            kindLabel: i18n.chrome.automationKindTransaction,
            title: i18n.word("'Cancel Match'"),
            chips: [
              { text: i18n.word("'Cancel Match'"), style: 'action' },
              {
                text: `${i18n.chrome.automationCauseUpdates} ${i18n.word('Match')}: ${[i18n.word('Match.status')].join(' · ')}`,
                style: 'code',
              },
            ],
            steps: [
              {
                head: i18n.word("'requires'"),
                operator: false,
                parts: [
                  { text: i18n.word('Match.status'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('MatchStatus.scheduled'), name: true },
                  { text: i18n.word("' or '"), name: false },
                  { text: i18n.word('Match.status'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('MatchStatus.inProgress'), name: true },
                  {
                    text: i18n.word(
                      '\' · "Only scheduled or in-progress matches can be cancelled"\''
                    ),
                    name: false,
                  },
                ],
                level: 0,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('Match.status'), name: true },
                  { text: i18n.word("' ← '"), name: false },
                  { text: i18n.word('MatchStatus.cancelled'), name: true },
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
      title: i18n.word("'Record & Complete Match'"),
      threads: [
        [
          {
            cause: null,
            icon: 'cog',
            iconClass: 'text-muted-foreground',
            kindLabel: i18n.chrome.automationKindTransaction,
            title: i18n.word("'Record & Complete Match'"),
            chips: [
              { text: i18n.word("'Record & Complete Match'"), style: 'action' },
              {
                text: `${i18n.chrome.automationCauseUpdates} ${i18n.word('LeaderboardEntry')}: ${[i18n.word('LeaderboardEntry.rating'), i18n.word('LeaderboardEntry.matchesPlayed'), i18n.word('LeaderboardEntry.wins'), i18n.word('LeaderboardEntry.losses'), i18n.word('LeaderboardEntry.draws'), i18n.word('LeaderboardEntry.lastPlayedAt')].join(' · ')}`,
                style: 'code',
              },
              {
                text: `${i18n.chrome.automationCauseCreates} ${i18n.word('LeaderboardEntry')}`,
                style: 'code',
              },
              {
                text: `${i18n.chrome.automationCauseUpdates} ${i18n.word('Match')}: ${[i18n.word('Match.status'), i18n.word('Match.outcome'), i18n.word('Match.playerOneScore'), i18n.word('Match.playerTwoScore'), i18n.word('Match.playerOneRatingDelta'), i18n.word('Match.playerTwoRatingDelta')].join(' · ')}`,
                style: 'code',
              },
            ],
            steps: [
              {
                head: i18n.word("'requires'"),
                operator: false,
                parts: [
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.status'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('MatchStatus.scheduled'), name: true },
                  { text: i18n.word("' or '"), name: false },
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.status'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('MatchStatus.inProgress'), name: true },
                  {
                    text: i18n.word('\' · "Match must be scheduled or in progress to complete"\''),
                    name: false,
                  },
                ],
                level: 0,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word("'p1Rating'"), name: true },
                  { text: i18n.word("' ← '"), name: false },
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.game'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('GameType.defaultRating'), name: true },
                ],
                level: 0,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word("'p2Rating'"), name: true },
                  { text: i18n.word("' ← '"), name: false },
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.game'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('GameType.defaultRating'), name: true },
                ],
                level: 0,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word("'p1Found'"), name: true },
                  { text: i18n.word("' ← no'"), name: false },
                ],
                level: 0,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word("'p2Found'"), name: true },
                  { text: i18n.word("' ← no'"), name: false },
                ],
                level: 0,
              },
              {
                head: i18n.word("'for each'"),
                operator: false,
                parts: [
                  { text: i18n.word("'entry'"), name: true },
                  { text: i18n.word("' of '"), name: false },
                  { text: i18n.word('leaderboards'), name: true },
                ],
                level: 0,
              },
              {
                head: i18n.word("'if'"),
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.game'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.game'), name: true },
                  { text: i18n.word("' and '"), name: false },
                  { text: i18n.word('LeaderboardEntry.player'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.playerOne'), name: true },
                ],
                level: 1,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word("'p1Rating'"), name: true },
                  { text: i18n.word("' ← '"), name: false },
                  { text: i18n.word('LeaderboardEntry.rating'), name: true },
                ],
                level: 2,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word("'p1Found'"), name: true },
                  { text: i18n.word("' ← yes'"), name: false },
                ],
                level: 2,
              },
              {
                head: i18n.word("'if'"),
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.game'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.game'), name: true },
                  { text: i18n.word("' and '"), name: false },
                  { text: i18n.word('LeaderboardEntry.player'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.playerTwo'), name: true },
                ],
                level: 1,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word("'p2Rating'"), name: true },
                  { text: i18n.word("' ← '"), name: false },
                  { text: i18n.word('LeaderboardEntry.rating'), name: true },
                ],
                level: 2,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word("'p2Found'"), name: true },
                  { text: i18n.word("' ← yes'"), name: false },
                ],
                level: 2,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word("'delta1'"), name: true },
                  { text: i18n.word("' ← '"), name: false },
                  { text: i18n.word('computeEloDelta'), name: true },
                  { text: i18n.word("'('"), name: false },
                  { text: i18n.word("'p1Rating'"), name: true },
                  { text: i18n.word("', '"), name: false },
                  { text: i18n.word("'p2Rating'"), name: true },
                  { text: i18n.word("', '"), name: false },
                  { text: i18n.word('completeMatch.outcome'), name: true },
                  { text: i18n.word("')'"), name: false },
                ],
                level: 0,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word("'delta2'"), name: true },
                  { text: i18n.word("' ← 0 − '"), name: false },
                  { text: i18n.word("'delta1'"), name: true },
                ],
                level: 0,
              },
              {
                head: i18n.word("'if'"),
                operator: false,
                parts: [{ text: i18n.word("'p1Found'"), name: true }],
                level: 0,
              },
              {
                head: i18n.word("'for each'"),
                operator: false,
                parts: [
                  { text: i18n.word("'entry'"), name: true },
                  { text: i18n.word("' of '"), name: false },
                  { text: i18n.word('leaderboards'), name: true },
                ],
                level: 1,
              },
              {
                head: i18n.word("'if'"),
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.game'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.game'), name: true },
                  { text: i18n.word("' and '"), name: false },
                  { text: i18n.word('LeaderboardEntry.player'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.playerOne'), name: true },
                ],
                level: 2,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.rating'), name: true },
                  { text: i18n.word("' ← '"), name: false },
                  { text: i18n.word('LeaderboardEntry.rating'), name: true },
                  { text: i18n.word("' + '"), name: false },
                  { text: i18n.word("'delta1'"), name: true },
                ],
                level: 3,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.matchesPlayed'), name: true },
                  { text: i18n.word("' ← '"), name: false },
                  { text: i18n.word('LeaderboardEntry.matchesPlayed'), name: true },
                  { text: i18n.word("' + 1'"), name: false },
                ],
                level: 3,
              },
              {
                head: i18n.word("'if'"),
                operator: false,
                parts: [
                  { text: i18n.word('completeMatch.outcome'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('MatchOutcome.playerOneWin'), name: true },
                ],
                level: 3,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.wins'), name: true },
                  { text: i18n.word("' ← '"), name: false },
                  { text: i18n.word('LeaderboardEntry.wins'), name: true },
                  { text: i18n.word("' + 1'"), name: false },
                ],
                level: 4,
              },
              { head: i18n.word("'otherwise'"), operator: false, parts: [], level: 3 },
              {
                head: i18n.word("'if'"),
                operator: false,
                parts: [
                  { text: i18n.word('completeMatch.outcome'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('MatchOutcome.playerTwoWin'), name: true },
                ],
                level: 4,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.losses'), name: true },
                  { text: i18n.word("' ← '"), name: false },
                  { text: i18n.word('LeaderboardEntry.losses'), name: true },
                  { text: i18n.word("' + 1'"), name: false },
                ],
                level: 5,
              },
              { head: i18n.word("'otherwise'"), operator: false, parts: [], level: 4 },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.draws'), name: true },
                  { text: i18n.word("' ← '"), name: false },
                  { text: i18n.word('LeaderboardEntry.draws'), name: true },
                  { text: i18n.word("' + 1'"), name: false },
                ],
                level: 5,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.lastPlayedAt'), name: true },
                  { text: i18n.word("' ← now'"), name: false },
                ],
                level: 3,
              },
              { head: i18n.word("'otherwise'"), operator: false, parts: [], level: 0 },
              {
                head: i18n.word("'adds'"),
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry'), name: true },
                  { text: i18n.word("' ('"), name: false },
                ],
                level: 1,
              },
              {
                head: '',
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.player'), name: true },
                  { text: i18n.word("': '"), name: false },
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.playerOne'), name: true },
                  { text: i18n.word("','"), name: false },
                ],
                level: 2,
              },
              {
                head: '',
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.game'), name: true },
                  { text: i18n.word("': '"), name: false },
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.game'), name: true },
                  { text: i18n.word("','"), name: false },
                ],
                level: 2,
              },
              {
                head: '',
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.rating'), name: true },
                  { text: i18n.word("': '"), name: false },
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.game'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('GameType.defaultRating'), name: true },
                  { text: i18n.word("' + '"), name: false },
                  { text: i18n.word("'delta1'"), name: true },
                  { text: i18n.word("','"), name: false },
                ],
                level: 2,
              },
              {
                head: '',
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.matchesPlayed'), name: true },
                  { text: i18n.word("': 1,'"), name: false },
                ],
                level: 2,
              },
              {
                head: '',
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.wins'), name: true },
                  { text: i18n.word("': if '"), name: false },
                  { text: i18n.word('completeMatch.outcome'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('MatchOutcome.playerOneWin'), name: true },
                  { text: i18n.word("' then 1 otherwise 0,'"), name: false },
                ],
                level: 2,
              },
              {
                head: '',
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.losses'), name: true },
                  { text: i18n.word("': if '"), name: false },
                  { text: i18n.word('completeMatch.outcome'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('MatchOutcome.playerTwoWin'), name: true },
                  { text: i18n.word("' then 1 otherwise 0,'"), name: false },
                ],
                level: 2,
              },
              {
                head: '',
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.draws'), name: true },
                  { text: i18n.word("': if '"), name: false },
                  { text: i18n.word('completeMatch.outcome'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('MatchOutcome.draw'), name: true },
                  { text: i18n.word("' then 1 otherwise 0,'"), name: false },
                ],
                level: 2,
              },
              {
                head: '',
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.lastPlayedAt'), name: true },
                  { text: i18n.word("': now)'"), name: false },
                ],
                level: 2,
              },
              {
                head: i18n.word("'if'"),
                operator: false,
                parts: [{ text: i18n.word("'p2Found'"), name: true }],
                level: 0,
              },
              {
                head: i18n.word("'for each'"),
                operator: false,
                parts: [
                  { text: i18n.word("'entry'"), name: true },
                  { text: i18n.word("' of '"), name: false },
                  { text: i18n.word('leaderboards'), name: true },
                ],
                level: 1,
              },
              {
                head: i18n.word("'if'"),
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.game'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.game'), name: true },
                  { text: i18n.word("' and '"), name: false },
                  { text: i18n.word('LeaderboardEntry.player'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.playerTwo'), name: true },
                ],
                level: 2,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.rating'), name: true },
                  { text: i18n.word("' ← '"), name: false },
                  { text: i18n.word('LeaderboardEntry.rating'), name: true },
                  { text: i18n.word("' + '"), name: false },
                  { text: i18n.word("'delta2'"), name: true },
                ],
                level: 3,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.matchesPlayed'), name: true },
                  { text: i18n.word("' ← '"), name: false },
                  { text: i18n.word('LeaderboardEntry.matchesPlayed'), name: true },
                  { text: i18n.word("' + 1'"), name: false },
                ],
                level: 3,
              },
              {
                head: i18n.word("'if'"),
                operator: false,
                parts: [
                  { text: i18n.word('completeMatch.outcome'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('MatchOutcome.playerTwoWin'), name: true },
                ],
                level: 3,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.wins'), name: true },
                  { text: i18n.word("' ← '"), name: false },
                  { text: i18n.word('LeaderboardEntry.wins'), name: true },
                  { text: i18n.word("' + 1'"), name: false },
                ],
                level: 4,
              },
              { head: i18n.word("'otherwise'"), operator: false, parts: [], level: 3 },
              {
                head: i18n.word("'if'"),
                operator: false,
                parts: [
                  { text: i18n.word('completeMatch.outcome'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('MatchOutcome.playerOneWin'), name: true },
                ],
                level: 4,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.losses'), name: true },
                  { text: i18n.word("' ← '"), name: false },
                  { text: i18n.word('LeaderboardEntry.losses'), name: true },
                  { text: i18n.word("' + 1'"), name: false },
                ],
                level: 5,
              },
              { head: i18n.word("'otherwise'"), operator: false, parts: [], level: 4 },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.draws'), name: true },
                  { text: i18n.word("' ← '"), name: false },
                  { text: i18n.word('LeaderboardEntry.draws'), name: true },
                  { text: i18n.word("' + 1'"), name: false },
                ],
                level: 5,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.lastPlayedAt'), name: true },
                  { text: i18n.word("' ← now'"), name: false },
                ],
                level: 3,
              },
              { head: i18n.word("'otherwise'"), operator: false, parts: [], level: 0 },
              {
                head: i18n.word("'adds'"),
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry'), name: true },
                  { text: i18n.word("' ('"), name: false },
                ],
                level: 1,
              },
              {
                head: '',
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.player'), name: true },
                  { text: i18n.word("': '"), name: false },
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.playerTwo'), name: true },
                  { text: i18n.word("','"), name: false },
                ],
                level: 2,
              },
              {
                head: '',
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.game'), name: true },
                  { text: i18n.word("': '"), name: false },
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.game'), name: true },
                  { text: i18n.word("','"), name: false },
                ],
                level: 2,
              },
              {
                head: '',
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.rating'), name: true },
                  { text: i18n.word("': '"), name: false },
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.game'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('GameType.defaultRating'), name: true },
                  { text: i18n.word("' + '"), name: false },
                  { text: i18n.word("'delta2'"), name: true },
                  { text: i18n.word("','"), name: false },
                ],
                level: 2,
              },
              {
                head: '',
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.matchesPlayed'), name: true },
                  { text: i18n.word("': 1,'"), name: false },
                ],
                level: 2,
              },
              {
                head: '',
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.wins'), name: true },
                  { text: i18n.word("': if '"), name: false },
                  { text: i18n.word('completeMatch.outcome'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('MatchOutcome.playerTwoWin'), name: true },
                  { text: i18n.word("' then 1 otherwise 0,'"), name: false },
                ],
                level: 2,
              },
              {
                head: '',
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.losses'), name: true },
                  { text: i18n.word("': if '"), name: false },
                  { text: i18n.word('completeMatch.outcome'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('MatchOutcome.playerOneWin'), name: true },
                  { text: i18n.word("' then 1 otherwise 0,'"), name: false },
                ],
                level: 2,
              },
              {
                head: '',
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.draws'), name: true },
                  { text: i18n.word("': if '"), name: false },
                  { text: i18n.word('completeMatch.outcome'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('MatchOutcome.draw'), name: true },
                  { text: i18n.word("' then 1 otherwise 0,'"), name: false },
                ],
                level: 2,
              },
              {
                head: '',
                operator: false,
                parts: [
                  { text: i18n.word('LeaderboardEntry.lastPlayedAt'), name: true },
                  { text: i18n.word("': now)'"), name: false },
                ],
                level: 2,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.status'), name: true },
                  { text: i18n.word("' ← '"), name: false },
                  { text: i18n.word('MatchStatus.completed'), name: true },
                ],
                level: 0,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.outcome'), name: true },
                  { text: i18n.word("' ← '"), name: false },
                  { text: i18n.word('completeMatch.outcome'), name: true },
                ],
                level: 0,
              },
              {
                head: i18n.word("'if'"),
                operator: false,
                parts: [
                  { text: i18n.word('completeMatch.outcome'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('MatchOutcome.playerOneWin'), name: true },
                ],
                level: 0,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.playerOneScore'), name: true },
                  { text: i18n.word("' ← 1'"), name: false },
                ],
                level: 1,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.playerTwoScore'), name: true },
                  { text: i18n.word("' ← −1'"), name: false },
                ],
                level: 1,
              },
              { head: i18n.word("'otherwise'"), operator: false, parts: [], level: 0 },
              {
                head: i18n.word("'if'"),
                operator: false,
                parts: [
                  { text: i18n.word('completeMatch.outcome'), name: true },
                  { text: i18n.word("' = '"), name: false },
                  { text: i18n.word('MatchOutcome.playerTwoWin'), name: true },
                ],
                level: 1,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.playerOneScore'), name: true },
                  { text: i18n.word("' ← −1'"), name: false },
                ],
                level: 2,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.playerTwoScore'), name: true },
                  { text: i18n.word("' ← 1'"), name: false },
                ],
                level: 2,
              },
              { head: i18n.word("'otherwise'"), operator: false, parts: [], level: 1 },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.playerOneScore'), name: true },
                  { text: i18n.word("' ← 0.5'"), name: false },
                ],
                level: 2,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.playerTwoScore'), name: true },
                  { text: i18n.word("' ← 0.5'"), name: false },
                ],
                level: 2,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.playerOneRatingDelta'), name: true },
                  { text: i18n.word("' ← '"), name: false },
                  { text: i18n.word("'delta1'"), name: true },
                ],
                level: 0,
              },
              {
                head: i18n.word("'sets'"),
                operator: false,
                parts: [
                  { text: i18n.word('completeMatch.match'), name: true },
                  { text: i18n.word("' ↳ '"), name: false },
                  { text: i18n.word('Match.playerTwoRatingDelta'), name: true },
                  { text: i18n.word("' ← '"), name: false },
                  { text: i18n.word("'delta2'"), name: true },
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
}

function automationCalculations(): CalculationGroup[] {
  return [
    {
      record: 'Match',
      name: i18n.word('Match'),
      items: [
        {
          key: 'Match.title',
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
        {
          key: 'Match.gameDisplayName',
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
      ],
    },
    {
      record: 'LeaderboardEntry',
      name: i18n.word('LeaderboardEntry'),
      items: [
        {
          key: 'LeaderboardEntry.playerNickname',
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
      ],
    },
    {
      record: 'GameType',
      name: i18n.word('GameType'),
      items: [
        {
          key: 'GameType.displayName',
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
        {
          key: 'GameType.leaderboard',
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
      ],
    },
  ];
}

function automationFunctions(): FunctionGroup[] {
  return [
    {
      name: 'computeEloDelta',
      title: `${i18n.word('computeEloDelta')}(${[i18n.word('computeEloDelta.p1Rating'), i18n.word('computeEloDelta.p2Rating'), i18n.word('computeEloDelta.outcome')].join(', ')})`,
      steps: [
        {
          head: i18n.word("'sets'"),
          operator: false,
          parts: [
            { text: i18n.word("'expected'"), name: true },
            { text: i18n.word("' ←'"), name: false },
          ],
          level: 0,
        },
        {
          head: '',
          operator: false,
          parts: [
            { text: i18n.word("'500 + ((('"), name: false },
            { text: i18n.word('computeEloDelta.p1Rating'), name: true },
            { text: i18n.word("' − '"), name: false },
            { text: i18n.word('computeEloDelta.p2Rating'), name: true },
            { text: i18n.word("') × 5 ÷ 4) without decimals)'"), name: false },
          ],
          level: 1,
        },
        {
          head: i18n.word("'if'"),
          operator: false,
          parts: [
            { text: i18n.word("'expected'"), name: true },
            { text: i18n.word("' > 900'"), name: false },
          ],
          level: 0,
        },
        {
          head: i18n.word("'sets'"),
          operator: false,
          parts: [
            { text: i18n.word("'expected'"), name: true },
            { text: i18n.word("' ← 900'"), name: false },
          ],
          level: 1,
        },
        { head: i18n.word("'otherwise'"), operator: false, parts: [], level: 0 },
        {
          head: i18n.word("'if'"),
          operator: false,
          parts: [
            { text: i18n.word("'expected'"), name: true },
            { text: i18n.word("' < 100'"), name: false },
          ],
          level: 1,
        },
        {
          head: i18n.word("'sets'"),
          operator: false,
          parts: [
            { text: i18n.word("'expected'"), name: true },
            { text: i18n.word("' ← 100'"), name: false },
          ],
          level: 2,
        },
        {
          head: i18n.word("'sets'"),
          operator: false,
          parts: [
            { text: i18n.word("'actual'"), name: true },
            { text: i18n.word("' ← 500'"), name: false },
          ],
          level: 0,
        },
        {
          head: i18n.word("'if'"),
          operator: false,
          parts: [
            { text: i18n.word('computeEloDelta.outcome'), name: true },
            { text: i18n.word("' = '"), name: false },
            { text: i18n.word('MatchOutcome.playerOneWin'), name: true },
          ],
          level: 0,
        },
        {
          head: i18n.word("'sets'"),
          operator: false,
          parts: [
            { text: i18n.word("'actual'"), name: true },
            { text: i18n.word("' ← 1000'"), name: false },
          ],
          level: 1,
        },
        { head: i18n.word("'otherwise'"), operator: false, parts: [], level: 0 },
        {
          head: i18n.word("'if'"),
          operator: false,
          parts: [
            { text: i18n.word('computeEloDelta.outcome'), name: true },
            { text: i18n.word("' = '"), name: false },
            { text: i18n.word('MatchOutcome.playerTwoWin'), name: true },
          ],
          level: 1,
        },
        {
          head: i18n.word("'sets'"),
          operator: false,
          parts: [
            { text: i18n.word("'actual'"), name: true },
            { text: i18n.word("' ← 0'"), name: false },
          ],
          level: 2,
        },
        {
          head: i18n.word("'returns'"),
          operator: false,
          parts: [
            { text: i18n.word("'(32 × ('"), name: false },
            { text: i18n.word("'actual'"), name: true },
            { text: i18n.word("' − '"), name: false },
            { text: i18n.word("'expected'"), name: true },
            { text: i18n.word("') ÷ 1000) without decimals'"), name: false },
          ],
          level: 0,
        },
      ],
    },
  ];
}

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
      <p className="text-xs text-muted-foreground">{i18n.chrome.calculationsHint}</p>
      <div className="mt-3 grid gap-4">
        {automationCalculations().map((group) => (
          <div key={group.record} className="rounded-md border border-border bg-muted px-4 py-3">
            <p className="text-xs font-semibold">{group.name}</p>
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
        {automationFunctions().map((group) => (
          <div key={group.name} className="rounded-md border border-border bg-muted px-4 py-3">
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
    <div className="w-full min-w-0 p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold flex items-center gap-2" data-ls="259002a93f">
        <Workflow className="h-6 w-6" />
        {i18n.chrome.automationTitle}
      </h1>
      <p className="text-muted-foreground mb-6">{i18n.chrome.automationSubtitle}</p>
      <Tabs.Root defaultValue="processes">
        <Tabs.List className="flex gap-1 overflow-x-auto border-b border-border">
          <Tabs.Trigger
            value="processes"
            className="px-3 py-2 text-sm font-medium text-muted-foreground aria-selected:border-b-2 aria-selected:border-primary aria-selected:text-foreground"
            data-ls="fb0ef85c16"
          >
            {i18n.chrome.processesTitle}
          </Tabs.Trigger>
          <Tabs.Trigger
            value="calculations"
            className="px-3 py-2 text-sm font-medium text-muted-foreground aria-selected:border-b-2 aria-selected:border-primary aria-selected:text-foreground"
            data-ls="f9e91e1255"
          >
            {i18n.chrome.calculationsTitle}
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="processes" className="pt-3">
          <div className="grid gap-4">
            {automationChains().map((chain, chainIndex) => (
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
