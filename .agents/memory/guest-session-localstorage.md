---
name: Guest session localStorage contract
description: Rules for reading and writing the per-QR-token localStorage session record in useTableSession.ts to avoid silently dropping persisted flags.
---

## The rule
`saveStored()` rewrites the entire localStorage record from its arguments. Any flag not passed in (e.g. `billRequested`) is silently dropped. Every call site that restores an existing session **must** read the stored record first and pass flags through.

**Why:** The function was originally written to create a "clean active-session record". When `billRequested` persistence was added later, both Branch A (rare reactivation) and Branch B (normal active restore) called `saveStored()` without carrying the flag, meaning it survived only the first page refresh — the second refresh always lost it, re-enabling the "Request Bill" button.

**How to apply:**
- Adding a new persisted field to `StoredSession`? Update `saveStored()` signature to accept it (optional), and update every call site that restores (Branches A + B in `init()`) to pass `stored.<field>`.
- Write-only mutations (e.g. `markBillRequested`, `markTerminated`) are fine as spread-updates — they read-modify-write so they preserve other fields.
- New-session creation path (`startSession`) is the only case where starting without the field is correct.
