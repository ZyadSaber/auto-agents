import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Cpu, Server, Download, Trash2, HardDrive, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function LLMManager({ token }) {
  const { t } = useTranslation();
  const [installedModels, setInstalledModels] = useState([]);
  const [runningModels,   setRunningModels]   = useState([]);
  const [pullModelName,   setPullModelName]   = useState("");
  const [isPulling,       setIsPulling]       = useState(false);
  const [pullProgress,    setPullProgress]    = useState(null);
  const [error,           setError]           = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  const fetchModels = async () => {
    try {
      const res = await axios.get("/api/models", { headers });
      setInstalledModels(res.data.models || []);
    } catch { setError("Could not load installed models."); }
  };

  const fetchRunning = async () => {
    try {
      const res = await axios.get("/api/models/ps", { headers });
      setRunningModels(res.data.models || []);
    } catch { setError("Could not load running models."); }
  };

  useEffect(() => {
    fetchModels();
    fetchRunning();
    const iv = setInterval(fetchRunning, 10000);
    return () => clearInterval(iv);
  }, []);

  const handleDelete = async (name) => {
    if (!window.confirm(`Delete ${name}?`)) return;
    try {
      await axios.delete(`/api/models/${name}`, { headers });
      fetchModels();
    } catch { setError(`Failed to delete ${name}`); }
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: pullModelName }),
      });
      if (!response.body) throw new Error("No response body");
      const reader  = response.body.getReader();
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
              const p = JSON.parse(line);
              if (p.status) setPullProgress({ status: p.status, completed: p.completed || 0, total: p.total || 100 });
            } catch { /* skip */ }
          }
        }
      }
      setPullModelName("");
      setTimeout(() => setPullProgress(null), 2000);
      fetchModels();
    } catch { setError("Error pulling model."); setPullProgress(null); }
    finally { setIsPulling(false); }
  };

  const bytesToGB = (b) => (b / 1024 ** 3).toFixed(2) + " GB";

  return (
    <div className="h-full flex flex-col gap-6 animate-[fadeIn_0.5s_ease-out]">
      <header>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Cpu className="text-brand-400" />{t("llm_manager_title")}
        </h1>
        <p className="text-slate-400 mt-1 text-sm">{t("llm_manager_desc")}</p>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg flex items-center gap-3">
          <AlertCircle size={18} /><span>{error}</span>
        </div>
      )}

      <Tabs defaultValue="installed" className="flex flex-col flex-grow min-h-0">
        <TabsList className="w-fit">
          <TabsTrigger value="installed"><HardDrive size={15} />{t("llm_installed_tab")}</TabsTrigger>
          <TabsTrigger value="running"><Server size={15} />{t("llm_running_tab")}</TabsTrigger>
          <TabsTrigger value="pull"><Download size={15} />{t("llm_pull_tab")}</TabsTrigger>
        </TabsList>

        {/* ── Installed ── */}
        <TabsContent value="installed" className="overflow-y-auto pr-1 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {installedModels.length === 0
              ? <p className="col-span-full py-12 text-center text-slate-500 italic">{t("llm_no_installed")}</p>
              : installedModels.map((m) => (
                <Card key={m.name} className="p-5 hover:border-brand-500/50 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-base font-bold text-white truncate pr-2">{m.name}</h3>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(m.name)}
                      className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 shrink-0 h-8 w-8">
                      <Trash2 size={15} />
                    </Button>
                  </div>
                  <div className="space-y-2 mt-auto">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">{t("llm_size")}</span>
                      <span className="text-slate-200 font-medium">{bytesToGB(m.size)}</span>
                    </div>
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-slate-400">{t("llm_family")}</span>
                      <Badge variant="default">{m.details?.family || "unknown"}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">{t("llm_parameters")}</span>
                      <span className="text-slate-200 font-medium">{m.details?.parameter_size || "N/A"}</span>
                    </div>
                  </div>
                </Card>
              ))
            }
          </div>
        </TabsContent>

        {/* ── Running ── */}
        <TabsContent value="running" className="space-y-4 mt-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">{t("llm_running_desc")}</p>
                <p className="text-xs text-slate-500 mt-1">{t("llm_running_subdesc")}</p>
              </div>
              <Button variant="outline" size="icon" onClick={fetchRunning}><RefreshCw size={16} /></Button>
            </div>
          </Card>
          {runningModels.length === 0
            ? <p className="py-12 text-center text-slate-500 italic">{t("llm_no_running")}</p>
            : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {runningModels.map((m) => (
                  <div key={m.name} className="glass border border-brand-500/30 p-5 rounded-xl flex justify-between items-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-brand-500 shadow-[0_0_10px_#6366f1]" />
                    <div>
                      <h3 className="font-bold text-white text-lg">{m.name}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-slate-400">{t("llm_vram")} <span className="text-emerald-400 font-mono">{bytesToGB(m.size_vram)}</span></span>
                        <span className="text-slate-400">{t("llm_total")} <span className="text-slate-200 font-mono">{bytesToGB(m.size)}</span></span>
                      </div>
                    </div>
                    <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981] animate-pulse" />
                  </div>
                ))}
              </div>
          }
        </TabsContent>

        {/* ── Pull ── */}
        <TabsContent value="pull" className="mt-4">
          <Card className="max-w-2xl mx-auto">
            <CardHeader><CardTitle>{t("llm_pull_title")}</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handlePull} className="flex gap-3">
                <Input
                  value={pullModelName}
                  onChange={(e) => setPullModelName(e.target.value)}
                  placeholder={t("llm_pull_placeholder")}
                  disabled={isPulling}
                  className="flex-grow"
                />
                <Button type="submit" disabled={isPulling || !pullModelName.trim()}>
                  {isPulling ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                  {t("llm_pull_button")}
                </Button>
              </form>

              {pullProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-brand-400 font-medium">{pullProgress.status}</span>
                    {pullProgress.total > 100 && (
                      <span className="text-slate-400 font-mono">{bytesToGB(pullProgress.completed)} / {bytesToGB(pullProgress.total)}</span>
                    )}
                  </div>
                  <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div className="h-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all duration-300"
                      style={{ width: `${(pullProgress.completed / pullProgress.total) * 100}%` }} />
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-700/50">
                <p className="text-sm font-medium text-slate-300 mb-3">{t("llm_recommended")}</p>
                <div className="flex flex-wrap gap-2">
                  {["aya-expanse:8b", "aya-expanse:32b", "qwen2.5:7b", "llama3.3:70b", "nomic-embed-text"].map((tag) => (
                    <button key={tag} onClick={() => setPullModelName(tag)}
                      className="px-3 py-1 bg-slate-800 hover:bg-brand-500/20 text-slate-300 hover:text-brand-400 rounded-full border border-slate-700 hover:border-brand-500/50 transition-colors text-sm">
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default LLMManager;
