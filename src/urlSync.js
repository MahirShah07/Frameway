// Bidirectional URL synchronization for all app settings, choices, and navigation states.
import { DEFAULTS } from "./config.js";

export function readUrlParams() {
  if (typeof window === "undefined") return { cfg: DEFAULTS, topic: "", minutes: 2, sheet: false };
  const p = new URLSearchParams(window.location.search);

  const cfg = {
    engine: p.get("engine") || "",
    pro: p.has("pro") ? p.get("pro") === "1" || p.get("pro") === "true" : undefined,
    localModel: p.get("model") || undefined,
    geminiKey: p.get("key") || p.get("geminiKey") || undefined,
    comfyUrl: p.get("comfyUrl") || undefined,
    voiceProvider: p.get("provider") || p.get("voiceProvider") || undefined,
    voiceLang: p.get("lang") || p.get("voiceLang") || undefined,
    voiceId: p.get("voice") || p.get("voiceId") || undefined,
    elevenKey: p.get("elevenKey") || undefined,
    stepByStep: p.has("step") ? p.get("step") === "1" || p.get("step") === "true" : undefined,
    maxMinutes: p.has("max") ? Math.max(1, parseInt(p.get("max"), 10) || 180) : undefined,
    maxShots: p.has("shots") ? Math.max(0, parseInt(p.get("shots"), 10) || 0) : undefined,
  };

  // Strip undefined keys so they don't overwrite localStorage defaults
  Object.keys(cfg).forEach((k) => cfg[k] === undefined && delete cfg[k]);

  return {
    cfg,
    topic: p.get("topic") || "",
    minutes: p.has("minutes") ? Math.max(1, parseInt(p.get("minutes"), 10) || 2) : undefined,
    sheet: p.get("sheet") === "1" || p.get("sheet") === "true",
  };
}

export function writeUrlParams({ cfg = {}, topic = "", minutes = 2, sheet = false }) {
  if (typeof window === "undefined") return;
  const p = new URLSearchParams();

  if (cfg.engine) p.set("engine", cfg.engine);
  if (cfg.pro) p.set("pro", "1");
  if (cfg.localModel && cfg.localModel !== "Qwen3.5-4B") p.set("model", cfg.localModel);
  if (topic && topic.trim()) p.set("topic", topic.trim());
  if (minutes && minutes !== 2) p.set("minutes", String(minutes));
  if (cfg.maxMinutes && cfg.maxMinutes !== 180) p.set("max", String(cfg.maxMinutes));
  if (cfg.maxShots > 0) p.set("shots", String(cfg.maxShots));
  if (cfg.voiceLang && cfg.voiceLang !== "en") p.set("lang", cfg.voiceLang);
  if (cfg.voiceProvider && cfg.voiceProvider !== "edge") p.set("provider", cfg.voiceProvider);
  if (cfg.voiceId && cfg.voiceId !== "en-US-ChristopherNeural") p.set("voice", cfg.voiceId);
  if (cfg.stepByStep) p.set("step", "1");
  if (sheet) p.set("sheet", "1");
  if (cfg.comfyUrl) p.set("comfyUrl", cfg.comfyUrl);

  // If API key was explicitly passed in URL or needed in link
  const currentKey = new URLSearchParams(window.location.search).get("key");
  if (currentKey) p.set("key", currentKey);

  const query = p.toString();
  const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  const currentUrl = `${window.location.pathname}${window.location.search}`;

  if (nextUrl !== currentUrl) {
    window.history.replaceState(null, "", nextUrl);
  }
}
