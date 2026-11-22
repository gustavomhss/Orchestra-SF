# G08 — preparação da homologação Teams instalada

## Estado, escopo e donos

- Estado desta frente: **EXECUTOR IMPLEMENTADO E TESTADO — HOMOLOGAÇÃO INSTALADA NOT_RUN**.
- Data da leitura: 22/11/2026.
- Dono da preparação: sessão Astra responsável por G05/G06/G07/G08/G10.
- Integração G01–G04 e pool: sessão **Retomar migração para Microsoft Teams**, conforme o handoff.
- Donos nominais da reserva QA, do host, das sessões Entra e dos dados: **NOT_CONFIRMED** nas fontes consultadas.
- SHA de triagem: `79912446753af5bb291fc2581543732eb4c83057`; árvore `5c32cd72537799632e7d2583c1775df1d88b8780`.
- SHA/árvore finais, tar final, execução G08 e aprovação: **NOT_OBSERVED / NOT_RUN / NOT_APPROVED**.

Este documento prepara a homologação no ambiente isolado autorizado. A aprovação de G08 vale somente para o SHA, a árvore e os bytes do tar efetivamente instalados. O pin de triagem não é um candidato final confirmado. A virada de produção depende de aprovação específica da janela e de go/no-go.

Esta subfrente implementou e executou os controles do executor em GitHub Actions, na [PR #644](https://github.com/gustavomhss/Orchestra-SF/pull/644), integrada em `ab54723003859c01251617716272ad7ebd834fb6`. Nenhum host QA, identidade Microsoft, grant ou dado de negócio foi alterado por esta frente. Não houve assinatura de aprovação final.

## Executor atual e seu limite

Fonte `aa928b6ae4a5944e5dad4b5bd206d5c123d2238e`, árvore `36794c205023010cf43dc29d6856340f4ed325ea`. No [run 45003896381](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45003896381), os controles executaram **84 testes Node e 28 Python**, typecheck do pacote, import/list do Playwright e 78 guards sem findings. O job instalado ficou **skipped**.

O artefato [14746898273](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45003896381/artifacts/14746898273), ZIP SHA-256 `17c1d362a945b23c5b10a3c7c13bffd37ef78a61d49d42e7bbae5c09fc4474a8`, foi adquirido e verificado independentemente. O recibo `sf-g08-executor-inventory-v1` informa `EXECUTOR_INVENTORY_VERIFIED`, **9 casos LISTED_NOT_RUN**, `installed:false`, `g08Closed:false`, `productionCutover:false`.

| Caso central implementado | Observação requerida no ambiente real |
| --- | --- |
| same-team-distinct-grants | Dois principais originais, mesmo Team, grants realmente distintos, reload nas duas ordens |
| aba-two-windows | A/B/A, resposta F02 original da própria ação e releitura, janela irmã preservada |
| account-without-team | Conta Microsoft autenticada sem Team recebe negativa de negócio |
| foreign-deep-link-reload | Deep link de outra instalação e reload não herdam autoridade |
| admin-without-team | Administração real permitida; negócio continua negado |
| narrow-keyboard-draft | Navegação estreita por teclado e draft com owner preservado |
| draft-cancel-discard | Cancelar preserva draft/Team; descarte explícito troca sem transportar dados |
| real-revoke-restore | Admin desabilita o Team descartável A pelo CAS real, observa revogação e restaura pela versão corrente |
| logout-original-context | Logout real invalida requester e janela antiga; holder distinto permanece autorizado |

A implementação e o contrato privado estão em [packages/app-shell/e2e/sucafina/g08/README.md](../../../../packages/app-shell/e2e/sucafina/g08/README.md). A workflow `.github/workflows/g08-private-preflight.yml` usa runner dedicado `[self-hosted, Linux, X64, orchestra-sf-g08-qa]` e ambiente `g08-isolated-qa` no modo instalado. Nomear runner/ambiente não cria a reserva nem a autoridade.

O preflight liga G07, tar, manifesto, arquivos/permissões instalados, current/.a7-source, PID/executável/argv/factory, descritor Microsoft, listener, hostId, Azure IMDS e configuração **ativa** de Caddy. As respostas HTTPS devem vir do peer observado do host, com cache/service-worker bypass somente nas páginas próprias. A prova de host é repetida após os casos. O processo não instala, inicia ou reinicia serviço.

O browser se conecta a quatro contextos Microsoft originais distintos por CDP privado. Não importa cookies ou storageState, não cria contextos autenticados e não transforma metadados em autoridade. Revogação e logout exigem autorização da reserva; restauração do Team usa a revisão observada e cleanup obrigatório. Relatório bruto e plano permanecem privados; o recibo público contém apenas a lista permitida de fontes, casos, C/T/tar e hashes.

Mesmo um futuro resultado `CORE_TEAMS_INSTALLED_VERIFIED` mantém `g08Closed:false`. As linhas mais amplas da matriz — ações protegidas concorrentes, efeito/releitura de negócio, U15/U39/U40, F04 e AZ02 — conservam suas próprias seleções, produtores e recibos.

## Evidência disponível e limites de reutilização

| Evidência | Fato observado | Limite de uso |
| --- | --- | --- |
| [Briefing fixado](https://github.com/gustavomhss/Orchestra-SF/blob/c02f329d48d37e2f6296154978cd8a7cf80bcb64/docs/qa/sucafina/astra-go-live-handoff.md) | Atesta que **222 (2) encerrou Compras na instalação QA testada: 4/4, gravação/releitura e revogação do acesso temporário**. | Preservar esse aceite no seu escopo. SHA instalado, tar, slot e backlink do recibo original não foram recuperados nesta leitura. Não reclassificar como falha nem estender ao candidato final. |
| [PR #586](https://github.com/gustavomhss/Orchestra-SF/pull/586) | Merged em `abb7f0d110f8afc69541f5331a396c2e1ddc9f4d`; CI `44947185403`. Montagem Microsoft/Team, negativas cruzadas, rotação e logout. | A descrição identifica Entra e Graph simulados, com handler MCP e SQLite reais. Evidência técnica controlada. |
| [PR #592](https://github.com/gustavomhss/Orchestra-SF/pull/592) | Merged em `6a644b1efeba283b1d5eed57f97df4e29b80bc80`; CI `44957757633`. Snapshot `3ce3bd633df90dc49d5fe9fde3eb8e0789c86365`; head `94fbfdda61530a0780dcac36e12f4212dab8cbcb`. A/B, negativas cruzadas, confirmação e releitura persistida. | Sessões Microsoft sintéticas. Não substitui homologação corporativa no tar final. |
| [PR #604](https://github.com/gustavomhss/Orchestra-SF/pull/604) | Merged em `721c42478a61185a92eade55d8390227904de522`; CI `44967330602`. Snapshot `d3eda8018e092fa62465e23517fa1f6bf7425e28`; head `a6bfcc6405b375f36ddc1c5613f0ccce11c9bca7`. Compatibilidade do mount. | Smoke com fixture loopback. O PR declara que não mudou configuração QA. |
| [Recibo Gateway em dev](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/docs/qa/sucafina/procurement/gateway-tools-invoke.json) | Quatro chamadas A/B; timestamp `2026-11-21T19:54:26.876307+00:00`; hash de plugin `a9e504d600503927ece0ec8b8524afd5d1d35d47a6a6a7d320e834cba5fa181e`. | Não contém SHA/tar instalado, confirmação de compra ou revogação. Não foi identificado como o recibo completo de 222 (2). |
| [Guia dos packs no pin de triagem](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/docs/guides/sf-packs-acceptance.md) | Roteiro de Teams privados, contas separadas, grants, 12 chamadas de três packs e persistência de Compras. | Guia operacional, não recibo de execução. Reaproveitar os contratos de entrada/saída e a separação de sessões. |
| [Agregado G03/G04](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44984930949) | Run `44984930949`, `g03-g04-repair@0eab89232860463ab2aabbee15fc422e43bd6e74`, concluído com `failure`. | A qualificação e a integração desse agregado pertencem à Migração. |

Os metadados e descrições dos PRs históricos foram lidos; aquelas execuções não foram repetidas por esta subfrente. As fontes históricas abaixo são insumos de preparação, sem herança de aprovação.

## Primeiro bloqueio específico: contratos do produto e reserva

O executor central já existe. A linha inspecionada em `babc660b2cda3e20ed6b68ecab86b973110652cb` não apresenta todos os contratos históricos de chat, draft/descarte, picker/admin e `/api/ui/team-profiles` usados pelos casos. A Migração deve reconciliar as rotas e seletores originais no candidato integrado. Uma rota ou seletor ausente é bloqueio visível, sem substituição por produtor sintético ou skip.

Ainda faltam o pin final, o tar G07, a reserva e os atores/grants originais. U15/U39/U40/F04/AZ02 também precisam de reconciliação e execução próprias. As constatações de ausência de arquivos abaixo são do levantamento inicial e não negam a nova rota `g08/`.

### Levantamento histórico

A consulta direta por caminho, tanto em `dev@79912446753af5bb291fc2581543732eb4c83057` quanto no SHA `0eab89232860463ab2aabbee15fc422e43bd6e74` do agregado, retornou 404 para:

- `.github/workflows/teams-profile-linux-qualification.yml`
- `packages/app-shell/e2e/sucafina/native/teams-profile-linux.spec.ts`
- `packages/app-shell/e2e/sucafina/native/teams-profile-recovery-linux.spec.ts`
- `sf/azure/identity/az02-proof.cjs`

Em `dev@7991244…`, também retornaram 404 `packages/app-shell/test-browser/sucafina-native/transport-integration.test.ts` e `script/sf2h/proofs/installed`.

Isso descreve os caminhos e pins consultados; não demonstra que inexista outra rota operacional. A coordenação deve registrar a rota suportada atual ou a reconciliação necessária, sem presumir remoção acidental nem portar em bloco o histórico.

O histórico [teams-qa-candidate@08fa1796973742153b2fa33a0d0d9b20a30e628e](https://github.com/gustavomhss/Orchestra-SF/tree/08fa1796973742153b2fa33a0d0d9b20a30e628e), árvore `2b82af86f6d1c9c545698a6d5c9f2b032b7f6ae5`, contém material aproveitável:

| Caminho histórico | Identidade e observação |
| --- | --- |
| [teams-profile-linux.spec.ts](https://github.com/gustavomhss/Orchestra-SF/blob/08fa1796973742153b2fa33a0d0d9b20a30e628e/packages/app-shell/e2e/sucafina/native/teams-profile-linux.spec.ts) | Blob `01e6cbb43950410c696390669dd3ff5de56e597a`; sete casos. Cobertura parcial da matriz abaixo. |
| [installed-browser.ts](https://github.com/gustavomhss/Orchestra-SF/blob/08fa1796973742153b2fa33a0d0d9b20a30e628e/packages/app-shell/e2e/sucafina/native/fixture/installed-browser.ts) | Blob `16bfb2246f882be1ef7b2b82a22f62cf8c2963eb`; attach a contextos Microsoft originais distintos, via descritor CDP privado. |
| [register.ts](https://github.com/gustavomhss/Orchestra-SF/blob/08fa1796973742153b2fa33a0d0d9b20a30e628e/script/sf2h/proofs/installed/register.ts) | Blob `07d681d85aab1b87fe44a114f5f02d4bdbdea6db`; depende de `ApprovedInstalledHost` real. Seleciona bundles U15/U39/U40; registro não equivale a execução. |
| [native-evidence.mjs](https://github.com/gustavomhss/Orchestra-SF/blob/08fa1796973742153b2fa33a0d0d9b20a30e628e/script/sf-ci/native-evidence.mjs) | Blob `22432b472a589f23566bfc584295b41680adab5c`; coletor histórico a reconciliar. |
| [teams-installed-release.mjs](https://github.com/gustavomhss/Orchestra-SF/blob/08fa1796973742153b2fa33a0d0d9b20a30e628e/script/sf-ci/teams-installed-release.mjs) | Blob `a7e588c78a3d95ae4fd5c57f743d948a7c2f12c4`; suporte histórico a reconciliar. |
| [az02-proof.cjs](https://github.com/gustavomhss/Orchestra-SF/blob/08fa1796973742153b2fa33a0d0d9b20a30e628e/sf/azure/identity/az02-proof.cjs) | Blob `2ffede199faa15afc56dcd0aa36297f335cdc4dc`, igual à fonte legada do plano. O plano exige adaptação dos seletores/recibos Teams. |

Mesmo no histórico `08fa179…`, as consultas diretas ao workflow proposto `teams-profile-linux-qualification.yml` e ao spec `teams-profile-recovery-linux.spec.ts` retornaram 404. Não há comando final executável confirmado por esta leitura.

O [plano fixado](https://github.com/gustavomhss/Orchestra-SF/blob/736a5087c223629be4d73c8a4535d615fcafd96a/docs/architecture/teams-profile-test-plan.json) e o [mapa de aceite](https://github.com/gustavomhss/Orchestra-SF/blob/736a5087c223629be4d73c8a4535d615fcafd96a/docs/architecture/teams-profile-acceptance-map.json) são fontes da reconciliação. A implementação atual e a seleção final devem ser verificadas separadamente.

## Dependências e entrada da reserva QA

O pin final é dependência global: Migração e Release devem confirmar SHA/árvore antes de G07 gerar o tar de produção. Para G08, a reserva deve fornecer os campos abaixo por referências privadas autorizadas, sem credenciais no documento.

| Entrada | Responsável pela confirmação | Estado |
| --- | --- | --- |
| SHA/árvore final e referências das confirmações | Migração + Release | Pendente |
| Tar imutável G07, nome, ID, SHA-256, inventário e componentes | Release/G07 | Pendente |
| Recibo de instalação desses mesmos bytes | Operador do host QA | Pendente |
| Slot exclusivo, janela, responsável, endpoint privado e dados permitidos | Dono QA | Não confirmado |
| Separação QA/G10 de processos, dados, sessões, escritores e callbacks | Donos dos dois ambientes | Não confirmada |
| Tenant e dois Teams de teste por IDs imutáveis | Dono Entra | Não confirmado |
| Sessões originais distintas: requester, holder, denied, admin sem Team | Dono Entra/host | Não confirmadas |
| Grants distintos de requester/holder no mesmo Team | Dono da autorização | Não confirmados |
| Ator autorizado nos dois Teams para A/B/A e duas janelas | Dono da autorização | Não confirmado |
| Atores/ações de revogação, restauração de autorização e limpeza | Dono Entra/QA | Não confirmados |
| Dados sintéticos por caso, escritores e política de limpeza | Dono dos dados QA | Não confirmados |
| Executor, seletores exatos, captura e verificador | Astra + Migração | Executor central integrado; contratos de produto e grupos completos pendentes |

Aliases de ator e variáveis de ambiente não concedem autoridade. O host deve observar a sessão corporativa atual e os grants de cada principal. A prova de 222 (2) não reserva automaticamente o mesmo slot para esta frente.

## Matriz de homologação

Todas as linhas estão **NOT_RUN nesta frente**. São grupos de cenários, não uma contagem de 17 testes implementados ou passes. O inventário executável final precisa reconciliar casos e fontes com o candidato.

| Grupo | Cenário | Resultado observável exigido |
| --- | --- | --- |
| G08-P01 | Instalação limpa | Tar final instalado sem Git/repositório; login real, Team autorizado, capítulo e novo trabalho funcionam. Recibo vincula bytes instalados e produto. |
| G08-P02 | A → B → A | Ator autorizado troca explicitamente e retorna; contexto, seleção e leituras pertencem ao Team correto em cada etapa. |
| G08-P03 | Mesmo Team, grants distintos | Dois principais reais simultâneos conservam seus próprios grants nas duas ordens de abertura e após reload; positivo de um não autoriza o outro. |
| G08-P04 | Duas janelas | Duas páginas reais mantêm contexto/URL independentes; mudar uma para B deixa a outra em A. |
| G08-P05 | Deep link/reload | Link explícito abre/reabre o Team admitido; outra instalação ou owner inválido é recusado sem herdar seleção anterior. |
| G08-P06 | Conta sem Team | Principal autenticado sem acesso recebe negativa de negócio, sem destinos ou chat de Team fabricados. |
| G08-P07 | Admin sem Team | Admin corporativo atualmente verificado alcança configuração/recuperação permitida; continua sem negócio. Retirada do grupo revoga a via administrativa. |
| G08-P08 | Draft e mudança de Team | Cancelar preserva draft e owner; confirmar descarte muda Team sem transportar dados privados. |
| G08-P09 | Revogação concorrente | Revogação autorizada durante modal/background/stream vence confirmação tardia; todas as janelas do auth epoch invalidam; não aparece efeito novo não autorizado. |
| G08-P10 | Logout/troca de principal | Sessão antiga perde acesso em replay/reload; novo principal não herda cookies, drafts ou histórico privado. Nova autenticação não restaura grant revogado. |
| G08-P11 | Jornadas de negócio | Operations, Decisions e Reports funcionam no Team atual com proveniência, CAS, efeitos, leitura e recuperação preservados. Compras relê a confirmação efetivamente persistida. |
| G08-P12 | F04 transporte | Guest e seletor malformado recusados pelo HTTP real; owner inválido recusado nos casos aplicáveis; stale fence barra antes da rede e comprova zero requests. F04 usa Bun/Happy DOM, manifest privado e identidade Actions reais; não consome CDP nem comprova positivo de browser autenticado. Registrar host, candidato e seleção completa. |
| G08-P13 | U15 | Inventário completo da jornada registrada; seleção do host, editor concorrente original no stale, relatórios e recibos por caso. |
| G08-P14 | U39 | Obrigações CAP04, incluindo lost response, revogação e segunda escrita quando exigidas; vínculo exato ator/comando/recibo. |
| G08-P15 | U40 | Obrigações CAP05 com o mesmo rigor e seleção independente. |
| G08-P16 | AZ02 | Seis fases após reconciliação Teams: preflight, actors, producer, after-revoke, logout, after-restart. Recibo por fase, autoridade e testemunho real de restart. |
| G08-P17 | Limpeza | Retirar somente fixtures/dados/acessos temporários desta reserva; preservar recibos. Falha de limpeza permanece explícita. |

O spec histórico `08fa179…` cobre partes de P03/P04/P05/P06/P07/P08 e navegação estreita. Não cobre sozinho toda a matriz. U15=6, U39=22 e U40=22 são registros de origem do plano, não passes atuais. Conciliar a seleção final e suas obrigações; não reduzir silenciosamente casos nem convertê-los em skip.

A rota reconciliada deve executar separadamente os papéis `teams`, `u15`, `u39` e `u40`, cada um com seu manifest/bundle privado admitido, inventário esperado, relatório privado e recibo. Os seletores históricos são `e2e/sucafina/native/teams-profile-linux.spec.ts`, `e2e/sucafina/native/journeys/u15.spec.ts`, `e2e/sucafina/native/journeys/u39.spec.ts` e `e2e/sucafina/native/journeys/u40.spec.ts`. Sua disponibilidade e compatibilidade no candidato atual ainda devem ser reconciliadas. Cada execução usa `--workers=1 --retries=0 --repeat-each=1 --reporter=json`, sem filtro que reduza a seleção obrigatória. Os bindings do plano são U15/CAP14, U39/CAP04/ano 2026 e U40/CAP05/ano 2026. Não reutilizar o bundle de um papel para validar outro. Conferir writer/reader do manifest, registry e callbacks por caso no executor final; os bloqueios históricos não provam o estado desses componentes no candidato atual.

As fases AZ02 devem conservar os controles de origem/CSRF, identidade, negativas, revogação, logout e replay após restart, adaptados ao contexto Teams. Um restart de identidade não satisfaz sozinho o restore/rollback de G10.

Observar as operações Graph contratadas, inclusive POST legítimo de consulta. Mudança de profile não deve produzir mutação Microsoft não autorizada. Resíduos/runtime permanecem com G09; esta frente fornece a observação instalada requerida pelo contrato, sem assumir a classificação de G09.

## Captura e recibo

Um recibo G08 aprovável precisa conter:

- Gate, versão do contrato, responsável, revisor e resultado observado.
- SHA/árvore do produto e SHA do executor quando distinto.
- ID/digest do tar G07 e referência do recibo de instalação.
- Alias não secreto da reserva/slot, referência da autorização e janela.
- Run imutável, tentativa, papel e invocação.
- Inventário esperado e executado por spec/caso, fontes/digests e contagens.
- Resultado e número de tentativas por caso.
- Referências sanitizadas de admissão, grants, revogação, efeitos, readback e limpeza.
- Digest do relatório original privado e digest do recibo sanitizado.
- Bloqueios e casos não executados explícitos.

O verificador deve consumir o resultado real, preservar o exit code e rejeitar seleção vazia/parcial, caso faltante ou extra, skip/interrupção, retry/flaky e divergência de produto/artefato. Argumentos de execução ou registro do host não comprovam que os casos rodaram.

Relatórios brutos e material de autenticação ficam no fluxo privado autorizado: diretórios próprios 0700 e arquivos regulares 0600, sem symlinks conforme o contrato histórico. O recibo público deve usar uma lista explícita de campos permitidos; não copiar cookies, tokens, storageState, endpoint CDP, URLs privadas, payloads de negócio, screenshots, traces ou mensagens brutas que possam expô-los.

O executor central já implementa captura privada e verificação estrita dos nove casos. A captura e seleção dos grupos mais amplos ainda exigem reconciliação e recibos próprios; o verde do job de ferramentas não os cobre.

## Fechamento e sequência

1. Reconciliar os contratos UI/admin e os grupos completos no candidato da Migração; manter o executor central integrado e seu limite de prova.
2. Receber o pin final confirmado por Migração e Release e os gates prévios pertinentes.
3. Confirmar reserva, Entra, atores/grants, dados e callbacks autorizados.
4. Receber G07 verificado e instalar exatamente o tar atestado.
5. Executar a matriz admitida, validar resultados e registrar a limpeza.
6. Vincular o recibo ao G10 do mesmo tar para o fechamento agregado exigido pelo plano.

G08 e G10 podem executar em paralelo após G07, em ambientes isolados autorizados. G08 recebe aprovação somente com homologação comprovada no tar instalado e cobertura reconciliada sem lacunas. A aprovação não libera a virada de produção.

### Checkpoint

| Campo | Registro |
| --- | --- |
| Dono | Astra preparação; dono operacional QA/Entra não confirmado |
| SHA/árvore | Executor `aa928b6ae4a5944e5dad4b5bd206d5c123d2238e` / `36794c205023010cf43dc29d6856340f4ed325ea`; candidato final pendente |
| Artefato G07 | Não recebido |
| Recibo | Inventário do executor verificado; nove casos LISTED_NOT_RUN; homologação instalada NOT_RUN |
| Prova reaproveitada | Compras 222 (2) preservada conforme briefing; provas técnicas #586/#592/#604 mantidas em seus candidatos |
| Primeiro bloqueio específico | Contratos UI/admin e seleções amplas do candidato; reserva e atores ainda não confirmados |
| Dependências seguintes | Pin final, G07, reserva QA, identidades/grants e callbacks reais autorizados |
| Aprovação | Nenhuma emitida |
