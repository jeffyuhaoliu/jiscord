import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { GuildSidebar } from "../components/GuildSidebar";
import { ChannelList } from "../components/ChannelList";
import { MessageList } from "../components/MessageList";
import { MessageInput } from "../components/MessageInput";
import { useGateway } from "../hooks/useGateway";

const GATEWAY_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

export function ChannelsPage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  const { on, send } = useGateway(GATEWAY_URL, token);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div style={styles.app}>
      <GuildSidebar
        selectedGuildId={selectedGuildId}
        onSelectGuild={(id) => {
          setSelectedGuildId(id);
          setSelectedChannelId(null);
        }}
      />
      <ChannelList
        guildId={selectedGuildId}
        selectedChannelId={selectedChannelId}
        onSelectChannel={setSelectedChannelId}
      />
      <div style={styles.main}>
        <header style={styles.header}>
          <span style={styles.channelName}>
            {selectedChannelId ? `#${selectedChannelId}` : "Select a channel"}
          </span>
          <div style={styles.headerRight}>
            <span style={styles.username}>{user?.username}</span>
            <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
          </div>
        </header>
        <MessageList channelId={selectedChannelId} on={on} />
        <MessageInput channelId={selectedChannelId} send={send} on={on} />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: { display: "flex", height: "100vh", background: "#36393f", color: "#dcddde" },
  main: { display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: "48px", background: "#36393f", borderBottom: "1px solid #202225", flexShrink: 0 },
  channelName: { fontWeight: 700, color: "#fff" },
  headerRight: { display: "flex", alignItems: "center", gap: "12px" },
  username: { color: "#b9bbbe", fontSize: "0.875rem" },
  logoutBtn: { background: "none", border: "1px solid #4f545c", color: "#b9bbbe", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "0.875rem" },
};
