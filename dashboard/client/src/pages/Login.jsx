import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { User as UserIcon, Lock, LogIn, AlertCircle } from "lucide-react";

function Login({ onLogin }) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await axios.post("/api/auth/login", { username, password });
      onLogin(response.data);
    } catch {
      setError(t("invalid_credentials") || "Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-[slideUp_0.5s_ease-out]">
        
        {/* Logo/Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 shadow-xl shadow-brand-500/20 flex items-center justify-center mb-4 transform hover:scale-105 transition-transform duration-300">
            <span className="text-white font-bold text-3xl">CS</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">{t("login_title")}</h2>
          <p className="text-slate-400 mt-2 text-sm text-center">Sign in to your account to continue</p>
        </div>

        {/* Login Card */}
        <div className="glass rounded-2xl p-8 relative overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-500 rounded-full mix-blend-screen filter blur-[80px] opacity-30"></div>
          
          <form onSubmit={handleLogin} className="relative z-10 flex flex-col gap-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg flex items-center space-x-3 rtl:space-x-reverse animate-[fadeIn_0.3s]">
                <AlertCircle size={18} />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="flex flex-col space-y-1.5">
              <label className="text-sm font-medium text-slate-300 ml-1">{t("username_label") || "Username"}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 pl-3 rtl:pr-3 rtl:pl-0 flex items-center pointer-events-none text-slate-500">
                  <UserIcon size={18} />
                </div>
                <input
                  type="text"
                  className="w-full glass-input rounded-lg pl-10 pr-4 rtl:pr-10 rtl:pl-4 py-2.5"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col space-y-1.5">
              <label className="text-sm font-medium text-slate-300 ml-1">{t("password_label")}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 pl-3 rtl:pr-3 rtl:pl-0 flex items-center pointer-events-none text-slate-500">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  className="w-full glass-input rounded-lg pl-10 pr-4 rtl:pr-10 rtl:pl-4 py-2.5"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn-primary w-full py-3 mt-4 flex items-center justify-center space-x-2 rtl:space-x-reverse"
              disabled={loading}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>{t("login_btn")}</span>
                </>
              )}
            </button>
          </form>
        </div>
        
        <p className="text-center text-xs text-slate-500 mt-6">
          &copy; {new Date().getFullYear()} AI Customer Service System. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default Login;
