#!/usr/bin/env bash
# Install programs (zsh, tmux, neovim, node, pyenv, gh, Claude Code, graphify, rtk, ...) and stow the configs.
# Usage: ./install.sh [--skip-packages]
#   --skip-packages  don't call the system package manager (no sudo needed)
set -euo pipefail

DOTFILES="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP="$HOME/.dotfiles-backup/$(date +%Y%m%d-%H%M%S)"
NVIM_MIN=0.11.2 # required by LazyVim
PYTHON_VERSION=3.12
PACKAGES=(zsh tmux nvim claude rtk)
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
    $sudo apt-get install -y git curl zsh tmux stow neovim python3 ripgrep fd-find fzf unzip build-essential \
      gh xz-utils fontconfig
    # pyenv builds python from source
    $sudo apt-get install -y libssl-dev zlib1g-dev libbz2-dev libreadline-dev libsqlite3-dev \
      libncursesw5-dev tk-dev libxml2-dev libxmlsec1-dev libffi-dev liblzma-dev
    # shared libraries for marp's chrome (package names as of Ubuntu 24.04)
    $sudo apt-get install -y libglib2.0-0t64 libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64 libdbus-1-3 \
      libcups2t64 libxkbcommon0 libasound2t64 libgbm1 libcairo2 libpango-1.0-0 libxcomposite1 libxdamage1 \
      libxfixes3 libxrandr2 || echo "    chrome libraries not installed, marp PDF export may not work"
  elif has pacman; then
    $sudo pacman -S --needed --noconfirm git curl zsh tmux stow neovim python ripgrep fd fzf unzip base-devel \
      github-cli xz fontconfig openssl zlib tk
  elif has dnf; then
    $sudo dnf install -y git curl zsh tmux stow neovim python3 ripgrep fd-find fzf unzip gcc make \
      gh xz fontconfig patch zlib-devel bzip2 bzip2-devel readline-devel sqlite sqlite-devel \
      openssl-devel tk-devel libffi-devel xz-devel
  elif has brew; then
    brew install git curl zsh tmux stow neovim ripgrep fd fzf gh xz openssl readline sqlite3 zlib tcl-tk
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

