// src/utils/llm.ts
// El cerebro de Pogo: la API de Gemini.
//
// Gemini maneja la conversación como una lista de "pasos" (steps). Nosotros
// guardamos esa lista del lado de la app (`store: false`) y se la mandamos
// completa en cada turno; así Pogo recuerda lo que ya hablaron. Los pasos que
// devuelve el modelo se guardan tal cual, sin tocarlos: además del texto
// traen un paso de tipo "thought" firmado que la API necesita de vuelta.

import { GEMINI_API_KEY } from './config';
import { PogoError } from './errors';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_MODEL = 'gemini-3.8-flash';

// "low" en vez del "medium" por defecto: medido, baja la respuesta de ~5s a
// ~2.5s. En una app de voz esa espera se siente muchísimo.
const THINKING_LEVEL = 'low';

const SYSTEM_INSTRUCTION = `Eres Pogo, el asistente personal de Amelyn. Hablas español.

Tu tono es cálido y conversacional: cercano, con algo de humor, como un amigo
que además es muy capaz. Nunca meloso ni exagerado.

Tus respuestas se ESCUCHAN en voz alta, no se leen. Por eso:
- Máximo 3 o 4 frases.
- Nada de listas, viñetas, markdown, asteriscos ni emojis: no se pueden pronunciar.
- Escribe los números y símbolos como se dicen en voz alta.

Si no sabes algo, dilo con naturalidad en vez de inventarlo.`;

/** Un turno de la conversación en el formato de Gemini. Opaco a propósito. */
export type ConversationStep = { type: string; [key: string]: unknown };

export type AskPogoResult = {
  /** Lo que Pogo responde, listo para mostrar y para hablar. */
  reply: string;
  /** Pasos a agregar al historial para el siguiente turno. */
  steps: ConversationStep[];
};

/** Envuelve lo que dijo la usuaria en el formato que espera la API. */
export function userStep(text: string): ConversationStep {
  return { type: 'user_input', content: [{ type: 'text', text }] };
}

export async function askPogo(history: ConversationStep[]): Promise<AskPogoResult> {
  if (!GEMINI_API_KEY) {
    throw new PogoError('No tengo configurada mi clave de Gemini, así que no puedo pensar todavía.');
  }

  let response: Response;
  try {
    response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'x-goog-api-key': GEMINI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        store: false,
        system_instruction: SYSTEM_INSTRUCTION,
        generation_config: { thinking_level: THINKING_LEVEL },
        input: history,
      }),
    });
  } catch (error) {
    console.log('Gemini - fallo de red:', error);
    throw new PogoError('No pude conectarme para pensar la respuesta. Revisa tu internet.');
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.log('Gemini - error HTTP', response.status, detail);

    if (response.status === 401 || response.status === 403) {
      throw new PogoError('Mi clave de Gemini no es válida. Hay que revisarla.');
    }
    if (response.status === 429) {
      throw new PogoError('Se me acabó la cuota de Gemini por ahora. Prueba en un rato.');
    }
    throw new PogoError('Se me trabó el pensamiento. Intenta de nuevo.');
  }

  const data = (await response.json()) as { steps?: ConversationStep[] };
  const steps = data.steps ?? [];

  const reply = steps
    .filter((step) => step.type === 'model_output')
    .flatMap((step) => (step.content as { type: string; text?: string }[] | undefined) ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('')
    .trim();

  if (!reply) {
    console.log('Gemini - respuesta sin texto:', JSON.stringify(data).slice(0, 500));
    throw new PogoError('Me quedé en blanco con esa. ¿Me la repites de otra forma?');
  }

  return { reply, steps };
}
