import { useEffect, useRef, useState } from "react";
import { ActionPanel } from "./components/ActionPanel";
import { Board } from "./components/Board";
import { BottomNav } from "./components/BottomNav";
import { CardModal } from "./components/CardModal";
import { EffectToast } from "./components/EffectToast";
import { FieldView } from "./components/FieldView";
import { Modal } from "./components/Modal";
import { OnlineLobby } from "./components/OnlineLobby";
import { PlayerPanel } from "./components/PlayerPanel";
import { PropertyCard } from "./components/PropertyCard";
import { RulesModal } from "./components/RulesModal";
import { SetupScreen } from "./components/SetupScreen";
import { botenCards, realityCards } from "./data/cards";
import { fieldById, fields, getLevelLabel } from "./data/fields";
import type {
  GameCommand,
  GameState,
  MobileTab,
  NetworkRole,
  OnlineParticipant,
  PeerMessage,
  Player,
  PlayerSetup,
} from "./types";
import { P2PNetwork } from "./utils/p2p";
import {
  advancePlayerOne,
  buyCurrentProperty,
  buyLevel,
  calculateScore,
  closeCard,
  createGame,
  declineProperty,
  drawCard,
  endTurn,
  finishByScore,
  getUpgradeableProperties,
  reportSilenceBreak,
  resolveBlockedChoice,
  resolveCardDefense,
  resolveCurrentField,
  resolveFinalMission,
  setRollResult,
} from "./utils/gameLogic";

const STORAGE_KEY = "erebopoly-save-v2";
const OLD_STORAGE_KEY = "erebopoly-save-v1";

function migratePlayer(player: Partial<Player>): Player {
  return {
    id: player.id ?? `player-${Date.now()}-${Math.random()}`,
    name: player.name ?? "Spieler",
    token: player.token!,
    position: (player.position ?? 0) % fields.length,
    money: player.money ?? 1500,
    owned: (player.owned ?? []).filter((id) => Boolean(fieldById[id])),
    levels: player.levels ?? {},
    bankrupt: player.bankrupt ?? false,
    skipTurns: player.skipTurns ?? 0,
    protectionUsed: player.protectionUsed ?? false,
    paymentShield: player.paymentShield ?? false,
    silenceOath: player.silenceOath ?? false,
  };
}

function loadSavedGame(): GameState | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(OLD_STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<GameState> & { version?: number };
    if (!parsed.players?.length) return null;
    return {
      version: 2,
      phase: parsed.phase ?? "playing",
      players: parsed.players.map(migratePlayer),
      currentPlayerIndex: parsed.currentPlayerIndex ?? 0,
      dice: parsed.dice ?? null,
      hasRolled: parsed.hasRolled ?? false,
      awaitingAction: parsed.awaitingAction ?? null,
      lastCard: null,
      pendingCard: null,
      lastEffect: null,
      message: parsed.message ?? "Gespeichertes Spiel geladen.",
      log: parsed.log ?? [],
      winnerId: parsed.winnerId ?? null,
      turn: parsed.turn ?? 1,
    };
  } catch {
    return null;
  }
}

