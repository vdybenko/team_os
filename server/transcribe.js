// Speech → text for dictated inbox items. Uses the OpenAI transcription API when OPENAI_API_KEY is set
// (independently of AI_PROVIDER). Without it the browser's own speech recognition text is used.
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // OpenAI's upload limit
const KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.TRANSCRIBE_MODEL || 'gpt-4o-transcribe';

export const transcribeConfigured = () => Boolean(KEY) && process.env.TRANSCRIBE !== '0';

const EXT = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav' };
export const audioExt = (mime) => EXT[String(mime).split(';')[0].trim()] || 'webm';

export async function transcribe(buf, mime, lang) {
  const type = String(mime).split(';')[0].trim() || 'audio/webm';
  const form = new FormData();
  form.append('file', new Blob([buf], { type }), `note.${audioExt(type)}`);
  form.append('model', MODEL);
  form.append('response_format', 'text');
  if (lang) form.append('language', lang);
  let response;
  try {
    response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: form, redirect: 'error', signal: AbortSignal.timeout(300_000),
    });
  } catch {
    throw new Error('The transcription service didn’t respond. Try again later.');
  }
  if (!response.ok) {
    if (response.status === 429) throw new Error('OpenAI: request limit exceeded. Try again later.');
    if ([401, 403, 404].includes(response.status)) throw new Error('OpenAI: check the key and access to the model.');
    throw Object.assign(new Error(`Transcription failed (${response.status}).`), { i18n: { key: 'Transcription failed ({status}).', vars: { status: response.status } } });
  }
  return (await response.text()).trim();
}
