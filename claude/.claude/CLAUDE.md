@RTK.md

# graphify
- **graphify** (`~/.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

# Databricks execution
Never send code to run on a Databricks cluster until the user has reviewed and approved it. This covers `dbx-run.py`, `databricks api` (command execution), `databricks jobs submit` / `run-now`, `databricks workspace import`, and any other route that runs code on a cluster.

1. Write the Python script to a file and show the user its full contents.
2. Show the exact shell command that will send it, including the cluster ID.
3. Stop and wait for an explicit approval of that script and command. Approval covers that version only: any change to either needs a new review.

`~/.claude/settings.json` also sets these commands to `ask`, so each run prompts for permission. Read-only CLI calls that run no code (`databricks clusters list`, `databricks fs ls`) are not covered.

# Python environments
In personal projects, create `.venv` in the project directory and install requirements there without asking, and make sure `.venv/` is git-ignored. Never install into the system Python.
