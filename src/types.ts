export type FieldKind =
  | "start"
  | "property"
  | "boten"
  | "reality"
  | "fee"
  | "safe"
  | "blocked"
  | "finalMission"
  | "gameEnd";

export type PropertyGroup =
  | "brown"
  | "cyan"
  | "rose"
  | "red"
  | "amber"
  | "green"
  | "gold"
  | "violet";

export type RentTable = [number, number, number, number, number];

export interface Field {
  id: string;
  name: string;
  shortName: string;
  kind: FieldKind;
  icon: string;
  description: string;
  price?: number;
  rents?: RentTable;
  levelCost?: number;
  group?: PropertyGroup;
  fee?: number;
}

export type CardEffect =
  | { type: "money"; amount: number }
  | { type: "moveBy"; spaces: number }
  | { type: "moveTo"; fieldId: string }
  | { type: "skip"; turns: number }
  | { type: "payEach"; amount: number }
  | { type: "collectEach"; amount: number }
  | { type: "silence" }
  | { type: "paymentShield" };

export interface GameCard {
  id: string;
  deck: "boten" | "reality";
  title: string;
  text: string;
  effect: CardEffect;
  negative?: boolean;
}

export interface Token {
  id: string;
  label: string;
  symbol: string;
  color: string;
}

export interface Player {
  id: string;
  name: string;
  token: Token;
  position: number;
  money: number;
  owned: string[];
  levels: Record<string, number>;
  bankrupt: boolean;
  skipTurns: number;
  protectionUsed: boolean;
  paymentShield: boolean;
  silenceOath: boolean;
}

export type AwaitingAction =
  | "property"
  | "draw-boten"
  | "draw-reality"
  | "card-defense"
  | "blocked-choice"
  | "final-mission"
  | null;

export interface GameEffect {
  id: number;
  type: "gain" | "loss" | "rent" | "card" | "move" | "shield";
  text: string;
  amount?: number;
}

export interface GameState {
  version: 2;
  phase: "playing" | "finished";
  players: Player[];
  currentPlayerIndex: number;
  dice: [number, number] | null;
  hasRolled: boolean;
  awaitingAction: AwaitingAction;
  lastCard: GameCard | null;
  pendingCard: GameCard | null;
  lastEffect: GameEffect | null;
  message: string;
  log: string[];
  winnerId: string | null;
  turn: number;
}

export interface PlayerSetup {
  name: string;
  token: Token;
}

export type MobileTab = "board" | "players" | "cards" | "properties";

export type NetworkRole = "local" | "host" | "guest";
export type ConnectionStatus = "offline" | "connecting" | "connected" | "disconnected";

export interface OnlineParticipant extends PlayerSetup {
  clientId: string;
}

export type GameCommand =
  | { type: "roll" }
  | { type: "buy" }
  | { type: "decline" }
  | { type: "draw"; deck: "boten" | "reality" }
  | { type: "buy-level"; fieldId: string }
  | { type: "end-turn" }
  | { type: "blocked"; pay: boolean }
  | { type: "mission" }
  | { type: "card-defense"; defend: boolean }
  | { type: "close-card" }
  | { type: "silence-break" }
  | { type: "finish-score" };

export type PeerMessage =
  | { type: "profile"; profile: OnlineParticipant }
  | { type: "lobby"; players: OnlineParticipant[] }
  | { type: "start"; game: GameState; playerId: string }
  | { type: "state"; game: GameState }
  | { type: "command"; command: GameCommand; playerId: string }
  | { type: "error"; message: string };
