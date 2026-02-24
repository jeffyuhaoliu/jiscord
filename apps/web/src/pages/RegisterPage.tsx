import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Registration failed");
      }
      // Auto-login after successful registration
      await login(email, password);
      navigate("/channels");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Create an account</h1>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Username
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={2}
              maxLength={32}
              style={styles.input}
              autoComplete="username"
            />
          </label>
          <label style={styles.label}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={styles.input}
              autoComplete="email"
            />
          </label>
          <label style={styles.label}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              style={styles.input}
              autoComplete="new-password"
            />
          </label>
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Creating account\u2026" : "Register"}
          </button>
        </form>
        <p style={styles.switchLink}>
          Already have an account? <Link to="/login">Sign In</Link>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#36393f" },
  card: { background: "#2f3136", padding: "32px", borderRadius: "8px", width: "400px", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" },
  title: { margin: "0 0 24px", color: "#fff", fontSize: "1.5rem", textAlign: "center" },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  label: { display: "flex", flexDirection: "column", gap: "4px", color: "#b9bbbe", fontSize: "0.85rem", fontWeight: 600 },
  input: { padding: "10px", borderRadius: "4px", border: "none", background: "#202225", color: "#dcddde", fontSize: "1rem" },
  error: { color: "#f04747", margin: 0, fontSize: "0.875rem" },
  button: { padding: "12px", background: "#5865f2", color: "#fff", border: "none", borderRadius: "4px", fontSize: "1rem", cursor: "pointer", fontWeight: 600 },
  switchLink: { marginTop: "16px", textAlign: "center", color: "#b9bbbe", fontSize: "0.875rem" },
};
