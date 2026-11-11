import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { EdgeTTS } from "node-edge-tts";

function ttsPlugin() {
  const sampleCache = new Map();

  return {
    name: "tts-service",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const url = new URL(req.url, "http://localhost");

          // Voice audio sample preview
          if (url.pathname === "/api/tts-sample") {
            const voice = url.searchParams.get("voice") || "en-US-ChristopherNeural";
            const text = url.searchParams.get("text") || "The sequence begins with an unexpected reading logged at dawn.";

            if (sampleCache.has(voice)) {
              res.setHeader("Content-Type", "audio/mpeg");
              return res.end(sampleCache.get(voice));
            }

            const tts = new EdgeTTS({ voice });
            const chunks = [];
            for await (const chunk of tts.streamAudio(text)) {
              if (Buffer.isBuffer(chunk)) chunks.push(chunk);
            }
            const buf = Buffer.concat(chunks);
            sampleCache.set(voice, buf);
            res.setHeader("Content-Type", "audio/mpeg");
            return res.end(buf);
          }

          // Full TTS synthesis
          if (url.pathname === "/api/tts" && req.method === "POST") {
            let body = "";
            req.on("data", (chunk) => {
              body += chunk;
            });
            req.on("end", async () => {
              try {
                const { text, voice = "en-US-ChristopherNeural", provider = "edge", elevenKey } = JSON.parse(body || "{}");
                if (!text) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ error: "No text provided" }));
                }

                if (provider === "elevenlabs") {
                  if (!elevenKey) {
                    res.statusCode = 401;
                    return res.end(JSON.stringify({ error: "ElevenLabs API key is required" }));
                  }
                  const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "xi-api-key": elevenKey,
                    },
                    body: JSON.stringify({
                      text,
                      model_id: "eleven_multilingual_v2",
                      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
                    }),
                  });
                  if (!elevenRes.ok) {
                    const errText = await elevenRes.text();
                    res.statusCode = elevenRes.status;
                    return res.end(errText);
                  }
                  const arrayBuf = await elevenRes.arrayBuffer();
                  res.setHeader("Content-Type", "audio/mpeg");
                  return res.end(Buffer.from(arrayBuf));
                }

                // Default: Edge TTS
                const tts = new EdgeTTS({ voice });
                const chunks = [];
                for await (const chunk of tts.streamAudio(text)) {
                  if (Buffer.isBuffer(chunk)) chunks.push(chunk);
                }
                const buf = Buffer.concat(chunks);
                res.setHeader("Content-Type", "audio/mpeg");
                return res.end(buf);
              } catch (err) {
                res.statusCode = 500;
                return res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }

          next();
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), ttsPlugin()],
  server: {
    host: "localhost",
    port: 5174,
    strictPort: true,
    proxy: {
      "/comfy-8000": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/comfy-8000/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("origin", "http://127.0.0.1:8000");
          });
        },
      },
      "/comfy/": {
        target: "http://127.0.0.1:8188",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/comfy/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("origin", "http://127.0.0.1:8188");
          });
        },
      },
    },
  },
});
