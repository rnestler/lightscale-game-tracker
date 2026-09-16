type Listener = (id: string) => void;
type ShellListener = (view: string) => void;
type TabListener = (tab: string) => void;
const listeners = new Map<string, Listener>();
const tabListeners = new Map<string, Set<() => void>>();
const targetListeners = new Set<() => void>();
let shellViews: ReadonlyMap<string, string> = new Map();
let shellListener: ShellListener | null = null;
let pending: { collection: string; id: string } | null = null;

function notifyTargets(): void {
  for (const listener of targetListeners) {
    listener();
  }
}

export function navigateTo(collection: string, id: string): void {
  const view = shellViews.get(collection);
  if (view !== undefined) {
    shellListener?.(view);
  }
  for (const switchTab of tabListeners.get(collection) ?? []) {
    switchTab();
  }
  const listener = listeners.get(collection);
  if (listener !== undefined) {
    listener(id);
  } else {
    pending = { collection, id };
  }
}

export function onNavigationTo(collection: string, cb: Listener): () => void {
  listeners.set(collection, cb);
  if (pending?.collection === collection) {
    const { id } = pending;
    pending = null;
    cb(id);
  }
  return () => {
    listeners.delete(collection);
  };
}

export function onTabNavigation(
  tabs: Readonly<Record<string, string>>,
  cb: TabListener
): () => void {
  const own = new Map<string, () => void>();
  for (const [collection, tab] of Object.entries(tabs)) {
    const switchTab = (): void => {
      cb(tab);
    };
    own.set(collection, switchTab);
    const switches = tabListeners.get(collection) ?? new Set<() => void>();
    switches.add(switchTab);
    tabListeners.set(collection, switches);
  }
  if (pending !== null) {
    own.get(pending.collection)?.();
  }
  return () => {
    for (const [collection, switchTab] of own) {
      const switches = tabListeners.get(collection);
      switches?.delete(switchTab);
      if (switches?.size === 0) {
        tabListeners.delete(collection);
      }
    }
  };
}

export function onShellNavigation(
  views: Readonly<Record<string, string>>,
  cb: ShellListener
): () => void {
  shellViews = new Map(Object.entries(views));
  shellListener = cb;
  notifyTargets();
  return () => {
    shellViews = new Map();
    shellListener = null;
    notifyTargets();
  };
}

export function canNavigateTo(collection: string): boolean {
  return shellViews.has(collection);
}

export function subscribeNavigationTargets(listener: () => void): () => void {
  targetListeners.add(listener);
  return () => {
    targetListeners.delete(listener);
  };
}
