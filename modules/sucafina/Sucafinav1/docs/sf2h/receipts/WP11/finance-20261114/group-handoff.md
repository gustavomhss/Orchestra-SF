# Sessão 3 — Planner, BI e decisões

**Estado: incrementos publicados para integração; aceite integral não concedido.** Os resultados abaixo qualificam somente os SHAs e os consumidores explicitamente observados. C/D, composição instalada, provas nativas e epic do bundle continuam com S0.

PR do grupo: [#35](https://github.com/gustavomhss/Orchestra-SF/pull/35), `astra-finance` contra `sf2-stack`. Pin de produto registrado nesta edição: `87e5164a1c87ac9f013d381d5e601ca5b4b6c677`; tree `052583ce35edbadd4b7ec68ffe021bb59e05a20f`. Uma publicação posterior apenas destes recibos não amplia o escopo dos testes.

## Fontes e recuperação

Plano imutável: `dbf9547211d9b0fade619790de7c19c0869b7c7d`; campaign SHA256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`, conferido. Handoffs completos e CI: `a3d29d011ba3607a57914701300f09117a3e2de9`.

| Fonte recuperada | Head consumido | Commits preservados |
| --- | --- | ---: |
| PR #22 / WP03 | `90c467cea436daa24987ad68a588a7d80f91064e` | 15 |
| PR #24 / WP05 | `0881fee21f07bf8a9a1153d7d55727837cdf497a` | 16 |
| WP11 — head inicial (PR40 localizada no refresh posterior) | `ff99e4b4de56bbf6e7ef36daf5d3eb749779017a` | 1 |
| PR #40 / WP11 — primeira atualização | `be50d42d6a2c030d57d17038dec267ebd33ea78c` | 5 |
| PR #40 / WP11 — segunda atualização | `2bf0197c5d607b43063c36e1c8fef9e769c716ca` | 2 |
| PR #40 / WP11 — terceira atualização | `65509f0b8c435b88fb0ec9949299571f011d2347` | 2 |
| PR #40 / WP11 — quarta atualização | `d7775d6f1eb17af1590ccfb98547259eb017cd1b` | 4 |
| PR #40 / WP11 — quinta atualização, corte 12:47:36 UTC | `dc9d4327d07db58d026e7672cf619717394f5ffd` | 3 |

A recuperação `04f3ffae53eca454b434bdab9fcb19bf0353ccc1` preserva os três heads como ancestrais e recupera os blobs próprios sobre sf2-stack `6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0`. [intake-pins.json](intake-pins.json) lista os 32 commits individuais e cada blob recuperado. W18 `92f6d97d2df5ebf53cd845f4cfe93355d10b0f6f` adiciona o head PR40 como parent e conserva os cinco commits novos; [intake-reconciliation-pr40.json](intake-reconciliation-pr40.json) decide cada um dos 40 paths, preservando 29 receipts anteriores. W19 `d9b84003ed6cd6dd77b5738dbfcc6b45d57f72c8` consome a segunda atualização em mais um parent: [intake-reconciliation-pr40-latest.json](intake-reconciliation-pr40-latest.json) decide36paths, adota12testes/helpers e preserva17recibos novos/revisados, sem sobrescrever o recibo histórico modificado. W25 `c99d6dfb4f443b8f626010e78276874ae842f370` acrescenta o parent `65509f0b8c435b88fb0ec9949299571f011d2347`: [intake-reconciliation-pr40-final-65509.json](intake-reconciliation-pr40-final-65509.json) decide29paths, adota6blobs exatos e preserva18recibos novos. W30 `bd168e193e7bb4a43893c24c5370c9c3fa205fc1` acrescenta o parent `d7775d6f1eb17af1590ccfb98547259eb017cd1b`: [intake-reconciliation-pr40-final-d777.json](intake-reconciliation-pr40-final-d777.json) decide44paths, adota5blobs exatos, faz2merges aditivos, reconhece4blobs já idênticos e preserva33recibos novos. Até W30 são 45 commits de origem preservados; W32 eleva o total a 48, além dos incrementos próprios. As branches originais e seus recibos históricos não foram sobrescritos.

A [proveniência por commit](source-provenance.md) lista os 48 commits individualmente por PR/WP e o primeiro commit Finance que preserva cada origem. W32 `79531aefa2bf72a9d13deba5164f725ec7da0e0f` acrescenta o parent dc9: [intake-reconciliation-pr40-dc9.json](intake-reconciliation-pr40-dc9.json) decide 35 paths da origem, preserva 29 recibos históricos e compõe sete arquivos de código/testes, incluindo a extração canônica WP03. Este é o corte final das origens; mudanças posteriores requerem novo intake.

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
| W24 | `3ab41cbb106435635999e1417b10a087a34a5d95` | `e7974c33c9a5bbf4a20ce0c1db4a66ae04f3b8a9` | 68 arquivos documentais:303 critérios literais,14 tarefas completas, mapas auditados, histórico de CI e propostas delimitadas. |
| W25 | `c99d6dfb4f443b8f626010e78276874ae842f370` | `d6f28f45ac55c5d345b0694d02441849a2cf27d7` | PR40 65509 consumida como parent:6 blobs exatos,18 recibos novos, Hot Topic com leitura final conjunta e projeção canônica dos fixtures. |
| W26 | `0c4a2545a63b4903c7eedb00d3f0989eb74ed398` | `8325d52877c8fdd5bf317b244b81b0bb45736fce` | Fixtures com comparação sem sensibilidade não consumida, inicialização canônica de fontes antes de C08/apply e diagnóstico de escolha atual. |
| W27 | `332c5a762365e8550eaac7a278c864be0452651d` | `ace9841eefc65a9e3335fad0fe6846aaaff11f4b` | Consolidação documental dos303critérios/14tarefas, reconciliação das observações históricas e revisão independente dos links e pins. |
| W28 | `29172d2e4db859eedac31e84778c447bb97f6c08` | `8d7a7657597d024c5a55a9f5a4fdccf604c40d25` | Inicialização Dashboard em Hot Topic/promoção e observação diagnóstica segura; S18 executa13casos,11pass/2fail. |
| W29 | `96fc3162ae309f8b91b2c55524335026f8704714` | `d3fa003182dd1c38778b37e7b7219a5015bb58a2` | Transação real de leitura por verificação de renovação, três casos discriminantes, status Hot Topic canônico e isolamento do matcher sem alterar o produto. |
| W30 | `bd168e193e7bb4a43893c24c5370c9c3fa205fc1` | `7adcfb7d4687aa192b68eeddd3cce4fd0bf92d18` | PR40 d777 consumida como parent:quatro commits adicionais,5adoções exatas,2merges aditivos,+8assertions e33recibos históricos preservados. |
| W31 | `c449efc092e507fca2b4f61d1e7ce057faf05c89` | `82ea6bff11f9647d14cac30587ccd2feb80c6950` | Exige a capacidade real transactionAll antes de usá-la no teste de leitura; check14 fecha4diagnósticos próprios e S21 passa3casos/9assertions. |
| W32 | `79531aefa2bf72a9d13deba5164f725ec7da0e0f` | `485a3ac2ac1322d03d7421a17eb1791153f11c1b` | PR40 dc9: três commits adicionais, fences finais da escolha, duas observações autenticadas de fonte e reutilização do mapper canônico Planner; 29 recibos históricos e revisão independente exata. |
| W33 | `87e5164a1c87ac9f013d381d5e601ca5b4b6c677` | `052583ce35edbadd4b7ec68ffe021bb59e05a20f` | Após dois timeouts S22, agrupa verificações read-only por caso nas fixtures financeira e humana; quatro testes novos/19 assertions, corpo do verificador individual e todos os blobs de produção inalterados. |

Cada captura foi publicada via GitHub MCP e confrontada com o compare remoto. Os snapshots S são descendentes do W indicado e diferem exclusivamente em `.ci-run.json`; nenhum arquivo dirty foi incluído incidentalmente. Os manifests de alteração do grupo identificam arquivos, blobs e finalidade para intake delimitado.

## Mapa integral de tarefas e critérios

O [adendo pós-W21](post-W21-criterion-bindings.md) acrescenta18vínculos discriminantes de seis testes a12critérios existentes, com propriedade exercitada, consumidor real e lacuna restante. Cada vínculo tem texto literal e blob; resultados são resolvidos por arquivo, caso e W/S. O snapshot auditado W21 não foi reescrito.

O [adendo pós-W31](post-W31-criterion-bindings.md) acrescenta seis vínculos de dois testes aos ramos pertinentes de cinco critérios WP03/WP11. O leitor e a admissão de fonte não são apresentados como prova financeira, aplicação ou execução nativa.

O [adendo pós-W32](post-W32-criterion-bindings.md) acrescenta dois vínculos de um teste aos dois critérios pertinentes de admissão WP03/WP11. O consumidor agrupado comprova snapshot consistente, recusa de write aninhado/revogação e releitura após commit, sem conceder aceitação integral.

São **303 IDs e textos literais**: WP03 112, WP05 108 e WP11 83. [task-obligations.json](task-obligations.json) conserva integralmente as 14 tarefas, arrays de trabalho, inputs, outputs, checks, axiomas e contratos dos packs. Nenhum critério recebeu aceite integral nesta sessão. Classificações históricas ficam identificadas como históricas.

| WP | Mapa completo | Critérios |
| --- | --- | ---: |
| WP03 | [criteria.json](../../WP03/finance-20261114/criteria.json) | 112 |
| WP05 | [criteria.json](../../WP05/finance-20261114/criteria.json) | 108 |
| WP11 | [criteria.json](criteria.json) | 83 |

Cada linha liga implementação/consumidor, testes candidatos e observações dos runs aos critérios. Uma observação de arquivo não quita automaticamente todos os ramos do critério; a matriz mantém limites e pendências. [task-delivery-map.md](task-delivery-map.md) e [task-delivery-map.json](task-delivery-map.json) preservam o snapshot auditado W21 das14tarefas e303critérios. Os incrementos posteriores e seus pins constam deste handoff e do ledger; não se apresenta o mapa W21 como auditoria de bytes posteriores.

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
| WP05.T05 | C08 scenario/portfolio/sensitivity; vantagem inversa persistida e tabelas/figuras com condição. | Compose00304 preserva seleção inversa e navegação protegida; o antigo TS2345 está corrigido estaticamente por narrowing UI, mas a execução dos novos consumidores permanece pendente. BI09/10 ainda dependem dos planos produtores. |
| WP11.T01 | Caso persistente/versionado, C08, case-port, capacidades e produto composto. | Reinício/reabertura de store não equivale a prova da aplicação residente instalada. |
| WP11.T02 | Alternativas, inventário completo, shared/N/A, resultado/threshold e replay. | Shared/N/A sustentados por evidência não convertem preview hipotético em total completo. |
| WP11.T03 | ChoiceRecord humano durável, critério e histórico; preparação com Planner real e grants. | A jornada choice-prepared-execution liga a escolha humana ao prepare/review/apply reais; sua concessão UI continua em processo e a execução Actions tem pin próprio. Não é prova instalada/nativa. |
| WP11.T04 | Recibos por domínio, idempotência, retomada e recusa stale/revogada. | Atomicidade entre superfícies e cadeia instalada continuam gates de integração/S0. |

### Consumidores de produção encontrados

`apps/cli/src/sucafina-product/bi-services.ts#createSfBiServices` já compõe a fábrica real: Dashboard BI01/07/08, Planner BI01/04 e diferenças BI02/03, Procurement BI05/06, decisões BI09/10/11 e portfólio BI09/10 quando disponível. O seu scenarioProjection usa o result-store e o adapter próprios. COMPOSE00304 mantém as rotas e acrescenta seleção inversa persistida, seis destinos autorizados e retorno de foco. Os novos consumidores não foram incluídos na seleção de produto observada do owner. A inspeção não demonstra todos os invariantes da seleção original no mount nem constitui prova de execução instalada.

COMPOSE `00304ac25cc82ffd87ebd3096bd2f5cfec5222e1` conserva, nos mesmos quatro blobs do COMPOSE6, a via histórica C17 de fechamento record-only, com capture protegido prévio, vínculo ao ledger, replay e continuidade BCS. Os findings antigos de Map global e ausência genérica da via histórica foram superados em fonte. Permanecem os limites de capture prévio, fontes atuais, fechamento sem cálculo aninhado/assumptions/replacement e execução composta nos pins finais. Veja [external-reconciliation.md](external-reconciliation.md) e o [último refresh independente](reviews/latest-external-refresh.md), e o [corte final12:19:40UTC](reviews/final-heads-observation.md), incluindo Interface5fe39 e a nova concessão privada de leitura do settlement stale de análise em Compose00304, ainda sem qualificação de execução.

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

A [validação final delimitada](final-validation.md) reúne os resultados S25/S26 do W33 e a seleção Planner S24 do W32, cujos blobs de produção permanecem idênticos. S22 mantém 14 pass e dois timeouts em sua história; os [findings S22](s22-findings.md) e o patch de leitura consistente distinguem duas transações diretas de uma leitura atômica por caso. Cada conclusão permanece restrita ao W/S e ao consumidor observado. O check mais recente permanece package failure com zero diagnósticos próprios e 131 externos.

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
| S14 | `cfbf7c824d4351431d35533dbe2572de11084b9d` | `ee53236037e82ab79227b5ed43874f68dc539e19` | [43589528126](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43589528126) | failure: 22 pass / 5 fail / 0 error |
| S15 | `6184a0d3c818fd508f05028d34428ef1c95c01a5` | `a4ee14cce723ac642e48822094809eea4113e11b` | [43590340187](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43590340187) | failure: 0 pass / 1 fail / 1 error |
| S16 | `c99d6dfb4f443b8f626010e78276874ae842f370` | `fad30a6e2468088c574f57689341a3731ce3e08c` | [43591377679](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43591377679) | success: 1 pass / 0 fail / 0 error |
| S17 | `0c4a2545a63b4903c7eedb00d3f0989eb74ed398` | `2b2b2eb1872d09a3a2dcee24f3f679ef4f9e7ad4` | [43591635600](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43591635600) | failure: 4 pass / 15 fail / 0 error |
| S18 | `29172d2e4db859eedac31e84778c447bb97f6c08` | `5178f3ff43a3387b3e25e4769a8b391a4ea9e423` | [43593276333](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43593276333) | failure: 11 pass / 2 fail / 0 error |
| S19 | `bd168e193e7bb4a43893c24c5370c9c3fa205fc1` | `823311ee83c6a28273bc8d63bb1157e9bdcb01e7` | [43594791351](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43594791351) | success: 21 pass / 0 fail / 0 error |
| S20 | `bd168e193e7bb4a43893c24c5370c9c3fa205fc1` | `14b1aac9f3b62b3d1b4f466a0fc214779a344667` | [43594793696](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43594793696) | success: 1 pass / 0 fail / 0 error |
| S21 | `c449efc092e507fca2b4f61d1e7ce057faf05c89` | `6c98bd185ed3041ecd6b1c9d6c3eb169968cd410` | [43595579525](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43595579525) | success: 3 pass / 0 fail / 0 error |
| S22 | `79531aefa2bf72a9d13deba5164f725ec7da0e0f` | `ef218e5c436f8518ee582232a820cd41048f8d3b` | [43597449806](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43597449806) | failure: 14 pass / 2 fail / 0 error |
| S23 | `79531aefa2bf72a9d13deba5164f725ec7da0e0f` | `bdc5494e612353cc5d80bd32353dc9df6e20f450` | [43597452709](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43597452709) | success: 1 pass / 0 fail / 0 error |
| S24 | `79531aefa2bf72a9d13deba5164f725ec7da0e0f` | `b791d889a6f14ea0b9f9ff2b950bf10da4fe5090` | [43597456215](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43597456215) | success: 7 pass / 0 fail / 0 error |
| S25 | `87e5164a1c87ac9f013d381d5e601ca5b4b6c677` | `34c2647395a03749e5bbc795bcf1656be5d10a03` | [43599384924](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43599384924) | success: 17 pass / 0 fail / 0 error |
| S26 | `87e5164a1c87ac9f013d381d5e601ca5b4b6c677` | `62223d922ddeb4db39c28213ab8190b01bd0617e` | [43599387716](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43599387716) | success: 1 pass / 0 fail / 0 error |

[product-tests.json](product-tests.json) contém requests normalizados, hashes, árvores W/S, arquivos selecionados, todos os cases extraídos dos logs, expect counts, Omni e conclusões. S1 preserva suas oito falhas; S3 validou somente as quatro fixtures corrigidas. S4 preserva quatro timeouts, mesmo onde houve avanço até assertions. Sem bun test local, epic por grupo, alteração de timeout ou assertions enfraquecidas. As correções W29/W30 têm S19/S20; W32 tem S22/S23/S24 e W33 tem S25/S26. Todos os resultados, inclusive timeouts, permanecem no ledger com seus pins exatos.

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
| [43591637037](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43591637037) | `0c4a2545a63b4903c7eedb00d3f0989eb74ed398` | 0/0/0 | 131 | 78 regras; 13 warnings; 0 erros |
| [43594795813](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43594795813) | `bd168e193e7bb4a43893c24c5370c9c3fa205fc1` | 0/0/4 | 131 | 78 regras; 13 warnings; 0 erros |
| [43595368852](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43595368852) | `c449efc092e507fca2b4f61d1e7ce057faf05c89` | 0/0/0 | 131 | 78 regras; 13 warnings; 0 erros |
| [43597458293](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43597458293) | `79531aefa2bf72a9d13deba5164f725ec7da0e0f` | 0/0/0 | 131 | 78 regras; 13 warnings; 0 erros |
| [43599389386](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43599389386) | `87e5164a1c87ac9f013d381d5e601ca5b4b6c677` | 0/0/0 | 131 | 78 regras; 13 warnings; 0 erros |

O package typecheck continua **failure** enquanto houver diagnósticos externos. Zero diagnósticos próprios não é PASS do package. [hosted-checks.json](hosted-checks.json) inclui a base real de guards, merge-base e hashes dos ZIPs e membros baixados/conferidos; [external-typecheck-findings.json](external-typecheck-findings.json) lista cada posição externa. Os checks executam `bun typecheck` em `modules/sucafina` e `bun run check:guards --base origin/dev` na raiz, pelo workflow mínimo publicado.

## Revisões e pendências delimitadas

[reviews/manifest.json](reviews/manifest.json) preserva as três revisões independentes W3 e seus adendos pinados. Achado corrigido por inspeção estática, teste autorado e teste executado têm estados diferentes. Os pareceres antigos não foram reescritos para aparentar aprovação do head novo. W29 tem três revisões exatas (transação, comando Hot Topic e isolamento do matcher); W30 tem revisão independente dos sete testes/helpers e dos merges aditivos. A observação final preserva o corte dos heads, sem confundi-lo com intake ou execução externa. W32 tem revisão canônica de 52 verificações; W33 tem revisão independente de 108 verificações e preserva o resultado negativo S22. O snapshot documental W31 possui auditoria independente de 228 verificações; o adendo final audita a continuidade posterior.

| Dependência | Delta entregue e prova ainda exigida |
| --- | --- |
| astra-interface / mensal | [owner-deltas.md](../../WP03/finance-20261114/owner-deltas.md), patch mensal de3paths; o último refresh confirma os mesmos blobs920fda/2befb1/3adef2, sem delta mensal nos compares até Compose00304/Interface5fe39. Preview canônico, annual/spread/reset, conflito/rebase explícito; preservar retry incerto, key/body e revogação. |
| astra-compose / C17 histórico | [host-c17-proposal.md](host-c17-proposal.md): caminho histórico privado limitado implementado e preservado no Compose00304; compor com as cercas finais W18 e executar caso/ledger/capture/revogação. Sem capture prévio ou fontes atuais não há histórico autenticado. |
| astra-compose / C17 concorrente | Implementação por cadeia preservada no Compose00304. O patch COMPOSE4 está preservado apenas como histórico; não reaplicar. Prova do wrapper atual fica no candidato do owner. |
| astra-compose / WP13 | O owner já implementa parameterOperation e certificado de subtotal conhecido com validator comum writer/verifier. Validar persistência/replay de 55000/15000, null/zero e mudanças de fonte no candidato real; proposta COMPOSE4 está superada no delta central. |
| astra-interface + compose / BI | Compose00304 preserva advantageComparisonRef e acrescentou seis destinos protegidos/foco. A [proposta original](../../WP05/finance-20261114/advantage-selection-proposal.md) é histórica. O antigo TS2345 foi corrigido estaticamente; executar seleção inversa/navegação no composto; persistem planos produtores BI09/10 e prova instalada. |
| astra-compose / N/A e projeção | Consumir classificação N/A evidenciada com confirmação humana; preservar estado confirmado do source-scenario no host, mantendo previews hipotéticos. |
| astra-compose / Procurement | S12 falhou antes do dispatch porque o projector compartilhado antigo não reconhece approvalStage do issuer. Closure canônica de4arquivos permanece publicada no Compose00304, pinada em [procurement-projection-dependency.json](procurement-projection-dependency.json); executar os3cenários de cross-domain depois do intake. |
| S0 / bundle | Reconciliar dependências, fechar diagnósticos externos, execução instalada/nativa, revisões aceitas e gates C/D, AM01–AM06 e oito seleções finais; epic só do bundle. |

Preservar os blobs Finance mais recentes de apply/result/request, mutations e Hot Topic: o novo intake Compose contém versões FinanceW23 anteriores às cercas finais W25. A proposta Interface de guardas explícitas para callers vazios de case-port permanece documental e depende do contrato real; não foi aplicada nem qualificada. As propostas externas não foram aplicadas autoralmente pelo grupo. Algumas já evoluíram no owner e estão marcadas como superadas em [external-reconciliation.json](external-reconciliation.json); os manifests identificam os blobs realmente examinados. Mudança do owner após esses pins requer reconciliação. O estado final do grupo permanece aberto nos gates não demonstrados, mesmo que uma seleção cirúrgica passe.
