import { describe, expect, it } from "vitest";
import { mathFallback } from "./mathFallback";
import { MCQ_TEMPLATE, mcqSlidePositions, questionFontSize } from "./mcqTemplate";
import { parseMCQs } from "./mcqParser";
import { repairOcrText } from "./repairOcrText";
import { splitQuestionReference } from "./questionText";
import { parseReactionLine, prepareReactionDisplayText, prepareReactionLayoutText, splitInlineReactionSegments } from "./reactionText";
import { convertToWordFriendly } from "./textConvert";
import { getWrittenExportableCount, paginateWrittenSlides, parseWrittenQAs } from "./writtenParser";

describe("repairOcrText", () => {
  it("fixes broken option markers", () => {
    const repaired = repairOcrText("ক . sp2\nখ - sp3\nA ) H 2 O");
    expect(repaired).toContain("ক) sp^2");
    expect(repaired).toContain("খ) sp^3");
    expect(repaired).toContain("A) H_2O");
  });

  it("fixes common chemistry spacing", () => {
    const repaired = repairOcrText("H 2 SO 4 + NH 4 + + SO 4 2- + Fe 3+");
    expect(repaired).toContain("H_2SO_4");
    expect(repaired).toContain("NH_4^+");
    expect(repaired).toContain("SO_4^{2-}");
    expect(repaired).toContain("Fe^{3+}");
  });

  it("keeps OCR organic reaction arrows parseable for book-style rendering", () => {
    const repaired = repairOcrText("61. A + O3—CCl4→B—H2O/Zn→2CH3CHO");
    const reaction = parseReactionLine(repaired.replace(/^61\.\s*/, ""));
    expect(reaction?.parts).toEqual(["A + O₃", "B", "2CH₃CHO"]);
    expect(reaction?.arrows[0]).toMatchObject({ top: "CCl₄" });
    expect(reaction?.arrows[1]).toMatchObject({ top: "H₂O", bottom: "Zn" });
  });

  it("parses normal and dashed reaction arrows for editable long-arrow rendering", () => {
    expect(parseReactionLine("NaOH + HCl -> NaCl + H2O")?.parts).toEqual(["NaOH + HCl", "NaCl + H₂O"]);
    expect(parseReactionLine("CH3CH=CH2 --HBr/peroxide--> CH3CH2CH2Br")?.arrows[0]).toMatchObject({ top: "HBr", bottom: "peroxide" });
  });

  it("keeps C3H6 as one inline reaction token with catalyst labels", () => {
    const segments = splitInlineReactionSegments("A ও B নির্ণয় কর, যখন C3H6 —Br2/CCl4→ A —KOH(alc)→ B (Determine A and B when C3H6 —Br2/CCl4→ A —KOH(alc)→ B.)");
    const reaction = segments.find((segment) => segment.type === "reaction");
    expect(reaction?.type).toBe("reaction");
    if (reaction?.type !== "reaction") throw new Error("missing reaction segment");
    expect(reaction.reaction.parts).toEqual(["C₃H₆", "A", "B"]);
    expect(reaction.reaction.arrows[0]).toMatchObject({ top: "Br₂", bottom: "CCl₄" });
    expect(reaction.reaction.arrows[1]).toMatchObject({ top: "KOH(alc)" });
  });

  it("keeps dashed organic products intact before explanatory text", () => {
    const segments = splitInlineReactionSegments("CH2=CH-CH3 —HBr→ CH3-CH(Br)-CH3 এ বিক্রিয়াটি কোন নীতি অনুসারে ঘটে?");
    const reaction = segments.find((segment) => segment.type === "reaction");
    expect(reaction).toMatchObject({ type: "reaction" });
    if (reaction?.type === "reaction") {
      expect(reaction.reaction.parts.at(-1)).toContain("CH(Br)");
      expect(reaction.reaction.parts.at(-1)).toMatch(/CH₃$/u);
    }
  });

  it("does not attach an explanatory opening parenthesis to the final product", () => {
    const segments = splitInlineReactionSegments("Y —KOH(aq)→ CH3-CH2-CH2-Br —KOH(alc)→ X (The compound X in the stem is—)");
    const reaction = segments.find((segment) => segment.type === "reaction");
    expect(reaction).toMatchObject({ type: "reaction" });
    if (reaction?.type === "reaction") expect(reaction.reaction.parts.at(-1)).toBe("X");
  });

  it("renders two independent equations separated by question text", () => {
    const segments = splitInlineReactionSegments(
      "CH3CH=CH2 —HBr→ A; এক্ষেত্রে A যৌগটির নাম কী? (CH3CH=CH2 —HBr→ A); in this case, what is the name of compound A?",
    );
    const reactions = segments.filter((segment) => segment.type === "reaction");
    expect(reactions).toHaveLength(2);
  });

  it("renders named organic products between reaction arrows", () => {
    const segments = splitInlineReactionSegments(
      "X + O3 —CCl4→ ওজোনাইড (ozonide) —Zn/H2O→ মিথানাল (methanal) + প্রোপানাল (propanal)। এক্ষেত্রে X যৌগটি কী? (In this case, what is compound X?)",
    );
    const reaction = segments.find((segment) => segment.type === "reaction");
    expect(reaction).toMatchObject({ type: "reaction" });
    if (reaction?.type === "reaction") {
      expect(reaction.reaction.parts).toContain("ওজোনাইড (ozonide)");
      expect(reaction.reaction.parts.at(-1)).toContain("মিথানাল");
    }
  });

  it("allocates extra MCQ box height for labeled reaction rows", () => {
    const question = "CH3CH=CHCH3 —O3→ ozonide —Zn/H2O→ 2CH3CHO; A কোনটি?";
    const normalHeight = mcqSlidePositions(question).questionBox.h;
    const reactionHeight = mcqSlidePositions(prepareReactionLayoutText(question)).questionBox.h;
    expect(reactionHeight).toBeGreaterThan(normalHeight);
  });

  it("fixes screenshot-style spaced formulas and equilibrium constants", () => {
    const repaired = repairOcrText("2H 2 O\nCOCl 2(g) rightleftharpoons CO(g)+Cl 2(g) বিক্রিয়ার জন্য K c কোনটি?");
    expect(repaired).toContain("2H_2O");
    expect(repaired).toContain("COCl_2(g)");
    expect(repaired).toContain("\\rightleftharpoons");
    expect(repaired).toContain("Cl_2(g)");
    expect(repaired).toContain("K_c");
  });

  it("keeps lettered fill-in reactions as complete display rows", () => {
    const display = prepareReactionDisplayText(
      "Complete the following reactions. a)\nCH2=CH2 —Br2 + H2O→ b)\n(CH3)2C=CH2 —O3→ —H2O/Zn→",
    );
    expect(display.split("\n")).toEqual([
      "Complete the following reactions.",
      "a) CH2=CH2 —Br2 + H2O→ ______",
      "b) (CH3)2C=CH2 —O3→ ______ —H2O/Zn→ ______",
    ]);
  });

  it("splits inline lettered reactions into separate complete rows", () => {
    const display = prepareReactionDisplayText(
      "Complete the following reactions. a) CH2=CH2 —Br2 + H2O→ b) (CH3)2C=CH2 —O3→ —H2O/Zn→",
    );
    expect(display.split("\n")).toEqual([
      "Complete the following reactions.",
      "a) CH2=CH2 —Br2 + H2O→ ______",
      "b) (CH3)2C=CH2 —O3→ ______ —H2O/Zn→ ______",
    ]);
    const displayHeight = mcqSlidePositions(display).questionBox.h;
    const reactionHeight = mcqSlidePositions(prepareReactionLayoutText(display)).questionBox.h;
    expect(displayHeight).toBeGreaterThan(MCQ_TEMPLATE.positions.questionBox.h);
    expect(reactionHeight).toBeGreaterThan(displayHeight);
    const firstReaction = splitInlineReactionSegments(display.split("\n")[1]);
    expect(firstReaction).toHaveLength(1);
    expect(firstReaction[0]).toMatchObject({ type: "reaction" });
    if (firstReaction[0].type === "reaction") expect(firstReaction[0].reaction.parts[0]).toBe("a) CH₂=CH₂");
  });
});

