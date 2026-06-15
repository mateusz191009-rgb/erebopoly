import type { GameCard } from "../types";
import { Modal } from "./Modal";

interface CardModalProps {
  card: GameCard;
  canDefend: boolean;
  onDefend: () => void;
  onAccept: () => void;
  onClose: () => void;
}

export function CardModal({
  card,
  canDefend,
  onDefend,
  onAccept,
  onClose,
}: CardModalProps) {
  return (
    <Modal title={card.title} variant={card.deck} onClose={canDefend ? () => undefined : onClose}>
      <div className="card-symbol">{card.deck === "boten" ? "V" : "◈"}</div>
      <p className="modal-card-text">{card.text}</p>
      {canDefend ? (
        <div className="modal-actions">
          <button type="button" className="shield-button" onClick={onDefend}>
            Für 100 ◆ abwehren
          </button>
          <button type="button" className="ghost-button" onClick={onAccept}>
            Effekt annehmen
          </button>
        </div>
      ) : (
        <button type="button" className="primary-button wide" onClick={onClose}>
          Karte schließen
        </button>
      )}
    </Modal>
  );
}
