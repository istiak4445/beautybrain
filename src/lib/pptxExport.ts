import pptxgen from "pptxgenjs";
import questionBulb from "../assets/question-bulb.png";
import mcqTitleBoxYellow from "../assets/mcq-title-box-yellow.png";
import { MCQItem } from "./mcqParser";
import { WrittenQAItem, paginateWrittenSlides } from "./writtenParser";
import { Box, MCQ_TEMPLATE, SLIDE, answerFontSize, answerPosition, framedQuestionIconPosition, framedQuestionTextPosition, hasStructureDiagram, mcqSlidePositions, optionFontSize, optionPanelPositions, questionFontSize } from "./mcqTemplate";
import { splitEnglishParentheticals, splitQuestionReference } from "./questionText";
import { parseReactionLine, prepareReactionDisplayText, prepareReactionLayoutText, splitInlineReactionSegments } from "./reactionText";
import { DEFAULT_SLIDE_LOGOS, SlideLogos } from "./slideLogos";

const T = MCQ_TEMPLATE;

const IMAGE_SIZES = {
  mcqTitleBox: { width: 1981, height: 468 },
};

function containImage(box: Box, image: { width: number; height: number }): Box {
  const imageRatio = image.width / image.height;
  const boxRatio = box.w / box.h;

  if (boxRatio > imageRatio) {
    const w = box.h * imageRatio;
    return { ...box, x: box.x + (box.w - w) / 2, w };
  }

  const h = box.w / imageRatio;
  return { ...box, y: box.y + (box.h - h) / 2, h };
}

function complete(item: MCQItem) {
  return Boolean(item.question && item.options.ka && item.options.kha && item.options.ga && item.options.gha);
}

const imageCache = new Map<string, string>();

async function imageToDataUri(src: string) {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const response = await fetch(src);
  const blob = await response.blob();
  const dataUri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  imageCache.set(src, dataUri);
  return dataUri;
}

async function addLogoImages(slide: pptxgen.Slide, logos: SlideLogos) {
  if (logos.left) {
    const data = await imageToDataUri(logos.left.src);
    slide.addImage({ data, ...containImage(T.positions.logoLeft, logos.left) });
  }
  if (logos.right) {
    const data = await imageToDataUri(logos.right.src);
    slide.addImage({ data, ...containImage(T.positions.logoRight, logos.right) });
  }
}

function referenceFontSize(text: string) {
  if (text.length > 30) return 13;
  if (text.length > 22) return 14;
  if (text.length > 16) return 15;
  return 16;
}



function addPlainText(slide: pptxgen.Slide, text: string, box: Box, options: pptxgen.TextPropsOptions) {
  const segments = splitEnglishParentheticals(text);
  if (segments.some((segment) => segment.english)) {
    const runs = segments.map((segment) => ({
      text: segment.text,
      options: segment.english
        ? { fontSize: Math.max(7, Math.round(Number(options.fontSize ?? 18) * 0.82)), bold: true }
        : {},
    }));
    slide.addText(runs as never, { ...box, ...options });
    return;
  }

  slide.addText(text, { ...box, ...options });
}

function estimateTextWidth(text: string, fontSize: number) {
  const compact = text.replace(/\s+/g, " ").trim();
  const chars = Array.from(compact).length;
  const latin = (compact.match(/[A-Za-z0-9₀-₉⁰-⁹()[\]{}+\-=]/g) ?? []).length;
  const other = Math.max(0, chars - latin);
  return Math.max(0.46, latin * fontSize * 0.0078 + other * fontSize * 0.0105, chars * fontSize * 0.0068);
}

function wrappedTextHeight(text: string, normalH: number) {
  const compactLength = Array.from(text.replace(/\s+/g, " ").trim()).length;
  return normalH * Math.max(1, Math.ceil(compactLength / 72));
}

function reactionFontMultiplier() {
  // Width fitting below is the single source of truth for reaction sizing.
  // A second character-count reduction made long organic equations much
  // smaller than the surrounding question/answer text.
  return 1.05;
}

