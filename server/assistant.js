import { answerWorkspace } from './ai.js';
import { tr } from './i18n.js';
import { pdfPages } from './pdf.js';

const excerpt = (value, length = 1200) => String(value ?? '').trim().slice(0, length);
const terms = (text) => new Set((String(text).normalize('NFKC').toLowerCase().match(/\d+(?:[.,]\d+)?%?|\p{L}[\p{L}\p{N}]{2,}/gu) || []).map((word) => word.slice(0, 5)));
const topicTerms = {
  task: terms('задачі завдання комітменти дедлайн прострочені діє відкриті tasks deadline overdue'),
  knowledge: terms('знання рішення домовленість факти процес інформація knowledge decision fact'),
  goal: terms('цілі ціль метрика цільові прогрес показник goal target metric'),
  hypothesis: terms('гіпотеза гіпотези експеримент тестування висновки hypothesis experiment testing'),
};

function* passages(document) {
  const pages = document.pdf ? pdfPages(document.text) : [];
  for (const { page, text } of pages.length ? pages : [{ page: null, text: document.text }]) {
    // Keep tables and headings together on ordinary slides. Overlap long pages
    // and plain text so an answer can span the edge of two passages.
    for (let start = 0; start < text.length; start += 2150) {
      const passage = text.slice(start, start + 2400).trim();
      if (passage) yield { page, start, passage };
      if (start + 2400 >= text.length) break;
    }
  }
}

export async function askAssistant({ question, turns, team, lang = 'en', viewerId, today, tasks, knowledge, projects, hypotheses, nameOf, documents = [] }) {
  const projectNames = new Map(projects.map((p) => [p.id, p.name]));
  const records = [];
  const openings = new Map();
  function add(kind, id, title, data, target = id) {
    records.push({ key: `${kind}:${id}`, kind, title: excerpt(title, 160), target, data });
  }
  for (const t of tasks) add('task', t.id, t.title, {
    description: excerpt(t.description), status: t.status, due: t.due, important: t.important, taskId: t.id,
    owner: nameOf(t.owner), assignedToViewer: t.owner === viewerId, requester: nameOf(t.requester),
    delegatedByViewer: t.requester === viewerId && t.owner !== viewerId, project: projectNames.get(t.project),
  });
  for (const k of knowledge) add('knowledge', k.id, k.text, {
    text: excerpt(k.text), why: excerpt(k.why, 500), type: k.type, date: k.date,
    ...(k.quote ? { quote: excerpt(k.quote), source: excerpt(k.source, 250) } : {}),
    scope: k.scope, superseded: Boolean(k.supersededBy), project: projectNames.get(k.project),
  });
  for (const p of projects) (p.goals || []).forEach((g, index) => add('goal', `${p.id}:${index}`, g.goal, {
    project: p.name, projectStatus: p.status, goal: g.goal, metric: g.metric, target: g.target, current: g.current, due: g.by,
  }, p.id));
  for (const h of hypotheses) add('hypothesis', h.id, h.statement || h.then, {
    statement: excerpt(h.statement || `If ${h.if}, then ${h.then}, because ${h.because}`),
    project: projectNames.get(h.project), status: h.status, owner: nameOf(h.owner), metric: h.metric,
    target: h.target, current: h.current, from: h.from, until: h.to, verdict: excerpt(h.verdict, 500),
    learnings: (h.learnings || []).slice(-3).map((l) => excerpt(l.text, 300)),
  });
  for await (const document of documents) {
    for (const { page, start, passage } of passages(document)) {
      add(document.kind, `${document.id}:${page ?? 0}:${start}`, document.title,
        { page, workspaceRecordDate: document.date, text: passage }, document.id);
      if (!openings.has(document.id)) openings.set(document.id, records.at(-1));
    }
  }
  if (!records.length) return { answer: tr(lang, 'There are no records or documents in this space yet that I could rely on.'), sources: [] };

  const all = new Map(records.map((r) => [r.key, r]));
  const history = turns.slice(-6).map((turn) => ({
    question: excerpt(turn.question, 650),
    answer: turn.sources.length && turn.sources.every((s) => all.has(s.key)) ? excerpt(turn.answer, 900) : undefined,
  }));
  const query = terms(question);
  const previous = terms(history.at(-1)?.question || '');
  const previousDocuments = new Set((turns.at(-1)?.sources || []).filter((s) => ['source', 'inbox'].includes(s.kind)).map((s) => s.target));
  const ranked = records.map((record) => {
    const title = terms(record.title);
    const body = terms(JSON.stringify(record.data));
    const score = [...query].reduce((sum, word) => sum + (title.has(word) ? 5 : 0) + (body.has(word) ? 2 : 0)
      + (topicTerms[record.kind]?.has(word) ? 3 : 0), 0)
      + [...previous].filter((word) => title.has(word) || body.has(word)).length * 0.5
      + (previousDocuments.has(record.target) ? 1 : 0)
      - (record.data.superseded ? 1 : 0);
    return { record, score };
  }).sort((a, b) => b.score - a.score);
  const selected = new Map();
  let budget = 54_000;
  function include({ record }) {
    if (selected.has(record.key)) return;
    const { target, ...data } = record;
    const size = JSON.stringify(data).length;
    if (size > budget) return;
    budget -= size;
    selected.set(record.key, data);
  }
  for (const kind of Object.keys(topicTerms)) ranked.filter((entry) => entry.record.kind === kind).slice(0, 3).forEach(include);
  const topPassages = ranked.filter(({ record }) => openings.has(record.target)).slice(0, 3);
  topPassages.forEach(include);
  for (const { record } of topPassages) include({ record: openings.get(record.target) });
  ranked.forEach(include);

  const active = tasks.filter((t) => !['done', 'cancelled'].includes(t.status));
  const output = await answerWorkspace({
    today, team, question, history,
    totals: {
      tasks: tasks.length, activeTasks: active.length, overdueTasks: active.filter((t) => t.due && t.due < today).length,
      ownActiveTasks: active.filter((t) => t.owner === viewerId).length,
      delegatedActiveTasks: active.filter((t) => t.requester === viewerId && t.owner !== viewerId).length,
      currentKnowledge: knowledge.filter((k) => !k.supersededBy).length, hypotheses: hypotheses.length,
      goals: records.filter((record) => record.kind === 'goal').length,
    },
    partial: selected.size < records.length,
    records: [...selected.values()],
  });
  const sources = [...new Set(output.sources)].filter((key) => selected.has(key)).slice(0, 8)
    .map((key) => { const { kind, title, target, data } = all.get(key); return { key, kind, title, target, ...(data.page ? { page: data.page } : {}) }; });
  const answer = excerpt(output.answer, 10000);
  if (!answer) throw new Error('The assistant returned an empty answer. Try again.');
  return { answer, sources };
}
