// Generated with Lightscale AI. This file belongs to the owner of the generated application. See LICENSE.

import { localize, type LocalizedText } from './language.js';

export type PreconditionRefusal =
  { kind: 'precondition' } | { kind: 'stated'; message: string } | { kind: 'frozen'; type: string };

export type RaisedPrecondition =
  Exclude<PreconditionRefusal, { kind: 'stated' }> | { kind: 'stated'; message: LocalizedText };

function spokenRefusal(raised: RaisedPrecondition): PreconditionRefusal {
  return raised.kind === 'stated' ? { kind: 'stated', message: localize(raised.message) } : raised;
}

function refusalMessage(refusal: PreconditionRefusal): string {
  switch (refusal.kind) {
    case 'stated':
      return refusal.message;
    case 'frozen':
      return `${refusal.type} is frozen and can no longer be modified`;
    case 'precondition':
      return 'This action cannot be carried out with the current values';
    default: {
      const unreachable: never = refusal;
      throw new Error(`Unhandled precondition refusal: ${JSON.stringify(unreachable)}`);
    }
  }
}

export class PreconditionError extends Error {
  public readonly refusal: PreconditionRefusal;

  constructor(raised: RaisedPrecondition) {
    const refusal = spokenRefusal(raised);
    super(refusalMessage(refusal));
    this.refusal = refusal;
  }
}
