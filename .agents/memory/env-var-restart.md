---
name: Env var restart required
description: After setting environment variables, the Vite dev server must be restarted to pick them up.
---

After setting any environment variable (via `setEnvVars` or the Replit Secrets panel), always restart the affected workflow before assuming the change is live.

**Why:** Vite reads `import.meta.env` at startup — it does not hot-reload env changes. The variable will appear set in the secrets panel but the running process won't see it until restarted.

**How to apply:** Any time `setEnvVars` is called for a Vite-based artifact, immediately follow with `restart_workflow` for that artifact's workflow.
