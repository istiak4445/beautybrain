export const SLIDE = { width: 13.333, height: 7.5 };

export type Box = { x: number; y: number; w: number; h: number };

export const MCQ_TEMPLATE = {
  slideSize: "LAYOUT_WIDE",
  bgColor: "000000",
  fontFace: "Kalpurush",
  footerFontFace: "Hind Siliguri",
  colors: {
    cyan: "00B8FF",
    cyanSoft: "29AFFF",
    white: "FFFFFF",
    darkBox: "171717",
    blueBorder: "2196F3",
    warning: "FFD166",
    questionGold: "ECB30E",
    borderYellow: "FFDF26",
  },
  positions: {
    logoLeft: { x: 0.43, y: 0.48, w: 1.78, h: 0.48 },
    logoRight: { x: 11.55, y: 0.48, w: 1.25, h: 0.48 },
    titleBox: { x: 4.9, y: 0.2, w: 3.34, h: 0.78 },
    questionBox: { x: 0.28, y: 1.18, w: 12.62, h: 1.38 },
    questionIcon: { x: 0.04, y: 1.54, w: 0.62, h: 0.96 },
    questionIconMask: { x: 0.12, y: 1.69, w: 0.42, h: 0.58 },
    questionText: { x: 0.78, y: 1.49, w: 9.85, h: 0.98 },
    questionRef: { x: 9.45, y: 1.94, w: 2.92, h: 0.58 },
    optionKa: { x: 8.15, y: 2.9, w: 4.55, h: 0.88 },
    optionKha: { x: 8.15, y: 3.76, w: 4.55, h: 0.88 },
    optionGa: { x: 8.15, y: 4.62, w: 4.55, h: 0.88 },
    optionGha: { x: 8.15, y: 5.48, w: 4.55, h: 0.88 },
    footerLine: { x: 0, y: 7.08, w: 13.333, h: 0 },
    chapterName: { x: 0.2, y: 7.2, w: 4.2, h: 0.24 },
    footerRight: { x: 10.65, y: 7.2, w: 2.45, h: 0.24 },
  },
} as const;

export function hasStructureDiagram(question: string) {
  return question.split("\n").some((line) => {
    const trimmed = line.trim();
    return /^[|=]+$/.test(trimmed) || /^\s{2,}\S/.test(line) || /(?:^|[–—-])C(?:[–—-]|$)/.test(trimmed);
  });
}

export function mcqSlidePositions(question: string) {
  const lines = question.split("\n").filter((line) => line.trim());
  const explicitLineCount = lines.length;
  const estimatedWrappedLines = lines.reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 72)), 0);
  const lineCount = Math.max(explicitLineCount, estimatedWrappedLines);
  const hasStatementList = /(?:^|\n)(?:i|ii|iii)\. /u.test(question);
  const isLongQuestion = question.replace(/\s+/g, " ").trim().length > 95;
  const hasDiagram = hasStructureDiagram(question);

  if (lineCount < 3 && !hasStatementList && !isLongQuestion && !hasDiagram) return MCQ_TEMPLATE.positions;

  const pressure = Math.max(lineCount - 2, isLongQuestion ? 1.8 : 0, hasDiagram ? lineCount * 0.78 : 0);
  const extra = Math.min(hasDiagram ? 1.65 : 1.26, Math.max(0.42, pressure * 0.34));
  const questionBox = { ...MCQ_TEMPLATE.positions.questionBox, h: MCQ_TEMPLATE.positions.questionBox.h + extra };
  const optionHeight = 0.72;
  const optionGap = 0.62;
  const naturalOptionY = MCQ_TEMPLATE.positions.optionKa.y + extra + 0.22;
  const questionAwareY = questionBox.y + questionBox.h + 0.42;
  const maxOptionY = MCQ_TEMPLATE.positions.footerLine.y - 0.28 - optionHeight - optionGap * 3;
  const optionY = Math.min(Math.max(naturalOptionY, questionAwareY), maxOptionY);

  return {
    ...MCQ_TEMPLATE.positions,
    questionBox,
    questionIcon: { ...MCQ_TEMPLATE.positions.questionIcon, y: MCQ_TEMPLATE.positions.questionIcon.y + extra / 2 },
    questionIconMask: { ...MCQ_TEMPLATE.positions.questionIconMask, y: MCQ_TEMPLATE.positions.questionIconMask.y + extra / 2 },
    questionText: {
      ...MCQ_TEMPLATE.positions.questionText,
      y: MCQ_TEMPLATE.positions.questionText.y - 0.04,
      h: MCQ_TEMPLATE.positions.questionText.h + extra + 0.12,
    },
    questionRef: { ...MCQ_TEMPLATE.positions.questionRef, y: MCQ_TEMPLATE.positions.questionRef.y + extra },
    optionKa: { ...MCQ_TEMPLATE.positions.optionKa, y: optionY, h: optionHeight },
    optionKha: { ...MCQ_TEMPLATE.positions.optionKha, y: optionY + optionGap, h: optionHeight },
    optionGa: { ...MCQ_TEMPLATE.positions.optionGa, y: optionY + optionGap * 2, h: optionHeight },
    optionGha: { ...MCQ_TEMPLATE.positions.optionGha, y: optionY + optionGap * 3, h: optionHeight },
  };
}

