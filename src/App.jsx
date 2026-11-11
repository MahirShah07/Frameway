import { useCallback, useEffect, useRef, useState } from "react";
import { produce, createSpeaker } from "./pipeline.js";
import { drawScene } from "./scene.js";
import { loadCfg, saveCfg, exportCfg, parseCfg } from "./config.js";
import { autoSetup, importWorkflow, detect } from "./comfy.js";
import { verifyScript, verifyComfy, testClip, testVoice } from "./verify.js";
import { LANGUAGES, DEFAULT_VOICE_ID, getVoicesForLang } from "./voices.js";
import { LOCAL_MODELS, getLocalModel } from "./localModels.js";
import { readUrlParams, writeUrlParams } from "./urlSync.js";

const AGENTS = ["Showrunner", "Scriptwriter", "Art Director", "Cinematographer", "Narrator", "Editor"];
const fmt = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? " " + (m % 60) + " min" : ""}` : `${m} min`);
const audioUrl = (s) => (s._au ||= URL.createObjectURL(s.audio));
const readFile = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(f); });
const GLYPH = { ok: "✓", warn: "!", fail: "✕", idle: "", busy: "" };

function Row({ c, children }) {
  return (
    <div className="row">
      <span className={"badge " + c.state}>{c.state === "busy" ? <i className="spin" /> : GLYPH[c.state]}</span>
      <div className="grow"><div className="t">{c.title}</div><div className="s">{c.msg}{c.fix && c.state !== "ok" ? <> <em>{c.fix}</em></> : null}</div></div>
      {children}
    </div>
  );
}
const Switch = ({ on, set }) => <label className="switch"><input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} /><span /></label>;

function AppleDropdown({ value, options, onChange, label }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);

  const selected = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, value, options]);

  const selectAt = (idx) => {
    const opt = options[idx];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectAt(activeIndex);
    }
  };

  return (
    <div className="apple-dd" ref={wrapRef} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className={"apple-dd-trigger" + (open ? " open" : "")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="apple-dd-val">
          {selected.prefix && <span className="apple-dd-flag">{selected.prefix}</span>}
          <span>{selected.label}</span>
        </span>
        <svg className="apple-dd-chev" width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden="true">
          <path d="M2.5 5L6 1.5L9.5 5M2.5 9L6 12.5L9.5 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="apple-dd-menu" role="listbox" aria-label={label}>
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isHighlighted = idx === activeIndex;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={"apple-dd-item" + (isSelected ? " selected" : "") + (isHighlighted ? " active" : "")}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => selectAt(idx)}
              >
                <span className="apple-dd-check" aria-hidden="true">{isSelected ? "✓" : ""}</span>
                {opt.prefix && <span className="apple-dd-flag">{opt.prefix}</span>}
                <span className="apple-dd-lbl">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SceneView({ spec, playing }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current, c = cv.getContext("2d"); let raf, t0 = performance.now();
    const frame = (now) => { drawScene(c, spec, playing ? (now - t0) / 1000 : 1.2, cv.width, cv.height); if (playing) raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame); return () => cancelAnimationFrame(raf);
  }, [spec, playing]);
  return <canvas ref={ref} width={1280} height={720} className="fill" />;
}

function Player({ shots, tick }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const au = useRef(null);
  const s = shots[i];
  const ready = !!(s && (s.videoUrl || s.scene) && s.audio !== undefined);
  useEffect(() => {
    if (!playing || !ready) return;
    const a = au.current; let moved = false;
    const next = () => { if (!moved) { moved = true; setI((x) => Math.min(x + 1, shots.length)); } };
    const words = s.narration.split(/\s+/).length;
    if (s.audio) { a.src = audioUrl(s); a.onended = next; a.onerror = () => setTimeout(next, 3000); a.play().catch(() => {}); }
    else if ("speechSynthesis" in window) { const u = new SpeechSynthesisUtterance(s.narration); u.rate = 1.05; u.pitch = 0.8; u.onend = next; speechSynthesis.cancel(); speechSynthesis.speak(u); }
    const fallback = setTimeout(next, s.audio ? 600000 : (words / 1.8 + 3) * 1000);
    return () => { moved = true; clearTimeout(fallback); a.pause(); if (!s.audio) speechSynthesis?.cancel(); };
  }, [i, playing, ready]);
  if (i >= shots.length && shots.length) return <section className="card center"><img src="/logo.png" alt="Frameway" className="end-logo" /><p>The end.</p><button className="btn ghost" onClick={() => { setI(0); setPlaying(false); }}>Watch again</button></section>;
  const upcoming = [1, 2].map((k) => shots[i + k]).filter((x) => x?.videoUrl);
  const media = ready && s.videoUrl ? (/\.(gif|webp)/i.test(s.videoUrl) ? <img key={s.id} src={s.videoUrl} className="fill" /> : <video key={s.id} src={s.videoUrl} autoPlay={playing} muted loop playsInline className="fill" />) : ready ? <SceneView key={s.id} spec={s.scene} playing={playing} /> : <div className="wait"><div className="stage-wait"><img src="/logo.png" alt="" className="stage-logo" /><span>{shots.length ? `Rendering shot ${i + 1}…` : "Waiting for the script…"}</span></div></div>;
  return (
    <section className="card">
      <div className="stage">{media}{ready && s.stamp && <div className="stamp">{s.stamp}</div>}{ready && <div className="cap">{s.narration}</div>}</div>
      <div style={{ display: "none" }}>{upcoming.map((u) => <video key={u.id} src={u.videoUrl} preload="auto" muted />)}</div>
      <audio ref={au} />
      <div className="bar"><button className="btn" onClick={() => setPlaying(!playing)}>{playing ? "Pause" : "Play"}</button><span className="s">{shots.filter((x) => (x.videoUrl || x.scene) && x.audio !== undefined).length} of {shots.length} shots ready</span></div>
    </section>
  );
}

export default function App() {
  const urlInitial = useRef(readUrlParams()).current;
  const [cfg, setCfg] = useState(() => ({ ...loadCfg(), ...urlInitial.cfg }));
  const [topic, setTopic] = useState(() => urlInitial.topic || "");
  const [minutes, setMinutes] = useState(() => urlInitial.minutes ?? 2);
  const [logs, setLogs] = useState({});
  const [open, setOpen] = useState({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [run, setRun] = useState(0);
  const [sheet, setSheet] = useState(() => !!urlInitial.sheet);
  const [script, setScript] = useState({ id: "script", title: "Script", state: "busy", msg: "Checking…" });
  const [comfy, setComfy] = useState(null);
  const [voice, setVoice] = useState({ id: "voice", title: "Narrator voice", state: "idle", msg: "Studio voices ready. Click Test to verify." });
  const [e2e, setE2e] = useState({ id: "e2e", title: "End-to-end test", state: "idle", msg: "Renders one real clip to prove everything works." });
  const [note, setNote] = useState("");
  const [withKey, setWithKey] = useState(false);

  // Script confirmation and audio preview states
  const [scriptReview, setScriptReview] = useState(null);
  const [pendingShot, setPendingShot] = useState(null);
  const [sampleVoiceId, setSampleVoiceId] = useState(null);
  const sampleAudio = useRef(null);
  const sampleBlobUrl = useRef(null);

  const shots = useRef([]);
  const stop = useRef(false);
  const up = (patch) => setCfg((c) => ({ ...c, ...patch }));

  const checkScript = useCallback(() => { setScript((s) => ({ ...s, state: "busy", msg: "Checking…" })); verifyScript(cfg).then(setScript); }, [cfg.engine, cfg.geminiKey, cfg.pro, cfg.localModel]);
  const checkComfy = useCallback(() => verifyComfy(cfg).then(setComfy), [cfg.comfyUrl, cfg.workflow]);

  // Sync to localStorage and URL search params
  useEffect(() => { saveCfg(cfg); }, [cfg]);
  useEffect(() => {
    writeUrlParams({ cfg, topic, minutes, sheet });
  }, [cfg, topic, minutes, sheet]);

  // Support browser Back and Forward navigation
  useEffect(() => {
    const onPop = () => {
      const u = readUrlParams();
      setCfg((c) => ({ ...c, ...u.cfg }));
      if (u.topic !== undefined) setTopic(u.topic);
      if (u.minutes !== undefined) setMinutes(u.minutes);
      setSheet(!!u.sheet);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => { if (cfg.engine) { const t = setTimeout(checkScript, 400); return () => clearTimeout(t); } }, [checkScript, cfg.engine]);
  useEffect(() => { checkComfy(); const t = setInterval(checkComfy, sheet ? 3000 : 15000); return () => clearInterval(t); }, [checkComfy, sheet]);
  useEffect(() => () => {
    stop.current = true;
    sampleAudio.current?.pause();
  }, []);

  const log = (a, st, d) => setLogs((l) => ({ ...l, [a]: { status: st, detail: d, trail: [...(l[a]?.trail || []).slice(-150), d] } }));

  async function playVoiceSample(v) {
    if (sampleVoiceId === v.id) {
      sampleAudio.current?.pause();
      setSampleVoiceId(null);
      return;
    }
    if (!sampleAudio.current) {
      sampleAudio.current = new Audio();
      sampleAudio.current.onended = () => setSampleVoiceId(null);
      sampleAudio.current.onerror = () => setSampleVoiceId(null);
    }
    if (sampleBlobUrl.current) {
      URL.revokeObjectURL(sampleBlobUrl.current);
      sampleBlobUrl.current = null;
    }
    setSampleVoiceId(v.id);
    setErr("");

    try {
      if (v.provider === "edge") {
        sampleAudio.current.src = `/api/tts-sample?voice=${encodeURIComponent(v.id)}&text=${encodeURIComponent(v.sampleText)}`;
        await sampleAudio.current.play();
        return;
      }
      if (v.provider === "elevenlabs" && !cfg.elevenKey) {
        setErr("Enter an API key above to preview this voice.");
        setSampleVoiceId(null);
        return;
      }
      const speak = await createSpeaker({ voiceProvider: v.provider, voiceId: v.id, elevenKey: cfg.elevenKey });
      const blob = await speak(v.sampleText);
      if (!blob) throw new Error("Could not play voice sample");
      sampleBlobUrl.current = URL.createObjectURL(blob);
      sampleAudio.current.src = sampleBlobUrl.current;
      await sampleAudio.current.play();
    } catch (e) {
      setErr(e.message || "Could not play voice sample");
      setSampleVoiceId(null);
    }
  }

  async function create() {
    setErr(""); setLogs({}); stop.current = false; setBusy(true); shots.current = []; setRun((x) => x + 1);
    let saved = null;
    try {
      const p = JSON.parse(localStorage.getItem("proj"));
      if (p?.topic === topic && p.minutes === minutes) saved = p;
    } catch {}

    const confirmScript = (st, t) => new Promise((resolve) => {
      setScriptReview({
        title: t,
        shots: st.map((x) => ({ ...x })),
        resolve: (approvedShots) => {
          if (approvedShots) {
            shots.current.splice(0, shots.current.length, ...approvedShots);
            setTick((t) => t + 1);
            resolve(true);
          } else {
            resolve(false);
          }
          setScriptReview(null);
        },
      });
    });

    const confirmShot = (s) => new Promise((resolve) => {
      setPendingShot({
        shot: s,
        resolve: (proceed) => {
          setPendingShot(null);
          resolve(proceed);
        },
      });
    });

    try {
      await produce({
        topic,
        minutes,
        shots: shots.current,
        saved,
        cfg,
        log,
        ask: async (m) => window.confirm(m),
        confirmScript,
        confirmShot: cfg.stepByStep ? confirmShot : null,
        changed: () => setTick((t) => t + 1),
        stopped: () => stop.current,
      });
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  async function connect() {
    setNote("Connecting…"); const r = await autoSetup(cfg);
    if (r.url) up({ comfyUrl: r.url }); if (r.workflow) up({ workflow: r.workflow });
    setNote(r.lines.map((l) => l.msg).join(" ")); checkComfy();
  }
  async function uploadWorkflow(f) {
    if (!f) return;
    try { const d = await detect(cfg.comfyUrl); up({ workflow: await importWorkflow(await readFile(f), d.base), comfyUrl: d.base || cfg.comfyUrl }); setNote("Workflow imported and saved."); }
    catch (e) { setNote(e.message); }
  }
  async function runVoice() {
    setVoice((v) => ({ ...v, state: "busy", msg: "Testing selected voice…" }));
    try {
      const kb = await testVoice(cfg);
      setVoice((v) => ({ ...v, state: "ok", msg: `Studio voice connected (${kb} KB sample).` }));
    } catch (e) {
      setVoice((v) => ({ ...v, state: "warn", msg: e.message }));
    }
  }
  async function runE2e() {
    setE2e((v) => ({ ...v, state: "busy", msg: "Rendering a test clip… this can take a few minutes." }));
    try { const s = await testClip(cfg, comfy.base); setE2e((v) => ({ ...v, state: "ok", msg: `A real clip rendered in ${s}s. Everything works.` })); } catch (e) { setE2e((v) => ({ ...v, state: "fail", msg: e.message })); }
  }
  function download() { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([exportCfg(cfg, withKey)], { type: "application/json" })); a.download = "frameway-config.json"; a.click(); }
  async function uploadCfg(f) { if (!f) return; try { setCfg(parseCfg(await readFile(f))); setNote("Config restored."); } catch (e) { setNote(e.message); } }

  const aiVideo = comfy?.ready, scriptOk = script.state === "ok";
  const pill = !scriptOk && script.state !== "busy" ? ["warn", "Needs attention"] : ["ok", aiVideo ? "Ready · AI video" : "Ready · Animated scenes"];

  if (!cfg.engine) return (
    <main className="narrow">
      <img src="/logo.png" alt="Frameway" className="hero-logo" />
      <h1>Frameway</h1><p className="lead">How should the script be written?</p>
      <section className="card list">
        <button className="row tap" onClick={() => up({ engine: "gemini" })}><div className="grow"><div className="t">Gemini</div><div className="s">Fast. No download. Needs a free API key.</div></div><span className="chev">›</span></button>
        <button className="row tap" onClick={() => up({ engine: "webllm" })}><div className="grow"><div className="t">On-device</div><div className="s">Private. Runs Qwen 3.5, Llama 3.1, or Gemma 2 locally via WebGPU.</div></div><span className="chev">›</span></button>
      </section>
    </main>
  );

  const availableVoices = getVoicesForLang(cfg.voiceLang || "en", cfg.voiceProvider || "edge");
  const maxMins = Math.max(1, cfg.maxMinutes || 180);
  const selectedLocal = getLocalModel(cfg.localModel);
  const localModelOpts = LOCAL_MODELS.map((m) => ({ value: m.id, label: `${m.name} · ${m.size}` }));

  return (
    <>
      <nav>
        <div className="brand">
          <img src="/logo.png" alt="Frameway" className="brand-icon" />
          <b>Frameway</b>
        </div>
        <button className={"status " + pill[0]} onClick={() => setSheet(true)}>
          <i />{pill[1]}
        </button>
      </nav>
      <main>
        <h1>Make a documentary.</h1>
        <p className="lead">Describe it. The agents do the rest.</p>
        <section className="card">
          <input className="field" placeholder="What is it about?" value={topic} onChange={(e) => setTopic(e.target.value)} />

          {cfg.engine === "webllm" && (
            <div className="local-model-bar">
              <div className="local-model-meta">
                <span className="local-model-lbl">Local model</span>
                <span className="local-model-desc">{selectedLocal.desc}</span>
              </div>
              <AppleDropdown
                label="Local script model"
                value={selectedLocal.id}
                options={localModelOpts}
                onChange={(id) => up({ localModel: id })}
              />
            </div>
          )}

          <div className="length-block">
            <div className="slider">
              <span>Length</span>
              <div className="length-manual">
                <input
                  type="number"
                  className="limit-num"
                  min={1}
                  aria-label="Length in minutes"
                  value={minutes}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                    setMinutes(val);
                    if (val > maxMins) up({ maxMinutes: val });
                  }}
                />
                <span className="limit-unit">min{minutes >= 60 ? ` (${fmt(minutes)})` : ""}</span>
              </div>
            </div>
            <input
              type="range"
              min="1"
              max={maxMins}
              value={Math.min(minutes, maxMins)}
              onChange={(e) => setMinutes(+e.target.value)}
            />
            <div className="limits-row">
              <label className="limit-pill">
                <span>Max length</span>
                <input
                  type="number"
                  className="limit-num sm"
                  min={1}
                  value={maxMins}
                  onChange={(e) => {
                    const m = Math.max(1, parseInt(e.target.value, 10) || 180);
                    up({ maxMinutes: m });
                  }}
                />
                <span>min</span>
              </label>
              <label className="limit-pill">
                <span>Max shots</span>
                <input
                  type="number"
                  className="limit-num sm"
                  min={0}
                  placeholder="Auto"
                  value={cfg.maxShots > 0 ? cfg.maxShots : ""}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    const s = raw === "" ? 0 : Math.max(1, parseInt(raw, 10) || 0);
                    up({ maxShots: s });
                  }}
                />
              </label>
            </div>
          </div>

          <div className="voice-section">
            <div className="lang-bar">
              <AppleDropdown
                label="Voice Language"
                value={cfg.voiceLang || "en"}
                options={LANGUAGES.map((l) => ({ value: l.id, prefix: l.flag, label: l.name }))}
                onChange={(l) => {
                  const prov = cfg.voiceProvider || "edge";
                  const matching = getVoicesForLang(l, prov);
                  const nextId = matching[0]?.id || (l === "en" ? DEFAULT_VOICE_ID : getVoicesForLang(l, "edge")[0]?.id);
                  up({ voiceLang: l, voiceId: nextId });
                }}
              />

              <div className="engine-seg" role="group" aria-label="Voice provider">
                <button
                  type="button"
                  className={(cfg.voiceProvider || "edge") === "edge" ? "on" : ""}
                  aria-label="Edge"
                  title="Edge"
                  onClick={() => {
                    const matching = getVoicesForLang(cfg.voiceLang || "en", "edge");
                    up({ voiceProvider: "edge", voiceId: matching[0]?.id || DEFAULT_VOICE_ID });
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M21 12.2c0-4.9-4-8.7-9-8.7-4.5 0-8.2 3.2-8.9 7.5 1.1-1.3 3.1-2.1 5.6-2.1 3.7 0 6.5 1.8 6.5 4.4 0 1.4-.9 2.6-2.4 3.4-.5.3-.3 1 .2 1.1 3.9.4 8-1.9 8-5.6Z" fill="currentColor" opacity=".88" />
                    <path d="M3.1 12.9c.5 4.3 4.2 7.6 8.8 7.6 2.5 0 4.8-1 6.4-2.6-2 .5-4.3.2-6-.9-2.2-1.4-2.8-4.1-1.4-6.2.4-.6.1-1.3-.6-1.4-3.2-.5-6.6 1-7.2 3.5Z" fill="currentColor" opacity=".6" />
                  </svg>
                </button>

                <button
                  type="button"
                  className={cfg.voiceProvider === "elevenlabs" ? "on" : ""}
                  aria-label="ElevenLabs"
                  title="ElevenLabs"
                  onClick={() => {
                    const matching = getVoicesForLang(cfg.voiceLang || "en", "elevenlabs");
                    up({ voiceProvider: "elevenlabs", voiceId: matching[0]?.id || "pNInz6obpgDQGcFmaJgB" });
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <rect x="6.5" y="4.5" width="4" height="15" rx="1.2" />
                    <rect x="13.5" y="4.5" width="4" height="15" rx="1.2" />
                  </svg>
                </button>

                <button
                  type="button"
                  className={cfg.voiceProvider === "kokoro" ? "on" : ""}
                  aria-label="Kokoro"
                  title="Kokoro"
                  onClick={() => up({ voiceProvider: "kokoro", voiceId: "bm_george" })}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 20.5s-7.5-4.8-9.3-9.3C1.4 8 3.4 4.5 7 4.5c2 0 3.7 1.1 5 2.7 1.3-1.6 3-2.7 5-2.7 3.6 0 5.6 3.5 4.3 6.7-1.8 4.5-9.3 9.3-9.3 9.3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M7.5 12h2l1.3-2.8 2.2 5.4 1.5-2.6h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

            {cfg.voiceProvider === "elevenlabs" && (
              <div className="eleven-box">
                <input
                  className="field plain"
                  type="password"
                  placeholder="API Key"
                  value={cfg.elevenKey || ""}
                  onChange={(e) => up({ elevenKey: e.target.value.trim() })}
                />
              </div>
            )}

            <div className="voice-list">
              {availableVoices.map((v) => {
                const selected = cfg.voiceId === v.id;
                const isPlaying = sampleVoiceId === v.id;
                return (
                  <div
                    key={v.id}
                    className={"voice-card" + (selected ? " active" : "")}
                    onClick={() => up({ voiceId: v.id, voiceProvider: v.provider })}
                  >
                    <div className="voice-info">
                      <div className="voice-name">
                        <b>{v.name}</b>
                        <span className="voice-badge">{v.gender}</span>
                      </div>
                      <div className="voice-desc">{v.desc}</div>
                    </div>
                    <button
                      type="button"
                      className={"sample-btn" + (isPlaying ? " playing" : "")}
                      title="Listen to sample audio"
                      onClick={(e) => {
                        e.stopPropagation();
                        playVoiceSample(v);
                      }}
                    >
                      {isPlaying ? "⏹ Stop" : "▶ Sample"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <button className="btn wide" disabled={busy || !topic.trim()} onClick={create}>
            {busy ? "Working…" : "Create video"}
          </button>
          {busy && <button className="btn ghost wide" onClick={() => (stop.current = true)}>Stop</button>}
          {err && <p className="err">{err}</p>}
        </section>

        {run > 0 && <Player key={run} shots={shots.current} tick={tick} />}

        {AGENTS.some((a) => logs[a]) && (
          <section className="card list">
            {AGENTS.filter((a) => logs[a]).map((a) => {
              const l = logs[a];
              return (
                <div key={a}>
                  <button className="row tap" onClick={() => setOpen({ ...open, [a]: !open[a] })}>
                    <span className={"badge " + (l.status === "done" ? "ok" : l.status === "run" ? "busy" : l.status === "err" ? "fail" : "warn")}>
                      {l.status === "run" ? <i className="spin" /> : l.status === "done" ? "✓" : l.status === "err" ? "✕" : "!"}
                    </span>
                    <div className="grow"><div className="t">{a}</div><div className="s">{l.detail.split("\n")[0].slice(0, 70)}</div></div>
                    <span className={"chev" + (open[a] ? " up" : "")}>›</span>
                  </button>
                  {open[a] && <pre>{l.trail.join("\n\n")}</pre>}
                </div>
              );
            })}
          </section>
        )}
      </main>

      {/* Script Review Modal (Confirm script before proceeding) */}
      {scriptReview && (
        <div className="backdrop">
          <div className="sheet script-sheet">
            <div className="sheethead">
              <div className="brand">
                <img src="/logo.png" alt="Frameway" className="brand-icon" />
                <div>
                  <b>Confirm Script: &ldquo;{scriptReview.title}&rdquo;</b>
                  <div className="s">{scriptReview.shots.length} shots planned. Review and edit text before generating.</div>
                </div>
              </div>
              <button className="btn ghost small" onClick={() => scriptReview.resolve(null)}>Cancel</button>
            </div>

            <div className="script-list">
              {scriptReview.shots.map((s, idx) => (
                <div key={idx} className="shot-card">
                  <div className="shot-head">
                    <span className="shot-idx">Shot {idx + 1}</span>
                    <input
                      className="field plain shot-stamp"
                      value={s.stamp || ""}
                      placeholder="Entry stamp (e.g. Entry 1 - 06:14)"
                      onChange={(e) => {
                        const updated = [...scriptReview.shots];
                        updated[idx] = { ...updated[idx], stamp: e.target.value };
                        setScriptReview({ ...scriptReview, shots: updated });
                      }}
                    />
                  </div>
                  <label className="field-lbl">Narration (Spoken Voice):</label>
                  <textarea
                    className="field shot-txt"
                    rows={2}
                    value={s.narration || ""}
                    onChange={(e) => {
                      const updated = [...scriptReview.shots];
                      updated[idx] = { ...updated[idx], narration: e.target.value };
                      setScriptReview({ ...scriptReview, shots: updated });
                    }}
                  />
                  <label className="field-lbl">Visual Scene Prompt (English for ComfyUI / Canvas):</label>
                  <textarea
                    className="field shot-txt"
                    rows={2}
                    value={s.visual || ""}
                    onChange={(e) => {
                      const updated = [...scriptReview.shots];
                      updated[idx] = { ...updated[idx], visual: e.target.value };
                      setScriptReview({ ...scriptReview, shots: updated });
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="confirm-footer">
              <label className="step-toggle">
                <input
                  type="checkbox"
                  checked={!!cfg.stepByStep}
                  onChange={(e) => up({ stepByStep: e.target.checked })}
                />
                <span>Confirm each clip individually during rendering</span>
              </label>
              <button
                className="btn wide"
                onClick={() => scriptReview.resolve(scriptReview.shots)}
              >
                Approve &amp; Start Video Generation ({scriptReview.shots.length} shots)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step-by-step confirmation modal (if enabled) */}
      {pendingShot && (
        <div className="backdrop">
          <div className="card pending-modal">
            <div className="t">Approve Shot {pendingShot.shot.id + 1} for Rendering</div>
            <div className="s">{pendingShot.shot.stamp}</div>
            <p className="shot-preview-txt">&ldquo;{pendingShot.shot.narration}&rdquo;</p>
            <div className="s">Visual Prompt: {pendingShot.shot.prompt}</div>
            <div className="bar" style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => pendingShot.resolve(true)}>Render this clip</button>
              <button className="btn ghost" onClick={() => pendingShot.resolve(false)}>Skip clip</button>
            </div>
          </div>
        </div>
      )}

      {/* Setup & Verification Sheet */}
      {sheet && (
        <div className="backdrop" onClick={() => setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheethead"><div className="brand"><img src="/logo.png" alt="Frameway" className="brand-icon sm" /><b>Setup &amp; verification</b></div><button className="btn" onClick={() => setSheet(false)}>Done</button></div>

            <h3>Script</h3>
            <section className="card list">
              <div className="row"><div className="seg"><button className={cfg.engine === "gemini" ? "on" : ""} onClick={() => up({ engine: "gemini" })}>Gemini</button><button className={cfg.engine === "webllm" ? "on" : ""} onClick={() => up({ engine: "webllm" })}>On-device</button></div></div>
              {cfg.engine === "gemini" && (
                <>
                  <div className="row"><input className="field plain" type="password" placeholder="Gemini API key" value={cfg.geminiKey} onChange={(e) => up({ geminiKey: e.target.value.trim() })} /></div>
                  <div className="row"><div className="grow"><div className="t">Use Pro</div><div className="s">Better writing, slower. May need a paid key.</div></div><Switch on={cfg.pro} set={(v) => up({ pro: v })} /></div>
                </>
              )}
              {cfg.engine === "webllm" && (
                <div className="row">
                  <div className="grow">
                    <div className="t">Local model</div>
                    <div className="s">{selectedLocal.desc}</div>
                  </div>
                  <AppleDropdown
                    label="Local script model"
                    value={selectedLocal.id}
                    options={localModelOpts}
                    onChange={(id) => up({ localModel: id })}
                  />
                </div>
              )}
              <Row c={script}><button className="btn small ghost" onClick={checkScript}>Verify</button></Row>
            </section>

            <h3>Voice Engine</h3>
            <section className="card list">
              <Row c={voice}>
                <button className="btn small ghost" disabled={voice.state === "busy"} onClick={runVoice}>Test</button>
              </Row>
            </section>

            <h3>Real AI video · ComfyUI <span className="opt">optional</span></h3>
            <section className="card list">
              {(comfy?.checks || []).map((c) => <Row key={c.id} c={c} />)}
              <Row c={e2e}><button className="btn small ghost" disabled={!comfy?.ready || e2e.state === "busy"} onClick={runE2e}>Run test</button></Row>
              <div className="row actions">
                <a className="btn small ghost" href="https://comfy.org/download" target="_blank" rel="noreferrer">Get ComfyUI</a>
                <button className="btn small" onClick={connect}>Connect</button>
                <label className="btn small ghost">Upload workflow<input type="file" accept=".json" hidden onChange={(e) => uploadWorkflow(e.target.files[0])} /></label>
              </div>
              {comfy && !comfy.ready && (
                <ol className="guide">
                  <li>Install and open ComfyUI Desktop. This page connects automatically through Vite.</li>
                  <li>Open a text-to-video template (LTX or Wan), let it download models, run it once.</li>
                  <li>Press Connect. If it can&rsquo;t build the workflow itself, upload one you saved from ComfyUI.</li>
                </ol>
              )}
            </section>

            <h3>Backup</h3>
            <section className="card list">
              <div className="row actions"><button className="btn small ghost" onClick={download}>Download config</button><label className="btn small ghost">Upload config<input type="file" accept=".json" hidden onChange={(e) => uploadCfg(e.target.files[0])} /></label></div>
              <div className="row"><div className="grow"><div className="t">Include API key</div><div className="s">Off by default. The file would contain your key.</div></div><Switch on={withKey} set={setWithKey} /></div>
            </section>
            {note && <p className="note">{note}</p>}
          </div>
        </div>
      )}
    </>
  );
}
