// Settings live in this browser's localStorage. They can be exported to a file and re-imported.
import { readUrlParams } from "./urlSync.js";

const KEY = "cfg";
export const DEFAULTS = {
  engine: "",
  pro: false,
  localModel: "Qwen3.5-4B",
  geminiKey: "",
  comfyUrl: "",
  workflow: "",
  voiceProvider: "edge",
  voiceLang: "en",
  voiceId: "en-US-ChristopherNeural",
  elevenKey: "",
  stepByStep: false,
  maxMinutes: 180,
  maxShots: 0,
};

export const loadCfg = () => {
  try {
    const local = JSON.parse(localStorage.getItem(KEY) || "{}");
    const { cfg: urlCfg } = readUrlParams();
    return { ...DEFAULTS, ...local, ...urlCfg };
  } catch {
    return { ...DEFAULTS };
  }
};

export const saveCfg = (c) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {}
};

export function exportCfg(c, withKey) {
  const { geminiKey, ...rest } = c;
  return JSON.stringify({ app: "frameway", version: 1, ...rest, ...(withKey ? { geminiKey } : {}) }, null, 2);
}

export function parseCfg(text) {
  const o = JSON.parse(text);
  if (o.app !== "frameway" && o.app !== "ai-video-maker") throw new Error("This isn't a Frameway config file.");
  const { app, version, ...rest } = o;
  return { ...DEFAULTS, ...rest };
}
