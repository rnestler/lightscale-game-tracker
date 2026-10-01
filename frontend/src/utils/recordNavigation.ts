type Listener = (id: string) => void;
type RouteListener = (id: string | null) => void;
type ShellListener = (view: string) => void;
type TabListener = (tab: string) => void;
const listeners = new Map<string, Listener>();
const tabListeners = new Map<string, Set<() => void>>();
const targetListeners = new Set<() => void>();
let shellViews: ReadonlyMap<string, string> = new Map();
let shellListener: ShellListener | null = null;
let pending: { collection: string; id: string } | null = null;
let pendingPage: string | null = null;
let reachableViews: ReadonlySet<string> | null = null;

function stateText(state: unknown, key: string): string | null {
  if (typeof state !== 'object' || state === null || !(key in state)) {
    return null;
  }
  const value: unknown = Reflect.get(state, key);
  return typeof value === 'string' ? value : null;
}

let shownJump: string | null = stateText(window.history.state, 'jump');
let jumps = 0;
const workspacePages: ReadonlySet<string> = new Set([
  'leaderboards',
  'matches',
  'games',
  'players',
  'gameLeaderboards',
]);

export function recordAddress(collection: string, id: string): string {
  return `/app?${encodeURIComponent(collection)}=${encodeURIComponent(id)}`;
}

function notifyTargets(): void {
  for (const listener of targetListeners) {
    listener();
  }
}

function notifyPathChange(): void {
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function navigateToPath(path: string): void {
  window.history.pushState(null, '', path);
  shownJump = null;
  notifyPathChange();
}

export function replacePath(path: string): void {
  window.history.replaceState(null, '', path);
  notifyPathChange();
}

export function adoptPath(path: string): string {
  window.history.replaceState(null, '', path);
  return window.location.pathname;
}

export function openSignIn(returnTo?: string): void {
  const query = returnTo === undefined ? '' : `?returnTo=${encodeURIComponent(returnTo)}`;
  navigateToPath(`/login${query}`);
}

export function isAuthRoute(path: string): boolean {
  const cleaned = path.replace(/\/+$/, '') || '/';
  return ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'].includes(
    cleaned
  );
}

export function sameOriginReturn(returnTo: string | null): string | null {
  if (returnTo === null || !URL.canParse(returnTo, window.location.origin)) {
    return null;
  }
  const target = new URL(returnTo, window.location.origin);
  const leavesOrigin =
    target.protocol !== window.location.protocol ||
    target.origin !== window.location.origin ||
    target.pathname.startsWith('//');
  if (leavesOrigin || isAuthRoute(target.pathname)) {
    return null;
  }
  return `${target.pathname}${target.search}${target.hash}`;
}

export function returnAfterSignIn(): string {
  return sameOriginReturn(new URLSearchParams(window.location.search).get('returnTo')) ?? '/app';
}

interface AnchorClick {
  readonly button: number;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly currentTarget: { readonly href: string };
  preventDefault(): void;
}

export function followInApp(event: AnchorClick): void {
  const plainClick =
    event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  if (plainClick) {
    event.preventDefault();
    const target = new URL(event.currentTarget.href);
    navigateToPath(`${target.pathname}${target.search}${target.hash}`);
  }
}

function reachesShellView(collection: string): boolean {
  const view = shellViews.get(collection);
  return view !== undefined && (reachableViews === null || reachableViews.has(view));
}

function opensInWorkspace(target: string): boolean {
  return !shellViews.has(target) && workspacePages.has(target);
}

export function navigateTo(collection: string, id: string): void {
  const view = shellViews.get(collection);
  if (view !== undefined && reachesShellView(collection)) {
    shellListener?.(view);
  }
  for (const switchTab of tabListeners.get(collection) ?? []) {
    switchTab();
  }
  const listener = listeners.get(collection);
  if (listener !== undefined) {
    listener(id);
    return;
  }
  if (opensInWorkspace(collection)) {
    navigateToPath(recordAddress(collection, id));
    return;
  }
  pending = { collection, id };
}

export function navigateToPage(page: string, onNavigate?: (view: string) => void): void {
  if (opensInWorkspace(page)) {
    pendingPage = page;
    navigateToPath('/app');
    return;
  }
  if (shellListener === null) {
    if (onNavigate === undefined) {
      openSignIn();
    } else {
      onNavigate(page);
    }
    return;
  }
  const view = shellViews.get(page);
  if (view !== undefined && reachesShellView(page)) {
    shellListener(view);
  }
  const switches = tabListeners.get(page);
  if (switches === undefined || switches.size === 0) {
    pendingPage = view === page ? null : page;
    return;
  }
  for (const switchTab of switches) {
    switchTab();
  }
}

