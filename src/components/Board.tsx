import { fields } from "../data/fields";
import type { GameState } from "../types";
import { Field } from "./Field";

interface BoardProps {
  game: GameState;
  moving?: boolean;
}

function getGridPosition(index: number) {
  if (index === 0) return { gridRow: 11, gridColumn: 1 };
  if (index <= 10) return { gridRow: 11, gridColumn: index + 1 };
  if (index <= 19) return { gridRow: 21 - index, gridColumn: 11 };
  if (index <= 30) return { gridRow: 1, gridColumn: 31 - index };
  return { gridRow: index - 29, gridColumn: 1 };
}

export function Board({ game, moving = false }: BoardProps) {
  const currentPlayer = game.players[game.currentPlayerIndex];

  return (
    <div className={`board ${moving ? "board-moving" : ""}`} aria-label="Erebopoly Spielfeld">
      <div className="board-center">
        <div className="raven-sigil" aria-hidden="true">
          <span />
          <strong>V</strong>
        </div>
        <p className="eyebrow">Das Spiel beobachtet dich</p>
        <h1>EREBOPOLY</h1>
        <div className="red-slash" />
        <p className="board-subtitle">Betritt das Spiel. Bewahre das Geheimnis.</p>
        <div className="crystal-count">
          <span>◆</span>
          <strong>{currentPlayer.money}</strong>
          <small>Wunschkristalle</small>
        </div>
      </div>

      {fields.map((field, index) => {
        const owner = game.players.find((player) => player.owned.includes(field.id));
        return (
          <Field
            key={field.id}
            field={field}
            position={getGridPosition(index)}
            active={currentPlayer.position === index}
            owner={owner}
            level={owner?.levels[field.id] ?? 0}
            players={game.players.filter(
              (player) => !player.bankrupt && player.position === index,
            )}
          />
        );
      })}
    </div>
  );
}
