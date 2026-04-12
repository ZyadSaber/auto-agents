import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import Login from "./pages/Login";
import Chat from "./pages/Chat";
import "./App.css";

function App() {
  const { t, i18n } = useTranslation();
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")));

  useEffect(() => {
    document.body.dir = i18n.language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const handleLogin = (data) => {
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return (
    <Router>
      <div className="app-container text-light bg-dark min-vh-100 d-flex flex-column">
        {token && (
          <nav className="navbar navbar-dark bg-secondary px-3">
            <span className="navbar-brand mb-0 h1">{t("dashboard_title")}</span>
            <div className="d-flex align-items-center">
              <span className="me-3">
                {user?.name} ({user?.role})
              </span>
              <select
                className="form-select form-select-sm bg-dark text-light border-secondary me-3"
                style={{ width: "80px" }}
                value={i18n.language}
                onChange={(e) => changeLanguage(e.target.value)}
              >
                <option value="en">EN</option>
                <option value="ar">عربي</option>
              </select>
              <button
                className="btn btn-outline-light btn-sm"
                onClick={handleLogout}
              >
                {t("logout")}
              </button>
            </div>
          </nav>
        )}
        <div className="flex-grow-1 overflow-auto">
          <Routes>
            <Route
              path="/login"
              element={
                !token ? <Login onLogin={handleLogin} /> : <Navigate to="/" />
              }
            />
            <Route
              path="/"
              element={
                token ? (
                  <Chat user={user} token={token} />
                ) : (
                  <Navigate to="/login" />
                )
              }
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
