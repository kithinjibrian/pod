#!/usr/bin/env node
import { Command } from "commander";
import { startDevServer } from "./dev";

import * as store from "./store";
export { store };

import * as config from "./config";
export { config };

export * from "./config/config";

import * as macros from "./macros";
export { macros };

export * from "./macros/expand_macros";

import * as plugins from "./plugins";
export { plugins };
export * from "./plugins/css";

import { addComponent, addNew } from "./add";
import { addFeature } from "./add/module";

import path from "path";
import { execSync } from "child_process";
import { dockerize } from "./docker";

const program = new Command();

program.name("pod").description("Pod cli tool").version("0.0.0");

program
  .command("new <name>")
  .description("Start a new Pod Project")
  .action(async (name: string) => {
    await addNew(name);

    const appDir = path.resolve(process.cwd(), name);

    console.log("Installing dependencies...");
    execSync("npm install", { stdio: "inherit", cwd: appDir });

    console.log("Starting development server...");
    execSync("npm run dev", { stdio: "inherit", cwd: appDir });

    console.log(`All done! Your app "${name}" is running in development mode.`);
  });

program
  .command("dev")
  .description("Start Pod development server")
  .action(async (opts) => {
    await startDevServer();
  });

program
  .command("add <type> <name>")
  .description("Add a component (c) or a feature (f)")
  .action(async (type, name) => {
    try {
      if (type === "c") {
        await addComponent(name);
      } else if (type === "f") {
        await addFeature(name);
      } else {
        console.error("❌ Unknown type. Use 'c' or 'f'.");
      }
    } catch (err: any) {
      console.error("❌ Error:", err.message);
    }
  });

program
  .command("dockerize <env>")
  .description("Dockerize a pod project.")
  .action(async (env) => {
    try {
      await dockerize(env);
    } catch (err: any) {
      console.error("❌ Error:", err.message);
    }
  });

program
  .command("deploy <type> <options>")
  .description("Deploy a Pod Project")
  .action(async (type, name) => {
    try {
    } catch (err: any) {
      console.error("❌ Error:", err.message);
    }
  });

program.parse(process.argv);
