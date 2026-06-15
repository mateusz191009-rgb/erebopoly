import { getLevelLabel, getRent } from "../data/fields";
import type { Field, Player } from "../types";

interface PropertyCardProps {
  field: Field;
  owner?: Player;
  compact?: boolean;
}

export function PropertyCard({ field, owner, compact = false }: PropertyCardProps) {
  const level = owner?.levels[field.id] ?? 0;

  return (
    <article className={`property-card group-${field.group ?? "none"} ${compact ? "compact" : ""}`}>
      <header>
        <span className="property-card-icon">{field.icon}</span>
        <div>
          <p className="eyebrow">{owner ? `Besitz von ${owner.name}` : "Besitzkarte"}</p>
          <h3>{field.name}</h3>
        </div>
        {owner && <strong className="property-rank">{getLevelLabel(level)}</strong>}
      </header>
      {!compact && <p>{field.description}</p>}
      <div className="property-values">
        <span>
          Kaufpreis <strong>{field.price} ◆</strong>
        </span>
        <span>
          Level-Up <strong>{field.levelCost} ◆</strong>
        </span>
      </div>
      <div className="rent-table" aria-label={`Mieten für ${field.name}`}>
        {["Basis", "Level 1", "Level 2", "Level 3", "Meister"].map((label, index) => (
          <div className={level === index ? "current-rent" : ""} key={label}>
            <small>{label}</small>
            <strong>{getRent(field, index)} ◆</strong>
          </div>
        ))}
      </div>
    </article>
  );
}
