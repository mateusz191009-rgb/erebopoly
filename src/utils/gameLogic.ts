import { decks } from "../data/cards";
import { fieldById, fields, getRent } from "../data/fields";
import type { GameCard, GameEffect, GameState, Player, PlayerSetup } from "../types";

export const START_MONEY = 1500;
export const START_BONUS = 200;
export const PROTECTION_COST = 100;
export const MAX_LEVEL = 4;

const clonePlayers = (players: Player[]) =>
  players.map((player) => ({
    ...player,
    owned: [...player.owned],
    levels: { ...player.levels },
  }));

const effect = (
  type: GameEffect["type"],
  text: string,
  amount?: number,
): GameEffect => ({
  id: Date.now() + Math.random(),
  type,
  text,
  amount,
});

const appendLog = (state: GameState, entry: string): GameState => ({
  ...state,
  log: [entry, ...state.log].slice(0, 18),
});

const ownerIndexOf = (state: GameState, fieldId: string) =>
  state.players.findIndex((player) => !player.bankrupt && player.owned.includes(fieldId));

const markBankruptPlayers = (state: GameState): GameState => {
  const players = clonePlayers(state.players);
  const newlyEliminated: string[] = [];

  players.forEach((player) => {
    if (!player.bankrupt && player.money <= 0) {
      player.money = 0;
      player.bankrupt = true;
      player.owned = [];
      player.levels = {};
      newlyEliminated.push(player.name);
    }
  });

  if (newlyEliminated.length === 0) return state;

  const active = players.filter((player) => !player.bankrupt);
  const finished = active.length <= 1;
  const message = finished
    ? `${active[0]?.name ?? "Niemand"} bleibt als letzte aktive Person übrig.`
    : `${newlyEliminated.join(", ")} ist ausgeschieden.`;

  return {
    ...state,
    players,
    phase: finished ? "finished" : state.phase,
    winnerId: finished ? (active[0]?.id ?? null) : state.winnerId,
    message,
    lastEffect: effect("loss", message),
    log: [message, ...state.log].slice(0, 18),
  };
};

const chargePlayer = (
  players: Player[],
  payerIndex: number,
  amount: number,
  recipientIndex?: number,
) => {
  const payer = players[payerIndex];
  if (payer.paymentShield) {
    payer.paymentShield = false;
    return { paid: 0, blocked: true };
  }

  const paid = Math.min(amount, Math.max(0, payer.money));
  payer.money -= paid;
  if (recipientIndex !== undefined) players[recipientIndex].money += paid;
  return { paid, blocked: false };
};

export const createGame = (setups: PlayerSetup[]): GameState => ({
  version: 2,
  phase: "playing",
  players: setups.map((setup, index) => ({
    id: `player-${Date.now()}-${index}`,
    name: setup.name.trim() || `Spieler ${index + 1}`,
    token: setup.token,
    position: 0,
    money: START_MONEY,
    owned: [],
    levels: {},
    bankrupt: false,
    skipTurns: 0,
    protectionUsed: false,
    paymentShield: false,
    silenceOath: false,
  })),
  currentPlayerIndex: 0,
  dice: null,
  hasRolled: false,
  awaitingAction: null,
  lastCard: null,
  pendingCard: null,
  lastEffect: null,
  message: `${setups[0].name || "Spieler 1"} entscheidet: eintreten oder umkehren?`,
  log: ["Die Verbindung zu Erebopoly wurde hergestellt."],
  winnerId: null,
  turn: 1,
});

export const setRollResult = (state: GameState, dice: [number, number]): GameState => {
  if (state.hasRolled || state.phase !== "playing") return state;
  const player = state.players[state.currentPlayerIndex];
  return {
    ...state,
    dice,
    hasRolled: true,
    lastCard: null,
    pendingCard: null,
    lastEffect: effect("move", `${player.name} würfelt ${dice[0] + dice[1]}.`),
    message: `${player.name} würfelt ${dice[0] + dice[1]}.`,
  };
};