# FiraCode Nerd Font, used by p10k, tmux and alacritty.
install_nerd_font() {
  if [ "$(uname -s)" = Darwin ]; then
    brew install --cask font-fira-code-nerd-font
    return
  fi
  local dir="$HOME/.local/share/fonts/FiraCode" windir
  if ! compgen -G "$dir/*.ttf" >/dev/null; then
    mkdir -p "$dir"
    curl -fsSL https://github.com/ryanoasis/nerd-fonts/releases/latest/download/FiraCode.tar.xz |
      tar -xJ -C "$dir"
    if has fc-cache; then fc-cache -f "$dir"; fi
  fi
  # On WSL the terminal runs on Windows, so the font has to be installed there too.
  grep -qi microsoft /proc/version && has powershell.exe || return 0
  windir="$(powershell.exe -NoProfile -Command '[Environment]::GetFolderPath("LocalApplicationData")' | tr -d '\r')"
  windir="$(wslpath "$windir")/Microsoft/Windows/Fonts"
  compgen -G "$windir/FiraCodeNerdFont-*.ttf" >/dev/null && return 0
  mkdir -p "$windir"
  cp "$dir"/FiraCodeNerdFont-*.ttf "$windir/"
  # shellcheck disable=SC2016
  powershell.exe -NoProfile -Command '
    Get-ChildItem "$env:LOCALAPPDATA\Microsoft\Windows\Fonts" -Filter "FiraCodeNerdFont-*.ttf" | ForEach-Object {
      New-ItemProperty -Path "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts" `
        -Name "$($_.BaseName) (TrueType)" -Value $_.FullName -PropertyType String -Force | Out-Null
    }'
  echo "    installed for Windows too: pick \"FiraCode Nerd Font\" in the terminal settings"
}

# The Chrome that puppeteer downloaded, on Linux or macOS (same globs as .zshrc).
chrome_bin() {
  {
    compgen -G "$HOME/.cache/puppeteer/chrome/*/chrome-linux64/chrome" ||
      compgen -G "$HOME/.cache/puppeteer/chrome/*/chrome-mac-*/*.app/Contents/MacOS/*"
  } | tail -1
}

# Add the marketplaces and plugins named in the stowed ~/.claude/settings.json.
install_claude_plugins() {
  local kind name source
  /usr/bin/python3 - "$HOME/.claude" <<'EOF' | while read -r kind name source; do
import json, os, sys
root = sys.argv[1]
def load(path):
    path = os.path.join(root, path)
    return json.load(open(path)) if os.path.exists(path) else {}
settings = load("settings.json")
known = load("plugins/known_marketplaces.json")
installed = load("plugins/installed_plugins.json").get("plugins", {})
for name, entry in settings.get("extraKnownMarketplaces", {}).items():
    if name not in known and entry.get("source", {}).get("source") == "github":
        print("marketplace", name, entry["source"]["repo"])
for name, enabled in settings.get("enabledPlugins", {}).items():
    if enabled and name not in installed:
        print("plugin", name, "-")
EOF
    if case "$kind" in
      marketplace) claude plugin marketplace add "$source" </dev/null >/dev/null ;;
      plugin) claude plugin install "$name" </dev/null >/dev/null ;;
    esac then
      echo "    $name"
    else
      echo "    $name failed, use /plugin inside claude instead"
    fi
  done
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

# claude-init fetches skills with npx
if ! has node; then
  log "Installing nvm and node"
  export NVM_DIR="$HOME/.nvm"
  # PROFILE=/dev/null: .zshrc already loads nvm, keep the installer from editing it
  [ -s "$NVM_DIR/nvm.sh" ] ||
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | PROFILE=/dev/null bash
  set +u
  . "$NVM_DIR/nvm.sh"
  nvm install --lts
  set -u
fi

if ! has marp; then
  log "Installing marp-cli"
  npm install -g @marp-team/marp-cli
fi

# Marp needs a browser for PDF export; .zshrc points CHROME_PATH at this one.
if [ -z "$(chrome_bin)" ]; then
  log "Installing Chrome for Marp"
  npx -y @puppeteer/browsers install chrome@stable --path "$HOME/.cache/puppeteer"
  "$(chrome_bin)" --version >/dev/null 2>&1 ||
    echo "    chrome does not start, on Linux a system library is missing (find it with: ldd ~/.cache/puppeteer/chrome/*/chrome-linux64/chrome | grep 'not found')"
fi

export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
# pyenv may also come from the package manager (brew), then there is no ~/.pyenv/bin
if ! has pyenv; then
  log "Installing pyenv"
  curl -fsSL https://pyenv.run | bash
fi
if ! pyenv versions --bare | grep -q "^$PYTHON_VERSION"; then
  log "Building python $PYTHON_VERSION with pyenv"
  if pyenv install "$PYTHON_VERSION"; then
    pyenv global "$PYTHON_VERSION"
  else
    echo "    failed, check the build dependencies then: pyenv install $PYTHON_VERSION"
  fi
fi

log "Installing FiraCode Nerd Font"
install_nerd_font || echo "    failed, get it from https://www.nerdfonts.com/font-downloads"

if ! has claude; then
  log "Installing Claude Code"
  curl -fsSL https://claude.ai/install.sh | bash
fi

if ! has graphify; then
  log "Installing graphify"
  has uv || curl -LsSf https://astral.sh/uv/install.sh | sh
  uv tool install 'graphifyy[pdf,office]' # same extras as everything-ais/scripts/setup.sh
fi

# the PreToolUse hook in the stowed ~/.claude/settings.json calls rtk
if ! has rtk; then
  log "Installing rtk"
  curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
fi

log "Stowing configs"
has alacritty && PACKAGES+=(alacritty)
# keep stow from turning these shared directories into symlinks to the repo
mkdir -p "$HOME/.config" "$HOME/.claude" "$HOME/.local/bin"
for pkg in "${PACKAGES[@]}"; do
  backup_conflicts "$pkg"
  stow -d "$DOTFILES" -t "$HOME" -R "$pkg"
  echo "    $pkg"
done
ln -sfn "$DOTFILES/bin/claude-init" "$HOME/.local/bin/claude-init"
echo "    claude-init"

# after stowing, so the skill lands next to the stowed ~/.claude files
[ -d "$HOME/.claude/skills/graphify" ] || graphify install --platform claude

# --no-hooks: its hooks are per project and would be written to the current directory,
# turn them on in a repo with /impeccable hooks on
if [ ! -d "$HOME/.claude/skills/impeccable" ]; then
  log "Installing impeccable"
  npx -y impeccable install -y --providers=claude --scope=global --no-hooks </dev/null >/dev/null ||
    echo "    failed, run: npx impeccable install"
fi

log "Installing Claude Code plugins"
install_claude_plugins

log "Installing tmux plugins"
"$HOME/.tmux/plugins/tpm/bin/install_plugins" || echo "    failed, press prefix + I inside tmux instead"

log "Installing neovim plugins"
# lazy.nvim's first start installs most plugins at their latest commit and rewrites the lockfile,
# so let it bootstrap, put the lockfile back, then restore
if [ ! -d "$HOME/.local/share/nvim/lazy" ]; then
  lock="$DOTFILES/nvim/.config/nvim/lazy-lock.json"
  pinned="$(cat "$lock")"
  nvim --headless +qa || true
  printf '%s\n' "$pinned" >"$lock"
fi
nvim --headless "+Lazy! restore" +qa || echo "    failed, open nvim to finish the install"

log "Done"
case "${SHELL:-}" in
  */zsh) ;;
  *) echo "    zsh is not your login shell yet: chsh -s $(command -v zsh)" ;;
esac
