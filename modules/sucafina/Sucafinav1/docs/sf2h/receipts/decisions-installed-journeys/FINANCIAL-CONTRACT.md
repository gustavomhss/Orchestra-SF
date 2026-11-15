# Missão52 — handoff financeiro: dois bloqueios distintos

**AUDITORIA ESTÁTICA. A execução financeira e seu bloqueio anterior constam de FINANCIAL-PRECONDITION.md e dos recibos nominais.**

- Repositório: `gustavomhss/Orchestra-SF`.
- Composição examinada e baseline nominal imutável C18: `ee1a3ea147ab7d7f4f6b231217e623456e294c84`.
- Fonte Decisions44: `b6d0ef56e69a3837c9df9dd69b61dbb8724e4b49`.
- Terminal Procurement37: `ab2a967125b3c767067797a27b919466020fbd82`.
- Planejamento fixo: `dbf9547211d9b0fade619790de7c19c0869b7c7d`.
- Testes/dispatch/mutações remotas feitos por esta auditoria: nenhum.
- Runtime: `NOT_OBSERVED_BY_THIS_AUDIT`. O resultado real e o primeiro estágio alcançado precisam vir do run nominal da A52; não converter os dois diagnósticos abaixo em duas falhas observadas pelo browser.
- Owners: **S0/WP00** conserva a decisão semântica; **missão53** foi designada para compatibilidade limitada ao ciclo Procurement/C12 existente. **A47** integra apenas a solução explicitamente liberada; A52 conserva a jornada e não altera os contratos protegidos. O pacote53 está `PREPARED_NOT_STARTED`, sem session_id/model_effective; esta leitura não demonstra início, implementação ou release53.

## Reconciliação posterior de autoridade e composição

O controle `dc7851be1714471543466f23bad47584bb97b389` acrescentou `docs/sf2h/control/handoff/astra/rolling-wave/procurement-approval-closure.json` (missão53), blob `9717864fe2afca5cb289a7717c413bf2df420157`, lido integralmente. Ele mantém `astra-wp04`/PR23, expected head `ab2a967125b3c767067797a27b919466020fbd82` e exige reconciliação antes do ACK; a atribuição preparada não é evidência de execução.

**A decisão S0 agora é explícita:** qualquer wiring/adaptador53 usa somente o ciclo canônico editar/submeter/aprovar, com cada efeito real explícito, autorizado e vinculado a valor/holder/CAS atuais. Esse ciclo não prova a substituição distinta exigida depois da aprovação. O predicado original permanece **OPEN** quando depender de nova autoridade para proposta ainda não gravada; eventual alteração contratual é **proposta para revisão, não implementação autorizada**. Um efeito pós-aprovação já existente só pode servir se corresponder exatamente ao critério original e houver prova do produtor.

Os paths próprios53 são os quatro arquivos `product/procurement/{scenario-preparation,decision-preparation,prepared,prepared-review}.ts` e seus testes/recibos novos. Política/runtime, estágios, alçadas, contratos normativos, C12 host/apply/http, registry/CLI/host compartilhado e UI52 são somente leitura para53. Patches completos de compatibilidade com APIs existentes vão a47/proprietário; não há autorização para comando de aprovação, grant ou regra novos. A53 deve classificar ambos os pedidos consumidores e entregar uma matriz de entrada/saída/estado/recibo; a atribuição não resolve por si o bloqueioA nemB.

Também foi observado C19 `5b11f1460fa44426626ea7674ccb8baf0a083e0a`. O compare remoto C18→C19 é um commit descendente e altera somente dois paths produtivos de Memory40 —`product/host-binding/atlas-memory.ts` (blob `a45ab53b1dab706eedb3b0d075bbfe36a00be40d`) e `product/host-binding/business-context.ts` (blob `390bce2594e39a28defce1d47fafa0d7291e940e`)—, mais testes40 e recibos47. Nenhum path financeiro, UI de alternativas ou helper/spec Decisions desta auditoria mudou. Assim, a incompatibilidade financeira estática continua demonstrada pelos mesmos blobs. **C19 é outra composição:** as mudanças de contexto compartilhado impedem inferir equivalência runtime; o run baseline permanece vinculado aC18 e nenhum resultado/PASS é transferido aC19,53 ou entregas futuras.

## Jornada obrigatória preservada

