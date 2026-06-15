import { Modal } from "./Modal";

interface RulesModalProps {
  onClose: () => void;
}

export function RulesModal({ onClose }: RulesModalProps) {
  return (
    <Modal title="Sonderregeln" onClose={onClose}>
      <div className="rules-list">
        <section>
          <strong>◆ Wunschkristall-Schutz</strong>
          <p>Einmal pro Partie darfst du für 100 Kristalle eine negative Karte abwehren.</p>
        </section>
        <section>
          <strong>V Schweigeregel</strong>
          <p>
            Markiert dich eine Karte, darfst du nichts über Erebos verraten. Die Gruppe kann einen
            Verstoß melden; er kostet 50 Kristalle.
          </p>
        </section>
        <section>
          <strong>▲ Ausschluss</strong>
          <p>Beim Boten zahlst du 100 Kristalle oder setzt deine nächste Runde aus.</p>
        </section>
        <section>
          <strong>◎ Finale Mission</strong>
          <p>
            1–2: 150 Kristalle zahlen. 3–4: knapp entkommen. 5–6: Ortolan retten und 250 Kristalle
            erhalten.
          </p>
        </section>
        <section>
          <strong>✕ Spielende</strong>
          <p>
            Auf „Erebos bricht zusammen“ endet die Partie. Bargeld, Orte und Level-Ups bilden den
            Gesamtwert.
          </p>
        </section>
      </div>
    </Modal>
  );
}
