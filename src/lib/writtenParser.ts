import { convertToWordFriendly } from "./textConvert";

export type WrittenQAItem = {
  serial?: string;
  question: string;
  answer: string;
  warnings?: string[];
};

export type WrittenSlideItem = WrittenQAItem & {
  sourceIndex: number;
  part: number;
  partCount: number;
};

const STRUCTURE_LINE_PREFIX = "\uE100";
const banglaDigits = "\u09E6\u09E7\u09E8\u09E9\u09EA\u09EB\u09EC\u09ED\u09EE\u09EF";
const questionStart = new RegExp("^\\s*(?:([0-9" + banglaDigits + "]+)[\\.)।]|প্রশ্ন\\s*:)\\s*(.*)$", "u");
const answerStart = /^\s*(?:উত্তর|উত্তর\s*ঃ|উত্তর\s*:|Ans\.?|Answer\s*:?)\s*[:ঃ]?\s*(.*)$/iu;

function stripOuterBoldMarkers(text: string) {
  return text.replace(/^\s*\*\*\s*/u, "").replace(/\s*\*\*\s*$/u, "");
}

function isCodeFence(line: string) {
  return /^\s*```/.test(line);
}

function markStructureLine(line: string) {
  return `${STRUCTURE_LINE_PREFIX}${line}`;
}

function unmarkStructureLine(line: string) {
  return line.startsWith(STRUCTURE_LINE_PREFIX) ? line.slice(STRUCTURE_LINE_PREFIX.length) : line;
}

function isMarkedStructureLine(line: string) {
  return line.startsWith(STRUCTURE_LINE_PREFIX);
}

function isStructureLine(line: string) {
  if (isMarkedStructureLine(line)) return true;
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^[|\\/\-–—=\s]+$/u.test(line)) return true;
  if (/^\s{2,}\S/u.test(line) && /[A-Za-z₀-₉0-9|\\/\-=]/u.test(trimmed)) return true;
  const asciiLike = /^[A-Za-z0-9₀-₉⁰-⁹+*()|\\/\-–—=⇌→\s]+$/u.test(line);
  return asciiLike && /(?:CH|CO|OH|NH|C\s*=\s*C|[|\\/])/u.test(line);
}

function isStructureCaption(line: string) {
  const trimmed = line.trim();
  return trimmed.length > 0 && trimmed.length <= 36 && /[\u0980-\u09FF]/u.test(trimmed);
}

function convertLinePreservingIndent(line: string) {
  const unmarked = unmarkStructureLine(line);
  if (!isMarkedStructureLine(line) && !isStructureLine(unmarked)) {
    const leading = unmarked.match(/^[ \t]*/)?.[0] ?? "";
    return leading + convertToWordFriendly(unmarked.slice(leading.length));
  }

  return unmarked.replace(/\S+/g, (token) => convertToWordFriendly(token));
}

function pushWarnings(item: WrittenQAItem) {
  const warnings: string[] = [];
  if (!item.question.trim()) warnings.push("Missing question text");
    if (item.answer.length > 520) warnings.push("Answer is long, font reduced");
  item.warnings = warnings;
}

function finalize(item: WrittenQAItem | null, list: WrittenQAItem[]) {
  if (!item) return;
  item.question = convertToWordFriendly(stripOuterBoldMarkers(item.question).trim());
  item.answer = item.answer
    .split("\n")
    .map((line) => convertLinePreservingIndent(stripOuterBoldMarkers(line)))
    .join("\n")
    .replace(/^\n+/, "")
    .trimEnd();
  pushWarnings(item);
  list.push(item);
}

export function parseWrittenQAs(input: string): WrittenQAItem[] {
  const items: WrittenQAItem[] = [];
  let current: WrittenQAItem | null = null;
  let inAnswer = false;
  let inStructureFence = false;

  for (const rawLine of input.replace(/\r\n?/g, "\n").split("\n")) {
    if (isCodeFence(rawLine)) {
      inStructureFence = !inStructureFence;
      continue;
    }

    const trimmedLine = stripOuterBoldMarkers(rawLine.trim());
    const baseContentLine = stripOuterBoldMarkers(rawLine.replace(/[ \t]+$/g, ""));
    const contentLine = inStructureFence ? markStructureLine(baseContentLine) : baseContentLine;

    if (!trimmedLine) {
      if (inAnswer && current?.answer) current.answer += "\n";
      continue;
    }

    const question = trimmedLine.match(questionStart);
    if (question) {
      finalize(current, items);
      current = { serial: question[1], question: question[2] || trimmedLine.replace(/^প্রশ্ন\s*:\s*/u, ""), answer: "" };
      inAnswer = false;
      inStructureFence = false;
      continue;
    }

    const answer = trimmedLine.match(answerStart);
    if (answer) {
      if (!current) current = { question: "", answer: "" };
      current.answer = answer[1] ?? "";
      inAnswer = true;
      continue;
    }

    if (!current) {
      current = { question: trimmedLine, answer: "" };
      continue;
    }

    if (inAnswer) current.answer = `${current.answer}${current.answer ? "\n" : ""}${contentLine}`;
    else current.question = `${current.question} ${trimmedLine}`.trim();
  }

  finalize(current, items);
  return items;
}

export const getWrittenExportableCount = (items: WrittenQAItem[]) => items.filter((item) => item.question).length;

type AnswerBlock = { lines: string[]; structure: boolean; pressure: number };

function linePressure(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return 0.35;
  if (isStructureLine(line)) return 1;
  return Math.max(1, Math.ceil(trimmed.length / 58));
}

function blockPressure(lines: string[]) {
  return lines.reduce((total, line) => total + linePressure(line), 0);
}

function pushBlock(blocks: AnswerBlock[], lines: string[], structure: boolean) {
  if (!lines.length) return;
  blocks.push({ lines, structure, pressure: blockPressure(lines) });
}

function splitLongLine(line: string, width: number) {
  if (line.length <= width || isStructureLine(line)) return [line];
  const words = line.split(/(\s+)/);
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + word).trim().length > width && current.trim()) {
      chunks.push(current.trimEnd());
      current = word.trimStart();
    } else {
      current += word;
    }
  }
  if (current.trim()) chunks.push(current.trimEnd());
  return chunks;
}

function answerBlocks(answer: string) {
  const blocks: AnswerBlock[] = [];
  let current: string[] = [];
  let currentStructure = false;

  const flush = () => {
    pushBlock(blocks, current, currentStructure);
    current = [];
    currentStructure = false;
  };

  for (const rawLine of answer.split("\n")) {
    const line = rawLine.replace(/[ \t]+$/g, "");
    const structure = isStructureLine(line) || (currentStructure && isStructureCaption(line));

    if (!line.trim()) {
      flush();
      continue;
    }

    if (structure) {
      if (current.length && !currentStructure) flush();
      current.push(line);
      currentStructure = true;
      continue;
    }

    if (currentStructure) flush();
    for (const chunk of splitLongLine(line, 86)) pushBlock(blocks, [chunk], false);
  }

  flush();
  return blocks;
}

function splitAnswer(answer: string) {
  const blocks = answerBlocks(answer);
  const chunks: string[] = [];
  let current: string[] = [];
  let pressure = 0;
  const maxPressure = 13;

  for (const block of blocks) {
    if (current.length && pressure + block.pressure > maxPressure) {
      chunks.push(current.join("\n").trimEnd());
      current = [];
      pressure = 0;
    }

    current.push(...block.lines);
    pressure += block.pressure;

    if (block.structure && block.pressure >= maxPressure) {
      chunks.push(current.join("\n").trimEnd());
      current = [];
      pressure = 0;
    }
  }

  if (current.length) chunks.push(current.join("\n").trimEnd());
  return chunks.length ? chunks : [answer];
}

export function paginateWrittenSlides(items: WrittenQAItem[]): WrittenSlideItem[] {
  return items.flatMap((item, sourceIndex) => {
    if (!item.question) return [];
    const chunks = item.answer ? splitAnswer(item.answer) : [""];
    return chunks.map((answer, index) => ({
      ...item,
      answer,
      sourceIndex,
      part: index + 1,
      partCount: chunks.length,
    }));
  });
}
