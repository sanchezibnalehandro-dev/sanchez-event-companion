import { spawn } from "node:child_process";
import { resolve } from "node:path";

const nextCliPath = resolve(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const child = spawn(
  process.execPath,
  [nextCliPath, "dev", "--hostname", "127.0.0.1", ...process.argv.slice(2)],
  {
    env: {
      ...process.env,
      NODE_ENV: "development",
      EVENT_COMPANION_LOCAL_DEMO: "true",
      EVENT_COMPANION_DATABASE_DRIVER: "sqlite",
    },
    stdio: "inherit",
  },
);

child.once("error", (error) => {
  console.error(`Unable to start the local demo: ${error.message}`);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) {
    console.error(`Local demo stopped by signal ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
