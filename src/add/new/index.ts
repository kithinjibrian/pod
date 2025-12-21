import { createStructure, DirEntry } from "@/utils";
import path from "path";
import { addModule } from "../module";
import { addComponent } from "../component";

export function addNew(name: string) {
  const baseDir = path.join(process.cwd(), name);

  const structure: DirEntry = {
    files: [
      { name: "package.json", content: genPackageJson(name) },
      { name: "tsconfig.json", content: gentsconfig() },
      { name: "pod.config.ts", content: genPodConfig(name) },
      { name: "README.md", content: genReadMe() },
      { name: ".gitignore", content: genGitIgnore() },
      { name: ".env", content: genEnv() },
    ],
    dirs: [
      {
        name: "src",
        files: [{ name: "main.ts", content: genMainTs() }],
      },
    ],
  };

  createStructure(baseDir, structure);

  const appDir = path.join(process.cwd(), name, "src", "app");

  addModule("app", appDir);

  process.chdir(baseDir);

  addComponent("button");

  console.log(`App ${name} created successfully`);
}

function genPackageJson(name: string) {
  const pj = {
    name,
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: {
      dev: "pod dev",
      build: "pod build",
      start: "pod start",
    },
    dependencies: {
      "reflect-metadata": "latest",
      zod: "^4.2.1",
      "@kithinji/orca": "latest",
    },
    devDependencies: {
      "@types/node": "^20.19.27",
      typescript: "~5.9.3",
      "@kithinji/pod": "latest",
    },
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
        "@/*": ["src/*"],
      },
    },
    include: ["src"],
  };

  return JSON.stringify(tsconfig, null, 2);
}

function genPodConfig(name: string) {
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
