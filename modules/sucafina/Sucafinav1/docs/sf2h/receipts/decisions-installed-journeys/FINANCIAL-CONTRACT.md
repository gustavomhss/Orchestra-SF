# M52 — handoff financeiro atualizado após nominal02

## Destino, estado e composição

Entrega da missão52 na mesma PR40, mantendo o handoff solicitado para47 e registrando sua sucessão explícita. Este documento não executa integração nem transfere a52 autoridade de Procurement/C12/stack.

**Jornada financeira obrigatória: FAIL antes da criação da requisição.** No nominal02, o HTTP503 está confirmado pela captura de rede. As incompatibilidades posteriores de cenário composto e aprovação formal permanecem **STATIC / NOT_REACHED**; nenhuma foi demonstrada como o ponto de falha runtime desse teste.

| Referência | SHA e limite |
| --- | --- |
| Baseline anterior | C18 `ee1a3ea147ab7d7f4f6b231217e623456e294c84`; run43654219902; evidência histórica preservada. |
| Base do nominal02 | C20 `7f3f4f0066269f7642c82b5694f21c9c9741e9d5`, incluindo CurrentChoice46. |
| W efetivamente qualificado no nominal02 | `7493ea6500c113ee83f785244ab6a9c2b5bc7f6b`, tree `6d1a2f1b593fcb9ce2d821d34ba2bf07000db3aa`; candidato isolado C20 + cinco helpers próprios + proposta compartilhada de transporte. |
| S do nominal02 | `70dfa38e6ae258e1b9a3001db5f6d24b1a7cdaf5`. |
| Fonte própria P2 publicada depois | `1a475ee1ca6b270d7dad8368560cbd9966d7f8ab`, tree `27be5e258a3369f84191745bf75815155e1ad18f`; seis helpers modificados, sem mudança de Procurement ou política. Não foi o SHA qualificado pelo nominal02. |
| Stack posterior observado | C21 `3f35d8ee987cdeaafd3341c2fde13c4125a1f69e`, tree `644e41cfc5e8b291b4bf61bd16c8dcae41b14d1b`; incremento Agenda39. Não é W do nominal02 nem recebe PASS transferido. |

O compare C20→C21 auditado pela revisão de composição contém três commits/72 paths, sendo 59 documentais e 13 materiais de Agenda39. Não modifica Procurement core/config/policy/Requests, installation/local/runtime ou os paths de Decisions. O adaptador de leitura de Procurement acrescentado para Agenda pertence à rota `sf=review-agenda` GET/HEAD; não é a entrada Requests da jornada financeira.

## Evidência runtime nominal02

- Run: https://github.com/gustavomhss/Orchestra-SF/actions/runs/43656679164 .
- Job de testes: `132636625540`; attempt1.
- Identidade exata, `decisions.spec.ts:21`: **CI-UI-DECISIONS — require a real Procurement proposal and approval before Apply and recover its unique receipt**.
- Resultado: `failed`, duração **14810 ms**, budget **180000 ms**, retry0.
- Após `page.goto(.../sucafina/procurement?page=Requests)`, a captura registra **GET /sucafina/procurement → HTTP503**, `application/json;charset=utf-8`.
- O DOM mostra `{"status":"unavailable","reason":"procurement-queue-unavailable"}`.
- `procurement-source.ts:7` exige um formulário `form[data-command="create"][data-page="Requests"]`; recebeu0 durante o budget de assertion de10000ms.
- `bodyCompleted:false`, `observations:[]`, `requests:[]`. Esse vetor requests filtra operações com `sf`; a captura de rede, agora separada, contém o GET503 acima.
- A execução parou antes do preenchimento e do POST de criação da PR. Não criou requisição, não produziu proposta, não alcançou comparação/cobertura, regra numérica, aprovação, Apply ou recuperação C12.

