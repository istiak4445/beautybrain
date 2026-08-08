import { convertToWordFriendly } from "./textConvert";

export type MCQItem = {
  serial?: string;
  question: string;
  options: {
    ka?: string;
    kha?: string;
    ga?: string;
    gha?: string;
  };
  warnings?: string[];
};

const banglaDigits = "\u09E6\u09E7\u09E8\u09E9\u09EA\u09EB\u09EC\u09ED\u09EE\u09EF";
const questionStart = new RegExp("^\\s*(?:([0-9" + banglaDigits + "]+)[\\.)।]|প্রশ্ন\\s*:)\\s*(.*)$", "u");
const optionStartWithPunctuation = /^\s*\(?\s*(ক|খ|গ|ঘ|A|B|C|D|a|b|c|d)\s*[\).।:]\s*(.*)$/u;
const rawOptionStart = /^\s*\(?\s*([কখগঘ])\s+(.+)$/u;
const rawEnglishOptionStart = /^\s*\(?\s*([A-Da-d])\s+(.+)$/u;
const inlineOptionPattern = /(?:^|[\s(])\s*(?:(ক|খ|গ|ঘ|A|B|C|D|a|b|c|d)\s*[\).।:]\s*|([কখগঘ])\s+)/gu;
const relaxedInlineOptionPattern = /(?:^|[\s(])\s*(?:(ক|খ|গ|ঘ|A|B|C|D|a|b|c|d)\s*[\).।:]\s*|([কখগঘA-Da-d])\s+)/gu;
const optionMap: Record<string, keyof MCQItem["options"]> = {
  ক: "ka",
  খ: "kha",
  গ: "ga",
  ঘ: "gha",
  A: "ka",
  a: "ka",
  B: "kha",
  b: "kha",
  C: "ga",
  c: "ga",
  D: "gha",
  d: "gha",
};

function pushWarnings(item: MCQItem) {
  const warnings: string[] = [];
  if (!item.question.trim()) warnings.push("Missing question text");
  for (const [key, label] of [
    ["ka", "ক"],
    ["kha", "খ"],
    ["ga", "গ"],
    ["gha", "ঘ"],
  ] as const) {
    if (!item.options[key]?.trim()) warnings.push(`Missing ${label} option`);
  }
  if (item.question.length > 150) warnings.push("Question too long, font reduced");
  Object.values(item.options).forEach((option) => {
    if ((option?.length ?? 0) > 70) warnings.push("Option text overflow risk");
  });
  item.warnings = Array.from(new Set(warnings));
}

function stripOuterBoldMarkers(text: string) {
  return text.replace(/^\s*\*\*\s*/u, "").replace(/\s*\*\*\s*$/u, "");
}

function hasAnyOption(item: MCQItem) {
  return Boolean(item.options.ka || item.options.kha || item.options.ga || item.options.gha);
}

function looksLikeQuestionPrompt(text: string) {
  return /[?？]|[?]|[কক]ী|কোন|কত|কেন|কিভাবে|হলো|হবে|হয়|সঠিক|সংকেত|নাম|Product/i.test(text);
}

function toRomanListMarker(marker: string) {
  return ({ "1": "i", "2": "ii", "3": "iii" } as Record<string, string>)[marker] ?? marker;
}

function formatAssertionLine(marker: string, text: string) {
  return `${toRomanListMarker(marker)}. ${text}`;
}

function isStructureLine(rawLine: string) {
  const line = rawLine.trim();
  if (!line) return false;
  if (/^[|=]+$/.test(line)) return true;
  if (/^[-–—|=()A-Za-z0-9₀-₉+\s]+$/.test(line) && /(?:CH|CO|NH|OH|C|H|O|N|Cl|Br|I|₁|₂|₃|₄|₅|₆)/.test(line)) return true;
  return /^\s{2,}\S/.test(rawLine) && /[A-Za-z₀-₉|=–—-]/.test(line);
}

function appendQuestionLine(question: string, line: string) {
  const lineIsAssertion = /^(?:i|ii|iii)\. /u.test(line.trim());
  const questionHasAssertions = /(?:^|\n)(?:i|ii|iii)\. /u.test(question);
  const separator = lineIsAssertion || questionHasAssertions || looksLikeQuestionPrompt(line) || isStructureLine(line) ? "\n" : " ";
  return `${question}${separator}${line}`.trim();
}

function splitReactionStemLines(text: string) {
  return text
    .split("\n")
    .map((line) => {
      if (!/[→⇌]/u.test(line)) return line;
      return line.replace(/\s+(উপরের|নিচের|কোন|উদ্দীপকের|শূন্যস্থান|প্রদত্ত)\b/u, "\n$1");
    })
    .join("\n");
}

function markerGroup(marker: string) {
  return /[কখগঘ]/u.test(marker) ? "bangla" : "english";
}

function markerOrder(marker: string) {
  return { ক: 0, খ: 1, গ: 2, ঘ: 3, A: 0, a: 0, B: 1, b: 1, C: 2, c: 2, D: 3, d: 3 }[marker] ?? -1;
}

function splitInlineOptions(text: string) {
  const hasReactionSyntax = /[→⇌]|(?:^|\s)[A-Da-d]?\s*[—–-]+[^\n]*[→>]/u.test(text);
  const pattern = hasReactionSyntax ? inlineOptionPattern : relaxedInlineOptionPattern;
  const matches = Array.from(text.matchAll(pattern));
  if (matches.length < 2) return null;

  const markers = matches.map((match) => match[1] ?? match[2]);
  const group = markerGroup(markers[0]);
  if (!markers.every((marker) => markerGroup(marker) === group)) return null;

  const orders = markers.map(markerOrder);
  if (orders.some((order) => order < 0)) return null;
  for (let index = 1; index < orders.length; index += 1) {
    if (orders[index] <= orders[index - 1]) return null;
  }

  return matches.map((match, index) => {
    const next = matches[index + 1];
    return {
      marker: match[1] ?? match[2],
      index: match.index!,
      text: stripOuterBoldMarkers(text.slice(match.index! + match[0].length, next?.index ?? text.length).trim()),
    };
  });
}

function applyInlineOptions(item: MCQItem, inlineOptions: NonNullable<ReturnType<typeof splitInlineOptions>>) {
  for (const inlineOption of inlineOptions) {
    item.options[optionMap[inlineOption.marker]] = inlineOption.text;
  }
  return optionMap[inlineOptions[inlineOptions.length - 1].marker];
}

function detectOptionStart(line: string) {
  const punctuated = line.match(optionStartWithPunctuation);
  if (punctuated) return { marker: punctuated[1], text: stripOuterBoldMarkers(punctuated[2]) };

  const rawOption = line.match(rawOptionStart);
  if (rawOption) return { marker: rawOption[1], text: stripOuterBoldMarkers(rawOption[2]) };

  if (!/[→⇌—–-]/u.test(line)) {
    const rawEnglishOption = line.match(rawEnglishOptionStart);
    if (rawEnglishOption) return { marker: rawEnglishOption[1], text: stripOuterBoldMarkers(rawEnglishOption[2]) };
  }

  return null;
}

function alignStructureBlock(lines: string[]) {
  const converted = lines.map((line) => {
    if (!isStructureLine(line)) return convertToWordFriendly(line);
    const leading = line.match(/^\s*/)?.[0] ?? "";
    const trimmed = line.trim();
    if (/^[|=]+$/.test(trimmed)) return leading + trimmed;
    return leading + convertToWordFriendly(trimmed);
  });

  const mainIndex = converted.findIndex((line) => /CH₃[–—-]CH₂[–—-]C[–—-]CH/u.test(line));
  if (mainIndex === -1) return converted;

  const mainLine = converted[mainIndex];
  const anchor = mainLine.indexOf("C–CH") >= 0 ? mainLine.indexOf("C–CH") : mainLine.indexOf("C-CH");
  if (anchor < 0) return converted;

  return converted.map((line, index) => {
    const trimmed = line.trim();
    if (index === mainIndex || !isStructureLine(line)) return line;
    if (/^[|=]+$/.test(trimmed)) return " ".repeat(anchor) + trimmed;
    if (/^CH₂(?:[–—-]CH₃)?$/u.test(trimmed)) {
      const offset = trimmed.includes("–") || trimmed.includes("-") || trimmed.includes("—") ? Math.max(0, anchor - 2) : Math.max(0, anchor - 1);
      return " ".repeat(offset) + trimmed;
    }
    return line;
  });
}

function convertQuestionText(text: string) {
  return splitReactionStemLines(alignStructureBlock(text.split("\n")).join("\n")).trim();
}

function finalize(item: MCQItem | null, list: MCQItem[]) {
  if (!item) return;
  item.question = convertQuestionText(item.question);
  item.options = Object.fromEntries(
    Object.entries(item.options).map(([key, value]) => [key, value ? convertToWordFriendly(value) : value]),
  ) as MCQItem["options"];
  pushWarnings(item);
  list.push(item);
}

export function parseMCQs(input: string): MCQItem[] {
  const items: MCQItem[] = [];
  let current: MCQItem | null = null;
  let activeOption: keyof MCQItem["options"] | null = null;

  for (const rawLine of input.replace(/\r\n?/g, "\n").split("\n")) {
    const diagramLine = isStructureLine(rawLine);
    const line = diagramLine ? rawLine.replace(/[ \t]+$/g, "") : rawLine.trim();
    const markerLine = stripOuterBoldMarkers(line.trim());
    if (!markerLine) continue;

    const question = markerLine.match(questionStart);
    if (question) {
      const questionText = stripOuterBoldMarkers(question[2] || markerLine.replace(/^প্রশ্ন\s*:\s*/u, ""));
      if (current && !hasAnyOption(current) && question[1] && !looksLikeQuestionPrompt(questionText)) {
        current.question = appendQuestionLine(current.question, formatAssertionLine(question[1], questionText));
        activeOption = null;
        continue;
      }

      finalize(current, items);
      const inlineOptions = splitInlineOptions(questionText);
      current = {
        serial: question[1],
        question: inlineOptions ? questionText.slice(0, inlineOptions[0].index).trim() : questionText,
        options: {},
      };
      activeOption = inlineOptions ? applyInlineOptions(current, inlineOptions) : null;
      continue;
    }

    const option = detectOptionStart(markerLine);
    if (option) {
      if (!current) current = { question: "", options: {} };
      const inlineOptions = splitInlineOptions(line);
      if (inlineOptions) {
        activeOption = applyInlineOptions(current, inlineOptions);
      } else {
        const key = optionMap[option.marker];
        current.options[key] = option.text;
        activeOption = key;
      }
      continue;
    }

    if (!current) current = { question: line, options: {} };
    else if (activeOption) current.options[activeOption] = `${current.options[activeOption] ?? ""} ${markerLine}`.trim();
    else current.question = appendQuestionLine(current.question, line);
  }

  finalize(current, items);
  return items;
}
