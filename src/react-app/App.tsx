import { useEffect, useState, useMemo } from "react";
import "./App.css";

// --- Icons ---
const Icons = {
  Phone: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
  ),
  Logo: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
  ),
  Info: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
  ),
  Copy: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
  ),
  Check: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
  ),
  Telegram: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-18.6 7.4a2.25 2.25 0 0 0 .644 4.19l4.8 1.5 1.5 4.8a2.25 2.25 0 0 0 4.19.644l7.4-18.6a2.242 2.242 0 0 0-.215-1.022A2.25 2.25 0 0 0 21.198 2.433Z"/><path d="m10 14 11-11"/></svg>
  )
};

// --- Types ---
interface SMS {
  ID: string;
  FromNo: string;
  Message: string;
  RecTime: string;
  phone_no: string; 
  PhoneNo?: string;
  Route?: string;
  IMSI?: string;
  project?: string;
}

interface APIResponse {
  status: boolean;
  sms: SMS[];
}

type ConnectionStatus = "Connecting..." | "Live" | "Disconnected" | "Reconnecting";

function App() {
  const [messages, setMessages] = useState<SMS[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("Connecting...");
  const [toast, setToast] = useState<{msg: string, visible: boolean}>({ msg: "", visible: false });

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/ws`;
    
    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setStatus("Live");
        clearTimeout(reconnectTimer);
      };
      
      ws.onmessage = (event) => {
        try {
          const data: APIResponse = JSON.parse(event.data);
          if (data.status && Array.isArray(data.sms)) {
            setMessages(data.sms); 
          }
        } catch (e) {
          console.error("Failed to parse SMS data", e);
        }
      };

      ws.onclose = () => {
        setStatus("Disconnected");
        reconnectTimer = setTimeout(() => {
          setStatus("Reconnecting");
          connect();
        }, 3000); 
      };
    };

    connect();
    return () => {
      if(ws) ws.close();
      clearTimeout(reconnectTimer);
    };
  }, []);

  // --- Logic: Get Unique Numbers with Full Info ---
  const uniquePhoneCards = useMemo(() => {
    const map = new Map<string, SMS>();
    messages.forEach(msg => {
      const actualNumber = msg.phone_no || msg.PhoneNo;
      if (actualNumber && actualNumber.length > 5) {
        if (!map.has(actualNumber)) {
          map.set(actualNumber, msg);
        }
      }
    });
    return Array.from(map.values());
  }, [messages]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setToast({ msg: "Copied!", visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2000);
  };

  const getStatusColor = (s: ConnectionStatus) => {
    switch(s) {
      case "Live": return "green";
      case "Disconnected": return "red";
      default: return "orange";
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="main-header">
        <div className="logo-area">
          <div className="logo-bubble"><Icons.Logo /></div>
          <span className="brand-name">GhostSMS</span>
        </div>
        
        <div className="header-actions">
          {/* Telegram Promotion Button */}
          <a 
            href="https://t.me/drkingbd" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="telegram-btn"
            title="Join DrKingBD Telegram Channel"
          >
            <Icons.Telegram />
            <span className="desktop-text">Join Channel</span>
          </a>

          <div className="status-badge">
            <span className={`status-dot ${getStatusColor(status)}`}></span>
            {status}
          </div>
        </div>
      </header>

      {/* Main Content: Unique Numbers with Full Info */}
      <section className="hero-section">
        <h2 className="section-title">Active Numbers ({uniquePhoneCards.length})</h2>
        <p className="section-subtitle">Showing full info for every unique phone number found.</p>

        <div className="number-grid">
          {uniquePhoneCards.length > 0 ? (
            uniquePhoneCards.map((item) => (
              <div key={item.ID} className="number-card full-info-card">
                {/* Header of Card */}
                <div className="card-header">
                   <div className="icon-box"><Icons.Phone /></div>
                   <div className="card-header-text">
                     <span className="card-label">Receiver Number</span>
                     <span 
                       className="phone-number" 
                       onClick={() => handleCopy(item.phone_no || item.PhoneNo || "")}
                       title="Click to copy"
                     >
                       {item.phone_no || item.PhoneNo} 
                       <span className="copy-icon"><Icons.Copy /></span>
                     </span>
                   </div>
                </div>

                {/* Divider */}
                <div className="card-divider"></div>

                {/* Full Details Body */}
                <div className="card-body">
                  <div className="info-row">
                    <span className="label">Latest From:</span>
                    <span className="value highlight">{item.FromNo}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Message:</span>
                    <span className="value message-text" title={item.Message}>{item.Message}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Time:</span>
                    <span className="value">{item.RecTime}</span>
                  </div>
                  
                  {/* Extra Technical Info */}
                  <div className="tech-info">
                    {item.IMSI && <span className="tech-badge">IMSI: {item.IMSI}</span>}
                    {item.Route && <span className="tech-badge">Route: {item.Route}</span>}
                    {item.project && <span className="tech-badge">Prj: {item.project}</span>}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              {status === "Live" ? "Waiting for data stream..." : "Connecting to server..."}
            </div>
          )}
        </div>
      </section>

      {/* Toast */}
      {toast.visible && (
        <div className="toast-container">
          <div className="toast">
            <Icons.Check />
            <span>{toast.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
