---
name: Mandatory (force) in-app update gate
description: How the TRUE mandatory full-screen Android update block is wired, and why it sits above auth.
---

The mandatory update gate (`MandatoryUpdateGate` + `AppUpdateContext`) is mounted at the very
root of `App.tsx`, wrapping the router *including the login/public routes* — not just the
authenticated `AdminShell` area.

**Why:** "block every screen until updated" must include the login screen too, since a
logged-out device on an old build should never reach the app at all. The pre-existing optional
(non-force) update dialog stayed scoped inside `AdminShell` (post-login) since that one is
dismissible and lower-stakes; only the force-update path needed to move to the root.

**How to apply:** `AppUpdateProvider` runs `useAppUpdateCheck` exactly once (root-mounted) and
is the single source of truth shared by both the root-level mandatory gate and the in-app
optional-dialog gate — do not call `useAppUpdateCheck` directly in more than one place, or the
update RPC fires twice per launch/resume.

Android back button must go fully silent (no back-nav, no exit-confirm dialog) while the
mandatory screen is showing — implemented via a `disabled` prop threaded into
`useAndroidBackButton`/`AndroidBackHandler`, checked inside the `backButton` listener closure via
a ref (the listener itself is registered once, so a plain closure variable would go stale).

The native `ApkUpdaterPlugin` (Java) has no resume/partial-download support — "resume after
connectivity loss" is implemented as a full restart of the download once `useNetworkStatus`
reports back online, not a byte-range resume. Distinguish "download failed, no file yet" (full
retry) from "install failed, file already on disk" (`apkPath` still set — retry only `install()`,
don't re-download) to avoid needless re-downloads on install-only failures.
