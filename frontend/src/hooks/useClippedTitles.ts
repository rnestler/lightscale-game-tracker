import { useEffect } from 'react';

const MARK = 'lsAutoTitle';

function clipsItsOwnText(element: HTMLElement): boolean {
  return (
    element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1
  );
}

function clippedByAnAncestor(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  let parent = element.parentElement;
  while (parent !== null) {
    const { overflow } = getComputedStyle(parent);
    if (overflow === 'auto' || overflow === 'scroll') {
      return false;
    }
    if (overflow !== 'visible') {
      const box = parent.getBoundingClientRect();
      return rect.right > box.right + 1 || rect.left < box.left - 1 || rect.bottom > box.bottom + 1;
    }
    parent = parent.parentElement;
  }
  return false;
}

function isClipped(element: HTMLElement): boolean {
  return clipsItsOwnText(element) || clippedByAnAncestor(element);
}

export function useClippedTitles(): void {
  useEffect(() => {
    const reveal = (event: MouseEvent): void => {
      const { target } = event;
      if (!(target instanceof HTMLElement) || target.childElementCount > 0) {
        return;
      }
      const written = target.dataset[MARK];
      if (target.title !== '' && written !== target.title) {
        return;
      }
      const text = target.textContent.trim();
      if (text !== '' && isClipped(target)) {
        target.title = text;
        target.dataset[MARK] = text;
        return;
      }
      if (written !== undefined) {
        target.removeAttribute('title');
        delete target.dataset[MARK];
      }
    };
    document.addEventListener('mouseover', reveal, true);
    return (): void => {
      document.removeEventListener('mouseover', reveal, true);
    };
  }, []);
}