function addReactionLine(
  pptx: ReturnType<typeof createDeck>,
  slide: pptxgen.Slide,
  line: string,
  box: Box,
  y: number,
  fontSize: number,
  color: string,
  fontFace: string,
  bold: boolean,
): number {
  const reaction = parseReactionLine(line);
  if (!reaction) return 0;

  const basePartWidths = reaction.parts.map((part) => estimateTextWidth(part, fontSize) + 0.16);
  const baseArrowWidths = reaction.arrows.map((arrow) =>
    Math.max(1.02, estimateTextWidth(`${arrow.top ?? ""}${arrow.bottom ?? ""}`, fontSize) + 0.5),
  );
  const naturalW = basePartWidths.reduce((sum, value) => sum + value, 0) + baseArrowWidths.reduce((sum, value) => sum + value, 0);
  const fontScale = naturalW > box.w ? Math.max(0.72, box.w / naturalW) : 1;
  const adjustedFont = Math.max(20, Math.floor(fontSize * fontScale));
  const labelFont = Math.max(11, Math.round(adjustedFont * 0.58));
  const lineH = Math.max(0.34, (adjustedFont / 72) * 1.38);
  const reactionH = Math.max(0.54, lineH * 1.52);
  const partWidths = reaction.parts.map((part) => Math.max(estimateTextWidth(part, adjustedFont) + 0.18, 0.48));
  const arrowWidths = reaction.arrows.map((arrow) =>
    Math.max(0.92, estimateTextWidth(`${arrow.top ?? ""}${arrow.bottom ?? ""}`, adjustedFont) + 0.42),
  );
  const adjustedNaturalW = partWidths.reduce((sum, value) => sum + value, 0) + arrowWidths.reduce((sum, value) => sum + value, 0);
  const widthScale = adjustedNaturalW > box.w ? Math.max(0.78, box.w / adjustedNaturalW) : 1;
  let x = box.x;

  reaction.parts.forEach((part, index) => {
    const partW = Math.max(partWidths[index] * widthScale, estimateTextWidth(part, adjustedFont) + 0.1);
    slide.addText(part, {
      x,
      y: y + (reactionH - lineH) / 2,
      w: partW,
      h: lineH,
      color,
      fontFace,
      bold,
      fontSize: adjustedFont,
      fit: "shrink",
      margin: 0,
      breakLine: false,
      valign: "middle",
    });
    x += partW;

    const arrow = reaction.arrows[index];
    if (!arrow) return;
    const arrowW = Math.max(arrowWidths[index] * widthScale, 0.78);
    if (arrow.top) {
      slide.addText(arrow.top, {
        x,
        y,
        w: arrowW,
        h: lineH * 0.62,
        color,
        fontFace,
        bold,
        fontSize: labelFont,
        align: "center",
        fit: "shrink",
        margin: 0,
      });
    }
    if (arrow.bottom) {
      slide.addText(arrow.bottom, {
        x,
        y: y + reactionH - lineH * 0.54,
        w: arrowW,
        h: lineH * 0.62,
        color,
        fontFace,
        bold,
        fontSize: labelFont,
        align: "center",
        fit: "shrink",
        margin: 0,
      });
    }
    if (arrow.reversible) {
      slide.addText("⇌", {
        x,
        y: y + lineH * 0.42,
        w: arrowW,
        h: lineH,
        color,
        fontFace: "Arial",
        bold: true,
        fontSize: adjustedFont,
        align: "center",
        fit: "shrink",
        margin: 0,
      });
    } else {
      slide.addShape(pptx.ShapeType.line, {
        x: x + 0.06,
        y: y + reactionH / 2,
        w: Math.max(0.1, arrowW - 0.12),
        h: 0,
        line: { color, width: 1.4, endArrowType: "triangle" } as never,
      });
    }
    x += arrowW;
  });

  return reactionH;
}

