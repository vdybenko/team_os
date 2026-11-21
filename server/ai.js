// AI analyzer: turns an inbox item (transcript, email, chat, note) into proposals for review.
// Nothing is written to the team space here — proposals wait for a person to approve them.
import Anthropic from '@anthropic-ai/sdk';

export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client;
const getClient = () => (client ||= new Anthropic());

const S = (t = 'string') => ({ type: t });
const N = (t = 'string') => ({ type: [t, 'null'] });
const CONF = { type: 'string', enum: ['high', 'medium'] };
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const arr = (items) => ({ type: 'array', items });

const SCHEMA = obj({
  summary: arr(S()),
  participants: arr(obj({ name_in_source: S(), member_id: N() })),
  commitments: arr(obj({
    title: S(),
    owner_member_id: N(), owner_external_name: N(),
    requester_member_id: N(), requester_external_name: N(),
    due: N(), project_id: N(), hypothesis_id: N(),
    important: S('boolean'), duplicate_of_task_id: N(),
    confidence: CONF, evidence_quote: S(), evidence_timestamp: N(),
  })),
  status_updates: arr(obj({
    task_id: S(), new_status: { type: 'string', enum: ['open', 'progress', 'waiting', 'done', 'cancelled'] },
    confidence: CONF, evidence_quote: S(), evidence_timestamp: N(),
  })),
  knowledge: arr(obj({
    type: { type: 'string', enum: ['decision', 'agreement', 'fact', 'process', 'context'] },
    text: S(), why: N(), scope: { type: 'string', enum: ['team', 'private'] },
    project_id: N(), conflicts_with_id: N(), confidence: CONF, evidence_quote: S(), evidence_timestamp: N(),
  })),
  new_projects: arr(obj({ name: S(), vision: S(), confidence: CONF, evidence_quote: S(), evidence_timestamp: N() })),
  new_hypotheses: arr(obj({
    project_id: N(), if: S(), then: S(), because: S(), metric: N(), owner_member_id: N(),
    confidence: CONF, evidence_quote: S(), evidence_timestamp: N(),
  })),
});

const SYSTEM = `You are the analyzer inside TeamOS, a team's "second brain" that is filled from meetings, emails and chats.
You read one source (a meeting transcript, an email, a chat excerpt or a note) together with the team context, and you propose what should be saved. A person reviews every proposal before anything is stored, so propose what is genuinely there and nothing else.

What to extract:
- commitments: someone promised or was asked to do something. Owner = who must do it, requester = who asked for it / to whom it was promised. Either side may be an external person (client, partner) - then fill the *_external_name field and leave the member id null. If a person says "I will…" with no one asking, requester = owner. Normalize deadlines to YYYY-MM-DD relative to the source date ("до п'ятниці" = the next Friday after the source date). Link a project or hypothesis only when the source clearly points to it. If a commitment repeats an existing open task, set duplicate_of_task_id.
- status_updates: only for tasks listed in the context as open, when the source clearly says their status changed (done, started, blocked/waiting, cancelled).
- knowledge: decisions, agreements, facts, processes and important context. Use scope "private" for information about external parties or anything personal, "team" otherwise. If it contradicts an existing decision in the context, set conflicts_with_id.
- new_projects / new_hypotheses: only when the source explicitly proposes them. Hypotheses follow "If <action>, then <result>, because <assumption>".
- participants: map names used in the source (including diminutives like "Саш", "Вова") to member ids when you can.
- summary: 3–5 short bullet points.

Rules:
- Every item needs evidence_quote: a short verbatim fragment copied exactly from the source (one or two sentences, no paraphrase), plus its timestamp if the source has one. Leave out anything you cannot support with a quote.
- confidence "high" when the source is explicit, "medium" when you are inferring.
- Use only ids that appear in the team context. Never invent ids.
- Write titles, texts and the summary in the language of the source (Ukrainian sources produce Ukrainian text). Keep task titles short and start them with a verb.`;

export async function analyze({ text, title, type, date, uploader, context }) {
  const ctx = JSON.stringify(context, null, 1);
  const user = `Source date: ${date}\nSource type: ${type}\nSource title: ${title}\nUploaded by member: ${uploader.id} (${uploader.name})\n\n<team_context>\n${ctx}\n</team_context>\n\n<source>\n${text}\n</source>`;

  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    system: SYSTEM,
    // If the model declines a request, the API retries it on a fallback model chosen per refusal category.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: user }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('The model declined to analyze this source.');
  if (msg.stop_reason === 'max_tokens') throw new Error('The analysis was cut off (source too long). Split the source into parts.');
  const out = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(out);
}

export function errorMessage(e) {
  if (e instanceof Anthropic.AuthenticationError) return 'Claude API: невірний ключ (ANTHROPIC_API_KEY).';
  if (e instanceof Anthropic.RateLimitError) return 'Claude API: перевищено ліміт запитів, спробуй пізніше.';
  if (e instanceof Anthropic.APIConnectionError) return 'Claude API недоступний: немає з’єднання.';
  if (e instanceof Anthropic.APIError) return `Claude API помилка ${e.status ?? ''}: ${e.message}`;
  return e?.message || String(e);
}
