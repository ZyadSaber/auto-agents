import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  NavLink,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import Login from "./pages/Login";
import Chat from "./pages/Chat";
import LLMManager from "./pages/LLMManager";
import DocumentsManager from "./pages/DocumentsManager";
import KnowledgeBase from "./pages/KnowledgeBase";
import BridgeManager from "./pages/BridgeManager";
import TerminalPage from "./pages/TerminalPage";
import {
  LogOut, Globe, MessageSquare, Files, BookOpen,
  Smartphone, Cpu, Activity, Settings, Menu, TerminalSquare,
} from "lucide-react";

const NAV_LINK_CLASS = ({ isActive }) =>
  `flex items-center space-x-3 rtl:space-x-reverse px-3 py-3 rounded-xl transition-all ${
    isActive
      ? "bg-brand-500/20 text-brand-400 border border-brand-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
  }`;

function App() {
  const { t, i18n } = useTranslation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")));
  const [appConfig, setAppConfig] = useState({
    systemName: "AI Customer Service",
    companyName: "",
    tagline: "Powered by local AI",
  });

  // Load branding config from server (changes per self-hosted customer)
  useEffect(() => {
    fetch("/api/config/public")
      .then((r) => r.json())
      .then((data) => setAppConfig(data))
      .catch(() => {}); // silently keep defaults
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

  const isSuperAdmin = user?.role === "Super Admin";

  return (
    <Router>
      <div className="flex flex-col h-screen overflow-hidden">
        {token && (
          <nav className="glass shrink-0 z-50 px-6 py-3 flex items-center justify-between animate-[fadeIn_0.5s_ease-out]">
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-1.5 mr-1 rtl:mr-0 rtl:ml-1 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-brand-500/30 rounded-lg transition-colors"
                title="Toggle Sidebar"
              >
                <Menu size={20} />
              </button>
              <div className="w-8 h-8 rounded-lg bg-linear-to-br from-brand-500 to-violet-600 shadow-lg shadow-brand-500/50 flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {appConfig.systemName?.charAt(0) ?? "A"}
                </span>
              </div>
              <div className="hidden md:block">
                <span className="font-semibold text-lg tracking-wide text-white">
                  {appConfig.systemName}
                </span>
                {appConfig.companyName && (
                  <span className="ml-2 text-xs text-slate-500">
                    — {appConfig.companyName}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-4 rtl:space-x-reverse">
              <div className="hidden md:flex flex-col items-end rtl:items-start mr-4 rtl:mr-0 rtl:ml-4">
                <span className="text-sm font-medium text-slate-200">{user?.name}</span>
                <span className="text-xs text-brand-400 font-medium px-2 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20">
                  {user?.role}
                </span>
              </div>

              <div className="relative group flex items-center">
                <Globe size={18} className="text-slate-400 absolute left-3 rtl:left-auto rtl:right-3 pointer-events-none group-hover:text-brand-400 transition-colors" />
                <select
                  className="pl-9 rtl:pl-3 rtl:pr-9 pr-8 py-2 glass-input rounded-lg hover:border-brand-500/50 appearance-none bg-slate-900/80 cursor-pointer text-sm"
                  value={i18n.language}
                  onChange={(e) => i18n.changeLanguage(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </select>
              </div>

              <button className="btn-secondary flex items-center space-x-2 rtl:space-x-reverse" onClick={handleLogout}>
                <LogOut size={16} />
                <span className="hidden sm:inline">{t("logout")}</span>
              </button>
            </div>
          </nav>
        )}

        <div className="grow flex overflow-hidden">
          {token && (
            <aside className={`shrink-0 glass-panel border-r border-l-0 rtl:border-l rtl:border-r-0 border-slate-700/30 flex flex-col transition-all duration-300 ${isSidebarOpen ? "w-16 lg:w-64 py-4 opacity-100" : "w-0 opacity-0 py-0 border-transparent overflow-hidden"}`}>
              <nav className="grow space-y-1 px-2 overflow-y-auto min-w-16">

                <NavLink to="/" className={NAV_LINK_CLASS}>
                  <MessageSquare size={20} className="shrink-0" />
                  <span className="hidden lg:block font-medium">{t("nav_chat")}</span>
                </NavLink>

                <NavLink to="/documents" className={NAV_LINK_CLASS}>
                  <Files size={20} className="shrink-0" />
                  <span className="hidden lg:block font-medium">{t("nav_documents")}</span>
                </NavLink>

                <NavLink to="/knowledge" className={NAV_LINK_CLASS}>
                  <BookOpen size={20} className="shrink-0" />
                  <span className="hidden lg:block font-medium">{t("nav_knowledge")}</span>
                </NavLink>

                <NavLink to="/channels" className={NAV_LINK_CLASS}>
                  <Smartphone size={20} className="shrink-0" />
                  <span className="hidden lg:block font-medium">{t("nav_channels")}</span>
                </NavLink>

                <NavLink to="/llm-manager" className={NAV_LINK_CLASS}>
                  <Cpu size={20} className="shrink-0" />
                  <span className="hidden lg:block font-medium">{t("nav_llm")}</span>
                </NavLink>

                {isSuperAdmin && (
                  <>
                    <NavLink to="/monitor" className={NAV_LINK_CLASS}>
                      <Activity size={20} className="shrink-0" />
                      <span className="hidden lg:block font-medium">{t("nav_monitoring")}</span>
                    </NavLink>
                    <NavLink to="/settings" className={NAV_LINK_CLASS}>
                      <Settings size={20} className="shrink-0" />
                      <span className="hidden lg:block font-medium">{t("nav_settings")}</span>
                    </NavLink>
                    <NavLink to="/terminal" className={NAV_LINK_CLASS}>
                      <TerminalSquare size={20} className="shrink-0" />
                      <span className="hidden lg:block font-medium">{t("nav_terminal")}</span>
                    </NavLink>
                  </>
                )}
              </nav>
            </aside>
          )}

          <main className="grow flex flex-col relative z-10 p-4 md:p-6 overflow-hidden">
            <Routes>
              <Route path="/login" element={!token ? <Login onLogin={handleLogin} /> : <Navigate to="/" />} />
              <Route path="/" element={token ? <Chat user={user} token={token} /> : <Navigate to="/login" />} />
              <Route path="/documents" element={token ? <DocumentsManager token={token} /> : <Navigate to="/login" />} />
              <Route path="/knowledge" element={token ? <KnowledgeBase token={token} /> : <Navigate to="/login" />} />
              <Route path="/channels" element={token ? <BridgeManager token={token} user={user} /> : <Navigate to="/login" />} />
              <Route path="/llm-manager" element={token && (isSuperAdmin || user?.role === "Admin") ? <LLMManager token={token} /> : <Navigate to="/" />} />

              {/* Super Admin only */}
              <Route path="/terminal" element={token && isSuperAdmin ? <TerminalPage /> : <Navigate to="/" />} />
              <Route path="/monitor" element={
                <div className="glass rounded-xl p-8 h-full flex flex-col items-center justify-center text-slate-400">
                  <Activity size={48} className="mb-4 text-slate-600" />
                  <h2 className="text-xl font-bold text-slate-200">System Monitoring</h2>
                  <p>Coming in Phase 4</p>
                </div>
              } />
              <Route path="/settings" element={
                <div className="glass rounded-xl p-8 h-full flex flex-col items-center justify-center text-slate-400">
                  <Settings size={48} className="mb-4 text-slate-600" />
                  <h2 className="text-xl font-bold text-slate-200">Platform Settings</h2>
                  <p>Coming in Phase 5</p>
                </div>
              } />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
