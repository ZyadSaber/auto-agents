import React from 'react';
import { useTranslation } from 'react-i18next';
import { TerminalSquare, AlertTriangle } from 'lucide-react';
import Terminal from '../components/Terminal';

function TerminalPage() {
  const { t } = useTranslation();

  return (
    <div className="h-full flex flex-col gap-4 animate-fade-in">
      <header>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <TerminalSquare className="text-brand-400" />
          {t('terminal_title')}
        </h1>
        <p className="text-slate-400 mt-1 text-sm">{t('terminal_desc')}</p>
      </header>

      <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3 shrink-0">
        <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={18} />
        <p className="text-red-400 text-sm">{t('terminal_warning')}</p>
      </div>

      <div className="flex-grow min-h-0">
        <Terminal />
      </div>
    </div>
  );
}

export default TerminalPage;
