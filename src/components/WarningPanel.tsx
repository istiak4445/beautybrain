import { AlertTriangle } from "lucide-react";
import { MCQItem } from "../lib/mcqParser";

type Props = { items: MCQItem[]; exportableCount: number };

export function WarningPanel({ items, exportableCount }: Props) {
  const warnings = items.flatMap((item, index) => (item.warnings ?? []).map((warning) => ({ index, warning })));
  return (
    <section className="panel warning-panel">
      <div className="panel-heading">
        <h2>Warnings</h2>
        <span>{exportableCount} exportable</span>
      </div>
      {warnings.length === 0 ? (
        <p className="empty-state">No parser warnings. Incomplete MCQs are skipped during export.</p>
      ) : (
        <div className="warning-list">
          {warnings.map(({ index, warning }, itemIndex) => (
            <div className="warning-badge" key={`${index}-${warning}-${itemIndex}`}>
              <AlertTriangle size={16} />
              <span>MCQ {index + 1}: {warning}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
