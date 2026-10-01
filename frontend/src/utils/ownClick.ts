import type { SyntheticEvent } from 'react';

const CONTROLS =
  'a[href], button, input, select, textarea, label, summary, [role="button"], [role="checkbox"], [role="combobox"], [role="link"], [role="menuitem"], [role="option"], [role="radio"], [role="switch"], [role="tab"], [contenteditable="true"]';

export function isOwnClick(event: SyntheticEvent): boolean {
  const { currentTarget: container, target } = event;
  if (!(target instanceof Element) || !container.contains(target)) {
    return false;
  }
  const control = target.closest(CONTROLS);
  return control === null || control === container || !container.contains(control);
}
