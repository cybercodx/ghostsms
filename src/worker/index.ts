import { Hono } from "hono";
import { SMSWebSocket } from "./SMSWebSocket";

// Export the Durable Object class so Cloudflare can find it
export { SMSWebSocket };

interface Env {
  SMS_DO: DurableObjectNamespace;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/api/ws", async (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (!upgradeHeader || upgradeHeader !== "websocket") {
    return c.text("Expected Upgrade: websocket", 426);
  }

  // Use a static ID to ensure all clients connect to the SAME Durable Object instance
  // This creates a "Room" where everyone sees the same SMS stream
  const id = c.env.SMS_DO.idFromName("GLOBAL_SMS_ROOM");
  const stub = c.env.SMS_DO.get(id);

  return stub.fetch(c.req.raw);
});

export default app;
