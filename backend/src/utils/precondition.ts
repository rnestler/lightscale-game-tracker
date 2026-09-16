// Generated with Lightscale AI. This file belongs to the owner of the generated application. See LICENSE.

export type PreconditionRefusal =
  { kind: 'precondition' } | { kind: 'stated'; message: string } | { kind: 'frozen'; type: string };

function refusalMessage(refusal: PreconditionRefusal): string {
  switch (refusal.kind) {
    case 'stated':
      return refusal.message;
    case 'frozen':
      return `${refusal.type} is frozen and can no longer be modified`;
    case 'precondition':
      return 'This action cannot be carried out with the current values';
  }
}

export class PreconditionError extends Error {
  public readonly refusal: PreconditionRefusal;

  constructor(refusal: PreconditionRefusal) {
    super(refusalMessage(refusal));
    this.refusal = refusal;
  }
}