function addQuestionPlainText(slide: pptxgen.Slide, text: string, box: Box, options: pptxgen.TextPropsOptions) {
  const normalized = text
    .replace(/\s*[—–-]+\s*([^\n→⇌—–-]{1,40}?)\s*(?:→|->)/g, (_match, label: string) => {
      const clean = label.trim();
      return clean ? " —" + clean + "→ " : " → ";
    })
    .replace(/\s{2,}/g, " ")
    .trim();
  addPlainText(slide, normalized, box, options);
}

function addReactionAwareText(
  pptx: ReturnType<typeof createDeck>,
  slide: pptxgen.Slide,
  text: string,
  box: Box,
  options: pptxgen.TextPropsOptions,
) {
  const lines = prepareReactionDisplayText(text).split("\n");
  const hasAnyReaction = lines.some((line) => parseReactionLine(line) || splitInlineReactionSegments(line).some((segment) => segment.type === "reaction"));
  if (!hasAnyReaction) {
    addPlainText(slide, text, box, options);
    return;
  }

  const fontSize = Number(options.fontSize ?? 18);
  const color = String(options.color ?? T.colors.white);
  const fontFace = String(options.fontFace ?? T.fontFace);
  const bold = Boolean(options.bold);
  const normalH = Math.max(0.25, (fontSize / 72) * 1.35);
  let y = box.y;

  for (const line of lines) {
    if (y > box.y + box.h) break;
    const segments = splitInlineReactionSegments(line);
    if (segments.some((segment) => segment.type === "reaction")) {
      for (const segment of segments) {
        if (y > box.y + box.h) break;
        if (segment.type === "reaction") {
          const reactionFontSize = Math.max(22, fontSize * reactionFontMultiplier());
          const inlineReactionHeight = addReactionLine(pptx, slide, segment.text, box, y, reactionFontSize, color, fontFace, bold);
          y += inlineReactionHeight || normalH;
        } else if (segment.text.trim()) {
          const segmentHeight = wrappedTextHeight(segment.text, normalH);
          addPlainText(slide, segment.text.trim(), { x: box.x, y, w: box.w, h: segmentHeight }, {
            ...options,
            fit: "shrink",
            margin: 0,
          });
          y += segmentHeight;
        }
      }
      continue;
    }

    const lineHeight = wrappedTextHeight(line, normalH);
    addPlainText(slide, line || " ", { x: box.x, y, w: box.w, h: lineHeight }, {
      ...options,
      fit: "shrink",
      margin: 0,
    });
    y += lineHeight;
  }
}

function createDeck() {
  const pptx = new pptxgen();
  pptx.defineLayout({ name: "CHEMSHIFU_WIDE", width: SLIDE.width, height: SLIDE.height });
  pptx.layout = "CHEMSHIFU_WIDE";
  pptx.author = "ChemShifu MCQ PPTX Generator";
  pptx.subject = "Editable slides generated locally in browser";
  pptx.company = "ChemShifu";
  pptx.theme = {
    headFontFace: T.fontFace,
    bodyFontFace: T.fontFace,
  };
  return pptx;
}

async function addBaseSlide(pptx: ReturnType<typeof createDeck>, slide: pptxgen.Slide, title = "MCQ", logos = DEFAULT_SLIDE_LOGOS) {
  slide.background = { color: T.bgColor };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: SLIDE.width,
    h: SLIDE.height,
    fill: { color: T.bgColor },
    line: { color: T.bgColor, transparency: 100 },
  });
  await addLogoImages(slide, logos);

  const titleBoxData = await imageToDataUri(mcqTitleBoxYellow);
  slide.addImage({ data: titleBoxData, ...containImage(T.positions.titleBox, IMAGE_SIZES.mcqTitleBox) });
  slide.addText(title, {
    ...T.positions.titleBox,
    color: T.colors.questionGold,
    fontFace: "Century Gothic",
    bold: true,
    align: "center",
    valign: "middle",
    fontSize: title === "Written" ? 22 : 27,
    margin: 0,
    fit: "shrink",
  });
}

