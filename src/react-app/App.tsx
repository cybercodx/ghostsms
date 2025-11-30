import { useEffect, useState } from "react";
import "./App.css";

// Icons
const PhoneIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
);

const LogoIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="logo-icon"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
);

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

function App() {
  const [messages, setMessages] = useState<SMS[]>([]);
  const [uniqueNumbers, setUniqueNumbers] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("Connecting...");

  useEffect(() => {
    // Determine WebSocket protocol based on current window protocol
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    
    let ws: WebSocket;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => setStatus("Live");
      
      ws.onmessage = (event) => {
        try {
          const data: APIResponse = JSON.parse(event.data);
          if (data.status && data.sms) {
            setMessages(data.sms);
            
            // Extract unique phone numbers for the top cards
            const numbers = Array.from(new Set(data.sms.map(s => s.PhoneNo).filter(n => n)));
            setUniqueNumbers(numbers.slice(0, 4)); // Show top 4
          }
        } catch (e) {
          console.error("Failed to parse SMS data");
        }
      };

      ws.onclose = () => {
        setStatus("Disconnected");
        // Reconnect after 3 seconds
        setTimeout(connect, 3000); 
      };
    };

    connect();

    return () => {
      if(ws) ws.close();
    };
  }, []);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="main-header">
        <div className="logo-area">
          <div className="logo-bubble"><LogoIcon /></div>
          <span className="brand-name">sms<span className="brand-highlight">Sir</span>.com</span>
        </div>
        <div className="header-actions">
          <div className="status-badge">
            <span className={`status-dot ${status === "Live" ? "green" : "red"}`}></span>
            {status}
          </div>
          <button className="btn btn-primary">Sign In</button>
          <button className="btn btn-outline">Sign Up</button>
        </div>
      </header>

      {/* Hero Section / Numbers */}
      <section className="hero-section">
        <div className="hero-text">
            <p>Numbers are shown in UK national format</p>
            <p className="sub-text">For International format replace the first 0 with 44</p>
        </div>

        <div className="number-cards">
          {uniqueNumbers.map((num, idx) => (
            <div key={idx} className="number-card fade-in">
              <div className="icon-circle">
                <PhoneIcon />
              </div>
              <span className="phone-number">{num}</span>
              <span className="card-date">Active Now</span>
            </div>
          ))}
          {uniqueNumbers.length === 0 && <div className="loading-state">Loading numbers...</div>}
        </div>
      </section>

      {/* Messages Table */}
      <section className="messages-section">
        <h2 className="section-title">Latest Messages</h2>
        <p className="section-subtitle">(new messages will appear instantly)</p>
        
        <div className="table-container fade-in-up">
          <div className="table-header">
            <span>From</span>
            <span>To</span>
            <span>Message</span>
            <span className="text-right">Time</span>
          </div>
          
          <div className="table-body">
            {messages.map((msg) => (
              <div key={msg.ID} className="table-row">
                <div className="col-from">
                  <span className={`badge ${msg.FromNo.includes('USSD') ? 'badge-ussd' : 'badge-service'}`}>
                    {msg.FromNo}
                  </span>
                </div>
                <div className="col-to">{msg.PhoneNo || "Unknown"}</div>
                <div className="col-msg" title={msg.Message}>{msg.Message}</div>
                <div className="col-time text-right">{msg.RecTime}</div>
              </div>
            ))}
            {messages.length === 0 && <div className="empty-row">Waiting for messages...</div>}
          </div>
        </div>
      </section>
      
      <div className="floating-action">
        <div className="fab">
            <LogoIcon />
        </div>
      </div>
    </div>
  );
}

export default App;
