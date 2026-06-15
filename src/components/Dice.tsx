interface DiceProps {
  value: number;
}

const pips: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function Dice({ value }: DiceProps) {
  return (
    <div className="die" aria-label={`Würfel zeigt ${value}`}>
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className={pips[value]?.includes(index) ? "pip visible" : "pip"} />
      ))}
    </div>
  );
}
