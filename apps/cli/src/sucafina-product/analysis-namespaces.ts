import type { SfStateNamespace } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"

type SourceNamespace = Exclude<SfStateNamespace, "cases" | "contributions">

/** CAS covers C08 inputs too: the raw surface fence deliberately excludes product state. */
export function sfAnalysisSourceNamespaces(skillId: string): readonly SourceNamespace[] {
  const common: SourceNamespace[] = ["preferences"]
  const selected: Readonly<Record<string, readonly SourceNamespace[]>> = {
    "sf-enquadrar-decisao": ["documents"],
    "sf-explicar-forecast": ["documents"],
    "sf-coordenar-perguntas": ["relations", "threads", "confirmations"],
    "sf-revisar-dependencias": ["relations", "threads", "confirmations"],
    "sf-reavaliar-compromissos": ["relations", "threads", "confirmations"],
    "sf-revisar-condicoes-contratuais": ["documents"],
    "sf-extrair-evidencias": ["documents"],
    "sf-revisar-evidencias": ["documents"],
    "sf-preparar-compra": ["documents", "receipts"],
    "sf-preparar-revisao-executiva": ["reviews", "receipts", "confirmations", "threads", "relations", "bi-artifacts"],
    "sf-produzir-material-reuniao": ["reviews", "receipts", "confirmations", "threads", "relations", "bi-artifacts"],
    "sf-produzir-bi-contextual": ["bi-artifacts"],
    "sf-consultar-memoria-decisoria": ["atlas"],
  }
  return [...common, ...(selected[skillId] ?? [])]
}
