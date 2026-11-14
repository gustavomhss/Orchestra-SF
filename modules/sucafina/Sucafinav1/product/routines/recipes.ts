import { Effect } from "effect"
import { AuthoringGraph } from "@orchestra/relay/authoring/graph"
import { AuthoringStore } from "@orchestra/relay/authoring/store"
import type { ProjectID } from "@orchestra/schema/project-id"
import type { RelaySprint } from "@orchestra/schema/relay-sprint"
import { digestSfValue } from "../contracts/canonical.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

export type RoutineRecipeId = "prepare-review" | "prepare-forecast" | "prepare-dossier" | "consolidate-followups" | "analyze-decision"
export type RoutineRecipe = {
  id: RoutineRecipeId
  version: string
  task: string
  title: string
  implementationRefs: readonly string[]
  outputContract: string
  sprint: RelaySprint.Sprint
}

const product = "modules/sucafina/Sucafinav1/product/"
const scope = "Revalidar o principal empresarial da solicitação, projeto, caso/versão, fontes e receita pinada no C07. A admissão existente do Maestro é obrigatória; não criar aprovação, credencial de serviço ou acesso por nome de perfil. Entrada indisponível encerra com pendências e sem conteúdo restrito."
const factual = "Produzir fatos, referências e pendências com os produtores determinísticos indicados. Preservar ausência, unidade, moeda, competência e idade da origem. Síntese de modelo é outra ação posterior; sua indisponibilidade não impede esta preparação."
const deliver = "Validar a saída no contrato indicado e conferir referências/totais/contagens pelo domínio. Persistir o resultado imutável autorizado, ligando runRef, resultRef, receita/versão, inputDigest, principal, caso/versão e correlação; revalidar acesso antes do retorno ao produto. Não aplicar alterações nem aprovar negócio."

function step(id: string, title: string, instructions: string, assertion: string): RelaySprint.WorkPackage {
  return { id, title, kind: "execute", instructions, tools: { mcp: [], bash: [] }, self_check: [assertion], checklist: [] }
}

function recipe(id: RoutineRecipeId, task: string, title: string, implementationRefs: readonly string[], outputContract: string, work: readonly RelaySprint.WorkPackage[]): RoutineRecipe {
  return { id, version: "1.0.0", task, title, implementationRefs, outputContract, sprint: {
    brief: `${title}. ${factual} ${deliver}`,
    gen: 0,
    retry_budget: 0,
    macros: [],
    work_packages: [
      step(`${id}-scope`, "Conferir escopo e admissão", scope, "A admissão vigente corresponde ao principal, projeto, receita pinada e fontes autorizadas; nenhum acesso administrativo é herdado."),
      ...work,
      { ...step(`${id}-result`, "Entregar resultado revisável", `${deliver} Contrato: ${outputContract}.`, "O resultado autenticado aponta a entrada e o run efetivos; conteúdo e links revogados não são liberados."), checklist: [
        { id: `${id}-result-verification`, host_check: "package-verification", assert: "Conferir schema, referências, valores e vínculo do resultado persistido ao run admitido.", blocking: true },
        { id: `${id}-result-review`, host_check: "cold-review", assert: "Conferir fontes atuais, pendências e ausência de aprovação ou mutação de negócio.", blocking: true },
      ] },
    ],
  } }
}

