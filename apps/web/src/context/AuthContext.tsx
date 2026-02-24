import { createContext, useCallback, useContext, useRef, useState } from "react";

export interface AuthUser {
  user_id: string;
  username: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // JWT stored in memory only — no localStorage (XSS risk)
  const tokenRef = useRef<string | null>(null);
  const [state, setState] = useState<AuthState>({ user: null, token: null });

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      throw new Error(body.error ?? "Login failed");
    }
    const body = (await res.json()) as { token: string; user: AuthUser };
    tokenRef.current = body.token;
    setState({ user: body.user, token: body.token });
  }, []);

  const logout = useCallback(() => {
    tokenRef.current = null;
    setState({ user: null, token: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
