---
name: restart
description: Kill any existing dev server on port 8077 and restart it
user_invocable: true
---

Restart the dev server for the Entropic project.

Steps:
1. Kill any process listening on port 8077: `lsof -i :8077 -t | xargs kill -9`
2. Wait 1 second for the port to free up
3. Verify the port is free with `lsof -i :8077 -t` (should return nothing)
4. Start the server in the background: `node server.js` (from the project root)
5. Wait 1 second, then check the output to confirm it started successfully
6. Report the result to the user

Important: The server binds to port 8077 and requires network access, so run commands with `dangerouslyDisableSandbox: true` if sandbox restrictions block the port binding.
