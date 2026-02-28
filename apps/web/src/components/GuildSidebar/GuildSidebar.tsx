import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";

export interface Guild {
  guild_id: string;
  name: string;
}

interface Props {
  selectedGuildId: string | null;
  onSelectGuild: (guildId: string) => void;
}

type PanelMode = "none" | "create" | "browse";

export function GuildSidebar({ selectedGuildId, onSelectGuild }: Props) {
  const { user } = useAuth();
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [panel, setPanel] = useState<PanelMode>("none");
  const [allGuilds, setAllGuilds] = useState<Guild[]>([]);
  const [newGuildName, setNewGuildName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchMyGuilds = () => {
    if (!user) return;
    fetch("/api/data/guilds/me", { headers: { "X-User-ID": user.user_id } })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + String(res.status));
        return res.json() as Promise<Guild[]>;
      })
      .then(setGuilds)
      .catch((err: unknown) => console.error("[GuildSidebar]", err));
  };

  useEffect(() => { fetchMyGuilds(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setError(null);
    setNewGuildName("");
    setPanel("create");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const openBrowse = () => {
    setError(null);
    setPanel("browse");
    fetch("/api/data/guilds")
      .then((res) => res.json() as Promise<Guild[]>)
      .then(setAllGuilds)
      .catch((err: unknown) => console.error("[GuildBrowser]", err));
  };

  const closePanel = () => setPanel("none");

  const handleCreate = async () => {
    if (!user || !newGuildName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/data/guilds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGuildName.trim(), creator_user_id: user.user_id }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to create guild");
      }
      const guild = (await res.json()) as Guild;
      setGuilds((prev) => [...prev, guild]);
      closePanel();
      onSelectGuild(guild.guild_id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (guildId: string) => {
    if (!user) return;
    setError(null);
    try {
      const res = await fetch("/api/data/guilds/" + guildId + "/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.user_id }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to join guild");
      }
      fetchMyGuilds();
      closePanel();
      onSelectGuild(guildId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const myGuildIds = new Set(guilds.map((g) => g.guild_id));

  return (
    <div style={{ position: "relative", display: "flex" }}>
      <div style={styles.sidebar}>
        {guilds.map((g) => (
          <button
            key={g.guild_id}
            onClick={() => onSelectGuild(g.guild_id)}
            style={{
              ...styles.guildBtn,
              ...(selectedGuildId === g.guild_id ? styles.guildBtnActive : {}),
            }}
            title={g.name}
          >
            {g.name.slice(0, 2).toUpperCase()}
          </button>
        ))}
        <div style={styles.divider} />
        <button style={styles.addBtn} onClick={openCreate} title="Create a server">+</button>
        <button style={styles.addBtn} onClick={openBrowse} title="Browse servers">&#128269;</button>
      </div>

      {panel !== "none" && (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <span>{panel === "create" ? "Create Server" : "Browse Servers"}</span>
            <button style={styles.closeBtn} onClick={closePanel}>&#x2715;</button>
          </div>
          {error && <div style={styles.errorMsg}>{error}</div>}

          {panel === "create" && (
            <>
              <input
                ref={inputRef}
                style={styles.input}
                placeholder="Server name"
                value={newGuildName}
                onChange={(e) => setNewGuildName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
                maxLength={64}
              />
              <button
                style={{ ...styles.actionBtn, opacity: creating ? 0.6 : 1 }}
                onClick={() => void handleCreate()}
                disabled={creating || !newGuildName.trim()}
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </>
          )}

          {panel === "browse" && (
            <ul style={styles.browseList}>
              {allGuilds.length === 0 && <li style={styles.emptyItem}>No servers found</li>}
              {allGuilds.map((g) => (
                <li key={g.guild_id} style={styles.browseItem}>
                  <span style={styles.browseGuildName}>{g.name}</span>
                  {myGuildIds.has(g.guild_id) ? (
                    <span style={styles.joinedBadge}>Joined</span>
                  ) : (
                    <button style={styles.joinBtn} onClick={() => void handleJoin(g.guild_id)}>Join</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: { width: "72px", background: "#202225", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "12px", gap: "8px", overflowY: "auto" },
  guildBtn: { width: "48px", height: "48px", borderRadius: "50%", border: "none", background: "#36393f", color: "#dcddde", cursor: "pointer", fontSize: "0.85rem", fontWeight: 700, transition: "border-radius 0.15s" },
  guildBtnActive: { borderRadius: "33%", background: "#5865f2", color: "#fff" },
  divider: { width: "32px", height: "2px", background: "#36393f", borderRadius: "1px", margin: "4px 0" },
  addBtn: { width: "48px", height: "48px", borderRadius: "50%", border: "none", background: "#36393f", color: "#3ba55d", cursor: "pointer", fontSize: "1.5rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" },
  panel: { position: "absolute", left: "72px", top: 0, width: "260px", background: "#2f3136", boxShadow: "4px 0 12px rgba(0,0,0,0.4)", zIndex: 10, display: "flex", flexDirection: "column", padding: "16px", gap: "10px", minHeight: "200px" },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff", fontWeight: 700, fontSize: "1rem" },
  closeBtn: { background: "none", border: "none", color: "#8e9297", cursor: "pointer", fontSize: "1rem" },
  errorMsg: { color: "#ed4245", fontSize: "0.85rem" },
  input: { padding: "8px 10px", borderRadius: "4px", border: "none", background: "#40444b", color: "#dcddde", fontSize: "0.95rem", outline: "none" },
  actionBtn: { padding: "8px 16px", borderRadius: "4px", border: "none", background: "#5865f2", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.95rem" },
  browseList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto", maxHeight: "400px" },
  browseItem: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px", borderRadius: "4px", background: "#40444b" },
  browseGuildName: { color: "#dcddde", fontSize: "0.9rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" },
  joinedBadge: { color: "#3ba55d", fontSize: "0.8rem", fontWeight: 600 },
  joinBtn: { padding: "4px 10px", borderRadius: "4px", border: "none", background: "#5865f2", color: "#fff", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 },
  emptyItem: { color: "#8e9297", fontSize: "0.875rem", padding: "6px 8px" },
};
