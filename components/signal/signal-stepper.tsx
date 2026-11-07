export function SignalStepper({ steps, current }: { steps: readonly string[]; current: number }) {
  return <ol className="signal-stepper" aria-label="Étapes de la séance">{steps.map((step, index) => <li key={`${index}-${step}`} className={index < current ? "is-done" : index === current ? "is-current" : ""} aria-current={index === current ? "step" : undefined}>
    <span className="signal-stepper-number" aria-hidden="true">{index < current ? "✓" : index + 1}</span>
    <span><span className="sr-only">{index < current ? "Terminée : " : index === current ? "En cours : " : "À venir : "}</span>{step}</span>
  </li>)}</ol>;
}
