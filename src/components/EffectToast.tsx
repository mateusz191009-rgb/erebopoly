import type { GameEffect } from "../types";

interface EffectToastProps {
  effect: GameEffect | null;
}

export function EffectToast({ effect }: EffectToastProps) {
  if (!effect) return null;
  return (
    <div key={effect.id} className={`effect-toast effect-${effect.type}`} role="status">
      <strong>{effect.text}</strong>
    </div>
  );
}