const recipes: readonly RoutineRecipe[] = [
  recipe("prepare-review", "WP09.T02", "Preparar revisão", [`${product}routines/review.ts#prepareFactualReview`, `${product}routines/review-confirmation.ts`, `${product}reports/`], "C05 ReviewDraft / C07 factual review", [
    step("review-facts", "Reunir fontes e cobertura", "Usar prepareFactualReview com período, tópicos e revisão anterior explicitamente selecionados. Reunir projeções autorizadas e conservar fonte indisponível separada da falta de confirmação. " + factual, "Cada seção declara contagem, período, fontes, idade e faltantes; uma revisão inicial é explícita."),
    step("review-deltas", "Conferir mudanças e revisão humana", "Comparar projeções objetivamente e consumir ConfirmationValidityProjection C06. Somente stale material reabre pendência canônica; fevereiro independente não recobra janeiro e unavailable não vira cobrança automática. Preparar pauta preservável por WP07.", "Deltas e totais reconciliam com os produtores e a pauta C05 mantém o histórico escolhido."),
  ]),
  recipe("prepare-forecast", "WP09.T03", "Preparar revisão de forecast", [`${product}routines/forecast.ts#prepareForecastReview`, `${product}routines/confirmation.ts`], "C02/C06 ForecastReview", [
    step("forecast-compare", "Reconciliar versões e diferenças", "Usar prepareForecastReview e compareForecast do Planner com versão, base, moeda e recorte autorizados. Não recomputar fórmulas em texto. Organizar deltas por responsável e causas registradas. " + factual, "Diferença contra base não é confundida com margem contra budget; cada delta possui referência canônica."),
    step("forecast-gaps", "Apontar faltantes e confirmações", "Expor actual ausente, FX/rate faltante, budget herdado e justificativa não registrada. Reutilizar confirmação material C06 e manter a idade da origem. A ação Explicar diferenças abre os mesmos deltas registrados.", "Ausência não vira zero e alteração fora do escopo não cria nova confirmação ou pendência duplicada."),
  ]),
  recipe("prepare-dossier", "WP09.T04", "Preparar dossiê de sourcing", [`${product}routines/dossier.ts#prepareSourcingDossier`, `${product}documents/`], "C02/C14 SourcingDossier", [
    step("dossier-compare", "Reunir pedido e comparação", "Ler pedido na versão/etapa vigente e chamar prepareSourcingDossier usando o ranking, a moeda, notas, pesos e justificativas do WP04. Não selecionar fornecedor nem submeter o pedido. " + factual, "Elegibilidade, maior nota, preço convertido e escolha fora do topo correspondem ao snapshot canônico."),
    step("dossier-documents", "Conferir evidência documental", "Consumir exclusivamente DocumentEvidence C14 do WP06. extracted é candidato; confirmed atual pode alimentar premissa; rejected, stale, sem texto e inacessível permanecem restrição ou pendência. Reutilizar evidenceRef/versão/trecho sem recópia e sem parser paralelo.", "A mesma evidência confirmada alimenta o dossiê; atualização ou revogação impede reutilização silenciosa."),
  ]),
  recipe("consolidate-followups", "WP09.T05", "Consolidar encaminhamentos", [`${product}routines/actions.ts#prepareFollowups`, `${product}routines/handoff.ts`], "C06 FollowupProposal", [
    step("followups-notes", "Selecionar notas e campos explícitos", "Usar prepareFollowups somente sobre notas selecionadas da revisão ou conteúdo explicitamente fornecido. Vincular origem e sugerir responsável/prazo apenas quando registrados; manter campos indefinidos. Não alterar notas da revisão congelada.", "Texto ambíguo não inventa pessoa nem data; cada proposta possui fonte autorizada."),
    step("followups-compare", "Comparar criação e atualização", "Preparar a comparação C06 para criação/atualização no Hot Topics do WP02 e deduplicar pela origem/ação canônica. Encerrar em proposta. Confirmação humana posterior usa a porta existente, revalida versão e mantém recibo; a rotina não aplica a ação.", "Retentativa conserva uma única proposta/ação e a diferença exata fica visível antes da confirmação."),
  ]),
  recipe("analyze-decision", "WP09.T07", "Analisar e reavaliar decisão", [`${product}routines/decision.ts`, `${product}decisions/`], "C09/C11 DecisionBrief", [
    step("decision-context", "Reunir contexto do caso", "Ler o caso C09 e sua versão/encarnação, evidências e pergunta. Ausência vira condição/pergunta explícita no output; não aguardar resposta humana dentro do Relay. Somente fatos autorizados entram na análise.", "Fontes, escolhas preservadas e lacunas pertencem ao caso/versão admitidos."),
    step("decision-alternatives", "Estruturar alternativas", "Solicitar alternativas pelos produtores C09/C11 e perfis/skills realmente ligados pelo host. Não inventar fonte, inferir concessão por nome ou mudar escolha oficial. Conservar perguntas quando faltar informação.", "Cada alternativa distingue premissa confirmada de hipótese e possui origem/condições verificáveis."),
    step("decision-calculation", "Calcular pelo domínio", "Chamar os motores canônicos do Planner/Procurement pertinentes e vincular resultados versionados. Gates de cálculo, schema, FX, cobertura e acesso são determinísticos, jamais delegados ao judge.", "Os números e unidades coincidem com os recibos do motor e dados ausentes não viram zero."),
    step("decision-critique", "Conferir crítica e limitações", "Executar crítica em sessão/run próprios quando judge real estiver qualificado; registrar provider/model/recibo reais. Sem judge, conservar sua indisponibilidade explícita e não registrar stub como avaliação. Perguntas humanas iniciam depois nova versão e nova admissão.", "Crítica possui alvo/digest atual e autoria independente; nenhuma saída antiga altera o caso atual."),
  ]),
]

