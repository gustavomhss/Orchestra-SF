# S0-B — preparação das provas nativas AM01–AM06

**Preparação publicada; AM01–AM06 NOT_RUN.** Consumidor: S0 para integração e, posteriormente, owners/revisores do mesmo candidato C aceito. Este handoff não é recibo de execução nativa, aceite do produto ou uma das três revisões finais.

## Publicação e autoridade

- Repositório: `gustavomhss/Orchestra-SF`; branch existente `astra-wp00`; [PR20](https://github.com/gustavomhss/Orchestra-SF/pull/20), mantida aberta e draft.
- Head/base reconciliada da missão: `0a5ce33012d008af1f56d11596a1f1f4eaba5b9d`, árvore `a627a2deff7f5d74e35a8b9afef06fa0f67362bd`.
- Commit de preparação: [`5934d0f7f0b32e1d5b4a3719a543ecf1f39b48c4`](https://github.com/gustavomhss/Orchestra-SF/commit/5934d0f7f0b32e1d5b4a3719a543ecf1f39b48c4), árvore `21b2b2c7a1b5672bf6b0b377b4e8b7020078105d`, filho direto da head reconciliada.
- Publicação por GitHub MCP, com `expected_sha` e `force: false`. Os 34 arquivos do commit foram conferidos por namespace no GitHub contra os blobs locais. O manifesto completo está em [publication-5934d0f.json](./publication-5934d0f.json).
- Este handoff e o manifesto arquivam a publicação anterior. Não atribuem execução de testes a um commit posterior de documentação.

A escrita ficou restrita a `script/sf2h/native-acceptance/`, `modules/sucafina/Sucafinav1/test/product/native-acceptance/` e `modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-acceptance/`. Não houve branch/PR nova, merge, force push, mensagem externa, edição de host/runtime/engine, alteração de alçada ou reinício de desktop/server. O handoff terminal anterior da PR20 e os commits posteriores ao planejamento foram preservados.

## Fontes fixas e leitura

COMMON, missão e `artifacts/pinned-am-proofs.json` foram lidos em `c708ec0609dbfc95b259707d8c38481617f74f11`. AGENTS, execution/COMMON, o pack S0-B completo em `dbf9547211d9b0fade619790de7c19c0869b7c7d`, os anexos aplicáveis e as fontes WP10/WP12/WP14 foram inspecionados. O trabalho delegado cobriu partes do mesmo pack; não carregou atribuições de outros atores para ampliar write authority.

`pinned-am-proofs.json` mantém o blob publicado `8f79a4e04367b4e7d89d04dc422c0e6742297d80`. `coverage.json` mantém as duas camadas AM01–AM06, todos os positivos/negativos, consumidores, campos de recibo, perfis/skills/packs/rotas e regras residentes. O envelope de evidência do S0-B também foi preservado integralmente: 48 campos, estados permitidos, validade e não aplicabilidade com motivo explícito.

| Insumo de reuso | Pin / reconciliação |
| --- | --- |
| WP10 | Missão `90f2c4f81f74edc26a1783bfda7891638b429fa6`; head observada `54317229d7f8fcb7e92921c2f4a8dc6f9310270b`; APIs usadas reconciliadas |
| WP12 | `ba27411a7cda9301aa162680a94153a5e643be4d` |
| WP14 | `f8031d7c54ec2fa06359156dc0b6462c3a248633` |
| Baseline dos recibos nativos | `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf` |
| Campaign SHA256 | `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba` |

Uma coleção de heads de origem não é C. Nenhum candidato aceito foi observado ou criado por esta preparação.

## Entrega utilizável

O [runbook](https://github.com/gustavomhss/Orchestra-SF/blob/5934d0f7f0b32e1d5b4a3719a543ecf1f39b48c4/script/sf2h/native-acceptance/README.md) contém comandos e sequência do owner. A CLI pode ser executada para preparar o plano, inspecionar fontes/capacidades, emitir template, verificar captura e validar a request de CI. O adaptador de host é consumido em memória pela instalação existente.

| Prova | Cobertura preparada | Estado |
| --- | --- | --- |
| AM01 | 5 perfis, 18 skills; carga/execução/consumo após reload; duas revisões independentes; 129 checks | NOT_RUN / NEEDS_HOST |
| AM02 | 8 packs, 39 rotas; UI/native/MCP, C16, recibos de carga, negativos diretos e consumidores; 98 checks | NOT_RUN / NEEDS_HOST |
| AM03 | Isolamento, revogação, cancelamento, leases e ciclo real de provider/generation; 12 checks | NOT_RUN / NEEDS_HOST |
| AM04 | Escolha, Apply, ledger/idempotência, conflito/parcial e perda após commit; 8 checks e 7 passos | NOT_RUN / NEEDS_HOST |
| AM05 | Atlas, scanner, quatro artefatos, AST/guard, persistência e restart real; 19 checks e 13 passos | NOT_RUN / NEEDS_HOST |
| AM06 | C07, Relay/Schedule, admissão, run/version/checks e retorno ao produto; 12 checks e 10 passos | NOT_RUN / NEEDS_HOST + lacuna de composição |

São 12 definições preservadas e 278 observações canônicas, sem exigir uma execução por frase. `request-inputs.json` fornece 18 fluxos de skill, 39 payloads fechados de operação, 278 hooks com `check_id` e os 17 recursos não resolvidos. Os recursos apontam explicitamente para os 17 requisitos de preflight por uma relação muitos-para-muitos.

O código chama APIs existentes. Preserva Requests/bindings reais, termina leases, revalida autoridade após awaits e bloqueia retry automático. O gate final depende de verifier S0 e correspondência do commit/tree instalado ao C aceito. A CLI não expõe disparo final/epic nem flag que simule aceite.

`validate-capture` exige vínculo entre recibo original, carga, run/Session, output e consumidor, evidência de UI real, base/caso observados separadamente e hashes dos arquivos. Respeita o `outputRef` opcional dos resultados de capability. Mesmo uma captura completa fica `CAPTURE_COMPLETE_PENDING_INDEPENDENT_REVIEW`, com `nativeAccepted: false`.

## Validações efetivamente realizadas

Os arquivos em [preparation-20261114](./preparation-20261114/) registram fontes, hashes, comandos e limites. Nenhum resultado abaixo é teste funcional nativo.

| Verificação | Resultado observado |
| --- | --- |
| Igualdade com fontes fixas | 12 definições, 5 perfis, 18 skills, 8 packs, 39 rotas, regras residentes e envelope da campanha preservados |
| Mapeamento de hooks | 278/278 ponteiros, textos, proof IDs e consumidores conferidos; recursos resolvem os 17 IDs de preflight |
| Análise sintática | 9 arquivos TypeScript analisados com Node `v24.22.1`, sem importar/executar módulos de teste |
| Integridade de fontes | 30 cópias iniciais e 19 fontes presentes do inventário verificadas por blob Git; 35 fontes/manifests adicionais do registry canônico de CI conferidas |
| `prepare` | `PREPARED_NOT_RUN`, exit 0, `nativeAccepted: false` |
| `preflight` sobre projeção verificada da PR20 | `NEEDS_HOST`, exit 2; 17 capacidades pendentes; 16 fontes esperadas ausentes; 9 das presentes diferem dos pins de reuso |
| Request de CI | `REQUEST_VALIDATED_NOT_DISPATCHED`, exit 0, `omniControlScope: declared` |
| Publicação | 34 blobs conferidos no GitHub; atualização apenas da branch existente, com compare-and-swap |
| Testes de produto / provas nativas | **0 execuções; NOT_RUN** |
| Package typecheck / guards | **NOT_RUN** |

O preflight tem 29 paths de reuso: 13 presentes na head fonte, dos quais 4 iguais aos pins e 9 diferentes; 16 ausentes. Ausência/diferença indica necessidade de integração/reconciliação, não falha observada do produto instalado. A head da PR20 não contém automaticamente as implementações posteriores das outras lanes.

A primeira tentativa de preflight usou somente o diretório de arquivos novos e encontrou 29 ausências. Ela permanece arquivada, com esse escopo explicitado no [índice de tentativas](./preparation-20261114/attempt-index.json). O preflight posterior usa a projeção de fontes obtidas no GitHub no SHA fixo e prevalece para a análise da head. Nenhuma tentativa anterior foi apagada ou relabelada.

## NEEDS_HOST: operação, recurso e owner

O registro exato, incluindo evidência necessária e próxima ação de cada ID, está em [host-requirements.json](https://github.com/gustavomhss/Orchestra-SF/blob/5934d0f7f0b32e1d5b4a3719a543ecf1f39b48c4/script/sf2h/native-acceptance/host-requirements.json). Os bloqueios principais são:

| IDs | Operação / recurso ausente | Owner responsável |
| --- | --- | --- |
| `shared.host-placement`, `shared.authority` | Instalação acessível, identidade/Location/build reais, Request autenticado, contexts/leases atuais e controles isolados de revogação/provider | WP10.T01, WP10.T06 e owners de autoridade listados no JSON |
| `shared.model`, `shared.observer` | Modelo/provider existentes; 18 descritores e pares das 39 rotas; carga e provider turn; wrapper/bridge privados executáveis; consumidor e UI observados | WP10.T06, WP12 e owners/consumidores específicos de cada skill/rota |
| `am04.*` | Escolha/Apply reais e barreira entre commit de domínio e reconciliação; idempotência/recuperação deliberadas | WP11/WP14 e owners de domínio listados no JSON |
| `am05.scanner`, `am05.durability-restart`, `am05.commit-failure-loss` | Binário real com versão/digest; controles isolados de timeout/ausência/commit; restart em processo distinto | WP10.T07 e owners Atlas/host listados no JSON |
| Demais `am05.*` | C08, ACL/caso/fontes, documentos/evidências/downloads, quatro artefatos, AST e guard/allowlist | WP10.T07, WP06.T05, WP07.T04 e consumers do contrato |
| `am06.native-admission` | `SfRoutineNativePort` instalado e caminho C07 real; a composição inspecionada de `createSfRoutineServices` não fornece `.native` | WP10.T01 e WP09.T07 |
| `am06.return-retry`, `am06.recursion-schedule` | Run/version/checks reais, retorno ao caso, Schedule/recorrência/cancelamento/revogação | WP09.T06, WP09.T07, WP12.T04 e owners exatos do JSON |

A descoberta de tools não expôs Orchestra/SfHostServices/SessionV2 nativos. Desktop Commander listou `MacBook-Pro-de-Gustavo.local` **Offline**. Não houve acesso ao dispositivo, aquisição de credencial, chamada de modelo ou suposição de localhost. A ausência de acesso foi registrada separadamente da lacuna de código Routines, que bloqueia AM06 e as seis rotas Routines AM02 mesmo antes de uma tentativa nativa.

O endpoint público `choices` inspecionado oferece dois pares profile/skill. Os outros pares dependem de oferta real/registry instalado. HTTP read/output não expõe todo o envelope nativo, portanto o observador privado permanece necessário. Descartar uma resposta HTTP concluída também não substitui a barreira de perda AM04.

As factories sintéticas do WP12 e o recibo WP14 com `nativeSessionWitness: false` permanecem classificados como fixtures/componentes. Não foram usados para fabricar principal, grant, provider ou aceite nativo.

## CI e gates não executados

A request cirúrgica seleciona somente `Sucafinav1/test/product/native-acceptance/preparation.test.ts`, package `sucafina`, com `ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER=strict`. Foi validada pelos `validateRequest`, `locateTestPackage` e `omniControlScope` reais, com checagem de arquivos e registry reais. Não existe run/job/snapshot associado.

AGENTS exige testes de produto no GitHub Actions. O fluxo canônico cria `ci-run-*`, mas a instrução desta missão proíbe outra branch. Por isso **não foi disparado CI** e não foi criada alternativa de workflow ou filtro. A execução de CI depende de S0/owner resolver essa restrição de forma autorizada. Mantida a restrição, o estado permanece `NOT_RUN`.

Não há Bun nesta máquina nem checkout Git completo para `origin/dev`; `bun typecheck` e `bun run check:guards --base origin/dev` não foram executados. A análise sintática não os substitui. Não foi usado `tsc` direto, override de testes locais ou green de outra lane. Epic/full suite e provas finais também não foram disparados.

## Próximas ações do consumidor

1. **S0:** integrar/reconciliar as fontes necessárias em um único candidato, resolver especialmente o port nativo de Routines e qualificar os gates de código. Esta preparação não modifica as lanes de origem.
2. **Owner da instalação:** disponibilizar a superfície já autenticada, Location/build, modelo/provider e controles reais descritos no preflight. Resolver inputs em memória, preservando authority e dados protegidos; não preencher `null` com identidades ou resultados inventados.
3. **Owners de prova:** usar o runbook e os hooks para executar somente as ações autorizadas. Capturar carga/execução/consumo, positivos/negativos, UI, restart/scanner e consumidores do mesmo candidato. Pré-provas continuam separadas do aceite final.
4. **S0 e revisores:** verificar C aceito antes do modo final; examinar as evidências reais e as três revisões finais do mesmo C. Completar critérios aplicáveis, justificar não aplicabilidade e manter recibos append-only nos namespaces permitidos.

Não há execução nativa em voo nem worker/supervisor criado por esta preparação. O próximo passo depende das capacidades e da integração acima, com todo o trabalho independente publicado na PR20.