describe("parseMCQs", () => {
  it("detects Bangla options correctly", () => {
    const items = parseMCQs("1. H_2O কী?\nক) পানি\nখ) লবণ\nগ) অম্ল\nঘ) ক্ষার");
    expect(items).toHaveLength(1);
    expect(items[0].options.ka).toBe("পানি");
    expect(items[0].options.gha).toBe("ক্ষার");
  });

  it("detects markdown-bold question starts as new MCQs", () => {
    const items = parseMCQs("১। প্রথম প্রশ্ন?\nক) এক\nখ) দুই\nগ) তিন\nঘ) চার\n\n**৩। বাংলাদেশে প্রাকৃতিক গ্যাস কোন ক্ষেত্রে সর্বাধিক ব্যবহৃত হয়? [র. বো. ১৭; ক. বো. ১৫]**\nক) ইউরিয়া সার উৎপাদনে\nখ) বিদ্যুৎ উৎপাদনে\nগ) রান্নার কাজে\nঘ) গাড়ির জ্বালানিরূপে");
    expect(items).toHaveLength(2);
    expect(items[1].serial).toBe("৩");
    expect(items[1].question).not.toContain("**");
    expect(items[1].options.ka).toBe("ইউরিয়া সার উৎপাদনে");
    expect(items[1].options.gha).toBe("গাড়ির জ্বালানিরূপে");
  });

  it("supports A/B/C/D options", () => {
    const items = parseMCQs("1) Product?\nA) NaOH\nB) Na₂SO₄\nC) HCl\nD) NH₃");
    expect(items[0].options.ka).toBe("NaOH");
    expect(items[0].options.kha).toBe("Na₂SO₄");
  });

  it("maps raw OCR A/B/C/D labels to Bangla option slots", () => {
    const items = parseMCQs("70. pH কত?\nA 3 B 8 C 11 D 14");
    expect(items[0].options.ka).toBe("3");
    expect(items[0].options.kha).toBe("8");
    expect(items[0].options.ga).toBe("11");
    expect(items[0].options.gha).toBe("14");
  });

  it("maps line-by-line raw OCR A/B/C/D labels to Bangla option slots", () => {
    const items = parseMCQs("1. Product?\nA NaOH\nB Na₂SO₄\nC HCl\nD NH₃");
    expect(items[0].options.ka).toBe("NaOH");
    expect(items[0].options.kha).toBe("Na₂SO₄");
    expect(items[0].options.ga).toBe("HCl");
    expect(items[0].options.gha).toBe("NH₃");
  });

  it("does not treat formula C inside an option as an inline option marker", () => {
    const items = parseMCQs("১৩। প্রডিউসার গ্যাস কোনটি? [ম. বো. ১৭]\nক) (C + H₂)\nখ) (2CO + N₂)\nগ) (CO + H₂)\nঘ) (N₂ + H₂)");
    expect(items).toHaveLength(1);
    expect(items[0].options.ka).toBe("(C + H₂)");
    expect(items[0].options.kha).toBe("(2CO + N₂)");
    expect(items[0].options.ga).toBe("(CO + H₂)");
    expect(items[0].options.gha).toBe("(N₂ + H₂)");
  });

  it("does not split lowercase c inside option text like oic acid", () => {
    const items = parseMCQs("1. IUPAC name?\nA. But-1-en-2-oic acid\nB. But-2-en-2-oic acid\nC. But-1-en-1-oic acid\nD. But-1-oic acid");
    expect(items[0].options.ka).toBe("But-1-en-2-oic acid");
    expect(items[0].options.kha).toBe("But-2-en-2-oic acid");
    expect(items[0].options.ga).toBe("But-1-en-1-oic acid");
    expect(items[0].options.gha).toBe("But-1-oic acid");
  });

  it("splits raw Bangla inline options merged into the question line", () => {
    const items = parseMCQs("২৩। CH₃–CH=CH–COOH যৌগটির IUPAC নাম হলো— [হ. বো. ২৩] ক But-1-en-2-oic acid খ But-2-en-2-oic acid গ But-2-en-1-oic acid ঘ But-1-oic acid");
    expect(items).toHaveLength(1);
    expect(items[0].question).toContain("CH₃–CH=CH–COOH");
    expect(items[0].question).not.toContain("ক But");
    expect(items[0].options.ka).toBe("But-1-en-2-oic acid");
    expect(items[0].options.kha).toBe("But-2-en-2-oic acid");
    expect(items[0].options.ga).toBe("But-2-en-1-oic acid");
    expect(items[0].options.gha).toBe("But-1-oic acid");
  });

  it("preserves multiline organic structure diagrams in question text", () => {
    const text = `2. নিচের যৌগটির IUPAC পদ্ধতিতে নাম কোনটি?
[য. বো. ২২]
          CH₂
          ||
CH₃–CH₂–C–CH–CH₂–CH₃
       |
     CH₂–CH₃`;
    const repaired = repairOcrText(text);
    expect(repaired).toContain("          CH₂");
    expect(repaired).toContain("          ||");
    const items = parseMCQs(repaired);
    expect(items[0].question).toContain("\n       CH₂\n        ||\nCH₃–CH₂–C–CH–CH₂–CH₃");
    expect(items[0].question).toContain("\n        |\n      CH₂–CH₃");
  });

  it("parses screenshot-style repaired chemistry and fractions", () => {
    const cleaned = repairOcrText(
      "3. COCl 2(g) rightleftharpoons CO(g)+Cl 2(g) বিক্রিয়ার জন্য K c কোনটি?\nক) \\frac{[CO][Cl_2]}{[COCl_2]}\nখ) \\frac{[COCl_2]}{[CO][Cl_2]}\nগ) [CO][Cl_2][COCl_2]\nঘ) \\frac{[Cl_2]}{[CO]}",
    );
    const items = parseMCQs(cleaned);
    expect(items[0].question).toContain("COCl₂(g) ⇌ CO(g)+Cl₂(g)");
    expect(items[0].question).toContain("K_c");
    expect(items[0].options.ka).toBe("([CO][Cl₂])/([COCl₂])");
    expect(items[0].options.kha).toBe("([COCl₂])/([CO][Cl₂])");
  });

  it("parses Bengali danda serials and inline options", () => {
    const items = parseMCQs("৬৭। নিচের কোন জোড়া অম্লীয় বাফার দ্রবণ তৈরি করে? [চ. বো. ২০১৫]\n(ক) 3 (খ) 8 (গ) 11 (ঘ) 14");
    expect(items).toHaveLength(1);
    expect(items[0].serial).toBe("৬৭");
    expect(items[0].question).toContain("নিচের কোন জোড়া");
    expect(items[0].options.ka).toBe("3");
    expect(items[0].options.kha).toBe("8");
    expect(items[0].options.ga).toBe("11");
    expect(items[0].options.gha).toBe("14");
    expect(items[0].warnings).not.toContain("Missing খ option");
    expect(items[0].warnings).not.toContain("Missing ঘ option");
  });

  it("keeps numbered assertion lists inside the question stem", () => {
    const items = parseMCQs(`০২. আইসোবিউটাইল অ্যালকোহলের গাঠনিক সংকেত হলো— [JU. 2010-11, 09-10]
A. CH₃CH₂CH₂CH₂OH
B. CH₃CH(CH₃)CH₂OH
C. CH₃CHCH₂CH₃
D. CH₃C–OH

০১. CH₃–SH যৌগটির নাম হলো— [RU-H. 2016-17]
A. মিথেন সালফাইড
B. মিথেন থায়ল
C. মিথাইল হাইড্রোজেন সালফাইড
D. থায়োমিথানল

১. (CH₃)₂CH–OH; এ যৌগটির নাম—

1. 2–প্রোপানল
2. iso–প্রোপানল
3. ডাইমিথাইল কার্বিনল

নিচের কোনটি সঠিক?

ক. i ও ii
খ. ii ও iii
গ. i ও iii
ঘ. i, ii ও iii

২০। অ্যালকাইল মূলকের সাধারণ সংকেত কোনটি? [চ. বো. ২১]

ক. CₙH₂ₙ₊₂
খ. CₙH₂ₙ₊₁
গ. CₙH₂ₙ
ঘ. CₙH₂ₙ₋₂

২১। অ্যামাইডের কার্যকরী মূলক কোনটি? [ঢা. বো. ২৩; ১৮]

ক. –CNS
খ. –CO–NH–
গ. –NH₂
ঘ. –CO–NH₂`);
    expect(items).toHaveLength(5);
    expect(items[2].question).toContain("i. 2–প্রোপানল\nii. iso–প্রোপানল\niii. ডাইমিথাইল কার্বিনল");
    expect(items[2].question).toContain("নিচের কোনটি সঠিক");
    expect(items[2].options.ka).toBe("i ও ii");
    expect(items[2].options.kha).toBe("ii ও iii");
    expect(items[2].options.ga).toBe("i ও iii");
    expect(items[2].options.gha).toBe("i, ii ও iii");
    expect(items[2].warnings).not.toContain("Missing ক option");
    expect(items[3].options.ka).toBe("CₙH₂ₙ₊₂");
    expect(items[4].options.gha).toBe("–CO–NH₂");
  });

  it("produces warnings for incomplete MCQs", () => {
    const items = parseMCQs("প্রশ্ন: H_2O কী?\nক) পানি");
    expect(items[0].warnings).toContain("Missing খ option");
    expect(items[0].warnings).not.toContain("Could not detect question number");
  });
});

