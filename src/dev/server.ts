import * as esbuild from "esbuild";
import { spawn, ChildProcess } from "child_process";
import * as fs from "fs/promises";
import { loadConfig, mergeConfig, getDefaultConfig } from "../config/config";
import { buildGraph, useMyPlugin } from "@/plugins";
import { Store } from "@/store";

async function copyFile(): Promise<void> {
  try {
    await fs.mkdir("public", { recursive: true });
    await fs.copyFile("./src/client/index.html", "./public/index.html");
  } catch (error) {
    console.error("❌ Failed to copy index.html:", error);
    throw error;
  }
}

async function cleanDirectories(): Promise<void> {
  await Promise.all([
    fs.rm("dist", { recursive: true, force: true }),
    fs.rm("public", { recursive: true, force: true }),
  ]);
}

function createRestartServerPlugin(
  serverProcess: { current: ChildProcess | null },
  onServerBuildComplete: () => void
): esbuild.Plugin {
  return {
    name: "restart-server",
    setup(build) {
      build.onEnd((result) => {
        if (result.errors.length > 0) {
          console.error(
            `❌ Server build failed with ${result.errors.length} error(s)`
          );
          return;
        }

        if (serverProcess.current) {
          serverProcess.current.kill("SIGTERM");
        }

        serverProcess.current = spawn("node", ["dist/main.js"], {
          stdio: "inherit",
        });

        serverProcess.current.on("error", (err) => {
          console.error("❌ Server process error:", err);
        });

        onServerBuildComplete();
      });
    },
  };
}

export async function startDevServer(): Promise<void> {
  const store = Store.getInstance();
  const userConfig = await loadConfig();
  const config = mergeConfig(getDefaultConfig(), userConfig);

  await cleanDirectories();
  await copyFile();

  const entryPoints = ["src/main.ts"];
  const clientFiles = new Set<string>(["src/client/client.tsx"]);
  const serverProcessRef = { current: null as ChildProcess | null };
  let clientCtx: esbuild.BuildContext | null = null;
  let isShuttingDown = false;

  let pendingClientFiles = new Set<string>();
  let needsClientRebuild = false;

  async function rebuildClient(): Promise<void> {
    if (isShuttingDown) return;

    try {
      if (clientCtx) {
        await clientCtx.dispose();
        clientCtx = null;
      }

      if (clientFiles.size === 0) return;

      const entryPoints = Array.from(clientFiles);

      const graph = buildGraph(entryPoints);

      clientCtx = await esbuild.context({
        entryPoints,
        bundle: true,
        outdir: "public",
        outbase: ".",
        platform: "browser",
        format: "esm",
        sourcemap: config.build?.sourcemap ?? true,
        splitting: true,
        minify: config.build?.minify ?? true,
        plugins: [
          ...(config.plugins?.map((cb) => cb(store)) || []),
          ...(config.client_plugins?.map((cb) => cb(store)) || []),
          useMyPlugin({
            graph,
            isServerBuild: false,
            onClientFound: () => {},
          }),
          {
            name: "client-build-logger",
            setup(build: any) {
              build.onEnd((result: any) => {
                if (result.errors.length > 0) {
                  console.error(
                    `❌ Client build failed with ${result.errors.length} error(s)`
                  );
                }
              });
            },
          },
        ],
        write: true,
      });

      await clientCtx.watch();
      pendingClientFiles.clear();
      needsClientRebuild = false;
    } catch (error) {
      console.error("❌ Failed to rebuild client:", error);
      throw error;
    }
  }

  async function onServerBuildComplete(): Promise<void> {
    if (needsClientRebuild && pendingClientFiles.size > 0) {
      await rebuildClient();
    }
  }

  const serverCtx = await esbuild.context({
    entryPoints,
    bundle: true,
    outdir: config.build?.outDir || "dist",
    platform: "node",
    format: "esm",
    packages: "external",
    sourcemap: config.build?.sourcemap ?? true,
    minify: config.build?.minify ?? false,
    plugins: [
      ...(config.plugins?.map((cb) => cb(store)) || []),
      useMyPlugin({
        isServerBuild: true,
        onClientFound: async (filePath) => {
          const isNewFile = !clientFiles.has(filePath);

          if (isNewFile) {
            clientFiles.add(filePath);
            pendingClientFiles.add(filePath);
            needsClientRebuild = true;
          }
        },
      }),
      createRestartServerPlugin(serverProcessRef, onServerBuildComplete),
    ],
    write: true,
  });

  async function shutdown(): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    try {
      if (serverProcessRef.current) {
        serverProcessRef.current.kill("SIGTERM");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      await serverCtx.dispose();
      if (clientCtx) await clientCtx.dispose();

      process.exit(0);
    } catch (error) {
      console.error("❌ Error during shutdown:", error);
      process.exit(1);
    }
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await serverCtx.watch();
}
