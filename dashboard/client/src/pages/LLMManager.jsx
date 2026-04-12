import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import {
  Cpu,
  Server,
  Download,
  Trash2,
  HardDrive,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

function LLMManager({ token }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("installed");
  const [installedModels, setInstalledModels] = useState([]);
  const [runningModels, setRunningModels] = useState([]);

  const [pullModelName, setPullModelName] = useState("");
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(null);

  const [error, setError] = useState("");

  const fetchModels = async () => {
    try {
      const res = await axios.get("/api/models", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInstalledModels(res.data.models || []);
    } catch {
      setError("Could not load installed models.");
    }
  };

  const fetchRunning = async () => {
    try {
      const res = await axios.get("/api/models/ps", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRunningModels(res.data.models || []);
    } catch {
      setError("Could not load running models.");
    }
  };

  useEffect(() => {
    fetchModels();
    fetchRunning();
    const interval = setInterval(fetchRunning, 10000); // refresh running models every 10s
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (name) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await axios.delete(`/api/models/${name}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchModels();
    } catch {
      setError(`Failed to delete ${name}`);
    }
  };

  const handlePull = async (e) => {
    e.preventDefault();
    if (!pullModelName.trim() || isPulling) return;

    setIsPulling(true);
    setPullProgress({ status: "Initiating pull...", completed: 0, total: 100 });
    setError("");

    try {
      const response = await fetch("/api/models/pull", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: pullModelName }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.status) {
                setPullProgress({
                  status: parsed.status,
                  completed: parsed.completed || 0,
                  total: parsed.total || 100,
                });
              }
            } catch (e) {
              console.warn(
                "Skipping parse of incomplete stream chunk in LLMManager",
                e,
              );
            }
          }
        }
      }

      setPullModelName("");
      setTimeout(() => setPullProgress(null), 2000);
      fetchModels();
    } catch {
      setError("Error pulling model.");
      setPullProgress(null);
    } finally {
      setIsPulling(false);
    }
  };

  const bytesToGB = (bytes) => (bytes / 1024 ** 3).toFixed(2) + " GB";

  return (
    <div className="h-full flex flex-col gap-6 animate-[fadeIn_0.5s_ease-out]">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Cpu className="text-brand-400" />
            {t('llm_manager_title')}
          </h1>
          <p className="text-slate-400 mt-1 text-sm">{t('llm_manager_desc')}</p>
        </div>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg flex items-center gap-3">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-2 rtl:space-x-reverse border-b border-slate-700/50 pb-2">
        <button
          onClick={() => setActiveTab("installed")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "installed"
              ? "bg-brand-500/20 text-brand-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <HardDrive size={16} className="inline mr-2 rtl:mr-0 rtl:ml-2" />
          {t('llm_installed_tab')}
        </button>
        <button
          onClick={() => setActiveTab("running")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "running"
              ? "bg-brand-500/20 text-brand-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Server size={16} className="inline mr-2 rtl:mr-0 rtl:ml-2" />
          {t('llm_running_tab')}
        </button>
        <button
          onClick={() => setActiveTab("pull")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "pull"
              ? "bg-brand-500/20 text-brand-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Download size={16} className="inline mr-2 rtl:mr-0 rtl:ml-2" />
          {t('llm_pull_tab')}
        </button>
      </div>

      <div className="flex-grow overflow-y-auto pr-2 scroll-smooth">
        {/* Installed UI */}
        {activeTab === "installed" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {installedModels.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500">
                {t('llm_no_installed')}
              </div>
            ) : (
              installedModels.map((m) => (
                <div
                  key={m.name}
                  className="glass-panel p-5 rounded-xl border border-slate-700/30 flex flex-col hover:border-brand-500/50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold text-white truncate pr-2">
                      {m.name}
                    </h3>
                    <button
                      onClick={() => handleDelete(m.name)}
                      className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors shrink-0"
                      title="Delete model"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="space-y-2 mt-auto">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">{t('llm_size')}</span>
                      <span className="text-slate-200 font-medium">
                        {bytesToGB(m.size)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">{t('llm_family')}</span>
                      <span className="text-brand-400 font-medium bg-brand-500/10 px-2 py-0.5 rounded text-xs">
                        {m.details?.family || "unknown"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">{t('llm_parameters')}</span>
                      <span className="text-slate-200 font-medium">
                        {m.details?.parameter_size || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Running UI */}
        {activeTab === "running" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
              <div>
                <p className="text-sm text-slate-400">
                  {t('llm_running_desc')}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {t('llm_running_subdesc')}
                </p>
              </div>
              <button
                onClick={fetchRunning}
                className="p-2 bg-slate-700/50 hover:bg-slate-600 rounded-lg text-slate-200"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            {runningModels.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                {t('llm_no_running')}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {runningModels.map((m) => (
                  <div
                    key={m.name}
                    className="glass border border-brand-500/30 p-5 rounded-xl flex justify-between items-center relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-brand-500 shadow-[0_0_10px_#6366f1]"></div>
                    <div>
                      <h3 className="font-bold text-white text-lg">{m.name}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-slate-400">
                          {t('llm_vram')} <span className="text-emerald-400 font-mono">
                            {bytesToGB(m.size_vram)}
                          </span>
                        </span>
                        <span className="text-slate-400">
                          {t('llm_total')} <span className="text-slate-200 font-mono">
                            {bytesToGB(m.size)}
                          </span>
                        </span>
                      </div>
                    </div>
                    <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981] animate-pulse"></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pull UI */}
        {activeTab === "pull" && (
          <div className="max-w-2xl mx-auto mt-6">
            <div className="glass-panel p-6 rounded-2xl border border-slate-700/30 shadow-xl">
              <h2 className="text-lg font-bold text-white mb-4">
                {t('llm_pull_title')}
              </h2>
              <form onSubmit={handlePull} className="flex gap-3">
                <input
                  type="text"
                  value={pullModelName}
                  onChange={(e) => setPullModelName(e.target.value)}
                  placeholder={t('llm_pull_placeholder')}
                  className="flex-grow glass-input px-4 py-2 rounded-lg"
                  disabled={isPulling}
                />
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-2 whitespace-nowrap"
                  disabled={isPulling || !pullModelName.trim()}
                >
                  {isPulling ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <Download size={18} />
                  )}
                  {t('llm_pull_button')}
                </button>
              </form>

              {pullProgress && (
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-brand-400 font-medium">
                      {pullProgress.status}
                    </span>
                    {pullProgress.total > 100 && (
                      <span className="text-slate-400 font-mono">
                        {bytesToGB(pullProgress.completed)} /{" "}
                        {bytesToGB(pullProgress.total)}
                      </span>
                    )}
                  </div>
                  <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all duration-300 ease-out"
                      style={{
                        width: `${(pullProgress.completed / pullProgress.total) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-slate-700/50">
                <h4 className="text-sm font-medium text-slate-300 mb-2">
                  {t('llm_recommended')}
                </h4>
                <div className="flex flex-wrap gap-2 text-sm">
                  {[
                    "aya-expanse:8b",
                    "llama3:8b",
                    "mistral-nemo",
                    "qwen2:7b",
                  ].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setPullModelName(tag)}
                      className="px-3 py-1 bg-slate-800 hover:bg-brand-500/20 text-slate-300 hover:text-brand-400 rounded-full border border-slate-700 hover:border-brand-500/50 transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LLMManager;
