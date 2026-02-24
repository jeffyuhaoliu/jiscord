import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ChannelsPage } from "./pages/ChannelsPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/channels/*"
        element={
          <RequireAuth>
            <ChannelsPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/channels" replace />} />
    </Routes>
  );
}
