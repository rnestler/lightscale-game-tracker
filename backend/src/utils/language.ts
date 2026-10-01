// Generated with Lightscale AI. This file belongs to the owner of the generated application. See LICENSE.

import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

export type LocalizedText = string | Readonly<Record<string, string>>;

const LANGUAGE_HEADER = 'x-language';

const requestLanguage = new AsyncLocalStorage<string>();

export function selectRequestLanguage(
  request: Request,
  _response: Response,
  next: NextFunction
): void {
  const language = request.header(LANGUAGE_HEADER);
  if (language === undefined) {
    next();
    return;
  }
  requestLanguage.run(language, next);
}

function baseLanguage(tag: string): string {
  const separator = tag.indexOf('-');
  return separator === -1 ? tag : tag.slice(0, separator);
}

export function localize(text: LocalizedText): string {
  if (typeof text === 'string') {
    return text;
  }
  const variants = Object.entries(text);
  const requested = requestLanguage.getStore();
  const match =
    requested === undefined
      ? undefined
      : variants.find(([tag]) => baseLanguage(tag) === baseLanguage(requested));
  const chosen = match ?? variants.at(0);
  if (chosen === undefined) {
    throw new Error('A localized text offers at least its source language');
  }
  return chosen[1];
}