A quinta jornada lógica é o segundo teste do arquivo: `CI-UI-DECISIONS — require a real Procurement proposal and approval before Apply and recover its unique receipt`, em `packages/app-shell/e2e/sucafina/decisions.spec.ts:21`. Budget de **180000 ms**, linha22; retries0 no arquivo. Blob: `2d9c867af87fa0a26b182365b1780232b49bcaf9`.

O fluxo original cria a requisição USD100/version1/draft pela UI, completa as alternativas Planner, anexa a fonte individual Procurement ao mesmo caso, cria propostas tipadas USD120 e USD140, compara, registra regra numérica e escolha, prepara a operação escolhida, exige aprovação formal do valor exato antes de Apply e recupera o recibo único após perda da resposta. Nenhum seed ou POST direto substitui essas ações.

As assertions relevantes de `decisions-support/procurement-closure.ts` são:

- Linhas16–17: alternativas120 e140 relacionadas, respectivamente, às versões Planner baseline e candidate.
- Linha29: `comparisonStatus: "conditioned"`, `knownDifference: 1200`, `completeDifference: null`.
- Linhas45–48: operação exata `replace` de140USD sobre a fonte Procurement; resultado com `knownSubtotal: 2400`, `total: null`, condição `external-operation:*` e a fonte Procurement no resultado.
- Linhas57–59: após escolher, a requisição real ainda tem versão1, valor100 e estágio draft.
- Linhas155–156: payload promovido com `baseRef` da fonte **Planner**, operação Procurement tipada e `assumptions: []`.

Em `decisions-support/apply-recovery.ts:27–77`, a preparação e a revisão precedem a aprovação formal e uma segunda revisão deve validar a mesma mudança depois da aprovação. Linhas82–157 exigem um Apply, perda de sua resposta original, edição concorrente do caso, uma recuperação sob nova admissão, mesmo recibo, escolha histórica preservada e um único incremento do domínio.

## Bloqueio A — produtor instalado não implementa o cenário composto original

ID proposto: `M52-FINANCIAL-COMPOSITE-CONTRACT`. Estado: **STATIC_CONTRACT_MISMATCH; RUNTIME_NOT_OBSERVED**.

O helper original exige `Procurement request` e `Proposed estimated amount` dentro de `form[data-decision-alternatives]` (`procurement-closure.ts:123–156`, primeira exigência dos controles nas linhas143–144). Essa é a UI de alternativas Planner: seu formulário não contém esses campos e sua promoção mantém `operations: []` (`product/ui/decision-alternatives.ts:29,331`).

Procurement37 instalou outro formulário, `form[data-procurement-alternatives]`, com `Authorized requisition`, `Operation`, `Proposed amount`, `Cost coverage scope`, `Preview scenario` e `Save alternative` (`product/ui/procurement-alternatives.ts:24,97–100,130`). Ele cria um cenário Procurement independente, não o composto esperado pelo helper.

O adaptador `apps/cli/src/sucafina-product/procurement-scenario-services.ts:90` usa a fonte Procurement como `baseRef` e inclui a hipótese explícita `procurement-cost-inventory=renewal-transition-v1`. O produtor aceita somente esse tipo de fonte e inventário (`product/procurement/scenario-producer.ts:93,99–101`). Seu cálculo canônico retorna o valor da proposta como subtotal conhecido —120 ou140— e declara `procurement-only-no-planner-allocation` (`scenario-producer.ts:128–146`).

Portanto, trocar somente os seletores do helper não reconcilia o fluxo. Também seria necessário trocar `baseRef`, hipóteses, subtotal e diferença esperados. Isso substituiria o cenário original e suas assertions; A52 não está autorizada a fazê-lo. A existência da UI independente não prova o contrato composto.

### Critérios de resolução preservando o contrato

1. O owner reconcilia expressamente a proposta composta Planner+Procurement exigida pela jornada com o produtor independente37, sem trocar silenciosamente o significado da operação ou inventar uma alocação no Planner.
2. Uma implementação do contrato original fornece controles humanos tipados e um produtor autorizado que conserva Planner `baseRef`, fonte Procurement exata, operação120/140, hipóteses originais e divulgação verdadeira do custo externo não resolvido.
3. Preservar as assertions1200/2400, total nulo, condição externa e estado físico USD100/draft até o efeito autorizado. Fontes, caso, encarnação, moeda, período, CAS e autoridade continuam vinculados e revalidados; C08 conserva promoção/replay exatos.
4. Qualificar a mesma identidade nominal e o mesmo budget pelo Actions no candidato integrado. Uma prova adicional do produtor standalone não substitui esse resultado.

