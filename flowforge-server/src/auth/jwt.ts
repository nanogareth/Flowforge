import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { config } from "../config";

let secret: string;

function getSecret(): string {
  if (secret) return secret;

  const keyPath = path.join(config.secretDir, "secret.key");

  try {
    secret = fs.readFileSync(keyPath, "utf-8");
  } catch {
    // Generate new secret
    secret = crypto.randomBytes(64).toString("hex");
    fs.mkdirSync(config.secretDir, { recursive: true });
    fs.writeFileSync(keyPath, secret, { encoding: "utf-8" });

    // Set restrictive permissions on Unix
    if (process.platform !== "win32") {
      fs.chmodSync(keyPath, 0o600);
    }
  }

  return secret;
}

export function sign(payload: object): string {
  return jwt.sign(payload, getSecret(), { expiresIn: config.jwtExpiry });
}

export function verify(token: string): jwt.JwtPayload {
  return jwt.verify(token, getSecret()) as jwt.JwtPayload;
}
