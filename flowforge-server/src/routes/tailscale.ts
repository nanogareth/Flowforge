import { Router } from "express";
import { execFile } from "child_process";
import { config } from "../config";

export const tailscaleRouter = Router();

interface TailscaleStatus {
  available: boolean;
  ip: string | null;
  hostname: string | null;
  serverPort: number;
}

function getTailscaleStatus(): Promise<TailscaleStatus> {
  const unavailable: TailscaleStatus = {
    available: false,
    ip: null,
    hostname: null,
    serverPort: config.port,
  };

  return new Promise((resolve) => {
    execFile(
      "tailscale",
      ["status", "--json"],
      { timeout: 5000 },
      (err, stdout) => {
        if (err) {
          resolve(unavailable);
          return;
        }

        try {
          const status = JSON.parse(stdout);
          const self = status.Self;
          if (!self) {
            resolve(unavailable);
            return;
          }

          const ip =
            Array.isArray(self.TailscaleIPs) && self.TailscaleIPs.length > 0
              ? self.TailscaleIPs[0]
              : null;

          const hostname =
            self.HostName || self.DNSName?.replace(/\.$/, "") || null;

          resolve({
            available: true,
            ip,
            hostname,
            serverPort: config.port,
          });
        } catch {
          resolve(unavailable);
        }
      },
    );
  });
}

tailscaleRouter.get("/api/tailscale", async (_req, res) => {
  const status = await getTailscaleStatus();
  res.json(status);
});