describe("mcqSlidePositions", () => {
  it("expands the question box for roman statement-list questions", () => {
    const positions = mcqSlidePositions("(CH₃)₂CH–OH; এ যৌগটির নাম—\ni. 2–প্রোপানল\nii. iso–প্রোপানল\niii. ডাইমিথাইল কার্বিনল\nনিচের কোনটি সঠিক?");
    expect(positions.questionBox.h).toBeGreaterThan(MCQ_TEMPLATE.positions.questionBox.h);
    expect(positions.questionText.h).toBeGreaterThan(MCQ_TEMPLATE.positions.questionText.h);
    expect(positions.optionKa.y).toBeGreaterThan(MCQ_TEMPLATE.positions.optionKa.y);
  });

  it("expands the question box for long question text", () => {
    const positions = mcqSlidePositions("CH₃CH=CH₂ হাইড্রোকার্বনের বাম দিক থেকে প্রথম ও ডান দিক থেকে প্রথম ও দ্বিতীয় কার্বনে কী কী ধরনের হাইব্রিডাইজেশন দেখা যাবে?");
    expect(positions.questionBox.h).toBeGreaterThan(MCQ_TEMPLATE.positions.questionBox.h);
    expect(positions.optionKa.y).toBeGreaterThan(MCQ_TEMPLATE.positions.optionKa.y);
  });

  it("keeps long question font readable while expanding the box", () => {
    const longQuestion = "উদ্দীপকের বিক্রিয়ক গ্যাসসমূহ ও কৃষি জমিতে ব্যবহৃত কঠিন উৎপাদ C এর ক্ষেত্রে— i. A গ্যাসটি উৎপাদনে প্রাকৃতিক গ্যাস থেকে H₂ ও বায়ু N₂ ব্যবহৃত হয় ii. মরিচায় B যৌগের নাম অ্যামোনিয়াম কার্বোনেট iii. উৎপাদ C যৌগটি দুধ মাটিতে আর্দ্র বিক্রিয়ায় হয়ে গ্যাস উৎপন্ন করে, যা প্রোটিন সংশ্লেষণে ব্যবহৃত হয় নিচের কোনটি সঠিক?";
    expect(questionFontSize(longQuestion)).toBeGreaterThanOrEqual(20);
    expect(mcqSlidePositions(longQuestion).questionBox.h).toBeGreaterThan(MCQ_TEMPLATE.positions.questionBox.h + 1);
  });
});

  it("keeps dynamically shifted options above the footer", () => {
    const longQuestion = "উদ্দীপকের বিক্রিয়ক গ্যাসসমূহ ও কৃষি জমিতে ব্যবহৃত কঠিন উৎপাদ C এর ক্ষেত্রে—\ni. A গ্যাসটি উৎপাদনে প্রাকৃতিক গ্যাস থেকে H₂ ও বায়ু N₂ ব্যবহৃত হয়\nii. মধ্যবর্তী B যৌগের নাম অ্যামোনিয়াম কার্বোনেট\niii. উৎপাদ C যৌগটি সিক্ত মাটিতে আর্দ্র বিয়োজিত হয়ে গ্যাস উৎপন্ন করে, যা প্রোটিন সংশ্লেষণে ব্যবহৃত হয়\nনিচের কোনটি সঠিক?";
    const positions = mcqSlidePositions(longQuestion);
    expect(positions.optionGha.y + positions.optionGha.h).toBeLessThan(MCQ_TEMPLATE.positions.footerLine.y);
  });

