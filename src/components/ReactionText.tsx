import { CSSProperties } from "react";
import { splitEnglishParentheticals } from "../lib/questionText";
import { prepareReactionDisplayText, splitInlineReactionSegments, type ReactionLine } from "../lib/reactionText";

type Props = {
  text: string;
  className?: string;
  style?: CSSProperties;
  fallback?: string;
  renderReactions?: boolean;
};

function looksLikeStructureLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^[|\/\-–—=\s]+$/u.test(line)) return true;
  const asciiLike = /^[A-Za-z0-9₀-₉⁰-⁹+*()|\/\-–—=⇌→\s]+$/u.test(line);
  return asciiLike && /(?:CH|CO|OH|C\s*=\s*C|[|\/])/u.test(line);
}

function renderEnglishAwareLine(line: string) {
  return splitEnglishParentheticals(line).map((part, index) => (
    <span className={part.english ? "english-inline" : undefined} key={`${index}-${part.text}`}>{part.text}</span>
  ));
}

function reactionScale() {
  // Keep equations at the surrounding text size. The reaction row is already
  // non-wrapping, so shrinking it again based only on character count makes
  // otherwise readable organic equations disproportionately small.
  return "1em";
}

function renderReactionLine(reaction: ReactionLine, keyPrefix: string) {
  return (
    <span className="reaction-line" key={keyPrefix}>
      {reaction.parts.map((part, index) => (
        <span className="reaction-unit" key={`${keyPrefix}-${index}-${part}`}>
          <span className="reaction-part">{part}</span>
          {reaction.arrows[index] ? (
            <span className="reaction-arrow-wrap">
              <span className="reaction-label top">{reaction.arrows[index].top || " "}</span>
              <span className="reaction-arrow">{reaction.arrows[index].reversible ? "⇌" : "→"}</span>
              <span className="reaction-label bottom">{reaction.arrows[index].bottom || " "}</span>
            </span>
          ) : null}
        </span>
      ))}
    </span>
  );
}

export function ReactionText({ text, className, style, fallback, renderReactions = true }: Props) {
  const content = text || fallback || "";
  const displayContent = renderReactions ? prepareReactionDisplayText(content) : content;
  return (
    <div className={className} style={style}>
      {displayContent.split("\n").map((line, lineIndex) => {
        if (renderReactions) {
          const segments = splitInlineReactionSegments(line);
          if (segments.some((segment) => segment.type === "reaction")) {
            return (
              <span className="plain-line mixed-reaction-line" key={`${lineIndex}-${line}`}>
                {segments.map((segment, segmentIndex) =>
                  segment.type === "reaction"
                    ? <span className="mixed-reaction-segment" style={{ "--reaction-scale": reactionScale() } as CSSProperties} key={`${lineIndex}-${segmentIndex}-${segment.text}`}>{renderReactionLine(segment.reaction, `${lineIndex}-${segmentIndex}-${segment.text}-reaction`)}</span>
                    : <span className="mixed-text-segment" key={`${lineIndex}-${segmentIndex}-${segment.text}`}>{renderEnglishAwareLine(segment.text)}</span>,
                )}
              </span>
            );
          }
        }

        const lineClass = looksLikeStructureLine(line) ? "plain-line structure-line" : "plain-line";
        return <span className={lineClass} key={`${lineIndex}-${line}`}>{renderEnglishAwareLine(line)}</span>;
      })}
    </div>
  );
}
