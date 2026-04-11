#!/bin/bash
source ~/.env 2>/dev/null
export OPENAI_API_KEY="$OPENAI_API_KEY"
cd /root/.openclaw/workspace/entropic
exec node server.js
