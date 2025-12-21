type SymbolKind = "class" | "function" | "variable" | "interface" | "type" | "enum" | "namespace" | "unknown";
interface SymbolInfo {
    name: string;
    kind: SymbolKind;
    decorators?: string[];
    isDefault?: boolean;
}
interface ImportInfo {
    sourcePath: string;
    resolvedPath: string | null;
    symbols: SymbolInfo[];
}
export interface FileNode {
    filePath: string;
    isTsx: boolean;
    directive: "public" | "interactive" | null;
    imports: ImportInfo[];
    exports: SymbolInfo[];
}
export interface DependencyGraph {
    [filePath: string]: FileNode;
}
export declare function buildGraph(entryPoints: string[]): DependencyGraph;
export {};
//# sourceMappingURL=graph.d.ts.map