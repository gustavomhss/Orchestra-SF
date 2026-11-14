# Missão30 — handoff terminal de admissão nativa de Rotinas

**Implementação publicada na mesma PR30 / astra-wp09. Composição e aceitação nativa: HOLD. AM06: NOT_RUN.**

O produto fonte avaliado é **`7676fd9173015e2c7d7c91745cc486f50018fc85`**, tree **`bade962f294c3dc3504c97388c780c8bc8b9be24`**. O commit que contém este handoff é a entrega D, filho de W, com somente recibos; nenhum código ou teste é alterado depois da evidência de W. Os SHAs dos snapshots de CI identificam envelopes, não candidatos de produto. O head D exato é informado no retorno final após leitura do remoto.

Foram implementados os nove métodos de `SfRoutineNativePort`: `resolvePlan`, `resolveRecipe`, `prepare`, `readAdmission`, `readRun`, `start`, `listRunRefs`, `readExecution` e `readArtifact`. Os sete arquivos próprios usam Task/Relay e os registros nativos existentes; não há ledger paralelo nem criação de run IDs. A montagem completa está entregue como patch consumível pela **sessão23**, sem editar o host compartilhado.

## O que o consumidor recebe

- [Implementação e decisões](implementation.md): binding de Request/owner/caso/fontes/publicação, admissão e dispatch governados, cancelamento/revogação e recibo terminal factual.
- [Matriz de critérios e métodos](criteria-evidence.json): texto integral dos cinco predicados da missão, fontes reais, testes e limites por método. Os 112 estados do handback anterior não foram reclassificados.
- [Manifesto dos arquivos](candidate-manifest.json) e [proveniência de dependências](dependency-provenance.json): blobs, SHA256 e contratos efetivamente inspecionados.
- [Montagem para sessão23](assembly/README.md): [patch completo](assembly/host-context.patch), [preimage integral](assembly/host-context.preimage.txt), [postimage integral](assembly/host-context.postimage.txt) e [hashes](assembly/manifest.json).
- [Registro terminal estruturado](terminal.json) e [tentativas de CI](ci-attempts): histórico completo das três revisões, inclusive falhas.

## Autoridade e insumos

| Insumo | SHA |
|---|---|
| Missão/COMMON | `5b00bd553781f437586177247b8a726aafd8ee59` |
| Planejamento fixo | `dbf9547211d9b0fade619790de7c19c0869b7c7d` |
| Head predecessor reconciliado D0 | `1998acb0dcb59e68d41ee924eca4737bccbd5148` |
| Bundle inspecionado / alvo de montagem | `9cc27888581a13b55992cdb5dfbd27e43479ac29` |
| Harness/requisitos nativos | `8a776484bb17ac0c83ae2eb56ddcfb2fad73aa35` |
| Base dos guards origin/dev | `a1d37698a7bb097c1578f827eba6a19b9917ef07` |

AGENTS, COMMON, pack S3 completo e anexos foram lidos. O lease é `routine-native-browser30`. A publicação mantém branch/PR e usa compare-and-swap; a sessão23 continua proprietária da composição. Nenhum engine, Schedule, contrato público ou host compartilhado foi editado.

## Resultado de CI — atribuído aos SHAs que realmente rodaram

| Produto / seleção | S de teste | Run / job | Resultado |
|---|---|---|---|
| W1 `f3b97d4ff68d69fccbdf286dd66767c1d5fceae5` — seis arquivos | `400365533b0bdfbf7f3c757caf74925bf3ffdf9d` | [run 43643105285](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43643105285) / `132594802593` | **FAIL:** 2 pass, 6 fail, 5 errors; falhas de imports e fixture |
| W2 `1fe2e77f8cb70ff9f8fd0195efcc4792ebf6cadd` — seis arquivos | `67cb97d12e2b3f93597edd0b50c2f7f7fd07164c` | [run 43643528434](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43643528434) / `132596076058` | **FAIL:** 30 pass, 1 fail, 31 testes, 193 expect; reader aceitou versão negativa de fonte |
| W3 `7676fd9173015e2c7d7c91745cc486f50018fc85` — somente retained-input.test.ts | `fb99f1ffa199c944824c470215106d6f3d70bb1e` | [run 43644021520](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43644021520) / `132597666375` | **PASS:** 3 pass, 0 fail, 3 testes, 27 expect |

