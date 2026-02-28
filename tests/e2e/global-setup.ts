import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { waitForHealth, waitForPort, pollUntil } from "./helpers/wait";

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PID_FILE = "/tmp/jiscord-e2e-vite.pid";
const MIGRATIONS = ["001_users.cql", "002_messages.cql", "003_guilds.cql"];

async function runMigrations(): Promise<void> {
  const migrationsDir = path.join(PROJECT_ROOT, "migrations");

  for (const file of MIGRATIONS) {
    const cql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");

    // cqlsh can still reject connections briefly after the TCP port opens.
    // Retry up to 30s per migration file.
    await pollUntil(
      () =>
        new Promise<boolean>((resolve) => {
          try {
            execSync("docker-compose exec -T scylladb cqlsh", {
              cwd: PROJECT_ROOT,
              input: cql,
              stdio: ["pipe", "pipe", "pipe"],
            });
            resolve(true);
          } catch {
            resolve(false);
          }
        }),
      30_000,
      2000,
      `migration ${file}`
    );

    console.log(`[e2e:setup] Migration applied: ${file}`);
  }
}

export default async function globalSetup(): Promise<void> {
  console.log("[e2e:setup] Starting docker-compose services...");
  execSync("docker-compose up -d --build", {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
  });

  // Wait for ScyllaDB's CQL port (9042) to accept TCP connections.
  // ScyllaDB takes 60-120s to initialize in developer mode.
  console.log("[e2e:setup] Waiting for ScyllaDB CQL port (9042)...");
  await waitForPort("localhost", 9042, 180_000);

  // Run schema migrations now that Scylla is up.
  // This must happen before data-service can connect (keyspace must exist).
  console.log("[e2e:setup] Running schema migrations...");
  await runMigrations();

  // data-service has restart:on-failure — it will succeed on its next restart
  // now that the jiscord keyspace exists.
  console.log("[e2e:setup] Waiting for data-service (3001)...");
  await waitForHealth("http://localhost:3001/health", 60_000);

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
