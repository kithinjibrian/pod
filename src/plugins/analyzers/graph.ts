import { parseSync } from "@swc/core";
import * as fs from "fs";
import * as path from "path";
import type { Module, Decorator } from "@swc/core";

type SymbolKind =
  | "class"
  | "function"
  | "variable"
  | "interface"
  | "type"
  | "enum"
  | "namespace"
  | "unknown";

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

function resolveFilePath(fromFile: string, importPath: string): string | null {
  if (!importPath.startsWith(".")) {
    return null;
  }

  const dir = path.dirname(fromFile);
  const basePath = path.resolve(dir, importPath);

  const extensions = ["", ".ts", ".tsx", ".js", ".jsx"];
  for (const ext of extensions) {
    const fullPath = basePath + ext;
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return fullPath;
    }
  }

  const indexFiles = ["/index.ts", "/index.tsx", "/index.js", "/index.jsx"];
  for (const indexFile of indexFiles) {
    const fullPath = basePath + indexFile;
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

function extractDecorators(decorators?: Decorator[]): string[] {
  if (!decorators || decorators.length === 0) return [];

  return decorators
    .map((decorator) => {
      if (decorator.expression.type === "CallExpression") {
        if (decorator.expression.callee.type === "Identifier") {
          return decorator.expression.callee.value;
        }
      } else if (decorator.expression.type === "Identifier") {
        return decorator.expression.value;
      }
      return "unknown";
    })
    .filter((name) => name !== "unknown");
}

function extractDirective(ast: Module): "public" | "interactive" | null {
  for (const item of ast.body) {
    if (
      item.type === "ExpressionStatement" &&
      item.expression.type === "StringLiteral"
    ) {
      const value = item.expression.value;
      if (value === "use public") return "public";
      if (value === "use interactive") return "interactive";
    }
    if (
      item.type !== "ExpressionStatement" ||
      item.expression.type !== "StringLiteral"
    ) {
      break;
    }
  }
  return null;
}

function extractExports(ast: Module): SymbolInfo[] {
  const exports: SymbolInfo[] = [];

  for (const item of ast.body) {
    if (item.type === "ExportDeclaration" && item.declaration) {
      const decl = item.declaration;

      if (decl.type === "ClassDeclaration" && decl.identifier) {
        const decorators = extractDecorators(decl.decorators);
        exports.push({
          name: decl.identifier.value,
          kind: "class",
          decorators: decorators.length > 0 ? decorators : undefined,
        });
      } else if (decl.type === "FunctionDeclaration" && decl.identifier) {
        exports.push({ name: decl.identifier.value, kind: "function" });
      } else if (decl.type === "VariableDeclaration") {
        for (const declarator of decl.declarations) {
          if (declarator.id.type === "Identifier") {
            exports.push({ name: declarator.id.value, kind: "variable" });
          }
        }
      } else if (decl.type === "TsInterfaceDeclaration") {
        exports.push({ name: decl.id.value, kind: "interface" });
      } else if (decl.type === "TsTypeAliasDeclaration") {
        exports.push({ name: decl.id.value, kind: "type" });
      } else if (decl.type === "TsEnumDeclaration") {
        exports.push({ name: decl.id.value, kind: "enum" });
      }
    }

    if (item.type === "ExportNamedDeclaration") {
      for (const spec of item.specifiers) {
        if (spec.type === "ExportSpecifier") {
          exports.push({ name: spec.orig.value, kind: "unknown" });
        }
      }
    }

    if (item.type === "ExportDefaultDeclaration") {
      const decl = item.decl;
      let kind: SymbolKind = "unknown";
      let decorators: string[] | undefined;

      if (decl.type === "ClassExpression") {
        kind = "class";
        decorators = extractDecorators(decl.decorators);
      } else if (decl.type === "FunctionExpression") {
        kind = "function";
      } else if (decl.type === "TsInterfaceDeclaration") {
        kind = "interface";
      }

      exports.push({
        name: "default",
        kind,
        isDefault: true,
        decorators:
          decorators && decorators.length > 0 ? decorators : undefined,
      });
    }

    if (item.type === "ExportDefaultExpression") {
      exports.push({ name: "default", kind: "unknown", isDefault: true });
    }
  }

  return exports;
}

function extractImports(
  ast: Module
): Array<{ path: string; specifiers: any[] }> {
  const imports: Array<{ path: string; specifiers: any[] }> = [];

  for (const item of ast.body) {
    if (item.type === "ImportDeclaration") {
      imports.push({
        path: item.source.value,
        specifiers: item.specifiers,
      });
    }
  }

  return imports;
}

export function buildGraph(entryPoints: string[]): DependencyGraph {
  const graph: DependencyGraph = {};
  const visited = new Set<string>();

  function processFile(filePath: string): void {
    const allowed =
      filePath.endsWith(".ts") ||
      filePath.endsWith(".tsx") ||
      filePath.endsWith(".js") ||
      filePath.endsWith(".jsx");

    if (!allowed) return;

    if (visited.has(filePath)) return;
    visited.add(filePath);

    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      return;
    }

    const isTsx = filePath.endsWith(".tsx") || filePath.endsWith(".jsx");

    const content = fs.readFileSync(filePath, "utf-8");
    const ast = parseSync(content, {
      syntax: "typescript",
      tsx: isTsx,
      decorators: true,
    });

    const directive = extractDirective(ast);
    const exports = extractExports(ast);
    const rawImports = extractImports(ast);

    for (const { path: importPath } of rawImports) {
      const resolved = resolveFilePath(filePath, importPath);
      if (resolved) {
        processFile(resolved);
      }
    }

    const imports: ImportInfo[] = [];
    for (const { path: importPath, specifiers } of rawImports) {
      const resolvedPath = resolveFilePath(filePath, importPath);
      const sourceExports =
        resolvedPath && graph[resolvedPath] ? graph[resolvedPath].exports : [];
      const symbols: SymbolInfo[] = [];

      for (const spec of specifiers) {
        if (spec.type === "ImportDefaultSpecifier") {
          const defaultExport = sourceExports.find((e) => e.isDefault);
          symbols.push({
            name: spec.local.value,
            kind: defaultExport?.kind || "unknown",
            decorators: defaultExport?.decorators,
            isDefault: true,
          });
        } else if (spec.type === "ImportNamespaceSpecifier") {
          symbols.push({
            name: spec.local.value,
            kind: "namespace",
          });
        } else if (spec.type === "ImportSpecifier") {
          const importedName = spec.imported
            ? spec.imported.value
            : spec.local.value;
          const exportedSymbol = sourceExports.find(
            (e) => e.name === importedName
          );
          symbols.push({
            name: importedName,
            kind: exportedSymbol?.kind || "unknown",
            decorators: exportedSymbol?.decorators,
          });
        }
      }

      imports.push({
        sourcePath: importPath,
        resolvedPath,
        symbols,
      });
    }

    graph[filePath] = {
      filePath,
      isTsx,
      directive,
      imports,
      exports,
    };
  }

  for (const entry of entryPoints) {
    const resolved = path.resolve(entry);
    processFile(resolved);
  }

  return graph;
}
