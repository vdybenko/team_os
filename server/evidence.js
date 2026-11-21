const paragraph = (value) => value.replace(/\s+/g, ' ').trim();
const words = /[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:['’‘ʼ`][\p{L}\p{N}\p{M}]+)*/gu;
const fold = (word) => word.normalize('NFKC').toLowerCase().replace(/['’‘ʼ`]/g, '');

export function knowledgeEvidence(source) {
  const transcript = paragraph(source);
  let sourceWords;
  return (candidate) => {
    const quote = paragraph(candidate);
    if (!quote) return null;
    if (transcript.includes(quote)) return quote;

    // Match only complete, consecutive words. Save the wording from the source.
    const expected = [...quote.matchAll(words)].map(([word]) => fold(word));
    if (expected.length < 4) return null;
    sourceWords ||= [...transcript.matchAll(words)].map(({ 0: word, index }) => ({
      word: fold(word), start: index, end: index + word.length,
    }));
    for (let start = 0; start <= sourceWords.length - expected.length; start++) {
      if (!expected.every((word, offset) => sourceWords[start + offset].word === word)) continue;
      return transcript.slice(sourceWords[start].start, sourceWords[start + expected.length - 1].end);
    }
    return null;
  };
}
