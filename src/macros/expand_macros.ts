import ts from "typescript";
import path from "path";
import Module from "node:module";
import { macroExecuter } from "./macro_executer";
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
  astResult?: ts.Node;
  computed: boolean;
}

class MacroDependencyGraph {
  private nodes = new Map<string, MacroNode>();
  private projectRoot: string;
  private typeChecker?: ts.TypeChecker;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  setTypeChecker(checker: ts.TypeChecker) {
    this.typeChecker = checker;
  }

  createKey(sourceFile: ts.SourceFile, variableName: string): string {
    const relativePath = path.relative(this.projectRoot, sourceFile.fileName);
    const normalized = relativePath.replace(/\\/g, "/");
    return `${normalized}:${variableName}`;
  }

  addNode(
    key: string,
    variableName: string,
    node: ts.CallExpression,
    sourceFile: ts.SourceFile
  ) {
    if (!this.nodes.has(key)) {
      this.nodes.set(key, {
        key,
        variableName,
        node,
        sourceFile,
        filePath: sourceFile.fileName,
        dependencies: new Set(),
        value: undefined,
        computed: false,
      });
    }
  }

  getNode(key: string): MacroNode | undefined {
    return this.nodes.get(key);
  }

  addDependency(fromKey: string, toKey: string) {
    const node = this.nodes.get(fromKey);
    if (node) {
      node.dependencies.add(toKey);
    }
  }

  setValue(key: string, value: any, astResult: ts.Node) {
    const node = this.nodes.get(key);
    if (node) {
      node.value = value;
      node.computed = true;
      node.astResult = astResult;
    }
  }

  getValue(key: string): any {
    return this.nodes.get(key)?.value;
  }

  isComputed(key: string): boolean {
    return this.nodes.get(key)?.computed ?? false;
  }

  topologicalSort(): string[] {
    const visited = new Set<string>();
    const inProgress = new Set<string>();
    const sorted: string[] = [];

    const visit = (key: string, path: string[] = []) => {
      if (visited.has(key)) return;

      if (inProgress.has(key)) {
        const cycle = [...path, key].join(" -> ");
        throw new Error(`Circular macro dependency detected: ${cycle}`);
      }

      const node = this.nodes.get(key);
      if (!node) return;

      inProgress.add(key);

      for (const depKey of node.dependencies) {
        visit(depKey, [...path, key]);
      }

      inProgress.delete(key);
      visited.add(key);
      sorted.push(key);
    };

    for (const key of this.nodes.keys()) {
      visit(key);
    }

    return sorted;
  }

  clear() {
    this.nodes.clear();
  }

  getNodesForFile(filePath: string): MacroNode[] {
    return Array.from(this.nodes.values()).filter(
      (node) => node.filePath === filePath
    );
  }
}

let globalGraph: MacroDependencyGraph | null = null;

export function getGlobalMacroGraph(projectRoot: string): MacroDependencyGraph {
  if (!globalGraph) {
    globalGraph = new MacroDependencyGraph(projectRoot);
  }
  return globalGraph;
}

export function resetGlobalMacroGraph() {
  globalGraph = null;
}

function resolveImportSpecifier(
  importPath: string,
  fromFile: string,
  compilerOptions: ts.CompilerOptions
): string | undefined {
  const resolved = ts.resolveModuleName(
    importPath,
    fromFile,
    compilerOptions,
    ts.sys
  );

  if (resolved.resolvedModule?.resolvedFileName) {
    return resolved.resolvedModule.resolvedFileName;
  }

  try {
    const requireFromFile = Module.createRequire(fromFile);
    return requireFromFile.resolve(importPath);
  } catch (e) {
    return undefined;
  }
}

