import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { 
  Webhook, 
  Settings, 
  Terminal as TerminalIcon, 
  MessageSquare, 
  RefreshCw, 
  AlertTriangle, 
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Link as LinkIcon,
  Ticket
} from 'lucide-react';
import Terminal from '../components/Terminal';

function OpenClawManager({ token }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('status');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Config state
  const [tgToken, setTgToken] = useState('');
  const [cuToken, setCuToken] = useState('');
  const [cuTeam, setCuTeam] = useState('');
  const [cuList, setCuList] = useState('');

  const fetchStatus = async () => {
    try {
      const res = await axios.get('/api/openclaw/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleResetWA = async () => {
    if (!window.confirm(t('openclaw_wa_reset_btn') + '?')) return;
    try {
      await axios.post('/api/openclaw/whatsapp/reset', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchStatus();
    } catch (err) {
      alert('Failed to reset session');
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post('/api/openclaw/config', {
        tgToken,
        cuToken,
        cuTeam,
        cuList
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Configuration saved and services updated!');
    } catch (err) {
      alert('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 animate-fade-in">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Webhook className="text-brand-400" />
            {t('openclaw_title')}
          </h1>
          <p className="text-slate-400 mt-1 text-sm">{t('openclaw_desc')}</p>
        </div>
        <button 
          onClick={fetchStatus} 
          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-800/50 rounded-xl border border-slate-700/30 w-fit">
        {[
          { id: 'status', label: t('openclaw_status_tab'), icon: ShieldCheck },
          { id: 'config', label: t('openclaw_config_tab'), icon: Settings },
          { id: 'history', label: t('openclaw_history_tab'), icon: MessageSquare },
          { id: 'terminal', label: t('openclaw_terminal_tab'), icon: TerminalIcon },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id 
                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-grow min-h-0">
        {activeTab === 'status' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full overflow-y-auto pr-2 custom-scrollbar">
            {/* WhatsApp Card */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-700/30">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <LinkIcon className="text-[#25D366]" size={20} />
                  {t('openclaw_wa_status')}
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
                   <iframe 
                    src="/api/openclaw/qr" 
                    className="w-full h-full border-0 rounded-lg scale-[0.85] origin-top"
                    title="WA QR"
                   />
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

              <button 
                onClick={handleResetWA}
                className="w-full btn-secondary text-red-400 hover:text-red-300 hover:bg-red-500/10 mt-6 border-red-500/20"
              >
                {t('openclaw_wa_reset_btn')}
              </button>
            </div>

            {/* Telegram Card */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-700/30">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <MessageSquare className="text-[#0088cc]" size={20} />
                  {t('openclaw_tg_status')}
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
              
              <div className="space-y-4">
                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Bot Integration</p>
                  <p className="text-sm text-slate-300">
                    {status?.telegram?.configured 
                      ? "Your Telegram bot is live and polling for messages." 
                      : "No Telegram token detected. Update settings to enable."}
                  </p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Capabilities</p>
                  <ul className="text-sm text-slate-300 space-y-2">
                    <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Auto-routing to agents</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> ClickUp Issue Reporting</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Multi-language support</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="glass-panel p-8 rounded-2xl border border-slate-700/30 h-full overflow-y-auto custom-scrollbar">
            <form onSubmit={handleSaveConfig} className="max-w-2xl space-y-8">
              <section className="space-y-4">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <MessageSquare size={18} className="text-brand-400" />
                  Bot Credentials
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">{t('openclaw_tg_token')}</label>
                    <input 
                      type="password"
                      value={tgToken}
                      onChange={(e) => setTgToken(e.target.value)}
                      placeholder="pkv-..." 
                      className="w-full glass-input p-3 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <Ticket size={18} className="text-brand-400" />
                  {t('openclaw_clickup_title')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm text-slate-400 mb-2">{t('openclaw_clickup_token')}</label>
                    <input 
                      type="password"
                      value={cuToken}
                      onChange={(e) => setCuToken(e.target.value)}
                      placeholder="pk_..." 
                      className="w-full glass-input p-3 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">{t('openclaw_clickup_team')}</label>
                    <input 
                      type="text"
                      value={cuTeam}
                      onChange={(e) => setCuTeam(e.target.value)}
                      placeholder="12345678" 
                      className="w-full glass-input p-3 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">{t('openclaw_clickup_list')}</label>
                    <input 
                      type="text"
                      value={cuList}
                      onChange={(e) => setCuList(e.target.value)}
                      placeholder="987654321" 
                      className="w-full glass-input p-3 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </section>

              <button 
                type="submit" 
                disabled={saving}
                className="btn-primary px-8 py-3 flex items-center gap-2"
              >
                {saving ? <RefreshCw className="animate-spin" size={18} /> : <Settings size={18} />}
                {t('openclaw_save_config')}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="glass-panel rounded-2xl border border-slate-700/30 h-full flex items-center justify-center p-12 text-center text-slate-500 italic">
            <div>
              <MessageSquare size={48} className="mx-auto mb-4 text-slate-700" />
              <p>Active customer sessions will appear here in the next update.</p>
            </div>
          </div>
        )}

        {activeTab === 'terminal' && (
          <div className="flex flex-col h-full gap-4">
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3">
              <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-red-400 text-sm font-bold">SECURITY WARNING</p>
                <p className="text-red-500/80 text-xs mt-0.5">{t('openclaw_terminal_caution')}</p>
              </div>
            </div>
            <Terminal />
          </div>
        )}
      </div>
    </div>
  );
}

export default OpenClawManager;
