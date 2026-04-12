import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";

function Chat({ token }) {
  const { t } = useTranslation();
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    // We'll fetch models from our backend proxy
    // For now, hardcode or fetch if the endpoint is ready
    axios
      .get("/api/models", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        setModels(res.data.models || []);
        if (res.data.models && res.data.models.length > 0) {
          setSelectedModel(res.data.models[0].name);
        }
      })
      .catch((err) => console.error("Could not load models", err));
  }, [token]);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: input }]);
    setInput("");
    // TODO: wire up to the actual chat endpoint
  };

  return (
    <div className="d-flex flex-column h-100 p-3">
      <div className="d-flex justify-content-between mb-3">
        <h4>{t("chat_title")}</h4>
        <select
          className="form-select bg-dark text-light border-secondary w-auto"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
        >
          {models.length === 0 ? (
            <option>{t("loading_models")}</option>
          ) : (
            models.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))
          )}
        </select>
      </div>

      <div
        className="flex-grow-1 border border-secondary rounded p-3 mb-3 overflow-auto"
        style={{ backgroundColor: "#212529" }}
      >
        {messages.length === 0 && (
          <p className="text-muted text-center mt-5">
            {t("start_conversation")}
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-3 ${msg.role === "user" ? "text-end" : "text-start"}`}
          >
            <div
              className={`d-inline-block p-2 rounded ${msg.role === "user" ? "bg-primary text-white" : "bg-secondary text-light"}`}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      <div className="input-group">
        <input
          type="text"
          className="form-control bg-dark text-light border-secondary"
          placeholder={t("ask_placeholder")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button className="btn btn-primary" onClick={handleSend}>
          {t("send_btn")}
        </button>
      </div>
    </div>
  );
}

export default Chat;
