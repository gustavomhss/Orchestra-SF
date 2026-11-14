# WP09 — entrega para revisão de S0

**Estado: DRAFT/BLOCKED. Esta entrega não declara o WP09 integralmente concluído.** O código próprio, os consumidores e as provas disponíveis estão publicados; 53 dos 112 critérios foram verificados pela seleção cirúrgica, 19 permanecem parciais e 40 exigem integração ou prova nativa ainda ausente. O typecheck do package e um consumidor amplo de WP06 continuam falhos.

## Candidato e relação com a entrega

- Branch: **astra-wp09**; base da PR: **sf2-stack**.
- Produto executado W: **a3dcbb62c88231f95a7c57afb32e975404a3b59c**.
- Tree de produto: **4805908207a293db75173a240b9d208ee5c56ee6**.
- Seed preservado: **f18d5819bec7848664772c77d7501e7c25d578bf**; base comum: **6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0**.
- O commit que acrescenta este diretório contém somente recibos/documentação. O head/tree finais e a comparação desse commit com W estão na descrição da PR e na entrega ao usuário. Nenhum teste de W é atribuído a código diferente.
- Os snapshots de CI são envelopes separados. Não integrar um snapshot CI como produto.

O [manifesto](file-manifest.json) relaciona os 52 arquivos próprios de código/testes/configuração e os 113 blobs publicados compostos como dependências. A comparação do produto com o seed contém 152 paths alterados, todos classificados. Os engines Relay/Maestro/Schedule não foram alterados.

## Resultado dos checks

| Seleção | Produto / snapshot | Resultado observado |
|---|---|---|
| 31 arquivos explícitos: 28 próprios WP09 e três consumidores documentais WP06 | W acima; S **000761d8604faf642c918c2df2435bf24a2e0297** | [Run 43540247856](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43540247856): **175 pass, 0 fail**, 1085 expect calls, 52,22 s |
| Typecheck Sucafina e guards contra origin/dev pinado | W acima; S **16a58925e65f410c95e2096778ea24f912919427** | [Run 43540252662](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43540252662): **typecheck FAIL, guards PASS** |
| Somente WP06 documents/runtime-e2e.test.ts | W acima; S **d713781f6f9a867eef264135b1eeebb960f7d4e4** | [Run 43540684025](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43540684025): **0 pass, 1 fail**, timeout de 120000 ms; 57 expect calls, suíte de 133,45 s |

O typecheck executado foi **bun typecheck em modules/sucafina**, sem substituição por um tsc parcial. Restam **78 diagnósticos fora de product/routines e test/product/wp09**, com **zero diagnósticos próprios**. Cada path, linha, mensagem, pin e encaminhamento está em [shared-typecheck-findings.json](shared-typecheck-findings.json). Esses diagnósticos não são classificados automaticamente como preexistentes: parte resulta da composição de produtores publicados com consumidores mais antigos.

Os guards executaram **78 regras contra 644 paths diferentes de origin/dev**, com **0 gate, 13 warnings e 0 errors**. A base efetiva foi **a1d37698a7bb097c1578f827eba6a19b9917ef07**. O artefato **14091019656**, `astra-wp09-check-1`, contém os logs do check e tem digest reportado pelo GitHub **sha256:3258b435c9d894ca17a6ae99fb0a9641d732d07fc3a3f0eaa4b28266ec27f2e5**; expira em 2026-11-28. O lane Bun existente não exige artefato de teste separado. Os logs de jobs e os requests normalizados foram lidos.

As duas dependências próprias acrescentadas são **@orchestra/relay** e **@orchestra/schema**, já existentes no workspace e necessárias aos imports públicos de publicação/receitas/Schedule. O lock acrescenta somente essas entradas no manifesto do workspace Sucafina; nenhum pacote externo novo foi introduzido.

O timeout WP06 reproduziu mesmo com o arquivo isolado. A causa interna não foi demonstrada. A [revisão independente](independent-review.md) propõe uma correção de diagnóstico para a barreira do teste, observando a rejeição da transação e liberando a espera em finally. O arquivo estrangeiro e seu limite de tempo não foram modificados.

O [recibo CI completo](ci-evidence.json) preserva **todos os 17 runs**, inclusive falhas anteriores e correções, SHAs W/S, trees, seleções, artefatos e comparação de blobs. Em cada snapshot, o único delta de árvore sobre o produto é o envelope permitido. Todos os controles omni foram **not applicable**; nenhum deles constitui execução omni, provider ou GNATIVE.

## Implementação própria por task

