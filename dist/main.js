#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/main.ts
import { Command } from "commander";

// src/dev/server.ts
import * as esbuild2 from "esbuild";
import { spawn } from "child_process";
import * as fs5 from "fs/promises";

// src/config/config.ts
import * as path from "path";
import { pathToFileURL } from "url";
import * as fs from "fs/promises";
var CONFIG_FILES = [
  "pod.config.js",
  "pod.config.mjs",
  "pod.config.ts",
  "pod.config.mts"
];
async function loadConfig(root = process.cwd()) {
  for (const configFile of CONFIG_FILES) {
    const configPath = path.resolve(root, configFile);
    try {
      await fs.access(configPath);
      if (configFile.endsWith(".ts") || configFile.endsWith(".mts")) {
        return await loadTsConfig(configPath);
      }
      return await loadJsConfig(configPath);
    } catch (error) {
      continue;
    }
  }
  return getDefaultConfig();
}
async function loadJsConfig(configPath) {
  try {
    const fileUrl = pathToFileURL(configPath).href;
    const configModule = await import(`${fileUrl}?t=${Date.now()}`);
    const config = configModule.default || configModule;
    if (typeof config === "function") {
      return await config();
    }
    return config;
  } catch (error) {
    console.error(`\u274C Failed to load config from ${configPath}:`, error);
    throw error;
  }
}
async function loadTsConfig(configPath) {
  try {
    const esbuild3 = await import("esbuild");
    const result = await esbuild3.build({
      entryPoints: [configPath],
      bundle: true,
      platform: "node",
      format: "esm",
      write: false,
      sourcemap: "inline",
      packages: "external"
    });
    const tempFile = `${configPath}.${Date.now()}.mjs`;
    await fs.writeFile(tempFile, result.outputFiles[0].text);
    try {
      const fileUrl = pathToFileURL(tempFile).href;
      const configModule = await import(fileUrl);
      const config = configModule.default || configModule;
      if (typeof config === "function") {
        return await config();
      }
      return config;
    } finally {
      await fs.unlink(tempFile).catch(() => {
      });
    }
  } catch (error) {
    console.error(
      `\u274C Failed to load TypeScript config from ${configPath}:`,
      error
    );
    throw error;
  }
}
function getDefaultConfig() {
  return {
    name: "app",
    build: {
      outDir: "dist",
      sourcemap: true,
      minify: false
    },
    plugins: [],
    client_plugins: [],
    server_plugins: []
  };
}
function mergeConfig(defaults, userConfig) {
  return {
    name: userConfig.name,
    build: { ...defaults.build, ...userConfig.build },
    plugins: [...defaults.plugins || [], ...userConfig.plugins || []],
    client_plugins: [
      ...defaults.client_plugins || [],
      ...userConfig.client_plugins || []
    ],
    server_plugins: [
      ...defaults.server_plugins || [],
      ...userConfig.server_plugins || []
    ]
  };
}

// src/plugins/index.ts
var plugins_exports = {};
__export(plugins_exports, {
  buildGraph: () => buildGraph,
  stylePlugin: () => stylePlugin,
  useMyPlugin: () => useMyPlugin
});

// src/plugins/my.ts
import * as fs2 from "fs/promises";
import { transform } from "@swc/core";
import * as babel from "@babel/core";
import * as path6 from "path";

// src/macros/index.ts
var macros_exports = {};
__export(macros_exports, {
  MacroExecutor: () => MacroExecutor,
  expandMacros: () => expandMacros,
  getGlobalMacroGraph: () => getGlobalMacroGraph,
  macroExecuter: () => macroExecuter,
  resetGlobalMacroGraph: () => resetGlobalMacroGraph
});

// src/macros/expand_macros.ts
import ts from "typescript";
import path3 from "path";
import Module2 from "node:module";

// src/macros/macro_executer.ts
import * as vm from "node:vm";
import * as esbuild from "esbuild";
import * as path2 from "node:path";
import Module from "node:module";
var MacroExecutor = class {
  constructor() {
    this.cache = /* @__PURE__ */ new Map();
  }
  getMacro(specifier, macroName) {
    if (!this.cache.has(specifier)) {
      this.load(specifier);
    }
    const macros = this.cache.get(specifier);
    if (macroName) {
      const fn = macros[macroName];
      if (!fn) {
        throw new Error(`Macro "${macroName}" not found in ${specifier}`);
      }
      return fn;
    }
    const names = Object.keys(macros);
    if (names.length === 1) {
      return macros[names[0]];
    }
    if (macros.default) {
      return macros.default;
    }
    throw new Error(`Multiple macros in ${specifier}: ${names.join(", ")}`);
  }
  load(specifier) {
    const requireFromHere = Module.createRequire(
      process.cwd() + "/package.json"
    );
    const entry = requireFromHere.resolve(specifier);
    const { outputFiles } = esbuild.buildSync({
      entryPoints: [entry],
      bundle: true,
      write: false,
      platform: "node",
      format: "cjs",
      external: [...Module.builtinModules]
    });
    const code = outputFiles[0].text;
    const sandboxRequire = Module.createRequire(entry);
    const sandbox = {
      module: { exports: {} },
      exports: {},
      require: sandboxRequire,
      console,
      __filename: entry,
      __dirname: path2.dirname(entry),
      process
    };
    sandbox.global = sandbox;
    const context2 = vm.createContext(sandbox);
    new vm.Script(code, { filename: entry }).runInContext(context2);
    const macros = {};
    const exports = sandbox.module.exports;
    console.log(exports);
    for (const [name, value] of Object.entries(exports)) {
      if (typeof value === "function" && name.endsWith("$")) {
        macros[name] = value;
      }
    }
    if (!Object.keys(macros).length) {
      throw new Error(`No macros found in ${specifier}`);
    }
    this.cache.set(specifier, macros);
  }
};
var macroExecutor = new MacroExecutor();
function macroExecuter() {
  return macroExecutor;
}

// src/store/index.ts
var store_exports = {};
__export(store_exports, {
  Store: () => Store
});

// src/store/store.ts
var Store = class _Store {
  constructor() {
    this.containers = /* @__PURE__ */ new Map();
  }
  static getInstance() {
    if (!_Store.instance) {
      _Store.instance = new _Store();
    }
    return _Store.instance;
  }
  set(key, value) {
    const existing = this.containers.get(key) || [];
    existing.push(value);
    this.containers.set(key, existing);
  }
  get(key) {
    const values = this.containers.get(key);
    return values;
  }
  has(key) {
    return this.containers.has(key);
  }
  delete(key) {
    return this.containers.delete(key);
  }
  clear() {
    this.containers.clear();
  }
  keys() {
    return this.containers.keys();
  }
  get size() {
    return this.containers.size;
  }
};

