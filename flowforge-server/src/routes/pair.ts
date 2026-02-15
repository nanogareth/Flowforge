import { Router } from "express";
import { validatePairingCode } from "../auth/pairing";
import { sign } from "../auth/jwt";
import { markPaired } from "./health";
import { config } from "../config";

// Simple in-memory rate limiter
const attempts: number[] = [];

function isRateLimited(): boolean {
  const now = Date.now();
  const { windowMs, max } = config.pairingRateLimit;

  // Remove expired entries
  while (attempts.length > 0 && attempts[0] < now - windowMs) {
    attempts.shift();
  }

  return attempts.length >= max;
}

export const pairRouter = Router();

pairRouter.post("/api/pair", (req, res) => {
  if (isRateLimited()) {
    res
      .status(429)
      .json({ error: "Too many pairing attempts. Try again later." });
    return;
  }

  attempts.push(Date.now());

  const { code } = req.body;
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Missing pairing code" });
    return;
  }

  if (validatePairingCode(code)) {
    const token = sign({ paired: true, pairedAt: Date.now() });
    markPaired();
    res.json({ token });
  } else {
    res.status(401).json({ error: "Invalid or expired code" });
  }
});
