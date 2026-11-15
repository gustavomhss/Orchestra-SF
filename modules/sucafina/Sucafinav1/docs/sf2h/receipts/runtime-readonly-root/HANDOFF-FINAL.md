# Missão59 — handoff terminal para57

## Resultado e alcance

**Capability de raiz de snapshots somente leitura implementada e qualificada no escopo cirúrgico. P03 original permanece FAIL/HELD. GLOBAL_RELEASE=false.**

A entrega está na PR draft [#72](https://github.com/gustavomhss/Orchestra-SF/pull/72), branch `runtime-read-scope`, base solicitada `sf2-stack`. O candidato material qualificado é **W2 `26f7af7efcc143d558df51eeb35e4a7011f456fe`**, tree `2d2a76b513f282214fbc0fca67053c1146a8e18d`, sobre C27 `b10c424a6b318879fc30f11d03ba1cfeffda7d1a`. Os commits posteriores acrescentam evidência e encerramento, sem mudar os nove arquivos do bundle.

A publicação do commit que contém este handoff encerra a autoridade de escrita59. O SHA/tree terminal exato é confirmado pelo readback remoto e informado na descrição da PR72. Nenhum ACK de consumo é presumido.

## Contrato congelado antes da implementação

```ts
Persistence.readSnapshotRoot?: <T>(
  work: () => Promise<T>,
  options?: TransactionOptions
) => Promise<T>
```

O contrato está em [CONTRACT.json](CONTRACT.json), publicado em `40d8d047977225fd3bc6ba877c1ace047c5fbf64`. O [adendo de dispose](CONTRACT-ADDENDUM-01.json), em `c0d2094357a8566d3a1329f0ec2dab70378d1892`, foi congelado antes do edit correspondente.

A capability fornece somente o escopo interno de snapshots. A admissão de negócio continua na transação canônica. O consumidor constrói o mesmo `persistence.transaction("dashboard", callback, options)`; quando disponível, executa esse `run` dentro de `readSnapshotRoot`. Na ausência da propriedade, executa o caminho anterior. Adapters legados não recebem uma promessa nova de atomicidade ou readonly.

SourcePersistence encaminha a propriedade apenas quando suportada. A sequência conserva os guards de Source e a admissão/publicação de CurrentChoiceFence tanto em Source(Fence(LocalStore)) quanto em Fence(LocalStore). Nenhuma troca de âncora, projeção de callback C08 opaco, cache de autorização ou remoção de observação/replay foi aplicada.

## Implementação e garantias examinadas

Os quatro arquivos de produto formam um bundle coerente: contrato, LocalStore, SourcePersistence e readPortfolioSnapshot. O runtime reutiliza a conexão, fila, operação SQL e infraestrutura de escopo existentes. Observa as três superfícies com SQL fresco e a ordem anterior; não cria outro store nem altera roots mutáveis sem a nova marca `readOnly`.

Somente planos imutáveis elegíveis já presentes no memo na admissão geram factories de cópias, agora incluindo Dashboard. Misses continuam usando o grafo validado privado e cópia defensiva. Cada observação produz uma cópia independente; mutações descartadas não se tornam estado armazenado ou compartilhado.

Tentativas de commit, transactionAll, blob e secrets writes recusam e envenenam o root mesmo quando a exceção é capturada. O adendo cobre também tentativas depois de dispose: a recusa de uma nova escrita/admissão não pode virar sucesso por ter sido capturada. Abort, readers não concluídos, handles expirados e geração de escopo continuam cercando o retorno. O finally fecha o escopo e solta referências privadas; a publicação final do helper ocorre depois da resolução válida do root.

Os limites de materialização continuam: até três planos e 8.388.608 unidades UTF-16 compartilhadas, equivalentes a16 MiB de conteúdo string; um root pode reter no máximo um orçamento inicial adicional durante substituições do memo. Roots aninhados são recusados antes de uma nova admissão. Permanecem os limites de otimização de profundidade128, nós200.000 e caminhos undefined4.096 com fallback. **Isso não é um limite de heap total, grafos decodificados, alocações temporárias ou cópias retidas pelo chamador.**

## Testes e medições reais

| Execução | Candidato/snapshot | Resultado |
|---|---|---|
| R1 obsoleto | W1 `ba393316f7c7350cdd519068808baafb7edb2393`; S1 `4e9c34e38bea4e9c6ed34595ea70c6e1edf6d946` | cancelled;66 PASS lines e5 timeouts observados em10 cabeçalhos, sem resumo final do Bun; excluído; cleanup PASS |
| R2 conformance/regressões | W2; S2 `8ac14c407824626adbe53f8eeec82d6572ee1630` |130 PASS, 0 FAIL, 25.064 expect calls, 15 arquivos, 4,38s; cleanup PASS |
| R3 P03 original | W2; S3 `27a8cf1e9478f7647e884caf6d9315332b6bbc24` |0 PASS, 1 FAIL, 1 error, 24 expect calls; caso180009,39ms; cleanup PASS |

R1 tinha um defeito na ordem de barreira/matcher de um teste novo: o Bun fixado espera a Promise no matcher antes da liberação que permitiria concluí-la. W2 move essa expectativa para depois da liberação, sem modificar oracle ou timeout; os quatro blobs de produto continuam idênticos aW1. R1 é preservado e excluído da prova do candidato corrigido.

[R2](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43665988509) executou64 casos novos e66 regressões existentes, sem filtro por nome. Usou SQLite e wrappers reais, cobrindo metadata parcial/corrompida, guards das três superfícies, identidade/instalação/projeto, publicação, SQL fresco entre conexões, payload substituído/deletado/corrompido, isolamento e mutação, writes capturadas, abort/readers/dispose, capabilities expiradas, codec/fallback e regressões Finance34/56. A lista exata e contagem por arquivo constam de [R2-result.json](ci/R2-result.json).

### Discriminante equivalente

No mesmo driver SQLite e wrappers, o adapter legado omite apenas a propriedade opcional. Cada variante preserva25 callbacks,6 observações explícitas,27 autorizações e27 revalidações instrumentadas, mesmos digests de ordem/eventos e6.720 linhas consumidas. Os payloads SQL mantêm seus hashes antes/depois.

| Medida | Legado | Capability |
|---|---:|---:|
| Chamadas de descritores no probe interno |21.582|0|
| Objetos Dashboard marcados percorridos |10.560|0|
| JSON.parse no probe interno |120|186|
| Caracteres processados no parse |2.607.840|4.042.152|
| Mediana nativa, quatro pares AB/BA |63,0606ms|50,7853ms|

A diferença descritiva entre medianas é12,2753ms, ou19,4659%, nesse workload/runner. O parsing cresce55%; o benefício vem da troca do percurso defensivo por materialização nativa, sem alegação de redução de toda CPU, alocação ou trabalho interno. Tempos nativos abrangem a chamada completa. Somente os probes estruturais excluem admissão/publicação. Não foi instrumentada contagem de queries SQL nem medido heap.

[Os dados completos](findings/R2-COST.json) e a [qualificação anterior ao P03](findings/MATERIAL-QUALIFICATION.json) preservam amostras, hashes, trabalho e limites.

## P03 permanece aberto

A prova segura/material foi publicada antes da única tentativa59 do [P03 original](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43666746009). O teste mantém o blob `47b5358c8dda3179045499388ce98871576a2aa9`, o arquivo/fixture integral, as72 linhas de expect, a ordem e o prazo individual180000ms. O argumento CLI120000ms não substitui esse override individual, confirmado pelo timeout real.

A tentativa excedeu o prazo original e falhou por timeout, com recusa `stale / portfolio-analysis-changed` observada após `evaluateAndStore` e throw na linha50. As24 chamadas de expect incluem helpers/fixture; não equivalem a24 das72 assertions qualificadas. As etapas posteriores de escolha, treinamento confirmado, histórico/ChoiceRecord, replays e revogação não foram qualificadas.

O último checkpoint armazenado não identifica a função em execução no deadline. A recusa tem múltiplos produtores nos arquivos anteriores e não comprova mutação real, regressão semântica, causa exclusiva ou avanço de fase em relação58. As medições inclusivas não podem ser somadas como CPU. O original P03 recebe LocalStore diretamente; a qualificação dos wrappers vem deR2.

O benefício medido no discriminante é insuficiente para fechar P03. Permanecem íntegros o [resultado atual](findings/P03-RESULT.json), o diagnóstico58 e as propostas rejeitadas. **Não houve segunda tentativa59 do P03.** Outro ciclo exige nova mudança material qualificada e titular explicitamente autorizado.

## Bundle e forma de intake

O [manifesto](delivery/MANIFEST.json) fixa os nove paths, modos, preimages/postimages, Git blobs e SHA256. Os [patches completos de produto e testes](delivery/source-and-tests.patch), [patch de produto](delivery/product.patch) e [reconstrução](delivery/patch-check.json) permitem aplicação seletiva com comparação de preimages. Os quatro pre/post de produto estão anexados integralmente.

A [closure estática](delivery/dependency-closure.json) resolve36 edges relativos para15 destinos, fixa16 dependências/âncoras e27 identidades de configuração. Não há novo import de runtime em produção; há um import exclusivamente de tipo de TransactionOptions, em product/portfolio/read-snapshot.ts, vindo de runtime/contract.ts no mesmo bundle. Não há pacote novo, lockfile novo ou workflow novo.

Consumir os quatro arquivos de produto coerentemente e preservar os cinco testes/fixture e suas dependências C27. **Não substituir o tree do stack pelo tree W2.** A closure não alega leitura recursiva de todo o repositório nem substitui compilação/composição.

## Autoridade, gates e próximo responsável

O ACK59 reconciliou56 e58 explicitamente encerradas e57 em seu terminal `d6d9816bb09f7595330862616305e0791e23e61e` antes da implementação. O pedido desta sessão dirige o handoff e o ACK de consumo à57.

Durante a execução, o controle externo passou a publicar a missão60 como sucessora da57. O censo final observou o stack em `faa30fddb7e7b61696b66fd069f51cf18c51125f`, com a própria60 também explicitamente encerrada; o material continua C28 `d088708276b48f896ad4e0ecd2a95cb73dc413b1`. O avanço final contém somente30 receipts de integração, sem novos edits de produto. A [reconciliação](reconciliation/CONTROL-AND-STACK.json) fixa os documentos e registra essa sucessão observada para S0/integrador, sem atribuir à59 autoridade sobre o stack nem inventar ACK de aceite. No stack observado `d088708276b48f896ad4e0ecd2a95cb73dc413b1`, os quatro preimages e as16 âncoras conferidas continuam C27. Isso não transfere o PASS deW2 para a composição posterior.

A45 conserva compile/generation/guards. [REQUEST45](checks/REQUEST-45.json) fixa W2 e dev `a1d37698a7bb097c1578f827eba6a19b9917ef07`; typecheck/guards permanecem REQUESTED/NOT_RUN até prova real de45. Sem mudança de Protocol/Atlas nesta entrega. As [revisões delimitam autoria e independência](reviews/QUALIFICATION.json); não substituem as três revisões FINAL da campanha.

O próximo titular autorizado deve tratar o custo remanescente da composição com as evidências58/59, conservando todas as observações, autorizações e replays. A atribuição do custo ainda não foi isolada neste P03. Reports48 e Decisões52 mantêm seus responsáveis; não foram abertas sessões duplicadas.

**Preservados:**15WPs,74tasks,17contratos,1610critérios eT0 `2026-11-13T04:01:10Z`. Sem testes locais de produto, heavy checks, epic, nova plataforma, edits em análise/produção/criterion-comparison/result-store/C08, mudança financeira, stack write, dev merge ou deploy. `GLOBAL_RELEASE=false`.

O [ledger final](ci/LEDGER-FINAL.json), a [liberação de fonte](CONSUMER-RELEASE.json) e a [autoridade terminal](AUTHORITY-FINAL.json) fecham este pacote com os estados remotos efetivamente observados.
