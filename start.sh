#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  AI Customer Service — Safe Startup Script
#  Brings services up in correct order, waiting between each step
# ═══════════════════════════════════════════════════════════════

set -e
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[$(date +%H:%M:%S)] $1${NC}"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] $1${NC}"; }
fail() { echo -e "${RED}[$(date +%H:%M:%S)] $1${NC}"; exit 1; }

wait_for() {
  local name=$1
  local url=$2
  local max=${3:-60}
  local count=0
  warn "Waiting for $name to be ready..."
  until curl -sf "$url" > /dev/null 2>&1; do
    count=$((count + 1))
    if [ $count -ge $max ]; then
      fail "$name did not start in time. Check: docker compose logs $name"
    fi
    echo -n "."
    sleep 3
  done
  echo ""
  log "$name is ready."
}

# Make sure uploads folder exists
mkdir -p uploads

log "=== Step 1: Starting Ollama and ChromaDB ==="
docker compose up -d ollama chromadb

wait_for "Ollama"   "http://localhost:11434/api/tags" 40
wait_for "ChromaDB" "http://localhost:8000/api/v1/heartbeat" 30

log "=== Step 2: Starting AI Agents ==="
docker compose up -d docs-agent general-agent

wait_for "Docs Agent"    "http://localhost:8100/health" 40
wait_for "General Agent" "http://localhost:8200/health" 40

log "=== Step 3: Starting AnythingLLM and OpenClaw ==="
docker compose up -d anythingllm openclaw

log "=== Step 4: Starting Nginx ==="
docker compose up -d nginx

echo ""
log "════════════════════════════════════════"
log "  All services are running!"
log "════════════════════════════════════════"
echo -e "  Staff UI:     ${YELLOW}http://localhost${NC}"
echo -e "  WhatsApp QR:  ${YELLOW}http://localhost/qr${NC}"
echo -e "  Docs API:     ${YELLOW}http://localhost/api/docs/health${NC}"
echo -e "  General API:  ${YELLOW}http://localhost/api/general/health${NC}"
echo ""
echo "  View logs:    docker compose logs -f"
echo "  Stop all:     docker compose down"
