---
name: QR rescan guard sessionStorage
description: RESCAN_KEY lives in sessionStorage and blocks same-tab re-entry; any reset-to-name-entry flow must clear it or refreshes re-show the terminal screen.
---

## The rule
`setRescanRequired(status)` writes `sessionStorage.setItem("qr-rescan-required", status)` to block a browser tab that has seen a terminated session from starting a fresh session in the same tab (preventing accidental or malicious reuse after a session ends).

`resetToNameEntry()` is the function that intentionally breaks this guard to allow a new session — so it must call `sessionStorage.removeItem("qr-rescan-required")`.

**Why:** Without clearing RESCAN_KEY in `resetToNameEntry()`, the flow "session ends → user clicks Start New Session → user refreshes page" lands on the terminal screen again instead of name-entry. The same bug applies to in-tab QR scanner navigation: scanning a different table's QR and navigating there inherits the old tab's RESCAN_KEY and shows the terminal screen for the new table's token.

**How to apply:**
- Only two places should ever call `sessionStorage.removeItem(RESCAN_KEY)`: `resetToNameEntry()` (fixed) and potentially a forced admin override if one is ever added.
- Never clear RESCAN_KEY in response to realtime events — it would re-open the same tab for reuse after a legitimate session end.