async function addQuestion(pptx: ReturnType<typeof createDeck>, slide: pptxgen.Slide, question: string, renderReactions = true) {
  const questionParts = splitQuestionReference(question);
  const positions = mcqSlidePositions(prepareReactionLayoutText(questionParts.main));
  const questionTextOptions = {
    color: T.colors.questionGold,
    fontFace: hasStructureDiagram(questionParts.main) ? "Courier New" : T.fontFace,
    bold: true,
    fontSize: questionFontSize(questionParts.main),
    fit: "shrink",
    valign: "middle",
    margin: 0,
  };
  if (renderReactions) addReactionAwareText(pptx, slide, questionParts.main, positions.questionText, questionTextOptions);
  else addQuestionPlainText(slide, questionParts.main, positions.questionText, questionTextOptions);
  if (questionParts.reference) {
    slide.addText(questionParts.reference, {
      ...positions.questionRef,
      color: T.colors.white,
      fontFace: T.fontFace,
      bold: true,
      fontSize: referenceFontSize(questionParts.reference),
      fit: "shrink",
      align: "right",
      valign: "middle",
      margin: 0,
    });
  }
  return { positions, questionParts };
}

function addFooter(pptx: ReturnType<typeof createDeck>, slide: pptxgen.Slide, chapterName: string, footerRight: string) {
  slide.addShape(pptx.ShapeType.line, {
    x: T.positions.footerLine.x,
    y: T.positions.footerLine.y,
    w: T.positions.footerLine.w,
    h: 0,
    line: { color: T.colors.borderYellow, width: 1.2, transparency: 80 },
  });
  slide.addText(chapterName || "অধ্যায়", {
    ...T.positions.chapterName,
    color: T.colors.white,
    fontFace: T.footerFontFace,
    bold: true,
    fontSize: 14,
    fit: "shrink",
    margin: 0,
  });
  slide.addText(footerRight || "জৈব রসায়ন", {
    ...T.positions.footerRight,
    color: T.colors.white,
    fontFace: T.footerFontFace,
    bold: true,
    fontSize: 14,
    align: "right",
    fit: "shrink",
    margin: 0,
  });
}

function addOption(slide: pptxgen.Slide, label: string, text: string | undefined, box: Box) {
  slide.addText(`${label})  ${text ?? ""}`, {
    ...box,
    color: T.colors.questionGold,
    fontFace: T.fontFace,
    fontSize: optionFontSize(text ?? ""),
    bold: true,
    breakLine: false,
    align: "left",
    valign: "middle",
    margin: 0.02,
  });
}

