#!/usr/bin/env bash
set -euo pipefail

# academic-project-management install script
# Usage: curl -fsSL https://raw.githubusercontent.com/SYU8384/academic-project-management/main/install.sh | bash

REPO_URL="https://github.com/SYU8384/academic-project-management.git"
DEFAULT_INSTALL_DIR=""
TARGET="${1:-agents}"

# Detect install target
case "$TARGET" in
  agents|skills)
    DEFAULT_INSTALL_DIR="$HOME/.agents/skills/academic-project-management"
    ;;
  codex)
    DEFAULT_INSTALL_DIR="$HOME/.codex/skills/academic-project-management"
    ;;
  claude)
    DEFAULT_INSTALL_DIR="$HOME/.claude/skills/academic-project-management"
    ;;
  openclaw)
    DEFAULT_INSTALL_DIR="$HOME/.openclaw/skills/academic-project-management"
    ;;
  custom)
    DEFAULT_INSTALL_DIR="${2:-}"
    if [ -z "$DEFAULT_INSTALL_DIR" ]; then
      echo "Error: --target custom requires a path argument"
      exit 1
    fi
    ;;
  *)
    echo "Usage: $0 [agents|codex|claude|openclaw|custom]"
    echo ""
    echo "Examples:"
    echo "  bash install.sh                    # Install to ~/.agents/skills"
    echo "  bash install.sh codex              # Install to ~/.codex/skills"
    echo "  bash install.sh custom /path/to    # Install to custom path"
    exit 1
    ;;
esac

INSTALL_DIR="${DEFAULT_INSTALL_DIR}"
CONFIG_DIR="$HOME/.config/academic-pm"

echo "==> Installing academic-project-management skill"
echo "    Target: $TARGET"
echo "    Directory: $INSTALL_DIR"

# Clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "==> Updating existing install..."
  cd "$INSTALL_DIR"
  git pull --ff-only origin main
else
  echo "==> Cloning repository..."
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

# Create config directory
mkdir -p "$CONFIG_DIR"

# Copy template if no projects.json exists
if [ ! -f "$CONFIG_DIR/projects.json" ]; then
  echo "==> Creating projects.json template..."
  cp "$INSTALL_DIR/templates/projects.template.json" "$CONFIG_DIR/projects.json"
  echo "    Edit $CONFIG_DIR/projects.json to add your projects"
fi

# Show version
if [ -f "$INSTALL_DIR/VERSION" ]; then
  VERSION=$(cat "$INSTALL_DIR/VERSION")
  echo "==> Installed version: $VERSION"
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "  1. Restart your agent"
echo "  2. Say: setup academic project"
echo ""
echo "Config location: $CONFIG_DIR/projects.json"
echo "Skill location:  $INSTALL_DIR"
