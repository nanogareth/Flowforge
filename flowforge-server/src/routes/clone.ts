import { Router, Request, Response } from "express";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { authMiddleware } from "../auth/middleware";
import { config } from "../config";
import { createSession } from "../terminal/session-manager";

export const cloneRouter = Router();

const PROMPT_PATTERNS = [/❯/, />\s*$/, /\?\s*$/, /\$\s*$/];
const INIT_TIMEOUT_MS = 30_000;

cloneRouter.post(
  "/api/clone",
  authMiddleware,
  (req: Request, res: Response) => {
    const { cloneUrl, launchClaude, runInit } = req.body;

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
        send({ type: "progress", message: "Launching Claude..." });
        const session = createSession({ cwd: targetDir, cmd: "claude" });
        if (!session) {
          send({
            type: "error",
            message:
              "Clone succeeded but failed to create terminal session (max sessions reached)",
          });
          res.end();
          return;
        }

        if (runInit) {
          send({ type: "progress", message: "Waiting for Claude to load..." });

          let initSent = false;

          const sendInit = () => {
            if (initSent) return;
            initSent = true;
            disposable.dispose();
            clearTimeout(timeout);
            send({ type: "progress", message: "Running /init..." });
            session.pty.write("/init\r");
            send({ type: "done", sessionId: session.id });
            res.end();
          };

          const disposable = session.pty.onData((data: string) => {
            if (initSent) return;
            for (const pattern of PROMPT_PATTERNS) {
              if (pattern.test(data)) {
                sendInit();
                return;
              }
            }
          });

          const timeout = setTimeout(() => {
            sendInit();
          }, INIT_TIMEOUT_MS);
        } else {
          send({ type: "done", sessionId: session.id });
          res.end();
        }
      } else {
        send({ type: "done" });
        res.end();
      }
    });
  },
);