**Patch completo para satisfazer este positivo: não especificável nesta autoridade sem reconciliar a semântica do cenário.** Renomear controles não resolve o cenário. A53 recebe o diagnóstico como incompatibilidade do consumidor, mas seus paths próprios não incluem UI52 nem o produtor/adapter compartilhado; eventual patch compatível com APIs existentes deve ir a47/proprietário. Não há patch proposto que fabrique o produtor composto, altere assertions ou modifique a política.

## Bloqueio B — M31-FINANCIAL-APPROVAL continua sem comando canônico compatível

Estado: **STATIC_POLICY_CONTRACT_BLOCK; RUNTIME_NOT_OBSERVED_BY_THIS_AUDIT**. O terminal37 já o registra como não satisfeito; as provas de fonte37 não são transferidas à composição atual.

O efeito preparado é `Requests/save` de `pr.estAmount`. Os conjuntos de estados em que esse efeito pode mudar a PR e em que a aprovação formal já está concluída são disjuntos:

| Comando/estado | Contrato atual e prova de código |
| --- | --- |
| `draft` ou `pr_rejected` | `runtime/procurement.ts:484–507` admite edição de PR somente nesses estágios e só aplica seus campos em save/submit_pr. |
| `submit_pr` | `src/procurement.ts:32–38` aplica os campos submetidos antes da transição. `porta/act.ts:239–244` congela o valor atual em `prApproval.amount` e muda para `pr_pending`. |
| `approve` | `src/procurement.ts:62–67` recebe registro atual, ator, comentário e CAS; não recebe proposta de valor ainda não gravada. |
| Aprovação intermediária/final | `porta/act.ts:248–268` mantém pending enquanto restam steps; a última aprovação de PR muda para `sourcing`. Nenhum desses estágios permite editar a estimativa da PR. |
| Aprovação de valor antigo | Aprovar100 não autoriza substituir por140. Submeter/aprovar140 já grava140 antes da aprovação; não resta a mesma substituição pendente para um novo Apply. |
| Edição posterior/no-op | `prepared.ts:91–97` recusa estágio não editável, valor já igual e comando financeiro incompatível. Um save que ignore a PR não pode produzir recibo de efeito financeiro legítimo. |

Os guards de holder, admin sem override e self-approval permanecem em `porta/act.ts:177–183`; as transições permitidas estão nas linhas515–523. Os três blobs do domínio/state machine abaixo são idênticos aos auditados por37.

A recusa está instalada em três fronteiras:

- `product/procurement/scenario-preparation.ts:35–37,42`: prepara a forma exata de Requests/save e retorna `needs-input / financial-approval-command-unavailable` sem efeito.
- `product/procurement/prepared.ts:91–97`: o caminho inferior recusa `estAmount`, inclusive em comandos retidos.
- `product/procurement/prepared-review.ts:13–15`: a revisão recusa essa alteração financeira antes de emitir ou reabrir fonte.

O próprio helper financeiro exige `Requisition approval` e valor140 antes de clicar Approve (`decisions-support/procurement-source.ts:33–61`, especialmente47–48). Ele não envia a requisição antiga para fabricar uma aprovação. Mesmo que o bloqueioA fosse resolvido, a preparação/revisão atual impediria a continuação financeira positiva.

### Critérios de resolução preservando o contrato

1. Aplicar a decisão S0 registrada em53: compatibilidade de implementação somente para edit/save→submit_pr→approve, com efeitos explícitos e autorizados. Esse trabalho pode corrigir adapters existentes, mas não satisfaz por si aprovação antes desse mesmo save e não concede PASS ao predicado distinto.
2. A53 deve identificar se existe efeito pós-aprovação já suportado que corresponda exatamente ao critério original. Sem correspondência comprovada, conservar o positivo **OPEN** e entregar a menor proposta contratual/implementação revisável aS0/WP00 + Procurement/C12. Emissão de PO não é substituição de PR; aprovação detached de proposta não gravada não pode ser implementada sob esta autoridade. Qualquer composição futura deve conservar intenção, alvo, encarnação, valor, moeda, período, holder/CAS e fences atuais.
3. Manter holder, alçada, self-approval, CAS, no-op, pós-condição física e revogação. Escolha humana, checkbox ou aprovação de outro valor nunca são substitutos.
4. Após composição porA47, a jornada original deve comprovar um único efeito/recibo, perda da resposta real e recuperação autorizada sem reaplicar, mantendo a escolha histórica. Um teste de recusa não concede PASS ao positivo.

