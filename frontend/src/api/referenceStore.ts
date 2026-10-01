type StoreListener = () => void;

export interface TypeView<T> {
  get(id: string): T | undefined;
  created(): readonly string[];
}

export function sameIds(current: readonly string[], loaded: readonly string[]): boolean {
  return current.length === loaded.length && current.every((id, index) => id === loaded[index]);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      return false;
    }
    const leftItems: readonly unknown[] = left;
    const rightItems: readonly unknown[] = right;
    return (
      leftItems.length === rightItems.length &&
      leftItems.every((item, index) => sameValue(item, rightItems[index]))
    );
  }
  if (!isPlainObject(left) || !isPlainObject(right)) {
    return false;
  }
  const leftEntries = Object.entries(left);
  return (
    leftEntries.length === Object.keys(right).length &&
    leftEntries.every(([key, value]) => key in right && sameValue(value, right[key]))
  );
}

class ReferenceStore {
  private readonly store = new Map<string, Map<string, object>>();
  private readonly createdIds = new Map<string, string[]>();
  private readonly views = new Map<string, TypeView<unknown>>();
  private readonly listeners = new Set<StoreListener>();
  private serverRevision = 0;

  set<T extends { id: string }>(typeName: string, data: T): T {
    let typeMap = this.store.get(typeName);
    if (typeMap === undefined) {
      typeMap = new Map();
      this.store.set(typeName, typeMap);
    }
    const existing = typeMap.get(data.id);
    if (existing !== undefined && sameValue(existing, data)) {
      return existing as T;
    }
    const reference = { ...data };
    typeMap.set(data.id, reference);
    this.changed(typeName);
    return reference;
  }

  get<T>(typeName: string, id: string): T | undefined {
    return this.store.get(typeName)?.get(id) as T | undefined;
  }

  register(typeName: string, id: string): void {
    const ids = this.createdIds.get(typeName) ?? [];
    if (ids.includes(id)) {
      return;
    }
    this.createdIds.set(typeName, [...ids, id]);
    this.changed(typeName);
  }

  created(typeName: string): readonly string[] {
    return this.createdIds.get(typeName) ?? [];
  }

  delete(typeName: string, id: string): void {
    const removed = this.store.get(typeName)?.delete(id) ?? false;
    const created = this.createdIds.get(typeName) ?? [];
    const unregistered = created.includes(id);
    if (unregistered) {
      this.createdIds.set(
        typeName,
        created.filter((each) => each !== id)
      );
    }
    if (removed || unregistered) {
      this.changed(typeName);
    }
  }

  view<T>(typeName: string): TypeView<T> {
    let view = this.views.get(typeName);
    if (view === undefined) {
      view = this.buildView(typeName);
      this.views.set(typeName, view);
    }
    return view as TypeView<T>;
  }

  readonly revision = (): number => this.serverRevision;

  invalidate(): void {
    this.serverRevision += 1;
    this.notify();
  }

  readonly subscribe = (listener: StoreListener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private buildView(typeName: string): TypeView<unknown> {
    return {
      get: (id: string): unknown => this.get(typeName, id),
      created: (): readonly string[] => this.created(typeName),
    };
  }

  private changed(typeName: string): void {
    this.views.set(typeName, this.buildView(typeName));
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const referenceStore = new ReferenceStore();
