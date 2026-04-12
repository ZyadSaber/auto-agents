import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import {
  BookOpen,
  Plus,
  Search,
  HelpCircle,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

function KnowledgeBase({ token }) {
  const { t } = useTranslation();
  const [solutions, setSolutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [problem, setProblem] = useState("");
  const [solution, setSolution] = useState("");
  const [language, setLanguage] = useState("auto");

  const fetchSolutions = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/knowledge/solutions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSolutions(res.data);
    } catch {
      setError("Could not fetch knowledge base.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSolutions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!problem.trim() || !solution.trim()) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await axios.post(
        "/api/knowledge/learn",
        {
          problem,
          solution,
          language,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setSuccess("Solution learned successfully!");
      setProblem("");
      setSolution("");
      fetchSolutions();
    } catch {
      setError("Failed to save knowledge rule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <BookOpen className="text-brand-400" />
          {t("kb_title")}
        </h1>
        <p className="text-slate-400 mt-1 text-sm">{t("kb_desc")}</p>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg flex items-center gap-3">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-lg flex items-center gap-3">
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow min-h-0">
        {/* Form */}
        <div className="lg:col-span-1 min-h-0">
          <div className="glass-panel p-6 rounded-2xl border border-slate-700/30 h-full overflow-y-auto custom-scrollbar">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <Plus size={20} className="text-brand-400" />
              {t("kb_add_solution")}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">
                  {t("kb_problem_label")}
                </label>
                <textarea
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  className="w-full glass-input p-3 rounded-xl min-h-25 text-sm"
                  placeholder="Ask a question..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">
                  {t("kb_solution_label")}
                </label>
                <textarea
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                  className="w-full glass-input p-3 rounded-xl min-h-37.5 text-sm"
                  placeholder="Provide the target answer..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">
                  {t("kb_lang_label")}
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full glass-input p-3 rounded-xl text-sm"
                >
                  <option value="auto">Auto-detect</option>
                  <option value="en">English</option>
                  <option value="ar">Arabic</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={saving || !problem.trim() || !solution.trim()}
                className="w-full btn-primary flex items-center justify-center gap-2 py-3 mt-4"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Save size={18} />
                )}
                {t("kb_save_btn")}
              </button>
            </form>
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-2">
          <div className="glass-panel p-6 rounded-2xl border border-slate-700/30 overflow-hidden flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{t("kb_title")}</h2>
              <div className="relative max-w-xs">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Search rules..."
                  className="glass-input pl-10 pr-4 py-2 rounded-lg text-sm w-full"
                />
              </div>
            </div>

            <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="animate-spin text-brand-400" size={32} />
                </div>
              ) : solutions.length === 0 ? (
                <div className="py-20 text-center text-slate-500 italic">
                  {t("kb_no_solutions")}
                </div>
              ) : (
                <div className="space-y-4">
                  {solutions.map((sol, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30 border-l-4 border-l-brand-500 hover:border-slate-600/50 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <HelpCircle
                          size={18}
                          className="text-brand-400 mt-1 shrink-0"
                        />
                        <div>
                          <p className="text-white font-medium text-sm mb-2">
                            {sol.problem}
                          </p>
                          <p className="text-slate-400 text-sm">
                            {sol.solution}
                          </p>
                          <div className="flex items-center gap-3 mt-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                              {sol.language === "ar"
                                ? "Arabic"
                                : sol.language === "en"
                                  ? "English"
                                  : "Auto"}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Added{" "}
                              {new Date(
                                sol.created_at * 1000,
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default KnowledgeBase;
