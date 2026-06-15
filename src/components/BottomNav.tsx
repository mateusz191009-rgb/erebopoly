import type { MobileTab } from "../types";

interface BottomNavProps {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
  onRules: () => void;
}

const tabs: Array<{ id: MobileTab; icon: string; label: string }> = [
  { id: "board", icon: "▦", label: "Brett" },
  { id: "players", icon: "♟", label: "Spieler" },
  { id: "cards", icon: "▱", label: "Karten" },
  { id: "properties", icon: "◆", label: "Besitz" },
];

export function BottomNav({ active, onChange, onRules }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Spielnavigation">
      {tabs.map((tab) => (
        <button
          type="button"
          key={tab.id}
          className={active === tab.id ? "active" : ""}
          onClick={() => onChange(tab.id)}
        >
          <span>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
      <button type="button" onClick={onRules}>
        <span>?</span>
        Regeln
      </button>
    </nav>
  );
}
