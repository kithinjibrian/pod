import ts from "typescript";
import { Store } from "@/store";
export interface MacroContext {
    node: ts.CallExpression;
    sourceFile: ts.SourceFile;
    ts: typeof ts;
    factory: ts.NodeFactory;
    store: Store;
    graph: MacroDependencyGraph;
    get program(): ts.Program;
    get checker(): ts.TypeChecker;
    error(msg: string): never;
}
interface MacroNode {
    key: string;
    variableName: string;
    node: ts.CallExpression;
    sourceFile: ts.SourceFile;
    filePath: string;
    dependencies: Set<string>;
    value: any;
    computed: boolean;
}
declare class MacroDependencyGraph {
    private nodes;
    private projectRoot;
    private typeChecker?;
    constructor(projectRoot: string);
    setTypeChecker(checker: ts.TypeChecker): void;
    createKey(sourceFile: ts.SourceFile, variableName: string): string;
    addNode(key: string, variableName: string, node: ts.CallExpression, sourceFile: ts.SourceFile): void;
    getNode(key: string): MacroNode | undefined;
    addDependency(fromKey: string, toKey: string): void;
    setValue(key: string, value: any): void;
    getValue(key: string): any;
    isComputed(key: string): boolean;
    topologicalSort(): string[];
    clear(): void;
    getNodesForFile(filePath: string): MacroNode[];
}
export declare function getGlobalMacroGraph(projectRoot: string): MacroDependencyGraph;
export declare function resetGlobalMacroGraph(): void;
export declare function expandMacros(source: string, filePath: string, projectRoot?: string): Promise<string>;
export {};
//# sourceMappingURL=expand_macros.d.ts.map