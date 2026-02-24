import { useEffect, useState } from "react";

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

  useEffect(() => {
    if (!guildId) {
      setChannels([]);
      return;
    }
    fetch("/api/data/guilds/" + guildId + "/channels")
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + String(res.status));
        return res.json() as Promise<Channel[]>;
      })
      .then(setChannels)
      .catch((err: unknown) => console.error("[ChannelList]", err));
  }, [guildId]);

  if (!guildId) {
    return <div style={styles.empty}>Select a server</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>Channels</div>
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
        {channels.length === 0 && (
          <li style={styles.emptyItem}>No channels yet</li>
        )}
      </ul>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { width: "220px", background: "#2f3136", display: "flex", flexDirection: "column" },
  header: { padding: "16px 12px 8px", color: "#8e9297", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" },
  list: { listStyle: "none", margin: 0, padding: "0 8px", display: "flex", flexDirection: "column", gap: "2px" },
  channelBtn: { width: "100%", textAlign: "left", background: "none", border: "none", padding: "6px 8px", borderRadius: "4px", color: "#8e9297", cursor: "pointer", fontSize: "0.95rem" },
  channelBtnActive: { background: "#42464d", color: "#dcddde" },
  empty: { width: "220px", background: "#2f3136", display: "flex", alignItems: "center", justifyContent: "center", color: "#8e9297", fontSize: "0.875rem" },
  emptyItem: { color: "#8e9297", fontSize: "0.875rem", padding: "6px 8px" },
};
