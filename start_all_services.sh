#!/bin/bash
# Milestones Coffee - Complete Service Startup (WSL/Linux)

echo "═══════════════════════════════════════════════════════════════"
echo "  Milestones Coffee - Full Stack Startup (WSL/Linux)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

echo "Starting PostgreSQL & Redis containers..."
echo ""

# Start PostgreSQL
echo "  → Starting PostgreSQL (port 5432)..."
docker run -d --rm \
  -p 5432:5432 \
  --name milestones-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=milestones \
  postgres:17-alpine > /dev/null

sleep 2

# Start Redis
echo "  → Starting Redis (port 6379)..."
docker run -d --rm \
  -p 6379:6379 \
  --name milestones-redis \
  redis:8-alpine > /dev/null

sleep 1

echo ""
echo "✓ Database services ready"
echo ""
echo "─────────────────────────────────────────────────────────────"
echo ""

# Function to start a service with its own logging
start_service() {
  local name=$1
  local port=$2
  local dir=$3
  local cmd=$4

  echo "Starting $name on port $port..."
  cd "$dir"
  eval "$cmd"
}

# Terminal multiplexing alternatives:
# Option 1: Use tmux (if available)
# Option 2: Run in background and wait
# Option 3: Use gnome-terminal or similar

# Check for tmux
if command -v tmux &> /dev/null; then
  echo "Using tmux for terminal management..."
  echo ""

  # Create new tmux session
  tmux new-session -d -s milestones -x 120 -y 30

  # API Window
  tmux new-window -t milestones -n api
  tmux send-keys -t milestones:api "cd $REPO_DIR/packages/api && npm run dev" Enter

  # Menu App Window
  tmux new-window -t milestones -n menu
  tmux send-keys -t milestones:menu "cd $REPO_DIR/packages/menu-app && npm run dev" Enter

  # Admin Dashboard Window
  tmux new-window -t milestones -n admin
  tmux send-keys -t milestones:admin "cd $REPO_DIR/packages/admin-dashboard && npm run dev" Enter

  echo "✓ All services started in tmux session 'milestones'"
  echo ""
  echo "Attach to the session with: tmux attach-session -t milestones"
  echo "Switch windows with: Ctrl+B then N (next) or P (previous)"
  echo ""

  tmux attach-session -t milestones
else
  echo "Running services in background..."
  echo ""

  # Run each in background
  (cd "$REPO_DIR/packages/api" && npm run dev &)
  sleep 3

  (cd "$REPO_DIR/packages/menu-app" && npm run dev &)
  sleep 2

  (cd "$REPO_DIR/packages/admin-dashboard" && npm run dev &)

  echo ""
  echo "✓ All services started in background"
  echo ""
  echo "Access services at:"
  echo "  • Admin Dashboard:  http://localhost:5174"
  echo "  • Menu App:         http://localhost:5173"
  echo "  • API:              http://localhost:3000"
  echo ""
  echo "To view logs: jobs -l"
  echo "To stop all: jobs -p | xargs kill"
  echo ""

  # Keep script running
  wait
fi