W3 corrige o reader com a mesma regra de versão do contrato: inteiro seguro maior ou igual a zero. Os testes e os outros seis arquivos de implementação são idênticos aos de W2. Os outros 28 testes passaram em W2 e não foram repetidos sem necessidade. **Não há alegação de 31/31 executados em W3.** Os envelopes e seleções foram deduplicados por produto e request normalizado; cada diff W→S contém somente o envelope permitido.

| Check de W3 | Evidência | Resultado |
|---|---|---|
| `bun typecheck`, modules/sucafina | S `f8c20a57dae345d45ada1a42ef38233d24668c13`; [run 43644025753](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43644025753) / job `132597678493` | **FAIL:** 78 diagnósticos externos e **0 próprios** |
| `bun run check:guards --base origin/dev` | Mesmo check hospedado | **PASS:** 78 regras, 682 caminhos, 0 gates, 13 avisos, 0 erros |

Os 78 blocos externos são idênticos em W1/W2/W3 após remover somente timestamps; SHA256 normalizado `d446e1dbf2d8dfd438a6dece288a12a306e2687fb52d3a89165150fb54ca5f37`. Essa comparação não converte o package em green nem autoriza editar arquivos estrangeiros. A tipagem é a do package Sucafina, que alcança os imports próprios do CLI pelos testes; não houve compilação separada da postimage do host compartilhado.

Os dois gates intermediários W2 eram logs brutos no repositório, recusados pela regra `agent-scratch`. W3 removeu os dois arquivos e preservou URLs, resultados e metadados em JSON. Nenhuma regra, timeout, fixture de autoridade ou asserção foi enfraquecida. O artefato de check final é **14132828052**, `astra-wp09-check-1`, **5528 bytes**, digest **`sha256:73c6ffb983f1800bf6a1d2d3836554bfbd45443c77a7f6480a8894ca904e7cb8`**; metadados e logs do job foram lidos. O ZIP foi obtido pelo GitHub MCP; seu conteúdo interno e o hash dos bytes baixados não foram inspecionados. Tamanho/digest foram conferidos entre metadados e log de upload. Expiração informada pelo GitHub: `2026-11-28T21:41:36Z`.

Os testes usaram schemas e serviços reais quando disponíveis, com entradas e cadeias persistidas sintéticas explicitadas. Eles não fizeram aprovação humana, provider, execução terminal Relay ou retorno real ao caso após reload. O controle omni é **not applicable**; não há prova de spawn. Todos os testes e checks de produto ocorreram somente em Actions, pela interface existente.

## Montagem e recursos ainda necessários

O alvo do patch é o host do bundle `9cc27888581a13b55992cdb5dfbd27e43479ac29`: preimage **`bdf6d4e2014cc9b2a492b6ae304948c249221e39`** e postimage **`2bf1e6e66c13dd099029ec16b1f1ddf1f698dae6`**. O host antigo da PR30 tem outro blob e não deve ser sobrescrito. A sessão23 deve comparar o head atual e reconciliar os hunks, preservando as demais composições.

A entrada privada `createSfHostRuntimeWithRoutineNative` recebe o **registry real que liga a Request autenticada à Session nativa do Maestro e a uma chamada Task já gravada**. Esse recurso não está disponível no host inspecionado. O patch e o adapter não fabricam esse vínculo. Sem ele, Rotinas permanece indisponível; com os recursos instalados, a montagem anuncia no máximo cinco operações Task. `sf_watch_prepare` continua ausente porque `memory.prepareWatch` não fornece admissão Schedule nativa.

Também continuam necessários: publicação/plano reais com `SF_ROUTINE_INPUT`, fontes e caso atuais, review/aprovação humana/arm governados, provider autorizado e checkpoint/audit/artefato terminal efetivos. Receitas que exigem conhecimento upstream permanecem sujeitas a `SF_ROUTINE_KNOWLEDGE_PORT_UNAVAILABLE`. Não há suporte inventado a background ou cancelamento tipado; o resultado entregue pelo código é um recibo factual Task/Relay, sem texto de modelo apresentado como prova.

**Pedido de ACK à sessão23, registrado neste recibo:** confirmar SHAs/blobs consumidos, reconciliação do preimage, ordem de montagem, registry de owner efetivamente instalado e resultado da validação composta. Aplicação, ACK e AM06 não foram observados nesta missão. O próximo passo é consumo e validação pela sessão23, seguido da aceitação nativa por S0.

**AM06 não comprovado. Nenhum GLOBAL_RELEASE.** A implementação e o handoff estão entregues; a integração e a aceitação nativa permanecem pendentes. Não houve merge, deploy, credenciais, reinício, novo controller/supervisor ou mensagem a terceiros.
