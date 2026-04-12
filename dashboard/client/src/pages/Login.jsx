import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";

function Login({ onLogin }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post("/api/auth/login", { email, password });
      onLogin(response.data);
    } catch {
      setError(t("invalid_credentials"));
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100">
      <div
        className="card bg-dark text-light border-secondary p-4"
        style={{ width: "400px" }}
      >
        <h3 className="mb-4 text-center">{t("login_title")}</h3>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleLogin}>
          <div className="mb-3">
            <label className="form-label">{t("email_label")}</label>
            <input
              type="email"
              className="form-control bg-secondary text-light border-dark"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">{t("password_label")}</label>
            <input
              type="password"
              className="form-control bg-secondary text-light border-dark"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary w-100">
            {t("login_btn")}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
