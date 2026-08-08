import { MCQItem } from "../lib/mcqParser";

type Props = { items: MCQItem[] };

export function ParsedMcqList({ items }: Props) {
  return (
    <section className="panel parsed-panel">
      <div className="panel-heading">
        <h2>Parsed MCQ List</h2>
        <span>{items.length} detected</span>
      </div>
      {items.length === 0 ? (
        <p className="empty-state">Paste text to see detected questions and options.</p>
      ) : (
        <div className="mcq-list">
          {items.map((item, index) => (
            <article className={item.warnings?.length ? "mcq-card has-warning" : "mcq-card"} key={`${item.serial ?? "q"}-${index}`}>
              <strong>{item.serial ? `${item.serial}. ` : ""}{item.question || "Untitled question"}</strong>
              <div className="mini-options">
                <span>ক) {item.options.ka ?? "—"}</span>
                <span>খ) {item.options.kha ?? "—"}</span>
                <span>গ) {item.options.ga ?? "—"}</span>
                <span>ঘ) {item.options.gha ?? "—"}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
