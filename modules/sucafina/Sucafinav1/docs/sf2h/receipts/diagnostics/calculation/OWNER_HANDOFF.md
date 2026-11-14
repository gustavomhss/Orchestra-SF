# Handoff acionável — WP10 / cálculo e persistência

**Proposta pronta para revisão/aplicação pelo owner. NOT_APPLIED / NOT_RUN.**

## Decisão pedida ao owner

Aplicar somente a consolidação de observação de fonte em dois arquivos WP10, preservar os produtores do Financeiro e executar os cortes abaixo no produto aplicado. O alvo é o par redundante `describe.transaction + readScopedSource.transaction` em cada estágio do resolver. Não há alteração de engine, regra financeira, recertificação obrigatória ou budget.

O diagnóstico termina com causa localizada e contraprova preparada. Ele não declara a falha financeira resolvida: o ganho temporal e a jornada inteira ainda dependem da aplicação e execução pelo owner.

## 1. Aplicação delimitada

| Arquivo compartilhado proposto | Owner | Preimage Git blob SHA-1 em W26 |
|---|---|---|
| `modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts` | WP10 | `65867a3e6aa9b5b85266bb637fb22cf1c6c6d539` |
| `modules/sucafina/Sucafinav1/product/integration/planner-sources.ts` | WP10 | `6230f22e7dd66fec1103f28cc9a7937b2dca1449` |

Patch: [0001-wp10-source-observation.patch.txt](proposed/0001-wp10-source-observation.patch.txt). Contrato e justificativa: [manifest.json](proposed/manifest.json).

Os preimages são de W26 `a1434e7ea7340aa1d1c8ce6bb48958b724218170` e permanecem iguais no owner observado W27 `ab8fb4f29d078d179742a77679ef85e5c549b114`. Antes de aplicar, conferir novamente o head e cada blob. Se divergir, adaptar a proposta contra o novo preimage e renovar o recibo; não sobrescrever alterações do owner.

A branch diagnóstica não contém a aplicação dos dois arquivos. Seu único código executável novo é o teste no namespace autorizado. O owner deve levar esse teste junto ao patch e preservar o trace já existente no arquivo `portfolio-exact-threshold.test.ts` de W27. Não substituir o teste atual pela versão W26.

### Invariantes de revisão do patch

- `requireSourceIdentities` antes de preparar; preparação recebe snapshot isolado.
- Mesmo kernel `observe`/materialização: duas autorizações, projector, identidade física, proteção contra mutação, digest, versão, incarnation e decisão de commit.
- Uma transação Planner por estágio; nenhum nested transaction ou `transactionAll`.
- Mesmo `authenticate` e mesmo seletor de papéis/projeção.
- Duas observações frescas `current/again`, sem guardar prova entre elas ou entre invocações.
- `host.revalidate` fora da transação; cauda de igualdade/referência/egresso conservada.
- `request.signal` encaminhado ao driver; guard de abort real após callback/antes de commit mantido.
- Caminho legado continua disponível quando o port opcional não existir.
- Nenhum change de Financeiro, Memory/Atlas, fórmulas, policies, C08, grants, lease, readers, assertions ou timeouts.

## 2. Ordem das contraprovas preparadas

Todos os JSON abaixo têm somente campos admitidos do request existente: package `sucafina`, directory `modules/sucafina`, runner `bun`, arquivos explícitos, `--timeout 120000` e Omni `strict`. A forma e a existência dos arquivos foram inspecionadas; **o validador canônico não foi executado por esta investigação**. As requests ainda não são snapshots S nem runs.

| Ordem | Request | Hipótese/pergunta discriminante | Condição de avanço |
|---|---|---|---|
| 1 | [01-source-observation.json](requests/01-source-observation.json) | O caminho real cai de 4 para 2 envelopes, preservando 6 auth/4 revalidate, fonte/digest, frescor, ABA, revoke e abort? | PASS real; sem skip/filtro e sem interpretar tempo como oracle |
| 2 | [02-source-fences.json](requests/02-source-fences.json) | O kernel compartilhado mantém lifecycle, C08, staged snapshots e fronteiras de autoridade? | Os três arquivos inteiros passam |
| 3 | [03-exact-threshold.json](requests/03-exact-threshold.json) | O produto real completa resultado, binding, persistência, recomposição, retry e revogação no orçamento original? | Arquivo inteiro e todas as fases/assertions alcançadas |
| 4 | [04-financial-preservation.json](requests/04-financial-preservation.json) | Permanecem 55.000/15.000, complete/pending/N-A/shared, ausência/zero e recertificação dos witnesses? | Os três guards financeiros selecionados passam no mesmo W |

Não abrir uma nova execução X de 285 s antes de aplicar o patch e ter a contraprova local do caminho **hospedada** (ordens 1–2). Se X continuar falhando, usar os spans preservados para localizar o novo estágio e fechar esse resultado como FAIL; não repetir o mesmo W/seleção sem hipótese nova, retirar cauda ou aumentar prazo.

