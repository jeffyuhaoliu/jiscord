import { useState } from "react";
import { useGateway } from "./hooks/useGateway";
import { MessageList } from "./components/MessageList";

const GATEWAY_URL = "/ws";
const TOKEN = localStorage.getItem("token") ?? "";
const DEMO_CHANNEL_ID = "demo-channel";

export function App() {
  const [activeChannelId] = useState(DEMO_CHANNEL_ID);
  const { on, send } = useGateway(GATEWAY_URL, TOKEN || null);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header style={{ padding: "8px 16px", borderBottom: "1px solid #ccc" }}>
        <strong>Jiscord</strong> — #{activeChannelId}
      </header>
      <MessageList channelId={activeChannelId} on={on} />
      <div style={{ padding: "8px" }}>
        <input
          style={{ width: "100%", boxSizing: "border-box", padding: "8px" }}
          placeholder="Message input coming soon…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.currentTarget.value.trim()) {
              send("SEND_MESSAGE", {
                channelId: activeChannelId,
                content: e.currentTarget.value.trim(),
              });
              e.currentTarget.value = "";
            }
          }}
        />
      </div>
    </div>
  );
}
