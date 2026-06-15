import type { CSSProperties } from "react";
import type { Field as FieldData, Player } from "../types";

interface FieldProps {
  field: FieldData;
  position: CSSProperties;
  active: boolean;
  owner?: Player;
  level: number;
  players: Player[];
}

export function Field({ field, position, active, owner, level, players }: FieldProps) {
  return (
    <div
      className={`board-field kind-${field.kind} group-${field.group ?? "none"} ${
        active ? "is-current" : ""
      }`}
      style={position}
      title={field.name}
    >
      <div className="field-icon">{field.icon}</div>
      <div className="field-label">{field.shortName}</div>
      <div className="field-price">
        {field.price ?? field.fee ?? (field.kind === "start" ? "+200" : "")}
      </div>
      {owner && <span className="owner-dot" style={{ backgroundColor: owner.token.color }} />}
      {level > 0 && <span className="level-dots">{"◆".repeat(level)}</span>}
      <div className="field-tokens">
        {players.map((player) => (
          <span
            key={player.id}
            className="board-token"
            style={{ "--token-color": player.token.color } as CSSProperties}
            title={player.name}
          >
            {player.token.symbol}
          </span>
        ))}
      </div>
    </div>
  );
}