**Patch completo para fechar a substituição pós-aprovação original: não especificável como implementação autorizada pelo pacote53.** A decisão S0 permite adapters do ciclo já existente e propostas de alteração separadas, não expansão de política. Remover o gate, liberar save em sourcing ou usar outra mutação mudaria a política/efeito protegido. A53 pode entregar correções concretas do ciclo permitido, mas elas precisam de seus próprios SHAs/provas e não tornam verde o positivo incompatível. Não há patch executável fabricado neste handoff.

## Proveniência por blob — composição examinada

Todos os paths da tabela são relativos a `modules/sucafina/Sucafinav1/`, exceto os explicitamente iniciados por `apps/`, `packages/` ou `modules/sucafina/porta/`.

| Path | Blob |
| --- | --- |
| `product/ui/decision-alternatives.ts` | `a731b36427ffbdbc30d19b3b7785be16e5c9747d` |
| `product/ui/procurement-alternatives.ts` | `6b60d7536aed70f515e9f41311de606ed7915168` |
| `product/procurement/scenario-producer.ts` | `83b9fc13c70f464de17946b442ad59e2d40bb765` |
| `apps/cli/src/sucafina-product/procurement-scenario-services.ts` | `004282527ee2dde0922ce0f08a5408b9d5fc1cf2` |
| `product/procurement/scenario-preparation.ts` | `7fce64e7e213693d505f9bc6e08835468b7ead41` |
| `product/procurement/prepared.ts` | `517f50991fb7f057aff943c9e0b626ef6ddc91d6` |
| `product/procurement/prepared-review.ts` | `b7d25206bb7ba11d20b293495f09e6cb70430a84` |
| `runtime/procurement.ts` | `20a3ec5a30ac0fce6b35f05750d1b3dced11c45b` |
| `src/procurement.ts` | `eb486f52910425e9ca06d1f11ce18c90528ff36c` |
| `modules/sucafina/porta/act.ts` | `fe257cef702f6459d510d823d18377da34888dbf` |
| `packages/app-shell/e2e/sucafina/decisions-support/procurement-closure.ts` | `5784a995ba25d042101fe2eed63ce96957b711b1` |
| `packages/app-shell/e2e/sucafina/decisions-support/procurement-source.ts` | `7a7553b89af8f90592603f7d454ba164cbb81afd` |
| `packages/app-shell/e2e/sucafina/decisions-support/apply-recovery.ts` | `cb70480c28e9382629d289c1c954e88379e173d3` |

Leitura normativa completa: `docs/sf2h-plan/specs/product-acceptance.md` no planejamento fixo, blob `ded082688fce327def0b48968fa3b89a5831029c`. Linhas25–45 preservam inventário de nove categorias, ausência distinta de zero, cobertura pendente e fotografia imutável da escolha; uma escolha condicionada não autoriza Apply. Catálogo, recusa universal e proof de UI não concedem witnesses nativos/AM.

Referências do predecessor37: `docs/sf2h/receipts/procurement-decision-producer/HANDOFF.md`, blob `5228750be479b1084c3ea9522d16d6bbb4260050`; `FINANCIAL-COMPATIBILITY.md`, blob `4d77fd48977058d6033a89592463198b76d87b65`, ambos em `ab2a967125b3c767067797a27b919466020fbd82`.

## Disposição para o terminal52

Preservar os cinco testes. Concluir as quatro jornadas independentes onde a composição permita, corrigindo somente os paths autorizados. Para a jornada financeira, registrar run/job/W/S, resultado, duração, primeiro passo/assertion realmente atingido e pontos posteriores `NOT_REACHED`. Manter estes dois achados estáticos separados desse resultado; nenhum FAIL hipotético substitui o log real. Encaminhar a classificação e os contratos ao owner53 designado, conservando S0 como autoridade semântica e47 como integradora. Não esperar nem presumir início/release53, não trocar o baseline imutável C18 porC19 e não transferir PASS da fonte37 ou de outro candidato. Sem aceite WP11/C12/global.