export async function exportMcqPptx(items: MCQItem[], chapterName: string, footerRight: string, logos = DEFAULT_SLIDE_LOGOS): Promise<Blob> {
  const pptx = new pptxgen();
  pptx.defineLayout({ name: "CHEMSHIFU_WIDE", width: SLIDE.width, height: SLIDE.height });
  pptx.layout = "CHEMSHIFU_WIDE";
  pptx.author = "ChemShifu MCQ PPTX Generator";
  pptx.subject = "Editable MCQ slides generated locally in browser";
  pptx.company = "ChemShifu";
  pptx.theme = {
    headFontFace: T.fontFace,
    bodyFontFace: T.fontFace,
  };

  const exportItems = items.filter(complete);
  for (const item of exportItems) {
    const slide = pptx.addSlide();
    slide.background = { color: T.bgColor };
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: SLIDE.width,
      h: SLIDE.height,
      fill: { color: T.bgColor },
      line: { color: T.bgColor, transparency: 100 },
    });
    await addLogoImages(slide, logos);

    const titleBoxData = await imageToDataUri(mcqTitleBoxYellow);
    slide.addImage({ data: titleBoxData, ...containImage(T.positions.titleBox, IMAGE_SIZES.mcqTitleBox) });
    slide.addText("MCQ", {
      ...T.positions.titleBox,
      color: T.colors.questionGold,
      fontFace: "Century Gothic",
      bold: true,
      align: "center",
      valign: "middle",
      fontSize: 27,
      margin: 0,
      fit: "shrink",
    });

    const questionBulbData = await imageToDataUri(questionBulb);
    const questionParts = splitQuestionReference(item.question);
    const positions = mcqSlidePositions(prepareReactionLayoutText(questionParts.main));
    const framedQuestionText = framedQuestionTextPosition(positions, Boolean(questionParts.reference));
    const framedQuestionIcon = framedQuestionIconPosition(positions);
    const optionPositions = optionPanelPositions(positions, [item.options.ka, item.options.kha, item.options.ga, item.options.gha]);
    slide.addShape(pptx.ShapeType.roundRect, {
      ...positions.questionBox,
      rectRadius: 0.08,
      fill: { color: T.bgColor, transparency: 100 },
      line: { color: T.colors.borderYellow, width: 1.5 },
    });
    slide.addImage({ data: questionBulbData, ...framedQuestionIcon });
    addReactionAwareText(pptx, slide, questionParts.main, framedQuestionText, {
    color: T.colors.questionGold,
    fontFace: hasStructureDiagram(questionParts.main) ? "Courier New" : T.fontFace,
    bold: true,
    fontSize: questionFontSize(questionParts.main),
    fit: "shrink",
    valign: "middle",
    margin: 0,
  });
    if (questionParts.reference) {
      slide.addText(questionParts.reference, {
        ...positions.questionRef,
        color: T.colors.white,
        fontFace: T.fontFace,
        bold: true,
        fontSize: referenceFontSize(questionParts.reference),
        fit: "shrink",
        align: "right",
        valign: "middle",
        margin: 0,
      });
    }

    addOption(slide, "ক", item.options.ka, optionPositions.optionKa);
    addOption(slide, "খ", item.options.kha, optionPositions.optionKha);
    addOption(slide, "গ", item.options.ga, optionPositions.optionGa);
    addOption(slide, "ঘ", item.options.gha, optionPositions.optionGha);

    slide.addShape(pptx.ShapeType.line, {
      x: T.positions.footerLine.x,
      y: T.positions.footerLine.y,
      w: T.positions.footerLine.w,
      h: 0,
      line: { color: T.colors.borderYellow, width: 1.2, transparency: 80 },
    });
    slide.addText(chapterName || "অধ্যায়", {
      ...T.positions.chapterName,
      color: T.colors.white,
      fontFace: T.footerFontFace,
      bold: true,
      fontSize: 14,
      fit: "shrink",
      margin: 0,
    });
    slide.addText(footerRight || "জৈব রসায়ন", {
      ...T.positions.footerRight,
      color: T.colors.white,
      fontFace: T.footerFontFace,
      bold: true,
      fontSize: 14,
      align: "right",
      fit: "shrink",
      margin: 0,
    });
  }

  return pptx.write({ outputType: "blob" }) as Promise<Blob>;
}

export async function exportWrittenPptx(items: WrittenQAItem[], chapterName: string, footerRight: string, logos = DEFAULT_SLIDE_LOGOS): Promise<Blob> {
  const pptx = createDeck();
  const exportItems = paginateWrittenSlides(items);

  for (const item of exportItems) {
    const slide = pptx.addSlide();
    await addBaseSlide(pptx, slide, "Written", logos);
    const { positions } = await addQuestion(pptx, slide, item.question);
    const answerBox = answerPosition(positions);
    addReactionAwareText(pptx, slide, item.answer, answerBox, {
      color: T.colors.questionGold,
      fontFace: T.fontFace,
      bold: true,
      fontSize: answerFontSize(item.answer),
      breakLine: false,
      fit: "shrink",
      valign: "top",
      margin: 0.02,
    });
    addFooter(pptx, slide, chapterName, footerRight);
  }

  return pptx.write({ outputType: "blob" }) as Promise<Blob>;
}

export const getExportableCount = (items: MCQItem[]) => items.filter(complete).length;
