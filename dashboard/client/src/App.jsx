import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useTranslation } from "react-i18next";

import Login           from "./pages/Login";
import Chat            from "./pages/Chat";
import LLMManager      from "./pages/LLMManager";
import DocumentsManager from "./pages/DocumentsManager";
import KnowledgeBase   from "./pages/KnowledgeBase";
import BridgeManager   from "./pages/BridgeManager";
import TerminalPage    from "./pages/TerminalPage";
import Header          from "./components/Header";
import Sidebar         from "./components/Sidebar";

import { Activity, Settings } from "lucide-react";

// Routes that get zero padding (full-bleed layout)
const FULL_BLEED_ROUTES = ["/"];

function Layout({ token, user, appConfig, onLogout }) {
  const [collapsed,    setCollapsed]    = useState(false);
  const location = useLocation();
  const isSuperAdmin = user?.role === "Super Admin";
  const isFullBleed  = FULL_BLEED_ROUTES.includes(location.pathname);

  if (!token) return null;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header
        user={user}
        appConfig={appConfig}
        onLogout={onLogout}
        onToggleSidebar={() => setCollapsed(p => !p)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar isSuperAdmin={isSuperAdmin} collapsed={collapsed} />

        <main className={`flex-1 overflow-hidden flex flex-col ${isFullBleed ? "" : "p-4 md:p-6"}`}>
          <Routes>
            <Route path="/"            element={<Chat token={token} user={user} arabicModel={appConfig.arabicModel} englishModel={appConfig.englishModel} />} />
            <Route path="/documents"   element={<DocumentsManager token={token} />} />
            <Route path="/knowledge"   element={<KnowledgeBase token={token} />} />
            <Route path="/channels"    element={<BridgeManager token={token} user={user} />} />
            <Route path="/llm-manager" element={
              isSuperAdmin || user?.role === "Admin"
                ? <LLMManager token={token} />
                : <Navigate to="/" replace />
            } />
            <Route path="/terminal"    element={
              isSuperAdmin ? <TerminalPage /> : <Navigate to="/" replace />
            } />
            <Route path="/monitor"     element={
              <div className="glass rounded-xl p-8 h-full flex flex-col items-center justify-center text-slate-400">
                <Activity size={48} className="mb-4 text-slate-600" />
                <h2 className="text-xl font-bold text-slate-200">System Monitoring</h2>
                <p>Coming in Phase 4</p>
              </div>
            } />
            <Route path="/settings"    element={
              <div className="glass rounded-xl p-8 h-full flex flex-col items-center justify-center text-slate-400">
                <Settings size={48} className="mb-4 text-slate-600" />
                <h2 className="text-xl font-bold text-slate-200">Platform Settings</h2>
                <p>Coming in Phase 5</p>
              </div>
            } />
            <Route path="*"            element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  const { i18n } = useTranslation();
  const [token,     setToken]     = useState(localStorage.getItem("token"));
  const [user,      setUser]      = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  });
  const [appConfig, setAppConfig] = useState({
    systemName:   "AI Customer Service",
    companyName:  "",
    tagline:      "Powered by local AI",
    arabicModel:  "qwen2.5:72b",
    englishModel: "llama3.3:70b",
  });

  useEffect(() => {
    fetch("/api/config/public")
      .then(r => r.json())
      .then(data => setAppConfig(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    document.title = appConfig.systemName;
    document.body.dir = i18n.language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = i18n.language;
  }, [i18n.language, appConfig.systemName]);

  const handleLogin = (data) => {
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={
          !token ? <Login onLogin={handleLogin} /> : <Navigate to="/" replace />
        } />
        <Route path="/*" element={
          token
            ? <Layout
                token={token}
                user={user}
                appConfig={appConfig}
                onLogout={handleLogout}
              />
            : <Navigate to="/login" replace />
        } />
      </Routes>
    </Router>
  );
}

export default App;
