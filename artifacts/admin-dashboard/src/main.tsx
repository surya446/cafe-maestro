import { createRoot } from "react-dom/client";
import App from "./App";
import TvApp from "./tv/TvApp";
import "./index.css";

// VITE_APP_VARIANT is a build-time constant injected by Vite.
// Vite's production bundler collapses the string comparison to a boolean
// and removes the unused branch via dead-code elimination, keeping each
// APK bundle lean (Mobile bundle contains no TV code; TV bundle contains
// no dashboard/sidebar/admin code).
const isTv = (import.meta.env.VITE_APP_VARIANT as string) === "tv";

createRoot(document.getElementById("root")!).render(
  isTv ? <TvApp /> : <App />
);
