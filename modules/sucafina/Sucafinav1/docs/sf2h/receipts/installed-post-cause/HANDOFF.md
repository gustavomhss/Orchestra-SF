# Missão 79 — causa do POST instalado

**Estado: causa demonstrada no runtime fixado; proposta qualificada em composição isolada.** O [run 43675862594](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43675862594), [job 132695751973](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43675862594/job/132695751973), terminou com **11 PASS, 0 FAIL, 333 asserções, 2,97 s**. O job de cleanup 132696240217 também passou. A branch 79 contém somente fixtures e receipts próprios. A74 conserva a autoria de produção; a71 conserva a integração.

## Causa e primeira fronteira incompleta

No Bun 1.3.14, a reconstrução `new Request(existingRequest, initObject)` perde a entrega do corpo em streaming neste caminho. A instalação C34 fazia essa operação ao acrescentar o signal antes de chamar o handler. O Node e o adapter Effect já tinham recebido todos os bytes e EOF; o reader do Request reconstruído permanecia pendente.

O controle causal usa cinco POSTs novos de 28 bytes, Content-Length 28, a mesma conversão `HttpServerRequest.toWeb`, contexto, HWM, opções Node, signal inicial e consumidor `getReader/read`:

| Variante | Corpo / EOF | Resultado observado |
| --- | --- | --- |
| Request original | 28 bytes / 1 | Completo em aproximadamente 1 ms |
| `new Request(first)` | 28 bytes / 1 | Completo em aproximadamente 1 ms |
| `new Request(first, { signal })` | 0 bytes / 0 | Pendente aos 801 ms; encerramento diagnóstico |
| `new Request(first, {})` | 0 bytes / 0 | Pendente aos 801 ms; encerramento diagnóstico |
| Novo Request com URL e body explícitos | 28 bytes / 1 | Completo em aproximadamente 1 ms |

Nos dois negativos, Node 28 / EOF já estavam completos antes do cancelamento e o signal ainda estava false. O 408 é emitido pela fixture após seu deadline de 800 ms; não é resposta natural da produção. O objeto init vazio discrimina a reconstrução, sem atribuir a falha ao AbortSignal isoladamente. V1 também mostrou que HWM 0 não resolve essa reconstrução.

