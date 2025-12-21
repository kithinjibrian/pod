export declare class Store {
    private static instance;
    private containers;
    private constructor();
    static getInstance(): Store;
    set<T>(key: string, value: T): void;
    get<T>(key: string): T[] | undefined;
    has(key: string): boolean;
    delete(key: string): boolean;
    clear(): void;
    keys(): IterableIterator<string>;
    get size(): number;
}
//# sourceMappingURL=store.d.ts.map