| Task | Implementação entregue e consumidores | Parcela ainda não qualificada |
|---|---|---|
| **T01 — ciclo de rotina** | Factory exportado; catálogo e cinco operações de rotina; publicação versionada; schemas C16 e dispatcher real; descoberta autorizada; leitura de artefato com vínculo de entrada, principal, projeto, publicação, caso, run e digest terminal. | Composição C07/C08 no host, recibo nativo real, rotas completas de saída e equivalência UI/native/MCP. |
| **T02 — revisão** | Seleção factual, cobertura/omitidos, revisão anterior, confirmação C06 por recorte, fonte indisponível separada de pendência e próximos passos. Consumidor real preserva revisão humana sem aplicar domínio. | Idade da última atualização não é exposta por C02/WP07; lastUpdate fica explicitamente unknown. Faltam apresentação integral e jornada nativa. |
| **T03 — forecast** | Consumo de cálculos Planner; corpus 12000/6000; deltas de valor/FX; HR agregado, taxas ausentes, linhas novas/removidas e confirmação janeiro/fevereiro sem recobrança por versão global irrelevante. | C02/ForecastInsights não expõe sec/el para reclassificação; execução/contexto nativo ainda ausentes. |
| **T04 — sourcing** | Comparação e FX de submissão do WP04; evidência C14 do WP06 sem parser próprio; pendente/confirmado/rejeitado/stale; explicação determinística, fontes distintas e escolha humana preservada. Serviço HTTP real WP06 qualificado em TXT/DOCX/PDF. | Root/browser completo, renderização de todos os campos no workbench e execução Relay. O serviço WP06 não fornece o bloco opcional sourcing completo. |
| **T05 — encaminhamentos** | Rascunhos a partir de notas selecionadas; ausência/conflito de responsável ou prazo explícitos; confirmação real em Hot Topics/relações; retry após perda de ACK; revogação e cancelamento. | Jornada assistida e execução nativa consumindo esses rascunhos. |
| **T06 — recorrência** | Adapter da API pública Schedule, pausa/retomada/manual/timezone, principal e escopo revalidados, snapshots contra mutação, pendências autorizadas, deduplicação de SessionInput e estados verdadeiros. | Ocorrência C07/Relay completa, owner SF, CAS nativo de edição, aviso/último resultado e perda real de ocorrência. Prompt persistido não é conclusão. |
| **T07 — decisão** | Receita linear publicável, pinagem de caso/run/versão/resultado, resposta pela mutação real de decisão, replay e indicação de nova admissão para a versão seguinte. | Run real que produza alternativa/pergunta, nova admissão após resposta, provider/judge e retorno nativo à mesa. |

Os produtores mantêm cálculos, ranking, permissões e comandos finais nos domínios responsáveis. Preparar uma rotina não aprova negócio, não muda valores oficiais e não cria ledger de execução paralelo. As cinco receitas são publicáveis pelo AuthoringStore/RelayWorkflowBinding reais; instruções e implementationRefs não são tool bindings nem prova de execução das etapas.

## Segurança e qualidade verificadas

A revisão independente encontrou oito problemas iniciais e verificou suas correções estaticamente em W2. Os testes posteriores exercitaram os contraexemplos: pinagem integral da admissão, payload imutável após awaits, pendências autorizadas, referência sem falsa conclusão, última cerca de Procurement após a releitura documental, digest terminal independente do artefato, callbacks sem mutação do input e revisão anterior sem exigir uma revisão corrente.

A matriz dos seis exports contém **36 casos** de sucesso, chamada direta sem lease consumida, contexto serializado/revogado, revogação durante await, stale e dependência indisponível. Ela usa o registro UI, dispatcher, schemas e recibos reais. As fronteiras nativas injetadas no teste são declaradas como tal; não substituem C07 nem um SkillLoadReceipt.

## Mapa completo

| Grupo | Total | Verificado cirúrgico | Parcial | Bloqueado externo |
|---|---:|---:|---:|---:|
| WP09 | 22 | 8 | 4 | 10 |
| T01 | 22 | 8 | 2 | 12 |
| T02 | 11 | 6 | 3 | 2 |
| T03 | 11 | 8 | 1 | 2 |
| T04 | 14 | 12 | 0 | 2 |
| T05 | 8 | 6 | 0 | 2 |
| T06 | 16 | 4 | 6 | 6 |
| T07 | 8 | 1 | 3 | 4 |
| **Total** | **112** | **53** | **19** | **40** |

Os 112 IDs e textos são idênticos ao pack canônico, sem faltantes ou duplicatas. Consulte [criterion-map.md](criterion-map.md) e [criterion-map.json](criterion-map.json) para implementação, consumidor, prova e pendência de cada ID. O histórico da classificação está em [criterion-audit.md](criterion-audit.md); os 175 casos efetivamente executados estão em [hosted-tests.json](hosted-tests.json).

## Integração necessária por S0 e proprietários

1. **Atualizar o pin WP09 em WP10.** O head WP10 87f7317d5f983adb255a5707b65d6f07bfa5a0d4 ainda fixa 42 paths WP09 em W1 115326b1337b73c5e275624a8d401b41e8ed1c9e, anterior às correções R1–R8. Não restaurar esse pack sobre o candidato final desta PR.
2. **Compor o host governado.** Mesmo nesse head novo, os cinco métodos routines de host-context retornam unavailable. O verificador executivo ainda recusa factualRoutineResults/routinePreparation/admittedRun. WP00/WP10 precisam fornecer os recibos C07 reais e as leituras terminais/artefatos C08 requeridas pelo factory; não preencher com callbacks permissivas.
3. **Reconciliar o root documental.** O business-services publicado por WP06 exporta resolveProcurement; o atual WP10 não o exporta e exige dashboardHostWrites. O pin selecionado para a qualificação documental é explícito, verbatim, e não transfere ownership. A rota foi testada diretamente, sem afirmar subida do root completo.
4. **Corrigir os consumidores compartilhados e o timeout.** Os 78 diagnósticos e o finding do teste WP06 permanecem abertos. Os deltas incluem também migração C08 observada no intake WP00/WP10, idade autoritativa, dimensões de reclassificação e apresentação do workbench.
5. **Qualificar a execução nativa e o bundle.** Capturar perfil/skill/grant/SkillLoadReceipt, aprovação e Task/arm/child session reais, execução terminal, revogação em todas as rotas, ocorrência Schedule e nova admissão de decisão. C/G7, D/G8, AM01–AM06 e as oito seleções finais pertencem ao bundle integrado.

Os detalhes e pins estão em [native-host-deltas.md](native-host-deltas.md), [latest-host-intake.md](latest-host-intake.md) e [dependency-provenance.json](dependency-provenance.json). Nenhum merge em sf2-stack/dev, deploy, teste local de produto ou suíte epic foi realizado.

