#!/usr/bin/env bash
set -euo pipefail

# academic-project-management install script
# Usage: curl -fsSL https://raw.githubusercontent.com/SYU8384/academic-project-management/main/install.sh | bash

REPO_URL="https://github.com/SYU8384/academic-project-management.git"
REF="v1"
CHANNEL=""
SKILL_NAME="academic-project-management"
TARGET=""
DEST_PARENT=""
YES=0

usage() {
  cat <<'USAGE'
Install or update the academic-project-management skill.

Usage:
  install.sh [--target codex|agents|claude|openclaw] [--yes] [--update]
  install.sh --dest <skills-dir> [--name academic-project-management] [--yes] [--update]

Options:
  --target <target>  Install/update target: codex, agents, claude, or openclaw.
  --dest <dir>       Custom parent skills directory.
  --name <name>      Installed skill directory name. Default: academic-project-management.
  --repo <url>       Git repo URL. Default: https://github.com/SYU8384/academic-project-management.git
  --ref <ref>        Branch or tag to install. Default: v1 (latest v1.x.x). For bleeding edge, use --ref main or --channel main.
  --channel <name>   Release channel: main (bleeding edge) or v1 (latest v1.x.x). Default: unset.
  --update           Explicitly request update behavior. Existing installs update automatically.
  --yes              Skip confirmation prompts.
  --help            Show this help.

Examples:
  curl -fsSL https://raw.githubusercontent.com/SYU8384/academic-project-management/main/install.sh | bash
  curl -fsSL https://raw.githubusercontent.com/SYU8384/academic-project-management/main/install.sh | bash -s -- --target codex --yes
  curl -fsSL https://raw.githubusercontent.com/SYU8384/academic-project-management/main/install.sh | bash -s -- --channel v1 --yes
USAGE
}

die() {
  echo "Error: $*" >&2
  exit 1
}

info() {
  echo "==> $*"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required but was not found."
}

has_tty() {
  ( : < /dev/tty ) >/dev/null 2>&1
}

tty_read() {
  local prompt="$1"
  local value
  if ! has_tty; then
    die "Interactive input requires a TTY. Re-run with --target <target> or --dest <skills-dir>."
  fi
  printf "%s" "$prompt" > /dev/tty
  IFS= read -r value < /dev/tty
  printf "%s" "$value"
}

expand_path() {
  local input="$1"
  case "$input" in
    "~") printf "%s" "$HOME" ;;
    "~/"*) printf "%s/%s" "$HOME" "${input#~/}" ;;
    *) printf "%s" "$input" ;;
  esac
}

target_dest_parent() {
  case "$1" in
    codex) printf "%s/skills" "${CODEX_HOME:-$HOME/.codex}" ;;
    agents) printf "%s/.agents/skills" "$HOME" ;;
    claude) printf "%s/.claude/skills" "$HOME" ;;
    openclaw) printf "%s/.openclaw/skills" "$HOME" ;;
    *) die "Unknown target: $1" ;;
  esac
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --target)
        [[ $# -ge 2 ]] || die "--target requires a value."
        TARGET="$2"
        shift 2
        ;;
      --dest)
        [[ $# -ge 2 ]] || die "--dest requires a value."
        DEST_PARENT="$(expand_path "$2")"
        shift 2
        ;;
      --name)
        [[ $# -ge 2 ]] || die "--name requires a value."
        SKILL_NAME="$2"
        shift 2
        ;;
      --repo)
        [[ $# -ge 2 ]] || die "--repo requires a value."
        REPO_URL="$2"
        shift 2
        ;;
      --ref)
        [[ $# -ge 2 ]] || die "--ref requires a value."
        REF="$2"
        shift 2
        ;;
      --channel)
        [[ $# -ge 2 ]] || die "--channel requires a value."
        CHANNEL="$2"
        shift 2
        ;;
      --yes|-y)
        YES=1
        shift
        ;;
      --update)
        shift
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        die "Unknown argument: $1"
        ;;
    esac
  done
}

choose_target() {
  if ! has_tty; then
    die "Interactive install requires a TTY. Re-run with --target <target> or --dest <skills-dir>."
  fi
  cat > /dev/tty <<'MENU'
Choose where to install academic-project-management:
  1) Agents  (~/.agents/skills)
  2) Codex   (~/.codex/skills)
  3) Claude  (~/.claude/skills)
  4) OpenClaw (~/.openclaw/skills)
  5) Custom skills directory
