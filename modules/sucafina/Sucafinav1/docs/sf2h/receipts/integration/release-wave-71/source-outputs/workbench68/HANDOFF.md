# Missão68 — Workbench, MCP e skills: handoff terminal para60

## Resultado e autoridade

A PR draft [#81](https://github.com/gustavomhss/Orchestra-SF/pull/81), de **workbench-mcp-proof** para **sf2-stack**, entrega duas correções de produção, nove arquivos novos de testes/helpers, quatro seleções hospedadas e o pacote de evidências.

**Os 18 testes novos passaram nas seleções correspondentes. A qualificação integral das 39 operações permanece bloqueada e GLOBAL_RELEASE=false.** Há 14 falhas de testes preexistentes nos snapshots de fonte; três propostas completas e inertes encaminham as causas encontradas fora dos paths próprios. Nenhuma foi aplicada ao produto compartilhado.

Fonte material final **W3=d5a297ca260b929335da4517f9c4432eaa92f856**, tree **4eaf0ddec206022c29ad2da1203615ee22c3b6c3**. Base **7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85**; planejamento **dbf9547211d9b0fade619790de7c19c0869b7c7d**; missão/controle **173c3507e40579f1a1a2dfb068bda40084a678bc**. O ACK precedeu qualquer escrita material em **6b2bbb59976378081f7e8032537d9ff71eba30f5**.

O commit que contém este handoff arquiva evidência sobre W1/W2/W3. Seu SHA/tree serão publicados após CAS na PR81 e no comentário de handoff da PR65. Ele não é o candidato integrado C nem a entrega global D, e nenhum resultado é reatribuído ao commit de arquivo.

[AUTHORITY-FINAL.json](AUTHORITY-FINAL.json) encerra a lease **workbench-mcp-browser68** quando publicado. Session ID de provider e modelo efetivo permanecem **null**: o handle de colaboração /root e o nome do modelo exposto pelo host não são receipts de execução nativa.

### Estado real do consumidor

A leitura final do target encontrou **faa30fddb7e7b61696b66fd069f51cf18c51125f**, tree **b3b4f89ddd6a3ca5d570681f91098214b5ce935d**, contendo somente o terminal de60 sobre o material C28 **d088708276b48f896ad4e0ecd2a95cb73dc413b1**.

A autoridade de60 está **HANDOFF_TERMINAL_LEASE_ENDED**. O handoff é registrado na [PR65](https://github.com/gustavomhss/Orchestra-SF/pull/65), sem presumir ACK, reativação ou novo writer. Uma retomada60 ou sucessão expressamente autorizada deverá reconciliar HEAD, controle, autoridades, releases e preimages antes de integrar.

As duas preimages de produção68 continuam iguais ao base. Os 11 arquivos materiais formam a unidade explícita liberada para preparar um candidato em HOLD; a liberação não dispensa compiler, guards ou aceite funcional. Ver [CONSUMER-RELEASE.json](CONSUMER-RELEASE.json), [manifesto](integration/source-manifest.json), [patch completo](integration/source.patch), [closure](integration/dependency-closure.json) e [reconciliação do target](integration/target-reconciliation.json).

## Correções implementadas

1. **Bridge privada:** congela o payload antes do primeiro await, entrega uma cópia separada ao SDK e destaca o resultado retornado pelo dispatcher antes de verificar o receipt e codificar a resposta. Referências retidas pelo chamador ou produtor não podem alterar payload, resultado, receipt, outputRef ou observação durante Client.close/Server.close. A verificação final de autoridade permanece depois dos dois closes, sem novo await de cleanup após ela. Entradas não clonáveis ou não finitas falham fechadas.
2. **Skill loader:** termina a última leitura assíncrona dos bytes antes da verificação síncrona final da capability da fonte. Revogar a capability enquanto essa leitura está pendente impede a emissão do receipt. A carga pública real, o conteúdo SkillV2 e a mensagem persistida em SessionV2 continuam obrigatórios.

As alterações de produção limitam-se a **product/host-binding/sf-mcp-bridge.ts** e **product/host-binding/skill-loader.ts**. Engine, SessionV2, Maestro, Task, Relay, Schedule, políticas financeiras, workflows e arquivos vivos de outros owners não foram modificados.

## O que foi observado

| Camada | Evidência observada | Limite |
|---|---|---|
| Contrato | Oito packs, 39 operações com schemas reais de entrada/saída, produtores, consumidores e grants mapeados | Inventário e composição não são execução |
| Carga de skills | 25 cargas reais de 18 skills nos cinco perfis, através de registro público, SkillV2, SessionV2.skill e mensagem persistida | Não são 18 outputs de domínio consumidos, nem turns de provider |
| Bindings | 39 rotas canônicas ligadas a receipts de carga real, em 14 sessões; revogação e perfil errado exercitados | O teste não executa 39 handlers; autoridade de admissão e rótulos de run/case são sintéticos |
| MCP/SDK com domínio real | Nove operações únicas: dashboard, KPI, BI, forecast, simulação/comparação de cenário, extração de documento, busca e import preview | Sete têm receipt real de carga no trajeto observado; as duas de cenário usam receipt literal da fixture |
| Wrapper público | Quatro operações únicas passam por Tools.Service e ToolRegistry.materialize/settle: dashboard, KPI, BI e forecast | As cinco restantes entram diretamente por bridge.call |
| Concorrência | Duas sessões reais de sf_finance executam forecast com diferenças conhecidas de 12000 e 6000, paridade UI/receipt e isolamento após revogação | Principals, contextos e labels de caso/run pertencem à fixture; não houve provider ou Task |
| UI/dispatcher | Quatro operações adicionais com domínio real: request, supplier, contract e work | Sem qualificação de wrapper MCP para essas quatro |
| Reports | review, report e artifact exercitam dispatcher, renderer, SQLite e consumo/reabertura | Projeções de negócio e backend/registros auxiliares C07 são sintéticos |
| Readiness | Composição sem portas nativas/publicação contém 33 descritores de domínio e omite as seis rotinas | Não prova publicidade pública de 33 rotas, execução de rotina, Relay ou Schedule |

[coverage-matrix.json](coverage-matrix.json) conserva o mapa estático e seus schemas. [runtime-qualification.json](runtime-qualification.json) sobrepõe as provas e lacunas de cada uma das 39 operações. [runtime-scope-review.json](inspection/runtime-scope-review.json) identifica os trajetos exatos, fontes pinadas e componentes sintéticos. Os receipts de carga, bindings, forecast, revogação e fences estão em **proofs/**.

As seleções WP06 usam eventos de modelo previamente gravados e scanner substituto; isso não qualifica inferência externa ou scanner instalado. Nomes legados de testes contendo AM02 não equivalem ao aceite AM02. Nenhum receipt novo de admissão Task/Relay/Schedule foi fabricado.

### Negativos discriminantes

Foram exercitados ausência de binding/receipt, perfil indevido, fonte ausente/alterada, capability copiada entre Locations, revogação durante a leitura final, expiração, geração/digest/replay, argumentos de autoridade crua, colisão normalizada do provider, isolamento entre sessões e revogação durante o fechamento do SDK. R4 recusa prepare/run em routine-result e mantém leases permitidas de catalog/status/result; não executa nem anuncia essas rotinas.

O perfil Maestro conserva seu teto de 27 operações e interseção efetiva de 26: watch é concedido por sf_portfolio/sf-reavaliar-compromissos. O schema real de sf_portfolio_evaluate exige scope e operations além dos quatro campos mencionados na descrição do manifesto; não se ampliaram grants nem se reescreveu o plano para ocultar a diferença.

## Testes hospedados e identidade de cada execução

Todas as seleções usaram a interface existente test-ci, Linux ubuntu-24.04, com deadlines originais. Cada S é filho direto de W e altera somente .ci-run.json, confirmado por compare MCP. Os headers dos arquivos executados correspondem à seleção pedida. Nenhum teste local, build, compiler ou guard foi executado.

| Run | Fonte W / snapshot S | Resultado | Assertions / arquivos |
|---|---|---:|---:|
| [R1](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43667815725) | dd76b2f7486413bfc25d0a1e4e9bbbba44f504b8 / a372b69017b275e5f4929d92346e02c21f1936d5 | 41 PASS / 8 FAIL | 2220 / 15 |
| [R2](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43668348441) | a9a48b930c7b3a8c003dc6791bbec99f20300047 / 315c95ef7a466162a5e4a27fb68c9607b48a4851 | 7 PASS / 0 FAIL | 925 / 4 |
| [R3](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43668610172) | a9a48b930c7b3a8c003dc6791bbec99f20300047 / 3328845bbb6186f82cf29d89185aff3f3a313924 | 11 PASS / 13 FAIL | 155 / 8 |
| [R4](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43669037981) | d5a297ca260b929335da4517f9c4432eaa92f856 / 4b601473b4b716199a643517645dd4820667180d | 3 PASS / 0 FAIL | 56 / 1 |

R1 encontrou sete falhas nos testes novos porque o helper não exportava LocationServiceMap na layer raiz. W2 acrescenta a dependência pública real; R2 reexecuta somente os quatro arquivos afetados e passa os sete testes. Nenhuma assertion, timeout ou fixture de produto preexistente foi enfraquecida.

R1 fornece os oito positivos novos de bridge/catálogo; R2 fornece sete; R4 acrescenta três. W3 só adiciona o arquivo de fences sobre W2; os W/S originais são preservados. Não houve rerun completo de W3 nem alegação de que uma seleção verde qualificou o candidato integrado.

**Omni: not applicable (focused: no declaring test ran).** Não houve spawn/delegation Omni a creditar.

## Falhas preservadas e propostas concretas fora da autoridade68

| Falhas na fonte | Causa demonstrada e proposta | Estado |
|---|---|---|
| Uma em R1, WP06 import-analysis | O componente não renderiza o link de import preview esperado pelo consumidor e ignora o mount passado pelo teste. [Proposta completa](owner-proposals/import-preview-link/proposal.json) propaga o mount e monta link restrito às rotas Planner/Dashboard existentes, sem liberar efeito de domínio. | NOT_RUN / NO_RELEASE / inerte |
| Seis em R3, sourcing | Fixture passa sources.resolve como função; source-access exige objeto e chama resolve.resolve. A exceção absorvida explica o unavailable observado; o TypeError interno é inferência de fonte, sem stack capturado. Também falta verifier obrigatório em leitura posterior. [Proposta](owner-proposals/sourcing-case-evidence/proposal.json) usa o resolver real e guarda restrita a caso sem cenários + autoridade atual. | NOT_RUN / NO_RELEASE / inerte |
| Sete em R3, colaboração | Fixtures omitem verifyScenarioOperations; primeira leitura de caso retorna case-state-unavailable. [Proposta](owner-proposals/collaboration-case-verifier/proposal.json) compõe a dependência restrita, mantendo todos os corpos/assertions. | NOT_RUN / NO_RELEASE / inerte |

O target já contém a correção de thread-actors-fixture pela unidade Reports48. **Preservar esse postimage e usar a variante target-d088708.patch somente para os outros dois arquivos de colaboração.** Essa variante continua compatível com o target terminal observado. As outras preimages das três propostas também coincidem; refazer a reconciliação antes de eventual adoção.

Cada proposta contém preimages/postimages completos, patch, hashes, contrato, causalidade, limites e seleção futura exata. Verificações mecânicas e revisões estáticas não são resultados funcionais. Os 14 FAIL da fonte não foram apagados, nem convertidos em falhas do target sem testá-lo.

## Próximos atos e aceite ainda devido

- **60 ou sucessor autorizado:** acusar recebimento de W3/tree e do contêiner de evidência, identificar unidade aceita e target real, conservar HOLDs e propostas inertes. Integrar somente sob nova autoridade explícita; não restaurar arquivos anteriores sobre Reports48.
- **45:** admitir e executar [REQUEST45.json](REQUEST45.json) na interface hospedada autorizada: bun typecheck em modules/sucafina e apps/cli, mais check:guards contra origin/dev. Registrar programa TS real, comandos, SHA/tree e resultados. Hosted Bun tests não substituem compiler ou guards.
- **Owners compartilhados sob autoridade explícita:** revisar as três propostas, aplicar o delta pertinente e validar as seleções originais, sem promover diagnóstico estático a PASS.
- **64:** prover/qualificar admissão nativa Task/Relay/Schedule e origem autenticada/modelo. A68 não duplica essa implementação e não fabrica prova para desbloquear o gate.
- **69/61 e produtores canônicos:** completar os leitores e consumidores reais de memória/fontes, saídas de domínio e rotas ainda sem positivo; o ledger por operação distingue NOT_RUN de bloqueio observado.
- **S0/aceite:** qualificar todos os outputs/consumidores das 18 skills, 39 rotas e paridade dos oito packs no mesmo candidato, AM01–AM06, oito seleções finais, três revisões FINAL, C/G7 e D/G8.

[CRITERIA.json](CRITERIA.json) mantém os 98 IDs e textos canônicos atribuídos, com observação componente separada do estado normativo. O escopo geral permanece **15 WPs / 74 tasks / 17 contratos / 1610 critérios**. Não há conclusão global, merge em dev, deploy ou consumer ACK presumido.
