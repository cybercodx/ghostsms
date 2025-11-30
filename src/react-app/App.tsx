import { useEffect, useState, useMemo } from "react";
import "./App.css";

// --- Icons (Inline SVGs for performance) ---
const Icons = {
  Phone: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
  ),
  Logo: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
  ),
  Search: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
  ),
  Check: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
  )
};

// --- Types ---
interface SMS {
  ID: string;
  FromNo: string;
  Message: string;
  RecTime: string;
  PhoneNo: string;
}

interface APIResponse {
  status: boolean;
  sms: SMS[];
}

type ConnectionStatus = "Connecting..." | "Live" | "Disconnected" | "Reconnecting";

function App() {
  // State
  const [messages, setMessages] = useState<SMS[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("Connecting...");
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState<{msg: string, visible: boolean}>({ msg: "", visible: false });

  // WebSocket Logic
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    // Fallback for local development if host is empty (unlikely in Vite but good practice)
    const wsUrl = `${protocol}//${host || 'localhost:8787'}/api/ws`;
    
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
            // Ensure unique messages by ID if needed, though simpler to replace for live stream
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

      ws.onerror = (err) => {
        console.error("WebSocket error", err);
        ws.close();
      };
    };

    connect();

    return () => {
      if(ws) ws.close();
      clearTimeout(reconnectTimer);
    };
  }, []);

  // Derived State: Unique Recipient Numbers
  const uniqueNumbers = useMemo(() => {
    // Get unique phone numbers that messages are sent TO
    const numbers = new Set<string>();
    messages.forEach(msg => {
      if(msg.PhoneNo) numbers.add(msg.PhoneNo);
    });
    return Array.from(numbers).slice(0, 3); // Take top 3
  }, [messages]);

  // Derived State: Filtered Messages
  const filteredMessages = useMemo(() => {
    if (!searchTerm) return messages;
    const lowerTerm = searchTerm.toLowerCase();
    return messages.filter(msg => 
      msg.Message.toLowerCase().includes(lowerTerm) || 
      msg.FromNo.toLowerCase().includes(lowerTerm) ||
      msg.PhoneNo.toLowerCase().includes(lowerTerm)
    );
  }, [messages, searchTerm]);

  // Actions
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setToast({ msg: `${label} Copied!`, visible: true });
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
      {/* --- Header --- */}
      <header className="main-header">
        <div className="logo-area">
          <div className="logo-bubble"><Icons.Logo /></div>
          <span className="brand-name">GhostSMS</span>
        </div>
        
        <div className="header-actions">
          <div className="status-badge">
            <span className={`status-dot ${getStatusColor(status)}`}></span>
            {status}
          </div>
        </div>
      </header>

      {/* --- Active Numbers Section --- */}
      <section className="hero-section">
        <h2 className="section-title" style={{marginBottom: '1rem', fontSize: '1.1rem', opacity: 0.8}}>Active Numbers</h2>
        <div className="number-grid">
          {uniqueNumbers.length > 0 ? (
            uniqueNumbers.map((num) => (
              <div 
                key={num} 
                className="number-card"
                onClick={() => handleCopy(num, "Number")}
                title="Click to copy"
              >
                <div className="icon-box"><Icons.Phone /></div>
                <div className="card-info">
                  <span className="card-label">UK Number</span>
                  <span className="phone-number">{num}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="number-card" style={{justifyContent: 'center', color: '#888'}}>
              {status === "Live" ? "Waiting for active numbers..." : "Connecting..."}
            </div>
          )}
        </div>
      </section>

      {/* --- Controls --- */}
      <div className="controls-bar">
         <div className="search-wrapper">
            <span className="search-icon"><Icons.Search /></span>
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search messages, numbers, or senders..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
         </div>
      </div>

      {/* --- Messages Table --- */}
      <section className="messages-section">
        <div className="section-header">
          <h2 className="section-title">Inbox</h2>
          <span className="msg-count">{filteredMessages.length} messages</span>
        </div>
        
        <div className="table-container">
          <div className="table-header">
            <span>From</span>
            <span>To</span>
            <span>Message</span>
            <span style={{textAlign: 'right'}}>Time</span>
          </div>
          
          <div className="table-body">
            {filteredMessages.length > 0 ? (
              filteredMessages.map((msg) => (
                <div 
                  key={msg.ID} 
                  className="message-row"
                  onClick={() => handleCopy(msg.Message, "Message")}
                  title="Click to copy message"
                >
                  <div className="col-from">{msg.FromNo}</div>
                  <div className="col-to">{msg.PhoneNo}</div>
                  <div className="col-msg">{msg.Message}</div>
                  <div className="col-time">{msg.RecTime}</div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                {searchTerm ? "No results found." : "Waiting for messages..."}
              </div>
            )}
          </div>
        </div>
      </section>
      
      {/* --- Toast Notification --- */}
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