export function onNavigationTo(collection: string, cb: Listener): () => void {
  listeners.set(collection, cb);
  notifyTargets();
  if (pending?.collection === collection) {
    const { id } = pending;
    pending = null;
    cb(id);
  }
  return () => {
    if (listeners.get(collection) === cb) {
      listeners.delete(collection);
      notifyTargets();
    }
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
  notifyTargets();
  if (pending !== null) {
    own.get(pending.collection)?.();
  }
  if (pendingPage !== null) {
    const switchTab = own.get(pendingPage);
    if (switchTab !== undefined) {
      pendingPage = null;
      switchTab();
    }
  }
  return () => {
    for (const [collection, switchTab] of own) {
      const switches = tabListeners.get(collection);
      switches?.delete(switchTab);
      if (switches?.size === 0) {
        tabListeners.delete(collection);
      }
    }
    notifyTargets();
  };
}

export function onShellNavigation(
  views: Readonly<Record<string, string>>,
  cb: ShellListener
): () => void {
  shellViews = new Map(Object.entries(views));
  shellListener = cb;
  const awaited = pendingPage === null ? undefined : shellViews.get(pendingPage);
  if (awaited !== undefined) {
    if (awaited === pendingPage) {
      pendingPage = null;
    }
    cb(awaited);
  }
  notifyTargets();
  return () => {
    if (shellListener !== cb) {
      return;
    }
    shellViews = new Map();
    shellListener = null;
    pending = null;
    pendingPage = null;
    notifyTargets();
  };
}

export function recordRoute(collection: string): string | null {
  return new URLSearchParams(window.location.search).get(collection);
}

export function adoptRecordRoute(): void {
  const parameters = new URLSearchParams(window.location.search);
  for (const collection of workspacePages) {
    const id = parameters.get(collection);
    if (id !== null && id !== '') {
      navigateTo(collection, id);
      return;
    }
  }
}

function addressWith(name: string, value: string | null): string {
  const parameters = new URLSearchParams(window.location.search);
  if (value === null) {
    parameters.delete(name);
  } else {
    parameters.set(name, value);
  }
  const query = parameters.toString();
  return window.location.pathname + (query === '' ? '' : `?${query}`) + window.location.hash;
}

function writeParameter(name: string, value: string | null): void {
  const url = addressWith(name, value);
  if (value === null) {
    window.history.replaceState(window.history.state, '', url);
  } else {
    window.history.pushState(null, '', url);
    shownJump = null;
  }
}

export function openRecordRoute(collection: string, id: string | null): void {
  writeParameter(collection, id);
}

export function onRecordRoute(collection: string, listen: RouteListener): () => void {
  const onPopState = (): void => {
    listen(recordRoute(collection));
  };
  window.addEventListener('popstate', onPopState);
  return () => {
    window.removeEventListener('popstate', onPopState);
  };
}

export interface CarriedView {
  readonly band: string;
  readonly tab: string | null;
  readonly tabField: string | null;
  readonly query: string;
  readonly filters: Readonly<Partial<Record<string, readonly string[]>>>;
}

const FILTER_PREFIX = 'filter.';
const VIEW_SUFFIX = '.view';
interface ViewListener {
  readonly refresh: () => void;
  readonly hear: (encoded: string | null) => void;
}

const viewListeners = new Map<string, Set<ViewListener>>();

function viewParameter(collection: string): string {
  return `${collection}${VIEW_SUFFIX}`;
}

function pageInAddress(): string | null {
  for (const name of new URLSearchParams(window.location.search).keys()) {
    if (name.endsWith(VIEW_SUFFIX)) {
      return name.slice(0, -VIEW_SUFFIX.length);
    }
  }
  return null;
}

let addressAdopted = false;

function adoptAddressedPage(): void {
  if (addressAdopted) {
    return;
  }
  addressAdopted = true;
  const page = pageInAddress();
  if (page !== null && shellListener !== null && reachesShellView(page)) {
    navigateToPage(page);
  }
}

function encodedParameter(collection: string): string | null {
  return new URLSearchParams(window.location.search).get(viewParameter(collection));
}

export function carriedView(collection: string, bands: readonly string[]): CarriedView | null {
  const fields = new URLSearchParams(encodedParameter(collection) ?? '');
  const band = fields.get('band');
  if (band === null || !bands.includes(band)) {
    return null;
  }
  const filters = new Map<string, string[]>();
  for (const [key, value] of fields) {
    if (key.startsWith(FILTER_PREFIX)) {
      const field = key.slice(FILTER_PREFIX.length);
      filters.set(field, [...(filters.get(field) ?? []), value]);
    }
  }
  return {
    band,
    tab: fields.get('tab'),
    tabField: fields.get('tabfield'),
    query: fields.get('q') ?? '',
    filters: Object.fromEntries(filters),
  };
}

function encodedView(view: CarriedView): string {
  const fields = new URLSearchParams({ band: view.band });
  if (view.tab !== null) {
    fields.set('tab', view.tab);
  }
  if (view.tabField !== null) {
    fields.set('tabfield', view.tabField);
  }
  if (view.query !== '') {
    fields.set('q', view.query);
  }
  for (const [field, values] of Object.entries(view.filters)) {
    for (const value of values ?? []) {
      fields.append(`${FILTER_PREFIX}${field}`, value);
    }
  }
  return fields.toString();
}

function announceView(collection: string): void {
  for (const listener of viewListeners.get(collection) ?? []) {
    listener.refresh();
  }
}

export function carryView(collection: string, view: CarriedView, origin: string): void {
  jumps += 1;
  const jump = `${Date.now()}-${jumps}`;
  const here = window.location.pathname + window.location.search + window.location.hash;
  window.history.replaceState({ jump, origin }, '', here);
  window.history.pushState(
    { jump, collection },
    '',
    addressWith(viewParameter(collection), encodedView(view))
  );
  shownJump = jump;
  announceView(collection);
}

export function chooseCarriedView(collection: string, band: string | null): void {
  const encoded =
    band === null ? null : encodedView({ band, tab: null, tabField: null, query: '', filters: {} });
  window.history.replaceState(
    window.history.state,
    '',
    addressWith(viewParameter(collection), encoded)
  );
  for (const listener of viewListeners.get(collection) ?? []) {
    listener.hear(encoded);
  }
}

export function dropCarriedView(collection: string): void {
  writeParameter(viewParameter(collection), null);
  announceView(collection);
}

function dropUnshownView(collection: string): void {
  const parameter = viewParameter(collection);
  const shown = (viewListeners.get(collection)?.size ?? 0) > 0;
  if (!shown && new URLSearchParams(window.location.search).has(parameter)) {
    writeParameter(parameter, null);
  }
}

export function onCarriedView(
  collection: string,
  bands: readonly string[],
  listen: (view: CarriedView | null) => void
): () => void {
  let heard = encodedParameter(collection);
  const listener: ViewListener = {
    refresh: (): void => {
      const current = encodedParameter(collection);
      if (current !== heard) {
        heard = current;
        listen(carriedView(collection, bands));
      }
    },
    hear: (encoded: string | null): void => {
      heard = encoded;
    },
  };
  const listening = viewListeners.get(collection) ?? new Set<ViewListener>();
  listening.add(listener);
  viewListeners.set(collection, listening);
  window.addEventListener('popstate', listener.refresh);
  return () => {
    listening.delete(listener);
    window.removeEventListener('popstate', listener.refresh);
    setTimeout(() => {
      dropUnshownView(collection);
    }, 0);
  };
}

export function canNavigateTo(collection: string): boolean {
  return reachesShellView(collection) || tabListeners.has(collection) || listeners.has(collection);
}

export function canOpenRecord(collection: string): boolean {
  return canNavigateTo(collection) || opensInWorkspace(collection);
}

export function canReachPage(page: string, navigates: boolean): boolean {
  if (opensInWorkspace(page)) {
    return true;
  }
  if (shellListener === null) {
    return navigates || canNavigateTo(page);
  }
  return reachesShellView(page) || tabListeners.has(page);
}

export function hasShell(): boolean {
  return shellListener !== null;
}

export function restrictShellViews(views: readonly string[]): () => void {
  const restriction = new Set(views);
  reachableViews = restriction;
  adoptAddressedPage();
  notifyTargets();
  return () => {
    if (reachableViews !== restriction) {
      return;
    }
    reachableViews = null;
    notifyTargets();
  };
}

export function subscribeNavigationTargets(listener: () => void): () => void {
  targetListeners.add(listener);
  return () => {
    targetListeners.delete(listener);
  };
}

function returnToOrigin(origin: string): void {
  const overview = `${origin}#overview`;
  const view = shellViews.get(origin);
  const tabbed = tabListeners.has(origin) || tabListeners.has(overview);
  if (shellListener === null || (!reachesShellView(origin) && !tabbed)) {
    return;
  }
  if (view !== undefined && reachesShellView(origin)) {
    shellListener(view);
  }
  for (const switchTab of [
    ...(tabListeners.get(origin) ?? []),
    ...(tabListeners.get(overview) ?? []),
  ]) {
    switchTab();
  }
}

function followJump(state: unknown): void {
  const jump = stateText(state, 'jump');
  const paired = jump !== null && jump === shownJump;
  shownJump = jump;
  const origin = stateText(state, 'origin');
  const collection = stateText(state, 'collection');
  if (paired && origin !== null) {
    returnToOrigin(origin);
  }
  if (paired && collection !== null && shellListener !== null && canReachPage(collection, true)) {
    navigateToPage(collection);
  }
}

window.addEventListener('popstate', (event) => {
  followJump(event.state);
});
