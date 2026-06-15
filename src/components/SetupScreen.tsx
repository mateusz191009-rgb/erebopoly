import { useMemo, useState } from "react";
import { tokens } from "../data/tokens";
import type { PlayerSetup } from "../types";

interface SetupScreenProps {
  onStart: (players: PlayerSetup[]) => void;
  hasSave: boolean;
  onContinue: () => void;
  onOnline: () => void;
}

export function SetupScreen({ onStart, hasSave, onContinue, onOnline }: SetupScreenProps) {
  const [count, setCount] = useState(2);
  const [names, setNames] = useState(["Nick", "Emily", "Colin", "Adrian"]);
  const [tokenIds, setTokenIds] = useState(tokens.slice(0, 4).map((token) => token.id));

  const valid = useMemo(
    () =>
      names.slice(0, count).every((name) => name.trim().length > 0) &&
      new Set(tokenIds.slice(0, count)).size === count,
    [count, names, tokenIds],
  );

  const updateName = (index: number, name: string) => {
    const next = [...names];
    next[index] = name;
    setNames(next);
  };

  const updateToken = (index: number, tokenId: string) => {
    const next = [...tokenIds];
    next[index] = tokenId;
    setTokenIds(next);
  };

  const start = () => {
    if (!valid) return;
    onStart(
      names.slice(0, count).map((name, index) => ({
        name,
        token: tokens.find((token) => token.id === tokenIds[index]) ?? tokens[index],
      })),
    );
  };

  return (
    <main className="setup-screen">
      <section className="setup-hero">
        <div className="setup-raven">V</div>
        <div className="setup-logo" aria-label="Erebopoly">
          EREBOPOLY
        </div>
        <p>
          Ein Gerät. Bis zu vier Spielende. Ein Spiel, das jede Entscheidung speichert.
        </p>
        <p className="project-credit">
          Erstellt von <strong>Lasse, Julian &amp; Mateusz</strong>
          <span>als Schulprojekt</span>
        </p>
      </section>

      <section className="setup-card">
        <div className="setup-heading">
          <div>
            <p className="eyebrow">Neue Verbindung</p>
            <h2>Spielgruppe wählen</h2>
          </div>
          <div className="count-picker" aria-label="Anzahl Spieler">
            {[2, 3, 4].map((value) => (
              <button
                type="button"
                key={value}
                className={count === value ? "selected" : ""}
                onClick={() => setCount(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="setup-players">
          {Array.from({ length: count }, (_, index) => (
            <div className="setup-player" key={index}>
              <span className="setup-number">0{index + 1}</span>
              <label>
                Name
                <input
                  value={names[index]}
                  maxLength={16}
                  onChange={(event) => updateName(index, event.target.value)}
                />
              </label>
              <label>
                Figur
                <select
                  value={tokenIds[index]}
                  onChange={(event) => updateToken(index, event.target.value)}
                >
                  {tokens.map((token) => (
                    <option
                      key={token.id}
                      value={token.id}
                      disabled={tokenIds.slice(0, count).some(
                        (selected, selectedIndex) =>
                          selected === token.id && selectedIndex !== index,
                      )}
                    >
                      {token.symbol} {token.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}
        </div>

        {!valid && <p className="form-error">Bitte eindeutige Figuren und Namen wählen.</p>}
        <button type="button" className="primary-button wide" onClick={start} disabled={!valid}>
          Lokal spielen
        </button>
        <button type="button" className="online-button wide" onClick={onOnline}>
          Online per P2P
        </button>
        {hasSave && (
          <button type="button" className="ghost-button wide" onClick={onContinue}>
            Gespeichertes Spiel fortsetzen
          </button>
        )}
      </section>
    </main>
  );
}
