import { AlertTriangle } from "lucide-react";
import { WrittenQAItem } from "../lib/writtenParser";

type Props = { items: WrittenQAItem[]; exportableCount: number };

export function WrittenWarningPanel({ items, exportableCount }: Props) {
  const warnings = items.flatMap((item, index) => (item.warnings ?? []).map((warning) => ({ index, warning })));
  return (
    <section className="panel warning-panel">
      <div className="panel-heading">
        <h2>Warnings</h2>
        <span>{exportableCount} exportable</span>
      </div>
      {warnings.length === 0 ? (
        <p className="empty-state">No parser warnings. Answerless written questions are allowed and will export as question-only slides.</p>
      ) : (
        <div className="warning-list">
          {warnings.map(({ index, warning }, itemIndex) => (
            <div className="warning-badge" key={`${index}-${warning}-${itemIndex}`}>
              <AlertTriangle size={16} />
              <span>Q&A {index + 1}: {warning}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