describe("splitQuestionReference", () => {
  it("separates long bracketed board references from the question", () => {
    const result = splitQuestionReference("কাগজের মণ্ড প্রস্তুতির জন্য কোনটি কস্টিক মিশ্রণে ব্যবহৃত হয়? [ব. বো. ১৯; দি. বো. ১৯; য. বো. ১৭; চা. বো. ১৬]");
    expect(result.main).toBe("কাগজের মণ্ড প্রস্তুতির জন্য কোনটি কস্টিক মিশ্রণে ব্যবহৃত হয়?");
    expect(result.reference).toBe("[ব. বো. ১৯; দি. বো. ১৯; য. বো. ১৭; চা. বো. ১৬]");
  });

  it("separates bracketed references from the middle of assertion questions", () => {
    const result = splitQuestionReference("পাল্প বা মণ্ডকে কাগজের শীটে রূপান্তরের ধাপ হলো— [সি. বো. ১৫]** i. বিটিং ii. রিফাইনিং iii. শিট তৈরি নিচের কোনটি সঠিক?");
    expect(result.main).toBe("পাল্প বা মণ্ডকে কাগজের শীটে রূপান্তরের ধাপ হলো—\ni. বিটিং\nii. রিফাইনিং\niii. শিট তৈরি নিচের কোনটি সঠিক?");
    expect(result.reference).toBe("[সি. বো. ১৫]");
  });
});

