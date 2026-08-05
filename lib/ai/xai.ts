import type { WeekSummary } from "@/lib/logic/week-summary";

const XAI_URL = "https://api.x.ai/v1/chat/completions";
const TIMEOUT_MS = 8_000;

const SYSTEM_PROMPT = `Eres el entrenador de Alejandro y le escribes una felicitación corta al cerrar su semana de entrenamiento.

Reglas:
- Español de México, tuteo, tono cálido y directo. Nada de coaching genérico ni frases de póster.
- Máximo dos frases. Es un mensaje en pantalla, no un correo.
- Menciona UN logro concreto sacado del JSON: el grupo muscular con más volumen, un récord personal, el crecimiento de volumen contra la semana pasada, o la adherencia si completó todas sus sesiones.
- Usa los números tal como vienen. Nunca inventes datos, ejercicios, pesos ni logros que no estén en el JSON.
- Si la semana fue floja (poco volumen, energía baja, molestias), reconócelo sin regañar y cierra hacia adelante.
- Sin emojis, sin hashtags, sin comillas alrededor de la respuesta.`;

// Genera el mensaje de cierre de semana con Grok. Cualquier fallo — sin API
// key, no-2xx, timeout, respuesta rara — devuelve null para que el llamador
// caiga al mensaje determinista: la celebración no puede quedar bloqueada
// porque un servicio externo no contestó.
export async function grokMensajeSemanal(resumen: WeekSummary): Promise<string | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(XAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.XAI_MODEL ?? "grok-4.5",
        max_tokens: 200,
        temperature: 0.8,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(resumen) },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const data = await res.json();
    const texto: unknown = data?.choices?.[0]?.message?.content;
    if (typeof texto !== "string") return null;

    // Grok a veces devuelve la frase entrecomillada; el overlay ya la presenta
    // como cita, así que las comillas sobran. [\s\S] en vez del flag /s porque
    // el target de TS del proyecto es anterior a es2018.
    const limpio = texto.trim().replace(/^["“]([\s\S]*)["”]$/, "$1");
    return limpio.length > 0 ? limpio : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
