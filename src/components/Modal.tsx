import type { PropsWithChildren } from "react";

interface ModalProps extends PropsWithChildren {
  title: string;
  onClose: () => void;
  variant?: "boten" | "reality" | "default";
}

export function Modal({ title, onClose, variant = "default", children }: ModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal modal-${variant}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Schließen">
          ×
        </button>
        <p className="eyebrow">
          {variant === "boten" ? "Nachricht des Boten" : variant === "reality" ? "Realität" : "Archiv"}
        </p>
        <h2 id="modal-title">{title}</h2>
        {children}
      </section>
    </div>
  );
}
