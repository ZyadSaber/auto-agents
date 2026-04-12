import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import Login from "./pages/Login";
import Chat from "./pages/Chat";
import { LogOut, Globe } from "lucide-react"; // Import some nice icons

function App() {
  const { t, i18n } = useTranslation();
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")));

  useEffect(() => {
    document.body.dir = i18n.language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

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
      <div className="flex flex-col min-h-screen">
        {token && (
          <nav className="glass sticky top-0 z-50 px-6 py-3 flex items-center justify-between animate-[fadeIn_0.5s_ease-out]">
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 shadow-lg shadow-brand-500/50 flex items-center justify-center">
                <span className="text-white font-bold text-lg">CS</span>
              </div>
              <span className="font-semibold text-lg tracking-wide text-white">
                {t("dashboard_title")}
              </span>
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
                  onChange={(e) => changeLanguage(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </select>
              </div>

              <button
                className="btn-secondary flex items-center space-x-2 rtl:space-x-reverse"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">{t("logout")}</span>
              </button>
            </div>
          </nav>
        )}
        <main className="flex-grow flex flex-col relative z-10 pt-4 pb-6 px-4 md:px-8 h-full max-h-[calc(100vh-70px)]">
          <Routes>
            <Route
              path="/login"
              element={
                !token ? <Login onLogin={handleLogin} /> : <Navigate to="/" />
              }
            />
            <Route
              path="/"
              element={
                token ? (
                  <Chat user={user} token={token} />
                ) : (
                  <Navigate to="/login" />
                )
              }
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
