import { getLevelLabel, getRent } from "../data/fields";
import type { Field, Player } from "../types";

interface FieldViewProps {
  field: Field;
  owner?: Player;
  level: number;
}

export function FieldView({ field, owner, level }: FieldViewProps) {
  const rent = field.kind === "property" ? getRent(field, level) : null;

  return (
    <section className={`field-view group-${field.group ?? "none"}`}>
      <div className="field-view-icon">{field.icon}</div>
      <div>
        <p className="eyebrow">Aktuelles Feld</p>
        <h2>{field.name}</h2>
        <p>{field.description}</p>
        <div className="field-meta">
          {field.price && <span>Kauf {field.price} ◆</span>}
          {rent !== null && <span>Miete {rent} ◆</span>}
          {field.fee && <span>Gebühr {field.fee} ◆</span>}
          {owner && <span>Besitz: {owner.name}</span>}
          {level > 0 && <span>{getLevelLabel(level)}</span>}
        </div>
      </div>
    </section>
  );
}
