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

    // Send immediate data if available
    if (this.lastData) {
      server.send(this.lastData);
    }

    // Start polling loop if not already running
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
    // Handle pings or client commands if necessary
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
    this.sessions.delete(ws);
  }

  async scheduleNextFetch() {
    // Stop polling if no clients are connected to save resources
    if (this.sessions.size === 0) {
      this.isPolling = false;
      return;
    }

    try {
      await this.fetchAndBroadcast();
    } catch (err) {
      console.error("Polling error:", err);
    }

    // Poll every 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 5000));
    
    // Recursive call to keep loop going
    if (this.isPolling) {
       this.scheduleNextFetch(); 
    }
  }

  async fetchAndBroadcast() {
    const apiUrl = "https://server.smssir.com/api/free-sms.php";
    const headers = {
      "accept": "application/json",
      "accept-language": "en-US,en;q=0.9",
      "sec-ch-ua": '"Chromium";v="107", "Not=A?Brand";v="24"',
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": '"Android"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "Referer": "https://smssir.com/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36"
    };

    try {
      const response = await fetch(apiUrl, { method: "GET", headers });
      const data = await response.text();

      // Broadcast only if data changed
      if (data !== this.lastData) {
        this.lastData = data;
        this.broadcast(data);
      }
    } catch (e) {
      console.error("Error fetching external SMS API", e);
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
