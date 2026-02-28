import { useEffect, useRef, useState } from "react";

export interface Channel {
  channel_id: string;
  guild_id: string;
  name: string;
}

interface Props {
  guildId: string | null;
  selectedChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
}

export function ChannelList({ guildId, selectedChannelId, onSelectChannel }: Props) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchChannels = () => {
    if (!guildId) { setChannels([]); return; }
    fetch("/api/data/guilds/" + guildId + "/channels")
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + String(res.status));
        return res.json() as Promise<Channel[]>;
      })
      .then(setChannels)
      .catch((err: unknown) => console.error("[ChannelList]", err));
  };

  useEffect(() => { fetchChannels(); }, [guildId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setNewName("");
    setError(null);
    setShowInput(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleCreate = async () => {
    if (!guildId || !newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/data/guilds/" + guildId + "/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to create channel");
      }
      const ch = (await res.json()) as Channel;
      setChannels((prev) => [...prev, ch]);
      setShowInput(false);
      onSelectChannel(ch.channel_id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  };

  if (!guildId) {
    return <div style={styles.empty}>Select a server</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>Channels</span>
        <button style={styles.addBtn} onClick={openCreate} title="Create channel">+</button>
      </div>
      {error && <div style={styles.errorMsg}>{error}</div>}
      {showInput && (
        <div style={styles.inputRow}>
          <input
            ref={inputRef}
            style={styles.input}
            placeholder="channel-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
              if (e.key === "Escape") setShowInput(false);
            }}
            maxLength={64}
          />
          <button
            style={{ ...styles.confirmBtn, opacity: creating ? 0.6 : 1 }}
            onClick={() => void handleCreate()}
            disabled={creating || !newName.trim()}
          >
            {creating ? "..." : "Add"}
          </button>
        </div>
      )}
      <ul style={styles.list}>
        {channels.map((ch) => (
          <li key={ch.channel_id}>
            <button
              onClick={() => onSelectChannel(ch.channel_id)}
              style={{
                ...styles.channelBtn,
                ...(selectedChannelId === ch.channel_id ? styles.channelBtnActive : {}),
              }}
            >
              # {ch.name}
            </button>
          </li>
        ))}
        {channels.length === 0 && !showInput && (
          <li style={styles.emptyItem}>No channels yet</li>
        )}
      </ul>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { width: "220px", background: "#2f3136", display: "flex", flexDirection: "column" },
  header: { padding: "16px 12px 8px", color: "#8e9297", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", justifyContent: "space-between", alignItems: "center" },
  addBtn: { background: "none", border: "none", color: "#8e9297", cursor: "pointer", fontSize: "1.2rem", lineHeight: 1, padding: "0 4px" },
  list: { listStyle: "none", margin: 0, padding: "0 8px", display: "flex", flexDirection: "column", gap: "2px" },
  channelBtn: { width: "100%", textAlign: "left", background: "none", border: "none", padding: "6px 8px", borderRadius: "4px", color: "#8e9297", cursor: "pointer", fontSize: "0.95rem" },
  channelBtnActive: { background: "#42464d", color: "#dcddde" },
  empty: { width: "220px", background: "#2f3136", display: "flex", alignItems: "center", justifyContent: "center", color: "#8e9297", fontSize: "0.875rem" },
  emptyItem: { color: "#8e9297", fontSize: "0.875rem", padding: "6px 8px" },
  errorMsg: { color: "#ed4245", fontSize: "0.8rem", padding: "0 12px" },
  inputRow: { display: "flex", gap: "4px", padding: "4px 8px" },
  input: { flex: 1, padding: "5px 8px", borderRadius: "4px", border: "none", background: "#40444b", color: "#dcddde", fontSize: "0.875rem", outline: "none" },
  confirmBtn: { padding: "5px 10px", borderRadius: "4px", border: "none", background: "#5865f2", color: "#fff", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 },
};
