import { Router, Request, Response } from "express";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { authMiddleware } from "../auth/middleware";
import { config } from "../config";
import { createSession } from "../terminal/session-manager";

export const cloneRouter = Router();

cloneRouter.post(
  "/api/clone",
  authMiddleware,
  (req: Request, res: Response) => {
    const { cloneUrl, launchClaude } = req.body;

    if (!cloneUrl || typeof cloneUrl !== "string") {
      res.status(400).json({ error: "Missing cloneUrl" });
      return;
    }

    if (!cloneUrl.startsWith("https://") && !cloneUrl.startsWith("git@")) {
      res
        .status(400)
        .json({ error: "cloneUrl must start with https:// or git@" });
      return;
    }

    // Extract repo name from URL
    const repoName = path.basename(cloneUrl).replace(/\.git$/, "");
    const targetDir = path.join(config.cloneDir, repoName);

    // Ensure clone directory exists
    fs.mkdirSync(config.cloneDir, { recursive: true });

    // Set up NDJSON streaming response
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Transfer-Encoding", "chunked");

    const send = (obj: object) => {
      res.write(JSON.stringify(obj) + "\n");
    };

    send({
      type: "progress",
      message: `Cloning ${cloneUrl} into ${targetDir}...`,
    });

    const gitClone = spawn("git", ["clone", "--progress", cloneUrl, targetDir]);

    gitClone.stderr.on("data", (data: Buffer) => {
      // Git sends progress to stderr
      const message = data.toString().trim();
      if (message) {
        send({ type: "progress", message });
      }
    });

    gitClone.stdout.on("data", (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        send({ type: "progress", message });
      }
    });

    gitClone.on("error", (err) => {
      send({ type: "error", message: err.message });
      res.end();
    });

    gitClone.on("close", (code) => {
      if (code !== 0) {
        send({ type: "error", message: `Git clone exited with code ${code}` });
        res.end();
        return;
      }

      if (launchClaude) {
        const session = createSession({ cwd: targetDir, cmd: "claude" });
        if (session) {
          send({ type: "done", sessionId: session.id });
        } else {
          send({
            type: "error",
            message:
              "Clone succeeded but failed to create terminal session (max sessions reached)",
          });
        }
      } else {
        send({ type: "done" });
      }

      res.end();
    });
  },
);