MENU
  local choice
  choice="$(tty_read "Enter 1-5: ")"
  case "$choice" in
    1) TARGET="agents" ;;
    2) TARGET="codex" ;;
    3) TARGET="claude" ;;
    4) TARGET="openclaw" ;;
    5) DEST_PARENT="$(expand_path "$(tty_read "Parent skills directory: ")")" ;;
    *) die "Invalid choice: $choice" ;;
  esac
}

normalize_repo_url() {
  local url="$1"
  url="${url%.git}"
  case "$url" in
    git@github.com:*) url="https://github.com/${url#git@github.com:}" ;;
  esac
  printf "%s" "$url"
}

ensure_same_repo() {
  local existing_url
  existing_url="$(git -C "$1" config --get remote.origin.url || true)"
  [[ -n "$existing_url" ]] || return 1
  [[ "$(normalize_repo_url "$existing_url")" == "$(normalize_repo_url "$REPO_URL")" ]]
}

install_or_update() {
  local install_dir="$1"
  local parent_dir
  parent_dir="$(dirname "$install_dir")"
  mkdir -p "$parent_dir"

  if [[ -e "$install_dir" ]]; then
    [[ -d "$install_dir/.git" ]] || die "$install_dir already exists but is not a git checkout."
    ensure_same_repo "$install_dir" || die "$install_dir exists but does not point at $REPO_URL."
    if [[ -n "$(git -C "$install_dir" status --porcelain)" ]]; then
      die "$install_dir has local changes. Commit, stash, or remove them before updating."
    fi
    info "Updating existing install at $install_dir"
    git -C "$install_dir" pull --ff-only
  else
    info "Cloning $REPO_URL ($REF) to $install_dir"
    git clone --depth 1 --branch "$REF" "$REPO_URL" "$install_dir"
  fi

  [[ -f "$install_dir/SKILL.md" ]] || die "Installed directory is missing SKILL.md."

  local installed_version="unknown"
  if [[ -f "$install_dir/VERSION" ]]; then
    installed_version="$(tr -d '[:space:]' < "$install_dir/VERSION")"
  fi
  info "Installed version: $installed_version"
}

setup_config() {
  local install_dir="$1"
  local config_dir="$HOME/.config/academic-pm"
  
  mkdir -p "$config_dir"
  
  if [[ ! -f "$config_dir/projects.json" ]]; then
    info "Creating projects.json template..."
    cp "$install_dir/templates/projects.template.json" "$config_dir/projects.json"
    echo "    Edit $config_dir/projects.json to add your projects"
  fi
}

main() {
  parse_args "$@"
  need_cmd git

  if [[ -n "$TARGET" && -n "$DEST_PARENT" ]]; then
    die "Use either --target or --dest, not both."
  fi
  if [[ -z "$TARGET" && -z "$DEST_PARENT" ]]; then
    choose_target
  fi
  if [[ -n "$TARGET" ]]; then
    DEST_PARENT="$(target_dest_parent "$TARGET")"
  fi

  [[ -n "$DEST_PARENT" ]] || die "No destination selected."
  [[ "$SKILL_NAME" != *"/"* && "$SKILL_NAME" != "." && "$SKILL_NAME" != ".." ]] || die "Invalid skill name: $SKILL_NAME"

  case "$CHANNEL" in
    "") ;;
    main) REF="main" ;;
    v1) REF="v1" ;;
    *) die "Unknown --channel: $CHANNEL. Supported: main, v1." ;;
  esac

  local install_dir="$DEST_PARENT/$SKILL_NAME"

  if [[ "$YES" -ne 1 ]]; then
    echo "Install or update academic-project-management at: $install_dir"
    local confirm
    confirm="$(tty_read "Continue? [y/N] ")"
    [[ "$confirm" == "y" || "$confirm" == "Y" ]] || die "Canceled."
  fi

  install_or_update "$install_dir"
  setup_config "$install_dir"

  cat <<EOF

✅ Installation complete!

Installed or updated academic-project-management at:
  $install_dir

Config location: ~/.config/academic-pm/projects.json

Next steps:
  1. Restart your agent so it discovers the skill.
  2. Say: "set up this project" or "setup this project"
     The agent will ask for:
       - Project name
       - PM folder path
       - Research phase (idea → literature → design → data → analysis → writing → revision → submission → published)
       - Manuscript home (optional - LaTeX/code repo path)
       - Confirmation before creating anything

  3. Or for OpenClaw PM agents, say: "set up OpenClaw PM"
     to get a copy-paste prompt for full OpenClaw workspace setup.

Quick commands (after setup):
  - "log this" or "I just finished the regression"
  - "verify setup" or "check PM"
  - "repair PM" or "fix indexes"
EOF
}

main "$@"