O sucesso de recuperação da criação de um caso em outro teste do nominal02 é limitado a C09; não é recuperação financeira nem remove esta falha independente. O status503 também não demonstra ausência de identidade de ator: esta análise **não** diagnostica falta de identidade/autenticação e não propõe criar outra identidade. A sessão da instalação permanece a real; a causa estática suficiente identificada abaixo é configuração de Procurement ausente.

### Artefatos e integridade

| Artefato local derivado do run | SHA-256 |
| --- | --- |
| `m52-audit/nominal02-43656679164/observations-line-21.json` — 713 bytes | `f4b0f80f5521c35120a78e28b6b315dba6dacb4d09fd8439d6bc1c6b847d15b8` |
| `.../extracted/test-ci-evidence/request.json` — 322 bytes | `4d48f7301d3d8578ebe5dda081cc01834d506eeb0a33dc3cc3dee5ea23b3a221` |
| `.../extracted/packages/app-shell/e2e/test-results/sucafina-decisions-CI-UI-D-44857--recover-its-unique-receipt-chromium/error-context.md` — 8745 bytes | `b66c78721311dddd1d351ab8c65ece81cae65ba08c890d45ed9618f6a2b2081c` |
| `.../extracted/test-ci-evidence/playwright-runtime.json` — 68809 bytes | `f060b95125107a4fba9538a3079116540e502fc2edb3e23862c163afeafc032e` |

## Três barreiras separadas

| Barreira | Evidência e alcance | Resolução admissível |
| --- | --- | --- |
| Requests indisponível antes da criação | **Runtime confirmado:** GET503/form0. **Diagnóstico estático:** instalação nova sem moeda/configuração; `contextFor` exige moeda e falha antes da seleção. A captura não contém banco SQLite nem trace do motivo interno; não se apresenta a inferência como inspeção do estado runtime. | Owner deve definir uma pré-condição inicial autorizada e alcançável pela UI, preservando o significado da política ausente. M52 não escolhe defaults, alçadas ou holders. |
| Cenário composto original vs produtor Procurement instalado | **STATIC / NOT_REACHED.** O helper original exige Planner como base e uma operação Procurement no formulário de alternativas; o produtor37 instalado é um formulário separado, baseado em Procurement, com cálculo próprio. Trocar apenas o seletor muda a semântica e não preserva os valores originais. | Resolver produtor/composição com os owners, preservando as assertions e o C10 condicionado. Não substituir o cenário por um standalone de120/140, inventar alocação nem remover a jornada. |
| Aprovação formal antes da mesma substituição | **STATIC / NOT_REACHED.** Requests/save aceita a substituição em draft/pr_rejected; submit_pr já grava o valor proposto e congela o snapshot; approve final leva a sourcing, onde essa edição não é permitida. | 53 pode fechar compatibilidade do fluxo canônico editar/submeter/aprovar dentro da política existente. Isso não satisfaz automaticamente o predicado distinto de aprovar uma substituição ainda não gravada e depois aplicá-la. Efeito pós-aprovação diferente precisa corresponder exatamente ao contrato ou exigir decisão formal de S0. |

### 1. Configuração: não há ação pública que grave somente USD

A instalação isolada prepara configuração técnica, identidade e fontes, sem gravar `data.store.settings`. `runtime/procurement.ts:142–149,928–941` lê as configurações literalmente. `business-services.ts:95–108` exige `formSettings.currency`; `sources.ts:182–183` propaga a indisponibilidade; `queue-page.ts:28,49–50` produz o503 genérico. A fila vazia em si é suportada pela enumeração de `procurement-request-selection/all` e por projeções com zero linhas.

Settings já é alcançável em `/sucafina/procurement?page=Settings`. Seu `form[data-page="Settings"][data-command="save"]`, botão **Save settings**, grava a configuração inteira com CAS corrente. Preencher somente Currency=USD não é uma ação neutra persistível:

