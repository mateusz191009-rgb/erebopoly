import { useState } from "react";
import { tokens } from "../data/tokens";
import type { NetworkRole, OnlineParticipant, Token } from "../types";

interface OnlineLobbyProps {
  role: NetworkRole;
  participants: OnlineParticipant[];
  connectedPeers: number;
  invitationCode: string;
  answerCode: string;
  networkError: string;
  onBack: () => void;
  onBecomeHost: (profile: OnlineParticipant) => void;
  onCreateInvitation: () => Promise<void>;
  onAcceptAnswer: (answer: string) => Promise<void>;
  onBecomeGuest: (profile: OnlineParticipant, offer: string) => Promise<void>;
  onStartOnline: () => void;
}

const createProfile = (name: string, token: Token): OnlineParticipant => ({
  clientId:
    globalThis.crypto?.randomUUID?.() ??
    `client-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name: name.trim() || "Spieler",
  token,
});

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function OnlineLobby({
  role,
  participants,
  connectedPeers,
  invitationCode,
  answerCode,
  networkError,
  onBack,
  onBecomeHost,
  onCreateInvitation,
  onAcceptAnswer,
  onBecomeGuest,
  onStartOnline,
}: OnlineLobbyProps) {
  const [selectedRole, setSelectedRole] = useState<"host" | "guest">("host");
  const [name, setName] = useState("Nick");
  const [tokenId, setTokenId] = useState(tokens[0].id);
  const [offerInput, setOfferInput] = useState("");
  const [answerInput, setAnswerInput] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedToken = tokens.find((token) => token.id === tokenId) ?? tokens[0];
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  if (role === "local") {
    return (
      <section className="setup-card online-card">
        <button type="button" className="back-link" onClick={onBack}>
          ← Zurück
        </button>
        <div className="setup-heading">
          <div>
            <p className="eyebrow">Direkte Verbindung</p>
            <h2>Online per P2P</h2>
          </div>
          <div className="mode-picker">
            <button
              type="button"
              className={selectedRole === "host" ? "selected" : ""}
              onClick={() => setSelectedRole("host")}
            >
              Host
            </button>
            <button
              type="button"
              className={selectedRole === "guest" ? "selected" : ""}
              onClick={() => setSelectedRole("guest")}
            >
              Beitreten
            </button>
          </div>
        </div>

        <div className="online-profile">
          <label>
            Dein Name
            <input value={name} maxLength={16} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Deine Figur
            <select value={tokenId} onChange={(event) => setTokenId(event.target.value)}>
              {tokens.map((token) => (
                <option key={token.id} value={token.id}>
                  {token.symbol} {token.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedRole === "host" ? (
          <button
            type="button"
            className="primary-button wide"
            disabled={!name.trim()}
            onClick={() => onBecomeHost(createProfile(name, selectedToken))}
          >
            Online-Lobby erstellen
          </button>
        ) : (
          <>
            <label className="signal-field">
              Einladungscode des Hosts
              <textarea
                value={offerInput}
                onChange={(event) => setOfferInput(event.target.value)}
                placeholder="Code hier einfügen"
              />
            </label>
            <button
              type="button"
              className="primary-button wide"
              disabled={!name.trim() || !offerInput.trim() || busy}
              onClick={() =>
                run(() => onBecomeGuest(createProfile(name, selectedToken), offerInput))
              }
            >
              {busy ? "Verbindung wird vorbereitet…" : "Antwortscode erzeugen"}
            </button>
          </>
        )}
        <p className="online-note">
          Die Codes werden nur zum Aufbau benötigt. Danach läuft das Spiel direkt zwischen den
          Geräten.
        </p>
      </section>
    );
  }

  if (role === "guest") {
    return (
      <section className="setup-card online-card">
        <p className="eyebrow">P2P-Gast</p>
        <h2>Antwort an den Host</h2>
        <p className="online-note">
          Sende diesen Antwortscode zurück. Sobald der Host ihn bestätigt, erscheint die Lobby.
        </p>
        <SignalCode value={answerCode} label="Antwortscode" />
        <div className={`connection-state ${connectedPeers > 0 ? "connected" : ""}`}>
          {connectedPeers > 0 ? "Mit Host verbunden" : "Warte auf Bestätigung des Hosts…"}
        </div>
        {participants.length > 0 && <ParticipantList participants={participants} />}
        {networkError && <p className="form-error">{networkError}</p>}
        <button type="button" className="ghost-button wide" onClick={onBack}>
          Verbindung verlassen
        </button>
      </section>
    );
  }

  return (
    <section className="setup-card online-card">
      <div className="setup-heading">
        <div>
          <p className="eyebrow">Host-Lobby</p>
          <h2>{participants.length}/4 verbunden</h2>
        </div>
        <span className={`peer-badge ${connectedPeers > 0 ? "connected" : ""}`}>
          {connectedPeers} P2P
        </span>
      </div>

      <ParticipantList participants={participants} />

      {participants.length < 4 && (
        <div className="host-connect-box">
          {!invitationCode ? (
            <button
              type="button"
              className="ghost-button wide"
              disabled={busy}
              onClick={() => run(onCreateInvitation)}
            >
              Einladung für nächsten Spieler erzeugen
            </button>
          ) : (
            <>
              <SignalCode value={invitationCode} label="Einladungscode" />
              <label className="signal-field">
                Antwortscode des Gasts
                <textarea
                  value={answerInput}
                  onChange={(event) => setAnswerInput(event.target.value)}
                  placeholder="Antwort hier einfügen"
                />
              </label>
              <button
                type="button"
                className="ghost-button wide"
                disabled={!answerInput.trim() || busy}
                onClick={() => run(() => onAcceptAnswer(answerInput))}
              >
                Antwort bestätigen
              </button>
            </>
          )}
        </div>
      )}

      {networkError && <p className="form-error">{networkError}</p>}
      <button
        type="button"
        className="primary-button wide"
        disabled={participants.length < 2 || connectedPeers < participants.length - 1}
        onClick={onStartOnline}
      >
        Online-Partie starten
      </button>
      <button type="button" className="ghost-button wide" onClick={onBack}>
        Lobby schließen
      </button>
    </section>
  );
}

function SignalCode({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="signal-code">
      <label>
        {label}
        <textarea value={value} readOnly />
      </label>
      <button
        type="button"
        className="code-copy"
        onClick={async () => {
          await copyText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? "Kopiert" : "Code kopieren"}
      </button>
    </div>
  );
}

function ParticipantList({ participants }: { participants: OnlineParticipant[] }) {
  return (
    <div className="online-participants">
      {participants.map((participant, index) => (
        <div key={participant.clientId}>
          <span
            className="online-token"
            style={{ "--token-color": participant.token.color } as React.CSSProperties}
          >
            {participant.token.symbol}
          </span>
          <strong>{participant.name}</strong>
          <small>{index === 0 ? "Host" : "Verbunden"}</small>
        </div>
      ))}
    </div>
  );
}