export const advancePlayerOne = (state: GameState): GameState => {
  const players = clonePlayers(state.players);
  const player = players[state.currentPlayerIndex];
  const nextPosition = (player.position + 1) % fields.length;
  let lastEffect = state.lastEffect;
  let message = state.message;

  if (nextPosition === 0) {
    player.money += START_BONUS;
    lastEffect = effect("gain", `Startbonus +${START_BONUS}`, START_BONUS);
    message = `${player.name} überquert den Eintritt und erhält ${START_BONUS} Kristalle.`;
  }

  player.position = nextPosition;
  return { ...state, players, lastEffect, message };
};

export const finishByScore = (state: GameState): GameState => {
  const ranked = [...state.players].sort((a, b) => calculateScore(b) - calculateScore(a));
  const winner = ranked[0];
  return {
    ...state,
    phase: "finished",
    awaitingAction: null,
    winnerId: winner?.id ?? null,
    message: winner ? `${winner.name} gewinnt nach Gesamtwert.` : "Das Spiel ist beendet.",
    lastEffect: effect("card", "Erebos bricht zusammen. Die Konten werden ausgewertet."),
  };
};

export const resolveCurrentField = (state: GameState): GameState => {
  const players = clonePlayers(state.players);
  const player = players[state.currentPlayerIndex];
  const field = fields[player.position];
  let awaitingAction: GameState["awaitingAction"] = null;
  let message = `${player.name} landet auf ${field.name}.`;
  let lastEffect = effect("move", message);

  if (field.kind === "property") {
    const ownerIndex = ownerIndexOf({ ...state, players }, field.id);
    if (ownerIndex === -1) {
      awaitingAction = "property";
      message = `${field.name} ist frei und kostet ${field.price} Kristalle.`;
    } else if (ownerIndex !== state.currentPlayerIndex) {
      const owner = players[ownerIndex];
      const level = owner.levels[field.id] ?? 0;
      const rent = getRent(field, level);
      const payment = chargePlayer(players, state.currentPlayerIndex, rent, ownerIndex);
      if (payment.blocked) {
        message = `Victors Schutz verhindert die Miete von ${rent} Kristallen.`;
        lastEffect = effect("shield", "Zahlung verhindert");
      } else {
        message = `${player.name} zahlt ${payment.paid} Kristalle Miete an ${owner.name}.`;
        lastEffect = effect("rent", `Miete -${payment.paid}`, -payment.paid);
      }
    } else {
      message = `${player.name} kehrt zum eigenen Ort zurück.`;
    }
  } else if (field.kind === "fee") {
    const payment = chargePlayer(players, state.currentPlayerIndex, field.fee ?? 0);
    if (payment.blocked) {
      message = `Victors Schutz verhindert die Gebühr auf ${field.name}.`;
      lastEffect = effect("shield", "Gebühr verhindert");
    } else {
      message = `${player.name} zahlt ${payment.paid} Kristalle für ${field.name}.`;
      lastEffect = effect("loss", `-${payment.paid} Kristalle`, -payment.paid);
    }
  } else if (field.kind === "boten") {
    awaitingAction = "draw-boten";
    message = "Der Bote wartet. Ziehe eine Boten-Karte.";
  } else if (field.kind === "reality") {
    awaitingAction = "draw-reality";
    message = "Die Realität dringt durch. Ziehe eine Realitätskarte.";
  } else if (field.kind === "blocked") {
    awaitingAction = "blocked-choice";
    message = "Der Bote sperrt dein Konto: 100 Kristalle zahlen oder eine Runde aussetzen.";
  } else if (field.kind === "finalMission") {
    awaitingAction = "final-mission";
    message = "Die letzte Mission beginnt. Würfle einen Missionswürfel.";
  } else if (field.kind === "safe") {
    message = `${player.name} erreicht einen sicheren Speicherpunkt.`;
  } else if (field.kind === "gameEnd") {
    return finishByScore(
      appendLog({ ...state, players, message }, `${player.name} löst das Spielende aus.`),
    );
  }

  return markBankruptPlayers(
    appendLog({ ...state, players, awaitingAction, message, lastEffect }, message),
  );
};