describe("parseWrittenQAs", () => {
  it("detects written questions with উত্তর lines", () => {
    const items = parseWrittenQAs(`১৯। সমানুতা কাকে বলে?  [সি. বো. ২৫; ম. বো. ২৫]

উত্তর: সমানুতা হলো এমন একটি ধর্ম যেখানে দুটি বা ততোধিক যৌগের
আণবিক সংকেত একই কিন্তু তাদের গঠন বা বিন্যাস ভিন্ন হয়।

২০। আলোকে সমানুতা কাকে বলে?  [ম. বো. ১৫]

উত্তর: আলোক সক্রিয় যৌগের একই আণবিক ও গাঠনিক সংকেত বিশিষ্ট
একাধিক কনফিগারেশন যদি পরস্পর অধিসমাপনী প্রতিবিম্বের মত আচরণ করে।`);

    expect(items).toHaveLength(2);
    expect(items[0].serial).toBe("১৯");
    expect(items[0].question).toContain("সমানুতা কাকে বলে");
    expect(items[0].answer).toContain("আণবিক সংকেত একই");
    expect(items[1].serial).toBe("২০");
    expect(getWrittenExportableCount(items)).toBe(2);
  });

  it("keeps the same chemistry conversion logic in written answers", () => {
    const items = parseWrittenQAs("1. H_2SO_4 কী?\nউত্তর: H_2SO_4 + 2NaOH \\rightarrow Na_2SO_4 + 2H_2O");
    expect(items[0].question).toContain("H₂SO₄");
    expect(items[0].answer).toContain("H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O");
  });

  it("splits numbered written questions even when answers are absent", () => {
    const items = parseWrittenQAs(`১। প্রথম প্রশ্ন?

২। দ্বিতীয় প্রশ্ন?

৩। তৃতীয় প্রশ্ন?`);
    expect(items).toHaveLength(3);
    expect(items[0].question).toBe("প্রথম প্রশ্ন?");
    expect(items[1].question).toBe("দ্বিতীয় প্রশ্ন?");
    expect(paginateWrittenSlides(items)).toHaveLength(3);
  });

  it("allows written questions without answers", () => {
    const items = parseWrittenQAs("২১। অ্যামাইড কী?");
    expect(items[0].warnings).not.toContain("Missing answer text");
    expect(getWrittenExportableCount(items)).toBe(1);
    expect(paginateWrittenSlides(items)).toHaveLength(1);
  });

  it("parses repaired written Q&A text with Bangla danda numbering", () => {
    const cleaned = repairOcrText("১৯। সমানুতা কাকে বলে?\nউত্তর: H_2O একই।\n২০। আলোকে সমানুতা কাকে বলে?\nউত্তর: H_2SO_4 উদাহরণ।");
    const items = parseWrittenQAs(cleaned);
    expect(items).toHaveLength(2);
    expect(items[0].answer).toContain("H₂O");
    expect(items[1].answer).toContain("H₂SO₄");
  });

  it("splits long written answers into multiple slides", () => {
    const answer = Array.from({ length: 18 }, (_, index) => `লাইন ${index + 1} লেখা`).join("\n");
    const items = parseWrittenQAs(`1. দীর্ঘ প্রশ্ন?
উত্তর: ${answer}`);
    const slides = paginateWrittenSlides(items);
    expect(slides.length).toBeGreaterThan(1);
    expect(slides[0].partCount).toBe(slides.length);
    expect(slides.every((slide) => slide.question === items[0].question)).toBe(true);
  });

  it("keeps all C3H8O written structures across generated slides", () => {
    const items = parseWrittenQAs(`১৪। C₃H₈O-এর সম্ভাব্য সমাণুগুলোর সংকেত লেখ। [দি. বো. ২৩]

উত্তর: কোনো যৌগের আণবিক সংকেত CₙH₂ₙ₊₂O গঠনবিশিষ্ট হলে তার সম্ভাব্য সমাণুগুলো অ্যালকোহল ও ইথার শ্রেণির হয়। তাই, C₃H₈O যৌগটির সম্ভাব্য সমাণুগুলো হবে যথাক্রমে—

(i) CH₃ — CH — CH₃
            |
           OH
    2-প্রোপানল

(ii) CH₃ — CH₂ — CH₂ — OH
     প্রোপানল

(iii) CH₃ — O — C₂H₅
      মিথোক্সি ইথেন`);
    const slides = paginateWrittenSlides(items);
    const joined = slides.map((slide) => slide.answer).join("\n---\n");
    expect(joined).toContain("(i) CH₃ — CH — CH₃");
    expect(joined).toContain("           OH");
    expect(joined).toContain("(ii) CH₃ — CH₂ — CH₂ — OH");
    expect(joined).toContain("(iii) CH₃ — O — C₂H₅");
    expect(slides.some((slide) => slide.answer.includes("(i) CH₃") && slide.answer.includes("2-প্রোপানল"))).toBe(true);
  });

  it("repairOcrText preserves slash bond lines in organic diagrams", () => {
    const diagram = [
      "1. diagram?",
      "উত্তর:",
      "       H            H",
      "        \\          /",
      "         C = C",
      "        /          \\",
      "       H₅C₂        CH₃",
    ].join("\n");
    const repaired = repairOcrText(diagram);
    expect(repaired).toContain("        \\          /");
    expect(repaired).toContain("        /          \\");
    expect(repaired).toContain("       H₅C₂        CH₃");
  });

  it("keeps organic structure blocks intact during written pagination", () => {
    const items = parseWrittenQAs(`17. বিউট-২-ইন জ্যামিতিক সমাণুতা প্রদর্শন করবে কি?
উত্তর: জ্যামিতিক সমাণুতার শর্তগুলো হলো—

(i) চক্রিক যৌগ বা প্রতিস্থাপিত দ্বি-বন্ধনযুক্ত যৌগ হতে হবে।
(ii) কার্বন-কার্বন বন্ধনের অক্ষ বরাবর ঘূর্ণন অক্ষম হতে হবে।
(iii) যৌগটির গঠন abC = Cab বা abC = Cde কাঠামোর অনুরূপ হতে হবে।

এখানে বিউটিন-২ জ্যামিতিক সমাণুতার প্রদত্ত শর্তসমূহ পূরণ করেছে। ফলে বিউটিন-২ এর দুটি সমাণু সম্ভব।

       CH₃          CH₃
        \          /
         C = C
        /          \
       H            H
      সিস বিউটিন-২

       CH₃           H
        \           /
         C = C
        /           \
       H            CH₃
      ট্রান্স বিউটিন-২`);
    const slides = paginateWrittenSlides(items);
    const cisSlide = slides.find((slide) => slide.answer.includes("সিস বিউটিন-২"));
    const transSlide = slides.find((slide) => slide.answer.includes("ট্রান্স বিউটিন-২"));
    expect(cisSlide?.answer).toContain("       CH₃          CH₃");
    expect(cisSlide?.answer).toContain("         C = C");
    expect(transSlide?.answer).toContain("       CH₃           H");
    expect(transSlide?.answer).toContain("         C = C");
  });

  it("preserves leading spaces in written answer structure diagrams", () => {
    const items = parseWrittenQAs(`1. মেসো টারটারিক এসিডের গাঠনিক সংকেত লেখ।
উত্তর: মেসো টারটারিক এসিডের গাঠনিক সংকেত হলো:
\`\`\`
     COOH
       |
H — C* — OH
       |
------------ প্রতিসাম্য তল
       |
H — C* — OH
       |
     COOH
\`\`\``);
    expect(items[0].answer).toContain("     COOH");
    expect(items[0].answer).toContain("       |");
    expect(items[0].answer).not.toContain("```");
  });
});

