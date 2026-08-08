import { convertToWordFriendly } from "./textConvert";
import { repairOcrText } from "./repairOcrText";

export type ReactionArrow = {
  top?: string;
  bottom?: string;
  reversible?: boolean;
};

export type ReactionLine = {
  parts: string[];
  arrows: ReactionArrow[];
};

export type ReactionTextSegment =
  | { type: "text"; text: string }
  | { type: "reaction"; text: string; reaction: ReactionLine };

const arrowToken = "\uE300";

const letteredReactionMarker = /(?:\(?[a-f]\)|[a-f][.)])\s*$/iu;

/**
 * Repairs OCR line breaks for display only. This deliberately sits outside the
 * MCQ/Written parsers: lettered reaction prompts such as `a) ... → b)` use the
 * next letter as the following reaction's marker, not as the current product.
 */
export function prepareReactionDisplayText(text: string) {
  const output: string[] = [];
  let pendingMarker = "";
  const expandedText = text.replace(
    /[ \t]+((?:[a-f][.)]|\([a-f]\)))(?=[ \t]+(?:\(?[A-Z0-9_]))/gu,
    "\n$1",
  );

  for (const rawLine of expandedText.split("\n")) {
    let line = rawLine.trimEnd();
    const markerAtEnd = line.match(letteredReactionMarker);
    const hasArrow = /(?:→|⇌|->|=>|= >)/u.test(line);

    if (!hasArrow && markerAtEnd) {
      pendingMarker = markerAtEnd[0].trim();
      line = line.slice(0, markerAtEnd.index).trimEnd();
      if (line) output.push(line);
      continue;
    }

    if (pendingMarker && line.trim()) {
      line = `${pendingMarker} ${line.trimStart()}`;
      pendingMarker = "";
    }

    if (hasArrow) {
      const trailingMarker = line.match(letteredReactionMarker);
      if (trailingMarker && trailingMarker.index != null && /(?:→|⇌|->|=>|= >)\s*$/u.test(line.slice(0, trailingMarker.index))) {
        pendingMarker = trailingMarker[0].trim();
        line = `${line.slice(0, trailingMarker.index).trimEnd()} ______`;
      }

      line = line.replace(/(→|⇌|->|=>|= >)\s*(?=[—–-]+\s*[^\n→⇌]{1,60}?(?:→|⇌|->))/gu, "$1 ______ ");
      if (/(?:→|⇌|->|=>|= >)\s*$/u.test(line)) line = `${line} ______`;
    }

    output.push(line);
  }

  if (pendingMarker) output.push(pendingMarker);
  return output.join("\n");
}

export function prepareReactionLayoutText(text: string) {
  const displayText = prepareReactionDisplayText(text);
  const reactionRows = displayText.split("\n").filter((line) => /(?:→|⇌|->|=>|= >)/u.test(line)).length;
  if (!reactionRows) return displayText;

  // Arrow labels occupy space above/below the baseline. Add virtual rows only
  // for box measurement; these are never rendered as visible text.
  const verticalAllowance = Array.from({ length: reactionRows * 2 }, () => "  reaction-label-space").join("\n");
  return `${displayText}\n${verticalAllowance}`;
}

function normalizeArrowSyntax(text: string) {
  return text
    .replace(/\s*[—–-]{1,}\s*\[([^\]]+)\]\s*(?:→|->)\s*/g, (_, label: string) => `${arrowToken}${label.trim()}${arrowToken}→`)
    .replace(/\s*[—–-]{2,}\s*([^\n→⇌—–-]{1,60}?)\s*[—–-]{1,}>\s*/g, (_, label: string) => `${arrowToken}${label.trim()}${arrowToken}→`)
    .replace(/\s*[—–]\s*([^\n→⇌—–]{1,60}?)\s*(?:→|->)\s*/g, (_, label: string) => `${arrowToken}${label.trim()}${arrowToken}→`)
    .replace(/\s*\\rightarrow\s*/g, " → ")
    .replace(/(^|[^-])\s*(?:=>|= >|->)\s*/g, "$1 → ")
    .replace(/\s*(?:⇌|\\rightleftharpoons|rightleftharpoons)\s*/g, " ⇌ ");
}


