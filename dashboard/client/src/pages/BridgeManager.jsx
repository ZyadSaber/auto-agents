import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import {
  Webhook,
  Settings,
  Terminal as TerminalIcon,
  MessageSquare,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Link as LinkIcon,
  Ticket,
  Activity,
  Clock,
  Zap,
  Users,
  BarChart2,
  Play,
  ScrollText,
  ChevronRight,
} from 'lucide-react';

// ── helpers ───────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color = 'text-brand-400', sub }) {
  return (
    <div className="glass-panel p-4 rounded-xl border border-slate-700/30 flex items-start gap-3">
      <div className={`p-2 rounded-lg bg-slate-800 ${color}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 uppercase tracking-wider font-bold truncate">{label}</p>
        <p className="text-xl font-bold text-white mt-0.5">{value ?? '—'}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const LOG_COLORS = {
  INFO:  'text-slate-300',
  WARN:  'text-amber-400',
  ERROR: 'text-red-400',
};

// ── main component ────────────────────────────────────────────────────────────
function OpenClawManager({ token, user }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('status');

  // status / stats
  const [status, setStatus]   = useState(null);
  const [statsData, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // config
  const [tgToken, setTgToken] = useState('');
  const [cuToken, setCuToken] = useState('');
  const [cuTeam,  setCuTeam]  = useState('');
  const [cuList,  setCuList]  = useState('');
  const [saving,  setSaving]  = useState(false);

  // console tab
  const [logs,        setLogs]        = useState([]);
  const [cmdOutput,   setCmdOutput]   = useState([]);
  const [runningCmd,  setRunningCmd]  = useState(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const outputRef = useRef(null);

  // history tab
  const [sessions, setSessions]         = useState([]);
  const [sessLoading, setSessLoading]   = useState(false);

  const isSuperAdmin = user?.role === 'Super Admin';

  // ── data fetchers ─────────────────────────────────────────────────────────
  const headers = { Authorization: `Bearer ${token}` };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get('/api/bridge/status', { headers });
      setStatus(res.data);
    } catch { /* service may be down */ }
    finally { setLoading(false); }
  }, [token]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get('/api/bridge/stats', { headers });
      setStats(res.data);
    } catch { /* silent */ }
  }, [token]);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await axios.get('/api/bridge/logs', { headers });
      setLogs(res.data.logs || []);
    } catch { setCmdOutput(p => [...p, { ts: new Date().toISOString(), text: 'Could not fetch logs — check permissions.', ok: false }]); }
    finally { setLogsLoading(false); }
  }, [token]);

  const fetchSessions = useCallback(async () => {
    setSessLoading(true);
    try {
      const res = await axios.get('/api/customers/sessions', { headers });
      const ocSessions = (res.data || []).filter(s =>
        s.session_id?.startsWith('wa_') || s.session_id?.startsWith('tg_')
      );
      setSessions(ocSessions);
    } catch { /* silent */ }
    finally { setSessLoading(false); }
  }, [token]);

  useEffect(() => {
    fetchStatus();
    fetchStats();
    const iv = setInterval(() => { fetchStatus(); fetchStats(); }, 10000);
    return () => clearInterval(iv);
  }, [fetchStatus, fetchStats]);

  useEffect(() => {
    if (activeTab === 'console') fetchLogs();
    if (activeTab === 'history') fetchSessions();
  }, [activeTab]);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [cmdOutput]);

  // ── actions ───────────────────────────────────────────────────────────────
  const handleResetWA = async () => {
    if (!window.confirm('Reset WhatsApp session? You will need to re-scan the QR code.')) return;
    try {
      await axios.post('/api/bridge/whatsapp/reset', {}, { headers });
      fetchStatus();
    } catch { alert('Failed to reset session'); }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post('/api/bridge/config', { tgToken, cuToken, cuTeam, cuList }, { headers });
      alert('Configuration saved!');
    } catch { alert('Failed to save configuration'); }
    finally { setSaving(false); }
  };

  const runCommand = async (command, label) => {
    if (runningCmd) return;
    setRunningCmd(command);
    setCmdOutput(p => [...p, { ts: new Date().toISOString(), text: `> ${label}`, ok: true, isCmd: true }]);
    try {
      const res = await axios.post('/api/bridge/command', { command }, { headers });
      const lines = (res.data.message || '').split('\n');
      lines.forEach(line => setCmdOutput(p => [...p, { ts: new Date().toISOString(), text: line, ok: res.data.success }]));
      if (command === 'stats') fetchStats();
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setCmdOutput(p => [...p, { ts: new Date().toISOString(), text: `Error: ${msg}`, ok: false }]);
    } finally { setRunningCmd(null); }
  };

  // ── tabs config ───────────────────────────────────────────────────────────
  const tabs = [
    { id: 'status',  label: t('bridge_status_tab'),   icon: ShieldCheck   },
    { id: 'console', label: t('bridge_console_tab'),                  icon: TerminalIcon  },
    { id: 'history', label: t('bridge_history_tab'),  icon: MessageSquare },
    { id: 'config',  label: t('bridge_config_tab'),   icon: Settings      },
  ];

  // ── quick commands ────────────────────────────────────────────────────────
  const COMMANDS = [
    { id: 'stats',              label: 'OpenClaw Stats',       icon: BarChart2,   color: 'text-brand-400'   },
    { id: 'restart-telegram',   label: 'Restart Telegram Bot', icon: RefreshCw,   color: 'text-blue-400'    },
    { id: 'restart-whatsapp',   label: 'Restart WhatsApp',     icon: RefreshCw,   color: 'text-emerald-400' },
    { id: 'clear-all-sessions', label: 'Clear All Sessions',   icon: Users,       color: 'text-amber-400'   },
  ];

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col gap-6 animate-fade-in">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Webhook className="text-brand-400" />
            {t('bridge_title')}
          </h1>
          <p className="text-slate-400 mt-1 text-sm">{t('bridge_desc')}</p>
        </div>
        <button onClick={() => { fetchStatus(); fetchStats(); }}
          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors">
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-800/50 rounded-xl border border-slate-700/30 w-fit">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}>
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-grow min-h-0 overflow-hidden">

        {/* ── STATUS TAB ── */}
        {activeTab === 'status' && (
          <div className="h-full overflow-y-auto custom-scrollbar pr-2 space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={Clock}    label="Uptime"           value={statsData?.uptime_human ?? '…'}    color="text-brand-400" />
              <StatCard icon={Zap}      label="Total Messages"   value={statsData?.messages?.total ?? 0}   color="text-emerald-400"
                sub={`WA: ${statsData?.messages?.whatsapp ?? 0}  TG: ${statsData?.messages?.telegram ?? 0}`} />
              <StatCard icon={Users}    label="Sessions Seen"    value={statsData?.active_sessions ?? 0}   color="text-blue-400" />
              <StatCard icon={Activity} label="Agent Errors"     value={statsData?.errors?.agent ?? 0}     color="text-red-400" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* WhatsApp Card */}
              <div className="glass-panel p-6 rounded-2xl border border-slate-700/30">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <LinkIcon className="text-[#25D366]" size={20} />
                    {t('bridge_wa_status')}
                  </h3>
                  {status?.whatsapp?.ready ? (
                    <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full flex items-center gap-1 border border-emerald-500/20">
                      <CheckCircle2 size={12} /> READY
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-amber-500/10 text-amber-400 text-xs font-bold rounded-full flex items-center gap-1 border border-amber-500/20">
                      <RefreshCw size={12} className="animate-spin" /> WAITING
                    </span>
                  )}
                </div>

                {!status?.whatsapp?.ready && (
                  <div className="bg-white/5 rounded-xl p-4 border border-slate-700/50 aspect-square flex flex-col items-center justify-center relative overflow-hidden">
                    <iframe src="/api/bridge/qr" className="w-full h-full border-0 rounded-lg scale-[0.85] origin-top" title="WA QR" />
                  </div>
                )}
                {status?.whatsapp?.ready && (
                  <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-4">
                    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 size={40} />
                    </div>
                    <p>WhatsApp instance is fully connected and active.</p>
                  </div>
                )}

                {isSuperAdmin && (
                  <button onClick={handleResetWA}
                    className="w-full btn-secondary text-red-400 hover:text-red-300 hover:bg-red-500/10 mt-6 border-red-500/20">
                    {t('bridge_wa_reset_btn')}
                  </button>
                )}
              </div>

              {/* Telegram Card */}
              <div className="glass-panel p-6 rounded-2xl border border-slate-700/30">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <MessageSquare className="text-[#0088cc]" size={20} />
                    {t('bridge_tg_status')}
                  </h3>
                  {status?.telegram?.configured ? (
                    <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full flex items-center gap-1 border border-emerald-500/20">
                      <ShieldCheck size={12} /> ACTIVE
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-red-500/10 text-red-400 text-xs font-bold rounded-full flex items-center gap-1 border border-red-500/20">
                      <XCircle size={12} /> INACTIVE
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Bot Integration</p>
                    <p className="text-sm text-slate-300">
                      {status?.telegram?.configured
                        ? 'Your Telegram bot is live and polling for messages.'
                        : 'No Telegram token detected. Update config to enable.'}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">ClickUp</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Tasks created</span>
                      <span className="text-white font-bold">{statsData?.clickup?.created ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-slate-400">Failed</span>
                      <span className={`font-bold ${statsData?.clickup?.failed ? 'text-red-400' : 'text-slate-400'}`}>
                        {statsData?.clickup?.failed ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CONSOLE TAB ── */}
        {activeTab === 'console' && (
          <div className="h-full flex flex-col gap-4">
            {!isSuperAdmin && (
              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center gap-3">
                <AlertTriangle className="text-amber-400 shrink-0" size={18} />
                <p className="text-amber-400 text-sm">Commands require Super Admin role.</p>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {COMMANDS.map(cmd => (
                <button key={cmd.id}
                  disabled={!isSuperAdmin || runningCmd !== null}
                  onClick={() => runCommand(cmd.id, cmd.label)}
                  className={`glass-panel p-4 rounded-xl border border-slate-700/30 flex flex-col items-start gap-2 transition-all
                    ${isSuperAdmin && !runningCmd ? 'hover:border-brand-500/40 hover:bg-slate-700/30 cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                  <cmd.icon size={20} className={runningCmd === cmd.id ? 'animate-spin text-brand-400' : cmd.color} />
                  <span className="text-sm font-medium text-slate-200">{cmd.label}</span>
                  <ChevronRight size={14} className="text-slate-600 self-end" />
                </button>
              ))}
            </div>

            {/* Command output */}
            <div ref={outputRef}
              className="flex-grow min-h-0 bg-[#0f172a] rounded-xl border border-slate-700/50 p-4 overflow-y-auto font-mono text-xs custom-scrollbar">
              {cmdOutput.length === 0 && (
                <p className="text-slate-600 italic">Click a command above to run it…</p>
              )}
              {cmdOutput.map((line, i) => (
                <div key={i} className={`leading-5 ${line.isCmd ? 'text-brand-400 font-bold mt-2' : line.ok ? 'text-slate-300' : 'text-red-400'}`}>
                  <span className="text-slate-600 mr-2 select-none">{line.ts.slice(11, 19)}</span>
                  {line.text}
                </div>
              ))}
            </div>

            {/* Log viewer */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <ScrollText size={16} className="text-slate-500" /> Service Logs
              </h3>
              <button onClick={fetchLogs} disabled={logsLoading}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
                <RefreshCw size={12} className={logsLoading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
            <div className="h-48 bg-[#0f172a] rounded-xl border border-slate-700/50 p-3 overflow-y-auto font-mono text-xs custom-scrollbar">
              {logs.length === 0
                ? <p className="text-slate-600 italic">No logs yet.</p>
                : logs.map((log, i) => (
                  <div key={i} className="leading-5 flex gap-2">
                    <span className="text-slate-600 shrink-0">{log.ts?.slice(11, 19)}</span>
                    <span className={`font-bold shrink-0 ${LOG_COLORS[log.level] || 'text-slate-400'}`}>[{log.level}]</span>
                    <span className="text-slate-300 break-all">{log.message}</span>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === 'history' && (
          <div className="h-full flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-400">Customer sessions routed through OpenClaw</p>
              <button onClick={fetchSessions} disabled={sessLoading}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors">
                <RefreshCw size={16} className={sessLoading ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="flex-grow min-h-0 overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {sessLoading && (
                <div className="flex items-center justify-center h-32 text-slate-500">
                  <RefreshCw size={20} className="animate-spin mr-2" /> Loading…
                </div>
              )}
              {!sessLoading && sessions.length === 0 && (
                <div className="glass-panel rounded-2xl border border-slate-700/30 h-48 flex flex-col items-center justify-center text-slate-500">
                  <MessageSquare size={40} className="mb-3 text-slate-700" />
                  <p>No active customer sessions yet.</p>
                </div>
              )}
              {sessions.map(s => {
                const isWA = s.session_id?.startsWith('wa_');
                return (
                  <div key={s.session_id} className="glass-panel p-4 rounded-xl border border-slate-700/30 flex items-center gap-4">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold
                      ${isWA ? 'bg-[#25D366]/20 text-[#25D366]' : 'bg-[#0088cc]/20 text-[#0088cc]'}`}>
                      {isWA ? 'WA' : 'TG'}
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{s.session_id}</p>
                      <p className="text-xs text-slate-500 truncate">{s.last_message || 'No preview'}</p>
                    </div>
                    <p className="text-xs text-slate-600 shrink-0">
                      {s.last_seen ? new Date(s.last_seen * 1000).toLocaleString() : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CONFIG TAB ── */}
        {activeTab === 'config' && (
          <div className="glass-panel p-8 rounded-2xl border border-slate-700/30 h-full overflow-y-auto custom-scrollbar">
            <form onSubmit={handleSaveConfig} className="max-w-2xl space-y-8">
              <section className="space-y-4">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <MessageSquare size={18} className="text-brand-400" />
                  Bot Credentials
                </h3>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">{t('bridge_tg_token')}</label>
                  <input type="password" value={tgToken} onChange={e => setTgToken(e.target.value)}
                    placeholder="123456:ABC-…" className="w-full glass-input p-3 rounded-xl text-sm" />
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <Ticket size={18} className="text-brand-400" />
                  {t('bridge_clickup_title')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm text-slate-400 mb-2">{t('bridge_clickup_token')}</label>
                    <input type="password" value={cuToken} onChange={e => setCuToken(e.target.value)}
                      placeholder="pk_…" className="w-full glass-input p-3 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">{t('bridge_clickup_team')}</label>
                    <input type="text" value={cuTeam} onChange={e => setCuTeam(e.target.value)}
                      placeholder="12345678" className="w-full glass-input p-3 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">{t('bridge_clickup_list')}</label>
                    <input type="text" value={cuList} onChange={e => setCuList(e.target.value)}
                      placeholder="987654321" className="w-full glass-input p-3 rounded-xl text-sm" />
                  </div>
                </div>
              </section>

              <button type="submit" disabled={saving || !isSuperAdmin}
                className="btn-primary px-8 py-3 flex items-center gap-2 disabled:opacity-50">
                {saving ? <RefreshCw className="animate-spin" size={18} /> : <Settings size={18} />}
                {t('bridge_save_config')}
              </button>
              {!isSuperAdmin && <p className="text-xs text-amber-400 mt-2">Super Admin role required to save config.</p>}
            </form>
          </div>
        )}

      </div>
    </div>
  );
}

export default OpenClawManager;
