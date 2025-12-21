import type { Plugin } from "esbuild";
import { DependencyGraph } from "./analyzers/graph";
interface MyPluginParams {
    isServerBuild: boolean;
    graph?: DependencyGraph;
    onClientFound: (path: string) => void;
}
export declare function useMyPlugin(options: MyPluginParams): Plugin;
export {};
//# sourceMappingURL=my.d.ts.map