import { DurableObject } from "cloudflare:workers";

interface Env {
  SMS_DO: DurableObjectNamespace;
}

export class SMSWebSocket extends DurableObject {
  private sessions: Set<WebSocket>;
  private lastData: string | null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sessions = new Set();
    this.lastData = null;

    // Start the polling loop when the DO starts
    this.ctx.blockConcurrencyWhile(async () => {
      this.scheduleNextFetch();
    });
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

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  // Prefix unused parameters with _ to satisfy TypeScript
  async webSocketMessage(_ws: WebSocket, _message: string) {
    // Handle pings or client commands if necessary
    // For now, we just keep the connection alive
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
    this.sessions.delete(ws);
  }

  async scheduleNextFetch() {
    try {
      await this.fetchAndBroadcast();
    } catch (err) {
      console.error("Polling error:", err);
    }
    // Poll every 10 seconds
    await new Promise((resolve) => setTimeout(resolve, 10000));
    this.scheduleNextFetch();
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

      // Broadcast only if data changed or to keep pulse alive
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
