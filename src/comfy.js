// Talking to a local ComfyUI: find it, check it, build/import the video workflow, render clips.
const E = import.meta.env ?? globalThis.process?.env ?? {};
const POLL = +E.VITE_POLL_MS || 2000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cands = (u) => {
  const list = [];
  if (u) {
    if (u === "http://127.0.0.1:8188" || u === "http://localhost:8188") list.push("/comfy");
    else if (u === "http://127.0.0.1:8000" || u === "http://localhost:8000") list.push("/comfy-8000");
    list.push(u);
  }
  list.push("/comfy", "/comfy-8000", E.VITE_COMFY_URL, "http://127.0.0.1:8188", "http://127.0.0.1:8000");
  return [...new Set(list.filter(Boolean))];
};

export async function detect(userUrl) {
  for (const base of cands(userUrl)) {
    try {
      const r = await fetch(`${base}/system_stats`);
      if (r.ok) {
        await r.json();
        return { base, state: "ok" };
      }
    } catch {
      // If direct fetch threw a CORS/network error, probe with no-cors to see if server is listening
      try {
        await fetch(`${base}/system_stats`, { mode: "no-cors" });
        return { base, state: "blocked" };
      } catch {
        continue;
      }
    }
  }
  return { base: "", state: "none" };
}

// Saved-workflow (UI format) -> API format, using the server's own node definitions.
export function uiToApi(ui, info) {
  if (ui.definitions?.subgraphs?.length) throw new Error("This workflow uses subgraphs, which can't be converted automatically.");
  const links = new Map((ui.links || []).map((l) => [l[0], l])), nodes = new Map(ui.nodes.map((n) => [n.id, n]));
  const resolve = (id) => {
    let l = links.get(id);
    for (let g = 0; l && g < 25; g++) {
      const o = nodes.get(l[1]); if (!o) return null;
      if (o.type === "Reroute") { const up = o.inputs?.[0]?.link; if (up == null) return null; l = links.get(up); continue; }
      if (o.type === "PrimitiveNode") return { value: o.widgets_values?.[0] };
      return [String(l[1]), l[2]];
    }
    return null;
  };
  const api = {};
  for (const n of ui.nodes) {
    if (["Note", "MarkdownNote", "Reroute", "PrimitiveNode"].includes(n.type) || n.mode === 2 || n.mode === 4) continue;
    const def = info[n.type]; if (!def) throw new Error(`Node "${n.type}" isn't installed in your ComfyUI.`);
    const linked = {}; for (const i of n.inputs || []) if (i.link != null) { const r = resolve(i.link); if (r) linked[i.name] = r; }
    const wv = n.widgets_values || [], inputs = {}; let w = 0;
    for (const [name, s] of Object.entries({ ...(def.input.required || {}), ...(def.input.optional || {}) })) {
      const t = s[0], o = s[1] || {};
      if (Array.isArray(t) || ["INT", "FLOAT", "STRING", "BOOLEAN", "COMBO"].includes(t)) {
        const v = linked[name]; inputs[name] = v ? (Array.isArray(v) ? v : v.value) : wv[w]; w++;
        if (t === "INT" && (o.control_after_generate || name === "seed" || name === "noise_seed")) w++; // the "randomize" slot
      } else if (linked[name] && Array.isArray(linked[name])) inputs[name] = linked[name];
    }
    api[String(n.id)] = { class_type: n.type, inputs };
  }
  return api;
}

// Puts {{PROMPT}} / "{{SEED}}" in automatically so nobody edits JSON by hand.
export function addPlaceholders(api) {
  const textNode = (id, d = 0) => { const n = api[id]; if (!n || d > 8) return null; if (typeof n.inputs?.text === "string") return id; for (const k of ["positive", "conditioning"]) if (Array.isArray(n.inputs?.[k])) { const r = textNode(n.inputs[k][0], d + 1); if (r) return r; } return null; };
  const neg = new Set(); for (const n of Object.values(api)) if (Array.isArray(n.inputs?.negative)) { const r = textNode(n.inputs.negative[0]); if (r) neg.add(r); }
  let target = null;
  for (const n of Object.values(api)) if (Array.isArray(n.inputs?.positive)) { target = textNode(n.inputs.positive[0]); if (target) break; }
  if (!target) target = Object.keys(api).find((id) => !neg.has(id) && typeof api[id].inputs?.text === "string" && /TextEncode/i.test(api[id].class_type));
  if (!target) throw new Error("Couldn't find the prompt text in this workflow. Use a text-to-video workflow.");
  api[target].inputs.text = "{{PROMPT}}";
  for (const n of Object.values(api)) for (const k of ["seed", "noise_seed"]) if (typeof n.inputs?.[k] === "number") n.inputs[k] = "{{SEED}}";
  return api;
}

