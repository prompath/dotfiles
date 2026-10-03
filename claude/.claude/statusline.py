#!/usr/bin/python3
"""Claude Code status line: cwd, git branch, usage quota.

Colors and icons mirror ~/.p10k.zsh (lean style), without nerd font glyphs.
"""
import json
import os
import re
import subprocess
import sys
import time

# 256-color palette taken from ~/.p10k.zsh
DIR, DIR_ANCHOR = 31, 39
CLEAN, MODIFIED, UNTRACKED, CONFLICTED, META = 76, 178, 39, 196, 244
BRANCH_ICON = "± "
# Columns kept free on the right for Claude Code's own padding
RIGHT_MARGIN = 4


def fg(color, text, bold=False):
    return f"\033[{'1;' if bold else ''}38;5;{color}m{text}\033[0m"


def dir_segment(cwd):
    home = os.path.expanduser("~")
    if cwd == home or cwd.startswith(home + os.sep):
        cwd = "~" + cwd[len(home):]
    head, sep, tail = cwd.rpartition(os.sep)
    if not tail:  # "/" itself
        return fg(DIR_ANCHOR, cwd, bold=True)
    return fg(DIR, head + sep) + fg(DIR_ANCHOR, tail, bold=True)


def git_segment(cwd):
    try:
        out = subprocess.run(
            ["git", "--no-optional-locks", "-C", cwd, "status", "--porcelain=v2", "--branch"],
            capture_output=True, text=True, timeout=2,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if out.returncode != 0:
        return None

    branch = oid = ""
    ahead = behind = staged = unstaged = untracked = conflicted = 0
    for line in out.stdout.splitlines():
        if line.startswith("# branch.head "):
            branch = line[14:]
        elif line.startswith("# branch.oid "):
            oid = line[13:]
        elif line.startswith("# branch.ab "):
            a, b = line[12:].split()
            ahead, behind = int(a), -int(b)
        elif line.startswith(("1 ", "2 ")):
            xy = line[2:4]
            staged += xy[0] != "."
            unstaged += xy[1] != "."
        elif line.startswith("u "):
            conflicted += 1
        elif line.startswith("? "):
            untracked += 1

    if branch == "(detached)":
        branch = "@" + oid[:8]
    dirty = staged or unstaged or conflicted
    parts = [fg(MODIFIED if dirty else CLEAN, BRANCH_ICON + branch)]
    if behind:
        parts.append(fg(CLEAN, f"⇣{behind}"))
    if ahead:
        parts.append(fg(CLEAN, f"⇡{ahead}"))
    if conflicted:
        parts.append(fg(CONFLICTED, f"~{conflicted}"))
    if staged:
        parts.append(fg(MODIFIED, f"+{staged}"))
    if unstaged:
        parts.append(fg(MODIFIED, f"!{unstaged}"))
    if untracked:
        parts.append(fg(UNTRACKED, f"?{untracked}"))
    return " ".join(parts)


def reset_in(resets_at):
    """Time left until a unix-epoch reset, as e.g. '2h14m' or '3d4h'."""
    try:
        left = int(float(resets_at) - time.time())
    except (TypeError, ValueError):
        return ""
    if left <= 0:
        return ""
    d, rem = divmod(left, 86400)
    h, rem = divmod(rem, 3600)
    m = rem // 60
    if d:
        return f"{d}d{h}h"
    if h:
        return f"{h}h{m:02d}m"
    return f"{m}m"


def quota_segment(rate_limits):
    parts = []
    for label, key in (("5h", "five_hour"), ("7d", "seven_day")):
        window = rate_limits.get(key) or {}
        pct = window.get("used_percentage")
        if pct is None:
            continue
        color = CONFLICTED if pct >= 90 else MODIFIED if pct >= 70 else CLEAN
        text = fg(META, label + " ") + fg(color, f"{pct:.0f}%")
        left = reset_in(window.get("resets_at"))
        if left:
            text += fg(META, f" ↻ {left}")
        parts.append(text)
    return fg(META, " · ").join(parts) if parts else None


def terminal_width():
    """Width of the terminal, or None if it can't be determined (stdout is a pipe)."""
    try:
        fd = os.open("/dev/tty", os.O_RDONLY)
        try:
            return os.get_terminal_size(fd).columns
        finally:
            os.close(fd)
    except OSError:
        pass
    try:
        return int(os.environ["COLUMNS"])
    except (KeyError, ValueError):
        return None


def visible_len(text):
    return len(re.sub(r"\033\[[0-9;]*m", "", text))


def main():
    try:
        data = json.load(sys.stdin)
    except ValueError:
        data = {}
    cwd = (data.get("workspace") or {}).get("current_dir") or data.get("cwd") or os.getcwd()
    left = "  ".join(s for s in (dir_segment(cwd), git_segment(cwd)) if s)
    right = quota_segment(data.get("rate_limits") or {})
    if not right:
        print(left)
        return
    width = terminal_width()
    gap = width - RIGHT_MARGIN - visible_len(left) - visible_len(right) if width else 0
    print(left + " " * max(gap, 2) + right)


if __name__ == "__main__":
    main()