- a UI inclui modo de aprovação, self approval, matriz, holders e câmbio; o select sem valor escolhe first e o checkbox ausente serializa false;
- o parser remove linhas novas vazias, ficando `levels:[]`;
- `settings()`, linhas705–723, exige ao menos uma linha de matriz com nome/id/threshold válidos e os campos de política;
- a previsão estática é422 `Invalid matrix or currencies`, sem commit; não foi enviado um POST de Settings para provar isso;
- Reset settings instala USD, thresholds0/30000, holdersnull, modo first, self approvalfalse e câmbio. Não é correção permitida52 nem solução neutra de moeda.

O payload integral, explicitamente **NOT_SENT_NOT_RUNTIME**, e toda a cadeia de fontes/linhas estão nos suplementos `m52-procurement-queue-precondition.md` e `m52-currency-only-payload-static.json`. Nenhuma moeda/grant/política deve ser inferida da identidade do operador.

### 2. Composição e assertions financeiras originais

`procurement-closure.ts:143–156` espera os controles **Procurement request** e **Proposed estimated amount** dentro de `form[data-decision-alternatives]`, com `baseRef` Planner e uma operação `replace` dirigida à fonte Procurement. O fluxo original conserva:

- PR inicial USD100, versão1, draft;
- propostas tipadas de120 e140;
- comparação com `knownDifference:1200`, estado condicionado e `completeDifference:null` (linha29);
- escolha com `knownSubtotal:2400`, `total:null`, condicionada (linha46) e condição externa não resolvida;
- a PR física ainda100/versão1/draft após a escolha (linhas57–59);
- aprovação formal exata do valor140, revisão novamente, um Apply e recuperação do mesmo recibo.

O produto37 usa `form[data-procurement-alternatives]`, base Procurement e inventário hipotético explícito `renewal-transition-v1`; `scenario-producer.ts:93,99–101,128–146` só admite a própria fonte, uma operação sobre ela e subtotal Procurement, sem alocação Planner comprovada. Um patch de seletor isolado não preserva esse contrato. M52 não fez essa substituição.

### 3. Contrato de aprovação e escopo53

`runtime/procurement.ts:484–507` permite editar a PR em draft/pr_rejected. `src/procurement.ts:32–38` e `porta/act.ts:239–268` mostram que submit_pr incorpora a proposta antes de congelar/pr_pending, e approve aprova esse snapshot, encerrando em sourcing. Aprovar100 com140 em payload não aprova140; submeter/aprovar140 já alterou a PR antes da aprovação. Repetir o save no estágio posterior não constitui um novo efeito válido.

As recusas publicadas por37 em `scenario-preparation.ts:35–42`, `prepared.ts:91–97` e `prepared-review.ts:13–15` permanecem proteção, sem contar como positivo financeiro. `procurement-source.ts:33–61` conserva a exigência de aprovação exata por comando canônico, com estágio/CAS/histórico.

A missão53, controle `dc7851be1714471543466f23bad47584bb97b389`, blob `9717864fe2afca5cb289a7717c413bf2df420157`, atribui compatibilidade delimitada de adapter para a política existente. S0 limita a resolução a editar/submeter/aprovar canônicos, side effects explícitos, grants e CAS; o efeito distinto pós-aprovação continua OPEN e qualquer novo contrato de aprovação de proposta é somente proposta de amendment. O estado PREPARED_NOT_STARTED pertence ao pacote histórico lido; o controle55 posterior já lista53 como fonte ativa. Não se infere daí liberação53, política aprovada ou conclusão financeira.

## Autoridade posterior reconciliada, sem integração por52

Foram lidos via MCP:

