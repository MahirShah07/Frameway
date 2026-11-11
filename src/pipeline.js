// The agent team: showrunner plans, scriptwriter writes, art director styles, cinematographer renders, narrator speaks, editor aligns.
import { detect, renderClip } from "./comfy.js";
import { THEMES, SUBJECTS, ACTIONS, MOODS, normalizeScene } from "./scene.js";
import { resolveLocalModelId } from "./localModels.js";

const STYLE = "minimalist low-poly 3d model, clean geometric shapes, soft studio lighting, clay render, muted desaturated palette, investigative documentary style, 4k cinematic";

const CH = 3, SHOT = 12, BATCH = 3;
let onProgress = () => {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hasGpu = () => !!navigator.gpu;
const hms = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s` : `${Math.floor(s)}s`);

async function retry(fn, n = 3) {
  let e;
  for (let i = 0; i < n; i++) {
    try { return await fn(); }
    catch (err) { e = err; await sleep(400 * 2 ** i); }
  }
  throw e;
}

// ---------- local WebLLM script model (browser WebGPU) ----------
let engine, loadedModelId;
const ENV = import.meta.env ?? globalThis.process?.env ?? {};

function parseJsonLoose(raw) {
  const cleaned = String(raw || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^```(?:json)?\s*|\s*```$/gi, "")
    .trim();
  return JSON.parse(cleaned);
}

function makeWebllm(cfg = {}) {
  return async (prompt) => {
    const adapter = await navigator.gpu.requestAdapter();
    const hasF16 = !!adapter?.features?.has("shader-f16");
    const id = resolveLocalModelId(cfg.localModel || ENV.VITE_WEBLLM_MODEL, hasF16);
    if (!engine || loadedModelId !== id) {
      if (engine?.unload) await engine.unload().catch(() => {});
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
      engine = await CreateMLCEngine(id, { initProgressCallback: (p) => onProgress(p.text || "") });
      loadedModelId = id;
    }
    const req = {
      messages: [{ role: "user", content: prompt + "\nRespond with valid JSON only." }],
      response_format: { type: "json_object" },
    };
    if (/^Qwen3/i.test(id)) req.extra_body = { enable_thinking: false };
    const r = await engine.chat.completions.create(req);
    return parseJsonLoose(r.choices[0].message.content);
  };
}

// ---------- Gemini API script model ----------
const GBASE = (import.meta.env ?? globalThis.process?.env ?? {}).VITE_GEMINI_BASE || "https://generativelanguage.googleapis.com";
async function callGemini(model, key, prompt) {
  const r = await fetch(`${GBASE}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
  });
  if (!r.ok) { const e = new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 160)}`); e.status = r.status; throw e; }
  const j = await r.json(); return JSON.parse(j.candidates[0].content.parts[0].text);
}
function makeGemini(cfg, ask) {
  let model = cfg.pro ? "gemini-2.5-pro" : "gemini-flash-latest";
  return async (prompt) => {
    try { return await callGemini(model, cfg.geminiKey, prompt); }
    catch (e) {
      if (model.includes("pro") && [403, 404, 429].includes(e.status) && ask && (await ask("Gemini Pro isn't available for your key right now. Use the fast Flash model instead?"))) { model = "gemini-flash-latest"; return callGemini(model, cfg.geminiKey, prompt); }
      throw e;
    }
  };
}
const LINES = ["The sequence begins with {t}.", "The first records show nothing unusual.", "Then, a small deviation is logged.", "No one at the time recognises its significance.", "Minutes later, the situation changes.", "Each decision narrows the options available.", "The records show what happened next, without comment.", "One question remains unanswered."];
const templateShots = (topic, chTitle, k, from) => Array.from({ length: k }, (_, j) => ({ stamp: `Entry ${from + j + 1}`, narration: LINES[(from + j) % LINES.length].replace("{t}", topic), visual: `${chTitle}: ${topic}`, scene: { action: ["approach", "cross", "still"][(from + j) % 3] } }));

// ---------- ComfyUI video ----------
let COMFY = "";
async function comfyReady(cfg) { const d = await detect(cfg.comfyUrl); COMFY = d.base; return d.state === "ok" && cfg.workflow ? cfg.workflow : null; }

// ---------- TTS Engine (Edge Studio Neural / ElevenLabs / Kokoro) ----------
let kokoro;
function wav(f32, rate) {
  const b = new DataView(new ArrayBuffer(44 + f32.length * 2)); const w = (o, s) => [...s].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); b.setUint32(4, 36 + f32.length * 2, true); w(8, "WAVEfmt "); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
  b.setUint32(24, rate, true); b.setUint32(28, rate * 2, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); w(36, "data"); b.setUint32(40, f32.length * 2, true);
  f32.forEach((v, i) => b.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 32767, true));
  return new Blob([b], { type: "audio/wav" });
}

export async function createSpeaker(cfg = {}, log = () => {}) {
  const provider = cfg.voiceProvider || "edge";
  const voice = cfg.voiceId || "en-US-ChristopherNeural";
  const elevenKey = cfg.elevenKey || "";

  if (provider === "kokoro") {
    try {
      if (!kokoro) {
        const { KokoroTTS } = await import("kokoro-js");
        kokoro = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", hasGpu() ? { dtype: "fp32", device: "webgpu" } : { dtype: "q8", device: "wasm" });
      }
      return async (text) => {
        const a = await kokoro.generate(text, { voice: voice.startsWith("en-") ? "bm_george" : voice });
        return wav(a.audio, a.sampling_rate);
      };
    } catch (e) {
      log("Narrator", "warn", `Kokoro failed (${e.message}); using fallback voice`);
      return async () => null;
    }
  }

  // Edge TTS or ElevenLabs via Vite server endpoint
  return async (text) => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice, provider, elevenKey }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `TTS status ${res.status}`);
      }
      return await res.blob();
    } catch (e) {
      log("Narrator", "warn", `TTS failed (${e.message}); fallback active`);
      return null;
    }
  };
}

export async function testVoice(cfg = {}) {
  let why = "";
  const speak = await createSpeaker(cfg, (a, s, m) => (why = m));
  const sample = cfg.voiceLang === "es" ? "Prueba de narración documental." : "Voice check. Documentary narration active.";
  const b = await speak(sample);
  if (!b) throw new Error(why || "Could not synthesize audio sample");
  return Math.round(b.size / 1024);
}

// Multilingual translation helper for spoken narration
const LANG_NAMES = {
  es: "Spanish", fr: "French", de: "German", it: "Italian",
  hi: "Hindi", ja: "Japanese", pt: "Portuguese", zh: "Chinese", ar: "Arabic",
};
async function translateForVoice(text, targetLang, chat) {
  if (!text || !targetLang || targetLang === "en") return text;
  const lang = LANG_NAMES[targetLang] || targetLang;
  if (chat) {
    try {
      const res = await chat(`Translate this documentary voiceover line into natural, fluent ${lang}. Return JSON {"translation": string}: "${text}"`);
      if (res && typeof res.translation === "string" && res.translation.trim().length > 1) {
        return res.translation.trim();
      }
      if (typeof res === "string" && res.trim().length > 1) {
        return res.replace(/^["']|["']$/g, "").trim();
      }
    } catch {}
  }
  return text;
}

export async function produce({
  topic,
  minutes,
  shots,
  saved,
  log,
  changed,
  stopped,
  llm,
  tts,
  cfg = {},
  ask,
  confirmScript,
  confirmShot,
}) {
  const seed = saved?.seed ?? Math.floor(Math.random() * 2 ** 31);
  const totalTarget = cfg.maxShots > 0 ? cfg.maxShots : Math.max(1, Math.round((minutes * 60) / SHOT));
  const n = Math.max(1, Math.min(totalTarget, Math.ceil(minutes / CH))), per = Math.round((CH * 60) / SHOT);
  const chat = llm || (cfg.engine === "gemini" ? (cfg.geminiKey ? makeGemini(cfg, ask) : null) : hasGpu() ? makeWebllm(cfg) : null);
  onProgress = (t) => log("Scriptwriter", "run", `Loading script model: ${t}`);
  let title = saved?.title;

  if (saved?.shots?.length) {
    shots.push(...saved.shots);
    log("Showrunner", "done", `Resumed "${title}"`);
    log("Scriptwriter", "done", `${shots.length} shots restored`);
  } else {
    if (!chat) log("Scriptwriter", "warn", cfg.engine === "gemini" ? "No Gemini key set: using a simple template script" : "No WebGPU here: using a simple template script");
    log("Showrunner", "run", `Planning ${n} chapters`);
    let o;
    try {
      if (!chat) throw new Error("no script model");
      o = await retry(async () => {
        const r = await chat(`You are showrunner of a cold, clinical investigative documentary channel. Topic: "${topic}". Structure it as a chronological case file: each chapter covers the next segment of the timeline, the last resolves it. Return JSON {"title":string,"chapters":[{"title":string,"summary":string}]} with exactly ${n} chapters.`);
        if (!r.chapters?.length) throw new Error("empty outline");
        return r;
      });
    } catch (e) {
      log("Showrunner", "warn", `Using a generic outline (${e.message})`);
      o = { title: topic, chapters: Array.from({ length: n }, (_, i) => ({ title: `Part ${i + 1}`, summary: `${topic}, part ${i + 1}` })) };
    }
    title = o.title || topic;
    const chapters = o.chapters.slice(0, n);
    log("Showrunner", "done", `"${title}"\n` + chapters.map((c, i) => `${i + 1}. ${c.title}`).join("\n"));
    log("Scriptwriter", "run", `0/${chapters.length} chapters`);
    let fell = 0, lastErr = "";

    for (let i = 0; i < chapters.length; i++) {
      if (stopped() || shots.length >= totalTarget) break;
      const remaining = totalTarget - shots.length;
      const want = Math.min(remaining, i === chapters.length - 1 ? remaining : per);
      let got = 0, prev = "";
      while (got < want) {
        const k = Math.min(BATCH, want - got);
        let ok;
        try {
          if (!chat) throw new Error("no model");
          const r = await retry(() => chat(`Write the next ${k} shots of chapter ${i + 1}/${chapters.length} "${chapters[i].title}" (${chapters[i].summary}) of the documentary "${title}". ${prev ? `The previous narration line was: "${prev}". Continue from it.` : "This opens the chapter."} Narrator is deadpan and unemotional, like an investigation report: precise facts, times, sequence, no filler. Return JSON {"shots":[{"stamp":string,"narration":string,"visual":string,"scene":{"theme":"${THEMES.join("|")}","subject":"${SUBJECTS.join("|")}","action":"${ACTIONS.join("|")}","mood":"${MOODS.join("|")}"}}]} with exactly ${k} shots. narration ~12 words. stamp is a short date/time/location label. visual is one short sentence describing the scene.`), 2);
          ok = (r.shots || []).filter((s) => typeof s.narration === "string" && s.narration.length > 3).slice(0, k);
          if (!ok.length) throw new Error("no usable shots");
        } catch (e) {
          fell++;
          lastErr = e.message;
          ok = templateShots(topic, chapters[i].title, k, shots.length);
        }
        ok.forEach((s) => shots.push({
          stamp: s.stamp || "",
          narration: s.narration,
          visual: s.visual || s.narration,
          id: shots.length,
          chapter: i,
          prompt: `${STYLE}. ${s.visual || s.narration}`,
          scene: normalizeScene(s.scene, `${s.visual || ""} ${s.narration} ${s.stamp || ""}`),
        }));
        got += ok.length;
        prev = ok[ok.length - 1].narration;
        changed();
      }
      log("Scriptwriter", "run", `${i + 1}/${chapters.length} chapters${fell ? ` (${fell} batches fell back to template text)` : ""}`);
    }
    log("Scriptwriter", fell ? "warn" : "done", `${shots.length} shots scripted${fell ? `; ${fell} batches used template text (${lastErr || "unusable model output"})` : ""}`);
    log("Art Director", "done", `Visual styles fixed: matte minimalist-3D look, English visual prompts & stamps`);
  }

  // Confirm script before proceeding
  if (confirmScript) {
    log("Showrunner", "run", "Script ready. Waiting for confirmation…");
    const ok = await confirmScript(shots, title);
    if (!ok || stopped()) {
      log("Showrunner", "warn", "Production paused / cancelled during script review.");
      return;
    }
    log("Showrunner", "done", `Script approved (${shots.length} shots). Rendering video and voice…`);
  }

  const total = shots.length, c = { clip: 0, voice: 0 };
  let made = 0, spent = 0;
  const wfText = await comfyReady(cfg);
  log("Cinematographer", "run", wfText ? "ComfyUI connected: rendering real AI video clips" : "Using the built-in animated scene studio");

  const persist = () => {
    try {
      localStorage.setItem("proj", JSON.stringify({ topic, minutes, title, seed, shots: shots.map(({ audio, _au, ...s }) => s) }));
    } catch {}
  };

  const upd = () => {
    const eta = wfText && made && c.clip < total ? ` · ~${hms(((spent / made) * (total - c.clip)) / 1000)} left` : "";
    log("Cinematographer", c.clip < total ? "run" : "done", `${c.clip}/${total} shots ${wfText ? "via ComfyUI" : "animated (built-in studio)"}${eta}`);
    log("Narrator", c.voice < total ? "run" : "done", `${c.voice}/${total} voice lines`);
    changed();
  };
  upd();

  log("Narrator", "run", `Synthesizing voices (${cfg.voiceLang || "en"})…`);
  const speak = tts || (await createSpeaker(cfg, log));

  const clipLane = (async () => {
    for (const s of shots) {
      if (stopped()) return;
      if (cfg.stepByStep && confirmShot) {
        const proceed = await confirmShot(s);
        if (!proceed) {
          log("Cinematographer", "warn", `Shot ${s.id + 1} skipped by user`);
          c.clip++;
          upd();
          continue;
        }
      }
      if (wfText && !s.videoUrl) {
        const t = Date.now();
        try {
          s.videoUrl = await retry(() => renderClip(COMFY, wfText, s.prompt, seed, stopped), 2);
          spent += Date.now() - t;
          made++;
        } catch (e) {
          if (e.message === "stopped") return;
          log("Cinematographer", "warn", `Shot ${s.id + 1}: AI clip failed (${e.message}); using the animated scene`);
        }
      }
      c.clip++;
      upd();
      if (c.clip % 5 === 0) persist();
    }
  })();

  const voiceLane = (async () => {
    for (const s of shots) {
      if (stopped()) return;
      try {
        // If voice language is not English, translate narration for the spoken audio,
        // while on-screen subtitles and visuals stay in English!
        const spokenText = await translateForVoice(s.narration, cfg.voiceLang, chat);
        s.audio = await retry(() => speak(spokenText), 2);
      } catch {
        s.audio = null;
      }
      c.voice++;
      upd();
    }
  })();

  await Promise.all([clipLane, voiceLane]);
  persist();
  if (!stopped()) log("Editor", "done", `All ${total} shots ready: played in order in the player`);
}
