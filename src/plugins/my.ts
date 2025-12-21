import type { Plugin, OnLoadArgs, OnLoadResult } from "esbuild";
import * as fs from "fs/promises";
import { ReactConfig, transform } from "@swc/core";
import * as babel from "@babel/core";
import * as path from "path";
import { expandMacros } from "@/macros";
import { DependencyGraph, FileNode } from "./analyzers/graph";
import { generateController } from "./generators/generate_controller";
import { generateServerStub } from "./generators/tsx_server_stub";
import { j2d } from "./transformers/j2d";
import { generateServerComponent } from "./generators/generate_server_component";
import { generateRscStub } from "./generators/generate_rsc";

interface MyPluginParams {
  isServerBuild: boolean;
  graph?: DependencyGraph;
  onClientFound: (path: string) => void;
}

type FileDirective = "interactive" | "public" | null;

interface FileMetadata {
  source: string;
  path: string;
  isTsx: boolean;
  directive: FileDirective;
  isPublicFile: boolean;
  isInteractiveFile: boolean;
}

async function swcTransform(
  source: string,
  pathStr: string,
  tsx: boolean = false,
  react?: ReactConfig
): Promise<OnLoadResult> {
  const resolveDir = path.dirname(pathStr);

  const swcResult = await transform(source, {
    filename: pathStr,
    jsc: {
      parser: {
        syntax: "typescript",
        tsx,
        decorators: true,
      },
      transform: {
        legacyDecorator: true,
        decoratorMetadata: true,
        react,
      },
      target: "esnext",
    },
    isModule: true,
  });

  return {
    contents: swcResult.code,
    loader: "js",
    resolveDir,
  };
}

function parseFileMetadata(source: string, path: string): FileMetadata {
  const isTsx = path.endsWith(".tsx");
  const isInteractiveFile =
    source.startsWith('"use interactive"') ||
    source.startsWith("'use interactive'");
  const isPublicFile =
    source.startsWith('"use public"') || source.startsWith("'use public'");

  let directive: FileDirective = null;
  if (isInteractiveFile) directive = "interactive";
  else if (isPublicFile) directive = "public";

  return {
    source,
    path,
    isTsx,
    directive,
    isPublicFile,
    isInteractiveFile,
  };
}

class ServerBuildTransformer {
  async transformPublicFile(
    source: string,
    path: string
  ): Promise<OnLoadResult> {
    const controllerCode = generateController(path, source);

    if (controllerCode) {
      source = `${source}\n\n${controllerCode}\n`;
    }

    return swcTransform(source, path);
  }

  async transformRegularTypeScript(
    source: string,
    path: string,
    isPublic: boolean
  ): Promise<OnLoadResult> {
    if (isPublic) {
      return this.transformPublicFile(source, path);
    }
    return swcTransform(source, path);
  }

  async transformServerTsx(
    source: string,
    path: string
  ): Promise<OnLoadResult> {
    return swcTransform(source, path, true, {
      runtime: "automatic",
      importSource: "@kithinji/orca",
    });
  }

  async transformInteractiveTsxStub(
    source: string,
    path: string
  ): Promise<OnLoadResult> {
    const stubSource = generateServerStub(path, source);
    return swcTransform(stubSource, path);
  }

  async process(
    metadata: FileMetadata,
    onClientFound: (path: string) => void
  ): Promise<OnLoadResult> {
    const expandedSource = await expandMacros(metadata.source, metadata.path);

    const expandedMetadata = { ...metadata, source: expandedSource };
    const { source, path, isTsx, isInteractiveFile, isPublicFile } =
      expandedMetadata;

    if (isTsx) {
      if (isInteractiveFile) {
        onClientFound(path);
        return this.transformInteractiveTsxStub(source, path);
      }
      return this.transformServerTsx(source, path);
    }

    return this.transformRegularTypeScript(source, path, isPublicFile);
  }
}

class ClientBuildTransformer {
  async transformInteractiveTsx(
    source: string,
    path: string
  ): Promise<OnLoadResult> {
    const swcResult = await swcTransform(source, path, true, {
      runtime: "preserve",
    });

    const babelResult = await babel.transformAsync(
      swcResult.contents as string,
      {
        filename: path,
        sourceType: "module",
        plugins: [j2d],
        parserOpts: {
          plugins: ["jsx"],
        },
        configFile: false,
        babelrc: false,
      }
    );

    return {
      contents: babelResult?.code || "",
      loader: "js",
      resolveDir: swcResult.resolveDir,
    };
  }

  async transformServerComponent(
    node: FileNode,
    source: string,
    path: string
  ): Promise<OnLoadResult> {
    const scSource = generateServerComponent(path, source);
    return swcTransform(scSource, path);
  }

  async transformPublicFileRsc(
    node: FileNode,
    source: string,
    path: string
  ): Promise<OnLoadResult> {
    const stubSource = generateRscStub(path, source);
    return swcTransform(stubSource, path);
  }

  async transformSharedCode(
    source: string,
    path: string
  ): Promise<OnLoadResult> {
    return swcTransform(source, path);
  }

  async process(node: FileNode, metadata: FileMetadata): Promise<OnLoadResult> {
    const expandedSource = await expandMacros(metadata.source, metadata.path);

    const expandedMetadata = { ...metadata, source: expandedSource };
    const { source, path, isTsx, directive } = expandedMetadata;

    if (isTsx) {
      if (directive === "interactive") {
        return this.transformInteractiveTsx(source, path);
      } else if (directive === null) {
        return this.transformServerComponent(node, source, path);
      } else {
        throw new Error(
          `Unexpected directive "${directive}" for TSX file: ${path}`
        );
      }
    }

    if (directive === "public") {
      return this.transformPublicFileRsc(node, source, path);
    }

    if (directive === null) {
      return this.transformSharedCode(source, path);
    }

    return {
      contents: source,
      loader: isTsx ? "tsx" : "ts",
    };
  }
}

export function useMyPlugin(options: MyPluginParams): Plugin {
  const serverTransformer = new ServerBuildTransformer();
  const clientTransformer = new ClientBuildTransformer();

  return {
    name: "Orca",
    setup(build) {
      build.onLoad(
        { filter: /\.tsx?$/ },
        async (args: OnLoadArgs): Promise<OnLoadResult> => {
          const source = await fs.readFile(args.path, "utf8");
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
    },
  };
}