export function pct(box: Box) {
  return {
    left: `${(box.x / SLIDE.width) * 100}%`,
    top: `${(box.y / SLIDE.height) * 100}%`,
    width: `${(box.w / SLIDE.width) * 100}%`,
    height: `${(box.h / SLIDE.height) * 100}%`,
  };
}

export function framedQuestionTextPosition(positions: { questionBox: Box; questionText: Box }, _hasReference = false) {
  const rightEdge = positions.questionBox.x + positions.questionBox.w - 0.24;
  const x = 1.55;
  const y = positions.questionBox.y + (positions.questionBox.h - positions.questionText.h) / 2 - 0.03;
  return { ...positions.questionText, x, y, w: Math.max(1, rightEdge - x) };
}

export function framedQuestionIconPosition(positions: { questionBox: Box }) {
  const size = Math.min(0.78, Math.max(0.62, positions.questionBox.h - 0.42));
  return {
    x: positions.questionBox.x + 0.18,
    y: positions.questionBox.y + (positions.questionBox.h - size) / 2,
    w: size,
    h: size,
  };
}

export function questionFontSize(text: string) {
  if (hasStructureDiagram(text)) return 21;
  if (text.length > 230) return 22;
  if (text.length > 185) return 23;
  if (text.length > 145) return 25;
  if (text.length > 95) return 26;
  return 28;
}

export function optionFontSize(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length > 80) return 16;
  if (compact.length > 52) return 18;
  if (compact.length > 28) return 20;
  if (/[+→⇌=]/u.test(compact) && compact.length > 14) return 21;
  return 23;
}

export function optionPanelPositions(
  positions: { optionKa: Box; optionKha: Box; optionGa: Box; optionGha: Box },
  texts: Array<string | undefined>,
) {
  const longest = texts.reduce((max, text) => {
    const compact = (text ?? "").replace(/\s+/g, " ").trim();
    const latin = (compact.match(/[A-Za-z0-9₀-₉⁰-⁹]/g) ?? []).length;
    return Math.max(max, compact.length + latin * 0.25);
  }, 0);
  const x = Math.max(6.3, Math.min(9.25, 9.45 - longest * 0.04));
  const right = 12.7;
  const adjust = (box: Box): Box => ({ ...box, x, w: right - x });
  return {
    optionKa: adjust(positions.optionKa),
    optionKha: adjust(positions.optionKha),
    optionGa: adjust(positions.optionGa),
    optionGha: adjust(positions.optionGha),
  };
}


export function answerPosition(positions: { questionBox: Box }) {
  const y = Math.min(positions.questionBox.y + positions.questionBox.h + 0.48, 3.32);
  return { x: 1.1, y, w: 11.05, h: Math.max(0.9, MCQ_TEMPLATE.positions.footerLine.y - y - 0.38) };
}

export function answerFontSize(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  const lineCount = text.split("\n").filter((line) => line.trim()).length;
  const structurePressure = hasStructureDiagram(text) ? 2 : 0;
  const pressure = Math.max(lineCount + structurePressure, Math.ceil(compact.length / 54));
  if (pressure > 18 || compact.length > 700) return 15;
  if (pressure > 14 || compact.length > 560) return 17;
  if (pressure > 10 || compact.length > 400) return 19;
  if (compact.length > 260) return 21;
  return 24;
}
