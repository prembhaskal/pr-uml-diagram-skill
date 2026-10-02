# pr-uml-diagram

Cursor and Claude Code skill that builds an interactive component diagram from one or more GitHub pull requests.

Copy this folder into a skills directory:

| App | All projects | One repo |
|---|---|---|
| Cursor | `~/.cursor/skills/pr-uml-diagram/` | `.cursor/skills/pr-uml-diagram/` |
| Claude Code | `~/.claude/skills/pr-uml-diagram/` | `.claude/skills/pr-uml-diagram/` |

Then ask for a UML or component diagram of a pull request. The agent writes a `data.json`; `scripts/build.py` renders a Cursor canvas and a standalone HTML file.
