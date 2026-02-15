import dotenv from "dotenv";
import path from "path";
import os from "os";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "7433", 10),
  jwtExpiry: 365 * 24 * 60 * 60, // 365 days in seconds
  maxSessions: 5,
  scrollbackSize: 50 * 1024, // 50KB
  inactivityTimeout: 30 * 60 * 1000, // 30 minutes
  cloneDir: path.join(os.homedir(), "projects"),
  secretDir: path.join(os.homedir(), ".flowforge-server"),
  pairingExpiry: 10 * 60 * 1000, // 10 minutes
  pairingRateLimit: { windowMs: 60 * 1000, max: 5 },
};
