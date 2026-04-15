import React from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  MessageSquare, Files, BookOpen, Smartphone,
  Cpu, Activity, Settings, TerminalSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/",            icon: MessageSquare,  labelKey: "nav_chat" },
  { to: "/documents",   icon: Files,          labelKey: "nav_documents" },
  { to: "/knowledge",   icon: BookOpen,       labelKey: "nav_knowledge" },
  { to: "/channels",    icon: Smartphone,     labelKey: "nav_channels" },
  { to: "/llm-manager", icon: Cpu,            labelKey: "nav_llm" },
];

const ADMIN_ITEMS = [
  { to: "/monitor",  icon: Activity,       labelKey: "nav_monitoring" },
  { to: "/settings", icon: Settings,       labelKey: "nav_settings" },
  { to: "/terminal", icon: TerminalSquare, labelKey: "nav_terminal" },
];

function NavItem({ to, icon: Icon, label, collapsed }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative",
          isActive
            ? "bg-brand-500/15 text-brand-300 border border-brand-500/25 shadow-[0_0_12px_rgba(99,102,241,0.08)]"
            : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent"
        )
      }
    >
      <Icon size={18} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
      {/* tooltip when collapsed */}
      {collapsed && (
        <span className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 whitespace-nowrap
                         opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
          {label}
        </span>
      )}
    </NavLink>
  );
}

export default function Sidebar({ isSuperAdmin, collapsed }) {
  const { t } = useTranslation();

  return (
    <aside
      className={cn(
        "shrink-0 flex flex-col border-r border-slate-700/40 bg-slate-950/40 backdrop-blur-sm transition-all duration-300 overflow-hidden",
        collapsed ? "w-[60px]" : "w-60"
      )}
    >
      <nav className="flex-1 flex flex-col gap-0.5 p-2 pt-3 overflow-y-auto overflow-x-hidden">

        {/* main nav */}
        {NAV_ITEMS.map(({ to, icon, labelKey }) => (
          <NavItem key={to} to={to} icon={icon} label={t(labelKey)} collapsed={collapsed} />
        ))}

        {/* super admin section */}
        {isSuperAdmin && (
          <>
            <div className={cn(
              "mt-4 mb-1 px-3 transition-all",
              collapsed ? "opacity-0 h-0 mt-2 mb-0 overflow-hidden" : "opacity-100"
            )}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">{t("nav_admin")}</p>
            </div>
            {collapsed && <div className="my-2 border-t border-slate-800" />}
            {ADMIN_ITEMS.map(({ to, icon, labelKey }) => (
              <NavItem key={to} to={to} icon={icon} label={t(labelKey)} collapsed={collapsed} />
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
