import { Router } from "express";
import { execFile } from "child_process";

let paired = false;
const startTime = Date.now();
let sessionCountFn: () => number = () => 0;

export function markPaired(): void {
  paired = true;
}

export function isPaired(): boolean {
  return paired;
}

export function setSessionCountFn(fn: () => number): void {
  sessionCountFn = fn;
}

function getTailscaleIp(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile("tailscale", ["ip", "-4"], { timeout: 3000 }, (err, stdout) => {
      if (err) {
        resolve(null);
        return;
      }
      const ip = stdout.trim();
      resolve(ip || null);
    });
  });
}

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  const tailscaleIp = await getTailscaleIp();
  res.json({
    status: "ok",
    sessions: sessionCountFn(),
    paired,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    tailscaleIp,
  });
});
