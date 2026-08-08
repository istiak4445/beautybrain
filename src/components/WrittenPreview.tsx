import { ChevronLeft, ChevronRight } from "lucide-react";
import mcqTitleBox from "../assets/mcq-title-box-yellow.png";
import { MCQ_TEMPLATE, answerFontSize, answerPosition, hasStructureDiagram, mcqSlidePositions, pct, questionFontSize } from "../lib/mcqTemplate";
import { splitQuestionReference } from "../lib/questionText";
import { prepareReactionLayoutText } from "../lib/reactionText";
import { WrittenQAItem } from "../lib/writtenParser";
import { ReactionText } from "./ReactionText";
import { SlideLogos } from "../lib/slideLogos";

type Props = {
  items: WrittenQAItem[];
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  chapterName: string;
  footerRight: string;
  logos: SlideLogos;
};

export function WrittenPreview({ items, currentIndex, setCurrentIndex, chapterName, footerRight, logos }: Props) {
  const item = items[currentIndex];
  const safeIndex = items.length === 0 ? 0 : Math.min(currentIndex, items.length - 1);
  const T = MCQ_TEMPLATE;
  const questionParts = splitQuestionReference(item?.question ?? "");
  const positions = mcqSlidePositions(prepareReactionLayoutText(questionParts.main));
  const answerBox = answerPosition(positions);
  const answerText = item?.answer ?? "";

  const move = (direction: -1 | 1) => {
    if (!items.length) return;
    setCurrentIndex(Math.max(0, Math.min(items.length - 1, safeIndex + direction)));
  };

  return (
    <section className="panel slide-preview-panel">
      <div className="panel-heading">
        <h2>Slide Preview</h2>
        <div className="slide-nav">
          <button type="button" className="icon-btn" onClick={() => move(-1)} disabled={safeIndex <= 0} title="Previous slide">
            <ChevronLeft size={18} />
          </button>
          <span>{items.length ? `${safeIndex + 1} / ${items.length}` : "0 / 0"}</span>
          <button type="button" className="icon-btn" onClick={() => move(1)} disabled={!items.length || safeIndex >= items.length - 1} title="Next slide">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="slide-shell">
        <div className="slide-canvas">
          {logos.left ? <img className="slide-logo acs-logo" src={logos.left.src} alt="Left logo" style={pct(T.positions.logoLeft)} /> : null}
          {logos.right ? <img className="slide-logo chemshifu-logo" src={logos.right.src} alt="Right logo" style={pct(T.positions.logoRight)} /> : null}
          <img className="title-box-img" src={mcqTitleBox} alt="" style={pct(T.positions.titleBox)} />
          <div className="title-box-text written-title" style={pct(T.positions.titleBox)}>Written</div>
          <ReactionText
            className={`question-text${hasStructureDiagram(questionParts.main) ? " structure-question" : ""}`}
            style={{ ...pct(positions.questionText), fontSize: `${questionFontSize(questionParts.main) * 0.84}px` }}
            text={questionParts.main}
            fallback="Paste written Q&A text to preview the generated slide"
          />
          {questionParts.reference ? (
            <div className="question-ref" style={{ ...pct(positions.questionRef), fontSize: `${referenceFontSize(questionParts.reference)}px` }}>{questionParts.reference}</div>
          ) : null}
          {answerText ? (
            <ReactionText
              className="answer-text"
              style={{ ...pct(answerBox), fontSize: `${answerFontSize(answerText) * 0.78}px` }}
              text={answerText}
            />
          ) : null}
          <div className="footer-line mcq-footer-line" style={pct(T.positions.footerLine)} />
          <div className="footer-text chapter" style={pct(T.positions.chapterName)}>{chapterName || "সঞ্জয় চক্রবর্তী"}</div>
          <div className="footer-text footer-right" style={pct(T.positions.footerRight)}>{footerRight || "জৈব রসায়ন"}</div>
        </div>
      </div>
    </section>
  );
}

function referenceFontSize(text: string) {
  if (text.length > 30) return 13;
  if (text.length > 22) return 14;
  if (text.length > 16) return 15;
  return 16;
}

function isStructureAnswerLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^[|\/\-–—=\s]+$/u.test(line)) return true;
  const asciiLike = /^[A-Za-z0-9₀-₉⁰-⁹+*()|\/\-–—=⇌→\s]+$/u.test(line);
  return asciiLike && /(?:CH|CO|OH|C\s*=\s*C|[|\/])/u.test(line);
}
