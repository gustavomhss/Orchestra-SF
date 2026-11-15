# Missão53 — entrega terminal de Procurement

**Implementação permitida entregue e liberada para intake seletivo na mesma PR23. Lease53 explicitamente encerrada pelo commit que contém este handoff.** O produto W é `179a766bb1e3b6b15523ba6c2be8553207d543fd`, tree `7c93fb5495e89055e4a9f2a0363d9cfc97702cf6`. Os testes de origem passaram; os patches compartilhados são propostas completas e inertes, sem qualificação de instalação. M31 e MI07 continuam abertos nos predicados originais.

O destinatário solicitado é o integrador47. A reconciliação encontrou seu terminal explícito `12b459f6997298f79e3360c4aaeb8ffc0a106a50` e a sucessão55 aceita por ACK `a6caa04d8c525339697d3e40f7d61ae5830d6e6d`, epoch `S0-C-e10-browser55`. **O intake atual pertence a55**, sujeito à reconciliação do HEAD no momento de aplicar. A53 não escreveu em `sf2-stack`, não enviou mensagens externas e não presume um ACK de consumo que não observou.

## Entrega de código e efeito suportado

O novo `createProcurementApprovalLifecycle` mantém `review` e `prepare` sem efeitos. Ele produz somente Commands canônicos para quatro intenções explícitas: salvar a estimativa em draft/rejeitada, submeter o valor persistido, aprovar o snapshot submetido e rejeitá-lo com motivo. Cada plano retém fonte, encarnação, CAS, valor, moeda, holder e digests do registro, ator e política. Não carrega um novo valor dentro de approve.

O bridge `createProcurementScenarioDraftPreparation` extrai a operação exata de uma escolha C08 persistida e autorizada e a traduz em plano de edição. A escolha não concede aprovação. O host continua responsável pela leitura autoritativa da choice. A preparação C12 original permanece intacta e recusa a substituição sem contrato financeiro correspondente.

O caminho positivo comprovado é **editar100→140 explicitamente → submeter140 → o holder aprovar exatamente140**. Na fixture de um holder, a aprovação final leva a sourcing. Uma edição após rejeição preserva `pr_rejected` até nova submissão. Toda ação usa sua própria revisão e versão atual; nenhum CAS é atualizado silenciosamente.

`admission.current` é síncrono, de uso único e recebe o snapshot autenticado da transação de destino. Ele impede a execução se a revisão completa mudou, inclusive quando settings, moeda ou roleMap mudam sem mudar o CAS da PR. O executor canônico permanece o único executor. Repetir o mesmo CAS depois do commit não produz novo efeito, inclusive depois de reabrir SQLite. Isso não é recuperação de recibo C12: uma resposta perdida sem recibo autoritativo continua indeterminada.

O [contrato completo](CONTRACT53.md) descreve os tipos, entradas, saídas, ações, recusas, limites de revogação e idempotência. A [matriz dos efeitos](EFFECTS-MATRIX.md) separa implementação, prova de origem e obrigações ainda abertas; [CRITERIA53.json](CRITERIA53.json) preserva os111 IDs WP04 e seus estados normativos.

## Patches completos para o integrador

| Pacote | Conteúdo | Situação |
| --- | --- | --- |
| [Owned](owned/MANIFEST.json) / [patch](owned/mission53-owned.patch) | Dois módulos Procurement e cinco arquivos de testes/fixture; sete caminhos, pre/post completos | Aplicado em W;20PASS de origem, sem prova do candidato integrado |
| [Admissão](shared/admission/manifest.json) / [patch completo](shared/admission/application-and-helper.patch) | Extensão do Application existente e módulo de composição completo; dois caminhos | PROPOSED / NOT_APPLIED / NOT_RUN |
| [Composição mista](shared/composite/MANIFEST.json) / [patch](shared/composite/shared-composite.patch) | Nove caminhos: Planner + Procurement, controles, guards atuais/históricos e quatro testes complementares | PROPOSED / NOT_APPLIED / NOT_RUN |

