import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { CHAT_TOOLS, type Dataset } from './statsChat.queries.js';

const MODEL = process.env['STATS_CHAT_MODEL'] || 'claude-haiku-4-5';
const MAX_ROUNDS = 6;
const MAX_TOKENS = 1024;
const MAX_HISTORY = 20;

export const chatRequestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(2000) }))
    .min(1)
    .max(40),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export class ChatNotConfiguredError extends Error {}

// Created lazily so the app starts (and everything else works) without an API key
let client: Anthropic | null = null;

export function isChatConfigured(): boolean {
  return !!process.env['ANTHROPIC_API_KEY'];
}

export function chatModel(): string {
  return MODEL;
}

function getClient(): Anthropic {
  if (!isChatConfigured()) throw new ChatNotConfiguredError('ANTHROPIC_API_KEY is not set');
  client ??= new Anthropic({ timeout: 45_000, maxRetries: 1 });
  return client;
}

function systemPrompt(today: string): string {
  return `Du bist der Auswertungs-Assistent der Einlasskontrolle eines Schwimmvereins. Du beantwortest Fragen zu den Besucherzahlen auf Deutsch, kurz und sachlich.

Regeln:
- Heute ist ${today}. Rechne relative Angaben ("letzten Monat", "dieses Quartal", "seit September") selbst in konkrete Daten (yyyy-MM-dd) um. Wochen beginnen am Montag. Zeitzone Europe/Berlin.
- Antworte ausschließlich mit Zahlen, die dir die Werkzeuge liefern. Erfinde oder schätze nichts. Wenn Daten fehlen oder ein Zeitraum leer ist, sage das.
- Die Werkzeuge liefern nur Zahlen ohne Namen. Du kannst und darfst keine Namen oder Mitgliedsnummern nennen oder auswerten. Wird danach gefragt, erkläre kurz, dass die Auswertung nur mit anonymen Zahlen arbeitet.
- Ein Eintrag ist ein Einlass an einem Tag; jede Person wird pro Tag höchstens einmal gezählt. Die Kennzeichen (Übungsleiter, Neuer Ausweis, Schnupper-Training, Vorschwimmen) gelten wie sie aktuell bei der Person gesetzt sind, nicht rückwirkend.
- Die Tabellen und Diagramme zu deinen Abfragen zeigt die Oberfläche selbst an. Wiederhole deshalb nicht jede Zeile, sondern nenne die wichtigsten Zahlen, Summen, Vergleiche und Auffälligkeiten in wenigen Sätzen.
- Bei Vergleichen (zwei Monate, zwei Zeiträume) rufe die Werkzeuge für beide Zeiträume auf und nenne Differenz und Veränderung in Prozent.
- Kein Markdown, keine Aufzählungszeichen mit Sternchen; normale kurze Absätze.`;
}

export interface ChatResult {
  answer: string;
  datasets: Dataset[];
}

export async function runStatsChat(request: ChatRequest): Promise<ChatResult> {
  const anthropic = getClient();
  const messages: Anthropic.MessageParam[] = request.messages
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content }));
  // The conversation has to start with a user turn after trimming
  while (messages.length > 0 && messages[0]!.role !== 'user') messages.shift();

  const tools: Anthropic.Tool[] = CHAT_TOOLS.map(({ name, description, input_schema }) => ({
    name,
    description,
    input_schema,
  }));
  const datasets: Dataset[] = [];
  const system = systemPrompt(request.today);

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      tools,
      messages,
    });
    console.log(
      `[stats-chat] round ${round + 1}: in=${response.usage.input_tokens} out=${response.usage.output_tokens} stop=${response.stop_reason}`
    );

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });

      // Parallel tool calls: all results go back in one user message
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const tool = CHAT_TOOLS.find((t) => t.name === block.name);
        if (!tool) {
          results.push({ type: 'tool_result', tool_use_id: block.id, content: `Unbekanntes Werkzeug: ${block.name}`, is_error: true });
          continue;
        }
        try {
          const dataset = await tool.run(block.input);
          datasets.push(dataset);
          results.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify({ title: dataset.title, columns: dataset.columns, rows: dataset.rows }),
          });
        } catch (err) {
          const message = err instanceof z.ZodError
            ? err.issues.map((i) => `${i.path.join('.') || 'Eingabe'}: ${i.message}`).join('; ')
            : err instanceof Error ? err.message : 'Unbekannter Fehler';
          results.push({ type: 'tool_result', tool_use_id: block.id, content: message, is_error: true });
        }
      }
      messages.push({ role: 'user', content: results });
      continue;
    }

    if (response.stop_reason === 'refusal') {
      return { answer: 'Diese Anfrage konnte nicht beantwortet werden.', datasets };
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    const truncated = response.stop_reason === 'max_tokens' ? '\n\n(Die Antwort wurde gekürzt.)' : '';
    return { answer: (text || 'Dazu liegen keine Angaben vor.') + truncated, datasets };
  }

  return {
    answer: 'Die Auswertung war zu aufwendig. Bitte stelle die Frage etwas genauer oder teile sie in kleinere Fragen auf.',
    datasets,
  };
}

export { Anthropic };
