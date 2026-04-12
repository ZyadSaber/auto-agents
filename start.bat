@echo off
SETLOCAL EnableDelayedExpansion

:: ═══════════════════════════════════════════════════════════════
::  AI Customer Service — Windows Startup Script
:: ═══════════════════════════════════════════════════════════════

cls
echo ===================================================
echo   AI Customer Service - Startup (Windows)
echo ===================================================

:: Step 1: Baseline Infra
echo [1/4] Starting Ollama and ChromaDB...
docker compose up -d ollama chromadb

echo Waiting for Ollama (this may take a minute first time)...
:wait_ollama
curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 3 /nobreak >nul
    goto wait_ollama
)
echo Ollama is Ready.

:: Step 2: Intelligence Layer
echo [2/4] Starting AI Agents...
docker compose up -d docs-agent general-agent
timeout /t 5 /nobreak >nul

:: Step 3: Control Plane
echo [3/4] Starting Dashboard and OpenClaw...
docker compose up -d cs-dashboard openclaw anythingllm
timeout /t 5 /nobreak >nul

:: Step 4: Access Layer
echo [4/4] Starting Nginx Proxy...
docker compose up -d nginx

echo.
echo ===================================================
echo   All services are running!
echo ===================================================
echo.
echo   Staff UI:      http://localhost
echo   WhatsApp QR:   http://localhost/qr
echo   Bridge (TG):   http://localhost/bridge/health
echo.
echo   View logs:     docker compose logs -f
echo   Stop all:      docker compose down
echo.
pause