export async function importWorkflow(text, base) {
  const j = JSON.parse(text); let api = j;
  if (Array.isArray(j.nodes)) {
    if (!base) throw new Error("Start ComfyUI first: converting a saved workflow needs its node list.");
    api = uiToApi(j, await (await fetch(`${base}/object_info`)).json());
  } else if (!Object.values(j).some((n) => n && n.class_type)) throw new Error("That doesn't look like a ComfyUI workflow.");
  return JSON.stringify(addPlaceholders(api));
}

export async function listVideoModels(base) {
  const found = [];
  for (const f of ["checkpoints", "diffusion_models", "unet"]) { try { found.push(...(await (await fetch(`${base}/models/${f}`)).json())); } catch {} }
  return found.filter((m) => /ltx|wan|hunyuan|mochi|cogvideo|svd/i.test(m));
}

export async function autoSetup(cfg) {
  const lines = []; const say = (ok, msg) => lines.push({ ok, msg });
  const d = await detect(cfg.comfyUrl);
  if (d.state === "none") { say(false, "ComfyUI not found. Open ComfyUI Desktop, then try again."); return { lines }; }
  if (d.state === "blocked") { say(false, "ComfyUI is running but blocks this page. In ComfyUI: Settings > Server Config > Enable CORS header = *, then restart it."); return { lines }; }
  say(true, `Connected to ComfyUI at ${d.base}.`);
  const video = await listVideoModels(d.base);
  if (!video.length) { say(false, "No video model installed yet. In ComfyUI open a text-to-video template (LTX or Wan) and let it download the models."); return { lines, url: d.base }; }
  say(true, `Video model found: ${video[0]}.`);
  if (cfg.workflow) { say(true, "Workflow already saved."); return { lines, url: d.base, workflow: cfg.workflow }; }
  const errs = [];
  try {
    const idx = await (await fetch(`${d.base}/templates/index.json`)).json(); const names = [];
    (function walk(x) { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === "object") { if (typeof x.name === "string") names.push(x.name); Object.values(x).forEach(walk); } })(idx);
    const fam = (video[0].match(/ltx|wan|hunyuan|mochi|cogvideo|svd/i) || [""])[0];
    const picks = [...names.filter((n) => new RegExp(fam, "i").test(n) && /t2v|text.?to.?video/i.test(n)), ...names.filter((n) => new RegExp(fam, "i").test(n) && /video/i.test(n))].slice(0, 3);
    for (const n of picks) {
      try { const wf = await importWorkflow(await (await fetch(`${d.base}/templates/${encodeURIComponent(n)}.json`)).text(), d.base); say(true, `Workflow built from template "${n}".`); return { lines, url: d.base, workflow: wf }; }
      catch (e) { errs.push(`${n}: ${e.message}`); }
    }
    if (!picks.length) errs.push("no matching template found");
  } catch { errs.push("templates not reachable"); }
  say(false, `Couldn't build the workflow automatically (${errs[0] || "unknown"}). Upload one instead.`);
  return { lines, url: d.base };
}

// Queue one clip on ComfyUI and wait for the file.
export async function renderClip(base, wfText, prompt, seed, stopped) {
  const wf = JSON.parse(wfText.split("{{PROMPT}}").join(JSON.stringify(prompt).slice(1, -1)).split('"{{SEED}}"').join(String(seed)));
  const r = await fetch(`${base}/prompt`, { method: "POST", body: JSON.stringify({ prompt: wf }) });
  if (!r.ok) throw new Error(`ComfyUI ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const { prompt_id } = await r.json();
  for (;;) {
    await sleep(POLL); if (stopped()) throw new Error("stopped");
    const h = (await (await fetch(`${base}/history/${prompt_id}`)).json())[prompt_id];
    if (h?.status?.status_str === "error") throw new Error("ComfyUI reported an error for this clip (see its window)");
    if (!h?.outputs || !h.status?.completed) continue;
    for (const o of Object.values(h.outputs)) for (const k of ["videos", "gifs", "images"]) for (const f of o[k] || [])
      if (/\.(mp4|webm|mov|gif|webp)$/i.test(f.filename)) return `${base}/view?filename=${encodeURIComponent(f.filename)}&subfolder=${encodeURIComponent(f.subfolder || "")}&type=${f.type || "output"}`;
    throw new Error("ComfyUI finished but produced no video file; the workflow needs a Save Video node");
  }
}
