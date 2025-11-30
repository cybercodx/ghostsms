import { DurableObject } from "cloudflare:workers";

interface Env {
  SMS_DO: DurableObjectNamespace;
}

export class SMSWebSocket extends DurableObject {
  private sessions: Set<WebSocket>;
  private lastData: string | null;
  private isPolling: boolean;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sessions = new Set();
    this.lastData = null;
    this.isPolling = false;
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    this.ctx.acceptWebSocket(server);
    this.sessions.add(server);

    // Send existing data immediately
    if (this.lastData) {
      server.send(this.lastData);
    }

    // Start 5-second polling loop if not running
    if (!this.isPolling) {
      this.isPolling = true;
      // Critical: Run in background so we don't block the handshake
      this.ctx.waitUntil(this.scheduleNextFetch());
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(_ws: WebSocket, _message: string) {
    // Handle pings if necessary
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
    this.sessions.delete(ws);
  }

  async scheduleNextFetch() {
    // Stop if no clients
    if (this.sessions.size === 0) {
      this.isPolling = false;
      return;
    }

    try {
      await this.fetchAndBroadcast();
    } catch (err) {
      console.error("Polling error:", err);
    }

    // Wait 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 5000));
    
    // Continue loop
    if (this.isPolling) {
       this.scheduleNextFetch(); 
    }
  }

  async fetchAndBroadcast() {
    const apiUrl = "https://server.smssir.com/api/free-sms.php";
    const headers = {
      "accept": "application/json",
      "accept-language": "en-US,en;q=0.9",
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36"
    };

    try {
      const response = await fetch(apiUrl, { method: "GET", headers });
      const data = await response.text();

      // Only broadcast if data is different
      if (data !== this.lastData) {
        this.lastData = data;
        this.broadcast(data);
      }
    } catch (e) {
      console.error("Error fetching SMS API", e);
    }
  }

  broadcast(message: string) {
    for (const session of this.sessions) {
      try {
        session.send(message);
      } catch (err) {
        this.sessions.delete(session);
      }
    }
  }
}
