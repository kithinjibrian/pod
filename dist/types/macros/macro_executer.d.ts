type MacroFunction = Function & {
    name: string;
};
declare class MacroExecutor {
    private cache;
    getMacro(filePath: string, macroName?: string): MacroFunction;
    private loadMacros;
    clearCache(filePath?: string): void;
}
export declare function macroExecuter(): MacroExecutor;
export {};
//# sourceMappingURL=macro_executer.d.ts.map