export default function App() {
  const [savedGame] = useState(loadSavedGame);
  const [game, setGame] = useState<GameState | null>(null);
  const [setupMode, setSetupMode] = useState<"local" | "online">("local");
  const [networkRole, setNetworkRole] = useState<NetworkRole>("local");
  const [participants, setParticipants] = useState<OnlineParticipant[]>([]);
  const [connectedPeers, setConnectedPeers] = useState(0);
  const [invitationCode, setInvitationCode] = useState("");
  const [answerCode, setAnswerCode] = useState("");
  const [networkError, setNetworkError] = useState("");
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MobileTab>("board");
  const [rolling, setRolling] = useState(false);
  const [moving, setMoving] = useState(false);
  const [dicePreview, setDicePreview] = useState<[number, number]>([1, 1]);
  const [missionRolling, setMissionRolling] = useState(false);
  const [missionValue, setMissionValue] = useState(1);
  const [propertyOwnerId, setPropertyOwnerId] = useState<string | null>(null);
  const [showLevels, setShowLevels] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const timers = useRef<number[]>([]);
  const networkRef = useRef<P2PNetwork | null>(null);
  const pendingPeerIdRef = useRef<string | null>(null);
  const peerClientsRef = useRef(new Map<string, string>());
  const peerPlayersRef = useRef(new Map<string, string>());
  const guestProfileRef = useRef<OnlineParticipant | null>(null);
  const profileSentRef = useRef(false);
  const commandHandlerRef = useRef<(command: GameCommand) => void>(() => undefined);
  const networkMessageRef = useRef<(message: PeerMessage, peerId: string) => void>(
    () => undefined,
  );
  const gameRef = useRef<GameState | null>(null);
  const roleRef = useRef<NetworkRole>("local");
  const participantsRef = useRef<OnlineParticipant[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      networkRef.current?.close();
    },
    [],
  );

  useEffect(() => {
    gameRef.current = game;
    if (game) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
      if (networkRole === "host") networkRef.current?.broadcast({ type: "state", game });
    }
  }, [game, networkRole]);

  useEffect(() => {
    roleRef.current = networkRole;
  }, [networkRole]);

  useEffect(() => {
    participantsRef.current = participants;
    if (networkRole === "host") {
      networkRef.current?.broadcast({ type: "lobby", players: participants });
    }
  }, [participants, networkRole]);

  const startGame = (players: PlayerSetup[]) => {
    setNetworkRole("local");
    setGame(createGame(players));
    setActiveTab("board");
  };

  const configureNetwork = () => {
    if (!("RTCPeerConnection" in window)) {
      throw new Error("Dieser Browser unterstützt keine WebRTC-P2P-Verbindungen.");
    }
    networkRef.current?.close();
    const network = new P2PNetwork();
    network.onMessage((message, peerId) => networkMessageRef.current(message, peerId));
    network.onStatus(() => {
      const count = network.connectedPeerIds().length;
      setConnectedPeers(count);
      if (
        roleRef.current === "guest" &&
        count > 0 &&
        guestProfileRef.current &&
        !profileSentRef.current
      ) {
        profileSentRef.current = true;
        network.send("host", { type: "profile", profile: guestProfileRef.current });
      }
    });
    networkRef.current = network;
    return network;
  };

  const leaveOnline = () => {
    networkRef.current?.close();
    networkRef.current = null;
    peerClientsRef.current.clear();
    peerPlayersRef.current.clear();
    guestProfileRef.current = null;
    profileSentRef.current = false;
    pendingPeerIdRef.current = null;
    setNetworkRole("local");
    setParticipants([]);
    setConnectedPeers(0);
    setInvitationCode("");
    setAnswerCode("");
    setNetworkError("");
    setLocalPlayerId(null);
    setSetupMode("local");
  };

  const becomeHost = (profile: OnlineParticipant) => {
    try {
      configureNetwork();
      setNetworkRole("host");
      setParticipants([profile]);
      setLocalPlayerId(profile.clientId);
      setNetworkError("");
    } catch (error) {
      setNetworkError(error instanceof Error ? error.message : "Lobby konnte nicht starten.");
    }
  };

  const createInvitation = async () => {
    try {
      setNetworkError("");
      const invitation = await networkRef.current!.createHostOffer();
      pendingPeerIdRef.current = invitation.peerId;
      setInvitationCode(invitation.code);
    } catch (error) {
      setNetworkError(error instanceof Error ? error.message : "Einladung fehlgeschlagen.");
    }
  };

  const acceptAnswer = async (answer: string) => {
    try {
      const peerId = pendingPeerIdRef.current;
      if (!peerId) throw new Error("Es gibt keine aktive Einladung.");
      await networkRef.current!.acceptHostAnswer(peerId, answer);
      pendingPeerIdRef.current = null;
      setInvitationCode("");
      setNetworkError("");
    } catch (error) {
      setNetworkError(error instanceof Error ? error.message : "Antwort ungültig.");
    }
  };

  const becomeGuest = async (profile: OnlineParticipant, offer: string) => {
    try {
      const network = configureNetwork();
      guestProfileRef.current = profile;
      profileSentRef.current = false;
      setNetworkRole("guest");
      setParticipants([profile]);
      setLocalPlayerId(profile.clientId);
      setNetworkError("");
      setAnswerCode(await network.createGuestAnswer(offer));
    } catch (error) {
      setNetworkError(error instanceof Error ? error.message : "Verbindung fehlgeschlagen.");
    }
  };

  const startOnlineGame = () => {
    if (networkRole !== "host" || participants.length < 2) return;
    const nextGame = createGame(participants);
    const ownParticipant = participants[0];
    const ownPlayer = nextGame.players[0];
    setLocalPlayerId(ownPlayer.id);

    peerClientsRef.current.forEach((clientId, peerId) => {
      const index = participants.findIndex((participant) => participant.clientId === clientId);
      const playerId = nextGame.players[index]?.id;
      if (playerId) {
        peerPlayersRef.current.set(peerId, playerId);
        networkRef.current?.send(peerId, { type: "start", game: nextGame, playerId });
      }
    });

    setGame(nextGame);
    setActiveTab("board");
    if (!ownParticipant) setNetworkError("Host-Profil fehlt.");
  };

  const resetGame = () => {
    if (!window.confirm("Gespeicherten Spielstand wirklich löschen?")) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(OLD_STORAGE_KEY);
    setGame(null);
    window.location.reload();
  };

  const handleRoll = () => {
    const currentGame = gameRef.current;
    if (!currentGame || currentGame.hasRolled || rolling || moving) return;
    setRolling(true);

    const animation = window.setInterval(() => {
      setDicePreview([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
    }, 90);

    const finishRoll = window.setTimeout(() => {
      window.clearInterval(animation);
      const dice: [number, number] = [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ];
      const distance = dice[0] + dice[1];
      setDicePreview(dice);
      setRolling(false);
      setMoving(true);
      setGame((current) => (current ? setRollResult(current, dice) : current));

      let moved = 0;
      const movement = window.setInterval(() => {
        moved += 1;
        setGame((current) => {
          if (!current) return current;
          const stepped = advancePlayerOne(current);
          return moved === distance ? resolveCurrentField(stepped) : stepped;
        });
        if (moved === distance) {
          window.clearInterval(movement);
          setMoving(false);
        }
      }, 170);
      timers.current.push(movement);
    }, 1000);

    timers.current.push(animation, finishRoll);
  };

  const handleMissionRoll = () => {
    if (!gameRef.current || missionRolling) return;
    setMissionRolling(true);
    const animation = window.setInterval(
      () => setMissionValue(Math.floor(Math.random() * 6) + 1),
      90,
    );
    const finish = window.setTimeout(() => {
      window.clearInterval(animation);
      const value = Math.floor(Math.random() * 6) + 1;
      setMissionValue(value);
      setMissionRolling(false);
      setGame((current) => (current ? resolveFinalMission(current, value) : current));
    }, 800);
    timers.current.push(animation, finish);
  };

  const performCommand = (command: GameCommand) => {
    switch (command.type) {
      case "roll":
        handleRoll();
        break;
      case "mission":
        handleMissionRoll();
        break;
      case "buy":
        setGame((current) => (current ? buyCurrentProperty(current) : current));
        break;
      case "decline":
        setGame((current) => (current ? declineProperty(current) : current));
        break;
      case "draw":
        setGame((current) => (current ? drawCard(current, command.deck) : current));
        break;
      case "buy-level":
        setGame((current) => (current ? buyLevel(current, command.fieldId) : current));
        break;
      case "end-turn":
        setGame((current) => (current ? endTurn(current) : current));
        setActiveTab("board");
        break;
      case "blocked":
        setGame((current) => (current ? resolveBlockedChoice(current, command.pay) : current));
        break;
      case "card-defense":
        setGame((current) =>
          current ? resolveCardDefense(current, command.defend) : current,
        );
        break;
      case "close-card":
        setGame((current) => (current ? closeCard(current) : current));
        break;
      case "silence-break":
        setGame((current) => (current ? reportSilenceBreak(current) : current));
        break;
      case "finish-score":
        setGame((current) => (current ? finishByScore(current) : current));
        break;
    }
  };

  commandHandlerRef.current = performCommand;

  const submitCommand = (command: GameCommand) => {
    const current = gameRef.current;
    if (!current) return;
    const currentPlayer = current.players[current.currentPlayerIndex];

    if (networkRole === "guest") {
      if (!localPlayerId || currentPlayer.id !== localPlayerId) return;
      networkRef.current?.send("host", {
        type: "command",
        command,
        playerId: localPlayerId,
      });
      return;
    }

    if (networkRole === "host" && currentPlayer.id !== localPlayerId) return;
    performCommand(command);
  };

  networkMessageRef.current = (message, peerId) => {
    if (message.type === "profile" && roleRef.current === "host") {
      const existing = participantsRef.current;
      if (existing.length >= 4) {
        networkRef.current?.send(peerId, { type: "error", message: "Die Lobby ist voll." });
        return;
      }
      if (existing.some((participant) => participant.token.id === message.profile.token.id)) {
        networkRef.current?.send(peerId, {
          type: "error",
          message: "Diese Spielfigur ist bereits vergeben.",
        });
        return;
      }
      peerClientsRef.current.set(peerId, message.profile.clientId);
      setParticipants((current) =>
        current.some((participant) => participant.clientId === message.profile.clientId)
          ? current
          : [...current, message.profile],
      );
      return;
    }

    if (message.type === "lobby" && roleRef.current === "guest") {
      setParticipants(message.players);
      return;
    }

    if (message.type === "start" && roleRef.current === "guest") {
      setLocalPlayerId(message.playerId);
      setGame(message.game);
      setActiveTab("board");
      return;
    }

    if (message.type === "state" && roleRef.current === "guest") {
      setGame(message.game);
      return;
    }

    if (message.type === "command" && roleRef.current === "host") {
      const authorizedPlayerId = peerPlayersRef.current.get(peerId);
      const current = gameRef.current;
      if (
        authorizedPlayerId &&
        authorizedPlayerId === message.playerId &&
        current?.players[current.currentPlayerIndex].id === authorizedPlayerId
      ) {
        commandHandlerRef.current(message.command);
      } else {
        networkRef.current?.send(peerId, {
          type: "error",
          message: "Diese Aktion ist gerade nicht erlaubt.",
        });
      }
      return;
    }

    if (message.type === "error") setNetworkError(message.message);
  };

  if (!game) {
    if (setupMode === "online") {
      return (
        <main className="setup-screen online-setup-screen">
          <section className="setup-hero">
            <div className="setup-logo">EREBOPOLY</div>
            <p>Online-Modus mit direkter WebRTC-Verbindung zwischen den Geräten.</p>
            <p className="project-credit">
              Erstellt von <strong>Lasse, Julian &amp; Mateusz</strong>
              <span>als Schulprojekt</span>
            </p>
          </section>
          <OnlineLobby
            role={networkRole}
            participants={participants}
            connectedPeers={connectedPeers}
            invitationCode={invitationCode}
            answerCode={answerCode}
            networkError={networkError}
            onBack={leaveOnline}
            onBecomeHost={becomeHost}
            onCreateInvitation={createInvitation}
            onAcceptAnswer={acceptAnswer}
            onBecomeGuest={becomeGuest}
            onStartOnline={startOnlineGame}
          />
        </main>
      );
    }
    return (
      <SetupScreen
        onStart={startGame}
        hasSave={Boolean(savedGame)}
        onContinue={() => savedGame && setGame(savedGame)}
        onOnline={() => setSetupMode("online")}
      />
    );
  }

  const currentPlayer = game.players[game.currentPlayerIndex];
  const currentField = fields[currentPlayer.position];
  const owner = game.players.find((player) => player.owned.includes(currentField.id));
  const level = owner?.levels[currentField.id] ?? 0;
  const upgradeable = getUpgradeableProperties(game);
  const selectedOwner = game.players.find((player) => player.id === propertyOwnerId);
  const winner = game.players.find((player) => player.id === game.winnerId);
  const canBuy =
    game.awaitingAction === "property" &&
    currentField.kind === "property" &&
    currentPlayer.money >= (currentField.price ?? 0);
  const allOwned = game.players.flatMap((player) =>
    player.owned.map((id) => ({ field: fieldById[id], owner: player })),
  );
  const ranking = [...game.players].sort((a, b) => calculateScore(b) - calculateScore(a));
  const canInteract =
    networkRole === "local" || game.players[game.currentPlayerIndex].id === localPlayerId;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Das Spiel zu Erebos</p>
          <strong>EREBOPOLY</strong>
        </div>
        <div className="topbar-actions">
          {networkRole !== "local" && (
            <span className={`network-badge ${connectedPeers > 0 ? "connected" : ""}`}>
              {networkRole === "host" ? "Host" : "P2P"} · {connectedPeers}
            </span>
          )}
          <button type="button" className="icon-button" onClick={() => setShowLog(true)}>
            Protokoll
          </button>
          <button type="button" className="icon-button danger" onClick={resetGame}>
            Neu
          </button>
        </div>
      </header>

      <main className={`game-layout tab-${activeTab}`}>
        <section className="board-wrap">
          <Board game={game} moving={moving} />
        </section>

        <aside className="game-sidebar">
          <div className="player-pane">
            <div className="pane-heading">
              <p className="eyebrow">Konten</p>
              <h2>Spielerübersicht</h2>
            </div>
            <PlayerPanel game={game} onShowProperties={setPropertyOwnerId} />
          </div>

          <div className="turn-pane">
            <FieldView field={currentField} owner={owner} level={level} />
            <ActionPanel
              game={game}
              field={currentField}
              dice={rolling ? dicePreview : game.dice ?? dicePreview}
              rolling={rolling}
              moving={moving}
              missionRolling={missionRolling}
              missionValue={missionValue}
              canBuy={canBuy}
              canUpgrade={upgradeable.length > 0}
              onRoll={() => submitCommand({ type: "roll" })}
              onBuy={() => submitCommand({ type: "buy" })}
              onDecline={() => submitCommand({ type: "decline" })}
              onDraw={(deck) => submitCommand({ type: "draw", deck })}
              onLevels={() => setShowLevels(true)}
              onEnd={() => submitCommand({ type: "end-turn" })}
              onBlocked={(pay) => submitCommand({ type: "blocked", pay })}
              onMission={() => submitCommand({ type: "mission" })}
              onSilenceBreak={() => submitCommand({ type: "silence-break" })}
              locked={!canInteract}
            />
          </div>

          <section className="cards-pane mobile-library">
            <div className="pane-heading">
              <p className="eyebrow">Kartenarchiv</p>
              <h2>Boten- und Realitätskarten</h2>
            </div>
            <div className="deck-overview">
              <CardDeck title="Boten-Karten" symbol="V" cards={botenCards} />
              <CardDeck title="Realitätskarten" symbol="◈" cards={realityCards} />
            </div>
          </section>

          <section className="properties-pane mobile-library">
            <div className="pane-heading">
              <p className="eyebrow">Besitzarchiv</p>
              <h2>Alle Besitzkarten</h2>
            </div>
            <div className="property-card-list">
              {allOwned.length === 0 ? (
                <p className="empty-state">Noch wurde kein Ort gekauft.</p>
              ) : (
                allOwned.map(({ field, owner: propertyOwner }) => (
                  <PropertyCard
                    key={`${propertyOwner.id}-${field.id}`}
                    field={field}
                    owner={propertyOwner}
                  />
                ))
              )}
            </div>
          </section>
        </aside>
      </main>

      <EffectToast effect={game.lastEffect} />
      <BottomNav
        active={activeTab}
        onChange={setActiveTab}
        onRules={() => setShowRules(true)}
      />

      {game.lastCard && (
        <CardModal
          card={game.lastCard}
          canDefend={Boolean(game.pendingCard)}
          onDefend={() => submitCommand({ type: "card-defense", defend: true })}
          onAccept={() => submitCommand({ type: "card-defense", defend: false })}
          onClose={() => submitCommand({ type: "close-card" })}
        />
      )}

      {selectedOwner && (
        <Modal title={`Besitz von ${selectedOwner.name}`} onClose={() => setPropertyOwnerId(null)}>
          <div className="property-card-list">
            {selectedOwner.owned.length === 0 ? (
              <p className="empty-state">Noch keine Orte im Besitz.</p>
            ) : (
              selectedOwner.owned.map((id) => (
                <PropertyCard key={id} field={fieldById[id]} owner={selectedOwner} />
              ))
            )}
          </div>
        </Modal>
      )}

      {showLevels && (
        <Modal title="Level-Up kaufen" onClose={() => setShowLevels(false)}>
          <p className="modal-intro">
            Drei Level-Ups führen zum Meisterrang. Der Meisterrang kostet das Doppelte.
          </p>
          <div className="property-list">
            {upgradeable.map((field) => {
              const currentLevel = currentPlayer.levels[field.id] ?? 0;
              const cost = (field.levelCost ?? 0) * (currentLevel === 3 ? 2 : 1);
              return (
                <button
                  type="button"
                  className={`property-row property-button group-${field.group}`}
                  key={field.id}
                  disabled={!canInteract}
                  onClick={() => {
                    submitCommand({ type: "buy-level", fieldId: field.id });
                    setShowLevels(false);
                  }}
                >
                  <span>{field.icon}</span>
                  <div>
                    <strong>{field.name}</strong>
                    <small>
                      {getLevelLabel(currentLevel + 1)} für {cost} ◆
                    </small>
                  </div>
                </button>
              );
            })}
          </div>
        </Modal>
      )}

      {showLog && (
        <Modal title="Spielprotokoll" onClose={() => setShowLog(false)}>
          <ol className="game-log">
            {game.log.map((entry, index) => (
              <li key={`${entry}-${index}`}>{entry}</li>
            ))}
          </ol>
          {game.phase === "playing" && (
            <button
              type="button"
              className="ghost-button wide"
              onClick={() => {
                submitCommand({ type: "finish-score" });
                setShowLog(false);
              }}
            >
              Spiel nach Gesamtwert beenden
            </button>
          )}
        </Modal>
      )}

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {game.phase === "finished" && winner && (
        <Modal title={`${winner.name} gewinnt`} onClose={() => undefined}>
          <div className="winner-mark">{winner.token.symbol}</div>
          <p className="modal-card-text">Erebos ist zusammengebrochen. Die Gesamtwerte:</p>
          <ol className="ranking-list">
            {ranking.map((player) => (
              <li key={player.id}>
                <span>{player.name}</span>
                <strong>{calculateScore(player)} ◆</strong>
              </li>
            ))}
          </ol>
          <button type="button" className="primary-button wide" onClick={resetGame}>
            Neue Partie
          </button>
        </Modal>
      )}
    </div>
  );
}

function CardDeck({
  title,
  symbol,
  cards,
}: {
  title: string;
  symbol: string;
  cards: typeof botenCards;
}) {
  return (
    <section className="deck-list">
      <header>
        <span>{symbol}</span>
        <div>
          <strong>{title}</strong>
          <small>{cards.length} Karten</small>
        </div>
      </header>
      {cards.map((card) => (
        <article key={card.id} className={card.negative ? "negative" : ""}>
          <strong>{card.title}</strong>
          <p>{card.text}</p>
        </article>
      ))}
    </section>
  );
}
