import { Router } from "express";

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

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    sessions: sessionCountFn(),
    paired,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
});
