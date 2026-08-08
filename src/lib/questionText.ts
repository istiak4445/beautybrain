function cleanReference(value: string) {
  return value.replace(/\*\*/g, "").trim();
}

function isLikelyReference(value: string) {
  const inner = value.slice(1, -1).trim();
  const latinWords = inner.match(/[A-Za-z]{3,}/g) ?? [];
  const hasBoardMarker = /বো|JU|RU|DU|CU|BUET|BUTEX|BU|HSC|SSC|ঢা|রা|দি|চ|য|কু|সি|ম|ব|খ/iu.test(inner);
  const hasYear = /(?:[০-৯0-9]{2,4}|[’'-][০-৯0-9]{2})/u.test(inner);

  if (value.startsWith("(")) {
    return hasBoardMarker && hasYear && latinWords.length <= 3;
  }

  return hasBoardMarker || hasYear;
}

function formatInlineRomanAssertions(text: string) {
  return text
    .replace(/\s+(i\.\s+)/g, "\n$1")
    .replace(/\s+(ii\.\s+)/g, "\n$1")
    .replace(/\s+(iii\.\s+)/g, "\n$1")
    .replace(/\n\s*(নিচের কোনটি সঠিক\??)/u, "\n$1")
    .trim();
}

export function splitQuestionReference(question: string) {
  const trimmed = question.replace(/\s*\*\*\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  const referencePattern = /(\[[^\[\]]{2,140}\]|\([^()]{2,140}\))/gu;
  const matches = Array.from(trimmed.matchAll(referencePattern)).filter((match) => isLikelyReference(match[1]));
  if (!matches.length) return { main: formatInlineRomanAssertions(trimmed), reference: "" };

  const referenceMatch = matches[matches.length - 1];
  const reference = cleanReference(referenceMatch[1]);
  const main = `${trimmed.slice(0, referenceMatch.index).trim()} ${trimmed.slice((referenceMatch.index ?? 0) + referenceMatch[0].length).trim()}`
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!main || !/[0-9০-৯A-Za-zঅ-হ]/u.test(reference)) return { main: trimmed, reference: "" };
  return { main: formatInlineRomanAssertions(main), reference };
}

export function splitEnglishParentheticals(text: string) {
  const parts: Array<{ text: string; english: boolean }> = [];
  const pattern = /\((?=[^()]*[A-Za-z]{3,})[^()]{8,180}\)/gu;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) parts.push({ text: text.slice(cursor, match.index), english: false });
    parts.push({ text: match[0], english: true });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) parts.push({ text: text.slice(cursor), english: false });
  if (!parts.length) parts.push({ text: text || " ", english: false });
  return parts;
}
