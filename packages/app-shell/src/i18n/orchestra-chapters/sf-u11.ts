// U11.title-save only. I00 owns the shared orchestration dictionary imports.
// "Title" / "Save requisition" are preserved literals from the pinned
// Procurement renderer (legacy-source-copy-preserved in pt-BR; no translated
// source label was supplied by that baseline).
export const SF_U11_COPY = {
  "sf.cap25.title": "Requests",
  "sf.cap25.primary": "Continue request",
  "sf.cap25.field.pr.title.label": "Title",
  "sf.cap25.action.save": "Save requisition",
  "sf.u11.title.section": "Request title",
  "sf.u11.title.readonly": "Title changes are unavailable for this request or role.",
  "sf.u11.title.reviewScope": "Request title only",
  "sf.u11.title.reviewSummary": "One title field; no financial approval or submission.",
  "sf.u11.title.missingRead": "The current request could not be read. Refresh the authorized source.",
  "sf.u11.title.readError": "Could not read the current request. Try again.",
  "sf.u11.title.saveError": "The title could not be saved. Review the current source before trying again.",
  "sf.u11.title.saveAcceptedNoProjection": "The producer accepted the save, but the current version could not be verified.",
  "sf.u11.title.unknown": "The save response was lost. The result is unknown; refresh the source before deciding what to do. Do not resubmit automatically.",
  "sf.u11.title.notInstalled": "The request title editor is unavailable until its native dependencies are installed.",
  "sf.u11.title.notReady": "The selected request is unavailable in the current authorized context.",
  "sf.u11.title.invalidResponse": "The request response did not match the authorized contract.",
  "sf.u11.title.refreshSource": "Refresh source",
  "sf.u11.title.reviewAction": "Review title change",
} as const

export const SF_U11_COPY_BR = {
  "sf.cap25.title": "Pedidos",
  "sf.cap25.primary": "Continuar pedido",
  "sf.cap25.field.pr.title.label": "Title",
  "sf.cap25.action.save": "Save requisition",
  "sf.u11.title.section": "Título da solicitação",
  "sf.u11.title.readonly": "A edição do título não está disponível para este pedido ou perfil.",
  "sf.u11.title.reviewScope": "Apenas o título da solicitação",
  "sf.u11.title.reviewSummary": "Um campo de título; sem aprovação financeira ou envio.",
  "sf.u11.title.missingRead": "Não foi possível ler o pedido atual. Atualize a fonte autorizada.",
  "sf.u11.title.readError": "Não foi possível ler o pedido atual. Tente novamente.",
  "sf.u11.title.saveError": "Não foi possível salvar o título. Revise a fonte atual antes de tentar novamente.",
  "sf.u11.title.saveAcceptedNoProjection": "O produtor aceitou o salvamento, mas não foi possível verificar a versão atual.",
  "sf.u11.title.unknown": "A resposta do salvamento foi perdida. O resultado é desconhecido; atualize a fonte antes de decidir. Não reenvie automaticamente.",
  "sf.u11.title.notInstalled": "O editor de título está indisponível até que suas dependências nativas estejam instaladas.",
  "sf.u11.title.notReady": "O pedido selecionado não está disponível no contexto autorizado.",
  "sf.u11.title.invalidResponse": "A resposta do pedido não corresponde ao contrato autorizado.",
  "sf.u11.title.refreshSource": "Atualizar fonte",
  "sf.u11.title.reviewAction": "Revisar alteração do título",
} as const
