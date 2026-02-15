import crypto from "crypto";
import { config } from "../config";

let currentCode: string | null = null;
let codeExpiry: number = 0;

export function generatePairingCode(): string {
  currentCode = String(crypto.randomInt(100000, 999999));
  codeExpiry = Date.now() + config.pairingExpiry;
  return currentCode;
}

export function validatePairingCode(code: string): boolean {
  if (!currentCode || Date.now() > codeExpiry) {
    currentCode = null;
    return false;
  }

  if (code === currentCode) {
    currentCode = null; // Invalidate on success
    return true;
  }

  return false;
}
