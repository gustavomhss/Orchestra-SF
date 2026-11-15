# Missão 46 — handoff terminal CURRENT-CHOICE-COHORT

**Fonte implementada, qualificada e liberada para integração seletiva pela sessão 42.** A entrega permanece na [PR #35](https://github.com/gustavomhss/Orchestra-SF/pull/35), branch `astra-finance`. O aceite do composto e o dispatcher final continuam com S0.

Fonte final **W4 `1330fdc580d675bba3202bdad5e26c16c54c4559`**, tree `73beb3558437a2b8671f7d88aad4332304af2d75`. Os três arquivos de produção permanecem exatamente como publicados em W1; W3 corrigiu a composição do teste do produtor e W4 preservou os dois casos adicionais de C12. Este handoff e os recibos finais são publicados em um filho documental de W4, sem alteração desses blobs. O comentário terminal da PR registra o SHA desse filho.

## Autoridade e preservação

A reconciliação partiu do HEAD exigido `ec052c2c3bef96f492512f3d5f663919580f25c8`, conferiu o handoff predecessor terminal (blob `6d98dc8dac07ae2e6342080cc801840b1e7749b0`) e os registros de autoridade. O [ACK](ACK-46.json) foi publicado antes da implementação em `90920c34546517baad267b3ee93705f7fc1016a3`, com [comentário na PR](https://github.com/gustavomhss/Orchestra-SF/pull/35#issuecomment-6885491153). Não foi observado outro ACK vigente do cohort nos registros consultados. Essa observação de Git não constitui telemetria de sessões externas.

Root foi o único writer remoto. Três auxiliares produziram drafts locais exclusivos ou revisão independente. Todas as operações remotas usaram GitHub MCP e os avanços de refs usaram CAS com HEAD esperado, sem force. O epoch `current-choice-browser46` termina com esta liberação; nenhuma nova escrita de fonte fica em andamento.

O plano `dbf9547211d9b0fade619790de7c19c0869b7c7d`, T0 `2026-11-13T04:01:10Z`, acceptance digest `32205922d4a3a2417d5413c232bf892769b3c8fa95045434a0461b030ba081c4`, contratos, histórico anterior e GLOBAL_RELEASE foram preservados. Não houve edição de engines, políticas, `sf2-stack`, merge em dev ou deploy. Modelo efetivo e identidade de sessão browser/native permanecem sem recibo verificável; não foi inventada uma prova de Goal, provider ou execução nativa.

## Implementação entregue

**Preparação e produtor.** A admissão precisa pertencer ao comando humano exato. O fluxo verifica escolha/caso/alternativa, usa emissão e continuidade de fonte e ressimulação do Planner canônico, persiste pelo result-store real, reavalia a cobertura canônica e registra o vínculo privado entre cenário, resultado, produtor, cobertura, fonte e revisão do caso. A cobertura é fixada tanto pelo digest da resolução canônica quanto pelo registro privado completo. Ausência continua indisponibilidade ou resultado condicionado; não é convertida em zero.

**Fence conjunto.** `createCurrentChoiceFence` é uma capacidade privada criada sobre o driver real, antes do source lifecycle, da autoridade e dos produtores. O escopo retém o objeto Request original, seu conteúdo relevante, o contexto admitido, a identidade do comando e o binding de autoridade. Após os últimos awaits do callback canônico de persistência, o host real é revalidado e os snapshots das três superfícies são capturados novamente. A comparação de autorização, snapshots e observers síncronos ocorre antes da devolução ao driver e no egresso do fluxo. A recaptura é necessária porque o driver devolve observações destacadas; comparar a cópia antiga consigo mesma não fecharia a janela.

**Promoção e replay.** A promoção exige outra ação humana explícita com o payload exato revisado. Uma transação C08 incrementa o caso/alternativa e persiste o novo resultado/recibo, mantendo o array e os bytes das escolhas históricas. Replay verifica novamente proveniência, fonte atual, resultado histórico, cobertura vinculada, recibo e autoridade, sem duplicar efeito. Ele é válido enquanto o caso continua exatamente na revisão promovida; mudança posterior torna a solicitação stale. Bindings históricos sem os novos digests não concedem promoção automática: uma preparação autorizada precisa produzir o vínculo atual.

A atomicidade comprovada é a da **transação final de promoção**. Escritas privadas canônicas, realizadas e autorizadas em etapas anteriores de produção/cobertura, podem permanecer após uma falha posterior. Não há promessa de transação global do fluxo nem de aplicação automática em Planner, Procurement ou aprovações PR/PO.

## Código e blobs exatos

Todos os caminhos abaixo têm prefixo `modules/sucafina/Sucafinav1/`. O [manifesto de integração](integration-pins-final.json) contém preimages da fonte/C12/candidato, dependências e qualificação por blob.

| Caminho | Blob final |
| --- | --- |
| `product/decisions/current-choice-preview.ts` | `db487cd1b6263835302e9bcf80499d18531aa592` |
| `product/decisions/current-choice-promotion.ts` | `6333d208823355d26b2c02259859a13e0eae9b19` |
| `product/planner/current-choice.ts` | `349d7bb7bde86d8e4fc8e605a9c981ff4b0ab6ae` |
| `test/product/wp11/current-choice-lifecycle.test.ts` | `b2f96bec220a6ec2f674057546541d5a700e969e` |
| `test/product/wp11/current-choice-read-fence.test.ts` | `e3b25caeece77ca1d755bc64e8253ca003179793` |
| `test/product/current-choice-cohort/real-authority-fixture.ts` | `dd5c155115190cf4af4ab76ec37970e3df268253` |
| `test/product/current-choice-cohort/real-authority-read.test.ts` | `1f7e6cb2716cb2b17084ab599219f7651961e485` |
| `test/product/current-choice-cohort/real-authority-promotion.test.ts` | `2d70a19f54e4fcd7a9b2fe3fc409a1d71b4fe9c3` |
| `test/product/current-choice-cohort/real-producer-lifecycle.test.ts` | `084f7050ca7f45fe22962207f706a5e0d71e3a93` |

## Validação real no GitHub Actions

Não houve teste de produto, typecheck ou epic local. Antes de cada despacho foram conferidos runs existentes; os runs de outras lanes foram preservados. Nenhum skip ou timeout foi aumentado.

| Gate | W / snapshot S | Run e job | Resultado observado |
| --- | --- | --- | --- |
| Core do cohort, cinco arquivos | W3 `61a7a7eab8dd12e1767e9343398acea7becbff42`; S3 `d586e4d3bf4a61fcd967a2de7e13c9390770ad71` | [43653193008](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43653193008), job `132625941654` | **32 pass, 0 fail, 443 expect**, 202,01 s |
| Arquivo de leitura com quatro casos C12 | W4 `1330fdc580d675bba3202bdad5e26c16c54c4559`; S4 `7720206fb5f755b48ec8959e08fab971a0374831` | [43653791489](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43653791489), job `132627774817` | **4 pass, 0 fail, 45 expect**, 0,506 s |
| Typecheck + guardrails finais | HEAD exato W4 | [43653793969](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43653793969), job `132627781768` | Workflow **FAILURE**: typecheck externo falha; guards **PASS** |

São **34 nomes de testes distintos em dois runs verdes**, com dois casos sobrepostos. Não houve um único run de 34 testes. W4 alterou somente o arquivo de teste de leitura e documentos; os três blobs de produção e os demais testes/helpers são idênticos aos qualificados em W3. Os snapshots S diferem do respectivo W somente em `.ci-run.json`.

As requisições e comandos exatos estão em [W3-request.json](ci/W3-request.json), [W4-request.json](ci/W4-request.json) e nos [recibos W3](ci/W3-validation.json) / [W4](ci/W4-validation.json). O core usa `bun test` nos cinco arquivos enumerados, com `--timeout 120000` preexistente; o suplemento executa apenas o arquivo modificado. A declaração de timeout do lifecycle também foi preservada. Bun observado: `1.3.14 (0d9b296a)`.

### Provas discriminantes

Os testes com `createSfProductAuthority`, UI/human authority, source lifecycle, C08 e SQLite reais comprovam finalização por `ui.finish`, expiração, Request abortada/alterada, admissão renovada alheia, clones de contexto/lease/binding e mudanças de principal, autenticação, policy, instalação, projeto e host. No limite posterior ao trabalho real da promoção, onze variantes recusam o commit e conservam os snapshots completos. Commits concorrentes reais de fonte ou caso depois da primeira verificação impedem devolução de resultado obsoleto. Os contadores exigem que a corrida tenha acontecido; os negativos não passam por ausência de execução do evento.

O teste adicional combina preparação, Planner canônico, resultado, cobertura real e segunda admissão humana: produz/reexecuta `source-scenario`, componente `line:1 = 200`, subtotal conhecido 200, cobertura pending e total null, depois promove e repete sem efeito novo. Os testes de autoridade com resultados previamente semeados estão identificados como provas de autoridade; não são usados como oráculo financeiro.

O lifecycle numérico mantém escolha histórica e novo resultado através da reabertura do SQLite. Seu diagnóstico histórico `WP11_CURRENT_CHOICE_MATCHER / SF_CANONICAL_UNSUPPORTED` decorre de uma cópia de observação e o caso passou, com digests retidos verificados. Os runs focused registram explicitamente que o controle omni é **not applicable**; não existe claim de execução omni/native.

### Typecheck e guardrails

`bun typecheck`, em `modules/sucafina`, retornou **131 diagnósticos, zero nos arquivos CurrentChoice**. O multiconjunto ordenado de caminho, linha, coluna e código TS é idêntico ao predecessor [run 43599389386](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43599389386), job `132460676353`. Não se afirma igualdade byte a byte das mensagens de uniões truncadas. O [delta estruturado](ci/typecheck-delta-final.json) lista os 131 registros.

`bun run check:guards --base origin/dev` passou: **78 regras, 1.127 paths históricos comparados, zero gate, 14 warnings, zero erros**. Base `a1d37698a7bb097c1578f827eba6a19b9917ef07`, merge-base `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`. O pacote inteiro permanece sem check verde; os diagnósticos externos não foram corrigidos fora da autoridade.

Artefato final do check: ID `14137093150`, nome `astra-finance-checks-1330fdc580d675bba3202bdad5e26c16c54c4559-1`, digest `sha256:be62263747c574dbdcb2ca5caa4f57662bfec28a4316c4510a6548fd1ca14cbb`. O recibo W4 conserva URL, datas e tamanho observados.

### Histórico de falha preservado

W1 passou 31 testes. W2 passou esses mesmos 31 e falhou o novo caso no replay: o observer do teste dependia da cobertura vinculada à versão anterior do caso, corretamente recusada pelo registry após promoção. W3 separou a observação canônica de continuidade da classificação de custo, sobre a mesma autoridade/persistência real; produtor e registry continuaram canônicos, sem converter uma negativa em permissão. A igualdade exata do replay permaneceu na assertion e passou.

W2 também adicionou um erro TS de valor opcional no teste e dois gates por arquivos `.log`. W3 estreitou explicitamente o tipo e removeu os dumps do tree final. Os [resultados W2](ci/W2-validation.json), seus commits, logs originais do Actions e a evidência estruturada permanecem acessíveis; nada foi reclassificado como PASS retroativamente.

## Critérios canônicos

A [matriz completa](criteria.json) conserva os **83 IDs e textos literais** do pack WP11/S4-A, com ponteiros, testes, pins, evidência e partes não demonstradas. A classificação do escopo é: 12 verificações delimitadas, 38 contribuições parciais, 5 usos de dependências e 28 itens fora desta missão. Isso não substitui o estado canônico dos critérios nem concede PASS global.

Há prova delimitada para preservação de escolha/base histórica (`WP11.T03.CHK.01`), ausência de aprovação/aplicação automática (`WP11.INV.01`, `WP11.T02.INV.01`, `WP11.T03.CHK.02`), autoridade real e recusa final (`WP11.T01.INV.01`, os invariantes `.INV.18` pertinentes), rollback da promoção e replay sem duplicação no cohort. Registrar uma segunda ChoiceRecord, resposta perdida em transporte e consumidores de outros domínios continuam com suas jornadas próprias.

**`WP11.T02.CHK.21` e `WP11.T03.CHK.20` permanecem parciais.** O lifecycle observa subtotal conhecido 250.000 após training 40.000, com cobertura completa, porém resultado ainda condicionado e total null. Não se declarou prova do total completo 250.000, diferença −10.000, teto 15.000, mínimo 20.000, nem de toda a matriz omitido/zero/não aplicável. Nenhuma fórmula, engine ou política foi modificada para fabricar esse aceite.

## Pacotes completos para integração

O corte observado do candidato é **`08ff8221ebfd86e3ae2c55fb4687b3fb0cced87c`**. Não transferir os greens da fonte para esse runtime: driver, provider e dependências materiais são diferentes e estão pinados.

1. **[owned-cohort.patch](integration/owned-cohort.patch)**: incremento completo dos nove arquivos de fonte/teste, com [manifesto](integration/owned-manifest.json). SHA256 `e4c649eae4fdffac0b5fe72dfbb106b12d75df6a0bc04ebdd865977ae14a9ad8`, blob `9c11c83f1fa3d62b26a16f2fbd8e8e5a46c538a7`. Preserva os quatro casos C12 e a proteção de Request já existente.
2. **[mission46-current-choice-composition-v3.patch](shared-for-42/mission46-current-choice-composition-v3.patch)**: patch compartilhado completo de seis paths, com [manifesto v3](shared-for-42/manifest-v3.json) e [guia v3](shared-for-42/INTEGRATION-v3.md). SHA256 `d036ee32780f10c6e217a1608701e3de3aa520143b2b2fe03f91d87ca5a03d9f`, blob `eedf931eacfd25762feaea1ae8e35062a7fce09b`.

O v3 instala o fence na composição real, adiciona serviço/HTTP de descoberta, preparação, revisão e promoção, preserva a ação humana e verifica cada opção pronta novamente antes do egresso. Conserva as mudanças recentes de Procurement/Decisions44, inclusive a cadeia HTTP e o bloco de evidências nos controles. Os seis paths compartilhados **não foram editados na fonte desta missão**.

O v3 substitui integralmente v1/v2; não aplicar cumulativamente. Todos os patches foram reconstruídos como texto sobre preimages pinados e os blobs resultantes foram conferidos. A revisão independente verificou hunks, APIs e dependências. Estado compartilhado: **NOT_APPLIED / NOT_TYPECHECKED / NOT_TESTED**; reconstrução textual não é execução de produto ou UI.

## Pendências obrigatórias e transferência

A sessão 42 deve conferir os preimages no HEAD efetivo, integrar seletivamente o owned e o v3, compor o fence imediatamente sobre o driver real e qualificar regressões e consumidor HTTP/UI no mesmo C. A descoberta histórica exige captura protegida de Atlas e continuidade canônica; falta dessa prova continua indisponibilidade. O retry visual preserva chave/payload após falha transitória, mas seu transporte ainda requer execução integrada.

Os owners externos mantêm os 131 diagnósticos de typecheck. Os oráculos financeiros literais restantes, equivalência native/MCP, aplicação instalada, agentes residentes e todos os consumidores permanecem gates próprios de integração/S0. Não foi iniciado epic, supervisor ou controlador de campanha.

[**source-release.json**](source-release.json) encerra a autoridade de escrita desta missão e enumera os gaps por owner. [**terminal-handoff.json**](terminal-handoff.json) fornece o índice de máquina. O histórico Finance inteiro e o diretório de controle não são unidades de merge desta entrega.
