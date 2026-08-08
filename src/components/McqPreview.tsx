import { ChevronLeft, ChevronRight } from "lucide-react";
import { MCQItem } from "../lib/mcqParser";
import questionBulb from "../assets/question-bulb.png";
import mcqTitleBox from "../assets/mcq-title-box-yellow.png";
import { Box, MCQ_TEMPLATE, framedQuestionIconPosition, framedQuestionTextPosition, hasStructureDiagram, mcqSlidePositions, optionFontSize, optionPanelPositions, pct, questionFontSize } from "../lib/mcqTemplate";
import { splitQuestionReference } from "../lib/questionText";
import { prepareReactionLayoutText } from "../lib/reactionText";
import { ReactionText } from "./ReactionText";
import { SlideLogos } from "../lib/slideLogos";

type Props = {
  items: MCQItem[];
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  chapterName: string;
  footerRight: string;
  logos: SlideLogos;
};

export function McqPreview({ items, currentIndex, setCurrentIndex, chapterName, footerRight, logos }: Props) {
  const item = items[currentIndex];
  const safeIndex = items.length === 0 ? 0 : Math.min(currentIndex, items.length - 1);
  const T = MCQ_TEMPLATE;
  const questionParts = splitQuestionReference(item?.question ?? "");
  const positions = mcqSlidePositions(prepareReactionLayoutText(questionParts.main));
  const framedQuestionText = framedQuestionTextPosition(positions, Boolean(questionParts.reference));
  const framedQuestionIcon = framedQuestionIconPosition(positions);
  const optionPositions = optionPanelPositions(positions, [item?.options.ka, item?.options.kha, item?.options.ga, item?.options.gha]);

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
          <div className="title-box-text" style={pct(T.positions.titleBox)}>MCQ</div>
          <div className="question-box-frame" style={pct(positions.questionBox)} />
          <img className="question-bulb-img" src={questionBulb} alt="" style={pct(framedQuestionIcon)} />
          <ReactionText
            className={`question-text${hasStructureDiagram(questionParts.main) ? " structure-question" : ""}`}
            style={{ ...pct(framedQuestionText), fontSize: `${questionFontSize(questionParts.main) * 0.84}px` }}
            text={questionParts.main}
            fallback="Paste MCQ text to preview the generated slide"
          />
          {questionParts.reference ? (
            <div className="question-ref" style={{ ...pct(positions.questionRef), fontSize: `${referenceFontSize(questionParts.reference)}px` }}>{questionParts.reference}</div>
          ) : null}
          <Option label="ক" text={item?.options.ka} box={optionPositions.optionKa} />
          <Option label="খ" text={item?.options.kha} box={optionPositions.optionKha} />
          <Option label="গ" text={item?.options.ga} box={optionPositions.optionGa} />
          <Option label="ঘ" text={item?.options.gha} box={optionPositions.optionGha} />
          <div className="footer-line mcq-footer-line" style={pct(T.positions.footerLine)} />
          <div className="footer-text chapter" style={pct(T.positions.chapterName)}>{chapterName || "সঞ্জয় চক্রবর্তী"}</div>
          <div className="footer-text footer-right" style={pct(T.positions.footerRight)}>{footerRight || "জৈব রসায়ন"}</div>
        </div>
      </div>
      {item?.warnings?.length ? (
        <div className="preview-warnings">
          {item.warnings.map((warning) => <span key={warning}>{warning}</span>)}
        </div>
      ) : null}
    </section>
  );
}

function Option({ label, text, box }: { label: string; text?: string; box: Box }) {
  return (
    <div className="option-text" style={{ ...pct(box as never), fontSize: `${optionFontSize(text ?? "") * 0.78}px` }}>
      <span>{label})</span> {text ?? "—"}
    </div>
  );
}

function referenceFontSize(text: string) {
  if (text.length > 30) return 13;
  if (text.length > 22) return 14;
  if (text.length > 16) return 15;
  return 16;
}
