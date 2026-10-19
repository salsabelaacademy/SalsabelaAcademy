import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function devArguments(directory) {
  // Node 22 watch mode can try to watch an absent optional env file.
  // Replit Secrets are inherited; a local .env remains optional.
  return ["--watch", ...(existsSync(resolve(directory, ".env")) ? ["--env-file=.env"] : []),
    "--import", "tsx", "server/index.ts"];
}

export function startDevelopment(directory = fileURLToPath(new URL("../", import.meta.url))) {
  const child = spawn(process.execPath, devArguments(directory), {
    cwd: directory, stdio: "inherit", env: { ...process.env, NODE_ENV: "development" },
  });
  const stop = (signal) => { child.kill(signal); };
  const onInterrupt = () => stop("SIGINT");
  const onTerminate = () => stop("SIGTERM");
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onTerminate);
  child.on("error", () => { console.error("Unable to start the development process."); process.exitCode = 1; });
  child.on("exit", (code, signal) => {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onTerminate);
    process.exitCode = code ?? (signal === "SIGINT" || signal === "SIGTERM" ? 0 : 1);
  });
  return child;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startDevelopment();