Todos os preimages foram confrontados com C21 `3f35d8ee987cdeaafd3341c2fde13c4125a1f69e`; as criações estavam ausentes. Os manifests incluem blobs Git, SHA-256 e cópias integrais. As cópias usam `.ts.txt` para permanecerem inertes sob docs. A [verificação estática](STATIC-PATCH-VERIFICATION.json) materializa cada diff sobre o preimage e exige igualdade byte a byte com o postimage. Isso não executa nem qualifica o produto compartilhado.

Na última leitura antes da publicação, a stack avançou para **C23 `25ed395829f9ec5f06a80c70467c23b25376f853`**, tree `4082dba2644a6adf71de7a1af844dd7d063cbd70`. O compare completo C21→C23 contém Microsoft49/C22 e Portfolio50/C23, sem sobreposição em nenhum caminho dos patches53. As pré-imagens e ausências permanecem válidas. O controle acrescentou somente a missão56 de `runtime/local-store.ts`, que exclui Procurement53. A [reconciliação final](FINAL-RECONCILIATION.json) preserva os detalhes;55 continua a autoridade documental observada.

O patch completo de admissão já inclui o helper. O patch runtime-only é um subconjunto para revisão; **não aplicar ambos**. A montagem exige os callbacks reais `existingUiContextFor` e `requestFor` do host existente. O wrapper recusa binding de outro Request, mesmo com o mesmo principal, e faz cleanup também quando o adapter lança sincronicamente. Não inventa provider, grant, identidade ou aprovação. O contrato lista os testes necessários do hook instalado; os20PASS não os substituem.

A composição mista preserva Planner2400 e diferença1200; não soma PR140 ao subtotal. A operação externa permanece `conditioned`, `total:null`, com condição vinculada ao digest. Preview não publica cálculo, alternativa nem fonte. Só a promoção humana C08 já existente pode persistir a alternativa. Os controles de inspeção resolvem fontes anexadas sem emitir scopes. O patch preserva as alterações C20 de continuidade e deduplicação do Planner.

A revisão histórica remove uma igualdade excessiva entre encarnações de scopes: o C17 real pode reemitir um scope autorizado mantendo a continuidade física. O caminho fresh continua exigindo referência integral idêntica; o histórico conserva resolver C17, diferenças, projeção/versionamento original e duas observações. A prova positiva dessa renovação continua **HOLD / NOT_RUN** porque a fixture real chega ao mesmo gate financeiro antes da captura privada. Não foi criada autorização histórica artificial.

## Resultados reais no GitHub Actions

| Execução | Identidade | Resultado observado |
| --- | --- | --- |
| [Funcional43656852980](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43656852980) | W `179a766b`; S `093524ed255db8aeb66eaca2df41b6246bdef938`; job132637170051 | **20PASS,0FAIL,0SKIP,336expect calls**,6arquivos,1392ms;14casos53 +6regressões37 intactas |
| [Checks43656868087](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43656868087) | W exato; job132637214874 | Geração/check/diff e `bun typecheck` PASS; guards78regras,0gates,0errors,11warnings herdados,0 no delta53 |

O snapshot S só adiciona `.ci-run.json`, blob `252c1983bb2dbf0453a43b85aa383c9c585af5bb`, ao W. Todos os demais entries da raiz são idênticos em path/mode/type/SHA, preservando recursivamente produto/configuração/fixtures. Request SHA-256 `78bb6f4c584bd8b9062048e0bcf89a81e313ea3a82b0e7de6372e5665240080e`.

Houve uma seleção funcional, um job de checks e nenhuma repetição. A deduplicação encontrou zero runs iguais/inflight antes do dispatch. O snapshot foi removido pelo cleanup canônico depois do sucesso. Omni: nonce `5f7cb9139cc8ac0a404ce9fcb2881847`, verdict `not applicable (focused: no declaring test ran)`; não há claim de spawn Omni.

