# dotfiles
To ease the pain.

## Install
```bash
git clone https://github.com/prompath/dotfiles.git ~/Projects/dotfiles
cd ~/Projects/dotfiles
./install.sh
```
The script installs zsh, oh-my-zsh, powerlevel10k, tmux, TPM, neovim, gh, node (nvm), python
(pyenv), marp-cli with its Chrome, Claude Code with its plugins, graphify, the impeccable design
skill, rtk and the FiraCode Nerd Font, then stows the configs into `~` and installs the tmux and
neovim plugins.
Existing files that would be replaced are moved to `~/.dotfiles-backup/<timestamp>/`.
It is safe to run again: anything already installed is skipped.

Use `./install.sh --skip-packages` to skip the system package manager (no sudo needed).

Still by hand afterwards: `claude` login, `gh auth login`, an SSH key for GitHub, and
`chsh -s $(command -v zsh)`. On WSL the font is also installed for Windows; select
"FiraCode Nerd Font" in the terminal settings.

## Packages
| Package | Config |
|---|---|
| `zsh` | `.zshrc`, `.p10k.zsh` |
| `tmux` | `.tmux.conf` |
| `nvim` | LazyVim config |
| `claude` | Global Claude Code config: `settings.json` (plugins, rtk hook), `CLAUDE.md`, `RTK.md` and a status line showing cwd, git branch and usage quota |
| `rtk` | `config.toml`, `filters.toml` |
| `alacritty` | `alacritty.toml`, only stowed when alacritty is installed |

## Claude Code in a new repo
The `claude` package is the global config, symlinked into `~/.claude`. Per-repo config starts
from `claude-template/` and is copied, so each repo can change it freely:
```bash
cd ~/Projects/some-repo
claude-init
```
This adds `CLAUDE.md` and `.claude/settings.json` (permissions and graphify hooks), then
fetches the skills listed in `bin/claude-init` into `.claude/skills/` with `npx skills add`.
Files that already exist are skipped, so it is safe to run again. Edit `claude-template/` and
the `SKILLS` list to change the defaults for future repos.
