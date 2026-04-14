@echo off
SETLOCAL EnableDelayedExpansion

:: ═══════════════════════════════════════════════════════════════
::  AI Customer Service — Windows Startup Script
:: ═══════════════════════════════════════════════════════════════

cls
echo ===================================================
echo   AI Customer Service - Startup
echo ===================================================
echo.

:: ── Step 1: Baseline Infra ──────────────────────────────────────
echo [1/4] Starting Ollama and ChromaDB...
docker compose up -d ollama chromadb
if %errorlevel% neq 0 (
    echo ERROR: Failed to start Ollama / ChromaDB. Is Docker running?
    pause & exit /b 1
)

echo Waiting for Ollama to be ready...
:wait_ollama
curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 3 /nobreak >nul
    goto wait_ollama
)
echo Ollama is ready.
echo.

:: ── Step 2: AI Agents ──────────────────────────────────────────
echo [2/4] Starting AI Agents (docs-agent + general-agent)...
docker compose up -d docs-agent general-agent
if %errorlevel% neq 0 (
    echo ERROR: Failed to start AI agents.
    pause & exit /b 1
)
timeout /t 5 /nobreak >nul

:: ── Step 3: Dashboard + Channel Bridge ─────────────────────────
echo [3/4] Starting Dashboard and Channel Bridge...
docker compose up -d cs-dashboard bridge
if %errorlevel% neq 0 (
    echo ERROR: Failed to start Dashboard or Channel Bridge.
    pause & exit /b 1
)
timeout /t 5 /nobreak >nul

:: ── Step 4: Nginx ──────────────────────────────────────────────
echo [4/4] Starting Nginx reverse proxy...
docker compose up -d nginx
if %errorlevel% neq 0 (
    echo ERROR: Failed to start Nginx.
    pause & exit /b 1
)

echo.
echo ===================================================
echo   All services are running!
echo ===================================================
echo.
echo   Staff Dashboard:   http://localhost
echo   WhatsApp QR:       http://localhost/api/bridge/qr
echo   Bridge health:     http://localhost/api/bridge/status
echo   Ollama API:        http://localhost:11434
echo.
echo   View all logs:     docker compose logs -f
echo   Follow one:        docker compose logs -f bridge
echo   Stop everything:   docker compose down
echo.
pause
