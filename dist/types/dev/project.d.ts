import * as ts from "typescript";
export declare class Project {
    program: ts.Program;
    checker: ts.TypeChecker;
    constructor(entryPoints: string[]);
    isPublicFile(sourceFile: ts.SourceFile): boolean;
    isInteractiveFile(sourceFile: ts.SourceFile): boolean;
}
//# sourceMappingURL=project.d.ts.map