export const rollAndMove = (state: GameState, dice: [number, number]): GameState => {
  let next = setRollResult(state, dice);
  for (let step = 0; step < dice[0] + dice[1]; step += 1) next = advancePlayerOne(next);
  return resolveCurrentField(next);
};

export const buyCurrentProperty = (state: GameState): GameState => {
  const field = fields[state.players[state.currentPlayerIndex].position];
  const players = clonePlayers(state.players);
  const player = players[state.currentPlayerIndex];

  if (
    field.kind !== "property" ||
    ownerIndexOf(state, field.id) !== -1 ||
    player.money < (field.price ?? 0)
  ) {
    return state;
  }

  player.money -= field.price ?? 0;
  player.owned.push(field.id);
  const message = `${player.name} kauft ${field.name} für ${field.price} Kristalle.`;
  return appendLog(
    {
      ...state,
      players,
      awaitingAction: null,
      message,
      lastEffect: effect("loss", `Kauf -${field.price}`, -(field.price ?? 0)),
    },
    message,
  );
};

export const declineProperty = (state: GameState): GameState => ({
  ...state,
  awaitingAction: null,
  message: "Der Ort bleibt vorerst unbeansprucht.",
});

export const buyLevel = (state: GameState, fieldId: string): GameState => {
  const field = fieldById[fieldId];
  const players = clonePlayers(state.players);
  const player = players[state.currentPlayerIndex];
  const currentLevel = player.levels[fieldId] ?? 0;
  const cost = (field?.levelCost ?? 0) * (currentLevel === 3 ? 2 : 1);

  if (
    !field ||
    field.kind !== "property" ||
    !player.owned.includes(fieldId) ||
    currentLevel >= MAX_LEVEL ||
    player.money < cost
  ) {
    return state;
  }

  player.money -= cost;
  player.levels[fieldId] = currentLevel + 1;
  const rank = currentLevel + 1 === 4 ? "Meisterrang" : `Level ${currentLevel + 1}`;
  const message = `${player.name} verbessert ${field.name} auf ${rank}.`;
  return appendLog(
    {
      ...state,
      players,
      message,
      lastEffect: effect("loss", `${rank} -${cost}`, -cost),
    },
    message,
  );
};

const movePlayerTo = (state: GameState, position: number, collectStart = false) => {
  const players = clonePlayers(state.players);
  const player = players[state.currentPlayerIndex];
  let lastEffect = state.lastEffect;
  if (collectStart && position <= player.position) {
    player.money += START_BONUS;
    lastEffect = effect("gain", `Startbonus +${START_BONUS}`, START_BONUS);
  }
  player.position = position;
  return { ...state, players, lastEffect };
};

