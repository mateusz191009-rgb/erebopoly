import { fieldById } from "../data/fields";
import type { GameState } from "../types";
import { calculateScore } from "../utils/gameLogic";

interface PlayerPanelProps {
  game: GameState;
  onShowProperties: (playerId: string) => void;
}

export function PlayerPanel({ game, onShowProperties }: PlayerPanelProps) {
  return (
    <section className="player-grid" aria-label="Spielerübersicht">
      {game.players.map((player, index) => (
        <button
          type="button"
          key={player.id}
          className={`player-card ${index === game.currentPlayerIndex ? "active" : ""} ${
            player.bankrupt ? "bankrupt" : ""
          }`}
          onClick={() => onShowProperties(player.id)}
        >
          <span
            className="player-token"
            style={{ "--token-color": player.token.color } as React.CSSProperties}
          >
            {player.token.symbol}
          </span>
          <span className="player-info">
            <strong>{player.name}</strong>
            <small>
              {player.bankrupt ? "Ausgeschieden" : `${player.money} ◆ · ${player.owned.length} Orte`}
            </small>
            {!player.bankrupt && (
              <span className="player-statuses">
                {!player.protectionUsed && <i>◆ Schutz</i>}
                {player.paymentShield && <i>▣ Blocker</i>}
                {player.silenceOath && <i>V Schweigen</i>}
              </span>
            )}
          </span>
          <span className="player-score">{calculateScore(player)}</span>
          <span className="sr-only">
            {player.owned.map((id) => fieldById[id]?.name).join(", ")}
          </span>
        </button>
      ))}
    </section>
  );
}
