# R3 — IA, Relay e integração — candidato W

**Parecer: `changes-required`.** Há duas correções obrigatórias em composição própria do WP10 e um bloqueio de pré-requisito nativo C07. Este parecer não declara aceite nativo, global, C ou D.

## Independência, lease e identidade

Reviewer: `/root/review_runtime`, R3 independente, sem autoria nem edição de fontes do produto. Root, os três builders e os produtores estrangeiros são autores distintos deste reviewer. O lease de leitura de W foi aceito antes da inspeção, com builders `CLOSED`. As únicas escritas deste reviewer são este relatório e seu par JSON. Não houve escrita remota, execução local de produto, testes, build ou typecheck.

| Campo | Valor |
| --- | --- |
| Produto W | `eee00ac3ef2b68c987970535ba5bba5e4c6ad01b` |
| Tree declarada no freeze | `dcfc04896c3a83e6a69d3ecd1d948ff54231ddf7` |
| Parent/lease | `fdbb184f1df7c58f00ee8555e42bce017fd0e942` |
| Branch / base | `astra-wp10` → `sf2-stack` |
| PR | [Orchestra-SF #29](https://github.com/gustavomhss/Orchestra-SF/pull/29) — aberta, draft, head confirmado por MCP |
| Manifesto | `analysis/publication/frozen-candidate.json`: 175 deltas, 103 pins estrangeiros |
| Verificação local de identidade | 175/175 SHA-256 do manifesto correspondem; `sha256sum --check --quiet`, exit 0 |
| Fonte após retomada de correções por root | `analysis/frozen-W/repo`; alterações posteriores de `repo/` excluídas deste parecer |

Foram lidos `AGENTS.md`, o handoff, o pacote canônico, intake, contratos C07/C15/C16/C17, freeze e os insumos do builder. A extração independente confirma **7 tasks e 171 IDs de critérios únicos**. O rascunho de matriz e o documento C07 do builder são insumos; nenhum foi contado como aceite.

## Achados obrigatórios próprios

### R3-C11-01 — P1 — veto de publicação pode retornar sucesso sem commit

**Owner: WP10, composição de input/publicação nativa. Estado: aberto em W.**

Em `apps/cli/src/sucafina-product/analysis-native-inputs.ts:137–162`, o callback `guarded` executa `work` e valida a adição de provenance. Os vetos em 149 e 153–156 devolvem `{ ...result, commit: false }`. Isso preserva o valor de sucesso que o run store já preparou: `{ status: "ok", value: readyRecord }`.

O caminho seguinte torna o problema observável. `product/host-binding/state-provider.ts:95` transforma `commit:false` em `status:"preview"`, conservando `result.value`. `product/ai/run-store.ts:122` retorna esse valor imediatamente, sem a leitura pós-commit usada no caminho normal. Portanto `publish` pode anunciar `ok`/`ready` sem persistir o run, o output e a provenance.

**Reprodução discriminante por leitura do fluxo:** preparar uma contribuição `AlternativeDraft` válida e manter o principal/request UI autorizados. Depois do callback interno validar e preparar a escrita, revogar o binding nativo ou invalidar sua geração antes de `captureCurrent`. O wrapper veta a escrita, mas preserva o sucesso interno; o storage continua com o run anterior e sem os registros finais. Um abort simples da request possui outra defesa em C08; o caso aqui é invalidação do capture nativo com autorização UI ainda corrente.

**Impacto:** falso sucesso na fronteira atômica C11. Critérios afetados: `WP10.T01.INV.02`, `INV.03`, `CHK.05`, `WP10.T06.CHK.04` e `QLT.60`.

**Correção mínima:** todos os vetos do wrapper devem produzir resultado não bem-sucedido, como denied/stale/unavailable, ou retirar o valor de sucesso para o store responder stale. Preservar staging atômico e o guard final. A correção cabe ao wrapper WP10; não exige alterar o produtor estrangeiro `run-store.ts`.

**Recheck exigido:** CI hospedado com o run store e C08 reais, invalidando binding/geração depois do staging interno; conferir retorno não-ok e nenhuma escrita de run/contribution/provenance. Revisar o novo SHA congelado. O finding foi comunicado imediatamente e aceito pelo controller como obrigatório.

### R3-LIFE-01 — P2 — run preparado que não consegue anexar retém recursos do host

**Owner: WP10, lifecycle de `native-execution.ts`. Estado: aberto em W.**

`native-execution.ts:61–80` pode obter `host.prepare` com sucesso e depois falhar em `attach`. Nesse caso usa somente `host.interrupt`. O registro em `active` acontece mais tarde, em 84–85. O caminho de falha de `onAdmitted` também remove `active` antes da tentativa de interrupção, em 86–92.

O método `native-host.ts:241–249` exige autoridade atual para interromper. Se a request abortar ou a autoridade deixar de ser válida depois de prepare, retorna denied sem `run.release`. `host-context.ts:414–419` recusa o contexto da request abortada; o cleanup externo chama `releaseRun`, mas `native-execution.ts:205–207` retorna imediatamente quando não existe entrada `active`.

**Reprodução discriminante por leitura do fluxo:** concluir prepare, abortar/revogar antes de attach, observar attach negado e interrupt negado. O run não entrou em `active`, logo o finally externo não libera observations/runs/binding/token-ticket. Repetir o cancelamento acumula recursos e objetos Request até o descarte global do host.

**Impacto:** viola cleanup determinístico e retém dados de admissão além do lifecycle. Os gates existentes ainda recusam execução e dados depois do abort; este finding não afirma bypass de autorização. Critérios afetados: `WP10.T06.CHK.04`, `CHK.06`, `QLT.01`, `CMP.01` e `INV.40`.

**Correção mínima:** toda resposta prepare-ok precisa de ownership de cleanup incondicional até que o ticket ativo assuma essa responsabilidade. Usar `host.release` em finalizer/try-finally cobrindo attach negado, exceção e callback de admissão que lança; cleanup não pode depender da autoridade de negócio que acabou de ser revogada.

**Recheck exigido:** CI hospedado com abort/revoke entre prepare e attach, attach que lança e callback que lança; conferir liberação de binding, budget ticket e observation, preservando Sessions alheias e o teste de descarte global. O finding foi comunicado imediatamente e aceito pelo controller como obrigatório.

## Pré-requisito obrigatório externo

### R3-C07 — P1 — publicação Relay real não fornece admissão e execução C07

**Owner: owner nativo Task/Relay e produtor WP09; WP10 consome a porta publicada. Estado: bloqueado em W.**

`host-context.ts:287–290` monta `createSfRoutineServices` com publication, readers e `prepareWatch`, mas sem `native`. `routine-services.ts:69–70`, 141–146 e 180–184 retorna explicitamente unavailable para plano/admissão/start. O mesmo ocorre nos readers de terminal, artefato e índice em 214–236 e 259–264.

A conclusão foi conferida independentemente contra arquivos remotos no próprio W. `packages/core/src/tool/task.ts:425–456`, blob `0e82455ca428e5b498551496bc65bdc0f6551df3`, exige uma mensagem assistant com parte `task`, call ID, agente e input persistidos e exatos. `task-governance.ts`, blob `12173c0769e62212a4a01003a0a253e7d1d1ba38`, define hooks internos que não podem substituir checks de target/model/depth/placement/approval nem publicar eventos de Session. Uma request UI ou chamada `sf_*` não é esse ingresso.

O catálogo já usa `WorkflowRelayV2.publication` e o serviço preserva checks de versão/publicação/input/source, terminal e artefato. Contudo, sem a porta nativa instalada, a jornada não chega a um run admitido real. A fixture de boundary em `routine-services.test.ts` não fecha essa ausência.

**Próxima entrega necessária:** seam do owner nativo que preserve os checks Task e vincule principal/project/case/input/plan/publication atuais, com read/revalidate/index/start, retry atômico e recibos imutáveis de terminal/artifact. WP09/WP10 conecta o output publicado e prova consumo. Não forjar mensagem `task` nem usar `SessionV2.resume` como admissão C07.

Afeta `WP10.T01.CHK.03`, `T01.DOD.01`, `T06.CHK.07`, `CHK.60`, `DOD.60` e `SUC.60`. Permanece obrigatório; não é opcional nem bloqueio de suíte global.

## Cobertura técnica e o que a evidência permite concluir

| Área | Observação de fonte | Estado da revisão |
| --- | --- | --- |
| Instalação/host/placement | Factory confiável injeta o runtime; composição usa Project, SessionStore, LocationServiceMap e Persistence existentes, com escopo de instalação/projeto/localização. | Inspecionado; R3-LIFE-01 aberto. |
| C15 perfis/fontes | Manifesto contém 5 perfis, 18 skills e 8 packs. Registro aguarda config-agent, usa IDs próprios e deny-default. Fonte reservada e loader verificam path físico, digests, mensagem SessionV2.skill e estabilidade após carga. | Inventário e implementação estáticos; não prova carga real das 18 skills. |
| C16 handlers/bridge | 39 operações congeladas. SDK Client/Server/InMemoryTransport privado, conflito de provider antes da conexão, leases por contexto/digest/call/generation/expiry, consumo único e fechamento em finally. Dispatch é compartilhado por UI/native/MCP. | Inspecionado; não equivale à matriz executada de 39 rotas ou duas identidades. |
| Execução nativa/budget | Nova Session, skill antes do prompt, prompt admit-only e resume pelo coordenador existente; verificação de modelo/recibo/output. Gate de tokens falha fechado para transporte/host não suportados. | Sem prova live C15/GNATIVE; R3-LIFE-01 aberto. |
| native_input/C11 | Input vem do mapa privado do host e é comparado ao run/skill/request/caso. Provenance vem de captura da bridge e a escrita final é cercada por checks e source fences. | `changes-required`: R3-C11-01. |
| C07 | Publicação real e checks de versão, inputs, sources, terminal e artefato existem no consumidor; native port não é instalado. | Bloqueio R3-C07; fixture não qualifica execução. |
| C17 provider | BCS, owner derivado, imports reais createMemoryEmit/read, DurableMemory síncrono de snapshot, outbox/envelope/index e source fences na transação protegida; scanner fail-closed. | Leitura de fonte; AM05 live/driver/restart/UI não estabelecido. O finding de cálculo de R2 permanece no parecer próprio de R2. |
| Atlas packaging | Nove paths e quatro gerados lidos remotamente em W; reexports e aresta literal canônica existem. | Presença e estrutura verificadas; geração/AST/guards/typecheck hospedados ainda pendentes de recibo. |

`packages/core/src/session.ts:735–740`, blob `00b276d8f2c9e634ae55a37e800fae388eb595e6`, confirma que `SessionV2.resume` e `interrupt` delegam ao serviço existente de execução. Não foi observada criação de um segundo coordenador pela composição revisada.

O MCP privado usa factories locais e revalida antes e depois de dispatch/egress. O registro valida rota efetiva perfil+skill e `routine-result` nega prepare/run. Essas são propriedades verificadas na fonte; prova live de isolamento, revogação, modelo efetivo, token budget, consumidor e reload ainda é exigida.

### Atlas remoto: presença não depende do checkout parcial

Os seguintes gerados foram lidos por GitHub MCP no SHA W, sem hidratação ou edição local:

| Artefato | Blob |
| --- | --- |
| `business-memory-ports.js` | `cfc144ffec16c1eec41b7350ae8c8d47452088c0` |
| `business-memory-ports.d.ts` | `7331e839a166dd9690610b99ec6b595aec50c6e5` |
| `native-memory.js` | `820a3010be24a817edae7ff26299919d448ad4bf` |
| `native-memory.d.ts` | `bc73667c5513e622ff2b5f4f553605fb3532b395` |

O JS business contém `import{NO_SCANNER_NAME}from"@orchestra/atlas-boundary/native-memory";`. Sua superfície exporta os factories de negócio; a superfície native preserva APIs bound e acrescenta scanners. Não apareceram aliases `@atlas/` não resolvidos no texto dos quatro artefatos. O gerador examinado externaliza a aresta exata `memory-emit.ts → ./scanner.js`, contém admissão AST/spawn e possui contraprovas. Isso **não** afirma que o gerador, AST, check:generated, typecheck ou spawn guard passaram em W: essa conclusão exige o run hospedado.

## CI e limites materiais

O controller informou snapshot unitário `d6dd636ec1ff6c6162eab8bd67f9398f847cc0d5` com 42 arquivos (38 próprios e 4 consumidores) e snapshot de checks `e216f8c3ce944eb81d4869828959ed189068a73d`. No fechamento deste parecer, R3 não recebeu run IDs, jobs, controles, logs ou artefatos finais. **Dispatch é pending, não PASS.**

O recibo precisa ligar produto, snapshot CI, request hash, seleção planejada/observada, run/attempt/job/control/artifact e igualdade dos blobs. Uma correção relevante cria novo candidato e exige a prova afetada desse candidato. Resultados históricos não são atribuídos a W nem a um W2 futuro.

Não houve execução local de produto, build, typecheck, testes ou Session nativa. Houve leitura de fontes e contratos, consultas remotas somente de leitura, hashing de arquivos e contagem de dados JSON. Nenhuma fixture, screenshot, catálogo ou declaração de builder foi promovida a aceite. C00 e contratos canônicos continuam sob WP00/S0; interseções locais `analysisInputs`/`verified-call` não são prova de reconciliação nem motivo para inventar erro de compilação.

Epic, oito seleções finais e AM01–AM06 integrais pertencem ao bundle de S0. Este parecer não os dispara nem reduz seus critérios. Também não aceita os outros 171 critérios, UX, semântica financeira, todos os outputs estrangeiros, nem o envelope C/D.

## Handoff de correção e recheck

Root recebeu os três findings durante a revisão e aceitou R3-C11-01 e R3-LIFE-01 como correções próprias obrigatórias. Root/builders farão os deltas; R3 continua sem autoria. A rechecagem independente deve ocorrer após encerramento dos builders e novo freeze explícito, com SHA, diffs e provas afetadas. **Este documento permanece o parecer de W; nenhuma correção posterior foi revisada nele.**
