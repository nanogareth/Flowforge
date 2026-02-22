import type { IPty } from "node-pty";

export interface TerminalSession {
  id: string;
  pty: IPty;
  scrollback: string;
  clients: Set<import("ws").WebSocket>;
  lastActivity: number;
  cwd: string;
  exited: boolean;
  exitCode?: number;
}

// Client → Server
export type ClientMessage =
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "ping" };

// Server → Client
export type ServerMessage =
  | { type: "session"; id: string }
  | { type: "output"; data: string }
  | { type: "scrollback"; data: string }
  | { type: "exit"; code: number }
  | { type: "pong" }
  | { type: "error"; message: string };

export interface ActiveSessionInfo {
  id: string;
  cwd: string;
  lastActivity: number;
  exited: boolean;
  clientCount: number;
}

export interface ConversationInfo {
  sessionId: string;
  slug: string | null;
  timestamp: string;
  gitBranch: string | null;
  lastModified: string;
  active: boolean;
}