function convertReactionText(value: string) {
  return convertToWordFriendly(repairOcrText(value.trim()).replace(/\n+/g, " "));
}

function splitLabel(label: string) {
  const converted = convertReactionText(label);
  const pieces = converted.split(/[\\/]+/).map((piece) => piece.trim()).filter(Boolean);
  if (pieces.length <= 1) return { top: converted };
  return { top: pieces[0], bottom: pieces.slice(1).join(", ") };
}

export function parseReactionLine(text: string): ReactionLine | null {
  const source = normalizeArrowSyntax(text.trim());
  if (!/(?:→|⇌|\uE300)/u.test(source)) return null;

  const parts: string[] = [];
  const arrows: ReactionArrow[] = [];
  let cursor = 0;
  const pattern = new RegExp(`${arrowToken}([^${arrowToken}]+)${arrowToken}(→|⇌)|([→⇌])`, "gu");
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source))) {
    const part = source.slice(cursor, match.index).trim();
    if (!part) return null;
    parts.push(convertReactionText(part));
    if (match[1]) {
      arrows.push({ ...splitLabel(match[1]), reversible: match[2] === "⇌" });
    } else {
      arrows.push({ reversible: match[3] === "⇌" });
    }
    cursor = match.index + match[0].length;
  }

  const last = source.slice(cursor).trim();
  if (!last || parts.length !== arrows.length) return null;
  parts.push(convertReactionText(last));

  return parts.length >= 2 ? { parts, arrows } : null;
}

export function hasReactionLine(text: string) {
  return text.split("\n").some((line) => parseReactionLine(line));
}


const reactionArrowPattern = /(?:→|⇌|->|=>|= >|[—–-]+\s*[^\n→⇌—–-]{1,80}?\s*(?:→|->))/gu;
const reactionToken = String.raw`(?:_{2,}|[A-Za-z0-9₀-₉⁰-⁹_{}^()[\]+.=—–-]+(?:\s*\+\s*(?:_{2,}|[A-Za-z0-9₀-₉⁰-⁹_{}^()[\]+.=—–-]+))*)`;

function looksLikeReactionSide(text: string) {
  return /_{2,}/u.test(text) || /(?:[A-Z][a-z]?|[A-Z]|[০-৯0-9₀-₉]|[()+=])/u.test(text);
}

