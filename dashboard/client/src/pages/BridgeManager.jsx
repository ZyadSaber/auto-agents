import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import {
  Webhook, Settings, Terminal as TerminalIcon, MessageSquare, RefreshCw,
  AlertTriangle, ShieldCheck, CheckCircle2, XCircle, Link as LinkIcon,
  Ticket, Clock, Zap, Users, BarChart2, ScrollText, ChevronRight, Activity,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// ── helpers ───────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color = 'text-brand-400', sub }) {
  return (
    <Card className="p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg bg-slate-800 shrink-0 ${color}`}><Icon size={18} /></div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 uppercase tracking-wider font-bold truncate">{label}</p>
        <p className="text-xl font-bold text-white mt-0.5">{value ?? '—'}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

const LOG_COLORS = {
  INFO:  'text-slate-300',
  WARN:  'text-amber-400',
  ERROR: 'text-red-400',
};

// ── main component ────────────────────────────────────────────────────────────
function BridgeManager({ token, user }) {
  const { t } = useTranslation();

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
  const [sessions, setSessions]       = useState([]);
  const [sessLoading, setSessLoading] = useState(false);

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
    } catch {
      setCmdOutput(p => [...p, { ts: new Date().toISOString(), text: 'Could not fetch logs — check permissions.', ok: false }]);
    } finally { setLogsLoading(false); }
  }, [token]);

  const fetchSessions = useCallback(async () => {
    setSessLoading(true);
    try {
      const res = await axios.get('/api/customers/sessions', { headers });
      const bridgeSessions = (res.data || []).filter(s =>
        s.session_id?.startsWith('wa_') || s.session_id?.startsWith('tg_')
      );
      setSessions(bridgeSessions);
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

  // ── quick commands ────────────────────────────────────────────────────────
  const COMMANDS = [
    { id: 'stats',              label: 'Bridge Stats',         icon: BarChart2, color: 'text-brand-400'   },
    { id: 'restart-telegram',   label: 'Restart Telegram Bot', icon: RefreshCw, color: 'text-blue-400'    },
    { id: 'restart-whatsapp',   label: 'Restart WhatsApp',     icon: RefreshCw, color: 'text-emerald-400' },
    { id: 'clear-all-sessions', label: 'Clear All Sessions',   icon: Users,     color: 'text-amber-400'   },
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
        <Button variant="outline" size="icon" onClick={() => { fetchStatus(); fetchStats(); }} disabled={loading}>
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </Button>
      </header>

      <Tabs defaultValue="status" onValueChange={(val) => {
        if (val === 'console') fetchLogs();
        if (val === 'history') fetchSessions();
      }} className="flex flex-col flex-grow min-h-0">

        <TabsList className="w-fit">
          <TabsTrigger value="status">
            <ShieldCheck size={15} />{t('bridge_status_tab')}
          </TabsTrigger>
          <TabsTrigger value="console">
            <TerminalIcon size={15} />{t('bridge_console_tab')}
          </TabsTrigger>
          <TabsTrigger value="history">
            <MessageSquare size={15} />{t('bridge_history_tab')}
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings size={15} />{t('bridge_config_tab')}
          </TabsTrigger>
        </TabsList>

        {/* ── STATUS TAB ── */}
        <TabsContent value="status" className="flex-grow min-h-0 overflow-y-auto custom-scrollbar pr-1 space-y-6 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Clock}    label="Uptime"         value={statsData?.uptime_human ?? '…'}    color="text-brand-400" />
            <StatCard icon={Zap}      label="Total Messages" value={statsData?.messages?.total ?? 0}   color="text-emerald-400"
              sub={`WA: ${statsData?.messages?.whatsapp ?? 0}  TG: ${statsData?.messages?.telegram ?? 0}`} />
            <StatCard icon={Users}    label="Sessions Seen"  value={statsData?.active_sessions ?? 0}   color="text-blue-400" />
            <StatCard icon={Activity} label="Agent Errors"   value={statsData?.errors?.agent ?? 0}     color="text-red-400" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* WhatsApp Card */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <LinkIcon size={18} className="text-[#25D366]" />
                    {t('bridge_wa_status')}
                  </CardTitle>
                  {status?.whatsapp?.ready
                    ? <Badge variant="success"><CheckCircle2 size={11} /> READY</Badge>
                    : <Badge variant="warning"><RefreshCw size={11} className="animate-spin" /> WAITING</Badge>
                  }
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!status?.whatsapp?.ready && (
                  <div className="bg-white/5 rounded-xl p-4 border border-slate-700/50 aspect-square flex flex-col items-center justify-center overflow-hidden">
                    <iframe src="/api/bridge/qr" className="w-full h-full border-0 rounded-lg scale-[0.85] origin-top" title="WA QR" />
                  </div>
                )}
                {status?.whatsapp?.ready && (
                  <div className="py-10 text-center text-slate-400 flex flex-col items-center gap-4">
                    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 size={40} />
                    </div>
                    <p>WhatsApp instance is fully connected and active.</p>
                  </div>
                )}
                {isSuperAdmin && (
                  <Button variant="destructive" className="w-full" onClick={handleResetWA}>
                    {t('bridge_wa_reset_btn')}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Telegram Card */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquare size={18} className="text-[#0088cc]" />
                    {t('bridge_tg_status')}
                  </CardTitle>
                  {status?.telegram?.configured
                    ? <Badge variant="success"><ShieldCheck size={11} /> ACTIVE</Badge>
                    : <Badge variant="destructive"><XCircle size={11} /> INACTIVE</Badge>
                  }
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
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
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── CONSOLE TAB ── */}
        <TabsContent value="console" className="flex-grow min-h-0 flex flex-col gap-4 mt-4 overflow-hidden">
          {!isSuperAdmin && (
            <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-lg flex items-center gap-3">
              <AlertTriangle className="text-amber-400 shrink-0" size={18} />
              <p className="text-amber-400 text-sm">Commands require Super Admin role.</p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
            {COMMANDS.map(cmd => (
              <button key={cmd.id}
                disabled={!isSuperAdmin || runningCmd !== null}
                onClick={() => runCommand(cmd.id, cmd.label)}
                className={`p-4 rounded-xl border border-slate-700/30 bg-slate-800/30 flex flex-col items-start gap-2 transition-all
                  ${isSuperAdmin && !runningCmd
                    ? 'hover:border-brand-500/40 hover:bg-slate-700/30 cursor-pointer'
                    : 'opacity-50 cursor-not-allowed'}`}>
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
          <div className="shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <ScrollText size={16} className="text-slate-500" /> Service Logs
              </h3>
              <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={logsLoading} className="h-7 text-xs">
                <RefreshCw size={12} className={logsLoading ? 'animate-spin' : ''} /> Refresh
              </Button>
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
        </TabsContent>

        {/* ── HISTORY TAB ── */}
        <TabsContent value="history" className="flex-grow min-h-0 flex flex-col gap-4 mt-4 overflow-hidden">
          <div className="flex justify-between items-center shrink-0">
            <p className="text-sm text-slate-400">Customer sessions routed through Channel Bridge</p>
            <Button variant="outline" size="icon" onClick={fetchSessions} disabled={sessLoading}>
              <RefreshCw size={16} className={sessLoading ? 'animate-spin' : ''} />
            </Button>
          </div>

          <div className="flex-grow min-h-0 overflow-y-auto custom-scrollbar space-y-2 pr-1">
            {sessLoading && (
              <div className="flex items-center justify-center h-32 text-slate-500">
                <Loader2 size={20} className="animate-spin mr-2" /> Loading…
              </div>
            )}
            {!sessLoading && sessions.length === 0 && (
              <Card className="h-48 flex flex-col items-center justify-center text-slate-500">
                <MessageSquare size={40} className="mb-3 text-slate-700" />
                <p>No active customer sessions yet.</p>
              </Card>
            )}
            {sessions.map(s => {
              const isWA = s.session_id?.startsWith('wa_');
              return (
                <Card key={s.session_id} className="p-4 flex items-center gap-4">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
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
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ── CONFIG TAB ── */}
        <TabsContent value="config" className="flex-grow min-h-0 overflow-y-auto custom-scrollbar mt-4">
          <Card className="max-w-2xl">
            <CardContent className="pt-6">
              <form onSubmit={handleSaveConfig} className="space-y-8">
                <section className="space-y-4">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <MessageSquare size={18} className="text-brand-400" />
                    Bot Credentials
                  </h3>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400">{t('bridge_tg_token')}</label>
                    <Input type="password" value={tgToken} onChange={e => setTgToken(e.target.value)}
                      placeholder="123456:ABC-…" />
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <Ticket size={18} className="text-brand-400" />
                    {t('bridge_clickup_title')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-sm font-medium text-slate-400">{t('bridge_clickup_token')}</label>
                      <Input type="password" value={cuToken} onChange={e => setCuToken(e.target.value)}
                        placeholder="pk_…" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-400">{t('bridge_clickup_team')}</label>
                      <Input type="text" value={cuTeam} onChange={e => setCuTeam(e.target.value)}
                        placeholder="12345678" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-400">{t('bridge_clickup_list')}</label>
                      <Input type="text" value={cuList} onChange={e => setCuList(e.target.value)}
                        placeholder="987654321" />
                    </div>
                  </div>
                </section>

                <div>
                  <Button type="submit" size="lg" disabled={saving || !isSuperAdmin} className="px-8">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Settings size={16} />}
                    {t('bridge_save_config')}
                  </Button>
                  {!isSuperAdmin && (
                    <p className="text-xs text-amber-400 mt-2">Super Admin role required to save config.</p>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}

export default BridgeManager;
