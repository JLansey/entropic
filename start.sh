#!/bin/bash
source ~/.env 2>/dev/null
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-$CLAUDE_API_KEY}"
cd /root/.openclaw/workspace/entropic
exec node server.js
