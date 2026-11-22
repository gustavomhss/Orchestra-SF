import { useLanguage } from "@/context/language"
import type { PreservedValue } from "./model"

const evidenceKey = {
  confirmed: "sf.u32.evidenceConfirmed",
  estimated: "sf.u32.evidenceEstimated",
  hypothetical: "sf.u32.evidenceHypothetical",
  absent: "sf.u32.missing",
} as const

/** A source evidence state is not a workflow status. Keep its exact meaning. */
export function SfPreservedEvidence(props: { value: PreservedValue["evidenceState"] }) {
  const language = useLanguage()
  return <span data-sf-evidence-state={props.value}>{language.t(evidenceKey[props.value])}</span>
}

/** Display source scalars literally. Currency and unit remain separate source metadata. */
export function SfPreservedLiteral(props: { value: PreservedValue["value"] }) {
  const language = useLanguage()
  return <bdi data-sf-preserved-scalar>{props.value === null
    ? language.t("sf.u32.explicitNull") : String(props.value)}</bdi>
}
