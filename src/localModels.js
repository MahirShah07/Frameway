export const LOCAL_MODELS = [
  {
    id: "Qwen3.5-4B",
    name: "Qwen 3.5 4B",
    size: "~3.9 GB",
    desc: "Recommended · Sharp reasoning, reliable JSON & multilingual writing",
    f16: "Qwen3.5-4B-q4f16_1-MLC",
    f32: "Qwen3.5-4B-q4f32_1-MLC",
  },
  {
    id: "Qwen3.5-9B",
    name: "Qwen 3.5 9B",
    size: "~6.4 GB",
    desc: "Highest quality · Flagship 9B narrative & translation (16 GB+ RAM)",
    f16: "Qwen3.5-9B-q4f16_1-MLC",
    f32: "Qwen3.5-9B-q4f32_1-MLC",
  },
  {
    id: "Qwen2.5-7B",
    name: "Qwen 2.5 7B",
    size: "~5.1 GB",
    desc: "Pro writing · Fast, rock-solid JSON & factual storytelling",
    f16: "Qwen2.5-7B-Instruct-q4f16_1-MLC",
    f32: "Qwen2.5-7B-Instruct-q4f32_1-MLC",
  },
  {
    id: "Llama-3.1-8B",
    name: "Llama 3.1 8B",
    size: "~5.0 GB",
    desc: "Meta 8B Instruct · Crisp English documentary prose",
    f16: "Llama-3.1-8B-Instruct-q4f16_1-MLC",
    f32: "Llama-3.1-8B-Instruct-q4f32_1-MLC",
  },
  {
    id: "Gemma-2-9B",
    name: "Gemma 2 9B",
    size: "~6.4 GB",
    desc: "Google 9B Instruct · Rich editorial & creative tone",
    f16: "gemma-2-9b-it-q4f16_1-MLC",
    f32: "gemma-2-9b-it-q4f32_1-MLC",
  },
  {
    id: "Qwen2.5-3B",
    name: "Qwen 2.5 3B",
    size: "~2.5 GB",
    desc: "Fast & sharp · Strong lightweight JSON & multilingual support",
    f16: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    f32: "Qwen2.5-3B-Instruct-q4f32_1-MLC",
  },
  {
    id: "Llama-3.2-3B",
    name: "Llama 3.2 3B",
    size: "~2.3 GB",
    desc: "Compact · Classic lightweight Llama 3B",
    f16: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    f32: "Llama-3.2-3B-Instruct-q4f32_1-MLC",
  },
  {
    id: "Llama-3.2-1B",
    name: "Llama 3.2 1B",
    size: "~1.1 GB",
    desc: "Lightest · Fastest download for lower-memory GPUs",
    f16: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    f32: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
  },
];

export const DEFAULT_LOCAL_MODEL = "Qwen3.5-4B";

export function getLocalModel(id) {
  return LOCAL_MODELS.find((m) => m.id === id) || LOCAL_MODELS[0];
}

export function resolveLocalModelId(choice, hasF16) {
  if (typeof choice === "string" && choice.endsWith("-MLC")) return choice;
  const m = getLocalModel(choice);
  return hasF16 ? m.f16 : m.f32;
}