function resolveImportFullPath(
  symbolName: string,
  sourceFile: ts.SourceFile,
  compilerOptions: ts.CompilerOptions
): { importPath: string; resolvedPath: string | undefined } | undefined {
  let importPath: string | undefined;

  sourceFile.forEachChild((node) => {
    if (!ts.isImportDeclaration(node) || !node.importClause) return;

    const { namedBindings, name } = node.importClause;

    if (name && name.text === symbolName) {
      importPath = (node.moduleSpecifier as ts.StringLiteral).text;
    }

    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const specifier of namedBindings.elements) {
        const importedName = specifier.name.text;
        if (importedName === symbolName) {
          importPath = (node.moduleSpecifier as ts.StringLiteral).text;
        }
      }
    }

    if (namedBindings && ts.isNamespaceImport(namedBindings)) {
      if (symbolName.startsWith(namedBindings.name.text + ".")) {
        importPath = (node.moduleSpecifier as ts.StringLiteral).text;
      }
    }
  });

  if (!importPath) return undefined;

  const resolvedPath = resolveImportSpecifier(
    importPath,
    sourceFile.fileName,
    compilerOptions
  );

  return {
    importPath: importPath.startsWith(".") ? resolvedPath! : importPath,
    resolvedPath,
  };
}

function isNpmPackage(importPath: string): boolean {
  return (
    !importPath.startsWith(".") &&
    !importPath.startsWith("/") &&
    !path.isAbsolute(importPath)
  );
}