describe("text conversion and math fallback", () => {
  it("converts chemistry notation", () => {
    expect(convertToWordFriendly("H_2SO_4 + Fe^{3+} + NH_4^+")).toBe("H₂SO₄ + Fe³⁺ + NH₄⁺");
  });

  it("flattens fractions and square roots", () => {
    expect(mathFallback("\\frac{C\\alpha^2}{1-\\alpha}")).toBe("(Cα²)/(1-α)");
    expect(mathFallback("\\sqrt{\\frac{K_a}{C}}")).toBe("√((Kₐ)/(C))");
  });

  it("converts inline fractions and readable unsupported subscripts", () => {
    expect(convertToWordFriendly("K_c = \\frac{[CO][Cl_2]}{[COCl_2]}")).toBe("K_c = ([CO][Cl₂])/([COCl₂])");
  });

  it("removes LaTeX array layout commands while preserving content", () => {
    const converted = convertToWordFriendly(
      "\\begin{array}{c|ccc} & \\mathrm{HA(aq)} & \\mathrm{H^+(aq)} & \\mathrm{A^-(aq)} \\\\ \\hline \\text{সাম্যাবস্থায়} & (1-\\alpha)C & \\alpha C & \\alpha C \\end{array}",
    );
    expect(converted).not.toContain("\\begin");
    expect(converted).not.toContain("\\mathrm");
    expect(converted).not.toContain("\\hline");
    expect(converted).toContain("HA(aq)");
    expect(converted).toContain("H⁺(aq)");
    expect(converted).toContain("A⁻(aq)");
    expect(converted).toContain("সাম্যাবস্থায়");
    expect(converted).toContain("(1-α)C");
  });
});