- Terminal47 `12b459f6997298f79e3360c4aaeb8ffc0a106a50`, tree `ccfd6a27e927d27994b35b7de948c58cbe643ff3`; `docs/sf2h/receipts/integration/released-intake-47/AUTHORITY.json`, blob `076d2b0c277c7101b387e3d76ff80d3423d85c8a`, declara **HANDOFF_TERMINAL_LEASE_ENDED**.
- Controle55 `c1df70b2fedd2183d243a523fbfef9c7c6ddff35`; `docs/sf2h/control/handoff/astra/rolling-wave/rolling-final-intake.json`, blob `b97e6d28f9d69da3f2737b31739bb69e2318d356`.
- `docs/sf2h/receipts/integration/final-intake-55/ACK55.json`, lido em C21, blob `a6caa04d8c525339697d3e40f7d61ae5830d6e6d`, declara **ACCEPTED_SUCCESSION_SOLE_STACK_WRITER**, epoch `S0-C-e10-browser55`, com predecessor47 reconciliado.

Preserva-se47 como destinatário solicitado e predecessor do handoff; o intake posterior deve respeitar a sucessão documentada e a necessidade de liberação explícita52/53. Nenhuma escrita de integração foi realizada por esta análise. O controle55 proíbe reclassificar editar/submeter/aprovar como prova do efeito pós-aprovação não suportado e exige conservar CurrentChoice46 e demais incrementos.

## Fontes principais e blobs de análise estática

Paths de produto relativos a `modules/sucafina/Sucafinav1/`, salvo os prefixos explícitos.

| Fonte | Blob auditado |
| --- | --- |
| `runtime/procurement.ts` | `20a3ec5a30ac0fce6b35f05750d1b3dced11c45b` |
| `src/procurement.ts` | `eb486f52910425e9ca06d1f11ce18c90528ff36c` |
| `modules/sucafina/porta/act.ts` | `fe257cef702f6459d510d823d18377da34888dbf` |
| `apps/cli/src/sucafina-product/business-services.ts` | `6bb862ce96d3ca2b6478e5f00c257e0b38c1bfee` |
| `product/procurement/queue-page.ts` | `91784d3ea3358565e19b62922c8867f134af9ac4` |
| `product/procurement/scenario-producer.ts` | `83b9fc13c70f464de17946b442ad59e2d40bb765` |
| `product/procurement/scenario-preparation.ts` | `7fce64e7e213693d505f9bc6e08835468b7ead41` |
| `product/procurement/prepared.ts` | `517f50991fb7f057aff943c9e0b626ef6ddc91d6` |
| `product/procurement/prepared-review.ts` | `b7d25206bb7ba11d20b293495f09e6cb70430a84` |
| `product/ui/procurement-alternatives.ts` | `6b60d7536aed70f515e9f41311de606ed7915168` |
| `packages/app-shell/e2e/sucafina/decisions.spec.ts` | `2d9c867af87fa0a26b182365b1780232b49bcaf9` |
| `packages/app-shell/e2e/sucafina/decisions-support/procurement-closure.ts` | `5784a995ba25d042101fe2eed63ce96957b711b1` |
| `packages/app-shell/e2e/sucafina/decisions-support/procurement-source.ts` | `7a7553b89af8f90592603f7d454ba164cbb81afd` |

## Critérios de encerramento financeiro

Manter o quinto caso original selecionado e obrigatório, sem skip, timeout maior, seed ou mutação direta. O owner precisa resolver a pré-condição de configuração sem inventar política, depois provar pela UI o produtor correspondente às assertions originais. A aprovação formal e a aplicação devem conservar exatamente o efeito, valor, estágio, CAS e recibo exigidos; CurrentChoice humana não é autorização financeira.

Sem essa decisão semântica do owner, não há patch funcional completo que52 possa especificar honestamente para as três barreiras. Os suplementos entregam fontes, estados, payloads e critérios revisáveis; nenhuma recusa universal é contada como PASS. FonteP2, W2 e C21 permanecem referências distintas, com suas próprias qualificações.

A análise financeira foi produzida por leitura das fontes e dos artefatos citados. As execuções de52 estão nos recibos nominais; nenhuma edição de Procurement/C12/política/CurrentChoice46 ou integração foi realizada por52.