function trimTrailingExplanation(text: string) {
  const bangla = text.search(/\s(?:এক্ষেত্রে|উপরের|নিচের|কোন|উদ্দীপকের|শূন্যস্থান|প্রদত্ত|বিক্রিয়া|বিক্রিয়ায়|এদের|নির্ণয়|কর|লিখ)\b/u);
  const english = text.search(/\s\((?:In this case|Determine|Which|What|Write|Fill|The compound|The product)\b/iu);
  const cutPoints = [bangla, english].filter((point) => point >= 0);
  const trimmed = cutPoints.length ? text.slice(0, Math.min(...cutPoints)).trim() : text.trim();
  return trimmed.replace(/\(\s*$/u, "").trimEnd();
}

function findReactionStart(line: string, arrowIndex: number) {
  const prefix = line.slice(0, arrowIndex);
  const romanMatches = Array.from(prefix.matchAll(/(?:^|\s)\((?:i|ii|iii|iv|v)\)\s*/giu));
  if (romanMatches.length) return romanMatches[romanMatches.length - 1].index ?? 0;

  const letterMatches = Array.from(prefix.matchAll(/(?:^|\s)(?:[a-f][.)]|\([a-f]\))\s*/gu));
  if (letterMatches.length) return letterMatches[letterMatches.length - 1].index ?? 0;

  const tail = prefix.match(/(?:^|\s)([A-Z0-9₀-₉][A-Za-z0-9₀-₉⁰-⁹()₂₃₄₅₆₇₈₉₀=+–—-]*(?:\s*\+\s*[A-Z0-9₀-₉][A-Za-z0-9₀-₉⁰-⁹()₂₃₄₅₆₇₈₉₀=+–—-]*)*)\s*$/u);
  if (tail?.index != null) return tail.index + tail[0].search(/\S/u);

  let index = arrowIndex;
  while (index > 0 && !/[,;।]/u.test(line[index - 1])) index -= 1;
  while (index < arrowIndex && /\s/u.test(line[index])) index += 1;
  return index;
}

function findReactionEnd(line: string, start: number) {
  let bestEnd = -1;
  const arrowPattern = new RegExp(reactionArrowPattern.source, 'gu');
  arrowPattern.lastIndex = start;
  let match: RegExpExecArray | null;

  while ((match = arrowPattern.exec(line))) {
    if (bestEnd >= 0) {
      const betweenReactions = line.slice(bestEnd, match.index);
      if (/[;?।\u0980-\u09FF]|\b(?:in|what|which|the|this|name|compound)\b/iu.test(betweenReactions)) break;
    }
    const afterArrow = match.index + match[0].length;
    const rest = line.slice(afterArrow);
    const nextToken = rest.match(new RegExp('^\\s*(' + reactionToken + ')', 'u'));
    if (nextToken && looksLikeReactionSide(nextToken[1])) {
      bestEnd = afterArrow + nextToken[0].length;
      arrowPattern.lastIndex = bestEnd;
      continue;
    }

    const nextArrowIndex = rest.search(new RegExp(reactionArrowPattern.source, 'u'));
    const explanationMatch = rest.match(/\s(?:এক্ষেত্রে|কোনটি|কী\??|\((?:In this case|Which|What|The compound|The product)\b)/iu);
    const explanationIndex = explanationMatch?.index ?? -1;
    const boundaries = [nextArrowIndex, explanationIndex].filter((index) => index > 0);
    const sideEnd = boundaries.length ? Math.min(...boundaries) : -1;
    if (sideEnd < 0 || !rest.slice(0, sideEnd).trim()) break;
    bestEnd = afterArrow + sideEnd;
    arrowPattern.lastIndex = bestEnd;
  }

  return bestEnd;
}

function splitFirstInlineReaction(line: string): ReactionTextSegment[] {
  const normalized = line.trimEnd();
  const arrowPattern = new RegExp(reactionArrowPattern.source, 'u');
  const firstArrow = normalized.search(arrowPattern);
  if (firstArrow < 0) return [{ type: 'text', text: line }];

  const start = findReactionStart(normalized, firstArrow);
  const end = findReactionEnd(normalized, start);
  if (end <= start) return [{ type: 'text', text: line }];

  const candidate = trimTrailingExplanation(normalized.slice(start, end));
  const reaction = parseReactionLine(candidate);
  if (!reaction) return [{ type: 'text', text: line }];

  const before = normalized.slice(0, start);
  const after = normalized.slice(start + candidate.length);
  const segments: ReactionTextSegment[] = [];
  if (before.trim() && !/^[_\s—–-]+$/u.test(before)) segments.push({ type: 'text', text: before });
  segments.push({ type: 'reaction', text: candidate, reaction });
  if (after.trim() && !/^[_\s—–-]+$/u.test(after)) segments.push({ type: 'text', text: after });
  return segments;
}

export function splitInlineReactionSegments(line: string): ReactionTextSegment[] {
  const segments: ReactionTextSegment[] = [];
  let remaining = line;

  while (remaining.trim()) {
    const next = splitFirstInlineReaction(remaining);
    const reactionIndex = next.findIndex((segment) => segment.type === "reaction");
    if (reactionIndex < 0) {
      segments.push({ type: "text", text: remaining });
      break;
    }

    segments.push(...next.slice(0, reactionIndex + 1));
    const trailing = next.slice(reactionIndex + 1).map((segment) => segment.text).join("");
    if (!trailing.trim() || trailing === remaining) {
      if (trailing.trim()) segments.push({ type: "text", text: trailing });
      break;
    }
    remaining = trailing;
  }

  return segments.length ? segments : [{ type: "text", text: line }];
}