const applyCard = (state: GameState, card: GameCard): GameState => {
  let next: GameState = {
    ...state,
    players: clonePlayers(state.players),
    lastCard: card,
    pendingCard: null,
    awaitingAction: null,
    message: card.text,
    lastEffect: effect("card", card.title),
  };
  const effectData = card.effect;

  if (effectData.type === "money") {
    if (effectData.amount < 0) {
      const payment = chargePlayer(
        next.players,
        next.currentPlayerIndex,
        Math.abs(effectData.amount),
      );
      next.lastEffect = payment.blocked
        ? effect("shield", "Victors Schutz verhindert die Zahlung")
        : effect("loss", `${payment.paid} Kristalle verloren`, -payment.paid);
    } else {
      next.players[next.currentPlayerIndex].money += effectData.amount;
      next.lastEffect = effect("gain", `+${effectData.amount} Kristalle`, effectData.amount);
    }
  } else if (effectData.type === "skip") {
    next.players[next.currentPlayerIndex].skipTurns += effectData.turns;
  } else if (effectData.type === "silence") {
    next.players[next.currentPlayerIndex].silenceOath = true;
  } else if (effectData.type === "paymentShield") {
    next.players[next.currentPlayerIndex].paymentShield = true;
    next.lastEffect = effect("shield", "Nächste Zahlung geschützt");
  } else if (effectData.type === "moveBy") {
    const player = next.players[next.currentPlayerIndex];
    const rawPosition = player.position + effectData.spaces;
    if (effectData.spaces > 0 && rawPosition >= fields.length) player.money += START_BONUS;
    player.position = ((rawPosition % fields.length) + fields.length) % fields.length;
    next = resolveCurrentField(next);
  } else if (effectData.type === "moveTo") {
    const target = fields.findIndex((field) => field.id === effectData.fieldId);
    next = resolveCurrentField(movePlayerTo(next, target, true));
  } else if (effectData.type === "payEach") {
    next.players.forEach((_, index) => {
      if (index !== next.currentPlayerIndex && !next.players[index].bankrupt) {
        chargePlayer(next.players, next.currentPlayerIndex, effectData.amount, index);
      }
    });
  } else if (effectData.type === "collectEach") {
    next.players.forEach((other, index) => {
      if (index !== next.currentPlayerIndex && !other.bankrupt) {
        chargePlayer(next.players, index, effectData.amount, next.currentPlayerIndex);
      }
    });
  }

  return markBankruptPlayers(
    appendLog(
      { ...next, lastCard: card, pendingCard: null, message: card.text },
      `${card.title}: ${card.text}`,
    ),
  );
};

export const drawCard = (
  state: GameState,
  deckName: "boten" | "reality",
  random = Math.random,
): GameState => {
  const deck = decks[deckName];
  const card = deck[Math.floor(random() * deck.length)];
  const player = state.players[state.currentPlayerIndex];
  const canDefend = Boolean(card.negative && !player.protectionUsed && player.money > PROTECTION_COST);

  if (canDefend) {
    return {
      ...state,
      lastCard: card,
      pendingCard: card,
      awaitingAction: "card-defense",
      message: "Du kannst diese negative Karte einmalig für 100 Kristalle abwehren.",
      lastEffect: effect("card", card.title),
    };
  }

  return applyCard(state, card);
};

export const resolveCardDefense = (state: GameState, defend: boolean): GameState => {
  if (!state.pendingCard) return state;
  if (!defend) return applyCard(state, state.pendingCard);

  const players = clonePlayers(state.players);
  const player = players[state.currentPlayerIndex];
  player.money -= PROTECTION_COST;
  player.protectionUsed = true;
  const message = `${player.name} wehrt die Karte mit Wunschkristall-Schutz ab.`;
  return markBankruptPlayers(
    appendLog(
      {
        ...state,
        players,
        pendingCard: null,
        awaitingAction: null,
        message,
        lastEffect: effect("shield", `Karte abgewehrt -${PROTECTION_COST}`, -PROTECTION_COST),
      },
      message,
    ),
  );
};

export const closeCard = (state: GameState): GameState =>
  state.pendingCard ? state : { ...state, lastCard: null };

export const resolveBlockedChoice = (state: GameState, pay: boolean): GameState => {
  const players = clonePlayers(state.players);
  const player = players[state.currentPlayerIndex];

  if (pay && player.money >= 100) {
    const payment = chargePlayer(players, state.currentPlayerIndex, 100);
    const message = payment.blocked
      ? "Victors Schutz verhindert die Sperrgebühr."
      : `${player.name} zahlt 100 Kristalle und bleibt im Spiel.`;
    return appendLog(
      {
        ...state,
        players,
        awaitingAction: null,
        message,
        lastEffect: payment.blocked
          ? effect("shield", "Sperrgebühr verhindert")
          : effect("loss", "-100 Kristalle", -100),
      },
      message,
    );
  }

  player.skipTurns += 1;
  const message = `${player.name} setzt die nächste Runde aus.`;
  return appendLog({ ...state, players, awaitingAction: null, message }, message);
};

