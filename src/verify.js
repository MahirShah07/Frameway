// Verification layer: every part reports ok / warn / fail / idle with a plain-language fix.
import { detect, listVideoModels, renderClip } from "./comfy.js";
import { testVoice } from "./pipeline.js";
import { getLocalModel } from "./localModels.js";
export { testVoice };
const E = import.meta.env ?? globalThis.process?.env ?? {};
const GBASE = E.VITE_GEMINI_BASE || "https://generativelanguage.googleapis.com";
const C = (id, title, state, msg, fix = "") => ({ id, title, state, msg, fix });

export async function verifyScript(cfg) {
  if (cfg.engine === "gemini") {
    if (!cfg.geminiKey) return C("script", "Gemini", "fail", "No API key yet.", "Get a free key at aistudio.google.com/apikey and paste it in.");
    try {
      const r = await fetch(`${GBASE}/v1beta/models?pageSize=200&key=${encodeURIComponent(cfg.geminiKey)}`); // lists models: checks the key without spending quota
      if (!r.ok) return C("script", "Gemini", "fail", r.status === 400 || r.status === 403 ? "Google rejected this key." : `Google answered ${r.status}.`, "Check the key at aistudio.google.com/apikey.");
      const names = ((await r.json()).models || []).map((m) => m.name);
      if (cfg.pro && !names.some((n) => /gemini.*pro/i.test(n))) return C("script", "Gemini", "warn", "Key works, but Pro isn't available on it. Flash will be used.");
      return C("script", "Gemini", "ok", `Key accepted · ${cfg.pro ? "Pro" : "Flash"}.`);
    } catch { return C("script", "Gemini", "warn", "Couldn't reach Google from this browser.", "Check your internet connection."); }
  }
  try {
    const a = await navigator.gpu?.requestAdapter(); if (!a) throw 0;
    const m = getLocalModel(cfg.localModel);
    return C("script", "On-device model", "ok", `WebGPU ready · ${m.name} (${m.size}${a.features.has("shader-f16") ? "" : ", f32"}).`);
  } catch { return C("script", "On-device model", "fail", "This browser has no WebGPU.", "Use Chrome or Edge, or switch to Gemini."); }
}

export async function verifyComfy(cfg) {
  const d = await detect(cfg.comfyUrl), checks = [];
  checks.push(d.state === "none" ? C("run", "ComfyUI is running", "fail", "Not detected.", "Install ComfyUI Desktop from comfy.org/download, then open it.") : C("run", "ComfyUI is running", "ok", `Installed and running at ${d.base}.`));
  checks.push(d.state === "ok" ? C("cors", "This page can reach it", "ok", "Connected.") : d.state === "blocked" ? C("cors", "This page can reach it", "fail", "ComfyUI is blocking this page.", "In ComfyUI: Settings → Server Config → Enable CORS header = *, then restart it.") : C("cors", "This page can reach it", "idle", "Waiting for ComfyUI."));
  let models = [];
  if (d.state === "ok") { models = await listVideoModels(d.base); checks.push(models.length ? C("models", "A video model is installed", "ok", models[0]) : C("models", "A video model is installed", "fail", "None found yet.", "In ComfyUI open a text-to-video template (LTX or Wan) and let it download its models.")); }
  else checks.push(C("models", "A video model is installed", "idle", "Waiting for ComfyUI."));
  let wfOk = false; try { wfOk = !!cfg.workflow && JSON.parse(cfg.workflow) && cfg.workflow.includes("{{PROMPT}}"); } catch {}
  checks.push(wfOk ? C("wf", "Video workflow is ready", "ok", "Saved in this browser.") : C("wf", "Video workflow is ready", d.state === "ok" ? "warn" : "idle", d.state === "ok" ? "Not connected yet." : "Waiting for ComfyUI.", "Press Connect, or upload a workflow you saved from ComfyUI."));
  return { checks, base: d.base, state: d.state, ready: d.state === "ok" && wfOk && models.length > 0 };
}

export async function testClip(cfg, base) { // end-to-end proof: really renders one clip
  const t = Date.now();
  await renderClip(base, cfg.workflow, "slow push-in over a small matte low-poly house, soft ambient light, desaturated palette", 1, () => false);
  return Math.round((Date.now() - t) / 1000);
}
