type Props = {
  value: string;
  onChange: (value: string) => void;
  mode?: "mcq" | "written";
};

const mcqPlaceholder = `Paste OCR/GPT/Gemini extracted MCQs here.

Example:
1. CH_3CN যৌগের কার্বনসমূহে কী ধরনের সংকরন বিদ্যমান?
ক) sp^2, sp
খ) sp^3, sp^3
গ) sp^2, sp^2
ঘ) sp^3, sp

English A/B/C/D and প্রশ্ন: formats are also supported.`;

const writtenPlaceholder = `Paste written question-answer text here.

Example:
১৯। সমানুতা কাকে বলে? [সি. বো. ২৫; ম. বো. ২৫]

উত্তর: সমানুতা হলো এমন একটি ধর্ম যেখানে দুটি বা ততোধিক যৌগের
আণবিক সংকেত একই কিন্তু তাদের গঠন বা বিন্যাস ভিন্ন হওয়ায়
ভৌত ও রাসায়নিক ধর্ম ভিন্ন হয়।`;

export function McqInputPanel({ value, onChange, mode = "mcq" }: Props) {
  return (
    <section className="panel input-panel">
      <div className="panel-heading">
        <h2>{mode === "written" ? "Bulk Written Q&A Text" : "Bulk MCQ Text"}</h2>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        placeholder={mode === "written" ? writtenPlaceholder : mcqPlaceholder}
      />
    </section>
  );
}
