import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Files, Upload, Trash2, FileText, AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function DocumentsManager({ token }) {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState("");
  const docCountRef = useRef(0);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/docs", { headers });
      setDocuments(res.data);
      docCountRef.current = res.data.length;
    } catch { setError("Could not fetch documents."); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDocs(); }, []);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true); setError(""); setSuccess("");
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    try {
      await axios.post("/api/docs/upload", formData, {
        headers: { ...headers, "Content-Type": "multipart/form-data" },
      });
      const label = files.length === 1 ? files[0].name : `${files.length} files`;
      setSuccess(`${label} uploaded — indexing in background, refreshing shortly...`);
      // Ingestion (Ollama embedding) runs as a background task on the agent side.
      // Poll every 3 s until the doc count grows, or give up after 30 s (10 attempts).
      const before = docCountRef.current;
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        await fetchDocs();
        if (docCountRef.current > before || attempts >= 10) {
          clearInterval(poll);
          if (docCountRef.current > before) setSuccess(`${label} indexed successfully!`);
          else setSuccess(`${label} uploaded. If docs don't appear, click refresh in a moment.`);
        }
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to upload documents.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (filename) => {
    if (!window.confirm(`Delete ${filename}?`)) return;
    try {
      await axios.delete(`/api/docs/${encodeURIComponent(filename)}`, { headers });
      fetchDocs();
    } catch { setError("Failed to delete document."); }
  };

  const EXT_COLOR = {
    pdf: "destructive", docx: "default", txt: "secondary",
    xlsx: "success", xls: "success", csv: "warning",
  };

  const getExt = (name) => name.split(".").pop().toLowerCase();

  return (
    <div className="h-full flex flex-col gap-6 animate-fade-in">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Files className="text-brand-400" />{t("docs_title")}
          </h1>
          <p className="text-slate-400 mt-1 text-sm">{t("docs_desc")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchDocs} disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </Button>
          <label className={`cursor-pointer ${uploading ? "pointer-events-none" : ""}`}>
            <Button asChild disabled={uploading}>
              <span>
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {t("docs_upload_btn")}
              </span>
            </Button>
            <input type="file" onChange={handleUpload} className="hidden"
              accept=".pdf,.docx,.txt,.xlsx,.xls,.csv" multiple />
          </label>
        </div>
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

      <Card className="flex-grow min-h-0 flex flex-col">
        <CardContent className="p-0 flex-grow min-h-0 flex flex-col">
          <div className="overflow-y-auto flex-grow custom-scrollbar">
            <table className="w-full text-left rtl:text-right border-collapse">
              <thead className="sticky top-0 bg-slate-900/80 backdrop-blur-sm z-10">
                <tr className="border-b border-slate-700/50 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="py-3 px-5 font-semibold">{t("docs_table_name")}</th>
                  <th className="py-3 px-5 font-semibold">{t("docs_table_chunks")}</th>
                  <th className="py-3 px-5 font-semibold">{t("docs_table_date")}</th>
                  <th className="py-3 px-5 font-semibold text-right rtl:text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" className="py-16 text-center">
                    <Loader2 size={28} className="animate-spin text-brand-400 mx-auto" />
                  </td></tr>
                ) : documents.length === 0 ? (
                  <tr><td colSpan="4" className="py-16 text-center text-slate-500 italic">
                    {t("docs_no_files")}
                  </td></tr>
                ) : documents.map((doc) => (
                  <tr key={doc.filename} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-5 text-slate-200">
                      <div className="flex items-center gap-3">
                        <FileText size={16} className="text-brand-400 shrink-0" />
                        <span className="font-medium truncate max-w-xs md:max-w-sm">{doc.filename}</span>
                        <Badge variant={EXT_COLOR[getExt(doc.filename)] || "secondary"}>
                          {getExt(doc.filename).toUpperCase()}
                        </Badge>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-slate-400 font-mono text-sm">{doc.chunks}</td>
                    <td className="py-4 px-5 text-slate-400 text-sm">
                      {new Date(doc.ingested_at * 1000).toLocaleString()}
                    </td>
                    <td className="py-4 px-5 text-right rtl:text-left">
                      <Button variant="ghost" size="icon"
                        className="text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => handleDelete(doc.filename)}>
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default DocumentsManager;
