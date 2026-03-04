#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────
# GetSignalHooks — VPS Setup Script
# Run on a fresh Ubuntu 22.04+ / Debian 12+ server:
#   curl -sSL https://raw.githubusercontent.com/your-repo/deploy/setup-vps.sh | bash
# Or clone the repo first and run: bash deploy/setup-vps.sh
# ──────────────────────────────────────────────────────────────

APP_DIR="${APP_DIR:-/opt/getsignalhooks}"
REPO_URL="${REPO_URL:-https://github.com/your-org/reachwise.git}"
BRANCH="${BRANCH:-main}"

echo "========================================"
echo " GetSignalHooks VPS Setup"
echo "========================================"
echo ""

# ── 1. System updates ──
echo "[1/6] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# ── 2. Install Docker ──
if ! command -v docker &>/dev/null; then
  echo "[2/6] Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "[2/6] Docker already installed."
fi

# ── 3. Install Docker Compose plugin ──
if ! docker compose version &>/dev/null; then
  echo "[3/6] Installing Docker Compose..."
  apt-get install -y -qq docker-compose-plugin
else
  echo "[3/6] Docker Compose already installed."
fi

# ── 4. Clone or update repo ──
if [ -d "$APP_DIR" ]; then
  echo "[4/6] Updating existing installation..."
  cd "$APP_DIR"
  git pull origin "$BRANCH"
else
  echo "[4/6] Cloning repository..."
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# ── 5. Environment setup ──
if [ ! -f "$APP_DIR/.env.production" ]; then
  echo "[5/6] Creating .env.production from template..."
  cp deploy/.env.example .env.production
  echo ""
  echo "  !! IMPORTANT: Edit .env.production with your actual values:"
  echo "  !!   nano $APP_DIR/.env.production"
  echo ""
  echo "  Required values:"
  echo "    - TURSO_DATABASE_URL & TURSO_AUTH_TOKEN"
  echo "    - ANTHROPIC_API_KEY"
  echo "    - FOLLOWUP_ENGINE_API_TOKEN (generate a random string)"
  echo "    - APP_DOMAIN & N8N_DOMAIN (your DNS records)"
  echo ""
  read -rp "  Press Enter after editing .env.production (or Ctrl+C to do it later)..."
else
  echo "[5/6] .env.production already exists, skipping."
fi

# ── 6. Build and start ──
echo "[6/6] Building and starting services..."
docker compose build --no-cache
docker compose up -d

echo ""
echo "========================================"
echo " Setup complete!"
echo "========================================"
echo ""
echo " Services running:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo " Next steps:"
echo "   1. Point your DNS records:"
echo "      - A record: app.yourdomain.com → $(curl -s ifconfig.me)"
echo "      - A record: *.n8n.yourdomain.com → $(curl -s ifconfig.me)"
echo ""
echo "   2. Run the database migration:"
echo "      turso db shell <your-db> < drizzle/0001_add_api_keys.sql"
echo ""
echo "   3. Visit https://app.yourdomain.com/setup"
echo ""
echo " Useful commands:"
echo "   docker compose logs -f app    # View app logs"
echo "   docker compose logs -f caddy  # View Caddy logs"
echo "   docker compose restart        # Restart all services"
echo "   docker compose down           # Stop all services"
echo "   docker compose up -d --build  # Rebuild and restart"
echo ""
