# Sessão 3 — Planner, BI e decisões

**Estado: incrementos publicados para integração; aceite integral não concedido.** Os resultados abaixo qualificam somente os SHAs e os consumidores explicitamente observados. C/D, composição instalada, provas nativas e epic do bundle continuam com S0.

PR do grupo: [#35](https://github.com/gustavomhss/Orchestra-SF/pull/35), `astra-finance` contra `sf2-stack`. Pin de produto registrado nesta edição: `6184a0d3c818fd508f05028d34428ef1c95c01a5`; tree `f30c35028acb382d2b38b7be6e105f3a98a0518c`. Uma publicação posterior apenas destes recibos não amplia o escopo dos testes.

## Fontes e recuperação

Plano imutável: `dbf9547211d9b0fade619790de7c19c0869b7c7d`; campaign SHA256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`, conferido. Handoffs completos e CI: `a3d29d011ba3607a57914701300f09117a3e2de9`.

| Fonte recuperada | Head consumido | Commits preservados |
| --- | --- | ---: |
| PR #22 / WP03 | `90c467cea436daa24987ad68a588a7d80f91064e` | 15 |
| PR #24 / WP05 | `0881fee21f07bf8a9a1153d7d55727837cdf497a` | 16 |
| WP11 — head inicial (PR40 localizada no refresh posterior) | `ff99e4b4de56bbf6e7ef36daf5d3eb749779017a` | 1 |
| PR #40 / WP11 — primeira atualização | `be50d42d6a2c030d57d17038dec267ebd33ea78c` | 5 |
| PR #40 / WP11 — segunda atualização | `2bf0197c5d607b43063c36e1c8fef9e769c716ca` | 2 |

A recuperação `04f3ffae53eca454b434bdab9fcb19bf0353ccc1` preserva os três heads como ancestrais e recupera os blobs próprios sobre sf2-stack `6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0`. [intake-pins.json](intake-pins.json) lista os 32 commits individuais e cada blob recuperado. W18 `92f6d97d2df5ebf53cd845f4cfe93355d10b0f6f` adiciona o head PR40 como parent e conserva os cinco commits novos; [intake-reconciliation-pr40.json](intake-reconciliation-pr40.json) decide cada um dos 40 paths, preservando 29 receipts anteriores. W19 `d9b84003ed6cd6dd77b5738dbfcc6b45d57f72c8` consome a segunda atualização em mais um parent: [intake-reconciliation-pr40-latest.json](intake-reconciliation-pr40-latest.json) decide36paths, adota12testes/helpers e preserva17recibos novos/revisados, sem sobrescrever o recibo histórico modificado. São39commits de origem preservados, além dos incrementos próprios. As branches originais e seus recibos históricos não foram sobrescritos.

As dependências compartilhadas foram consumidas por bytes publicados, com recibos próprios: [contract-intake.json](contract-intake.json) e [host-authority-intake.json](host-authority-intake.json). Não há alteração autoral do artifact-store, host, engine, plano aprovado ou política financeira neste grupo.

## Incrementos consumíveis

| Incremento | Commit | Tree | Mudança |
| --- | --- | --- | --- |
| W1 | `8184761b61f78d6aeac73232fdc879e93f85bc5e` | `dca3e3c3aca7dadbd348c71b1c9a3d5934ac4a05` | Solver composto, cobertura, persistência/replay, fences de BI e workflow mínimo. |
| W2 | `981ad44102b2e2e67d31bfc8fb7d97208e390e5b` | `a67576fae5212720d3e695138b0979931d4f7c79` | C17 aninhado, callbacks isolados, prepared apply real e tipagem própria. |
| W3 | `66bbe152c145f04c16223a938589c63cedb3b716` | `f727ae5bfcef26383ff47a2b06bb65b161295dd2` | Observação confirmada de fonte, unidades/intervalo, histórico de escolha e consumidores numéricos. |
| W4 | `ffe77b53f3c074f03fe6dc3ff7caa788778eca99` | `0cecbd7b7b034df4156d248f86be080f32ab764f` | Ancestralidade C17 por cadeia assíncrona; corrige falsos ciclos concorrentes. |
| W5 | `8090bddb8e38faf6209c091b863bff58afe50a9c` | `ac049ff9d8ad8a6e3f9b84e9bd00440e1350480d` | Quatro fixtures corrigidas sem afrouxar assertions; 5 testes passaram em S3. |
| W6 | `df29a62e5ede5b9ff9344b4f5b51eba4102e2093` | `3e0a13a9085ca446aec553052a61041281c2e1d9` | Qualificação pós-comando, fallback IEEE e distinção explícita de orientação da comparação. |
| W7 | `a274302d15990919007dbe958d95653508c730a7` | `df0c8c14ad72fb8447b24d7e4a4ab9c9d871a727` | Disclosures pós-comando e discriminantes de ausência/FX/HR. |
| W8 | `453edcd3c3c2a20413ef0d3f679b0fbc46fca2b5` | `7f9fc2de8d5ee0a560c252413ab76d0e4564bab7` | Escolha explícita de origem A/B nas marcas e tabelas, com referência integral. |
| W9 | `9913b0c622aa09da7914f231bd9f2ff54d872634` | `f43b8e39733c6d93048c4d48001af8d0f398ac5d` | Qualificador compartilhado de actual: ausência e zero no Overview/C02. |
| W10 | `660db9a46e4c1d7ff87c23f6bb37f451cc703ccb` | `bbc79890ba339e0fca0fb34f55bd4d1c69a7953e` | Via histórica C17 vinculada ao ledger e cenário confirmado de implantação 70000. |
| W11 | `88144ff9495c4061fd1661c55e8c6d802bf197a7` | `8a6ffb4527f8a2d4f7dbd522280048a95636ecb3` | Narrowing da fixture A/B; conserva assertions de identidade. |
| W12 | `217c9bcc75d499eff3884fb4afe662d5c0029935` | `eeae1c748b3e1e73be8686c3f1df325e2fac3824` | Retorno de foco após escolha A/B: candidato visível e foco efetivo. |
| W13 | `7a67364aeb5c478be54e533910c4b4c91bbd1ebe` | `fdc061f1ab7bbb0b28f591550af391e500dc7c8b` | Presença de meses não endereçados preservada contra normalização incidental. |
| W14 | `fe13ee693bdcec1830190bcdb5cc7f2794942c1f` | `1ce4e9fcb2e9fb81e12dcfd773aa2daae64be39a` | Vantagem fornecida por comparação inversa canônica persistida; barra/tabela literais. |
| W15 | `61d92392e9bded167eb2794995a623b2719cc4ba` | `ffb3cd9e1ee689732cbae33658506c628539d032` | Batch canônico de cenários irmãos com fases independentes, clones e fontes individuais. |
| W16 | `c80144bfa8e0097c6be189ff6dbdb85f4b37e2e7` | `c009f3dcabf5ebff2c48283fd320be92a2d1f13c` | Admissão UI consumida no fixture e diagnóstico granular de inspeção BI. |
| W17 | `6016a70d7ab0c3d50f1ec2827a534a80e48a5c56` | `f84399d12c35bb8fd66cf4631bae56b02e84123a` | Contadores e inputs transitórios corrigidos; perfil de replay C17 sem mudar suas verificações. |
| W18 | `92f6d97d2df5ebf53cd845f4cfe93355d10b0f6f` | `a843c5d5767c4a055fcacb77668c3798fd8a564c` | PR40 reconciliada: 28 blobs exatos, seis merges, seis preservados; CAS/recibos com fence C08 e unicidade. |
| W19 | `d9b84003ed6cd6dd77b5738dbfcc6b45d57f72c8` | `13710829b3b3c1d373e2aa2729fc642f24bf8871` | Segundo avanço PR40:12 testes/helpers reconciliados,2commits ancestrais e17novas versões de recibos preservadas. |
| W20 | `5e4c2b288665113e58162a616a9965c03e397e19` | `64510c36da425ed2ec0da67836bfcd691fd1f625` | Proof atual para promoção sem operações e snapshot Dashboard no draft Hot Topic; revisão independente exata. |
| W21 | `8d065831356e8a73cfd0e4fbb072c5041b95d05f` | `77bef954682387ac0fdd3c01e7dd51b9201d2aac` | Calendário confirmado da cotação40000, nova admissão após revogação e CAS atual no import; assertions reforçadas. |
| W22 | `cfbf7c824d4351431d35533dbe2572de11084b9d` | `26843c698c3cf7b923d364434fae443a63efafaa` | Diagnóstico de current-choice conserva callbacks/outputs; nenhum comportamento do produto alterado. |
| W23 | `6184a0d3c818fd508f05028d34428ef1c95c01a5` | `f30c35028acb382d2b38b7be6e105f3a98a0518c` | Hit area finita no timeline; origem por mouse/teclado/tabela preservada e assertion de tabela discriminante. |

Cada captura foi publicada via GitHub MCP e confrontada com o compare remoto. Os snapshots S são descendentes do W indicado e diferem exclusivamente em `.ci-run.json`; nenhum arquivo dirty foi incluído incidentalmente. Os manifests de alteração do grupo identificam arquivos, blobs e finalidade para intake delimitado.

## Mapa integral de tarefas e critérios

São **303 IDs e textos literais**: WP03 112, WP05 108 e WP11 83. [task-obligations.json](task-obligations.json) conserva integralmente as 14 tarefas, arrays de trabalho, inputs, outputs, checks, axiomas e contratos dos packs. Nenhum critério recebeu aceite integral nesta sessão. Classificações históricas ficam identificadas como históricas.

| WP | Mapa completo | Critérios |
| --- | --- | ---: |
| WP03 | [criteria.json](../../WP03/finance-20261114/criteria.json) | 112 |
| WP05 | [criteria.json](../../WP05/finance-20261114/criteria.json) | 108 |
| WP11 | [criteria.json](criteria.json) | 83 |

Cada linha liga implementação/consumidor, testes candidatos e observações dos runs aos critérios. Uma observação de arquivo não quita automaticamente todos os ramos do critério; a matriz mantém limites e pendências. [task-delivery-map.md](task-delivery-map.md) e [task-delivery-map.json](task-delivery-map.json) ligam as 14 tarefas aos caminhos e consumidores correntes, incluindo as novas APIs da PR40.

| Tarefa | Contribuição e consumidor localizado | Limite de composição/prova |
| --- | --- | --- |
| WP03.T01 | Portas Planner C02/C03/C04, capacidades C16, simulação pelo domínio; BI e decisões consomem as mesmas projeções. | UI/MCP de harness não demonstra SessionV2/skill/provider residente. |
| WP03.T02 | monthly-host, grade e operações mensais; HTTP e planner-monthly externos já chamam o produtor. | Patch delimitado para before/after, annual/spread/reset e rebase explícito ainda requer owner e teste montado. |
| WP03.T03 | Headcount/HR, premissas e projeção de capacidade; BI04 usa FTE/custo e preserva redação salarial. | Prova positiva numérica e browser têm seleção própria; montagem instalada permanece separada. |
| WP03.T04 | FX, cadastros e versões usam o domínio; ausência de FX permanece indisponibilidade. | Consumo instalado de todos os catálogos e recusas exige composição externa. |
| WP03.T05 | Overview, Versions e comparação A/B; analytics usa contribuições com as duas referências. | Origem granular e retorno no HTTP/C17 instalado dependem do transporte integral da seleção. |
| WP05.T01 | Trajetória/waterfall usam planos e valores dos produtores; C17 recebe seleção verificada. | Rotas estendidas já usam a fábrica; versão/engine/contexto originais e destino montado ainda precisam de prova. |
| WP05.T02 | Contribuições BI03 e painéis alinhados BI04; A/B explícito e actual null/zero. | Navegação instalada e refresh autorizado devem consumir o mesmo mount e seleção. |
| WP05.T03 | Procurement BI05/06 usa porta canônica, incluindo etapa/aging e ausência de idade. | Falhas históricas de fixture/browser têm seleção diagnóstica própria; não são apagadas por outros greens. |
| WP05.T04 | Dashboard BI07/08 e catálogo/export de BI; readBiDestination preserva referência/contexto/C17. | Fonte undated corrigida em outro owner não comprova o bundle atual; transporte instalado permanece pendente. |
| WP05.T05 | C08 scenario/portfolio/sensitivity; vantagem inversa persistida e tabelas/figuras com condição. | Referência opcional precisa entrar na seleção CLI; BI11 e planos BI09/10 dependem dos produtores/composição. |
| WP11.T01 | Caso persistente/versionado, C08, case-port, capacidades e produto composto. | Reinício/reabertura de store não equivale a prova da aplicação residente instalada. |
| WP11.T02 | Alternativas, inventário completo, shared/N/A, resultado/threshold e replay. | Shared/N/A sustentados por evidência não convertem preview hipotético em total completo. |
| WP11.T03 | ChoiceRecord humano durável, critério e histórico; preparação com Planner real e grants. | A jornada choice-prepared-execution liga a escolha humana ao prepare/review/apply reais; sua concessão UI continua em processo e a execução Actions tem pin próprio. Não é prova instalada/nativa. |
| WP11.T04 | Recibos por domínio, idempotência, retomada e recusa stale/revogada. | Atomicidade entre superfícies e cadeia instalada continuam gates de integração/S0. |

### Consumidores de produção encontrados

`apps/cli/src/sucafina-product/bi-services.ts#createSfBiServices` já compõe a fábrica real: Dashboard BI01/07/08, Planner BI01/04 e diferenças BI02/03, Procurement BI05/06, decisões BI09/10/11 e portfólio BI09/10 quando disponível. O seu scenarioProjection usa o result-store e o adapter próprios. COMPOSE6 mantém as rotas estendidas que usam essa fábrica, transportam valueId/refDigest e repetem a leitura autorizada. A inspeção não demonstra todos os invariantes da seleção original no mount nem constitui prova de execução instalada.

COMPOSE `35b9fd4f532abeb1058f00281d4ad8885ca9966f` compõe a via histórica C17 de fechamento record-only, com capture protegido prévio, vínculo ao ledger, replay e continuidade BCS. Os findings antigos de Map global e ausência genérica da via histórica foram superados em fonte. Permanecem os limites de capture prévio, fontes atuais, fechamento sem cálculo aninhado/assumptions/replacement e execução composta nos pins finais. Veja [external-reconciliation.md](external-reconciliation.md) e a revisão [COMPOSE6](reviews/review-compose6.md).

AlternativeDraft permanece vinculado à captura privada do run/proposta no host e ao produtor canônico. O grupo não aceita um resumo ou draft isolado como ChoiceRecord aplicado e não substitui autoridade por identidade nominal de agente.

## Oráculos e semântica preservados

| Caso | Valor/estado requerido |
| --- | --- |
| Planner A/B | 590000 → 602000 = +12000; variante 596000 = +6000 contra base e −4000 contra budget. |
| Renewal com escopo completo | 240000 contra 60000 + 45000 + 105000 = 210000; vantagem30000; mínimo20000; fronteira real55000. |
| Implantação confirmada70000 | Total235000, vantagem5000; critério mínimo20000 falha; shared/N/A não entram duas vezes. |
| Training inteiramente omitido | Subtotal210000, vantagem conhecida30000 condicionada; total e diferença completos indisponíveis, missing-category derivada. |
| Mesmo caso após training40000 | Total250000, vantagem−10000, fronteira15000; ChoiceRecord anterior conserva fonte/subtotal/ressalva. |
| Training zero confirmado | Valor0 com evidência, diferente de categoria ausente ou preço null. |
| Presença e FX | Actual ausente não vira0; zero observado fica0 inclusive em mês aberto; FX ausente não publica o0 legado. |
| Cenário mensal | Apenas células endereçadas adquirem presença; normalização incidental de outros meses não fornece evidência. |
| Threshold | Certificado exato exige avaliação canônica e vizinho IEEE; amostra não prova limiar. Completude financeira é uma condição distinta. |

Os testes numeram cada prova no seu pin. Esta tabela conserva os oráculos e não declara que todos já foram executados no head acima. O BI copia valores/estados do produtor; o novo gráfico de vantagem usa uma comparação inversa persistida, sem subtração/negação financeira local.

## GitHub Actions — testes de produto

| Seleção | W | S | Run | Resultado observado |
| --- | --- | --- | --- | --- |
| S1 | `8184761b61f78d6aeac73232fdc879e93f85bc5e` | `880e0f05557abe8b6c4bb71f5f8cc3ad7272fae4` | [43577975248](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43577975248) | failure: 32 pass / 8 fail / 0 error |
| S2 | `ffe77b53f3c074f03fe6dc3ff7caa788778eca99` | `e63ae9f2a3b05c6adabb93f43057f58ab5185602` | [43581387704](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43581387704) | success: 13 pass / 0 fail / 0 error |
| S3 | `8090bddb8e38faf6209c091b863bff58afe50a9c` | `4980a888f46900d2a4ed0c11bb3b1b6dfd331d58` | [43581459736](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43581459736) | success: 5 pass / 0 fail / 0 error |
| S4 | `a274302d15990919007dbe958d95653508c730a7` | `91cd4ee008b764d1e06d42a3a7fa2dce606ecdc1` | [43581792536](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43581792536) | failure: 15 pass / 4 fail / 0 error |
| S5 | `fe13ee693bdcec1830190bcdb5cc7f2794942c1f` | `40b2f66fdf887ddf7c9bc0abef07e20eb47ac030` | [43584535059](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584535059) | failure: 12 pass / 2 fail / 0 error |
| S6 | `fe13ee693bdcec1830190bcdb5cc7f2794942c1f` | `6bcde71d1fad511d08cf85c7ccc2c6ca067dec1b` | [43584536276](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584536276) | failure: 27 pass / 1 fail / 0 error |
| S7 | `c80144bfa8e0097c6be189ff6dbdb85f4b37e2e7` | `b1ebd5bc75f3551143bf9792a59e9744158407f0` | [43585919034](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43585919034) | failure: 4 pass / 10 fail / 0 error |
| S8 | `c80144bfa8e0097c6be189ff6dbdb85f4b37e2e7` | `959deb36601cd40b729eaf2b79b308d8f70b6739` | [43585919883](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43585919883) | success: 4 pass / 0 fail / 0 error |
| S9 | `6016a70d7ab0c3d50f1ec2827a534a80e48a5c56` | `e4757d462dd0b466829b1736eea35f2da0c7b35b` | [43586476432](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43586476432) | success: 14 pass / 0 fail / 0 error |
| S10 | `6016a70d7ab0c3d50f1ec2827a534a80e48a5c56` | `f9c0d0d2e8ec0b281dce7033cdcfbdb3107bca83` | [43586901880](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43586901880) | success: 5 pass / 0 fail / 0 error |
| S11 | `6016a70d7ab0c3d50f1ec2827a534a80e48a5c56` | `78f709e52a052768188343f93cd5fa36ba867da2` | [43586902727](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43586902727) | failure: 4 pass / 1 fail / 1 error |
| S12 | `92f6d97d2df5ebf53cd845f4cfe93355d10b0f6f` | `0faf62c7f5e10f5ae17037bb6bd8eb512396f2fd` | [43587138878](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43587138878) | failure: 17 pass / 5 fail / 0 error |
| S13 | `8d065831356e8a73cfd0e4fbb072c5041b95d05f` | `bd50d55e7613e9571e0e9ffaf71ce7a5ba8d9531` | [43589341922](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43589341922) | failure: 0 pass / 1 fail / 0 error |
| S14 | `cfbf7c824d4351431d35533dbe2572de11084b9d` | `ee53236037e82ab79227b5ed43874f68dc539e19` | [43589528126](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43589528126) | pending: Em andamento; sem veredicto |
| S15 | `6184a0d3c818fd508f05028d34428ef1c95c01a5` | `a4ee14cce723ac642e48822094809eea4113e11b` | [43590340187](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43590340187) | pending: Em andamento; sem veredicto |

[product-tests.json](product-tests.json) contém requests normalizados, hashes, árvores W/S, arquivos selecionados, todos os cases extraídos dos logs, expect counts, Omni e conclusões. S1 preserva suas oito falhas; S3 validou somente as quatro fixtures corrigidas. S4 preserva quatro timeouts, mesmo onde houve avanço até assertions. Sem bun test local, epic por grupo, alteração de timeout ou assertions enfraquecidas.

O controle Omni focado `not applicable` declara ausência de spawn/delegação; não demonstra a cadeia nativa. Ausência de artefato numa seleção que não exige esse artefato não é convertida em prova visual instalada.

## Typecheck e guards hospedados

| Run | Produto | Erros WP03/WP05/WP11 | Externos | Guards |
| --- | --- | --- | ---: | --- |
| [43577976225](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43577976225) | `8184761b61f78d6aeac73232fdc879e93f85bc5e` | 1/0/21 | 131 | 78 regras; 14 warnings; 0 erros |
| [43579025258](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43579025258) | `981ad44102b2e2e67d31bfc8fb7d97208e390e5b` | 0/0/0 | 131 | 78 regras; 14 warnings; 0 erros |
| [43579943285](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43579943285) | `66bbe152c145f04c16223a938589c63cedb3b716` | 0/0/1 | 131 | 78 regras; 13 warnings; 0 erros |
| [43581389776](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43581389776) | `ffe77b53f3c074f03fe6dc3ff7caa788778eca99` | 0/0/0 | 131 | 78 regras; 13 warnings; 0 erros |
| [43581794354](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43581794354) | `a274302d15990919007dbe958d95653508c730a7` | 0/0/0 | 131 | 78 regras; 13 warnings; 0 erros |
| [43582252267](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582252267) | `9913b0c622aa09da7914f231bd9f2ff54d872634` | 0/3/0 | 131 | 78 regras; 13 warnings; 0 erros |
| [43582460339](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582460339) | `660db9a46e4c1d7ff87c23f6bb37f451cc703ccb` | 0/3/0 | 131 | 78 regras; 13 warnings; 0 erros |
| [43584229925](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584229925) | `fe13ee693bdcec1830190bcdb5cc7f2794942c1f` | 0/0/0 | 131 | 78 regras; 13 warnings; 0 erros |
| [43585498891](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43585498891) | `61d92392e9bded167eb2794995a623b2719cc4ba` | 0/0/0 | 131 | 78 regras; 13 warnings; 0 erros |
| [43587043914](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43587043914) | `92f6d97d2df5ebf53cd845f4cfe93355d10b0f6f` | 0/0/0 | 131 | 78 regras; 13 warnings; 0 erros |
| [43589529625](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43589529625) | `cfbf7c824d4351431d35533dbe2572de11084b9d` | 0/0/0 | 131 | 78 regras; 13 warnings; 0 erros |

O package typecheck continua **failure** enquanto houver diagnósticos externos. Zero diagnósticos próprios não é PASS do package. [hosted-checks.json](hosted-checks.json) inclui a base real de guards, merge-base e hashes dos ZIPs e membros baixados/conferidos; [external-typecheck-findings.json](external-typecheck-findings.json) lista cada posição externa. Os checks executam `bun typecheck` em `modules/sucafina` e `bun run check:guards --base origin/dev` na raiz, pelo workflow mínimo publicado.

## Revisões e pendências delimitadas

[reviews/manifest.json](reviews/manifest.json) preserva as três revisões independentes W3 e seus adendos pinados. Achado corrigido por inspeção estática, teste autorado e teste executado têm estados diferentes. Os pareceres antigos não foram reescritos para aparentar aprovação do head novo.

| Dependência | Delta entregue e prova ainda exigida |
| --- | --- |
| astra-interface / mensal | [owner-deltas.md](../../WP03/finance-20261114/owner-deltas.md), patch mensal de 3 paths e pins COMPOSE4306/INTERFACEa295. Preview canônico, annual/spread/reset, conflito/rebase explícito; preservar retry incerto, key/body e revogação. |
| astra-compose / C17 histórico | [host-c17-proposal.md](host-c17-proposal.md): caminho histórico privado limitado já implementado em COMPOSE6; compor com as cercas finais W18 e executar caso/ledger/capture/revogação. Sem capture prévio ou fontes atuais não há histórico autenticado. |
| astra-compose / C17 concorrente | Implementação por cadeia preservada em COMPOSE6. O patch COMPOSE4 está preservado apenas como histórico; não reaplicar. Prova do wrapper atual fica no candidato do owner. |
| astra-compose / WP13 | O owner já implementa parameterOperation e certificado de subtotal conhecido com validator comum writer/verifier. Validar persistência/replay de 55000/15000, null/zero e mudanças de fonte no candidato real; proposta COMPOSE4 está superada no delta central. |
| astra-interface + compose / BI | Rotas/fábrica/lifecycle já existem. [Proposta exata de dois arquivos](../../WP05/finance-20261114/advantage-selection-proposal.md) transporta advantageComparisonRef e igualdade, sem fórmula local. Restam seleção original/C17, retorno no mount e planos produtores BI09/10. |
| astra-compose / N/A e projeção | Consumir classificação N/A evidenciada com confirmação humana; preservar estado confirmado do source-scenario no host, mantendo previews hipotéticos. |
| astra-compose / Procurement | S12 falhou antes do dispatch porque o projector compartilhado antigo não reconhece approvalStage do issuer. Closure canônica de4arquivos já publicada em COMPOSE6, pinada em [procurement-projection-dependency.json](procurement-projection-dependency.json); executar os3cenários de cross-domain depois do intake. |
| S0 / bundle | Reconciliar dependências, fechar diagnósticos externos, execução instalada/nativa, revisões aceitas e gates C/D, AM01–AM06 e oito seleções finais; epic só do bundle. |

As propostas externas não foram aplicadas autoralmente pelo grupo. Algumas já evoluíram no owner e estão marcadas como superadas em [external-reconciliation.json](external-reconciliation.json); os manifests identificam os blobs realmente examinados. Mudança do owner após esses pins requer reconciliação. O estado final do grupo permanece aberto nos gates não demonstrados, mesmo que uma seleção cirúrgica passe.
