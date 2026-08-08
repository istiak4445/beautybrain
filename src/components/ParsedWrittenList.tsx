import { WrittenQAItem } from "../lib/writtenParser";

type Props = { items: WrittenQAItem[] };

export function ParsedWrittenList({ items }: Props) {
  return (
    <section className="panel parsed-panel">
      <div className="panel-heading">
        <h2>Parsed Written Q&A List</h2>
        <span>{items.length} detected</span>
      </div>
      {items.length === 0 ? (
        <p className="empty-state">Paste written questions with উত্তর: lines to see detected items.</p>
      ) : (
        <div className="mcq-list">
          {items.map((item, index) => (
            <article className={item.warnings?.length ? "mcq-card has-warning" : "mcq-card"} key={`${item.serial ?? "qa"}-${index}`}>
              <strong>{item.serial ? `${item.serial}. ` : ""}{item.question || "Untitled question"}</strong>
              <p className="answer-mini">উত্তর: {item.answer || "—"}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
