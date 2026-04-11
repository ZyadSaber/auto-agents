#!/bin/bash
# ─────────────────────────────────────────────────────────
#  AI Customer Service — Management Script
#  Usage: ./scripts/manage.sh [start|stop|status|logs|teach]
# ─────────────────────────────────────────────────────────

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

case "$1" in
  start)
    echo -e "${GREEN}Starting AI Customer Service System...${NC}"
    mkdir -p uploads
    docker compose up -d
    echo -e "${GREEN}✓ Started. Waiting for models to load...${NC}"
    echo -e "  Staff UI:   ${YELLOW}http://localhost${NC}"
    echo -e "  WhatsApp QR: ${YELLOW}http://localhost/qr${NC}"
    echo -e "  Docs API:   ${YELLOW}http://localhost/api/docs/health${NC}"
    ;;

  stop)
    echo -e "${RED}Stopping...${NC}"
    docker compose down
    echo -e "${GREEN}✓ Stopped.${NC}"
    ;;

  status)
    echo -e "${GREEN}=== Service Status ===${NC}"
    docker compose ps
    echo ""
    echo -e "${GREEN}=== Agent Health ===${NC}"
    curl -s http://localhost/api/docs/health 2>/dev/null | python3 -m json.tool || echo "Docs agent not ready"
    curl -s http://localhost/api/general/health 2>/dev/null | python3 -m json.tool || echo "General agent not ready"
    echo ""
    echo -e "${GREEN}=== Docs Agent Stats ===${NC}"
    curl -s http://localhost/api/docs/stats 2>/dev/null | python3 -m json.tool || echo "Not ready"
    ;;

  logs)
    SERVICE="${2:-}"
    if [ -z "$SERVICE" ]; then
      docker compose logs -f --tail=50
    else
      docker compose logs -f --tail=100 "$SERVICE"
    fi
    ;;

  teach)
    # Teach the docs agent a new solution interactively
    echo -e "${GREEN}=== Teach New Solution ===${NC}"
    read -p "Problem description: " PROBLEM
    read -p "Solution: " SOLUTION
    read -p "Language (en/ar/auto) [auto]: " LANG
    LANG="${LANG:-auto}"
    
    curl -s -X POST http://localhost/api/docs/learn \
      -H "Content-Type: application/json" \
      -d "{\"problem\": \"$PROBLEM\", \"solution\": \"$SOLUTION\", \"language\": \"$LANG\"}" \
      | python3 -m json.tool
    ;;

  upload)
    FILE="$2"
    if [ -z "$FILE" ]; then
      echo "Usage: ./scripts/manage.sh upload <file>"
      exit 1
    fi
    echo -e "${GREEN}Uploading $FILE...${NC}"
    curl -X POST http://localhost/api/docs/upload \
      -F "file=@$FILE"
    ;;

  ask)
    QUESTION="$2"
    if [ -z "$QUESTION" ]; then
      read -p "Question: " QUESTION
    fi
    echo -e "${GREEN}Asking Docs Agent...${NC}"
    curl -s -X POST http://localhost/api/docs/ask \
      -H "Content-Type: application/json" \
      -d "{\"question\": \"$QUESTION\"}" \
      | python3 -m json.tool
    ;;

  *)
    echo "Usage: $0 {start|stop|status|logs [service]|teach|upload <file>|ask [question]}"
    echo ""
    echo "  start          — Start all services"
    echo "  stop           — Stop all services"
    echo "  status         — Show status and health"
    echo "  logs [svc]     — Show logs (optional: service name)"
    echo "  teach          — Interactively teach a new solution"
    echo "  upload <file>  — Upload a document"
    echo "  ask [question] — Ask the docs agent a question"
    ;;
esac
