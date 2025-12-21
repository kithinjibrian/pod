import type { PluginObj } from "@babel/core";
import * as BabelTypes from "@babel/types";
interface PluginContext {
    types: typeof BabelTypes;
}
interface PluginState {
    helpersImported?: boolean;
}
export declare function j2d({ types: t }: PluginContext): PluginObj<PluginState>;
export {};
//# sourceMappingURL=j2d.d.ts.map