import * as pty from "node-pty";
import { v4 as uuidv4 } from "uuid";
import type { WebSocket } from "ws";
import { config } from "../config";
import type { TerminalSession, ServerMessage } from "../types";

const sessions = new Map<string, TerminalSession>();

function broadcast(session: TerminalSession, msg: ServerMessage): void {
  const data = JSON.stringify(msg);
  for (const client of session.clients) {
    if (client.readyState === 1) {
      // WebSocket.OPEN
      client.send(data);
    }
  }
}

function appendScrollback(session: TerminalSession, chunk: string): void {
  session.scrollback += chunk;
  if (session.scrollback.length > config.scrollbackSize) {
    session.scrollback = session.scrollback.slice(-config.scrollbackSize);
  }
}

export function createSession(options?: {
  cwd?: string;
  cmd?: string;
}): TerminalSession | null {
  if (sessions.size >= config.maxSessions) {
    return null;
  }

  const id = uuidv4();
  const shell = process.platform === "win32" ? "powershell.exe" : "bash";
  const cwd = options?.cwd || process.cwd();

  const ptyProcess = pty.spawn(shell, [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd,
  });

  const session: TerminalSession = {
    id,
    pty: ptyProcess,
    scrollback: "",
    clients: new Set(),
    lastActivity: Date.now(),
    cwd,
    exited: false,
  };

  ptyProcess.onData((data: string) => {
    session.lastActivity = Date.now();
    appendScrollback(session, data);
    broadcast(session, { type: "output", data });
  });

  ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
    session.exited = true;
    session.exitCode = exitCode;
    broadcast(session, { type: "exit", code: exitCode });
  });

  // If a command was specified, send it to the pty
  if (options?.cmd) {
    ptyProcess.write(options.cmd + "\r");
  }

  sessions.set(id, session);
  return session;
}

export function getSession(id: string): TerminalSession | undefined {
  return sessions.get(id);
}

export function getSessionCount(): number {
  return sessions.size;
}

export function attachClient(sessionId: string, ws: WebSocket): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;

  session.clients.add(ws);
  session.lastActivity = Date.now();

  // Send scrollback to the new client
  ws.send(JSON.stringify({ type: "scrollback", data: session.scrollback }));

  return true;
}

export function detachClient(sessionId: string, ws: WebSocket): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.clients.delete(ws);
  }
}

export function destroySession(id: string): void {
  const session = sessions.get(id);
  if (!session) return;

  if (!session.exited) {
    session.pty.kill();
  }
  sessions.delete(id);
}

export function startGarbageCollector(): void {
  setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (
        session.clients.size === 0 &&
        now - session.lastActivity > config.inactivityTimeout
      ) {
        destroySession(id);
      }
    }
  }, 60 * 1000);
}