function findVariableDeclarationInFile(
  variableName: string,
  sourceFile: ts.SourceFile
): ts.VariableDeclaration | undefined {
  let found: ts.VariableDeclaration | undefined;

  function visit(node: ts.Node) {
    if (found) return;

    if (ts.isVariableDeclaration(node)) {
      if (ts.isIdentifier(node.name) && node.name.text === variableName) {
        found = node;
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

function createEvaluator(
  graph: MacroDependencyGraph,
  currentFileKey: string,
  sourceFile: ts.SourceFile,
  compilerOptions: ts.CompilerOptions
) {
  const trackedDependencies: string[] = [];

  function evaluateArgumentValue(arg: ts.Expression): any {
    if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
      return arg.text;
    }
    if (ts.isNumericLiteral(arg)) {
      return Number(arg.text);
    }
    if (arg.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (arg.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (arg.kind === ts.SyntaxKind.NullKeyword) return null;
    if (arg.kind === ts.SyntaxKind.UndefinedKeyword) return undefined;

    if (ts.isTemplateExpression(arg)) {
      let result = arg.head.text;
      for (const span of arg.templateSpans) {
        const exprValue = evaluateArgumentValue(span.expression);
        result += String(exprValue) + span.literal.text;
      }
      return result;
    }

    if (ts.isObjectLiteralExpression(arg)) {
      const obj: any = {};
      for (const prop of arg.properties) {
        if (ts.isPropertyAssignment(prop)) {
          const key = ts.isIdentifier(prop.name)
            ? prop.name.text
            : ts.isStringLiteral(prop.name)
            ? prop.name.text
            : ts.isNumericLiteral(prop.name)
            ? prop.name.text
            : ts.isComputedPropertyName(prop.name)
            ? evaluateArgumentValue(prop.name.expression)
            : undefined;

          if (key !== undefined) {
            obj[key] = evaluateArgumentValue(prop.initializer);
          }
        } else if (ts.isShorthandPropertyAssignment(prop)) {
          const name = prop.name.text;
          obj[name] = resolveIdentifier(prop.name);
        } else if (ts.isSpreadAssignment(prop)) {
          const spread = evaluateArgumentValue(prop.expression);
          Object.assign(obj, spread);
        }
      }
      return obj;
    }

    if (ts.isArrayLiteralExpression(arg)) {
      return arg.elements
        .map((el) => {
          if (ts.isSpreadElement(el)) {
            const spread = evaluateArgumentValue(el.expression);
            return Array.isArray(spread) ? spread : [spread];
          }
          return evaluateArgumentValue(el);
        })
        .flat();
    }

    if (ts.isPrefixUnaryExpression(arg)) {
      const operand = evaluateArgumentValue(arg.operand);
      switch (arg.operator) {
        case ts.SyntaxKind.MinusToken:
          return -operand;
        case ts.SyntaxKind.PlusToken:
          return +operand;
        case ts.SyntaxKind.ExclamationToken:
          return !operand;
        case ts.SyntaxKind.TildeToken:
          return ~operand;
      }
    }

    if (ts.isBinaryExpression(arg)) {
      const left = evaluateArgumentValue(arg.left);
      const right = evaluateArgumentValue(arg.right);

      switch (arg.operatorToken.kind) {
        case ts.SyntaxKind.PlusToken:
          return left + right;
        case ts.SyntaxKind.MinusToken:
          return left - right;
        case ts.SyntaxKind.AsteriskToken:
          return left * right;
        case ts.SyntaxKind.SlashToken:
          return left / right;
        case ts.SyntaxKind.PercentToken:
          return left % right;
        case ts.SyntaxKind.AsteriskAsteriskToken:
          return left ** right;
        case ts.SyntaxKind.EqualsEqualsToken:
          return left == right;
        case ts.SyntaxKind.EqualsEqualsEqualsToken:
          return left === right;
        case ts.SyntaxKind.ExclamationEqualsToken:
          return left != right;
        case ts.SyntaxKind.ExclamationEqualsEqualsToken:
          return left !== right;
        case ts.SyntaxKind.LessThanToken:
          return left < right;
        case ts.SyntaxKind.LessThanEqualsToken:
          return left <= right;
        case ts.SyntaxKind.GreaterThanToken:
          return left > right;
        case ts.SyntaxKind.GreaterThanEqualsToken:
          return left >= right;
        case ts.SyntaxKind.AmpersandAmpersandToken:
          return left && right;
        case ts.SyntaxKind.BarBarToken:
          return left || right;
        case ts.SyntaxKind.QuestionQuestionToken:
          return left ?? right;
      }
    }

    if (ts.isParenthesizedExpression(arg)) {
      return evaluateArgumentValue(arg.expression);
    }

    if (ts.isConditionalExpression(arg)) {
      const condition = evaluateArgumentValue(arg.condition);
      return condition
        ? evaluateArgumentValue(arg.whenTrue)
        : evaluateArgumentValue(arg.whenFalse);
    }

    if (ts.isPropertyAccessExpression(arg)) {
      const obj = evaluateArgumentValue(arg.expression);
      const propName = arg.name.text;
      return obj?.[propName];
    }

    if (ts.isElementAccessExpression(arg)) {
      const obj = evaluateArgumentValue(arg.expression);
      const index = evaluateArgumentValue(arg.argumentExpression);
      return obj?.[index];
    }

    if (ts.isIdentifier(arg)) {
      return resolveIdentifier(arg);
    }

    return arg.getText();
  }

  function resolveIdentifier(identifier: ts.Identifier): any {
    const name = identifier.text;

    const declaration = findVariableDeclarationInFile(name, sourceFile);

    if (declaration && declaration.initializer) {
      const varStatement = declaration.parent.parent as ts.VariableStatement;
      const isConst = varStatement.declarationList.flags & ts.NodeFlags.Const;

      if (!isConst) {
        throw new Error(
          `Macro argument '${name}' must be a const variable. let/var are not allowed.`
        );
      }

      if (ts.isCallExpression(declaration.initializer)) {
        const expr = declaration.initializer.expression;

        if (ts.isIdentifier(expr) && expr.text.endsWith("$")) {
          const depKey = graph.createKey(sourceFile, name);

          trackedDependencies.push(depKey);

          const value = graph.getValue(depKey);

          if (value !== undefined) {
            return value;
          }

          throw new Error(
            `Macro dependency '${name}' has not been computed yet. This should not happen.`
          );
        }
      }

      return evaluateArgumentValue(declaration.initializer);
    }

    const resolved = resolveImportFullPath(name, sourceFile, compilerOptions);

    if (resolved) {
      if (isNpmPackage(resolved.importPath)) {
        throw new Error(
          `Cannot resolve identifier '${name}' from npm package '${resolved.importPath}'. ` +
            `Macro arguments from npm packages must be constants that can be evaluated at compile time.`
        );
      }

      if (!resolved.resolvedPath) {
        throw new Error(
          `Could not resolve import path: ${resolved.importPath}`
        );
      }

      const importedSource = ts.sys.readFile(resolved.resolvedPath);
      if (!importedSource) {
        throw new Error(
          `Could not read imported file: ${resolved.resolvedPath}`
        );
      }

      const importedSourceFile = ts.createSourceFile(
        resolved.resolvedPath,
        importedSource,
        ts.ScriptTarget.Latest,
        true
      );

      const importedDecl = findVariableDeclarationInFile(
        name,
        importedSourceFile
      );

      if (importedDecl && importedDecl.initializer) {
        if (ts.isCallExpression(importedDecl.initializer)) {
          const expr = importedDecl.initializer.expression;
          if (ts.isIdentifier(expr) && expr.text.endsWith("$")) {
            const depKey = graph.createKey(importedSourceFile, name);
            trackedDependencies.push(depKey);

            const value = graph.getValue(depKey);
            if (value !== undefined) {
              return value;
            }

            throw new Error(
              `Cross-file macro dependency '${name}' from '${resolved.resolvedPath}' needs to be computed first.`
            );
          }
        }

        const importedEvaluator = createEvaluator(
          graph,
          currentFileKey,
          importedSourceFile,
          compilerOptions
        );
        return importedEvaluator.evaluateArgumentValue(
          importedDecl.initializer
        );
      }
    }

    throw new Error(
      `Could not resolve identifier '${name}'. Make sure it's a const variable or imported constant.`
    );
  }

  return {
    evaluateArgumentValue,
    getTrackedDependencies: () => trackedDependencies,
  };
}

function extractValueFromASTNode(node: ts.Node): any {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (node.kind === ts.SyntaxKind.UndefinedKeyword) return undefined;

  if (ts.isObjectLiteralExpression(node)) {
    const obj: any = {};
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const key = ts.isIdentifier(prop.name)
          ? prop.name.text
          : ts.isStringLiteral(prop.name)
          ? prop.name.text
          : ts.isNumericLiteral(prop.name)
          ? prop.name.text
          : ts.isComputedPropertyName(prop.name)
          ? extractValueFromASTNode(prop.name.expression)
          : undefined;

        if (key !== undefined) {
          obj[key] = extractValueFromASTNode(prop.initializer);
        }
      } else if (ts.isShorthandPropertyAssignment(prop)) {
        obj[prop.name.text] = prop.name.text;
      } else if (ts.isSpreadAssignment(prop)) {
        const spread = extractValueFromASTNode(prop.expression);
        if (typeof spread === "object" && spread !== null) {
          Object.assign(obj, spread);
        }
      }
    }
    return obj;
  }
}

export async function expandMacros(
  source: string,
  filePath: string,
  projectRoot: string = process.cwd()
): Promise<string> {
  if (!source.includes("$(") && !source.includes("$`")) {
    return source;
  }

  const compilerOptions: ts.CompilerOptions = {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.Latest,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
  };

  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const graph = getGlobalMacroGraph(projectRoot);

  const getProgram = () =>
    ts.createProgram([filePath], {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
    });

  const getTypeChecker = () => getProgram()?.getTypeChecker();

  function discoverMacros(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      if (
        ts.isCallExpression(node.initializer) &&
        ts.isIdentifier(node.initializer.expression) &&
        node.initializer.expression.text.endsWith("$")
      ) {
        if (ts.isIdentifier(node.name)) {
          const variableName = node.name.text;
          const key = graph.createKey(sourceFile, variableName);
          graph.addNode(key, variableName, node.initializer, sourceFile);
        }
      }
    }
    ts.forEachChild(node, discoverMacros);
  }

  discoverMacros(sourceFile);

  const fileNodes = graph.getNodesForFile(filePath);

  for (const macroNode of fileNodes) {
    if (graph.isComputed(macroNode.key)) continue;

    const evaluator = createEvaluator(
      graph,
      macroNode.key,
      macroNode.sourceFile,
      compilerOptions
    );

    try {
      for (const arg of macroNode.node.arguments) {
        evaluator.evaluateArgumentValue(arg);
      }
      const deps = evaluator.getTrackedDependencies();

      for (const dep of deps) {
        graph.addDependency(macroNode.key, dep);
      }
    } catch (e) {}
  }

  const sortedKeys = graph.topologicalSort();

  for (const key of sortedKeys) {
    const macroNode = graph.getNode(key);
    if (!macroNode || graph.isComputed(key)) continue;

    const node = macroNode.node;
    const name = (node.expression as ts.Identifier).text;

    const resolved = resolveImportFullPath(
      name,
      macroNode.sourceFile,
      compilerOptions
    );

    if (!resolved) {
      throw new Error(`Could not resolve macro import for '${name}'`);
    }

    const macro = macroExecuter().getMacro(resolved.importPath, name);

    if (!macro) {
      throw new Error(`Could not get macro '${name}' for key '${key}'`);
    }

    const macroContext: MacroContext = {
      node,
      sourceFile: macroNode.sourceFile,
      ts,
      store: Store.getInstance(),
      factory: ts.factory,
      graph,
      get program() {
        return getProgram();
      },
      get checker() {
        return getTypeChecker();
      },
      error: (msg: string) => {
        throw new Error(msg);
      },
    };

    try {
      const evaluator = createEvaluator(
        graph,
        key,
        macroNode.sourceFile,
        compilerOptions
      );

      const userArgs = node.arguments.map((arg) =>
        evaluator.evaluateArgumentValue(arg)
      );

      const result = macro(...userArgs, macroContext);

      if (!result || typeof result !== "object" || !("kind" in result)) {
        throw new Error(`Macro '${name}' must return a TypeScript AST node`);
      }

      const value = extractValueFromASTNode(result);

      graph.setValue(key, value, result);
    } catch (e: any) {
      console.error(`Macro '${name}' execution failed: ${e?.message ?? e}`);
      throw e;
    }
  }

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visit = (node: ts.Node): ts.Node => {
      if (ts.isVariableDeclaration(node) && node.initializer) {
        if (
          ts.isCallExpression(node.initializer) &&
          ts.isIdentifier(node.initializer.expression) &&
          node.initializer.expression.text.endsWith("$") &&
          ts.isIdentifier(node.name)
        ) {
          const key = graph.createKey(sourceFile, node.name.text);
          const macroNode = graph.getNode(key);

          if (macroNode && graph.isComputed(key)) {
            const result = graph.getNode(key)!;

            return context.factory.updateVariableDeclaration(
              node,
              node.name,
              node.exclamationToken,
              node.type,
              result.astResult as any
            );
          }
        }
      }

      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const name = node.expression.text;

        if (name.endsWith("$")) {
          const resolved = resolveImportFullPath(
            name,
            sourceFile,
            compilerOptions
          );

          if (resolved) {
            const macro = macroExecuter().getMacro(resolved.importPath, name);

            if (macro) {
              const macroContext: MacroContext = {
                node,
                sourceFile,
                ts,
                graph,
                store: Store.getInstance(),
                factory: context.factory,
                get program() {
                  return getProgram();
                },
                get checker() {
                  return getTypeChecker();
                },
                error: (msg: string) => {
                  throw new Error(msg);
                },
              };

              try {
                const tempKey = `${graph.createKey(sourceFile, "__temp__")}:${
                  node.pos
                }`;
                const evaluator = createEvaluator(
                  graph,
                  tempKey,
                  sourceFile,
                  compilerOptions
                );

                const userArgs = node.arguments.map((arg) =>
                  evaluator.evaluateArgumentValue(arg)
                );

                const result = macro(...userArgs, macroContext);

                if (
                  !result ||
                  typeof result !== "object" ||
                  !("kind" in result)
                ) {
                  throw new Error(
                    `Macro '${name}' must return a TypeScript AST node`
                  );
                }

                return result;
              } catch (e: any) {
                console.log(
                  `Macro '${name}' execution failed: ${e?.message ?? e}`
                );
                return node;
              }
            }
          }
        }
      }

      return ts.visitEachChild(node, visit, context);
    };

    return (sf) => ts.visitNode(sf, visit) as ts.SourceFile;
  };

  const result = ts.transform(sourceFile, [transformer]);
  const output = ts.createPrinter().printFile(result.transformed[0]);
  result.dispose();

  return output;
}
