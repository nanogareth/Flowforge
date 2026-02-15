import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { config } from "./config";
import { generatePairingCode } from "./auth/pairing";
import { healthRouter, setSessionCountFn } from "./routes/health";
import { pairRouter } from "./routes/pair";
import { cloneRouter } from "./routes/clone";
import { handleWebSocket } from "./terminal/ws-handler";
import {
  getSessionCount,
  startGarbageCollector,
} from "./terminal/session-manager";

const app = express();

// Middleware
app.use(express.json());
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  next();
});
app.options("*", (_req, res) => res.sendStatus(204));

// Routes
app.use(healthRouter);
app.use(pairRouter);
app.use(cloneRouter);

// Wire session count into health endpoint
setSessionCountFn(getSessionCount);

// HTTP + WebSocket server
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  handleWebSocket(ws, req);
});

// Start garbage collector for inactive sessions
startGarbageCollector();

// Startup
const code = generatePairingCode();

server.listen(config.port, "0.0.0.0", () => {
  console.log(`
╔══════════════════════════════════════╗
║   FlowForge Terminal Server          ║
║   Pairing Code: ${code}               ║
║   Port: ${config.port}                         ║
╚══════════════════════════════════════╝
`);
});

export { app, server, wss };
