export type MathNode =
  | { type: "text"; text: string }
  | { type: "script"; text: string; script: "sub" | "super" }
  | { type: "fraction"; numerator: MathNode[]; denominator: MathNode[] }
  | { type: "sqrt"; radicand: MathNode[] };

const commandPattern = /^\\(frac|dfrac|tfrac|sqrt)/;
const simpleReplacements: Array<[RegExp, string]> = [
  [/\\alpha/g, "α"],
  [/\\beta/g, "β"],
  [/\\gamma/g, "γ"],
  [/\\lambda/g, "λ"],
  [/\\mu/g, "μ"],
  [/\\pi/g, "π"],
  [/\\theta/g, "θ"],
  [/\\omega/g, "ω"],
  [/\\Delta/g, "Δ"],
  [/\\sum/g, "∑"],
  [/\\text\{([^{}]*)\}/g, "$1"],
];
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
  a: "ₐ",
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
};

function toScript(value: string, map: Record<string, string>, marker: "_" | "^") {
  const chars = Array.from(value);
  const converted = chars.map((char) => map[char] ?? char).join("");
  const hasUnsupportedAscii = chars.some((char) => /[A-Za-z]/.test(char) && !map[char]);
  return hasUnsupportedAscii ? `${marker}${converted}` : converted;
}

function basicMathText(input: string): string {
  let text = input;
  for (const [pattern, replacement] of simpleReplacements) text = text.replace(pattern, replacement);
  return text
    .replace(/_\{([^{}]+)\}/g, (_: string, value: string): string => toScript(basicMathText(value), subscriptMap, "_"))
    .replace(/\^\{([^{}]+)\}/g, (_: string, value: string): string => toScript(basicMathText(value), superscriptMap, "^"))
    .replace(/_([0-9+\-]+)/g, (_, value: string) => toScript(value, subscriptMap, "_"))
    .replace(/_([A-Za-z][A-Za-z0-9+\-]*)/g, (_, value: string) => toScript(value, subscriptMap, "_"))
    .replace(/\^([0-9+\-]+)/g, (_, value: string) => toScript(value, superscriptMap, "^"))
    .replace(/\^([A-Za-z][A-Za-z0-9+\-]*)/g, (_, value: string) => toScript(value, superscriptMap, "^"));
}

function readBalanced(input: string, start: number): { value: string; end: number } | null {
  if (input[start] !== "{") return null;
  let depth = 0;
  for (let index = start; index < input.length; index += 1) {
    const char = input[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return { value: input.slice(start + 1, index), end: index + 1 };
    }
  }
  return null;
}

function flushText(buffer: string, nodes: MathNode[]) {
  if (buffer) nodes.push({ type: "text", text: basicMathText(buffer) });
}

export function parseMathNodes(text: string): MathNode[] {
  const nodes: MathNode[] = [];
  let buffer = "";
  let index = 0;

  while (index < text.length) {
    const rest = text.slice(index);
    const command = rest.match(commandPattern);

    if (command) {
      flushText(buffer, nodes);
      buffer = "";
      index += command[0].length;

      if (command[1] === "sqrt") {
        const radicand = readBalanced(text, index);
        if (!radicand) {
          buffer += command[0];
          continue;
        }
        nodes.push({ type: "sqrt", radicand: parseMathNodes(radicand.value) });
        index = radicand.end;
        continue;
      }

      const numerator = readBalanced(text, index);
      const denominator = numerator ? readBalanced(text, numerator.end) : null;
      if (!numerator || !denominator) {
        buffer += command[0];
        continue;
      }
      nodes.push({
        type: "fraction",
        numerator: parseMathNodes(numerator.value),
        denominator: parseMathNodes(denominator.value),
      });
      index = denominator.end;
      continue;
    }

    buffer += text[index];
    index += 1;
  }

  flushText(buffer, nodes);
  return nodes;
}

export function flattenMathNodes(nodes: MathNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return basicMathText(node.text);
      if (node.type === "script") return basicMathText(node.text);
      if (node.type === "fraction") {
        return `(${flattenMathNodes(node.numerator)})/(${flattenMathNodes(node.denominator)})`;
      }
      return `√(${flattenMathNodes(node.radicand)})`;
    })
    .join("");
}

export function mathFallback(text: string): string {
  return flattenMathNodes(parseMathNodes(text));
}
