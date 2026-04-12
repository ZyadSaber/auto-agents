import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import {
  Files,
  Upload,
  Trash2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

function DocumentsManager({ token }) {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchDocs = async () => {
    try {
      const res = await axios.get("/api/docs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDocuments(res.data);
    } catch {
      setError("Could not fetch documents.");
    }
  };

  useEffect(() => {
    fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post("/api/docs/upload", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      setSuccess(`${file.name} uploaded successfully!`);
      fetchDocs();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to upload document.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filename) => {
    if (!window.confirm(`Delete ${filename}?`)) return;
    try {
      await axios.delete(`/api/docs/${encodeURIComponent(filename)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchDocs();
    } catch {
      setError("Failed to delete document.");
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Files className="text-brand-400" />
          {t("docs_title")}
        </h1>
        <p className="text-slate-400 mt-1 text-sm">{t("docs_desc")}</p>
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

      <div className="glass-panel p-6 rounded-2xl border border-slate-700/30 grow min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white font-outfit">
            {t("docs_upload_btn")}
          </h2>
          <label
            className={`cursor-pointer btn-primary flex items-center gap-2 ${uploading ? "opacity-50 pointer-events-none" : ""}`}
          >
            {uploading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Upload size={18} />
            )}
            {t("docs_upload_btn")}
            <input
              type="file"
              onChange={handleUpload}
              className="hidden"
              accept=".pdf,.docx,.txt,.xlsx,.xls,.csv"
            />
          </label>
        </div>

        <div className="overflow-y-auto grow custom-scrollbar pr-2">
          <table className="w-full text-left rtl:text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-700/50 text-slate-400 text-sm">
                <th className="py-3 px-4 font-medium">
                  {t("docs_table_name")}
                </th>
                <th className="py-3 px-4 font-medium">
                  {t("docs_table_chunks")}
                </th>
                <th className="py-3 px-4 font-medium">
                  {t("docs_table_date")}
                </th>
                <th className="py-3 px-4 font-medium text-right rtl:text-left">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr>
                  <td
                    colSpan="4"
                    className="py-12 text-center text-slate-500 italic"
                  >
                    {t("docs_no_files")}
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr
                    key={doc.filename}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-4 px-4 text-slate-200">
                      <div className="flex items-center gap-3">
                        <FileText
                          size={18}
                          className="text-brand-400 shrink-0"
                        />
                        <span className="font-medium truncate max-w-50 md:max-w-md">
                          {doc.filename}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-400 font-mono text-sm">
                      {doc.chunks}
                    </td>
                    <td className="py-4 px-4 text-slate-400 text-sm">
                      {new Date(doc.ingested_at * 1000).toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-right rtl:text-left">
                      <button
                        onClick={() => handleDelete(doc.filename)}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DocumentsManager;
