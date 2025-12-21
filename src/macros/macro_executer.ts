import * as vm from "node:vm";
import * as esbuild from "esbuild";
import * as path from "node:path";
import Module from "node:module";

type MacroFunction = Function & { name: string };

type LoadedMacros = Record<string, MacroFunction>;

export class MacroExecutor {
  private cache = new Map<string, LoadedMacros>();

  getMacro(specifier: string, macroName?: string): MacroFunction {
    if (!this.cache.has(specifier)) {
      this.load(specifier);
    }

    const macros = this.cache.get(specifier)!;

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

  private load(specifier: string) {
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
      external: [...Module.builtinModules],
    });

    const code = outputFiles[0].text;

    const sandboxRequire = Module.createRequire(entry);

    const sandbox: any = {
      module: { exports: {} },
      exports: {},
      require: sandboxRequire,
      console,
      __filename: entry,
      __dirname: path.dirname(entry),
      process,
    };

    sandbox.global = sandbox;

    const context = vm.createContext(sandbox);
    new vm.Script(code, { filename: entry }).runInContext(context);

    const macros: LoadedMacros = {};
    const exports = sandbox.module.exports;

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
}

const macroExecutor = new MacroExecutor();

export function macroExecuter(): MacroExecutor {
  return macroExecutor;
}