### Teste próprio: o que prova e o que não prova

Arquivo [source-observation.test.ts](../../../../../test/product/diagnostics/calculation/source-observation.test.ts), dois casos, **NOT_RUN**.

A fixture usa o mesmo SQLite real. Um segundo wrapper canônico de lifecycle compartilha esse store; só seus envelopes de fonte são contados. A autoridade conserva a closure original, evitando misturar suas próprias transações com as quatro/duas do resolver. O fallback apenas omite a capacidade opcional; a implementação restante é a real.

Asserções preparadas:

1. Resultado e digest iguais ao issuer real e ao fallback.
2. Fallback: 4 transações, 6 autenticações, 4 revalidações, 2 scoped reads legados.
3. Candidato: 2 transações, 6 autenticações, 4 revalidações, 2 prepared reads; repetir na mesma instância/contexto mantém as chamadas.
4. Snapshots das três superfícies sem mutação numa releitura estável.
5. Gravações reais 80→81→80 entre observações: referência antiga `stale`; nova referência tem mesma projeção/incarnation e versão superior.
6. Revogação real no último `revalidate`: `stale` sem payload; próxima chamada com mesmo contexto retorna `denied` antes de abrir fonte.
7. Abort do Request depois da terceira autenticação direta: `denied`, sem payload, uma transação/3 auth/1 revalidate e nenhum snapshot alterado.

O caso de abort discrimina a passagem do sinal: sem encaminhá-lo ao driver, o fluxo alcançaria a revalidação exterior adicional. O scope já foi materializado pelo issuer. **Esse caso não prova primeira materialização nem abort em fila.** Os guards existentes e o gate de driver do owner continuam necessários para essas fronteiras. A igualdade aqui é da fonte; a igualdade da sensibilidade é responsabilidade do corte X.

Logs novos `SF_CALCULATION_SOURCE_OBSERVATION` registram contagem, estado, elapsed, total/máximo de transação, tempo até callback e tempo de callback. `beforeCallbackMs` inclui fila/admissão/conexão/BEGIN/decode; não é uma medição exclusiva de lock. Nenhuma asserção de speedup é usada.

Se o patch não estiver aplicado, o teste falha explicitamente `OWNER_PATCH_NOT_APPLIED`. Se apenas a nova capacidade existir mas o resolver não a usar, as contagens 4→2/legacy→prepared falham. Não publicar um skip como validação.

## 3. Oracle da jornada integral

O [teste X existente][X] deve conservar seu deadline cooperativo de **285.000 ms**, timeout próprio de **300.000 ms**, todos os leitores e assertions.

| Fronteira | Resultado necessário após aplicação | Situação observada em X27 |
|---|---|---|
| Cálculo | Samples `[[80,-240],[240,-80],[400,80]]`; três refs distintas; unidades USD/engine canônico | Produtores retornaram; assertions públicas não alcançadas |
| ExactThreshold | Estado exact; valor no intervalo [320,321), fora dos samples; witnesses/fontes canônicos; training pendente permanece condicionado | Probes IEEE e write executados; aceite público não comprovado |
| Persistência utilizável | Cinco cenários e uma sensibilidade; request/result digests iguais ao payload; caso sem escolha/preparedChanges implícitos | Write bruto `ok`; primeira prova de binding abortou; inspeção final não alcançada |
| Nova composição | Produto/verifier novos leem exatamente o mesmo resultado com observações atuais; storage inalterado | NOT_REACHED |
| Mesmo retry | Mesmo resultado e resultRef, sem novo resultado ou mutação da storageVersion | NOT_REACHED |
| Revogação | Mesmo Request/input/contexto: read e retry recusados, sem `value`; binding/input identidade preservada | NOT_REACHED |

A recomposição do teste X cria serviços/verifier novos sobre o mesmo store aberto; não deve ser descrita como reinício de processo ou reabertura de SQLite. O teste de lifecycle tem sua própria prova de reopen. O writer bruto não equivale a binding validado. Não alterar a recuperação de órfão/idempotência para contornar a recertificação.

## 4. Matriz de fences preservados

