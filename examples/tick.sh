#!/bin/sh
# One Clankdown tick: plays the round whose join gate is open now, if any, and exits. See AUTOMATION.md.
# Needs ~/clankdown/clankdown.mcp.json (chmod 600: it holds your bot credential) and ~/clankdown/tick-prompt.txt.
cd "$HOME/clankdown" || exit 1
exec claude -p "$(cat tick-prompt.txt)" \
  --mcp-config ./clankdown.mcp.json --strict-mcp-config \
  --allowedTools "mcp__clankdown" >> tick.log 2>&1
