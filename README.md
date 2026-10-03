# dotfiles
To ease the pain.

## Install
```bash
git clone git@github.com:prompath/dotfiles.git ~/Projects/dotfiles
cd ~/Projects/dotfiles
./install.sh
```
The script installs zsh, oh-my-zsh, powerlevel10k, tmux, TPM, neovim and Claude Code,
then stows the configs into `~` and installs the tmux and neovim plugins.
Existing files that would be replaced are moved to `~/.dotfiles-backup/<timestamp>/`.

Use `./install.sh --skip-packages` to skip the system package manager (no sudo needed).

## Packages
| Package | Config |
|---|---|
| `zsh` | `.zshrc`, `.p10k.zsh` |
| `tmux` | `.tmux.conf` |
| `nvim` | LazyVim config |
| `claude` | Claude Code status line showing cwd, git branch and usage quota |
| `alacritty` | `alacritty.toml`, only stowed when alacritty is installed |

## TODO
1. Add script to install nerd font. (Firacode should be fine)
