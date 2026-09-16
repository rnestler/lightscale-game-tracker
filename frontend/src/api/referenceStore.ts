type StoreListener = () => void;

export interface ReferenceSnapshot {
  get<T>(typeName: string, id: string): T | undefined;
  created(typeName: string): readonly string[];
}

class ReferenceStore {
  private readonly store = new Map<string, Map<string, object>>();
  private readonly createdIds = new Map<string, string[]>();
  private readonly listeners = new Set<StoreListener>();
  private snapshot: ReferenceSnapshot = this.buildSnapshot();

  set<T extends { id: string }>(typeName: string, data: T): T {
    let typeMap = this.store.get(typeName);
    if (typeMap === undefined) {
      typeMap = new Map();
      this.store.set(typeName, typeMap);
    }
    const existing = typeMap.get(data.id);
    if (existing !== undefined) {
      Object.assign(existing, data);
      this.notify();
      return existing as T;
    }
    const reference = { ...data };
    typeMap.set(data.id, reference);
    this.notify();
    return reference;
  }

  get<T>(typeName: string, id: string): T | undefined {
    return this.store.get(typeName)?.get(id) as T | undefined;
  }

  register(typeName: string, id: string): void {
    const ids = this.createdIds.get(typeName);
    if (ids === undefined) {
      this.createdIds.set(typeName, [id]);
    } else if (!ids.includes(id)) {
      ids.push(id);
    }
    this.notify();
  }

  created(typeName: string): readonly string[] {
    return this.createdIds.get(typeName) ?? [];
  }

  delete(typeName: string, id: string): void {
    this.store.get(typeName)?.delete(id);
    const ids = this.createdIds.get(typeName);
    if (ids !== undefined) {
      this.createdIds.set(
        typeName,
        ids.filter((each) => each !== id)
      );
    }
    this.notify();
  }

  readonly subscribe = (listener: StoreListener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): ReferenceSnapshot => this.snapshot;

  private buildSnapshot(): ReferenceSnapshot {
    return {
      get: <T>(typeName: string, id: string): T | undefined => this.get<T>(typeName, id),
      created: (typeName: string): readonly string[] => this.created(typeName),
    };
  }

  private notify(): void {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const referenceStore = new ReferenceStore();