A [fonte Request.zig do Bun fixado](https://github.com/oven-sh/bun/blob/0d9b296af33f2b851fcbf4df3e9ec89751734ba4/src/runtime/webcore/Request.zig) explica a divergência: `checkBodyStreamRef` move a referência para `js.gc.stream` e limpa `Locked.readable`; o ramo Request + init copia o valor nativo sem recuperar esse slot, enquanto `cloneInto` recupera a referência. O [fallback de Body.Value.tee](https://github.com/oven-sh/bun/blob/0d9b296af33f2b851fcbf4df3e9ec89751734ba4/src/runtime/webcore/Body.zig) cria outro ByteStream sem o produtor original. A evidência sustenta uma divergência de transferência da referência, sem demonstrar coleta de objeto vivo pelo GC. Pins e limites estão em [CAUSE.json](CAUSE.json).

**Content-Length ausente não é a causa.** Os controles de 28 e 77 bytes usam o header explícito. A hipótese preliminar de EOF perdido no Node foi refutada por `push(null)`, `end` e `close` anteriores ao abort. No Versions C34, `identity.prepare` terminou, mas `command.body` não terminou e a transação de domínio não começou. Não houve dispatch nem persistência; a leitura reconciliatória encontrou 0 versões / 0 audit.

## Correção proposta à74

A implementação 74 existente já remove a reconstrução defeituosa: cria um Request final com URL, body e signal, conservando backpressure e seu limiter incremental. V1 demonstrou POST 28 e Versions 77 concluídos nessa implementação. Nenhum adapter adicional de data/end foi adotado.

V1 revelou uma lacuna separada de cancelamento: o disconnect rejeitava o reader, mas não abortava o signal do Request final. A delta qualificada compõe `Node.aborted` com o signal Effect, preserva a identidade do Request e mantém um guard de erro até close para cobrir erro enfileirado após cancelamento. O finally cobre os retornos e throws; close/fallback removem listeners de forma idempotente. End/close normal não provoca abort.

- [Manifesto completo, pre/postimages e dependências](fix-proposal/MANIFEST.json).
- [Delta mínima contra o transporte 74](fix-proposal/abort-signal-delta.patch.txt): instalação `8a62babdccaa4bcecbfc64e385b728315208a7c1` → `34d74d6651031c5194db1d22c823baae60e9a260`.
- [Patch completo contra C34](fix-proposal/complete-C34.patch.txt): instalação, helper 74, interface HTTP 74, mapa ativo Microsoft e lookup da fixture.
- [Delta do mapa Microsoft](fix-proposal/microsoft-map-delta.patch.txt). O mapa canônico .json está ausente no delivery 74 observado; materializar a versão completa quando necessário. O mapa histórico 55 fica preservado.
- [Composição executada](VALIDATION-V2.json): a instalação instrumentada `40edd1e...` reduz byte a byte à proposta `34d74d...` removendo somente o import e quatro marcas. O mapa `57e4d...` identifica os bytes instrumentados; usar o mapa `6586b...` para a proposta sem marcas.

O helper de body, limites de 65536 bytes / 25 MiB, headers, Host/Origin, tradução Microsoft, dispatch e persistência permanecem os da74. A proposta separada owner25MiB não foi incorporada.

## Regressão real

| Controle | V2 observado |
| --- | --- |
| GET e POST mínimo de 28 bytes | 200; POST em 4 ms |
| Operador local real + Versions/save de 77 bytes | 200 em 7 ms; uma mutação, 1 versão e 2 audits; formulário inicial removido |
| Fronteiras de Versions | Body completo em 2,099 ms; transação concluída em 6,136 ms; resposta fechada em 6,699 ms, relativos ao início do request |
| Corpo UTF-8 dividido, consumidor pausado | 30025 bytes exatos, chunked e declarado, EOF real e signal false |
| Excesso antes do EOF do remetente | 65537 bytes enviados, 413, reader liberado, nenhuma continuação após leitura |
| Disconnect parcial | 10/4096 bytes, reader rejeitado/liberado, signal true, nenhuma continuação; observador diagnóstico de erro desativado e zero listeners de erro |
| Regressões existentes da74 | Limite, framing, binário autorizado e Microsoft passaram no mesmo V2 |

[Resultados completos](evidence/V2-RESULTS.json) e [observações estruturadas](evidence/v2-observations.ndjson) preservam os valores reais. Os sete registros M79_CLEANUP mostram listener fechado, zero sockets próprios abertos e zero observadores restantes. Diretórios privados e stores são descartados em finally. Cookies, códigos de enrollment e HTML protegido não são registrados.

Nos negativos defeituosos, `selectedCancel=pending` permanece registrado: a API não expõe a companheira interna do tee criado pelo construtor. Os leitores alcançáveis ficaram desbloqueados, loops terminaram e timers/listeners/sockets próprios foram limpos. Não se afirma que aquela promise interna resolveu. No positivo com construtor de um argumento, o stream original capturado aparece locked pelo tee; o reader selecionado chegou ao EOF e seu cancel resolveu.

O disconnect real verifica a ordem aborted/error/close e a limpeza sem observador diagnóstico de erro. O fallback de construção com Node já fechado foi revisado estaticamente; não se reivindica um teste separado forçando esse estado inicial.

## Identidades e histórico

| Etapa | W | V | S | Run / resultado |
| --- | --- | --- | --- | --- |
| Baseline C34 | `0cd83576a6146f61df1bacf6de3990353b2d8c94` | `04e86528b27c2e61c0a79ed8b5e41e4a043f1405` | `4514279d92263a5b3615ca351c93aa83c154f231` | 43673909326: 0 PASS / 2 FAIL, 4,90 s |
| Transporte 74 exato | `60613a133ee7ffc1026c875c3939b1d92cc97502` | `28c25718075dd5724e38579907621116df3369fc` | `03edea269fed4483a24555da28670df1b978b355` | 43674790650: 4 PASS / 1 FAIL, 3,22 s |
| Proposta completa | `ee7248989ab02050ad9eb66952de2ae8bfd1484b` | `fae62b70b5417f7fb31e11ea4011274f6c5148d5` | `a429fff697f4030249f9e0bd34a46113d3a0156d` | 43675862594: 11 PASS / 0 FAIL, 2,97 s |

Árvore W2: `0637d4372ee3821b32bbc41a7f8d5e9ab15effcf`. Árvore V2: `938e9220fde506dabcf6a29a5e78a78b954d5a12`. Árvore S2: `8ed205766e045443079cebb555c182ba4fa69ae0`. Cada S acrescenta somente .ci-run.json ao V. As mudanças materiais e a deduplicação constam nos manifestos; nenhuma jornada de 180 s foi repetida.

Os três logs completos e seus hashes estão em evidence. O run verde 74 de número 43673697145 foi reaproveitado como proveniência; seus resultados não foram transferidos para V2. V2 executou cinco testes existentes da74 e seis próprios da79. W2 contém fixtures e artefatos inertes; o resultado verde pertence a V2/S2, com os onze overlays declarados. As fixtures diagnósticas dependem dessa instrumentação; W2 sozinho não é o candidato qualificado.

## Intake e autoridade terminal

**74:** conferir o preimage `8a62...` e aplicar a delta na sua branch de produção; atualizar/materializar o mapa ativo com os hashes sem instrumentação; enviar ACK do commit adotado.

**71:** integrar a unidade adotada pela74 e reconciliar as fixtures diagnósticas com sua instrumentação. Revalidar os preimages. O target observado `e87e22d163924635bf0b41785c9bc80bf780ac0a` ainda tinha a instalação C34 `21236af8...`. O patch completo não deve ser aplicado cegamente sobre um head que avance. A integração final continua exclusiva da71.

**45:** [REQUEST-45](checks/REQUEST-45.json) pede `bun typecheck` em modules/sucafina e apps/cli e `check:guards` contra origin/dev real. Estado **REQUESTED_NOT_RUN**. Não foi criada lane nova nem executado compiler local.

Depois da adoção, os consumidores 52/67/BI retomam as jornadas interrompidas. Esta prova usa listener e componentes reais, operador local e SQLite; não é uma jornada de navegador/CLI/native host nem validação de provedor externo. O teste Microsoft usa o peer criptográfico sintético da74.

A missão preserva T0, 15 WPs, 74 tasks e 1610 critérios. As oito seleções finais, evidências AM, revisões e gates C/G7 e D/G8 continuam com seus owners. **GLOBAL_RELEASE=false.**

[Handoff de máquina](HANDOFF-74-71.json) · [Autoridade terminal](TERMINAL79.json) · [Revisão](REVIEWS.json) · [Critérios](CRITERIA-TRACE.json).