// src/macros/expand_macros.ts
var MacroDependencyGraph = class {
  constructor(projectRoot) {
    this.nodes = /* @__PURE__ */ new Map();
    this.projectRoot = projectRoot;
  }
  setTypeChecker(checker) {
    this.typeChecker = checker;
  }
  createKey(sourceFile, variableName) {
    const relativePath = path3.relative(this.projectRoot, sourceFile.fileName);
    const normalized = relativePath.replace(/\\/g, "/");
    return `${normalized}:${variableName}`;
  }
  addNode(key, variableName, node, sourceFile) {
    if (!this.nodes.has(key)) {
      this.nodes.set(key, {
        key,
        variableName,
        node,
        sourceFile,
        filePath: sourceFile.fileName,
        dependencies: /* @__PURE__ */ new Set(),
        value: void 0,
        computed: false
      });
    }
  }
  getNode(key) {
    return this.nodes.get(key);
  }
  addDependency(fromKey, toKey) {
    const node = this.nodes.get(fromKey);
    if (node) {
      node.dependencies.add(toKey);
    }
  }
  setValue(key, value, astResult) {
    const node = this.nodes.get(key);
    if (node) {
      node.value = value;
      node.computed = true;
      node.astResult = astResult;
    }
  }
  getValue(key) {
    return this.nodes.get(key)?.value;
  }
  isComputed(key) {
    return this.nodes.get(key)?.computed ?? false;
  }
  topologicalSort() {
    const visited = /* @__PURE__ */ new Set();
    const inProgress = /* @__PURE__ */ new Set();
    const sorted = [];
    const visit = (key, path14 = []) => {
      if (visited.has(key)) return;
      if (inProgress.has(key)) {
        const cycle = [...path14, key].join(" -> ");
        throw new Error(`Circular macro dependency detected: ${cycle}`);
      }
      const node = this.nodes.get(key);
      if (!node) return;
      inProgress.add(key);
      for (const depKey of node.dependencies) {
        visit(depKey, [...path14, key]);
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
  getNodesForFile(filePath) {
    return Array.from(this.nodes.values()).filter(
      (node) => node.filePath === filePath
    );
  }
};
var globalGraph = null;
function getGlobalMacroGraph(projectRoot) {
  if (!globalGraph) {
    globalGraph = new MacroDependencyGraph(projectRoot);
  }
  return globalGraph;
}
function resetGlobalMacroGraph() {
  globalGraph = null;
}
function resolveImportSpecifier(importPath, fromFile, compilerOptions) {
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
    const requireFromFile = Module2.createRequire(fromFile);
    return requireFromFile.resolve(importPath);
  } catch (e) {
    return void 0;
  }
}
function resolveImportFullPath(symbolName, sourceFile, compilerOptions) {
  let importPath;
  sourceFile.forEachChild((node) => {
    if (!ts.isImportDeclaration(node) || !node.importClause) return;
    const { namedBindings, name } = node.importClause;
    if (name && name.text === symbolName) {
      importPath = node.moduleSpecifier.text;
    }
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const specifier of namedBindings.elements) {
        const importedName = specifier.name.text;
        if (importedName === symbolName) {
          importPath = node.moduleSpecifier.text;
        }
      }
    }
    if (namedBindings && ts.isNamespaceImport(namedBindings)) {
      if (symbolName.startsWith(namedBindings.name.text + ".")) {
        importPath = node.moduleSpecifier.text;
      }
    }
  });
  if (!importPath) return void 0;
  const resolvedPath = resolveImportSpecifier(
    importPath,
    sourceFile.fileName,
    compilerOptions
  );
  return {
    importPath: importPath.startsWith(".") ? resolvedPath : importPath,
    resolvedPath
  };
}
function isNpmPackage(importPath) {
  return !importPath.startsWith(".") && !importPath.startsWith("/") && !path3.isAbsolute(importPath);
}
function findVariableDeclarationInFile(variableName, sourceFile) {
  let found;
  function visit(node) {
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
function createEvaluator(graph, currentFileKey, sourceFile, compilerOptions) {
  const trackedDependencies = [];
  function evaluateArgumentValue(arg) {
    if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
      return arg.text;
    }
    if (ts.isNumericLiteral(arg)) {
      return Number(arg.text);
    }
    if (arg.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (arg.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (arg.kind === ts.SyntaxKind.NullKeyword) return null;
    if (arg.kind === ts.SyntaxKind.UndefinedKeyword) return void 0;
    if (ts.isTemplateExpression(arg)) {
      let result = arg.head.text;
      for (const span of arg.templateSpans) {
        const exprValue = evaluateArgumentValue(span.expression);
        result += String(exprValue) + span.literal.text;
      }
      return result;
    }
    if (ts.isObjectLiteralExpression(arg)) {
      const obj = {};
      for (const prop of arg.properties) {
        if (ts.isPropertyAssignment(prop)) {
          const key = ts.isIdentifier(prop.name) ? prop.name.text : ts.isStringLiteral(prop.name) ? prop.name.text : ts.isNumericLiteral(prop.name) ? prop.name.text : ts.isComputedPropertyName(prop.name) ? evaluateArgumentValue(prop.name.expression) : void 0;
          if (key !== void 0) {
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
      return arg.elements.map((el) => {
        if (ts.isSpreadElement(el)) {
          const spread = evaluateArgumentValue(el.expression);
          return Array.isArray(spread) ? spread : [spread];
        }
        return evaluateArgumentValue(el);
      }).flat();
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
      return condition ? evaluateArgumentValue(arg.whenTrue) : evaluateArgumentValue(arg.whenFalse);
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
  function resolveIdentifier(identifier) {
    const name = identifier.text;
    const declaration = findVariableDeclarationInFile(name, sourceFile);
    if (declaration && declaration.initializer) {
      const varStatement = declaration.parent.parent;
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
          if (value !== void 0) {
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
          `Cannot resolve identifier '${name}' from npm package '${resolved.importPath}'. Macro arguments from npm packages must be constants that can be evaluated at compile time.`
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
            if (value !== void 0) {
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
    getTrackedDependencies: () => trackedDependencies
  };
}
function extractValueFromASTNode(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (node.kind === ts.SyntaxKind.UndefinedKeyword) return void 0;
  if (ts.isObjectLiteralExpression(node)) {
    const obj = {};
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const key = ts.isIdentifier(prop.name) ? prop.name.text : ts.isStringLiteral(prop.name) ? prop.name.text : ts.isNumericLiteral(prop.name) ? prop.name.text : ts.isComputedPropertyName(prop.name) ? extractValueFromASTNode(prop.name.expression) : void 0;
        if (key !== void 0) {
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
async function expandMacros(source, filePath, projectRoot = process.cwd()) {
  if (!source.includes("$(") && !source.includes("$`")) {
    return source;
  }
  const compilerOptions = {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.Latest,
    moduleResolution: ts.ModuleResolutionKind.NodeNext
  };
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const graph = getGlobalMacroGraph(projectRoot);
  const getProgram = () => ts.createProgram([filePath], {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext
  });
  const getTypeChecker = () => getProgram()?.getTypeChecker();
  function discoverMacros(node) {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      if (ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression) && node.initializer.expression.text.endsWith("$")) {
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
    } catch (e) {
    }
  }
  const sortedKeys = graph.topologicalSort();
  for (const key of sortedKeys) {
    const macroNode = graph.getNode(key);
    if (!macroNode || graph.isComputed(key)) continue;
    const node = macroNode.node;
    const name = node.expression.text;
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
    const macroContext = {
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
      error: (msg) => {
        throw new Error(msg);
      }
    };
    try {
      const evaluator = createEvaluator(
        graph,
        key,
        macroNode.sourceFile,
        compilerOptions
      );
      const userArgs = node.arguments.map(
        (arg) => evaluator.evaluateArgumentValue(arg)
      );
      const result2 = macro(...userArgs, macroContext);
      if (!result2 || typeof result2 !== "object" || !("kind" in result2)) {
        throw new Error(`Macro '${name}' must return a TypeScript AST node`);
      }
      const value = extractValueFromASTNode(result2);
      graph.setValue(key, value, result2);
    } catch (e) {
      console.error(`Macro '${name}' execution failed: ${e?.message ?? e}`);
      throw e;
    }
  }
  const transformer = (context2) => {
    const visit = (node) => {
      if (ts.isVariableDeclaration(node) && node.initializer) {
        if (ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression) && node.initializer.expression.text.endsWith("$") && ts.isIdentifier(node.name)) {
          const key = graph.createKey(sourceFile, node.name.text);
          const macroNode = graph.getNode(key);
          if (macroNode && graph.isComputed(key)) {
            const result2 = graph.getNode(key);
            return context2.factory.updateVariableDeclaration(
              node,
              node.name,
              node.exclamationToken,
              node.type,
              result2.astResult
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
              const macroContext = {
                node,
                sourceFile,
                ts,
                graph,
                store: Store.getInstance(),
                factory: context2.factory,
                get program() {
                  return getProgram();
                },
                get checker() {
                  return getTypeChecker();
                },
                error: (msg) => {
                  throw new Error(msg);
                }
              };
              try {
                const tempKey = `${graph.createKey(sourceFile, "__temp__")}:${node.pos}`;
                const evaluator = createEvaluator(
                  graph,
                  tempKey,
                  sourceFile,
                  compilerOptions
                );
                const userArgs = node.arguments.map(
                  (arg) => evaluator.evaluateArgumentValue(arg)
                );
                const result2 = macro(...userArgs, macroContext);
                if (!result2 || typeof result2 !== "object" || !("kind" in result2)) {
                  throw new Error(
                    `Macro '${name}' must return a TypeScript AST node`
                  );
                }
                return result2;
              } catch (e) {
                console.log(
                  `Macro '${name}' execution failed: ${e?.message ?? e}`
                );
                return node;
              }
            }
          }
        }
      }
      return ts.visitEachChild(node, visit, context2);
    };
    return (sf) => ts.visitNode(sf, visit);
  };
  const result = ts.transform(sourceFile, [transformer]);
  const output = ts.createPrinter().printFile(result.transformed[0]);
  result.dispose();
  return output;
}

// src/plugins/generators/generate_controller.ts
import * as path4 from "path";
import { parseSync } from "@swc/core";
function generateController(filePath, code) {
  const ast = parseSync(code, {
    syntax: "typescript",
    tsx: filePath.endsWith("x"),
    decorators: true
  });
  const serviceInfo = extractServiceInfo(ast);
  if (!serviceInfo || !serviceInfo.hasInjectable) return null;
  return generateControllerCode(serviceInfo, filePath);
}
function extractServiceInfo(ast) {
  let serviceClass = null;
  let hasInjectable = false;
  const importMap = {};
  for (const item of ast.body) {
    if (item.type === "ImportDeclaration") {
      const decl = item;
      const source = decl.source.value;
      decl.specifiers.forEach((spec) => {
        if (spec.type === "ImportSpecifier" || spec.type === "ImportDefaultSpecifier" || spec.type === "ImportNamespaceSpecifier") {
          importMap[spec.local.value] = source;
        }
      });
    }
    if (item.type === "ExportDeclaration" && item.declaration.type === "ClassDeclaration") {
      const classDecl = item.declaration;
      if (hasInjectableDecorator(classDecl.decorators)) {
        serviceClass = classDecl;
        hasInjectable = true;
      }
    }
  }
  if (!serviceClass || !serviceClass.identifier) return null;
  return {
    className: serviceClass.identifier.value,
    methods: extractMethods(serviceClass),
    hasInjectable,
    importMap
  };
}
function hasInjectableDecorator(decorators) {
  return decorators?.some((d) => {
    const expr = d.expression;
    return expr.type === "Identifier" && expr.value === "Injectable" || expr.type === "CallExpression" && expr.callee.type === "Identifier" && expr.callee.value === "Injectable";
  }) ?? false;
}
function extractMethods(classDecl) {
  const methods = [];
  for (const member of classDecl.body) {
    if (member.type === "ClassMethod" && member.accessibility === "public") {
      const method = member;
      const methodName = method.key.type === "Identifier" ? method.key.value : "";
      if (!methodName) continue;
      if (!method.function.async) {
        throw new Error(
          `Server action ${classDecl.identifier.value}.${methodName} must be async.`
        );
      }
      const { paramSchemas, returnSchema } = extractSignature(
        method.function.decorators,
        method.function.params.length
      );
      methods.push({
        name: methodName,
        params: extractMethodParams(method.function.params),
        returnType: extractReturnType(method.function.returnType),
        isAsync: true,
        paramSchemas,
        returnSchema
      });
    }
  }
  return methods;
}
function extractSignature(decorators, paramCount) {
  if (!decorators) return { paramSchemas: [] };
  for (const decorator of decorators) {
    const expr = decorator.expression;
    if (expr.type === "CallExpression" && expr.callee.type === "Identifier" && expr.callee.value === "Signature") {
      const args = expr.arguments;
      if (args.length === 0) return { paramSchemas: [] };
      const schemaStrings = args.map(
        (arg) => stringifyExpression(arg.expression)
      );
      if (args.length === 1) {
        return { paramSchemas: [], returnSchema: schemaStrings[0] };
      }
      return {
        paramSchemas: schemaStrings.slice(0, -1),
        returnSchema: schemaStrings[schemaStrings.length - 1]
      };
    }
  }
  return { paramSchemas: [] };
}
function stringifyExpression(expr) {
  if (expr.type === "Identifier") return expr.value;
  if (expr.type === "MemberExpression") {
    return `${stringifyExpression(expr.object)}.${expr.property.value || ""}`;
  }
  if (expr.type === "CallExpression") {
    const args = expr.arguments.map((a) => stringifyExpression(a.expression)).join(", ");
    return `${stringifyExpression(expr.callee)}(${args})`;
  }
  return "any";
}
function extractMethodParams(params) {
  return params.map((p) => {
    const pat = p.pat;
    return {
      name: pat.value,
      type: pat.typeAnnotation ? stringifyType(pat.typeAnnotation.typeAnnotation) : "any",
      decorators: []
    };
  });
}
function extractReturnType(node) {
  if (!node?.typeAnnotation) return "any";
  const type = node.typeAnnotation;
  if (type.type === "TsTypeReference" && type.typeName.value === "Promise") {
    return stringifyType(type.typeParams?.params[0]);
  }
  return stringifyType(type);
}
function stringifyType(node) {
  if (!node) return "any";
  switch (node.type) {
    case "TsKeywordType":
      return node.kind;
    case "TsTypeReference":
      const base = node.typeName.value;
      const args = node.typeParams ? `<${node.typeParams.params.map(stringifyType).join(", ")}>` : "";
      return base + args;
    case "TsArrayType":
      return `${stringifyType(node.elemType)}[]`;
    default:
      return "any";
  }
}
function generateControllerCode(serviceInfo, filePath) {
  const serviceName = serviceInfo.className;
  const controllerName = serviceName.replace(/Service$/, "AutoController");
  const serviceImportPath = `./${path4.basename(filePath).replace(/\.ts$/, "")}`;
  const importGroups = /* @__PURE__ */ new Map();
  const registerIdentifier = (id) => {
    const source = serviceInfo.importMap[id] || serviceImportPath;
    if (!importGroups.has(source)) importGroups.set(source, /* @__PURE__ */ new Set());
    importGroups.get(source).add(id);
  };
  serviceInfo.methods.forEach((m) => {
    [...m.paramSchemas, m.returnSchema].filter(Boolean).forEach((s) => {
      const matches = s.match(/[A-Z][a-zA-Z0-9]*/g);
      matches?.forEach(registerIdentifier);
      if (s.includes("z.")) registerIdentifier("z");
    });
  });
  let importStrings = `import { Controller, Post, Get, Body } from "@kithinji/orca";
`;
  importGroups.forEach((ids, source) => {
    const filteredIds = Array.from(ids).filter((id) => id !== serviceName);
    if (filteredIds.length > 0) {
      importStrings += `
import { ${filteredIds.join(
        ", "
      )} } from "${source}";`;
    }
  });
  const methods = serviceInfo.methods.map((m) => {
    const hasParams = m.params.length > 0;
    const bodyParam = hasParams ? `@Body() body: any` : "";
    let body = "";
    if (hasParams) {
      if (m.paramSchemas.length > 0) {
        body += `    const b = typeof body === 'object' && body !== null ? body : {};
`;
        m.params.forEach((p, i) => {
          body += `    const ${p.name} = ${m.paramSchemas[i]}.parse(b.${p.name});
`;
        });
      } else {
        body += `    const { ${m.params.map((p) => p.name).join(", ")} } = body;
`;
      }
    }
    const callArgs = m.params.map((p) => p.name).join(", ");
    const serviceCall = `this.${serviceName.charAt(0).toLowerCase() + serviceName.slice(1)}.${m.name}(${callArgs})`;
    if (m.returnSchema) {
      body += `    const res = await ${serviceCall};
    return ${m.returnSchema}.parse(res);`;
    } else {
      body += `    return ${serviceCall};`;
    }
    return `  @${hasParams ? "Post" : "Get"}("${m.name}")
  async ${m.name}(${bodyParam}): Promise<${m.returnType}> {
${body}
  }`;
  }).join("\n\n");
  return `${importStrings}

@Controller("/${serviceName}", {
  providedIn: "root",
})
export class ${controllerName} {
  constructor(private readonly ${serviceName.charAt(0).toLowerCase() + serviceName.slice(1)}: ${serviceName}) {}

${methods}
}`;
}

// src/plugins/generators/tsx_server_stub.ts
import * as path5 from "path";
import { createHash } from "crypto";
import { parseSync as parseSync2, printSync } from "@swc/core";
function generateServerStub(filePath, code) {
  const hash = createHash("md5").update(filePath).digest("hex").slice(0, 8);
  const relativeFromSrc = filePath.split("/src/")[1];
  const parsed = path5.parse(relativeFromSrc);
  const fileName = path5.join("src", parsed.dir, parsed.name);
  const ast = parseSync2(code, {
    syntax: "typescript",
    tsx: filePath.endsWith("x"),
    decorators: true
  });
  const importMap = {};
  for (const item of ast.body) {
    if (item.type === "ImportDeclaration") {
      const decl = item;
      for (const specifier of decl.specifiers ?? []) {
        let localName;
        if (specifier.type === "ImportSpecifier") {
          localName = specifier.local.value;
        } else if (specifier.type === "ImportDefaultSpecifier") {
          localName = specifier.local.value;
        } else {
          continue;
        }
        importMap[localName] = decl.source.value;
      }
    }
  }
  const preservedNodes = [];
  const stubbedClasses = [];
  for (const item of ast.body) {
    let shouldStub = false;
    if (item.type === "ExportDeclaration" && item.declaration?.type === "ClassDeclaration") {
      const classDecl = item.declaration;
      if (hasComponentDecorator(classDecl.decorators)) {
        shouldStub = true;
        const stub = extractClassStub(classDecl);
        if (stub) {
          stubbedClasses.push(stub);
        }
      }
    }
    if (!shouldStub) {
      preservedNodes.push(item);
    }
  }
  const preservedCode = preservedNodes.length > 0 ? printSync({
    type: "Module",
    span: ast.span,
    body: preservedNodes,
    interpreter: ast.interpreter
  }).code : "";
  const stubCode = stubbedClasses.map((stub) => generateClassCode(stub, hash, fileName)).join("\n\n");
  return `
${preservedCode}
${stubCode}
  `.trim();
}
function hasComponentDecorator(decorators) {
  if (!decorators) return false;
  return decorators.some((decorator) => {
    const expr = decorator.expression;
    if (expr.type === "Identifier" && expr.value === "Component") {
      return true;
    }
    if (expr.type === "CallExpression" && expr.callee.type === "Identifier" && expr.callee.value === "Component") {
      return true;
    }
    return false;
  });
}
function extractClassStub(classDecl) {
  const className = classDecl.identifier?.value;
  if (!className) return null;
  let propsType = "{}";
  const decorators = [];
  if (classDecl.decorators) {
    for (const dec of classDecl.decorators) {
      const str = stringifyDecorator(dec);
      if (str) decorators.push(str);
    }
  }
  for (const member of classDecl.body) {
    if (member.type === "ClassProperty") {
      if (member.key.type === "Identifier" && member.key.value === "props") {
        propsType = extractPropsType(member);
      }
    }
  }
  return {
    name: className,
    propsType,
    decorators
  };
}
function stringifyDecorator(decorator) {
  const expr = decorator.expression;
  if (expr.type === "CallExpression" && expr.callee.type === "Identifier") {
    return `@${expr.callee.value}()`;
  }
  if (expr.type === "Identifier") {
    return `@${expr.value}`;
  }
  return "";
}
function extractPropsType(member) {
  const typeAnn = member.typeAnnotation?.typeAnnotation;
  if (!typeAnn) return "{}";
  if (typeAnn.type === "TsTypeLiteral") {
    const props = [];
    for (const m of typeAnn.members) {
      if (m.type === "TsPropertySignature") {
        const key = m.key.type === "Identifier" ? m.key.value : "?";
        const t = m.typeAnnotation ? stringifyType2(m.typeAnnotation.typeAnnotation) : "any";
        props.push(`${key}: ${t}`);
      }
    }
    return `{ ${props.join("; ")} }`;
  }
  return stringifyType2(typeAnn);
}
function stringifyType2(typeNode) {
  if (!typeNode) return "any";
  switch (typeNode.type) {
    case "TsKeywordType":
      return typeNode.kind;
    case "TsTypeReference":
      if (typeNode.typeName.type === "Identifier")
        return typeNode.typeName.value;
      if (typeNode.typeName.type === "TsQualifiedName") {
        return `${stringifyQualifiedName(typeNode.typeName.left)}.${typeNode.typeName.right.value}`;
      }
      return "any";
    case "TsArrayType":
      return `${stringifyType2(typeNode.elemType)}[]`;
    case "TsUnionType":
      return typeNode.types.map(stringifyType2).join(" | ");
    case "TsIntersectionType":
      return typeNode.types.map(stringifyType2).join(" & ");
    default:
      return "any";
  }
}
function stringifyQualifiedName(node) {
  if (node.type === "Identifier") return node.value;
  if (node.type === "TsQualifiedName") {
    return `${stringifyQualifiedName(node.left)}.${node.right.value}`;
  }
  return "any";
}
function generateClassCode(stub, hash, fileName) {
  const clientId = `${stub.name}_${hash}`;
  const clientPath = `/${fileName}.js`;
  const decoratorsStr = stub.decorators.length > 0 ? stub.decorators.join("\n") + "\n" : "";
  return `
${decoratorsStr}export class ${stub.name} {
  props!: ${stub.propsType};
  constructor() {}
  build() {
    const inputProps = { ...this.props };
    return {
      $$typeof: Symbol.for("orca.client.component"),
      id: "${clientId}_" + Math.random().toString(36).slice(2, 9),
      type: "${stub.name}",
      props: {
        ...inputProps,
        __clientComponent: {
          id: "${clientId}",
          path: "${clientPath}",
          name: "${stub.name}",
        }
      },
      key: null
    };
  }
}
`.trim();
}

// src/plugins/transformers/j2d.ts
var NodeTypeGuards = class {
  constructor(t) {
    this.t = t;
  }
  isSignalMember(expr) {
    return this.t.isMemberExpression(expr) && this.t.isIdentifier(expr.property, { name: "value" });
  }
  isObservableMember(expr) {
    return this.t.isMemberExpression(expr) && this.t.isIdentifier(expr.property, { name: "$value" });
  }
};
var ASTUtilities = class {
  constructor(t, guards) {
    this.t = t;
    this.guards = guards;
  }
  getObject(expr) {
    if (this.guards.isSignalMember(expr) || this.guards.isObservableMember(expr)) {
      return expr.object;
    }
    return expr;
  }
  replaceThisWithSelf(node) {
    const cloned = this.t.cloneNode(node, true);
    this.walkAndTransform(cloned, (n) => {
      if (this.t.isThisExpression(n)) {
        Object.assign(n, this.t.identifier("self"));
      }
    });
    return cloned;
  }
  walkAndTransform(node, transform2) {
    if (!node || typeof node !== "object") return;
    transform2(node);
    for (const key in node) {
      if (this.shouldSkipKey(key)) continue;
      const value = node[key];
      if (Array.isArray(value)) {
        value.forEach((item) => this.walkAndTransform(item, transform2));
      } else if (value && typeof value === "object") {
        this.walkAndTransform(value, transform2);
      }
    }
  }
  shouldSkipKey(key) {
    return ["loc", "start", "end", "extra"].includes(key);
  }
  buildMemberExpression(name) {
    const parts = name.split(".");
    let expr = this.t.identifier(parts[0]);
    for (let i = 1; i < parts.length; i++) {
      expr = this.t.memberExpression(expr, this.t.identifier(parts[i]));
    }
    return expr;
  }
  insertBeforeReturn(body, statements) {
    const returnIndex = body.findIndex(
      (stmt) => this.t.isReturnStatement(stmt)
    );
    if (returnIndex !== -1) {
      body.splice(returnIndex, 0, ...statements);
    } else {
      body.push(...statements);
    }
  }
};
var JSXUtilities = class {
  constructor(t) {
    this.t = t;
  }
  getComponentName(nameNode) {
    if (this.t.isJSXIdentifier(nameNode)) {
      return nameNode.name;
    }
    if (this.t.isJSXMemberExpression(nameNode)) {
      const parts = [];
      let current = nameNode;
      while (this.t.isJSXMemberExpression(current)) {
        parts.unshift(current.property.name);
        current = current.object;
      }
      if (this.t.isJSXIdentifier(current)) {
        parts.unshift(current.name);
      }
      return parts.join(".");
    }
    return null;
  }
  isComponentTag(tag) {
    return tag ? /^[A-Z]/.test(tag) : false;
  }
};
var ObservableManager = class {
  constructor(t, guards) {
    this.t = t;
    this.guards = guards;
  }
  getObservableKey(expr) {
    return this.stringifyNode(expr);
  }
  stringifyNode(node) {
    if (!node) return "";
    if (this.t.isThisExpression(node)) return "this";
    if (this.t.isIdentifier(node)) return node.name;
    if (this.t.isMemberExpression(node)) {
      const obj = this.stringifyNode(node.object);
      const prop = node.computed ? `[${this.stringifyNode(node.property)}]` : `.${node.property.name}`;
      return obj + prop;
    }
    if (this.t.isCallExpression(node)) {
      const callee = this.stringifyNode(node.callee);
      const args = node.arguments.map((arg) => this.stringifyNode(arg)).join(",");
      return `${callee}(${args})`;
    }
    if (this.t.isStringLiteral(node)) return `"${node.value}"`;
    if (this.t.isNumericLiteral(node)) return String(node.value);
    return node.type + JSON.stringify(node.name || node.value || "");
  }
  collectObservables(node, observables, astUtils) {
    this.walkNode(node, (n) => {
      if (this.guards.isObservableMember(n)) {
        const observable = astUtils.replaceThisWithSelf(
          n.object
        );
        const key = this.getObservableKey(observable);
        if (!observables.has(key)) {
          observables.set(key, observable);
        }
      }
    });
  }
  replaceObservablesWithSignals(node, observableSignals, astUtils) {
    const cloned = this.t.cloneNode(node, true);
    this.walkNode(cloned, (n) => {
      if (this.guards.isObservableMember(n)) {
        const observable = astUtils.replaceThisWithSelf(n.object);
        const key = this.getObservableKey(observable);
        const signalId = observableSignals.get(key);
        if (signalId) {
          n.object = signalId;
          n.property = this.t.identifier("value");
        }
      }
    });
    return cloned;
  }
  walkNode(node, callback) {
    if (!node || typeof node !== "object") return;
    callback(node);
    for (const key in node) {
      if (["loc", "start", "end", "extra"].includes(key)) continue;
      const value = node[key];
      if (Array.isArray(value)) {
        value.forEach((item) => this.walkNode(item, callback));
      } else if (value && typeof value === "object") {
        this.walkNode(value, callback);
      }
    }
  }
};
var ElementTransformer = class {
  constructor(t, guards, astUtils, jsxUtils, observableManager) {
    this.t = t;
    this.guards = guards;
    this.astUtils = astUtils;
    this.jsxUtils = jsxUtils;
    this.observableManager = observableManager;
  }
  transformElement(path14, scope, context2) {
    if (this.t.isJSXFragment(path14.node)) {
      return this.transformFragment(
        path14,
        scope,
        context2
      );
    }
    return this.transformJSXElement(
      path14,
      scope,
      context2
    );
  }
  transformJSXElement(path14, scope, context2) {
    const jsxElement = path14.node;
    const tag = this.jsxUtils.getComponentName(jsxElement.openingElement.name);
    const isComponent = this.jsxUtils.isComponentTag(tag);
    if (isComponent && tag) {
      return this.transformComponentElement(jsxElement, tag, scope, context2);
    } else if (tag) {
      return this.transformDOMElement(jsxElement, tag, scope, context2);
    }
    return {
      id: scope.generateUidIdentifier("el"),
      statements: []
    };
  }
  transformComponentElement(jsxElement, tag, scope, context2) {
    const elId = scope.generateUidIdentifier("el");
    const statements = [];
    const props = [];
    const children = [];
    this.processComponentAttributes(
      jsxElement.openingElement.attributes,
      props,
      context2
    );
    this.processChildren(
      jsxElement.children,
      children,
      statements,
      scope,
      context2
    );
    if (children.length > 0) {
      props.push(
        this.t.objectProperty(
          this.t.identifier("children"),
          children.length === 1 ? children[0] : this.t.arrayExpression(children)
        )
      );
    }
    statements.push(
      this.t.variableDeclaration("var", [
        this.t.variableDeclarator(
          elId,
          this.t.callExpression(this.t.identifier("$createComponent"), [
            this.astUtils.buildMemberExpression(tag),
            this.t.objectExpression(props),
            this.t.identifier("self")
          ])
        )
      ])
    );
    return { id: elId, statements };
  }
  transformDOMElement(jsxElement, tag, scope, context2) {
    const elId = scope.generateUidIdentifier("el");
    const statements = [];
    statements.push(
      this.t.variableDeclaration("var", [
        this.t.variableDeclarator(
          elId,
          this.t.callExpression(
            this.t.memberExpression(
              this.t.identifier("document"),
              this.t.identifier("createElement")
            ),
            [this.t.stringLiteral(tag)]
          )
        )
      ])
    );
    const { hasRef, refValue, hasDangerousHTML, dangerousHTMLValue } = this.processDOMAttributes(
      jsxElement.openingElement.attributes,
      elId,
      statements,
      context2
    );
    if (hasRef && refValue) {
      statements.push(
        this.t.expressionStatement(
          this.t.assignmentExpression("=", refValue, elId)
        )
      );
    }
    if (hasDangerousHTML && dangerousHTMLValue) {
      statements.push(
        this.t.expressionStatement(
          this.t.assignmentExpression(
            "=",
            this.t.memberExpression(elId, this.t.identifier("innerHTML")),
            this.t.memberExpression(
              dangerousHTMLValue,
              this.t.identifier("__html")
            )
          )
        )
      );
    }
    if (!hasDangerousHTML) {
      this.processDOMChildren(
        jsxElement.children,
        elId,
        statements,
        scope,
        context2
      );
    }
    return { id: elId, statements };
  }
  transformFragment(path14, scope, context2) {
    const fragId = scope.generateUidIdentifier("frag");
    const statements = [];
    statements.push(
      this.t.variableDeclaration("var", [
        this.t.variableDeclarator(
          fragId,
          this.t.callExpression(
            this.t.memberExpression(
              this.t.identifier("document"),
              this.t.identifier("createDocumentFragment")
            ),
            []
          )
        )
      ])
    );
    this.processDOMChildren(
      path14.node.children,
      fragId,
      statements,
      scope,
      context2
    );
    return { id: fragId, statements };
  }
  processComponentAttributes(attributes, props, context2) {
    for (const attr of attributes) {
      if (this.t.isJSXSpreadAttribute(attr)) {
        this.observableManager.collectObservables(
          attr.argument,
          context2.observables,
          this.astUtils
        );
        const replaced = this.observableManager.replaceObservablesWithSignals(
          attr.argument,
          context2.observableSignals,
          this.astUtils
        );
        props.push(
          this.t.spreadElement(this.astUtils.replaceThisWithSelf(replaced))
        );
        continue;
      }
      const key = attr.name.name;
      if (this.t.isStringLiteral(attr.value)) {
        props.push(this.t.objectProperty(this.t.identifier(key), attr.value));
      } else if (this.t.isJSXExpressionContainer(attr.value)) {
        const expr = attr.value.expression;
        this.observableManager.collectObservables(
          expr,
          context2.observables,
          this.astUtils
        );
        if (this.guards.isSignalMember(expr) || this.guards.isObservableMember(expr)) {
          const replaced = this.observableManager.replaceObservablesWithSignals(
            expr,
            context2.observableSignals,
            this.astUtils
          );
          props.push(
            this.t.objectMethod(
              "get",
              this.t.identifier(key),
              [],
              this.t.blockStatement([
                this.t.returnStatement(
                  this.astUtils.replaceThisWithSelf(replaced)
                )
              ])
            )
          );
        } else {
          const replaced = this.observableManager.replaceObservablesWithSignals(
            expr,
            context2.observableSignals,
            this.astUtils
          );
          props.push(
            this.t.objectProperty(
              this.t.identifier(key),
              this.astUtils.replaceThisWithSelf(replaced)
            )
          );
        }
      } else {
        props.push(
          this.t.objectProperty(
            this.t.identifier(key),
            this.t.booleanLiteral(true)
          )
        );
      }
    }
  }
  processDOMAttributes(attributes, elId, statements, context2) {
    let hasRef = false;
    let refValue = null;
    let hasDangerousHTML = false;
    let dangerousHTMLValue = null;
    for (const attr of attributes) {
      if (this.t.isJSXSpreadAttribute(attr)) {
        this.observableManager.collectObservables(
          attr.argument,
          context2.observables,
          this.astUtils
        );
        const replaced = this.observableManager.replaceObservablesWithSignals(
          attr.argument,
          context2.observableSignals,
          this.astUtils
        );
        statements.push(
          this.t.expressionStatement(
            this.t.callExpression(this.t.identifier("$spread"), [
              elId,
              this.astUtils.replaceThisWithSelf(replaced)
            ])
          )
        );
        continue;
      }
      const key = attr.name.name;
      if (key === "ref") {
        hasRef = true;
        if (this.t.isJSXExpressionContainer(attr.value)) {
          this.observableManager.collectObservables(
            attr.value.expression,
            context2.observables,
            this.astUtils
          );
          const replaced = this.observableManager.replaceObservablesWithSignals(
            attr.value.expression,
            context2.observableSignals,
            this.astUtils
          );
          refValue = this.astUtils.replaceThisWithSelf(replaced);
        }
        continue;
      }
      if (key === "dangerouslySetInnerHTML") {
        hasDangerousHTML = true;
        if (this.t.isJSXExpressionContainer(attr.value)) {
          this.observableManager.collectObservables(
            attr.value.expression,
            context2.observables,
            this.astUtils
          );
          const replaced = this.observableManager.replaceObservablesWithSignals(
            attr.value.expression,
            context2.observableSignals,
            this.astUtils
          );
          dangerousHTMLValue = this.astUtils.replaceThisWithSelf(replaced);
        }
        continue;
      }
      if (/^on[A-Z]/.test(key)) {
        this.processEventListener(key, attr, elId, statements, context2);
        continue;
      }
      if (key === "style" && this.t.isJSXExpressionContainer(attr.value)) {
        this.processStyleAttribute(attr, elId, statements, context2);
        continue;
      }
      this.processRegularAttribute(key, attr, elId, statements, context2);
    }
    return { hasRef, refValue, hasDangerousHTML, dangerousHTMLValue };
  }
  processEventListener(key, attr, elId, statements, context2) {
    const eventName = key.slice(2).toLowerCase();
    let handler = this.t.nullLiteral();
    if (this.t.isJSXExpressionContainer(attr.value)) {
      this.observableManager.collectObservables(
        attr.value.expression,
        context2.observables,
        this.astUtils
      );
      const replaced = this.observableManager.replaceObservablesWithSignals(
        attr.value.expression,
        context2.observableSignals,
        this.astUtils
      );
      handler = this.astUtils.replaceThisWithSelf(replaced);
    }
    statements.push(
      this.t.expressionStatement(
        this.t.callExpression(
          this.t.memberExpression(elId, this.t.identifier("addEventListener")),
          [this.t.stringLiteral(eventName), handler]
        )
      )
    );
  }
  processStyleAttribute(attr, elId, statements, context2) {
    if (!this.t.isJSXExpressionContainer(attr.value)) return;
    this.observableManager.collectObservables(
      attr.value.expression,
      context2.observables,
      this.astUtils
    );
    const replaced = this.observableManager.replaceObservablesWithSignals(
      attr.value.expression,
      context2.observableSignals,
      this.astUtils
    );
    statements.push(
      this.t.expressionStatement(
        this.t.callExpression(this.t.identifier("$style"), [
          elId,
          this.t.arrowFunctionExpression(
            [],
            this.astUtils.replaceThisWithSelf(replaced)
          )
        ])
      )
    );
  }
  processRegularAttribute(key, attr, elId, statements, context2) {
    const attrName = key === "className" ? "class" : key;
    let value;
    if (this.t.isStringLiteral(attr.value)) {
      value = attr.value;
    } else if (this.t.isJSXExpressionContainer(attr.value)) {
      this.observableManager.collectObservables(
        attr.value.expression,
        context2.observables,
        this.astUtils
      );
      const replaced = this.observableManager.replaceObservablesWithSignals(
        attr.value.expression,
        context2.observableSignals,
        this.astUtils
      );
      value = this.astUtils.replaceThisWithSelf(replaced);
    } else {
      value = this.t.booleanLiteral(true);
    }
    statements.push(
      this.t.expressionStatement(
        this.t.callExpression(
          this.t.memberExpression(elId, this.t.identifier("setAttribute")),
          [this.t.stringLiteral(attrName), value]
        )
      )
    );
  }
  processChildren(children, childExpressions, statements, scope, context2) {
    for (const child of children) {
      if (this.t.isJSXText(child)) {
        const text = child.value.trim();
        if (text) childExpressions.push(this.t.stringLiteral(text));
      } else if (this.t.isJSXExpressionContainer(child)) {
        const expr = child.expression;
        if (!this.t.isJSXEmptyExpression(expr)) {
          this.observableManager.collectObservables(
            expr,
            context2.observables,
            this.astUtils
          );
          const replaced = this.observableManager.replaceObservablesWithSignals(
            expr,
            context2.observableSignals,
            this.astUtils
          );
          childExpressions.push(this.astUtils.replaceThisWithSelf(replaced));
        }
      } else if (this.t.isJSXElement(child) || this.t.isJSXFragment(child)) {
        const childEl = this.transformElement({ node: child }, scope, context2);
        statements.push(...childEl.statements);
        childExpressions.push(childEl.id);
      }
    }
  }
  processDOMChildren(children, parentId, statements, scope, context2) {
    for (const child of children) {
      if (this.t.isJSXText(child)) {
        const text = child.value.trim();
        if (!text) continue;
        statements.push(
          this.t.expressionStatement(
            this.t.callExpression(this.t.identifier("$insert"), [
              parentId,
              this.t.stringLiteral(text)
            ])
          )
        );
      } else if (this.t.isJSXExpressionContainer(child)) {
        const expr = child.expression;
        if (this.t.isJSXEmptyExpression(expr)) continue;
        this.observableManager.collectObservables(
          expr,
          context2.observables,
          this.astUtils
        );
        let insertedValue;
        if (this.guards.isSignalMember(expr)) {
          insertedValue = this.astUtils.getObject(
            expr
          );
        } else if (this.guards.isObservableMember(expr)) {
          const replaced = this.observableManager.replaceObservablesWithSignals(
            expr,
            context2.observableSignals,
            this.astUtils
          );
          insertedValue = this.astUtils.getObject(replaced);
        } else {
          const replaced = this.observableManager.replaceObservablesWithSignals(
            expr,
            context2.observableSignals,
            this.astUtils
          );
          insertedValue = this.t.arrowFunctionExpression(
            [],
            this.astUtils.replaceThisWithSelf(replaced)
          );
        }
        statements.push(
          this.t.expressionStatement(
            this.t.callExpression(this.t.identifier("$insert"), [
              parentId,
              insertedValue
            ])
          )
        );
      } else if (this.t.isJSXElement(child) || this.t.isJSXFragment(child)) {
        const childEl = this.transformElement({ node: child }, scope, context2);
        statements.push(...childEl.statements);
        statements.push(
          this.t.expressionStatement(
            this.t.callExpression(this.t.identifier("$insert"), [
              parentId,
              childEl.id
            ])
          )
        );
      }
    }
  }
};
function j2d({ types: t }) {
  const guards = new NodeTypeGuards(t);
  const astUtils = new ASTUtilities(t, guards);
  const jsxUtils = new JSXUtilities(t);
  const observableManager = new ObservableManager(t, guards);
  const elementTransformer = new ElementTransformer(
    t,
    guards,
    astUtils,
    jsxUtils,
    observableManager
  );
  return {
    name: "jsx-to-dom",
    visitor: {
      Program: {
        exit(path14, state) {
          if (state.helpersImported) return;
          const helpers = [
            { local: "$insert", imported: "insert" },
            { local: "$createComponent", imported: "createComponent" },
            { local: "$style", imported: "style" },
            { local: "$spread", imported: "spread" },
            { local: "$toSignal", imported: "toSignal" }
          ];
          for (const helper of helpers) {
            path14.unshiftContainer(
              "body",
              t.importDeclaration(
                [
                  t.importSpecifier(
                    t.identifier(helper.local),
                    t.identifier(helper.imported)
                  )
                ],
                t.stringLiteral("@kithinji/orca")
              )
            );
          }
          state.helpersImported = true;
        }
      },
      ClassMethod(path14) {
        if (path14.getData("processed")) return;
        let hasJSX = false;
        path14.traverse({
          JSXElement() {
            hasJSX = true;
          },
          JSXFragment() {
            hasJSX = true;
          }
        });
        if (!hasJSX) return;
        path14.setData("processed", true);
        const body = path14.node.body;
        if (!t.isBlockStatement(body)) return;
        const observables = /* @__PURE__ */ new Map();
        path14.traverse({
          JSXElement(jsxPath) {
            observableManager.collectObservables(
              jsxPath.node,
              observables,
              astUtils
            );
          },
          JSXFragment(jsxPath) {
            observableManager.collectObservables(
              jsxPath.node,
              observables,
              astUtils
            );
          }
        });
        body.body.unshift(
          t.variableDeclaration("const", [
            t.variableDeclarator(t.identifier("self"), t.thisExpression())
          ])
        );
        const observableSignals = /* @__PURE__ */ new Map();
        const signalDeclarations = [];
        for (const [key, observable] of observables) {
          const signalId = path14.scope.generateUidIdentifier("sig");
          observableSignals.set(key, signalId);
          signalDeclarations.push(
            t.variableDeclaration("const", [
              t.variableDeclarator(
                signalId,
                t.callExpression(t.identifier("$toSignal"), [
                  observable,
                  t.identifier("self")
                ])
              )
            ])
          );
        }
        if (signalDeclarations.length > 0) {
          astUtils.insertBeforeReturn(body.body, signalDeclarations);
        }
        const context2 = { observables, observableSignals };
        path14.traverse({
          JSXElement(jsxPath) {
            if (jsxPath.getData("processed")) return;
            jsxPath.setData("processed", true);
            const { id, statements } = elementTransformer.transformElement(
              jsxPath,
              jsxPath.scope,
              context2
            );
            jsxPath.replaceWith(
              t.callExpression(
                t.arrowFunctionExpression(
                  [],
                  t.blockStatement([...statements, t.returnStatement(id)])
                ),
                []
              )
            );
          },
          JSXFragment(jsxPath) {
            if (jsxPath.getData("processed")) return;
            jsxPath.setData("processed", true);
            const { id, statements } = elementTransformer.transformElement(
              jsxPath,
              jsxPath.scope,
              context2
            );
            jsxPath.replaceWith(
              t.callExpression(
                t.arrowFunctionExpression(
                  [],
                  t.blockStatement([...statements, t.returnStatement(id)])
                ),
                []
              )
            );
          }
        });
      }
    }
  };
}

// src/plugins/generators/generate_server_component.ts
import { parseSync as parseSync3 } from "@swc/core";
function generateServerComponent(filePath, code) {
  const ast = parseSync3(code, {
    syntax: "typescript",
    tsx: filePath.endsWith("x"),
    decorators: true
  });
  const componentInfo = extractComponentInfo(ast);
  return generateStubCode(componentInfo);
}
function extractComponentInfo(ast) {
  let componentClass = null;
  for (const item of ast.body) {
    if (item.type === "ExportDeclaration" && item.declaration.type === "ClassDeclaration") {
      const classDecl = item.declaration;
      if (hasComponentDecorator2(classDecl.decorators)) {
        componentClass = classDecl;
        break;
      }
    }
  }
  if (!componentClass || !componentClass.identifier) {
    throw new Error("Component class is undefined");
  }
  const className = componentClass.identifier.value;
  const methods = extractMethods2(componentClass);
  return {
    className,
    methods
  };
}
function hasComponentDecorator2(decorators) {
  if (!decorators) return false;
  return decorators.some((decorator) => {
    const expr = decorator.expression;
    if (expr.type === "CallExpression") {
      if (expr.callee.type === "Identifier" && expr.callee.value === "Component") {
        return true;
      }
    }
    if (expr.type === "Identifier" && expr.value === "Component") {
      return true;
    }
    return false;
  });
}
function extractMethods2(classDecl) {
  const methods = [];
  for (const member of classDecl.body) {
    if (member.type === "ClassMethod") {
      const method = member;
      const methodName = method.key.type === "Identifier" ? method.key.value : "";
      if (!methodName) {
        continue;
      }
      const params = extractMethodParams2(method.function.params || []);
      const returnType = extractReturnType2(method.function.returnType);
      const isAsync = method.function.async || false;
      methods.push({
        name: methodName,
        params,
        returnType,
        isAsync
      });
    }
  }
  return methods;
}
function extractMethodParams2(params) {
  const result = [];
  for (const param of params) {
    if (param.type === "Parameter") {
      const pat = param.pat;
      if (pat.type === "Identifier") {
        const name = pat.value;
        const type = pat.typeAnnotation?.typeAnnotation ? stringifyType3(pat.typeAnnotation.typeAnnotation) : "any";
        result.push({
          name,
          type
        });
      }
    }
  }
  return result;
}
function extractReturnType2(returnType) {
  if (!returnType || !returnType.typeAnnotation) {
    return "any";
  }
  const type = returnType.typeAnnotation;
  if (type.type === "TsTypeReference") {
    const typeName = type.typeName;
    if (typeName.type === "Identifier" && typeName.value === "Promise") {
      if (type.typeParams && type.typeParams.params.length > 0) {
        return stringifyType3(type.typeParams.params[0]);
      }
    }
  }
  return stringifyType3(type);
}
function stringifyType3(typeNode) {
  if (!typeNode) return "any";
  switch (typeNode.type) {
    case "TsKeywordType":
      return typeNode.kind;
    case "TsTypeReference":
      if (typeNode.typeName.type === "Identifier") {
        const baseName = typeNode.typeName.value;
        if (typeNode.typeParams && typeNode.typeParams.params.length > 0) {
          const params = typeNode.typeParams.params.map(stringifyType3).join(", ");
          return `${baseName}<${params}>`;
        }
        return baseName;
      }
      return "any";
    case "TsArrayType":
      return `${stringifyType3(typeNode.elemType)}[]`;
    case "TsUnionType":
      return typeNode.types.map(stringifyType3).join(" | ");
    case "TsIntersectionType":
      return typeNode.types.map(stringifyType3).join(" & ");
    case "TsTypeLiteral":
      const props = typeNode.members.map((member) => {
        if (member.type === "TsPropertySignature") {
          const key = member.key.type === "Identifier" ? member.key.value : "";
          const type = member.typeAnnotation ? stringifyType3(member.typeAnnotation.typeAnnotation) : "any";
          return `${key}: ${type}`;
        }
        return "";
      }).filter(Boolean);
      return `{ ${props.join("; ")} }`;
    default:
      return "any";
  }
}
function generateStubCode(componentInfo) {
  const className = componentInfo.className;
  const build = componentInfo.methods.find((p) => p.name == "build");
  if (build == void 0) {
    throw new Error("Component has no build function");
  }
  return `import { 
  Component, 
  Inject, 
  getCurrentInjector, 
  OrcaComponent,
  JSX,
  OSC,
  HttpClient,
} from "@kithinji/orca";

@Component()
export class ${className} extends OrcaComponent {
    props!: any;

    constructor(
      @Inject("OSC_URL", { maybe: true }) private oscUrl?: string,
      private readonly http: HttpClient,
    ) {
      super();

      if(this.oscUrl === undefined) {
        throw new Error("Server component requires osc url be defined");
      }  
    }

    build() {
        const root = document.createElement("div");
        root.textContent = "loading...";

        const injector = getCurrentInjector();

        if(injector == null) {
          throw new Error("Injector is null");
        }

        const osc = new OSC(root);

        const subscription = this.http.post<JSX.Element>(
          \`\${this.oscUrl}?c=${className}\`, {
            body: this.props
          }
        ).subscribe((jsx: JSX.Element) => {
          const action = jsx.action || "insert";

          if (action === "insert") {
            osc.handleInsert(jsx);
          } else if (action === "update") {
            osc.handleUpdate(jsx);
          } else {
            console.warn(\`Unknown action: \${action}\`);
          }
        });

        this.pushDrop(() => subscription.unsubscribe());

        return root;
    }
}`;
}

// src/plugins/generators/generate_rsc.ts
import { parseSync as parseSync4 } from "@swc/core";
function generateRscStub(filePath, code) {
  const ast = parseSync4(code, {
    syntax: "typescript",
    tsx: filePath.endsWith("x"),
    decorators: true
  });
  const serviceInfo = extractServiceInfo2(ast);
  return generateStubCode2(serviceInfo);
}
function extractServiceInfo2(ast) {
  let serviceClass = null;
  for (const item of ast.body) {
    if (item.type === "ExportDeclaration" && item.declaration.type === "ClassDeclaration") {
      const classDecl = item.declaration;
      if (hasInjectableDecorator2(classDecl.decorators)) {
        serviceClass = classDecl;
        break;
      }
    }
  }
  if (!serviceClass || !serviceClass.identifier) {
    throw new Error("Service class is undefined");
  }
  const className = serviceClass.identifier.value;
  const methods = extractMethods3(serviceClass);
  return {
    className,
    methods
  };
}
function hasInjectableDecorator2(decorators) {
  if (!decorators) return false;
  return decorators.some((decorator) => {
    const expr = decorator.expression;
    if (expr.type === "CallExpression") {
      if (expr.callee.type === "Identifier" && expr.callee.value === "Injectable") {
        return true;
      }
    }
    if (expr.type === "Identifier" && expr.value === "Injectable") {
      return true;
    }
    return false;
  });
}
function extractMethods3(classDecl) {
  const methods = [];
  for (const member of classDecl.body) {
    if (member.type === "ClassMethod" && member.accessibility === "public") {
      const method = member;
      const methodName = method.key.type === "Identifier" ? method.key.value : "";
      if (!methodName) {
        continue;
      }
      if (!method.function.async) {
        throw new Error(
          `Server action ${classDecl.identifier.value}.${methodName} must be async.`
        );
      }
      const params = extractMethodParams3(method.function.params || []);
      const returnType = extractReturnType3(method.function.returnType);
      const isAsync = method.function.async || false;
      methods.push({
        name: methodName,
        params,
        returnType,
        isAsync
      });
    }
  }
  return methods;
}
function extractMethodParams3(params) {
  const result = [];
  for (const param of params) {
    if (param.type === "Parameter") {
      const pat = param.pat;
      if (pat.type === "Identifier") {
        const name = pat.value;
        const type = pat.typeAnnotation?.typeAnnotation ? stringifyType4(pat.typeAnnotation.typeAnnotation) : "any";
        result.push({
          name,
          type
        });
      }
    }
  }
  return result;
}
function extractReturnType3(returnType) {
  if (!returnType || !returnType.typeAnnotation) {
    return "any";
  }
  const type = returnType.typeAnnotation;
  if (type.type === "TsTypeReference") {
    const typeName = type.typeName;
    if (typeName.type === "Identifier" && typeName.value === "Promise") {
      if (type.typeParams && type.typeParams.params.length > 0) {
        return stringifyType4(type.typeParams.params[0]);
      }
    }
  }
  return stringifyType4(type);
}
function stringifyType4(typeNode) {
  if (!typeNode) return "any";
  switch (typeNode.type) {
    case "TsKeywordType":
      return typeNode.kind;
    case "TsTypeReference":
      if (typeNode.typeName.type === "Identifier") {
        const baseName = typeNode.typeName.value;
        if (typeNode.typeParams && typeNode.typeParams.params.length > 0) {
          const params = typeNode.typeParams.params.map(stringifyType4).join(", ");
          return `${baseName}<${params}>`;
        }
        return baseName;
      }
      return "any";
    case "TsArrayType":
      return `${stringifyType4(typeNode.elemType)}[]`;
    case "TsUnionType":
      return typeNode.types.map(stringifyType4).join(" | ");
    case "TsIntersectionType":
      return typeNode.types.map(stringifyType4).join(" & ");
    case "TsTypeLiteral":
      const props = typeNode.members.map((member) => {
        if (member.type === "TsPropertySignature") {
          const key = member.key.type === "Identifier" ? member.key.value : "";
          const type = member.typeAnnotation ? stringifyType4(member.typeAnnotation.typeAnnotation) : "any";
          return `${key}: ${type}`;
        }
        return "";
      }).filter(Boolean);
      return `{ ${props.join("; ")} }`;
    default:
      return "any";
  }
}
function generateStubCode2(serviceInfo) {
  const className = serviceInfo.className;
  const methods = serviceInfo.methods.map((method) => {
    const params = method.params.map((p) => `${p.name}: ${p.type}`).join(", ");
    const paramNames = method.params.map((p) => p.name).join(", ");
    const asyncKeyword = method.isAsync ? "async " : "";
    const returnType = method.isAsync ? `Promise<${method.returnType}>` : method.returnType;
    const hasParams = method.params.length > 0;
    const bodyParam = hasParams ? `{ ${paramNames} }` : "{}";
    if (!hasParams) {
      return `  ${asyncKeyword}${method.name}(${params}): ${returnType} {
    const response = await fetch(\`/${className}/${method.name}\`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }

    return response.json();
  }`;
    }
    return `  ${asyncKeyword}${method.name}(${params}): ${returnType} {
    const response = await fetch(\`/${className}/${method.name}\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(${bodyParam}),
    });

    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }

    return response.json();
  }`;
  }).join("\n\n");
  return `import { Injectable } from "@kithinji/orca";

@Injectable()
export class ${className} {
${methods}
}`;
}

// src/plugins/my.ts
async function swcTransform(source, pathStr, tsx = false, react) {
  const resolveDir = path6.dirname(pathStr);
  const swcResult = await transform(source, {
    filename: pathStr,
    jsc: {
      parser: {
        syntax: "typescript",
        tsx,
        decorators: true
      },
      transform: {
        legacyDecorator: true,
        decoratorMetadata: true,
        react
      },
      target: "esnext"
    },
    isModule: true
  });
  return {
    contents: swcResult.code,
    loader: "js",
    resolveDir
  };
}
function parseFileMetadata(source, path14) {
  const isTsx = path14.endsWith(".tsx");
  const isInteractiveFile = source.startsWith('"use interactive"') || source.startsWith("'use interactive'");
  const isPublicFile = source.startsWith('"use public"') || source.startsWith("'use public'");
  let directive = null;
  if (isInteractiveFile) directive = "interactive";
  else if (isPublicFile) directive = "public";
  return {
    source,
    path: path14,
    isTsx,
    directive,
    isPublicFile,
    isInteractiveFile
  };
}
var ServerBuildTransformer = class {
  async transformPublicFile(source, path14) {
    const controllerCode = generateController(path14, source);
    if (controllerCode) {
      source = `${source}

${controllerCode}
`;
    }
    return swcTransform(source, path14);
  }
  async transformRegularTypeScript(source, path14, isPublic) {
    if (isPublic) {
      return this.transformPublicFile(source, path14);
    }
    return swcTransform(source, path14);
  }
  async transformServerTsx(source, path14) {
    return swcTransform(source, path14, true, {
      runtime: "automatic",
      importSource: "@kithinji/orca"
    });
  }
  async transformInteractiveTsxStub(source, path14) {
    const stubSource = generateServerStub(path14, source);
    return swcTransform(stubSource, path14);
  }
  async process(metadata, onClientFound) {
    const expandedSource = await expandMacros(metadata.source, metadata.path);
    const expandedMetadata = { ...metadata, source: expandedSource };
    const { source, path: path14, isTsx, isInteractiveFile, isPublicFile } = expandedMetadata;
    if (isTsx) {
      if (isInteractiveFile) {
        onClientFound(path14);
        return this.transformInteractiveTsxStub(source, path14);
      }
      return this.transformServerTsx(source, path14);
    }
    return this.transformRegularTypeScript(source, path14, isPublicFile);
  }
};
var ClientBuildTransformer = class {
  async transformInteractiveTsx(source, path14) {
    const swcResult = await swcTransform(source, path14, true, {
      runtime: "preserve"
    });
    const babelResult = await babel.transformAsync(
      swcResult.contents,
      {
        filename: path14,
        sourceType: "module",
        plugins: [j2d],
        parserOpts: {
          plugins: ["jsx"]
        },
        configFile: false,
        babelrc: false
      }
    );
    return {
      contents: babelResult?.code || "",
      loader: "js",
      resolveDir: swcResult.resolveDir
    };
  }
  async transformServerComponent(node, source, path14) {
    const scSource = generateServerComponent(path14, source);
    return swcTransform(scSource, path14);
  }
  async transformPublicFileRsc(node, source, path14) {
    const stubSource = generateRscStub(path14, source);
    return swcTransform(stubSource, path14);
  }
  async transformSharedCode(source, path14) {
    return swcTransform(source, path14);
  }
  async process(node, metadata) {
    const expandedSource = await expandMacros(metadata.source, metadata.path);
    const expandedMetadata = { ...metadata, source: expandedSource };
    const { source, path: path14, isTsx, directive } = expandedMetadata;
    if (isTsx) {
      if (directive === "interactive") {
        return this.transformInteractiveTsx(source, path14);
      } else if (directive === null) {
        return this.transformServerComponent(node, source, path14);
      } else {
        throw new Error(
          `Unexpected directive "${directive}" for TSX file: ${path14}`
        );
      }
    }
    if (directive === "public") {
      return this.transformPublicFileRsc(node, source, path14);
    }
    if (directive === null) {
      return this.transformSharedCode(source, path14);
    }
    return {
      contents: source,
      loader: isTsx ? "tsx" : "ts"
    };
  }
};
function useMyPlugin(options) {
  const serverTransformer = new ServerBuildTransformer();
  const clientTransformer = new ClientBuildTransformer();
  return {
    name: "Orca",
    setup(build) {
      build.onLoad(
        { filter: /\.tsx?$/ },
        async (args) => {
          const source = await fs2.readFile(args.path, "utf8");
          const metadata = parseFileMetadata(source, args.path);
          if (options.isServerBuild) {
            return serverTransformer.process(metadata, options.onClientFound);
          }
          if (!options.graph) {
            throw new Error(
              "Dependency graph is required for client build but was not provided"
            );
          }
          const node = options.graph[args.path];
          if (!node) {
            throw new Error(
              `File node not found in dependency graph: ${args.path}`
            );
          }
          return clientTransformer.process(node, metadata);
        }
      );
    }
  };
}

// src/plugins/analyzers/graph.ts
import { parseSync as parseSync5 } from "@swc/core";
import * as fs3 from "fs";
import * as path7 from "path";
function resolveFilePath(fromFile, importPath) {
  if (!importPath.startsWith(".")) {
    return null;
  }
  const dir = path7.dirname(fromFile);
  const basePath = path7.resolve(dir, importPath);
  const extensions = ["", ".ts", ".tsx", ".js", ".jsx"];
  for (const ext of extensions) {
    const fullPath = basePath + ext;
    if (fs3.existsSync(fullPath) && fs3.statSync(fullPath).isFile()) {
      return fullPath;
    }
  }
  const indexFiles = ["/index.ts", "/index.tsx", "/index.js", "/index.jsx"];
  for (const indexFile of indexFiles) {
    const fullPath = basePath + indexFile;
    if (fs3.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}
function extractDecorators(decorators) {
  if (!decorators || decorators.length === 0) return [];
  return decorators.map((decorator) => {
    if (decorator.expression.type === "CallExpression") {
      if (decorator.expression.callee.type === "Identifier") {
        return decorator.expression.callee.value;
      }
    } else if (decorator.expression.type === "Identifier") {
      return decorator.expression.value;
    }
    return "unknown";
  }).filter((name) => name !== "unknown");
}
function extractDirective(ast) {
  for (const item of ast.body) {
    if (item.type === "ExpressionStatement" && item.expression.type === "StringLiteral") {
      const value = item.expression.value;
      if (value === "use public") return "public";
      if (value === "use interactive") return "interactive";
    }
    if (item.type !== "ExpressionStatement" || item.expression.type !== "StringLiteral") {
      break;
    }
  }
  return null;
}
function extractExports(ast) {
  const exports = [];
  for (const item of ast.body) {
    if (item.type === "ExportDeclaration" && item.declaration) {
      const decl = item.declaration;
      if (decl.type === "ClassDeclaration" && decl.identifier) {
        const decorators = extractDecorators(decl.decorators);
        exports.push({
          name: decl.identifier.value,
          kind: "class",
          decorators: decorators.length > 0 ? decorators : void 0
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
      let kind = "unknown";
      let decorators;
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
        decorators: decorators && decorators.length > 0 ? decorators : void 0
      });
    }
    if (item.type === "ExportDefaultExpression") {
      exports.push({ name: "default", kind: "unknown", isDefault: true });
    }
  }
  return exports;
}
function extractImports(ast) {
  const imports = [];
  for (const item of ast.body) {
    if (item.type === "ImportDeclaration") {
      imports.push({
        path: item.source.value,
        specifiers: item.specifiers
      });
    }
  }
  return imports;
}
function buildGraph(entryPoints) {
  const graph = {};
  const visited = /* @__PURE__ */ new Set();
  function processFile(filePath) {
    const allowed = filePath.endsWith(".ts") || filePath.endsWith(".tsx") || filePath.endsWith(".js") || filePath.endsWith(".jsx");
    if (!allowed) return;
    if (visited.has(filePath)) return;
    visited.add(filePath);
    if (!fs3.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      return;
    }
    const isTsx = filePath.endsWith(".tsx") || filePath.endsWith(".jsx");
    const content = fs3.readFileSync(filePath, "utf-8");
    const ast = parseSync5(content, {
      syntax: "typescript",
      tsx: isTsx,
      decorators: true
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
    const imports = [];
    for (const { path: importPath, specifiers } of rawImports) {
      const resolvedPath = resolveFilePath(filePath, importPath);
      const sourceExports = resolvedPath && graph[resolvedPath] ? graph[resolvedPath].exports : [];
      const symbols = [];
      for (const spec of specifiers) {
        if (spec.type === "ImportDefaultSpecifier") {
          const defaultExport = sourceExports.find((e) => e.isDefault);
          symbols.push({
            name: spec.local.value,
            kind: defaultExport?.kind || "unknown",
            decorators: defaultExport?.decorators,
            isDefault: true
          });
        } else if (spec.type === "ImportNamespaceSpecifier") {
          symbols.push({
            name: spec.local.value,
            kind: "namespace"
          });
        } else if (spec.type === "ImportSpecifier") {
          const importedName = spec.imported ? spec.imported.value : spec.local.value;
          const exportedSymbol = sourceExports.find(
            (e) => e.name === importedName
          );
          symbols.push({
            name: importedName,
            kind: exportedSymbol?.kind || "unknown",
            decorators: exportedSymbol?.decorators
          });
        }
      }
      imports.push({
        sourcePath: importPath,
        resolvedPath,
        symbols
      });
    }
    graph[filePath] = {
      filePath,
      isTsx,
      directive,
      imports,
      exports
    };
  }
  for (const entry of entryPoints) {
    const resolved = path7.resolve(entry);
    processFile(resolved);
  }
  return graph;
}

// src/plugins/css/index.ts
import * as fs4 from "fs";
function stylePlugin(store) {
  return {
    name: "style",
    setup(build) {
      build.onEnd(() => {
        const styleRules = store.get("style_rules");
        if (!styleRules || styleRules.length === 0) {
          console.log("No style rules generated");
          return;
        }
        const allRules = styleRules.flat();
        const uniqueRules = [...new Set(allRules)];
        const cssOutput = uniqueRules.join("\n");
        fs4.writeFileSync("public/index.css", cssOutput);
      });
    }
  };
}

// src/dev/server.ts
async function copyFile2() {
  try {
    await fs5.mkdir("public", { recursive: true });
    await fs5.copyFile("./src/client/index.html", "./public/index.html");
  } catch (error) {
    console.error("\u274C Failed to copy index.html:", error);
    throw error;
  }
}
async function cleanDirectories() {
  await Promise.all([
    fs5.rm("dist", { recursive: true, force: true }),
    fs5.rm("public", { recursive: true, force: true })
  ]);
}
function createRestartServerPlugin(serverProcess, onServerBuildComplete) {
  return {
    name: "restart-server",
    setup(build) {
      build.onEnd((result) => {
        if (result.errors.length > 0) {
          console.error(
            `\u274C Server build failed with ${result.errors.length} error(s)`
          );
          return;
        }
        if (serverProcess.current) {
          serverProcess.current.kill("SIGTERM");
        }
        serverProcess.current = spawn("node", ["dist/main.js"], {
          stdio: "inherit"
        });
        serverProcess.current.on("error", (err) => {
          console.error("\u274C Server process error:", err);
        });
        onServerBuildComplete();
      });
    }
  };
}
async function startDevServer() {
  const store = Store.getInstance();
  const userConfig = await loadConfig();
  const config = mergeConfig(getDefaultConfig(), userConfig);
  await cleanDirectories();
  await copyFile2();
  const entryPoints = ["src/main.ts"];
  const clientFiles = /* @__PURE__ */ new Set(["src/client/client.tsx"]);
  const serverProcessRef = { current: null };
  let clientCtx = null;
  let isShuttingDown = false;
  let pendingClientFiles = /* @__PURE__ */ new Set();
  let needsClientRebuild = false;
  async function rebuildClient() {
    if (isShuttingDown) return;
    try {
      if (clientCtx) {
        await clientCtx.dispose();
        clientCtx = null;
      }
      if (clientFiles.size === 0) return;
      const entryPoints2 = Array.from(clientFiles);
      const graph = buildGraph(entryPoints2);
      clientCtx = await esbuild2.context({
        entryPoints: entryPoints2,
        bundle: true,
        outdir: "public",
        outbase: ".",
        platform: "browser",
        format: "esm",
        sourcemap: config.build?.sourcemap ?? true,
        splitting: true,
        minify: config.build?.minify ?? false,
        plugins: [
          ...config.plugins?.map((cb) => cb(store)) || [],
          ...config.client_plugins?.map((cb) => cb(store)) || [],
          useMyPlugin({
            graph,
            isServerBuild: false,
            onClientFound: () => {
            }
          }),
          {
            name: "client-build-logger",
            setup(build) {
              build.onEnd((result) => {
                if (result.errors.length > 0) {
                  console.error(
                    `\u274C Client build failed with ${result.errors.length} error(s)`
                  );
                }
              });
            }
          }
        ],
        write: true
      });
      await clientCtx.watch();
      pendingClientFiles.clear();
      needsClientRebuild = false;
    } catch (error) {
      console.error("\u274C Failed to rebuild client:", error);
      throw error;
    }
  }
  async function onServerBuildComplete() {
    if (needsClientRebuild && pendingClientFiles.size > 0) {
      await rebuildClient();
    }
  }
  const serverCtx = await esbuild2.context({
    entryPoints,
    bundle: true,
    outdir: config.build?.outDir || "dist",
    platform: "node",
    format: "esm",
    packages: "external",
    sourcemap: config.build?.sourcemap ?? true,
    minify: config.build?.minify ?? false,
    plugins: [
      ...config.plugins?.map((cb) => cb(store)) || [],
      useMyPlugin({
        isServerBuild: true,
        onClientFound: async (filePath) => {
          const isNewFile = !clientFiles.has(filePath);
          if (isNewFile) {
            clientFiles.add(filePath);
            pendingClientFiles.add(filePath);
            needsClientRebuild = true;
          }
        }
      }),
      createRestartServerPlugin(serverProcessRef, onServerBuildComplete)
    ],
    write: true
  });
  async function shutdown() {
    if (isShuttingDown) return;
    isShuttingDown = true;
    try {
      if (serverProcessRef.current) {
        serverProcessRef.current.kill("SIGTERM");
        await new Promise((resolve3) => setTimeout(resolve3, 1e3));
      }
      await serverCtx.dispose();
      if (clientCtx) await clientCtx.dispose();
      process.exit(0);
    } catch (error) {
      console.error("\u274C Error during shutdown:", error);
      process.exit(1);
    }
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  await serverCtx.watch();
}

// src/config/index.ts
var config_exports = {};
__export(config_exports, {
  getDefaultConfig: () => getDefaultConfig,
  loadConfig: () => loadConfig,
  mergeConfig: () => mergeConfig
});

// src/add/component/component.ts
import * as fs6 from "fs";
import * as path8 from "path";
import * as ts2 from "typescript";
var ComponentDefinition = class {
};
var ButtonComponent = class extends ComponentDefinition {
  constructor() {
    super(...arguments);
    this.name = "button";
    this.dependencies = [];
  }
  generate() {
    return `"use interactive";

import { Component, JSX } from "@kithinji/orca";

@Component()
export class Button {
    props!: {
        children: any
    };
    
    build() {
        return (
            <button>
                {this.props.children}
            </button>
        );
    }
}
`;
  }
};
var InputComponent = class extends ComponentDefinition {
  constructor() {
    super(...arguments);
    this.name = "input";
    this.dependencies = [];
  }
  generate() {
    return `"use interactive";

import { Component } from "@kithinji/orca";

@Component()
export class Input {    
    build() {
        return (
            <input />
        );
    }
}
`;
  }
};
var FormComponent = class extends ComponentDefinition {
  constructor() {
    super(...arguments);
    this.name = "form";
    this.dependencies = ["button", "input"];
  }
  generate() {
    return `"use interactive";

import { Component } from "@kithinji/orca";
import { Button } from "./button.component";
import { Input } from "./input.component";

@Component()
export class Form {
    props!: {
        onSubmit?: () => void;
    };
    
    build() {
        return (
            <form onSubmit={this.props.onSubmit}>
                <Input />
                <Button>Submit</Button>
            </form>
        );
    }
}
`;
  }
};
var CardComponent = class extends ComponentDefinition {
  constructor() {
    super(...arguments);
    this.name = "card";
    this.dependencies = ["button"];
  }
  generate() {
    return `"use interactive";
    
import { Component } from "@kithinji/orca";
import { Button } from "./button.component";

@Component()
export class Card {
    props!: {
        title: string;
        children: any;
        onAction?: () => void;
    };
    
    build() {
        return (
            <div className="card">
                <h3>{this.props.title}</h3>
                <div>{this.props.children}</div>
                {this.props.onAction && (
                    <Button onClick={this.props.onAction}>Action</Button>
                )}
            </div>
        );
    }
}
`;
  }
};
var ComponentRegistry = class {
  static {
    this.components = /* @__PURE__ */ new Map([
      ["button", new ButtonComponent()],
      ["input", new InputComponent()],
      ["form", new FormComponent()],
      ["card", new CardComponent()]
    ]);
  }
  static get(name) {
    return this.components.get(name);
  }
  static has(name) {
    return this.components.has(name);
  }
  static getAll() {
    return Array.from(this.components.keys());
  }
  static register(component) {
    this.components.set(component.name, component);
  }
};
function addComponent(name, processedComponents = /* @__PURE__ */ new Set()) {
  if (processedComponents.has(name)) {
    return;
  }
  const component = ComponentRegistry.get(name);
  if (!component) {
    throw new Error(
      `Component "${name}" not found. Available components: ${ComponentRegistry.getAll().join(
        ", "
      )}`
    );
  }
  processedComponents.add(name);
  if (component.dependencies.length > 0) {
    console.log(
      `
Processing dependencies for "${name}": [${component.dependencies.join(
        ", "
      )}]`
    );
    for (const dependency of component.dependencies) {
      addComponent(dependency, processedComponents);
    }
  }
  const componentModulePath = path8.join(
    process.cwd(),
    "src/component/component.module.ts"
  );
  const componentPath = path8.join(
    process.cwd(),
    `src/component/component/${name}.component.tsx`
  );
  const componentDir = path8.dirname(componentPath);
  const appModulePath = path8.join(process.cwd(), "src/app/app.module.ts");
  if (!fs6.existsSync(componentModulePath)) {
    const moduleDir = path8.dirname(componentModulePath);
    if (!fs6.existsSync(moduleDir)) {
      fs6.mkdirSync(moduleDir, { recursive: true });
    }
    fs6.writeFileSync(componentModulePath, createModule(), "utf-8");
  }
  if (!fs6.existsSync(componentDir)) {
    fs6.mkdirSync(componentDir, { recursive: true });
  }
  if (!fs6.existsSync(componentPath)) {
    fs6.writeFileSync(componentPath, component.generate(), "utf-8");
    console.log(`Created ${name}.component.tsx`);
  } else {
    console.log(`${name}.component.tsx already exists, skipping file creation`);
  }
  const moduleContent = fs6.readFileSync(componentModulePath, "utf-8");
  const updatedModule = updateModuleWithComponent(moduleContent, name);
  fs6.writeFileSync(componentModulePath, updatedModule, "utf-8");
  if (fs6.existsSync(appModulePath)) {
    const appModuleContent = fs6.readFileSync(appModulePath, "utf-8");
    const updatedAppModule = ensureComponentModuleImported(appModuleContent);
    if (updatedAppModule !== appModuleContent) {
      fs6.writeFileSync(appModulePath, updatedAppModule, "utf-8");
    }
  }
}
function updateModuleWithComponent(moduleContent, componentName) {
  const className = capitalize(componentName);
  const importPath = `./component/${componentName}.component`;
  const sourceFile = ts2.createSourceFile(
    "component.module.ts",
    moduleContent,
    ts2.ScriptTarget.Latest,
    true
  );
  const hasImport = sourceFile.statements.some((statement) => {
    if (ts2.isImportDeclaration(statement)) {
      const moduleSpecifier = statement.moduleSpecifier;
      if (ts2.isStringLiteral(moduleSpecifier)) {
        return moduleSpecifier.text === importPath;
      }
    }
    return false;
  });
  if (hasImport) {
    return moduleContent;
  }
  let lastImportEnd = 0;
  sourceFile.statements.forEach((statement) => {
    if (ts2.isImportDeclaration(statement)) {
      lastImportEnd = statement.end;
    }
  });
  const importStatement = `import { ${className} } from "${importPath}";
`;
  let updatedContent = moduleContent.slice(0, lastImportEnd) + "\n" + importStatement + moduleContent.slice(lastImportEnd);
  const newSourceFile = ts2.createSourceFile(
    "component.module.ts",
    updatedContent,
    ts2.ScriptTarget.Latest,
    true
  );
  updatedContent = addToDecoratorArray(
    updatedContent,
    newSourceFile,
    "declarations",
    className
  );
  updatedContent = addToDecoratorArray(
    updatedContent,
    ts2.createSourceFile(
      "component.module.ts",
      updatedContent,
      ts2.ScriptTarget.Latest,
      true
    ),
    "exports",
    className
  );
  return updatedContent;
}
function addToDecoratorArray(content, sourceFile, arrayName, className) {
  let decoratorNode;
  sourceFile.statements.forEach((statement) => {
    if (ts2.isClassDeclaration(statement) && statement.modifiers) {
      statement.modifiers.forEach((modifier) => {
        if (ts2.isDecorator(modifier)) {
          const expression = modifier.expression;
          if (ts2.isCallExpression(expression)) {
            const expressionText = expression.expression.getText(sourceFile);
            if (expressionText === "Module") {
              decoratorNode = modifier;
            }
          }
        }
      });
    }
  });
  if (!decoratorNode) {
    console.warn("Could not find @Module decorator");
    return content;
  }
  const callExpression = decoratorNode.expression;
  const objectLiteral = callExpression.arguments[0];
  if (!objectLiteral || !ts2.isObjectLiteralExpression(objectLiteral)) {
    return content;
  }
  let targetProperty;
  objectLiteral.properties.forEach((prop) => {
    if (ts2.isPropertyAssignment(prop)) {
      const propName = prop.name.getText(sourceFile);
      if (propName === arrayName) {
        targetProperty = prop;
      }
    }
  });
  if (!targetProperty) {
    console.warn(`Could not find ${arrayName} property`);
    return content;
  }
  const arrayLiteral = targetProperty.initializer;
  if (!ts2.isArrayLiteralExpression(arrayLiteral)) {
    return content;
  }
  const hasClassName = arrayLiteral.elements.some((element) => {
    return element.getText(sourceFile).trim() === className;
  });
  if (hasClassName) {
    return content;
  }
  const arrayStart = arrayLiteral.getStart(sourceFile);
  const arrayEnd = arrayLiteral.getEnd();
  if (arrayLiteral.elements.length === 0) {
    const newArray = `[${className}]`;
    return content.substring(0, arrayStart) + newArray + content.substring(arrayEnd);
  }
  const lastElement = arrayLiteral.elements[arrayLiteral.elements.length - 1];
  const insertPos = lastElement.getEnd();
  const newElement = `, ${className}`;
  return content.substring(0, insertPos) + newElement + content.substring(insertPos);
}
function ensureComponentModuleImported(appModuleContent) {
  const sourceFile = ts2.createSourceFile(
    "app.module.ts",
    appModuleContent,
    ts2.ScriptTarget.Latest,
    true
  );
  const hasComponentModuleImport = sourceFile.statements.some((statement) => {
    if (ts2.isImportDeclaration(statement) && statement.importClause) {
      const namedBindings = statement.importClause.namedBindings;
      if (namedBindings && ts2.isNamedImports(namedBindings)) {
        return namedBindings.elements.some(
          (element) => element.name.text === "ComponentModule"
        );
      }
    }
    return false;
  });
  if (hasComponentModuleImport) {
    return ensureInImportsArray(appModuleContent, sourceFile);
  }
  let lastImportEnd = 0;
  sourceFile.statements.forEach((statement) => {
    if (ts2.isImportDeclaration(statement)) {
      lastImportEnd = statement.end;
    }
  });
  const importStatement = `import { ComponentModule } from "../component/component.module";
`;
  let updatedContent = appModuleContent.slice(0, lastImportEnd) + "\n" + importStatement + appModuleContent.slice(lastImportEnd);
  const newSourceFile = ts2.createSourceFile(
    "app.module.ts",
    updatedContent,
    ts2.ScriptTarget.Latest,
    true
  );
  updatedContent = ensureInImportsArray(updatedContent, newSourceFile);
  return updatedContent;
}
function ensureInImportsArray(content, sourceFile) {
  return addToDecoratorArray(content, sourceFile, "imports", "ComponentModule");
}
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function createModule() {
  return `import { Module } from "@kithinji/orca";

@Module({
    imports: [],
    providers: [],
    declarations: [],
    exports: [],
})
export class ComponentModule {}
`;
}

// src/utils/cases.ts
function toCamelCase(str) {
  return str.replace(/[-_](.)/g, (_, char) => char.toUpperCase()).replace(/^./, (char) => char.toLowerCase());
}
function toPascalCase(str) {
  return str.replace(/[-_](.)/g, (_, char) => char.toUpperCase()).replace(/^./, (char) => char.toUpperCase());
}

// src/utils/create.ts
import * as fs7 from "fs";
import * as path9 from "path";
function createStructure(basePath, entry) {
  fs7.mkdirSync(basePath, { recursive: true });
  entry.files?.forEach((file) => {
    fs7.writeFileSync(path9.join(basePath, file.name), file.content);
  });
  entry.dirs?.forEach((dir) => {
    const dirPath = path9.join(basePath, dir.name || "");
    createStructure(dirPath, dir);
  });
}

// src/add/new/index.ts
import path11 from "path";

// src/add/module/module.ts
import * as path10 from "path";
import * as fs8 from "fs";
import * as ts3 from "typescript";
function addFeature(name) {
  const featureDir = path10.join(process.cwd(), "src", "features", name);
  addModule(name, featureDir);
  updateFeaturesIndex(name);
  updateAppModule(name);
}
function addModule(name, baseDir) {
  const structure = {
    files: [
      { name: `${name}.module.ts`, content: createModule2(name) },
      { name: `${name}.service.ts`, content: createService(name) },
      { name: `${name}.page.tsx`, content: createPage(name) }
    ],
    dirs: [
      {
        name: "schemas",
        files: [
          {
            name: "get.ts",
            content: createGetSchema(name)
          },
          {
            name: "create.ts",
            content: createCreateSchema(name)
          },
          {
            name: "update.ts",
            content: createUpdateSchema(name)
          },
          {
            name: "list.ts",
            content: createListSchema(name)
          },
          {
            name: "delete.ts",
            content: createDeleteSchema(name)
          }
        ]
      },
      {
        name: "components",
        files: [
          {
            name: `${name}-list.component.tsx`,
            content: createListComponent(name)
          }
        ]
      }
    ]
  };
  createStructure(baseDir, structure);
}
function updateFeaturesIndex(featureName) {
  const featuresIndexPath = path10.join(
    process.cwd(),
    "src",
    "features",
    "index.ts"
  );
  const moduleName = toPascalCase(featureName + "_Module");
  const importPath = `./${featureName}/${featureName}.module`;
  if (fs8.existsSync(featuresIndexPath)) {
    let content = fs8.readFileSync(featuresIndexPath, "utf-8");
    const sourceFile = ts3.createSourceFile(
      "index.ts",
      content,
      ts3.ScriptTarget.Latest,
      true
    );
    const hasExport = sourceFile.statements.some((statement) => {
      if (ts3.isExportDeclaration(statement)) {
        const moduleSpecifier = statement.moduleSpecifier;
        if (moduleSpecifier && ts3.isStringLiteral(moduleSpecifier)) {
          return moduleSpecifier.text === importPath;
        }
        if (statement.exportClause && ts3.isNamedExports(statement.exportClause)) {
          return statement.exportClause.elements.some(
            (element) => element.name.text === moduleName
          );
        }
      }
      return false;
    });
    if (hasExport) {
      return;
    }
    const exportStatement = `export { ${moduleName} } from "${importPath}";
`;
    fs8.appendFileSync(featuresIndexPath, exportStatement);
  } else {
    const featuresDir = path10.dirname(featuresIndexPath);
    if (!fs8.existsSync(featuresDir)) {
      fs8.mkdirSync(featuresDir, { recursive: true });
    }
    const exportStatement = `export { ${moduleName} } from "${importPath}";
`;
    fs8.writeFileSync(featuresIndexPath, exportStatement, "utf-8");
  }
}
function updateAppModule(featureName) {
  const appModulePath = path10.join(process.cwd(), "src", "app", "app.module.ts");
  if (!fs8.existsSync(appModulePath)) {
    return;
  }
  const moduleName = toPascalCase(featureName + "_Module");
  let content = fs8.readFileSync(appModulePath, "utf-8");
  const sourceFile = ts3.createSourceFile(
    "app.module.ts",
    content,
    ts3.ScriptTarget.Latest,
    true
  );
  const hasImport = sourceFile.statements.some((statement) => {
    if (ts3.isImportDeclaration(statement)) {
      const moduleSpecifier = statement.moduleSpecifier;
      if (ts3.isStringLiteral(moduleSpecifier)) {
        const importPath = moduleSpecifier.text;
        return importPath.includes(`/${featureName}/${featureName}.module`);
      }
      if (statement.importClause?.namedBindings && ts3.isNamedImports(statement.importClause.namedBindings)) {
        return statement.importClause.namedBindings.elements.some(
          (element) => element.name.text === moduleName
        );
      }
    }
    return false;
  });
  if (hasImport) {
    content = addToModuleImportsArray(content, sourceFile, moduleName);
    fs8.writeFileSync(appModulePath, content, "utf-8");
    return;
  }
  let lastImportEnd = 0;
  sourceFile.statements.forEach((statement) => {
    if (ts3.isImportDeclaration(statement)) {
      lastImportEnd = statement.end;
    }
  });
  const importStatement = `import { ${moduleName} } from "../features/${featureName}/${featureName}.module";
`;
  content = content.slice(0, lastImportEnd) + "\n" + importStatement + content.slice(lastImportEnd);
  const newSourceFile = ts3.createSourceFile(
    "app.module.ts",
    content,
    ts3.ScriptTarget.Latest,
    true
  );
  content = addToModuleImportsArray(content, newSourceFile, moduleName);
  fs8.writeFileSync(appModulePath, content, "utf-8");
}
function addToModuleImportsArray(content, sourceFile, moduleName) {
  let decoratorNode;
  sourceFile.statements.forEach((statement) => {
    if (ts3.isClassDeclaration(statement) && statement.modifiers) {
      statement.modifiers.forEach((modifier) => {
        if (ts3.isDecorator(modifier)) {
          const expression = modifier.expression;
          if (ts3.isCallExpression(expression)) {
            const expressionText = expression.expression.getText(sourceFile);
            if (expressionText === "Module") {
              decoratorNode = modifier;
            }
          }
        }
      });
    }
  });
  if (!decoratorNode) {
    return content;
  }
  const callExpression = decoratorNode.expression;
  const objectLiteral = callExpression.arguments[0];
  if (!objectLiteral || !ts3.isObjectLiteralExpression(objectLiteral)) {
    return content;
  }
  let importsProperty;
  objectLiteral.properties.forEach((prop) => {
    if (ts3.isPropertyAssignment(prop)) {
      const propName = prop.name.getText(sourceFile);
      if (propName === "imports") {
        importsProperty = prop;
      }
    }
  });
  if (!importsProperty) {
    return content;
  }
  const arrayLiteral = importsProperty.initializer;
  if (!ts3.isArrayLiteralExpression(arrayLiteral)) {
    return content;
  }
  const hasModule = arrayLiteral.elements.some((element) => {
    return element.getText(sourceFile).trim() === moduleName;
  });
  if (hasModule) {
    return content;
  }
  const arrayStart = arrayLiteral.getStart(sourceFile);
  const arrayEnd = arrayLiteral.getEnd();
  if (arrayLiteral.elements.length === 0) {
    const newArray = `[${moduleName}]`;
    return content.substring(0, arrayStart) + newArray + content.substring(arrayEnd);
  }
  const lastElement = arrayLiteral.elements[arrayLiteral.elements.length - 1];
  const insertPos = lastElement.getEnd();
  const newElement = `, ${moduleName}`;
  return content.substring(0, insertPos) + newElement + content.substring(insertPos);
}
function createModule2(name) {
  const serviceName = toPascalCase(name + "_Service");
  const pageName = toPascalCase(name + "_Page");
  const moduleName = toPascalCase(name + "_Module");
  const componentName = toPascalCase(name + "_List");
  return `import { Module } from "@kithinji/orca";
import { ComponentModule } from "@/component/component.module";
import { ${serviceName} } from "./${name}.service";
import { ${pageName} } from "./${name}.page";
import { ${componentName} } from "./components/${name}-list.component";

@Module({
    imports: [ComponentModule],
    providers: [${serviceName}],
    declarations: [${pageName}, ${componentName}],
    exports: [${serviceName}, ${pageName}]
})
export class ${moduleName} {}
`;
}
function createGetSchema(name) {
  return `import { z } from "zod";

export const ${toCamelCase(name + "_GetInput")} = z.object({
  id: z.string().uuid(),
});

export const ${toCamelCase(name + "_GetOutput")} = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});
`;
}
function createCreateSchema(name) {
  return `import { z } from "zod";

export const ${toCamelCase(name + "_CreateInput")} = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const ${toCamelCase(name + "_CreateOutput")} = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.date(),
});
`;
}
function createUpdateSchema(name) {
  return `import { z } from "zod";

export const ${toCamelCase(name + "_UpdateInput")} = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export const ${toCamelCase(name + "_UpdateOutput")} = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
`;
}
function createListSchema(name) {
  return `import { z } from "zod";

export const ${toCamelCase(name + "_ListOutput")} = z.array(
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional(),
    createdAt: z.date(),
    updatedAt: z.date().optional(),
  })
);
`;
}
function createDeleteSchema(name) {
  return `import { z } from "zod";

export const ${toCamelCase(name + "_DeleteInput")} = z.object({
  id: z.string().uuid(),
});

export const ${toCamelCase(name + "_DeleteOutput")} = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});
`;
}
function createService(name) {
  const serviceName = toPascalCase(name + "_Service");
  return `"use public";

import { Injectable, Signature } from "@kithinji/orca";
import { 
  ${toCamelCase(name + "_CreateInput")}, 
  ${toCamelCase(name + "_CreateOutput")} 
} from "./schemas/create";
import { 
  ${toCamelCase(name + "_GetInput")}, 
  ${toCamelCase(name + "_GetOutput")} 
} from "./schemas/get";
import { 
  ${toCamelCase(name + "_UpdateInput")}, 
  ${toCamelCase(name + "_UpdateOutput")} 
} from "./schemas/update";
import { ${toCamelCase(name + "_ListOutput")} } from "./schemas/list";
import { 
  ${toCamelCase(name + "_DeleteInput")}, 
  ${toCamelCase(name + "_DeleteOutput")} 
} from "./schemas/delete";

@Injectable()
export class ${serviceName} {
    private items: any[] = [];

    @Signature(${toCamelCase(name + "_CreateInput")}, ${toCamelCase(
    name + "_CreateOutput"
  )})
    public async create(input: any) {
        const item = {
            id: crypto.randomUUID(),
            ...input,
            createdAt: new Date(),
        };
        this.items.push(item);
        return item;
    }

    @Signature(${toCamelCase(name + "_GetInput")}, ${toCamelCase(
    name + "_GetOutput"
  )})
    public async get(input: any) {
        const item = this.items.find((i) => i.id === input.id);
        if (!item) {
            throw new Error("Item not found");
        }
        return item;
    }

    @Signature(${toCamelCase(name + "_ListOutput")})
    public async list() {
        return this.items;
    }

    @Signature(${toCamelCase(name + "_UpdateInput")}, ${toCamelCase(
    name + "_UpdateOutput"
  )})
    public async update(input: any) {
        const index = this.items.findIndex((i) => i.id === input.id);
        if (index === -1) {
            throw new Error("Item not found");
        }
        
        this.items[index] = {
            ...this.items[index],
            ...input,
            updatedAt: new Date(),
        };
        
        return this.items[index];
    }

    @Signature(${toCamelCase(name + "_DeleteInput")}, ${toCamelCase(
    name + "_DeleteOutput"
  )})
    public async delete(input: any) {
        const index = this.items.findIndex((i) => i.id === input.id);
        if (index === -1) {
            throw new Error("Item not found");
        }
        
        const deleted = this.items.splice(index, 1)[0];
        return deleted;
    }
}
`;
}
function createPage(name) {
  const pageName = toPascalCase(name + "_Page");
  const serviceName = toPascalCase(name + "_Service");
  const serviceVar = toCamelCase(name + "_Service");
  const listComponent = toPascalCase(name + "_List");
  return `import { Component } from "@kithinji/orca";
import { ${serviceName} } from "./${name}.service";
import { ${listComponent} } from "./components/${name}-list.component";

@Component()
export class ${pageName} {
    constructor(
        public ${serviceVar}: ${serviceName}
    ) {}

    build() {
        return (
            <div>
                <h1>${toPascalCase(name)} Management</h1>
                <${listComponent} service={this.${serviceVar}} />
            </div>
        );
    }
}
`;
}
function createListComponent(name) {
  const componentName = toPascalCase(name + "_List");
  const serviceName = toPascalCase(name + "_Service");
  return `"use interactive";

import { Component } from "@kithinji/orca";
import { ${serviceName} } from "../${name}.service";

@Component()
export class ${componentName} {
    props!: {
        service: ${serviceName};
    };

    build() {
        return (
            <div>
                <h2>${toPascalCase(name)} List</h2>
                <p>List component for ${name}</p>
                {/* Add your list implementation here */}
            </div>
        );
    }
}
`;
}

// src/add/new/index.ts
function addNew(name) {
  const baseDir = path11.join(process.cwd(), name);
  const structure = {
    files: [
      { name: "package.json", content: genPackageJson(name) },
      { name: "tsconfig.json", content: gentsconfig() },
      { name: "pod.config.ts", content: genPodConfig(name) },
      { name: "README.md", content: genReadMe() },
      { name: ".gitignore", content: genGitIgnore() },
      { name: ".env", content: genEnv() }
    ],
    dirs: [
      {
        name: "src",
        files: [{ name: "main.ts", content: genMainTs() }]
      }
    ]
  };
  createStructure(baseDir, structure);
  const appDir = path11.join(process.cwd(), name, "src", "app");
  addModule("app", appDir);
  process.chdir(baseDir);
  addComponent("button");
  console.log(`App ${name} created successfully`);
}
function genPackageJson(name) {
  const pj = {
    name,
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: {
      dev: "pod dev",
      build: "pod build",
      start: "pod start"
    },
    dependencies: {
      "reflect-metadata": "latest",
      zod: "^4.2.1",
      "@kithinji/orca": "latest"
    },
    devDependencies: {
      "@types/node": "^20.19.27",
      typescript: "~5.9.3",
      "@kithinji/pod": "latest"
    }
  };
  return JSON.stringify(pj, null, 2);
}
function gentsconfig() {
  const tsconfig = {
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      jsx: "react-jsx",
      jsxImportSource: "@kithinji/orca",
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      baseUrl: ".",
      paths: {
        "@/*": ["src/*"]
      }
    },
    include: ["src"]
  };
  return JSON.stringify(tsconfig, null, 2);
}
function genPodConfig(name) {
  return `import { PodConfig, stylePlugin } from "@kithinji/pod";

export default function defaultConfig(): PodConfig {
  return {
    name: "${name}",
    client_plugins: [stylePlugin],
  };
}  
`;
}
function genReadMe() {
  return `# Pod Project  
`;
}
function genGitIgnore() {
  return `node_modules
dist
build
.orca
*.log
.env
.DS_Store
`;
}
function genEnv() {
  return `NODE_ENV=development
`;
}
function genMainTs() {
  return `import { NodeFactory } from "@kithinji/orca";
import { AppModule } from "./app/app.module";

async function bootstrap() {
  const app = await NodeFactory.create(AppModule);
  app.listen(8080, () => {
    console.log("Server started");
  });
}

bootstrap();
`;
}

// src/main.ts
import path13 from "path";
import { execSync } from "child_process";

// src/docker/docker.ts
import fs9 from "fs-extra";
import path12 from "path";
import prompts from "prompts";
import yaml from "js-yaml";
async function dockerize(env = "prod") {
  const cwd = process.cwd();
  const packageJsonPath = path12.join(cwd, "package.json");
  if (!fs9.existsSync(packageJsonPath)) {
    throw new Error("package.json not found. Are you in a Pod project?");
  }
  const packageJson = await fs9.readJSON(packageJsonPath);
  const projectName = packageJson.name;
  const detectedServices = detectServices(packageJson);
  const selectedServices = await selectServices(detectedServices);
  await restructureProject(cwd, projectName);
  await createDockerfile(cwd, projectName);
  if (env === "prod") {
    await setupProduction(cwd, projectName, selectedServices);
  } else {
    await setupDevelopment(cwd, projectName, selectedServices);
  }
  printNextSteps(projectName, env, selectedServices);
}
function detectServices(packageJson) {
  const deps = packageJson.dependencies || {};
  const services = [];
  if (deps.pg || deps.postgres) services.push({ name: "postgres" });
  if (deps.mysql || deps.mysql2) services.push({ name: "mysql" });
  if (deps.redis || deps.ioredis) services.push({ name: "redis" });
  if (deps.mongodb || deps.mongoose) services.push({ name: "mongodb" });
  return services;
}
async function selectServices(detected) {
  if (detected.length === 0) return [];
  const response = await prompts({
    type: "multiselect",
    name: "services",
    message: "Select services to include:",
    choices: detected.map((s) => ({
      title: s.name,
      value: s.name,
      selected: true
    }))
  });
  if (!response.services) return [];
  return detected.filter((s) => response.services.includes(s.name));
}
async function restructureProject(cwd, projectName) {
  const nestedDir = path12.join(cwd, projectName);
  if (fs9.existsSync(nestedDir)) {
    console.log("\u26A0\uFE0F  Project already restructured, skipping...");
    return;
  }
  await fs9.ensureDir(nestedDir);
  const items = await fs9.readdir(cwd);
  const toMove = items.filter((item) => item !== projectName);
  for (const item of toMove) {
    const src = path12.join(cwd, item);
    const dest = path12.join(nestedDir, item);
    await fs9.move(src, dest, { overwrite: true });
  }
  const envSrc = path12.join(nestedDir, ".env");
  const envDest = path12.join(cwd, ".env");
  if (fs9.existsSync(envSrc)) {
    await fs9.move(envSrc, envDest, { overwrite: true });
  }
}
async function createDockerfile(cwd, projectName) {
  const dockerfilePath = path12.join(cwd, projectName, "Dockerfile");
  const dockerfile = `FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN if [ -f "tsconfig.json" ]; then npm run build || true; fi

EXPOSE 3000
CMD ["npm", "start"]
`;
  await fs9.writeFile(dockerfilePath, dockerfile);
}
async function setupProduction(cwd, projectName, services) {
  const compose = {
    services: {
      traefik: {
        image: "traefik:v2.10",
        command: [
          "--api.insecure=true",
          "--providers.docker=true",
          "--providers.docker.exposedbydefault=false",
          "--entrypoints.web.address=:80",
          "--entrypoints.websecure.address=:443",
          "--certificatesresolvers.myresolver.acme.tlschallenge=true",
          "--certificatesresolvers.myresolver.acme.email=admin@example.com",
          "--certificatesresolvers.myresolver.acme.storage=/letsencrypt/acme.json"
        ],
        ports: ["80:80", "443:443", "8080:8080"],
        volumes: [
          "/var/run/docker.sock:/var/run/docker.sock:ro",
          "./letsencrypt:/letsencrypt"
        ],
        networks: ["web"]
      },
      [projectName]: {
        build: ".",
        labels: [
          "traefik.enable=true",
          "traefik.http.routers.app.rule=Host(`localhost`)",
          "traefik.http.routers.app.entrypoints=websecure",
          "traefik.http.routers.app.tls.certresolver=myresolver",
          "traefik.http.services.app.loadbalancer.server.port=3000"
        ],
        env_file: [".env"],
        depends_on: [],
        networks: ["web"]
      }
    },
    networks: {
      web: {
        driver: "bridge"
      }
    },
    volumes: {}
  };
  for (const service of services) {
    const config = getServiceConfig(service.name);
    compose.services[service.name] = config.service;
    if (config.volume) {
      compose.volumes[config.volume.name] = {};
    }
    compose.services[projectName].depends_on.push(service.name);
  }
  const composePath = path12.join(cwd, "docker-compose.yml");
  await fs9.writeFile(
    composePath,
    yaml.dump(compose, { indent: 2, lineWidth: -1 })
  );
  await createEnvTemplate(cwd, services, "prod");
}
async function setupDevelopment(cwd, projectName, services) {
  const existingCompose = path12.join(cwd, "docker-compose.yml");
  let existingServices = [];
  if (fs9.existsSync(existingCompose)) {
    const content = await fs9.readFile(existingCompose, "utf8");
    const existing = yaml.load(content);
    if (existing.services) {
      existingServices = Object.keys(existing.services).filter((s) => ["postgres", "mysql", "redis", "mongodb"].includes(s)).map((name) => ({ name }));
    }
  }
  const servicesToTunnel = [];
  if (existingServices.length > 0) {
    const { tunnel } = await prompts({
      type: "confirm",
      name: "tunnel",
      message: "Tunnel to remote database services?",
      initial: false
    });
    if (tunnel) {
      const { selected } = await prompts({
        type: "multiselect",
        name: "selected",
        message: "Select services to tunnel:",
        choices: existingServices.map((s) => ({
          title: s.name,
          value: s.name
        }))
      });
      if (selected) {
        servicesToTunnel.push(
          ...existingServices.filter((s) => selected.includes(s.name)).map((s) => ({ ...s, needsTunnel: true }))
        );
      }
    }
  }
  for (const service of servicesToTunnel) {
    await createTunnelService(cwd, service.name);
  }
  const compose = {
    services: {
      [projectName]: {
        build: ".",
        ports: ["3000:3000"],
        env_file: [".env"],
        volumes: [".:/app", "/app/node_modules"],
        command: "npm run dev",
        depends_on: []
      }
    },
    networks: {
      default: {
        driver: "bridge"
      }
    }
  };
  for (const service of servicesToTunnel) {
    const tunnelName = `${service.name}-tunnel`;
    compose.services[tunnelName] = {
      build: `./${tunnelName}`,
      environment: [
        `REMOTE_HOST=\${${service.name.toUpperCase()}_REMOTE_HOST}`,
        `REMOTE_PORT=\${${service.name.toUpperCase()}_REMOTE_PORT:-${getDefaultPort(
          service.name
        )}}`,
        `LOCAL_PORT=${getDefaultPort(service.name)}`
      ],
      volumes: [`./${service.name}.pem:/ssh/${service.name}.pem:ro`]
    };
    compose.services[projectName].depends_on.push(tunnelName);
  }
  const devComposePath = path12.join(cwd, "docker-compose.dev.yml");
  await fs9.writeFile(
    devComposePath,
    yaml.dump(compose, { indent: 2, lineWidth: -1 })
  );
  await createEnvTemplate(cwd, services, "dev");
}
async function createTunnelService(projectDir, serviceName) {
  const tunnelDir = path12.join(projectDir, `${serviceName}-tunnel`);
  await fs9.ensureDir(tunnelDir);
  const dockerfile = `FROM alpine:latest

RUN apk add --no-cache openssh-client

COPY tunnel.sh /tunnel.sh
RUN chmod +x /tunnel.sh

CMD ["/tunnel.sh"]
`;
  const tunnelScript = `#!/bin/sh

SSH_KEY="/ssh/${serviceName}.pem"
REMOTE_HOST=\${REMOTE_HOST}
REMOTE_PORT=\${REMOTE_PORT:-${getDefaultPort(serviceName)}}
LOCAL_PORT=\${LOCAL_PORT:-${getDefaultPort(serviceName)}}

chmod 600 $SSH_KEY

echo "Starting SSH tunnel for ${serviceName}..."
echo "Remote: $REMOTE_HOST:$REMOTE_PORT -> Local: $LOCAL_PORT"

ssh -i $SSH_KEY \\
    -N -L 0.0.0.0:$LOCAL_PORT:localhost:$REMOTE_PORT \\
    -o StrictHostKeyChecking=no \\
    -o ServerAliveInterval=60 \\
    $REMOTE_HOST
`;
  await fs9.writeFile(path12.join(tunnelDir, "Dockerfile"), dockerfile);
  await fs9.writeFile(path12.join(tunnelDir, "tunnel.sh"), tunnelScript);
}
async function createEnvTemplate(projectDir, services, env) {
  const envPath = path12.join(projectDir, ".env.example");
  let content = `NODE_ENV=${env === "prod" ? "production" : "development"}
PORT=3000
`;
  if (services.length > 0) {
    content += `
`;
    for (const service of services) {
      const vars = getEnvVars(service.name);
      content += vars.join("\n") + "\n\n";
    }
  }
  await fs9.writeFile(envPath, content);
}
function getServiceConfig(serviceName) {
  const configs = {
    postgres: {
      service: {
        image: "postgres:15-alpine",
        environment: [
          "POSTGRES_USER=${DB_USER}",
          "POSTGRES_PASSWORD=${DB_PASSWORD}",
          "POSTGRES_DB=${DB_NAME}"
        ],
        volumes: ["postgres_data:/var/lib/postgresql/data"],
        networks: ["web"]
      },
      volume: { name: "postgres_data" }
    },
    mysql: {
      service: {
        image: "mysql:8",
        environment: [
          "MYSQL_ROOT_PASSWORD=${DB_ROOT_PASSWORD}",
          "MYSQL_DATABASE=${DB_NAME}",
          "MYSQL_USER=${DB_USER}",
          "MYSQL_PASSWORD=${DB_PASSWORD}"
        ],
        volumes: ["mysql_data:/var/lib/mysql"],
        networks: ["web"]
      },
      volume: { name: "mysql_data" }
    },
    redis: {
      service: {
        image: "redis:7-alpine",
        volumes: ["redis_data:/data"],
        networks: ["web"]
      },
      volume: { name: "redis_data" }
    },
    mongodb: {
      service: {
        image: "mongo:6",
        environment: [
          "MONGO_INITDB_ROOT_USERNAME=${DB_USER}",
          "MONGO_INITDB_ROOT_PASSWORD=${DB_PASSWORD}"
        ],
        volumes: ["mongo_data:/data/db"],
        networks: ["web"]
      },
      volume: { name: "mongo_data" }
    }
  };
  return configs[serviceName];
}
function getEnvVars(serviceName) {
  const vars = {
    postgres: [
      "DB_HOST=postgres",
      "DB_PORT=5432",
      "DB_USER=myuser",
      "DB_PASSWORD=mypassword",
      "DB_NAME=mydb"
    ],
    mysql: [
      "DB_HOST=mysql",
      "DB_PORT=3306",
      "DB_USER=myuser",
      "DB_PASSWORD=mypassword",
      "DB_NAME=mydb",
      "DB_ROOT_PASSWORD=rootpassword"
    ],
    redis: ["REDIS_HOST=redis", "REDIS_PORT=6379"],
    mongodb: [
      "MONGO_HOST=mongodb",
      "MONGO_PORT=27017",
      "MONGO_USER=myuser",
      "MONGO_PASSWORD=mypassword"
    ]
  };
  return vars[serviceName] || [];
}
function getDefaultPort(service) {
  const ports = {
    postgres: 5432,
    mysql: 3306,
    redis: 6379,
    mongodb: 27017
  };
  return ports[service] || 3e3;
}
function printNextSteps(projectName, env, services) {
  console.log(`
\u2705 Done! Next steps:
`);
  if (env === "prod") {
    console.log(`  # Edit .env with your settings`);
    console.log(`  docker-compose up -d`);
    console.log(`  # Access at https://localhost
`);
  } else {
    console.log(`  # Edit .env with your settings`);
    if (services.some((s) => s.needsTunnel)) {
      console.log(`  # Add SSH keys: {service}.pem`);
    }
    console.log(`  docker-compose -f docker-compose.dev.yml up -d
`);
  }
}

// src/main.ts
var program = new Command();
program.name("pod").description("Pod cli tool").version("0.0.0");
program.command("new <name>").description("Start a new Pod Project").action(async (name) => {
  await addNew(name);
  const appDir = path13.resolve(process.cwd(), name);
  console.log("Installing dependencies...");
  execSync("npm install", { stdio: "inherit", cwd: appDir });
  console.log("Starting development server...");
  execSync("npm run dev", { stdio: "inherit", cwd: appDir });
  console.log(`All done! Your app "${name}" is running in development mode.`);
});
program.command("dev").description("Start Pod development server").action(async (opts) => {
  await startDevServer();
});
program.command("add <type> <name>").description("Add a component (c) or a feature (f)").action(async (type, name) => {
  try {
    if (type === "c") {
      await addComponent(name);
    } else if (type === "f") {
      await addFeature(name);
    } else {
      console.error("\u274C Unknown type. Use 'c' or 'f'.");
    }
  } catch (err) {
    console.error("\u274C Error:", err.message);
  }
});
program.command("dockerize <env>").description("Dockerize a pod project.").action(async (env) => {
  try {
    await dockerize(env);
  } catch (err) {
    console.error("\u274C Error:", err.message);
  }
});
program.command("deploy <type> <options>").description("Deploy a Pod Project").action(async (type, name) => {
  try {
  } catch (err) {
    console.error("\u274C Error:", err.message);
  }
});
program.parse(process.argv);
export {
  config_exports as config,
  expandMacros,
  getDefaultConfig,
  getGlobalMacroGraph,
  loadConfig,
  macros_exports as macros,
  mergeConfig,
  plugins_exports as plugins,
  resetGlobalMacroGraph,
  store_exports as store,
  stylePlugin
};
//# sourceMappingURL=main.js.map
