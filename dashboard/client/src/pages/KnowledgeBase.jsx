import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { BookOpen, Plus, HelpCircle, Save, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function KnowledgeBase({ token }) {
  const { t } = useTranslation();
  const [solutions, setSolutions] = useState([]);
  const [filtered,  setFiltered]  = useState([]);
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState("");
  const [problem,   setProblem]   = useState("");
  const [solution,  setSolution]  = useState("");
  const [language,  setLanguage]  = useState("auto");

  const headers = { Authorization: `Bearer ${token}` };

  const fetchSolutions = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/knowledge/solutions", { headers });
      setSolutions(res.data);
      setFiltered(res.data);
    } catch { setError("Could not fetch knowledge base."); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSolutions(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(q ? solutions.filter(s =>
      s.problem.toLowerCase().includes(q) || s.solution.toLowerCase().includes(q)
    ) : solutions);
  }, [search, solutions]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!problem.trim() || !solution.trim()) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      await axios.post("/api/knowledge/learn", { problem, solution, language }, { headers });
      setSuccess("Solution learned successfully!");
      setProblem(""); setSolution("");
      fetchSolutions();
    } catch { setError("Failed to save knowledge rule."); }
    finally { setSaving(false); }
  };

  const langLabel = (l) => l === "ar" ? "Arabic" : l === "en" ? "English" : "Auto";
  const langBadge = (l) => l === "ar" ? "warning" : l === "en" ? "default" : "secondary";

  return (
    <div className="h-full flex flex-col gap-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <BookOpen className="text-brand-400" />{t("kb_title")}
        </h1>
        <p className="text-slate-400 mt-1 text-sm">{t("kb_desc")}</p>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg flex items-center gap-3">
          <AlertCircle size={18} /><span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-lg flex items-center gap-3">
          <CheckCircle2 size={18} /><span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow min-h-0">

        {/* ── Add form ── */}
        <Card className="lg:col-span-1 min-h-0 overflow-y-auto custom-scrollbar">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus size={18} className="text-brand-400" />{t("kb_add_solution")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-400">{t("kb_problem_label")}</label>
                <Textarea value={problem} onChange={(e) => setProblem(e.target.value)}
                  placeholder="e.g. How do I reset my password?" rows={4} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-400">{t("kb_solution_label")}</label>
                <Textarea value={solution} onChange={(e) => setSolution(e.target.value)}
                  placeholder="Provide the answer..." rows={6} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-400">{t("kb_lang_label")}</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-700 text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="auto">Auto-detect</option>
                  <option value="en">English</option>
                  <option value="ar">Arabic / عربي</option>
                </select>
              </div>
              <Button type="submit" disabled={saving || !problem.trim() || !solution.trim()} className="w-full" size="lg">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {t("kb_save_btn")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ── Solutions list ── */}
        <Card className="lg:col-span-2 flex flex-col min-h-0">
          <CardHeader className="shrink-0">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">{t("kb_title")}</CardTitle>
              <Input
                placeholder="Search rules..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-56 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-grow min-h-0 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-brand-400" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-16 text-center text-slate-500 italic">{t("kb_no_solutions")}</p>
            ) : (
              <div className="space-y-3">
                {filtered.map((sol, i) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30 border-l-4 border-l-brand-500 hover:bg-slate-800/50 transition-all">
                    <div className="flex items-start gap-3">
                      <HelpCircle size={16} className="text-brand-400 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-grow">
                        <p className="text-white font-medium text-sm mb-2 break-words">{sol.problem}</p>
                        <p className="text-slate-400 text-sm break-words">{sol.solution}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <Badge variant={langBadge(sol.language)}>{langLabel(sol.language)}</Badge>
                          <span className="text-xs text-slate-500">
                            {new Date(sol.created_at * 1000).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

export default KnowledgeBase;
