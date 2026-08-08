import { mathFallback } from "./mathFallback";
import type { MathNode } from "./mathFallback";

const bengaliRange = /[\u0980-\u09FF]/;
const subscriptMap: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "-": "₋",
  a: "ₐ",
  e: "ₑ",
  h: "ₕ",
  i: "ᵢ",
  j: "ⱼ",
  k: "ₖ",
  l: "ₗ",
  m: "ₘ",
  n: "ₙ",
  o: "ₒ",
  p: "ₚ",
  r: "ᵣ",
  s: "ₛ",
  t: "ₜ",
  u: "ᵤ",
  v: "ᵥ",
  x: "ₓ",
};
const superscriptMap: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  "=": "⁼",
  "(": "⁽",
  ")": "⁾",
  n: "ⁿ",
  i: "ⁱ",
};

const replacements: Array<[RegExp, string]> = [
  [/\\rightleftharpoons/g, "⇌"],
  [/\brightleftharpoons\b/g, "⇌"],
  [/\\rightarrow/g, "→"],
  [/\s*(?:=>|= >|->)\s*/g, " → "],
  [/\\Delta/g, "Δ"],
  [/\\sum/g, "∑"],
  [/\\prod/g, "∏"],
  [/\\int/g, "∫"],
  [/\\alpha/g, "α"],
  [/\\beta/g, "β"],
  [/\\gamma/g, "γ"],
  [/\\lambda/g, "λ"],
  [/\\mu/g, "μ"],
  [/\\pi/g, "π"],
  [/\\theta/g, "θ"],
  [/\\omega/g, "ω"],
  [/\\pm/g, "±"],
  [/\\approx/g, "≈"],
  [/\\neq/g, "≠"],
  [/\\leq/g, "≤"],
  [/\\geq/g, "≥"],
  [/\\therefore/g, "∴"],
  [/\\because/g, "∵"],
  [/\\infty/g, "∞"],
  [/\\text\{([^{}]*)\}/g, "$1"],
];

function toScript(value: string, script: "sub" | "super") {
  const map = script === "sub" ? subscriptMap : superscriptMap;
  const chars = Array.from(value);
  const converted = chars.map((char) => map[char] ?? char).join("");
  const hasUnsupportedAscii = chars.some((char) => /[A-Za-z]/.test(char) && !map[char]);
  if (!hasUnsupportedAscii) return converted;
  return `${script === "sub" ? "_" : "^"}${converted}`;
}

function normalizePreservingBengali(input: string) {
  let output = "";
  let latinBuffer = "";
  const flush = () => {
    if (latinBuffer) output += latinBuffer.normalize("NFC");
    latinBuffer = "";
  };

  for (const char of input) {
    if (bengaliRange.test(char)) {
      flush();
      output += char;
    } else {
      latinBuffer += char;
    }
  }
  flush();
  return output;
}

function protectSegments(input: string) {
  const protectedValues: string[] = [];
  const token = (value: string) => {
    const key = `\uE000${protectedValues.length}\uE001`;
    protectedValues.push(value);
    return key;
  };
  const text = input
    .replace(/`[^`]*`/g, token)
    .replace(/\bhttps?:\/\/[^\s)]+/gi, token)
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, token);
  return { text, restore: (value: string) => value.replace(/\uE000(\d+)\uE001/g, (_, id) => protectedValues[Number(id)] ?? "") };
}

function unwrapLatexTextCommands(input: string) {
  let text = input;
  let previous = "";
  while (text !== previous) {
    previous = text;
    text = text.replace(/\\(?:mathrm|mathbf|mathit|text)\{([^{}]*)\}/g, "$1");
  }
  return text;
}

function cleanupLatexLayout(input: string) {
  return unwrapLatexTextCommands(input)
    .replace(/\\begin\{array\}\{[^{}]*\}/g, "")
    .replace(/\\end\{array\}/g, "")
    .replace(/\\hline/g, " ; ")
    .replace(/\\\\/g, " ; ")
    .replace(/\s*&\s*/g, " | ")
    .replace(/(^|\s)\\(?=\s|$)/g, " ")
    .replace(/[ \t]*;[ \t]*/g, "; ")
    .replace(/[ \t]*\|[ \t]*/g, " | ")
    .replace(/(?:;\s*){2,}/g, "; ");
}

export function convertToWordFriendly(input: string): string {
  const protectedInput = protectSegments(normalizePreservingBengali(input));
  let text = protectedInput.text;

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }

  if (/\\(?:dfrac|tfrac|frac|sqrt)\{/.test(text)) {
    text = mathFallback(text);
  }
  text = cleanupLatexLayout(text);
  text = text.replace(/_\{([^{}]+)\}/g, (_, value: string) => toScript(convertToWordFriendly(value), "sub"));
  text = text.replace(/\^\{([^{}]+)\}/g, (_, value: string) => toScript(convertToWordFriendly(value), "super"));
  text = text.replace(/_([0-9+\-]+)/g, (_, value: string) => toScript(value, "sub"));
  text = text.replace(/_([A-Za-z][A-Za-z0-9+\-]*)/g, (_, value: string) => toScript(value, "sub"));
  text = text.replace(/\^([0-9+\-]+)/g, (_, value: string) => toScript(value, "super"));
  text = text.replace(/\^([A-Za-z][A-Za-z0-9+\-]*)/g, (_, value: string) => toScript(value, "super"));
  text = text.replace(/[ \t]{2,}/g, " ").replace(/\s+([,;:])/g, "$1");
  return protectedInput.restore(text).trim();
}

export type InlineRun =
  | { type: "text"; text: string; bold?: boolean }
  | { type: "script"; text: string; script: "sub" | "super"; bold?: boolean }
  | { type: "math"; nodes: MathNode[]; bold?: boolean };

export function parseInlineMarkdown(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > cursor) runs.push({ type: "text", text: convertToWordFriendly(text.slice(cursor, match.index)) });
    runs.push({ type: "text", text: convertToWordFriendly(match[1]), bold: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) runs.push({ type: "text", text: convertToWordFriendly(text.slice(cursor)) });
  return runs;
}
