import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

export interface Guild {
  guild_id: string;
  name: string;
}

interface Props {
  selectedGuildId: string | null;
  onSelectGuild: (guildId: string) => void;
}

export function GuildSidebar({ selectedGuildId, onSelectGuild }: Props) {
  const { user } = useAuth();
  const [guilds, setGuilds] = useState<Guild[]>([]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/data/guilds/me", {
      headers: { "X-User-ID": user.user_id },
    })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + String(res.status));
        return res.json() as Promise<Guild[]>;
      })
      .then(setGuilds)
      .catch((err: unknown) => console.error("[GuildSidebar]", err));
  }, [user]);

  return (
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
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: { width: "72px", background: "#202225", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "12px", gap: "8px", overflowY: "auto" },
  guildBtn: { width: "48px", height: "48px", borderRadius: "50%", border: "none", background: "#36393f", color: "#dcddde", cursor: "pointer", fontSize: "0.85rem", fontWeight: 700, transition: "border-radius 0.15s" },
  guildBtnActive: { borderRadius: "33%", background: "#5865f2", color: "#fff" },
};
