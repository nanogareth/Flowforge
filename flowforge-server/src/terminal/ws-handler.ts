import type { IncomingMessage } from "http";
import type { WebSocket } from "ws";
import { URL } from "url";
import { verify } from "../auth/jwt";
import {
  createSession,
  getSession,
  attachClient,
  detachClient,
} from "./session-manager";
import type { ClientMessage } from "../types";

export function handleWebSocket(ws: WebSocket, req: IncomingMessage): void {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Authenticate via query param
  const token = url.searchParams.get("token");
  if (!token) {
    ws.send(JSON.stringify({ type: "error", message: "Missing token" }));
    ws.close(4001, "Missing token");
    return;
  }

  try {
    verify(token);
  } catch {
    ws.send(JSON.stringify({ type: "error", message: "Invalid token" }));
    ws.close(4001, "Invalid token");
    return;
  }

  // Route: /terminal — new session
  if (pathname === "/terminal") {
    const session = createSession();
    if (!session) {
      ws.send(
        JSON.stringify({ type: "error", message: "Max sessions reached" }),
      );
      ws.close(4002, "Max sessions reached");
      return;
    }

    attachClient(session.id, ws);
    wireSession(ws, session.id);
    return;
  }

  // Route: /terminal/:id — reconnect to existing session
  const match = pathname.match(/^\/terminal\/(.+)$/);
  if (match) {
    const sessionId = match[1];
    const session = getSession(sessionId);
    if (!session) {
      ws.send(JSON.stringify({ type: "error", message: "Session not found" }));
      ws.close(4004, "Session not found");
      return;
    }

    attachClient(sessionId, ws);
    wireSession(ws, sessionId);
    return;
  }

  ws.send(JSON.stringify({ type: "error", message: "Unknown path" }));
  ws.close(4000, "Unknown path");
}

function wireSession(ws: WebSocket, sessionId: string): void {
  ws.on("message", (raw: Buffer | string) => {
    const session = getSession(sessionId);
    if (!session || session.exited) return;

    try {
      const msg: ClientMessage = JSON.parse(
        typeof raw === "string" ? raw : raw.toString(),
      );

      switch (msg.type) {
        case "input":
          session.pty.write(msg.data);
          session.lastActivity = Date.now();
          break;
        case "resize":
          session.pty.resize(msg.cols, msg.rows);
          break;
        case "ping":
          ws.send(JSON.stringify({ type: "pong" }));
          break;
      }
    } catch {
      ws.send(
        JSON.stringify({ type: "error", message: "Invalid message format" }),
      );
    }
  });

  ws.on("close", () => {
    detachClient(sessionId, ws);
  });
}
