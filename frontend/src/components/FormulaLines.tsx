import { Fragment, type JSX } from 'react';

export interface FormulaText {
  text: string;
  name: boolean;
}
export interface FormulaStack {
  sign: string;
  below: FormulaText[][];
}
export type FormulaPart = FormulaText | FormulaStack;
export interface FormulaLine {
  head: string;
  operator: boolean;
  parts: FormulaPart[];
  level: number;
}

const HEAD_CLASS = 'min-w-4 pr-3 text-right whitespace-nowrap text-muted-foreground';
const NAME_CLASS =
  'rounded-sm bg-foreground/10 px-1 box-decoration-clone ring-1 ring-inset ring-foreground/15';
const STACK_CLASS = 'inline-grid justify-items-center align-middle leading-tight mx-1';
const GLYPH_CLASS = 'text-[1.35em] leading-none';
const WORD_CLASS = 'leading-none';
const RANGE_CLASS = 'text-[0.72em] whitespace-nowrap text-muted-foreground';

function spansBothColumns(line: FormulaLine): boolean {
  return line.head === '' && line.level === 0;
}

function marginWord(line: FormulaLine): string {
  return line.operator ? '' : line.head;
}

function Texts({ parts }: { parts: FormulaText[] }): JSX.Element {
  return (
    <>
      {parts.map((part, index) =>
        part.name ? (
          <span key={index} className={NAME_CLASS}>
            {part.text}
          </span>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        )
      )}
    </>
  );
}

function Stack({ part }: { part: FormulaStack }): JSX.Element {
  return (
    <span className={STACK_CLASS}>
      <span className={part.sign.length === 1 ? GLYPH_CLASS : WORD_CLASS}>{part.sign}</span>
      {part.below.map((row, index) => (
        <span key={index} className={RANGE_CLASS}>
          <Texts parts={row} />
        </span>
      ))}
    </span>
  );
}

function Parts({ parts }: { parts: FormulaPart[] }): JSX.Element {
  return (
    <>
      {parts.map((part, index) =>
        'sign' in part ? <Stack key={index} part={part} /> : <Texts key={index} parts={[part]} />
      )}
    </>
  );
}

export function FormulaLines({ lines }: { lines: FormulaLine[] }): JSX.Element {
  const rows = lines.filter((line) => !spansBothColumns(line));
  const base = rows.length === 0 ? 0 : Math.min(...rows.map((line) => line.level));
  return (
    <div className="grid grid-cols-[max-content_minmax(0,1fr)]">
      {lines.map((line, index) =>
        spansBothColumns(line) ? (
          <span key={index} className="col-span-2">
            <Parts parts={line.parts} />
          </span>
        ) : (
          <Fragment key={index}>
            <span className={marginWord(line) === '' ? 'min-w-4' : HEAD_CLASS}>
              {marginWord(line)}
            </span>
            <span style={{ paddingLeft: `${line.level - base}rem` }}>
              {line.operator ? `${line.head} ` : ''}
              <Parts parts={line.parts} />
            </span>
          </Fragment>
        )
      )}
    </div>
  );
}
