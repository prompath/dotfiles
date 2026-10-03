#!/usr/bin/env bash
# Install programs (zsh, tmux, neovim, Claude Code, ...) and stow the configs.
# Usage: ./install.sh [--skip-packages]
#   --skip-packages  don't call the system package manager (no sudo needed)
set -euo pipefail

DOTFILES="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP="$HOME/.dotfiles-backup/$(date +%Y%m%d-%H%M%S)"
NVIM_MIN=0.11.2 # required by LazyVim
PACKAGES=(zsh tmux nvim claude)
SKIP_PACKAGES=false

for arg in "$@"; do
  case "$arg" in
    --skip-packages) SKIP_PACKAGES=true ;;
    *) echo "unknown option: $arg" >&2; exit 1 ;;
  esac
done

export PATH="$HOME/.local/bin:$PATH"

log() { printf '\033[1;38;5;39m==>\033[0m %s\n' "$*"; }
has() { command -v "$1" >/dev/null 2>&1; }

install_packages() {
  local sudo=""
  [ "$(id -u)" -eq 0 ] || sudo="sudo"
  if has apt-get; then
    $sudo apt-get update
    $sudo apt-get install -y git curl zsh tmux stow neovim python3 ripgrep fd-find fzf unzip build-essential
  elif has pacman; then
    $sudo pacman -S --needed --noconfirm git curl zsh tmux stow neovim python ripgrep fd fzf unzip base-devel
  elif has dnf; then
    $sudo dnf install -y git curl zsh tmux stow neovim python3 ripgrep fd-find fzf unzip gcc make
  elif has brew; then
    brew install git curl zsh tmux stow neovim ripgrep fd fzf
  else
    echo "no supported package manager found (apt, pacman, dnf, brew)" >&2
    exit 1
  fi
}

nvim_ok() {
  has nvim || return 1
  local version
  version="$(nvim --version | sed -n '1s/^NVIM v//p')"
  [ "$(printf '%s\n' "$NVIM_MIN" "$version" | sort -V | head -n1)" = "$NVIM_MIN" ]
}

# Distro neovim is too old for LazyVim: use the official release build instead.
install_neovim_release() {
  local arch
  case "$(uname -s)-$(uname -m)" in
    Linux-x86_64) arch=x86_64 ;;
    Linux-aarch64) arch=arm64 ;;
    *) echo "neovim >= $NVIM_MIN is required, please install it manually" >&2; exit 1 ;;
  esac
  mkdir -p "$HOME/.local/opt" "$HOME/.local/bin"
  curl -fsSL "https://github.com/neovim/neovim/releases/latest/download/nvim-linux-$arch.tar.gz" |
    tar -xz -C "$HOME/.local/opt"
  ln -sfn "$HOME/.local/opt/nvim-linux-$arch/bin/nvim" "$HOME/.local/bin/nvim"
}

clone() {
  [ -d "$2" ] || git clone --depth=1 "$1" "$2"
}

# Move anything that stow would collide with out of the way.
backup_conflicts() {
  local pkg="$1" entry rel unit target
  for entry in "$DOTFILES/$pkg"/.[!.]* "$DOTFILES/$pkg"/*; do
    [ -e "$entry" ] || continue
    rel="${entry#"$DOTFILES/$pkg/"}"
    case "$rel" in
      # directories shared with other programs: link their children instead
      .config | .claude) set -- "$entry"/.[!.]* "$entry"/* ;;
      *) set -- "$entry" ;;
    esac
    for unit in "$@"; do
      [ -e "$unit" ] || continue
      target="$HOME/${unit#"$DOTFILES/$pkg/"}"
      [ -e "$target" ] || [ -L "$target" ] || continue
      [ "$(realpath "$target")" = "$(realpath "$unit")" ] && continue
      mkdir -p "$(dirname "$BACKUP/${target#"$HOME/"}")"
      mv "$target" "$BACKUP/${target#"$HOME/"}"
      echo "    backed up ${target/#"$HOME"/\~} to ${BACKUP/#"$HOME"/\~}"
    done
  done
}

enable_statusline() {
  /usr/bin/python3 - "$HOME/.claude/settings.json" <<'EOF'
import json, os, sys
path = sys.argv[1]
settings = json.load(open(path)) if os.path.exists(path) else {}
if "statusLine" not in settings:
    settings["statusLine"] = {"type": "command", "command": "/usr/bin/python3 ~/.claude/statusline.py"}
    json.dump(settings, open(path, "w"), indent=2)
    print("    added statusLine to", path)
EOF
}

if $SKIP_PACKAGES; then
  has stow || { echo "stow is required" >&2; exit 1; }
else
  log "Installing packages"
  install_packages
fi

if ! nvim_ok; then
  log "Installing neovim release build"
  install_neovim_release
fi

log "Installing oh-my-zsh, powerlevel10k and tpm"
clone https://github.com/ohmyzsh/ohmyzsh.git "$HOME/.oh-my-zsh"
clone https://github.com/romkatv/powerlevel10k.git "$HOME/.oh-my-zsh/custom/themes/powerlevel10k"
clone https://github.com/tmux-plugins/tpm "$HOME/.tmux/plugins/tpm"

if ! has claude; then
  log "Installing Claude Code"
  curl -fsSL https://claude.ai/install.sh | bash
fi

log "Stowing configs"
has alacritty && PACKAGES+=(alacritty)
# keep stow from turning these shared directories into symlinks to the repo
mkdir -p "$HOME/.config" "$HOME/.claude"
for pkg in "${PACKAGES[@]}"; do
  backup_conflicts "$pkg"
  stow -d "$DOTFILES" -t "$HOME" -R "$pkg"
  echo "    $pkg"
done
enable_statusline

log "Installing tmux plugins"
"$HOME/.tmux/plugins/tpm/bin/install_plugins" || echo "    failed, press prefix + I inside tmux instead"

log "Installing neovim plugins"
nvim --headless "+Lazy! restore" +qa || echo "    failed, open nvim to finish the install"

log "Done"
case "${SHELL:-}" in
  */zsh) ;;
  *) echo "    zsh is not your login shell yet: chsh -s $(command -v zsh)" ;;
esac
