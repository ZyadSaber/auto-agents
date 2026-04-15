import React from "react";
import { useTranslation } from "react-i18next";
import { LogOut, Globe, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge }  from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function Header({ user, appConfig, onLogout, onToggleSidebar }) {
  const { t, i18n } = useTranslation();

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-slate-700/40 bg-slate-950/60 backdrop-blur-md z-50">

      {/* ── Left: toggle + logo ── */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800/60"
        >
          <Menu size={18} />
        </Button>

        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 shadow-lg shadow-brand-500/30 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm leading-none">
              {appConfig.systemName?.charAt(0) ?? "A"}
            </span>
          </div>
          <div className="hidden sm:flex items-baseline gap-2">
            <span className="font-semibold text-sm text-white tracking-wide">
              {appConfig.systemName}
            </span>
            {appConfig.companyName && (
              <span className="text-xs text-slate-500">— {appConfig.companyName}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: user + lang + logout ── */}
      <div className="flex items-center gap-3">

        {/* user info */}
        <div className="hidden md:flex flex-col items-end">
          <span className="text-xs font-medium text-slate-300 leading-none">{user?.name}</span>
          <Badge
            variant="outline"
            className="mt-1 text-[10px] px-1.5 py-0 border-brand-500/30 bg-brand-500/10 text-brand-400 font-medium"
          >
            {user?.role}
          </Badge>
        </div>

        {/* language switcher */}
        <Select value={i18n.language} onValueChange={lang => i18n.changeLanguage(lang)}>
          <SelectTrigger className="h-8 w-24 text-xs gap-1.5 border-slate-700 bg-slate-900/60">
            <Globe size={13} className="text-slate-500 shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">{t("header_lang_en")} — English</SelectItem>
            <SelectItem value="ar">{t("header_lang_ar")} — العربية</SelectItem>
          </SelectContent>
        </Select>

        {/* logout */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="gap-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 text-xs h-8"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">{t("logout")}</span>
        </Button>
      </div>
    </header>
  );
}
