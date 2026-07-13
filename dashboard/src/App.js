import { useState, useEffect } from "react";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const NODE1_URL = "http://localhost:3001";
const NODE2_URL = "http://localhost:3003";
const QUEUE_URL = "http://localhost:3002";

function StatCard({ label, value, color = "#534AB7" }) {
  return (
    <div style={{ background: "white", borderRadius: 12, padding: "20px 24px", boxShadow: "0 2px 8px rgba(83,74,183,0.08)" }}>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color }}>{value ?? "..."}</div>
    </div>
  );
}

function NodeCard({ title, stats, color, onDelete }) {
  return (
    <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(83,74,183,0.08)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
        <h3 style={{ margin: 0, color: "#1a1a1a", fontSize: 15 }}>{title}</h3>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#888" }}>
          {stats ? `${stats.size}/${stats.capacity} keys` : "..."}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, background: "#f5f3ff", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#888" }}>Hit Rate</div>
          <div style={{ fontSize: 18, fontWeight: 700, color }}>{stats?.hitRate ?? "0%"}</div>
        </div>
        <div style={{ flex: 1, background: "#f0fdf4", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#888" }}>Hits</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1D9E75" }}>{stats?.hits ?? 0}</div>
        </div>
        <div style={{ flex: 1, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#888" }}>Misses</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#ef4444" }}>{stats?.misses ?? 0}</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Cached Keys</div>
      {stats?.keys?.length > 0 ? stats.keys.map((k, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "#f5f3ff", borderRadius: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 13, color, fontWeight: 500 }}>{k}</span>
          {onDelete && (
            <button onClick={() => onDelete(k)} style={{ background: "#ef4444", color: "white", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>
              Delete
            </button>
          )}
        </div>
      )) : <p style={{ color: "#aaa", fontSize: 12, margin: 0 }}>No keys cached</p>}
    </div>
  );
}

export default function App() {
  const [node1Stats, setNode1Stats] = useState(null);
  const [node2Stats, setNode2Stats] = useState(null);
  const [queueStats, setQueueStats] = useState(null);
  const [hitHistory, setHitHistory] = useState([]);
  const [events, setEvents] = useState([]);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [ttl, setTtl] = useState("");
  const [getKey, setGetKey] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [n1, n2, q] = await Promise.all([
          axios.get(`${NODE1_URL}/stats`).catch(() => null),
          axios.get(`${NODE2_URL}/stats`).catch(() => null),
          axios.get(`${QUEUE_URL}/stats`).catch(() => null),
        ]);
        if (n1) setNode1Stats(n1.data);
        if (n2) setNode2Stats(n2.data);
        if (q) setQueueStats(q.data);
        if (n1) {
          setHitHistory(prev => [...prev.slice(-20), {
            time: new Date().toLocaleTimeString(),
            "Node 1 Hits": n1.data.hits,
            "Node 1 Misses": n1.data.misses,
            "Node 2 Hits": n2?.data?.hits ?? 0,
          }]);
        }
      } catch (e) {}
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSet = async () => {
    if (!key || !value) return;
    try {
      await axios.post(`${NODE1_URL}/cache`, { key, value, ttl: ttl ? parseInt(ttl) : null });
      setResult({ type: "success", message: `✅ Set "${key}" = "${value}" on Node 1` });
      setKey(""); setValue(""); setTtl("");
    } catch (e) {
      setResult({ type: "error", message: "❌ Failed to set key" });
    }
  };

  const handleGet = async () => {
    if (!getKey) return;
    try {
      const res = await axios.get(`${NODE1_URL}/cache/${getKey}`);
      setResult({ type: "success", message: `✅ Node 1 Hit! "${getKey}" = "${res.data.value}"` });
    } catch (e) {
      setResult({ type: "error", message: `❌ Miss on Node 1 — "${getKey}" not found` });
    }
  };

  const handleDelete = async (k, nodeUrl, nodeName) => {
    try {
      await axios.delete(`${nodeUrl}/cache/${k}`);
      const res = await axios.get(`${QUEUE_URL}/consume/cache:invalidate/dashboard-${Date.now()}`);
      const newEvents = res.data.messages.map(msg => ({
        ...msg,
        displayTime: new Date().toLocaleTimeString()
      }));
      setEvents(prev => [...newEvents, ...prev].slice(0, 10));
      setResult({ type: "success", message: `🗑️ Deleted "${k}" from ${nodeName} — invalidation sent to queue!` });
    } catch (e) {
      setResult({ type: "error", message: "❌ Failed to delete" });
    }
  };

  const handleFlush = async () => {
    await Promise.all([
      axios.delete(`${NODE1_URL}/cache`).catch(() => {}),
      axios.delete(`${NODE2_URL}/cache`).catch(() => {}),
    ]);
    setResult({ type: "success", message: "🔥 Both nodes flushed!" });
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#F5F3FF", minHeight: "100vh", padding: "24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* header */}
        <div style={{ background: "linear-gradient(135deg, #534AB7, #7C3AED)", borderRadius: 16, padding: "28px 32px", marginBottom: 24, color: "white" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 36 }}>⚡</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>CacheFlow</h1>
              <p style={{ margin: "4px 0 0", opacity: 0.8, fontSize: 14 }}>Distributed In-Memory Cache with Event-Driven Invalidation</p>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
              <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 14px", fontSize: 12 }}>
                🟢 Node 1 :3001
              </div>
              <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 14px", fontSize: 12 }}>
                🟣 Node 2 :3003
              </div>
              <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 14px", fontSize: 12 }}>
                📨 Queue :3002
              </div>
            </div>
          </div>
        </div>

        {/* how it works banner */}
        <div style={{ background: "white", borderRadius: 12, padding: "16px 24px", marginBottom: 24, boxShadow: "0 2px 8px rgba(83,74,183,0.06)", display: "flex", gap: 0, alignItems: "center", justifyContent: "center" }}>
          {[
            { icon: "1️⃣", text: "Client requests data" },
            { icon: "→", text: "" },
            { icon: "⚡", text: "Cache node checks memory" },
            { icon: "→", text: "" },
            { icon: "✅", text: "HIT: return instantly" },
            { icon: "❌", text: "MISS: fetch from DB" },
            { icon: "→", text: "" },
            { icon: "📨", text: "On delete: publish to queue" },
            { icon: "→", text: "" },
            { icon: "🔄", text: "Other nodes auto-invalidate" },
          ].map((step, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 8px", fontSize: step.icon === "→" ? 18 : 13, color: step.icon === "→" ? "#ccc" : "#534AB7", fontWeight: step.icon === "→" ? 300 : 500 }}>
              <span>{step.icon}</span>
              {step.text && <span style={{ color: "#666" }}>{step.text}</span>}
            </div>
          ))}
        </div>

        {/* top stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          <StatCard label="Node 1 Cache Size" value={node1Stats ? `${node1Stats.size}/${node1Stats.capacity}` : "..."} color="#534AB7" />
          <StatCard label="Node 1 Hit Rate" value={node1Stats?.hitRate ?? "0%"} color="#534AB7" />
          <StatCard label="Node 2 Cache Size" value={node2Stats ? `${node2Stats.size}/${node2Stats.capacity}` : "..."} color="#7C3AED" />
          <StatCard label="Queue Messages" value={queueStats ? Object.values(queueStats.topics).reduce((a, t) => a + t.messageCount, 0) : "..."} color="#1D9E75" />
        </div>

        {/* controls */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
          <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(83,74,183,0.08)" }}>
            <h3 style={{ margin: "0 0 16px", color: "#1a1a1a" }}>Set Key (Node 1)</h3>
            <input placeholder="Key" value={key} onChange={e => setKey(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #e0deff", marginBottom: 8, boxSizing: "border-box", fontSize: 13 }} />
            <input placeholder="Value" value={value} onChange={e => setValue(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #e0deff", marginBottom: 8, boxSizing: "border-box", fontSize: 13 }} />
            <input placeholder="TTL in seconds (optional)" value={ttl} onChange={e => setTtl(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #e0deff", marginBottom: 12, boxSizing: "border-box", fontSize: 13 }} />
            <button onClick={handleSet}
              style={{ background: "#534AB7", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", width: "100%", fontSize: 14 }}>
              Set Key
            </button>
          </div>

          <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(83,74,183,0.08)" }}>
            <h3 style={{ margin: "0 0 16px", color: "#1a1a1a" }}>Get Key (Node 1)</h3>
            <input placeholder="Key to lookup" value={getKey} onChange={e => setGetKey(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #e0deff", marginBottom: 12, boxSizing: "border-box", fontSize: 13 }} />
            <button onClick={handleGet}
              style={{ background: "#1D9E75", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", width: "100%", marginBottom: 8, fontSize: 14 }}>
              Get Key
            </button>
            <button onClick={handleFlush}
              style={{ background: "#ef4444", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", width: "100%", fontSize: 14 }}>
              Flush Both Nodes
            </button>
            {result && (
              <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: result.type === "success" ? "#f0fdf4" : "#fef2f2", color: result.type === "success" ? "#166534" : "#991b1b", fontSize: 13 }}>
                {result.message}
              </div>
            )}
          </div>
        </div>

        {/* nodes side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
          <NodeCard title="Cache Node 1 (port 3001)" stats={node1Stats} color="#534AB7"
            onDelete={(k) => handleDelete(k, NODE1_URL, "Node 1")} />
          <NodeCard title="Cache Node 2 (port 3003)" stats={node2Stats} color="#7C3AED"
            onDelete={(k) => handleDelete(k, NODE2_URL, "Node 2")} />
        </div>

        {/* chart + events */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
          <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(83,74,183,0.08)" }}>
            <h3 style={{ margin: "0 0 16px", color: "#1a1a1a" }}>Hit / Miss History (Both Nodes)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={hitHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Node 1 Hits" stroke="#534AB7" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Node 1 Misses" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Node 2 Hits" stroke="#7C3AED" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(83,74,183,0.08)" }}>
            <h3 style={{ margin: "0 0 16px", color: "#1a1a1a" }}>Invalidation Events</h3>
            <p style={{ fontSize: 11, color: "#aaa", margin: "0 0 12px" }}>When a key is deleted, the queue notifies all nodes to invalidate it</p>
            {events.length > 0 ? events.map((msg, i) => (
              <div key={i} style={{ padding: "8px 12px", background: "#fef9ee", borderRadius: 8, marginBottom: 8, fontSize: 12, borderLeft: "3px solid #f59e0b" }}>
                <div style={{ fontWeight: 600, color: "#92400e" }}>🗑️ {msg.payload?.key} — {msg.payload?.action}</div>
                <div style={{ color: "#aaa", marginTop: 2 }}>{msg.displayTime}</div>
              </div>
            )) : (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <p style={{ color: "#aaa", fontSize: 12, margin: 0 }}>Delete a key to see invalidation events</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}