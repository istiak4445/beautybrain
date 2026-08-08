const banglaDigits = "০১২৩৪৫৬৭৮৯";

function normalizeMarkers(line: string) {
  return line
    .replace(/^\s*([কখগঘ])\s*[\).:\-]\s*/u, "$1) ")
    .replace(/^\s*\(\s*([কখগঘ])\s*\)\s*/u, "$1) ")
    .replace(/^\s*([A-Da-d])\s*[\).:\-]\s*/, "$1) ")
    .replace(/^\s*\(\s*([A-Da-d])\s*\)\s*/, "$1) ")
    .replace(new RegExp(`^\\s*([0-9${banglaDigits}]+)\\s*[)\\-:]\\s*`, "u"), "$1. ");
}

function repairHybridization(text: string) {
  return text.replace(/\bsp\s*([23])\b/gi, "sp^$1");
}

const elementSymbols = ["Cl", "Br", "Na", "Ca", "Mg", "Al", "Fe", "Zn", "Cu", "Mn", "Ag", "Ba", "Li", "Si", "C", "H", "O", "N", "S", "P", "K", "F", "I"];
const elementPattern = elementSymbols.join("|");
const formulaTokenPattern = /[A-Za-z][A-Za-z0-9_{}()+.\/-]*/g;

function looksLikeFormulaToken(token: string) {
  if (!/[0-9]/.test(token)) return false;
  if (/^(?:HSC|SSC|JU|RU|CU|DU|BUET|MCQ|IUPAC|pH|Ka|Kc)/i.test(token)) return false;
  const pieces = token.match(new RegExp(`${elementPattern}|[0-9_{}()+.\/-]+`, "g"));
  return Boolean(pieces && pieces.join("") === token && pieces.some((piece) => elementSymbols.includes(piece)));
}

function repairFormulaToken(token: string) {
  return token.replace(new RegExp(`(${elementPattern})([0-9]+)`, "g"), "$1_$2");
}

function repairCondensedFormulaDigits(text: string) {
  return text.replace(formulaTokenPattern, (token) => (looksLikeFormulaToken(token) ? repairFormulaToken(token) : token));
}

function repairOrganicReactionArrows(text: string) {
  return text.replace(/\s*[—–]\s*\[([^\]]+)\]\s*(?:→|->)\s*/g, (_, reagentText: string) => ` —[${repairFormulaToken(reagentText)}]→ `);
}

function repairFormulaSpacing(text: string) {
  let output = repairCondensedFormulaDigits(text);
  output = output.replace(/\bK\s+([ac])\b/g, "K_$1");
  output = output.replace(/\b([A-Z][a-z]?)\s+([0-9]+)\s*([+-])/g, "$1^{$2$3}");
  output = output.replace(/\b([0-9]+)\s*([A-Z][a-z]?)\s+([0-9]+)\s+([A-Z][a-z]?)/g, "$1$2_$3$4");
  output = output.replace(/\b([A-Z][a-z]?)(?:\s+([0-9]+))(?=\s*[A-Z(]|$|[,+\-→⇌])/g, "$1_$2");
  output = output.replace(/\b([A-Z][a-z]?)\s+([0-9]+)\s+([A-Z][a-z]?)/g, "$1_$2$3");
  output = output.replace(/\b([A-Z][a-z]?)([A-Z][a-z]?)\s+([0-9]+)\b/g, "$1$2_$3");
  output = output.replace(/\b((?:[A-Z][a-z]?)+)\s+([0-9]+)(?=\b|\()/g, "$1_$2");
  output = output.replace(/(_[0-9]+)\s+(?=[A-Z])/g, "$1");
  output = output.replace(/([A-Z][a-z]?_[0-9]+)\s+([A-Z][a-z]?)(?=\b|[,+\-→⇌)])/g, "$1$2");
  output = output.replace(/\b((?:[A-Z][a-z]?_?\d*)+)\s+([0-9]+[+-])/g, "$1^{$2}");
  output = output.replace(/\b((?:[A-Z][a-z]?_?\d*)+_[0-9]+)\s*\+(?!\s+[A-Z0-9(])/g, "$1^+");
  output = output.replace(/\b(SO|CO)\s*_\s*([34])\s*\^\s*\{\s*2\s*-\s*\}/g, "$1_$2^{2-}");
  output = output.replace(/\b(SO|CO)\s+([34])\s+2\s*-\b/g, "$1_$2^{2-}");
  output = output.replace(/\bNH\s+4\s*\+\b/g, "NH_4^+");
  return output;
}

function repairArrows(text: string) {
  return repairOrganicReactionArrows(
    text
      .replace(/\brightleftharpoons\b/g, "\\rightleftharpoons")
      .replace(/(^|[^-])\s*(?:=>|= >|->)\s*/g, "$1 → "),
  );
}

const optionPattern = /^\s*(?:[কখগঘ]|[A-Da-d])\)\s*/u;
const answerPattern = /^\s*(?:উত্তর|Ans\.?|Answer)\s*[:ঃ]/iu;
const questionPattern = new RegExp(`^\\s*(?:[0-9${banglaDigits}]+[\\.।]|প্রশ্ন\\s*:)`, "u");

function isStructureLine(rawLine: string) {
  const line = rawLine.trim();
  if (!line) return false;
  if (/^[|\/=]+$/.test(line)) return true;
  if (/^[-–—|\/=()A-Za-z0-9₀-₉+\s]+$/.test(line) && /(?:CH|CO|NH|OH|C|H|O|N|Cl|Br|I|₁|₂|₃|₄|₅|₆)/.test(line)) return true;
  return /^\s{2,}\S/.test(rawLine) && /[A-Za-z₀-₉|\/=–—-]/.test(line);
}

function joinBrokenLines(lines: string[]) {
  const joined: string[] = [];
  for (const rawLine of lines) {
    const diagramLine = isStructureLine(rawLine);
    const line = diagramLine ? rawLine.replace(/[ \t]+$/g, "") : rawLine.trim();
    if (!line.trim()) {
      if (joined[joined.length - 1] !== "") joined.push("");
      continue;
    }

    const startsNew = questionPattern.test(line.trim()) || optionPattern.test(line.trim()) || answerPattern.test(line.trim());
    const previous = joined[joined.length - 1] ?? "";
    const previousIsOption = optionPattern.test(previous.trim());
    const previousIsQuestion = questionPattern.test(previous.trim());
    const previousIsDiagram = isStructureLine(previous);
    if (diagramLine || previousIsDiagram) {
      joined.push(line);
    } else if (joined.length > 0 && previous && !startsNew && (previousIsOption || previousIsQuestion || !optionPattern.test(previous))) {
      joined[joined.length - 1] = `${previous} ${line}`.replace(/[ \t]{2,}/g, " ");
    } else {
      joined.push(line);
    }
  }
  return joined.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function repairOcrText(raw: string): string {
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => {
      const leading = line.match(/^\s*/)?.[0] ?? "";
      const repaired = repairArrows(repairFormulaSpacing(repairHybridization(normalizeMarkers(line))));
      return isStructureLine(line) ? leading + repaired.trim() : repaired;
    });
  return joinBrokenLines(lines).trim();
}