| Fence | Por que o diff o conserva | Contraprova existente selecionada / pendência |
|---|---|---|
| Valores/fórmulas, 55.000→15.000 com training 40.000 | Nenhum produtor financeiro alterado | `wp13/coverage-sensitivity-integration.test.ts`; NOT_RUN no candidato |
| Complete/pending, shared/N-A, ausência/null/zero | Mesmo coverage/qualifier e mesmo projector | `wp11/composite-coverage.test.ts` + integração WP13; NOT_RUN |
| ExactThreshold e um ULP | Algoritmo e prova de intervalo/vizinhos intactos | X + `wp13/threshold-recertification.test.ts`; NOT_RUN |
| Referências, projeção, incarnation/version, A→B→A | Kernel extraído mantém guards e writes de lifecycle | Teste próprio + `source-lifecycle.test.ts`; NOT_RUN |
| C08 e snapshots staged, sem reader dentro de writer | Revalidação fica fora; nenhum nested transaction novo | `source-read-fence.test.ts` + `source-fence-read.test.ts`; NOT_RUN |
| Request, auth atual, grants, lease | Todas as autenticações e revalidações conservadas; sinal passado ao driver | Teste próprio + source fences + X; NOT_RUN |
| Replay, input/binding identity e retry | Result store e sensitivity store intactos | X integral; guards próprios do Financeiro continuam vigentes, sem reaproveitar PASS alheio |
| Ancestry | Contexto/limite/validador intactos | Não encerrado por este corte; conservar failures/pêndencias do owner, sem duplicar investigação Memory/Atlas |
| Recertificação obrigatória | Cinco verifiers no caminho completo permanecem | X ainda precisa alcançar a cauda; primeira prova foi a única iniciada em X27 |

Os guards financeiros usam produtores reais nos casos positivos; alguns negativos estruturais intercalam observações/ports controlados. Eles são complementares à prova integral do host real e não a substituem. Não foi criado mock de cálculo neste diagnóstico.

## 5. Protocolo CI e deduplicação

Seguir [CI.md][CI] e AGENTS. O destino desta PR é `astra-wp10`, conforme a autorização específica do diagnóstico.

1. Owner aplica/revisa os dois arquivos, incorpora o teste e congela **W + tree**. Não executar a request de candidato sobre a branch com patch apenas documental.
2. Ler no W real `.github/workflows/test-ci.yml`, `script/test-ci.ts`, `script/test-ci-request.ts` e `script/test-ci-location.ts`. Validar seleção/config/env/fixtures pelo caminho canônico.
3. Consultar via GitHub MCP runs compatíveis e `actions/runs?branch=<branch>&per_page=30`, conferindo `head_sha == S`. Deduplicar por produto/seleção/env/config/fixtures; máximo um teste em voo por WP.
4. Usar workflow existente: S filho de W com somente `.ci-run.json`; criar a ref `ci-run-linux-astra-wp10-<Wcurto>-<requesthash>-<tentativa>` diretamente em S. Não criar ref vazia, workflow, infraestrutura ou permissões novas.
5. Após terminal e cleanup, recolher jobs/logs/artifacts, seleção efetiva, expects/fases, Omni e comparação W→S. Só então avançar para a próxima request necessária.
6. Registrar typecheck e guards afetados no W aplicado usando os checks hospedados existentes do owner. `bun typecheck` no package pertinente; `bun run check:guards --base origin/dev` no fluxo já admitido. Nenhum check local foi executado aqui.

Verificações formais desta entrega e do futuro produto aplicado estão **NOT_RUN**. Nenhum green do CHECK W27 ou de outro SHA é transferido para esta proposta. Não se pede exceção, label de aprovação, epic, full suite ou merge.

## 6. Recibo que encerra a hipótese

O owner deve anexar, para cada gate realmente executado:

- W/tree aplicado, S/tree envelope, preimages e diff real dos dois arquivos;
- request normalizada, identidade de env/config/fixtures e justificativa de dedup;
- run/job/cleanup IDs e conclusões, arquivos/testes/expect calls efetivos;
- contadores da fonte e durações discriminadas do teste próprio;
- spans fixture/host/write/bind/recertificação/releitura/retry/revogação do X;
- mesma sensibilidade e digests persistidos, storage estável em read/retry e recusa sem payload após revogação;
- checks de tipos/guards e quaisquer failures restantes.

Aceite de desempenho exige a jornada completa no budget inalterado. **4→2 é o oracle estrutural, não uma autorização para declarar verde o restante.** Se a cauda continuar dominante, registrar o span que agora domina e devolver ao owner com essa nova evidência, preservando todas as provas.

## 7. Situação desta entrega

- Análise e proposta delimitadas: concluídas.
- X26: FAIL, run `43619479808`, job `132521664604`, cleanup `132523530424` success.
- X27 existente: FAIL, run `43623440133`, job `132533968037`, cleanup `132535684366` success.
- Patch compartilhado: **NOT_APPLIED**.
- Testes propostos, validador de request, typecheck e guards: **NOT_RUN**.
- Novos runs disparados, testes locais e alterações de produto/branches alheias: **zero**.
- Head/tree diagnóstico e URL da PR: publicados no corpo da PR após o commit; base de produto W26 fixada no [evidence.json](evidence.json).

[X]: https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/test/product/wp10/integration/portfolio-exact-threshold.test.ts
[CI]: https://github.com/gustavomhss/Orchestra-SF/blob/d3d411f7e2476a562a57aa7620823980eaf34e46/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/CI.md
