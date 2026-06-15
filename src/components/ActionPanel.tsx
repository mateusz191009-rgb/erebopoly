import type { CSSProperties } from "react";
import type { Field, GameState } from "../types";
import { Dice } from "./Dice";

interface ActionPanelProps {
  game: GameState;
  field: Field;
  dice: [number, number];
  rolling: boolean;
  moving: boolean;
  missionRolling: boolean;
  missionValue: number;
  canBuy: boolean;
  canUpgrade: boolean;
  onRoll: () => void;
  onBuy: () => void;
  onDecline: () => void;
  onDraw: (deck: "boten" | "reality") => void;
  onLevels: () => void;
  onEnd: () => void;
  onBlocked: (pay: boolean) => void;
  onMission: () => void;
  onSilenceBreak: () => void;
  locked?: boolean;
}

export function ActionPanel({
  game,
  field,
  dice,
  rolling,
  moving,
  missionRolling,
  missionValue,
  canBuy,
  canUpgrade,
  onRoll,
  onBuy,
  onDecline,
  onDraw,
  onLevels,
  onEnd,
  onBlocked,
  onMission,
  onSilenceBreak,
  locked = false,
}: ActionPanelProps) {
  const player = game.players[game.currentPlayerIndex];
  const busy = rolling || moving || locked;

  return (
    <section className="turn-panel">
      <div className="turn-heading">
        <div>
          <p className="eyebrow">Runde {game.turn}</p>
          <h2>{player.name} ist am Zug</h2>
        </div>
        <span
          className="large-token"
          style={{ "--token-color": player.token.color } as CSSProperties}
        >
          {player.token.symbol}
        </span>
      </div>

      <div className="status-strip">
        <span className={player.protectionUsed ? "spent" : ""}>
          ◆ Schutz {player.protectionUsed ? "verbraucht" : "bereit"}
        </span>
        {player.paymentShield && <span>▣ Zahlung geschützt</span>}
        {player.silenceOath && <span className="warning">V Schweigeregel aktiv</span>}
      </div>

      <p className="game-message">{game.message}</p>
      {locked && <p className="remote-turn-note">Warte auf den Zug eines Mitspielers.</p>}

      <fieldset className="action-controls" disabled={locked}>
      <div className={`dice-zone ${rolling ? "rolling" : ""}`}>
        <div className="dice-pair">
          <Dice value={dice[0]} />
          <Dice value={dice[1]} />
        </div>
        <div className="dice-total">{game.dice ? game.dice[0] + game.dice[1] : "?"}</div>
        <button
          type="button"
          className="primary-button roll-button"
          onClick={onRoll}
          disabled={game.hasRolled || busy || game.phase === "finished"}
        >
          {rolling ? "Würfel rollen…" : moving ? "Figur bewegt sich…" : game.hasRolled ? "Gewürfelt" : "Würfeln"}
        </button>
      </div>

      <div className="action-grid">
        {game.awaitingAction === "property" && (
          <>
            <button type="button" className="primary-button" disabled={!canBuy} onClick={onBuy}>
              Kaufen {field.price} ◆
            </button>
            <button type="button" className="ghost-button" onClick={onDecline}>
              Ablehnen
            </button>
          </>
        )}

        {game.awaitingAction === "draw-boten" && (
          <button type="button" className="primary-button full-action" onClick={() => onDraw("boten")}>
            Boten-Karte ziehen
          </button>
        )}

        {game.awaitingAction === "draw-reality" && (
          <button
            type="button"
            className="primary-button reality-button full-action"
            onClick={() => onDraw("reality")}
          >
            Realitätskarte ziehen
          </button>
        )}

        {game.awaitingAction === "blocked-choice" && (
          <>
            <button
              type="button"
              className="primary-button"
              disabled={player.money < 100}
              onClick={() => onBlocked(true)}
            >
              100 ◆ zahlen
            </button>
            <button type="button" className="ghost-button" onClick={() => onBlocked(false)}>
              Runde aussetzen
            </button>
          </>
        )}

        {game.awaitingAction === "final-mission" && (
          <button
            type="button"
            className="mission-button full-action"
            onClick={onMission}
            disabled={missionRolling}
          >
            <Dice value={missionValue} />
            {missionRolling ? "Mission läuft…" : "Missionswürfel werfen"}
          </button>
        )}

        {game.hasRolled && !game.awaitingAction && game.phase === "playing" && !busy && (
          <>
            <button type="button" className="ghost-button" disabled={!canUpgrade} onClick={onLevels}>
              Level-Up kaufen
            </button>
            <button type="button" className="primary-button" onClick={onEnd}>
              Runde beenden
            </button>
          </>
        )}

        {player.silenceOath && (
          <button type="button" className="silence-button full-action" onClick={onSilenceBreak}>
            Schweigeregel-Verstoß melden
          </button>
        )}
      </div>
      </fieldset>
    </section>
  );
}
