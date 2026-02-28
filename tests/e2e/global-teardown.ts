import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PID_FILE = "/tmp/jiscord-e2e-vite.pid";

export default async function globalTeardown(): Promise<void> {
  // Kill Vite dev server via saved PID
  if (fs.existsSync(PID_FILE)) {
    const pid = parseInt(fs.readFileSync(PID_FILE, "utf-8").trim(), 10);
    if (!isNaN(pid)) {
      console.log(`[e2e:teardown] Killing Vite (PID ${pid})...`);
      try {
        // Kill the process group to catch child processes too
        process.kill(-pid, "SIGTERM");
      } catch {
        try {
          process.kill(pid, "SIGTERM");
        } catch {
          // Process already gone
        }
      }
    }
    fs.unlinkSync(PID_FILE);
  }

  console.log("[e2e:teardown] Shutting down docker-compose (with volumes)...");
  execSync("docker-compose down -v", {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
  });

  console.log("[e2e:teardown] Done.");
}