export const resolveFinalMission = (state: GameState, roll: number): GameState => {
  const players = clonePlayers(state.players);
  const player = players[state.currentPlayerIndex];
  let message: string;
  let lastEffect: GameEffect;

  if (roll <= 2) {
    const payment = chargePlayer(players, state.currentPlayerIndex, 150);
    message = payment.blocked
      ? "Victors Schutz verhindert den Verlust der gescheiterten Mission."
      : `Die Mission scheitert. ${player.name} zahlt ${payment.paid} Kristalle.`;
    lastEffect = payment.blocked
      ? effect("shield", "Missionsverlust verhindert")
      : effect("loss", `Mission -${payment.paid}`, -payment.paid);
  } else if (roll <= 4) {
    message = `${player.name} entkommt knapp. Nichts passiert.`;
    lastEffect = effect("move", "Knapp entkommen");
  } else {
    player.money += 250;
    message = `${player.name} verhindert Ortolans Tod und erhält 250 Kristalle.`;
    lastEffect = effect("gain", "Mission +250", 250);
  }

  return markBankruptPlayers(
    appendLog({ ...state, players, awaitingAction: null, message, lastEffect }, message),
  );
};

export const reportSilenceBreak = (state: GameState): GameState => {
  const players = clonePlayers(state.players);
  const player = players[state.currentPlayerIndex];
  if (!player.silenceOath) return state;

  const payment = chargePlayer(players, state.currentPlayerIndex, 50);
  player.silenceOath = false;
  const message = `${player.name} verletzt die Schweigeregel und zahlt ${payment.paid} Kristalle.`;
  return markBankruptPlayers(
    appendLog(
      {
        ...state,
        players,
        message,
        lastEffect: effect("loss", "Schweigeregel -50", -payment.paid),
      },
      message,
    ),
  );
};

export const getUpgradeableProperties = (state: GameState) => {
  const player = state.players[state.currentPlayerIndex];
  return player.owned
    .map((id) => fieldById[id])
    .filter((field) => {
      const level = player.levels[field.id] ?? 0;
      const cost = (field.levelCost ?? 0) * (level === 3 ? 2 : 1);
      return field && level < MAX_LEVEL && player.money >= cost;
    });
};

export const endTurn = (state: GameState): GameState => {
  if (!state.hasRolled || state.awaitingAction || state.phase !== "playing") return state;

  let nextIndex = state.currentPlayerIndex;
  const players = clonePlayers(state.players);
  players[state.currentPlayerIndex].silenceOath = false;
  let safety = 0;
  const skipped: string[] = [];

  do {
    nextIndex = (nextIndex + 1) % players.length;
    safety += 1;
    const candidate = players[nextIndex];
    if (!candidate.bankrupt && candidate.skipTurns > 0) {
      candidate.skipTurns -= 1;
      skipped.push(candidate.name);
      continue;
    }
    if (!candidate.bankrupt) break;
  } while (safety <= players.length * 2);

  const nextPlayer = players[nextIndex];
  const skipText = skipped.length > 0 ? ` ${skipped.join(", ")} setzt aus.` : "";
  return {
    ...state,
    players,
    currentPlayerIndex: nextIndex,
    dice: null,
    hasRolled: false,
    awaitingAction: null,
    lastCard: null,
    pendingCard: null,
    message: `${nextPlayer.name} ist am Zug.${skipText}`,
    turn: state.turn + 1,
  };
};

export const calculateScore = (player: Player) =>
  player.money +
  player.owned.reduce((sum, id) => {
    const field = fieldById[id];
    const level = player.levels[id] ?? 0;
    const levelValue =
      level <= 3
        ? level * (field?.levelCost ?? 0)
        : 3 * (field?.levelCost ?? 0) + 2 * (field?.levelCost ?? 0);
    return sum + (field?.price ?? 0) + levelValue;
  }, 0);
