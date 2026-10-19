import { EventEmitter } from "node:events";
import type { RequestHandler, Response } from "express";

// Events contain no messages or account details. Each subscriber must fetch through the authorized API.
const changes = new EventEmitter();
changes.setMaxListeners(0);
const connections = new Map<number, number>();
const streams = new Set<Response>();
export function closeConversationEvents() {
  streams.forEach(response => response.end());
}
export function conversationChanged(...ids: number[]) {
  for (const id of Array.from(new Set(ids))) changes.emit(String(id));
}
export const conversationEvents: RequestHandler = (req, res) => {
  const id = (req as any).auth.user.id as number;
  if ((connections.get(id) || 0) >= 6) return void res.status(429).json({ code: "limited" });
  connections.set(id, (connections.get(id) || 0) + 1);
  res.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders();
  streams.add(res);
  const send = () => {
    if (res.destroyed || res.writableEnded) return;
    try { res.write("event: changed\ndata: {}\n\n"); res.flush?.(); }
    catch { res.end(); } // A disconnected viewer cannot turn a committed message into a send error.
  };
  res.write("retry: 5000\n\n");
  res.flush?.();
  changes.on(String(id), send);
  const heartbeat = setInterval(() => { res.write(": keep-alive\n\n"); res.flush?.(); }, 25000);
  // Reauthentication on reconnect also handles expiring/revoked sessions.
  const lifetime = setTimeout(() => res.end(), 5 * 60000);
  let closed = false;
  res.on("close", () => {
    if (closed) return;
    closed = true;
    streams.delete(res);
    clearInterval(heartbeat); clearTimeout(lifetime);
    changes.off(String(id), send);
    const count = (connections.get(id) || 1) - 1;
    if (count) connections.set(id, count); else connections.delete(id);
  });
};
