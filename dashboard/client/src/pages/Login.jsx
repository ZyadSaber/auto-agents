import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { User as UserIcon, Lock, LogIn, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

function Login({ onLogin }) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await axios.post("/api/auth/login", { username, password });
      onLogin(response.data);
    } catch {
      setError(t("invalid_credentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-[slideUp_0.5s_ease-out]">

        {/* Brand header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 shadow-xl shadow-brand-500/20 flex items-center justify-center mb-4 hover:scale-105 transition-transform duration-300">
            <span className="text-white font-bold text-3xl">AI</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">{t("login_title")}</h2>
          <p className="text-slate-400 mt-2 text-sm text-center">Sign in to your account to continue</p>
        </div>

        <Card className="glass relative overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-500 rounded-full mix-blend-screen filter blur-[80px] opacity-30 pointer-events-none" />

          <CardContent className="p-8 relative z-10">
            <form onSubmit={handleLogin} className="flex flex-col gap-5">

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg flex items-center gap-3 animate-[fadeIn_0.3s]">
                  <AlertCircle size={18} className="shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300 ml-1">{t("email_label")}</label>
                <div className="relative">
                  <UserIcon size={18} className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <Input
                    type="text"
                    className="pl-10 rtl:pl-3 rtl:pr-10 py-2.5"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300 ml-1">{t("password_label")}</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <Input
                    type="password"
                    className="pl-10 rtl:pl-3 rtl:pr-10 py-2.5"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full py-3 mt-2" size="lg">
                {loading
                  ? <Loader2 size={18} className="animate-spin" />
                  : <><LogIn size={18} /><span>{t("login_btn")}</span></>
                }
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-500 mt-6">
          &copy; {new Date().getFullYear()} AI Customer Service System
        </p>
      </div>
    </div>
  );
}

export default Login;
