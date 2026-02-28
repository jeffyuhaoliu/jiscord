import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { waitForHealth } from "./helpers/wait";

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PID_FILE = "/tmp/jiscord-e2e-vite.pid";

export default async function globalSetup(): Promise<void> {
  console.log("[e2e:setup] Starting docker-compose services...");
  execSync("docker-compose up -d --build", {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
  });

  console.log("[e2e:setup] Waiting for data-service (3001)...");
  await waitForHealth("http://localhost:3001/health", 90_000);

  console.log("[e2e:setup] Waiting for auth-service (3003)...");
  await waitForHealth("http://localhost:3003/health", 30_000);

  console.log("[e2e:setup] Waiting for gateway (3002)...");
  await waitForHealth("http://localhost:3002/health", 30_000);

  console.log("[e2e:setup] Starting Vite dev server...");
  const webDir = path.join(PROJECT_ROOT, "apps", "web");
  const vite = spawn("npm", ["run", "dev"], {
    cwd: webDir,
    stdio: "pipe",
    detached: true,
  });

  if (vite.pid === undefined) {
    throw new Error("[e2e:setup] Failed to spawn Vite dev server");
  }

  fs.writeFileSync(PID_FILE, String(vite.pid), "utf-8");
  vite.unref();

  vite.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk);
  });

  console.log(`[e2e:setup] Vite PID ${vite.pid} written to ${PID_FILE}`);
  console.log("[e2e:setup] Waiting for Vite (5173)...");
  await waitForHealth("http://localhost:5173", 30_000);

  console.log("[e2e:setup] All services ready.");
}
