interface FileEntry {
    name: string;
    content: string;
}
export interface DirEntry {
    name?: string;
    files?: FileEntry[];
    dirs?: DirEntry[];
}
export declare function createStructure(basePath: string, entry: DirEntry): void;
export {};
//# sourceMappingURL=create.d.ts.map