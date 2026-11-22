# G08 — preparação da homologação Teams instalada

## Estado, escopo e donos

- Estado desta frente: **SUBCONJUNTO DO EXECUTOR INTEGRADO E CONTROLES VERIFICADOS — HOMOLOGAÇÃO INSTALADA NOT_RUN; G08 ABERTO**.
- Data da atualização: 22/11/2026.
- Dono da preparação: sessão Astra responsável por G05/G06/G07/G08/G10.
- Integração G01–G04 e pool: sessão **Retomar migração para Microsoft Teams**, conforme o handoff.
- Donos nominais da reserva QA, do host, das sessões Entra e dos dados: **NOT_CONFIRMED** nas fontes consultadas.
- Pin de triagem histórica: `79912446753af5bb291fc2581543732eb4c83057`; árvore `5c32cd72537799632e7d2583c1775df1d88b8780`.
- Fonte testada da adaptação atual: `0c40f0c26c4a9a56c3825d9bb4538fffb104ade4`; árvore `449b0d99afaf8d84aa4066fb255a88f040260e49`; integração da [PR #659](https://github.com/gustavomhss/Orchestra-SF/pull/659) em `a71033f21b2c0f7da508c96f302506a9e73fd145`.
- SHA/árvore finais confirmados por Migração e Release, tar final, execução G08 e aprovação: **NOT_OBSERVED / NOT_RUN / NOT_APPROVED**.

Este documento prepara a homologação no ambiente isolado autorizado. A aprovação de G08 vale somente para o SHA, a árvore e os bytes do tar efetivamente instalados. O SHA da ferramenta e o merge da #659 não constituem o candidato final confirmado. A virada de produção depende de aprovação específica da janela e de go/no-go.

A #659 adapta o executor da [PR #644](https://github.com/gustavomhss/Orchestra-SF/pull/644) ao produto e aos contratos de navegação/administração observados, preservando a prova histórica dessa PR. Há **sete controles executáveis**. Das **nove obrigações originais**, cinco têm implementação integral condicionada à integração dos contratos; duas têm implementação parcial; duas não têm implementação. **Todas as nove obrigações e todos os grupos permanecem NOT_RUN no ambiente instalado.** Nenhum host QA, identidade Microsoft, grant ou dado de negócio foi alterado por esta frente. Não houve assinatura de aprovação final.

## Executor atual e prova da #659

A fonte testada é `0c40f0c26c4a9a56c3825d9bb4538fffb104ade4`, árvore `449b0d99afaf8d84aa4066fb255a88f040260e49`. O merge `a71033f21b2c0f7da508c96f302506a9e73fd145` registra sua integração em `dev`; o run abaixo continua vinculado à fonte testada, sem promoção automática de prova para outro SHA.

| Registro | Evidência observada |
| --- | --- |
| PR e merge | [#659](https://github.com/gustavomhss/Orchestra-SF/pull/659), integrada em [a71033f21b2c0f7da508c96f302506a9e73fd145](https://github.com/gustavomhss/Orchestra-SF/commit/a71033f21b2c0f7da508c96f302506a9e73fd145) |
| Run | [45031917038](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45031917038), tentativa 1, `SUCCESS` |
| Job de controles | [137237154678](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45031917038/job/137237154678), `SUCCESS` |
| Job instalado | `137237155856`, `SKIPPED`; não houve despacho instalado |
| Artefato | [14758301449](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45031917038/artifacts/14758301449), `g08-executor-controls-0c40f0c26c4a9a56c3825d9bb4538fffb104ade4-1`, 6.819 bytes, seis arquivos de evidência |
| SHA-256 do ZIP | `bbe77eaa6dabaab5df3460815116d8a6e577298543764794f1a38793bd9827da` |
| Recibo de inventário | `inventory.json`, schema `sf-g08-executor-inventory-v2`, status `CURRENT_CONTRACT_INVENTORY_VERIFIED` |
| SHA-256 do inventário | `a6a11a5e79358a283eaae08f0ad1f1cadf7e03f817cadf475d0eb7452db4f657` |
| Recibo DOM de componente | `landing-dom.junit.xml`, SHA-256 `2632dedd46bc5ff296925e684537a806fd281453a29001e3b20ccd43f5e825f8` |

A coordenação adquiriu o ZIP e verificou independentemente digest, tamanho, CRC e C/T do inventário. Os seis arquivos são `contracts.tap`, `host-controls.txt`, `landing-dom.junit.xml`, `landing-dom.log`, `list.json` e `inventory.json`. O inventário registra os hashes de dez fontes. A aquisição confirma os bytes e a identidade desses recibos; o seu escopo continua sendo controles da ferramenta e de componente.

| Controle executado no run | Resultado observado |
| --- | --- |
| Admissão, recusas e evidências Node | 111 PASS |
| Observador de host e arquivos privados Python | 28 PASS |
| Typecheck do pacote isolado | PASS |
| `SfTeamWebApp` e leitor HTTP reais, com transporte controlado no teste de componente | 4 PASS / 127 assertions |
| Importação e inventário Playwright | 7 `LISTED_NOT_RUN` |
| Guards canônicos contra `origin/dev` | 78 regras, exatamente dez caminhos versionados alterados, zero gates, zero errors e três warnings |

Os warnings de remoção de declarações/assertions históricas e uso de `globalThis` foram mantidos e revisados. As obrigações removidas da seleção executável continuam obrigatórias no ledger; o transporte controlado pertence somente ao teste DOM de componente. Não houve waiver de guard, lista de exclusão ou conversão de obrigação pendente em skip aprovado. Omni foi `not applicable`, sem spawn ou delegação; esse run não produz prova Omni.

O recibo atual declara `proofScope:"current-teams-subset"`, **sete casos `LISTED_NOT_RUN`**, todas as nove obrigações e os cinco grupos `NOT_RUN`, `coverage.complete:false`, `installed:false`, `g08Closed:false` e `productionCutover:false`. O resultado não comprova login corporativo, integração Microsoft instalada, grants reais, revogação real ou qualificação do tar.

### Mapa das nove obrigações preservadas

O [ledger de obrigações da #659](https://github.com/gustavomhss/Orchestra-SF/blob/0c40f0c26c4a9a56c3825d9bb4538fffb104ade4/packages/app-shell/e2e/sucafina/g08/obligations.json) conserva os IDs e títulos originais. “Integral” nesta tabela descreve a implementação disponível **depois de integrar os contratos exigidos**. Não significa PASS observado. Os sete IDs de controles aparecem na coluna central; os dois cenários ausentes não foram renomeados para controles da landing.

| Obrigação original | Controle atual e oráculo | Cobertura de implementação / estado instalado |
| --- | --- | --- |
| `same-team-distinct-grants` | `same-team-principal-binding`: dois principais Microsoft originais selecionam o mesmo Team; F02, owner e releitura após reload preservam cada identidade. | **Parcial — NOT_RUN.** Principais distintos não comprovam grants distintos. O produtor inspecionado ainda não publica os destinos de negócio necessários a esse oráculo. |
| `aba-two-windows` | `aba-two-windows`: F02 emitido pela própria UI em A → B → A, URL confirmada e janela irmã preservada em A, inclusive após reload. | **Integral condicionada — NOT_RUN.** Requer o contrato de navegação observado na #654 no C instalado. |
| `account-without-team` | `account-without-team`: F02 identifica o principal autenticado sem Teams; seleção explícita é revoked, sem owner/dados; rota original de negócio retorna 403. | **Integral condicionada — NOT_RUN.** Requer a projeção autenticada no-teams/revoked; 403 isolado não identifica o ator. |
| `foreign-deep-link-reload` | `foreign-deep-link-reload`: link válido e reload; intenção de outra instalação permanece recusada, sem herança de Team nem F02 de Team disparado; repetir após reload. | **Integral condicionada — NOT_RUN.** Requer a navegação e validação de intenção da #654. |
| `admin-without-team` | `admin-api-without-team`: administração available no F02 e catálogo HTTP original acessível ao principal administrativo sem Team; negócio continua 403. | **Parcial — NOT_RUN.** Não cobre a UI original `/orchestra/sf-home/administration` / `data-sf-team-administration=ready`, ainda não composta nas fontes inspecionadas. |
| `narrow-keyboard-draft` | Sem controle executável equivalente. | **Ausente — NOT_RUN / BLOCKED_BY_PRODUCT_TEAM_CHAT_NOT_COMPOSED.** Chat e draft por teclado em Web estreita permanecem obrigatórios; a landing não os substitui. |
| `draft-cancel-discard` | Sem controle executável equivalente. | **Ausente — NOT_RUN / BLOCKED_BY_PRODUCT_DRAFT_DISCARD_NOT_COMPOSED.** Cancelar deve preservar draft/Team; confirmar descarte deve mudar o owner sem transportar ou ressuscitar conteúdo. |
| `real-revoke-restore` | `real-revoke-restore`: admin original executa disable com CAS observado; catálogo e F02 comprovam a revogação de A para ambos os atores, negócio 403 e B intacto; enable, releitura e cleanup restauram a configuração. | **Integral condicionada — NOT_RUN.** Requer política/admin realmente montados e autorização explícita para a mutação temporária. JSON/status manual não substitui revogação observada. |
| `logout-original-context` | `logout-original-context`: POST original 204; contexto original e janela antiga após reload recebem 401; holder distinto permanece admitido. | **Integral no seu escopo — NOT_RUN.** Replay bruto de token, logout global Entra e restart continuam obrigações separadas de AZ02. |

O CAS administrativo usa a revisão exata retornada pelo produtor, inclusive tokens opacos. Após disable, a revisão da resposta deve coincidir com a do catálogo relido e diferir da anterior; restore usa a revisão corrente observada, sem aritmética `+1/+2` ou retry de mutação. Uma leitura original reconcilia resultado incerto somente com estados admitidos; falha de restauração impede o recibo.

### Contrato instalado e limite do subconjunto

A implementação e o contrato privado estão em [packages/app-shell/e2e/sucafina/g08/README.md](../../../../packages/app-shell/e2e/sucafina/g08/README.md). O job manual `installed-teams-current` da [workflow G08](../../../../.github/workflows/g08-private-preflight.yml) usa runner dedicado `[self-hosted, Linux, X64, orchestra-sf-g08-qa]` e ambiente `g08-isolated-qa`. Nomear runner/ambiente não cria a reserva nem a autoridade.

O preflight liga G07, tar, manifesto, arquivos/permissões instalados, current/.a7-source, PID/executável/argv/factory, descritor Microsoft, listener, hostId, Azure IMDS e configuração **ativa** de Caddy. As respostas HTTPS devem vir do peer observado do host, com cache/service-worker bypass somente nas páginas próprias. A prova de host é repetida após os casos. O processo não instala, inicia ou reinicia serviço. Um recibo G07 com `installation:null` não satisfaz a observação instalada.

O browser se conecta a quatro contextos Microsoft originais distintos por CDP privado: requester, holder, denied e dashboardAdmin. Não importa cookies ou storageState, não cria contextos autenticados e não transforma metadados em autoridade. O F02 original identifica o principal de cada contexto; o fetch do browser conserva o cookie jar e usa nonce somente para correlacionar a resposta observada. As ações da UI são esperadas antes do acionamento e observadas separadamente da releitura do executor.

Revogação e logout exigem autorização da reserva; restauração do Team usa a revisão observada e cleanup obrigatório. Relatório bruto e plano permanecem privados; o recibo público contém apenas a lista permitida de fontes, casos, C/T/tar e hashes. O plano continua `sf-g08-private-plan-v1`, com referência da reserva, janela, VM, autorizações de atores e mutação, invocação, C/T, recibo G07, targets A/B/instalação estrangeira e os quatro atores reais.

Somente uma execução instalada integral dos sete controles, com host antes/depois, relatório exato e cleanup, poderá produzir `sf-g08-current-installed-v2 / CURRENT_TEAMS_SUBSET_INSTALLED_VERIFIED`. **Esse recibo ainda não foi produzido.** Mesmo quando produzido, manterá `proofScope:"current-teams-subset"` e `g08Closed:false`: grants distintos, UI administrativa, chat/draft e U15/U39/U40/F04/AZ02 conservam suas obrigações e recibos. O verificador de fechamento recusa o subconjunto; não aceita documento manual de conclusão para substituir provas.

## Prova histórica da #644

A [PR #644](https://github.com/gustavomhss/Orchestra-SF/pull/644), integrada em `ab54723003859c01251617716272ad7ebd834fb6`, permanece vinculada à fonte `aa928b6ae4a5944e5dad4b5bd206d5c123d2238e` e à árvore `36794c205023010cf43dc29d6856340f4ed325ea`. No [run 45003896381](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45003896381), tentativa 1, os controles executaram **84 testes Node e 28 Python**, typecheck do pacote, import/list do Playwright e 78 guards sem findings. O job de controles `137151128459` passou; o job instalado `137151129591` ficou **SKIPPED**.

O artefato [14746898273](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45003896381/artifacts/14746898273), 4.521 bytes, ZIP SHA-256 `17c1d362a945b23c5b10a3c7c13bffd37ef78a61d49d42e7bbae5c09fc4474a8`, foi adquirido e verificado independentemente. O recibo de inventário tem SHA-256 `a07736cc9d3467cbeafe71820e8f5524c0e407f71e332697bdb562874def71e4`; seu schema `sf-g08-executor-inventory-v1` informa `EXECUTOR_INVENTORY_VERIFIED`, **nove casos LISTED_NOT_RUN**, `installed:false`, `g08Closed:false` e `productionCutover:false`.

Essa prova certifica controles e inventário daquela ferramenta. A #659 substitui a seleção executável antiga, que pressupunha chat/draft, UI administrativa e revisão CAS numérica não correspondentes aos contratos inspecionados. Conserva o observador de instalação e os quatro contextos originais, além das nove obrigações em ledger explícito. O inventário de nove casos da #644 não é homologação instalada nem prova de que todos aqueles seletores existiam no produto.

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

## Primeiro bloqueio específico: composição de produto e reserva

A #659 corrige o executor para o seletor nativo e os contratos observados de navegação e administração. Sua base de reconciliação foi `37931c77eb07aecf01610bb0ee7d717276b85539`. As fontes externas lidas foram:

- [Navegação #654 em 174ac4024c745e95d731daa23774c6afa79b21d5](https://github.com/gustavomhss/Orchestra-SF/blob/174ac4024c745e95d731daa23774c6afa79b21d5/packages/app-shell/src/pages/team-profile.tsx): seleção nativa, URL validada, intenção explícita, reload/history e logout.
- [Projeção autenticada em 295eb0f01777657608cdceff2180f5efb7d8646b](https://github.com/gustavomhss/Orchestra-SF/blob/295eb0f01777657608cdceff2180f5efb7d8646b/modules/sucafina/Sucafinav1/runtime/team-profile-access.ts): principal em no-teams/revoked e autoridade administrativa independente da autorização de negócio.
- [HTTP administrativo](https://github.com/gustavomhss/Orchestra-SF/blob/295eb0f01777657608cdceff2180f5efb7d8646b/modules/sucafina/Sucafinav1/runtime/team-profile-http.ts) e [store de política](https://github.com/gustavomhss/Orchestra-SF/blob/295eb0f01777657608cdceff2180f5efb7d8646b/modules/sucafina/Sucafinav1/runtime/team-profile-store.ts), relacionados à #655 e à composição da [#657](https://github.com/gustavomhss/Orchestra-SF/pull/657). A [coordenação com o integrador](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7080225251) preserva a autoria e os caminhos de produto.

Essas fontes são contratos observados, não um ACK do candidato final. Sua composição no C efetivamente instalado deve ser confirmada: presença de arquivo não prova rota montada nem autoridade. O preflight recusa pré-requisitos de fonte ausentes antes de conectar os browsers; F02, catálogo, ações e restauração precisam ser observados durante a execução.

Os primeiros bloqueios específicos que permanecem nas fontes inspecionadas são **grants de negócio distintos observáveis**, **UI administrativa sem Team**, **chat/draft e cancelamento/descarte**, além da composição e seleção completas de **U15/U39/U40/F04/AZ02**. Uma API administrativa positiva não fecha a UI original; dois principais distintos não fecham grants distintos; a landing não fecha chat. As lacunas permanecem como bloqueios do produto, sem produtor sintético ou skip para aparentar conclusão.

Ainda faltam pin final, tar G07, reserva e atores/grants originais. A ausência de reserva operacional é independente dessas lacunas técnicas. O levantamento abaixo descreve consultas históricas de caminhos; não afirma a inexistência de qualquer outra rota e não nega a implementação atual em `g08/`.

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

Mesmo no histórico `08fa179…`, as consultas diretas ao workflow proposto `teams-profile-linux-qualification.yml` e ao spec `teams-profile-recovery-linux.spec.ts` retornaram 404. Essas consultas históricas não confirmaram um comando instalado para aqueles caminhos. A rota atual do subconjunto G08 está documentada acima; os demais papéis ainda precisam de reconciliação.

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
| Executor, seletores exatos, captura e verificador | Astra + Migração | #659 integrada com sete controles; contratos devem compor o C instalado; nove obrigações originais e grupos completos permanecem pendentes |

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

### Seleções obrigatórias além do subconjunto atual

O [inventário preservado](https://github.com/gustavomhss/Orchestra-SF/blob/0c40f0c26c4a9a56c3825d9bb4538fffb104ade4/packages/app-shell/e2e/sucafina/g08/obligations.json) registra os títulos, caminhos e blobs de origem em `687759276c2c9121c2cfd20a5994b277ceb7ee4d`. As contagens abaixo são obrigações preservadas; **nenhuma representa execução instalada nesta frente**.

| Grupo | Inventário preservado | Dependência e evidência necessárias | Estado |
| --- | --- | --- | --- |
| U15 / CAP14 | 6 títulos originais | Capítulo admitido e bundles list/editable/denied/stale/lost; segundo editor Microsoft original na mesma revisão CAS; dados isolados, efeito/releitura e cleanup do produtor. | NOT_RUN |
| U39 / CAP04 / 2026 | 22 títulos originais | Bundles entry/empty/source/readonly/denied/revoked/stale/late; revogador real, segundo escritor e fonte/oráculos por caso. | NOT_RUN |
| U40 / CAP05 / 2026 | 22 títulos originais | Mesmo contrato completo por caso, com capítulo, bundle e invocação próprios. Não reduzir os 22 casos ao entry. | NOT_RUN |
| F04 | 3 controles originais | Guest no ingresso real; seletor moderno malformado recusado; cliente real com geração vencida comprova zero requests. Manifest instalado e invocação Bun/Happy DOM próprios. | NOT_RUN |
| AZ02 | 6 fases, 32 registros de origem: preflight 14, actors 11, producer 2, after-revoke 2, logout 2, after-restart 1 | Adaptação tenant/Team/host/revisões; CAS 409 e validação 422 sem alteração de estado; revogação, cookies/replay e restart real do mesmo C/T/tar. | NOT_RUN |

A rota reconciliada deve executar separadamente os papéis `teams`, `u15`, `u39` e `u40`, cada um com seu manifest/bundle privado admitido, inventário esperado, relatório privado e recibo. Os sete controles em `e2e/sucafina/g08/teams-installed.spec.ts` são o subconjunto atual de Teams e não fecham, sozinhos, o papel completo.

Os seletores históricos são `e2e/sucafina/native/teams-profile-linux.spec.ts`, `e2e/sucafina/native/journeys/u15.spec.ts`, `e2e/sucafina/native/journeys/u39.spec.ts` e `e2e/sucafina/native/journeys/u40.spec.ts`. São referências de reconciliação, não comandos atuais confirmados. Os caminhos de journeys/native manifest não existem na árvore base inspecionada da #659. Disponibilidade, composição e compatibilidade devem ser verificadas no candidato; nenhuma dependência legada foi importada nem console antigo reativado por esta adaptação.

Nas invocações Playwright dos papéis `teams`, `u15`, `u39` e `u40`, a seleção completa exige `--workers=1 --retries=0 --repeat-each=1 --reporter=json`, sem filtro ou shard que reduza os casos obrigatórios. F04 mantém sua invocação Bun/Happy DOM, e AZ02 mantém suas seis fases no executor correspondente. Não reutilizar o bundle de um papel para validar outro. Conferir writer/reader do manifest, registry e callbacks por caso no executor final; os bloqueios históricos não provam o estado desses componentes em outro candidato.

O agregado do plano também exige o quinto papel, `recovery`, além de Teams/U15/U39/U40 e F04/AZ02. Esse papel permanece com a frente responsável por G09; esta subfrente não assume seu dono nem emite seu recibo. G01–G04/pool, #349 e G09/#588 seguem fora desta escrita.

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

O executor atual implementa captura privada e verificação estrita dos **sete controles**, além do ledger das **nove obrigações originais** e dos **cinco grupos**. O relatório instalado deve conter os sete resultados originais, workers 1, retries 0, sem filtro, shard, skip, falha ou resultado ausente, com exit code zero e cleanup completo. O verificador de fechamento exige inventários completos e únicos por ID, contagens exatas e PASS de todas as obrigações; rejeita listas vazias/parciais, duplicatas e IDs desconhecidos. Essa validação de completude não dispensa a proveniência: o CLI não aceita documento manual para promover execução não observada.

A captura e seleção dos grupos mais amplos ainda exigem reconciliação e recibos próprios; o verde do job de ferramentas não os cobre. Os outputs de ferramentas da #659 ficam em RUNNER_TEMP, fora do checkout; os caminhos de evidência instalada continuam privados.

## Fechamento e sequência

1. Confirmar no candidato da Migração os contratos de navegação e administração consumidos pela #659; compor grants distintos, UI administrativa, chat/draft e os grupos completos sem apagar obrigações pendentes.
2. Receber o pin final confirmado por Migração e Release e os gates prévios pertinentes.
3. Confirmar reserva, Entra, atores/grants, dados e callbacks autorizados.
4. Receber G07 verificado e instalar exatamente o tar atestado.
5. Executar a matriz admitida, validar resultados e registrar a limpeza.
6. Vincular o recibo ao G10 do mesmo tar para o fechamento agregado exigido pelo plano.

G08 e G10 podem executar em paralelo após G07, em ambientes isolados autorizados. G08 recebe aprovação somente com as nove obrigações integralmente comprovadas, U15/U39/U40 completos em suas invocações, F04 e todas as fases AZ02, mesmo C/T/tar G07, atores/grants reais e cleanup/restauração observados. Sete controles instalados verdes ainda não satisfariam essa condição. A aprovação não libera a virada de produção.

### Checkpoint

| Campo | Registro |
| --- | --- |
| Dono | Astra preparação; dono operacional QA/Entra não confirmado |
| SHA/árvore testados | `0c40f0c26c4a9a56c3825d9bb4538fffb104ade4` / `449b0d99afaf8d84aa4066fb255a88f040260e49`; candidato final pendente |
| Integração | #659, merge `a71033f21b2c0f7da508c96f302506a9e73fd145`; não constitui ACK final |
| Run/artefato | `45031917038`, tentativa 1, artefato `14758301449`; ZIP e inventário adquiridos e verificados independentemente |
| Artefato G07 / instalação | Tar final não recebido; nenhuma instalação comprovada nesta frente |
| Recibo atual | `CURRENT_CONTRACT_INVENTORY_VERIFIED`; sete controles `LISTED_NOT_RUN`; nove obrigações e cinco grupos `NOT_RUN`; `installed:false`, `g08Closed:false` |
| Cobertura implementada | Cinco obrigações integrais condicionadas, duas parciais, duas ausentes; nenhuma aprovada em ambiente instalado |
| Prova reaproveitada | Compras 222 (2) preservada conforme briefing; #644 histórica e provas técnicas #586/#592/#604 mantidas nos seus SHAs e alcances |
| Primeiro bloqueio específico | Grants distintos, UI administrativa, chat/draft e composição dos grupos completos; contratos do subconjunto ainda devem ser observados no C instalado |
| Dependências operacionais | Pin final Migração + Release, G07, reserva QA, identidades/grants e callbacks/mutações autorizados |
| Aprovação / produção | Nenhuma aprovação G08 emitida; `productionCutover:false`; janela e go/no-go de produção exigem decisão específica |