Os11avisos são anteriores à53 e estão fora de seu delta: dependências já presentes em três package.json e o double cast anterior de `analysis-acceptance.ts`. Não houve suppression, waiver, mudança de workflow ou relaxamento. A base real dos guards foi `a1d37698a7bb097c1578f827eba6a19b9917ef07` (`origin/dev`). [Artefato de checks14138716560](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43656868087/artifacts/14138716560), digest `ae3dc8d0c1d79b5222a5093296a091abd267e4e81d9575686604a9ad3e25890f`.

[CI-RESULTS.json](CI-RESULTS.json) contém seleção, casos, W/S, jobs, dedup e limites. Os excertos de logs estão em [funcional](ci/test-output.log) e [checks](ci/checks-output.log). O terminal acrescenta somente recibos; o produto testado continua W. Não houve execução de produto, teste, typecheck ou guard local, nem epic.

## Consumidores preservados e requisito restante

[CONSUMERS.md](CONSUMERS.md) registra a leitura dos consumidores52 e51 sem editar nenhum de seus arquivos.

O nominal52 exige manter PR100 durante a escolha140, preparar, encontrar pending140 sem save/submit humanos intermediários, aprovar e então aplicar outro efeito financeiro com receipt/recovery. O run52 observado `43654219902` falhou antes dessa fronteira: Requests/create não apareceu, com `procurement-queue-unavailable`. A incompatibilidade de ordenação é achado estático do código, não uma causa de runtime inventada para esse run. O run posterior52 ainda estava em progresso no corte da leitura e não é usado como evidência53.

O original51 exige preparar150 com sucesso antes da captura histórica. Seu run `43654082252` falhou em `financial-approval-command-unavailable` antes dessa captura. Não há prova da cauda Memory, do arquivo original ou de suas revogações. O ciclo novo pode editar/submeter/aprovar, mas não transforma esse caminho em sucesso de MI07.

Os saves próprios de sourcing podem continuar autorizados para buyer/admin; eles não aplicam a substituição de `pr.estAmount` exigida. O403 pós-aprovação dos testes53 é o POST do requester. O bloqueio da intenção financeira em lifecycle/C12 permanece explícito.

A [proposta mínima para S0](S0-PROPOSAL.md) define uma proposta durável de substituição futura, snapshot/digest aprovado, vínculo ao holder/política e consumo atômico único com recibo C12. Ela lista os campos, operações candidatas, CAS/idempotência, deltas por owner e discriminadores de aceite. **Não está implementada nem autorizada.** S0 precisa decidir os estágios e a autoridade dessa nova proposta. Não há alteração de alçadas, papéis, política, comandos financeiros ou plano pinado nesta entrega.

## Próximas ações do intake autorizado

1. **55:** reconciliar HEAD e autoridade novamente; conferir cada preimage e ausência de creates; integrar seletivamente o owned e os patches úteis, preservando contribuições concorrentes. Não fazer merge cego da branch53.
2. **55:** montar a admissão com o contexto UI real e preservar qualquer hook existente; recusa de review nunca tenta fallback ordinário. Publicar candidato exato e manifest de composição.
3. **45 e qualificadores autorizados:** executar somente as seleções cirúrgicas necessárias, deduplicadas por candidato/seleção/OS. Testar o hook real e os quatro casos mistos; não transportar os20PASS para outro candidato.
4. **S0/WP00:** decidir o novo contrato mínimo de aprovação da substituição futura. Até lá, M31-FINANCIAL-APPROVAL e MI07 continuam OPEN.
5. **52/51:** manter os positivos originais e só reexecutar quando houver um candidato/produtor compatível que altere a pré-condição observada. Nenhuma assertion deve virar uma recusa esperada para gerar verde.

O [recibo de revisão](REVIEW53.json) registra os achados e correções, sem se apresentar como uma das três FINAL reviews da campanha. A [autoridade terminal](AUTHORITY53-FINAL.json) libera explicitamente este incremento e encerra53. Permanecem os15WPs,74tasks,17contratos,1610critérios, T0 e planning SHA originais. **GLOBAL_RELEASE=false.**
