import http from "http";

export async function pollUntil(
  fn: () => Promise<boolean>,
  timeoutMs: number,
  intervalMs = 1000,
  label = "condition"
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await sleep(intervalMs);
  }
  throw new Error(`Timeout waiting for ${label} after ${timeoutMs}ms`);
}

export async function waitForHealth(
  url: string,
  timeoutMs: number
): Promise<void> {
  await pollUntil(
    () =>
      new Promise<boolean>((resolve) => {
        const req = http.get(url, (res) => {
          resolve(res.statusCode !== undefined && res.statusCode < 500);
        });
        req.on("error", () => resolve(false));
        req.setTimeout(2000, () => {
          req.destroy();
          resolve(false);
        });
      }),
    timeoutMs,
    1000,
    url
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
