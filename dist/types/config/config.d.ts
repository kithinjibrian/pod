import { Store } from "@/store";
import type { Plugin } from "esbuild";
export type PodPlugin = (store: Store) => Plugin;
export interface PodConfig {
    build?: {
        outDir?: string;
        sourcemap?: boolean;
        minify?: boolean;
    };
    plugins?: Array<PodPlugin>;
    client_plugins?: Array<PodPlugin>;
    server_plugins?: Array<PodPlugin>;
}
export declare function loadConfig(root?: string): Promise<PodConfig>;
export declare function getDefaultConfig(): PodConfig;
export declare function mergeConfig(defaults: PodConfig, userConfig: PodConfig): PodConfig;
//# sourceMappingURL=config.d.ts.map