export function listRoutineRecipes(): readonly RoutineRecipe[] {
  return structuredClone(recipes)
}

export type RoutineRecipePublisher = {
  projectID: ProjectID
  use: <A, E>(work: (store: Pick<AuthoringStore.Interface, "seed" | "get" | "publish">) => Effect.Effect<A, E>) => Effect.Effect<A, E | AuthoringGraph.Refusal>
  /** Explicit publication permission from the authenticated host; not permission to admit or execute. */
  authorize: (context: TrustedDomainContext, recipeId: RoutineRecipeId) => Promise<boolean>
}

/** Explicit UI installation only. Catalog/prepare/run never invoke this publisher implicitly. */
export async function publishRoutineRecipe(input: { recipeId: RoutineRecipeId; context: TrustedDomainContext; host: RoutineRecipePublisher }): Promise<PortResult<{ documentId: string; publishedVersion: string; recipeId: RoutineRecipeId; recipeVersion: string; recipeDigest: string }>> {
  if (input.context.kind !== "ui" || input.host.projectID !== input.context.binding.projectId || !await input.host.authorize(input.context, input.recipeId)) return { status: "denied", reason: "recipe-publication-denied" }
  const selected = recipes.find((entry) => entry.id === input.recipeId)
  if (!selected) return { status: "needs-input", reason: "recipe-unavailable" }
  const result = await Effect.runPromise(Effect.result(input.host.use((store) => Effect.gen(function* () {
    const body = yield* AuthoringGraph.project(selected.title, selected.sprint)
    const expected = yield* AuthoringGraph.compile(body)
    const id = `sf-routine-${selected.id}-${selected.version.replaceAll(".", "-")}`
    if (!(yield* Effect.promise(() => input.host.authorize(input.context, input.recipeId)))) return { status: "denied", reason: "recipe-publication-denied" } as const
    yield* store.seed(id, body)
    const current = yield* store.get(id)
    const compiled = yield* AuthoringGraph.compile(current)
    if (digestSfValue(compiled.sprint) !== digestSfValue(expected.sprint)) return { status: "conflict", reason: "recipe-version-content-conflict" } as const
    if (!(yield* Effect.promise(() => input.host.authorize(input.context, input.recipeId)))) return { status: "denied", reason: "recipe-publication-denied" } as const
    const published = current.active && current.activeVersionId === current.versionId ? current : yield* store.publish(id, current.versionId, AuthoringStore.checksum(current), input.context.binding.principalRef)
    if (!published.activeVersionId || published.activeVersionId !== current.versionId) return { status: "stale", reason: "recipe-publication-changed" } as const
    return { status: "ok", value: { documentId: id, publishedVersion: published.activeVersionId, recipeId: selected.id, recipeVersion: selected.version, recipeDigest: digestSfValue(expected.sprint) } } as const
  }))))
  if (result._tag === "Failure") return { status: "unavailable", reason: "recipe-publication-unavailable" }
  if (!await input.host.authorize(input.context, input.recipeId)) return { status: "denied", reason: "recipe-publication-denied" }
  return result.success
}
