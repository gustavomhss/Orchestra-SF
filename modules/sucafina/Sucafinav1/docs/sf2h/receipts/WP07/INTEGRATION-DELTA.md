# WP07 — deltas de integração para os proprietários e S0

## Estado e limite da entrega

Este documento descreve alterações necessárias **fora do ownership WP07**. Elas não foram aplicadas nem são declaradas concluídas. Os consumidores próprios estão em `product/reviews/` e `product/reports/storage.ts`; a matriz de 86 critérios conserva as pendências de produtor, autorização, montagem e prova nativa. A inspeção inicial usou `798c096c105bc68870cec6c5a10269f1457e2f18`; a retomada publicou o candidato `dcde725380e76ff3180b1415e3c0838b9ca7df34`. Os SHAs de cada observação e os resultados posteriores constam em [checks.json](checks.json) e [EXECUTION.md](EXECUTION.md). Os pins atuais dos produtores estão em [PRODUCER-RECHECK.md](PRODUCER-RECHECK.md) e [C11-PRODUCER-RECHECK.md](C11-PRODUCER-RECHECK.md); as observações antigas abaixo não substituem essa reconciliação.

## 1. Escrita privada de relatórios por viewer — WP00/WP10

**Origem do bloqueio:** `product/integration/product-authority.ts`, em `createSfProductAuthority`, recusa qualquer escrita C08 quando `actor.canWrite` é falso. O `resolveTarget` só aceita o alvo de criação do workspace quando `actor.canWrite` é verdadeiro. A admissão de comandos humanos também exige escrita, salvo as exceções de leitura já enumeradas. Essas condições são observáveis no candidato; um teste WP07 com callback controlado de autorização não altera essa política real.

`createReviewArtifactStorage.put` usa a transação protegida do namespace `documents`, com identidade da operação, alvo de criação, versão de armazenamento e digest de intenção. O documento resultante é `sf-review-artifact-v1`, pertence ao principal/instalação/projeto/política e mantém bytes, digest e referência da revisão. `read` e `download` revalidam a revisão e a autoridade. O consumidor não muda `canWrite` nem concede `documents` ao viewer.

**Delta que o proprietário deve integrar:** autorizar estreitamente a criação do artefato privado após admissão válida de `sf_report_prepare`, sem conceder a capacidade geral de editar documentos, compras, importações ou dados financeiros. A decisão deve ser produzida pelo host, associada à requisição/contexto realmente admitido, e vinculada a operação, principal, projeto, revisão, digest, alvo e idempotência. Não pode ser derivada de campo ou header fornecido pelo browser/modelo.

O seam atual de autorização C08 recebe namespace e modo; isso, isoladamente, não distingue um relatório privado de outras escritas em `documents`. WP00/WP10 devem fechar o contrato de intenção/capacidade e a validação do delta persistido no produtor C08. Uma capacidade interna por identidade de objeto, como os padrões já usados no host, só é adequada se a transação também verificar o conteúdo permitido: criação do relatório vinculado, ausência de alteração de documentos preexistentes e nenhum efeito em outras coleções. Simplesmente liberar o namespace ou ignorar `canWrite` amplia autoridade indevidamente.

Paths de integração:

- `product/contracts/state.ts`: intenção/capacidade de escrita, se a assinatura pública precisar evoluir; writer WP00.
- `product/host-binding/state-provider.ts`: validação da transação e do delta, writer WP10/WP00 conforme campanha.
- `product/integration/product-authority.ts`: emissão e consumo da autorização privada, writer WP10.
- `apps/cli/src/sucafina-product/host-context.ts`: composição e alvo protegido, writer WP10.
- Consumidor já existente: `product/reports/storage.ts#createReviewArtifactStorage`.

Provas exigidas do owner: viewer autorizado gera e baixa seu relatório; o mesmo viewer continua impedido de upload/importação/alteração de documento ou fonte; outro principal não lê os bytes; operação, revisão ou digest trocado é recusado; revogação antes do commit e antes do download impede a entrega; retry retorna os primeiros bytes sem uma segunda escrita. A decisão sobre quais viewers podem **preservar** revisões também deve ser explícita no host; a exceção de relatório não concede automaticamente `reviews.preserve`.

## 2. Corpo factual imutável de C07 — WP09/WP10/WP00

Fonte inicial inspecionada: `sf2-relay-ready` em `b58601f92f3bc8742e5a7c72a34d5ddf1fd87fe8`. A rechecagem de `astra-wp09` em `f18d5819bec7848664772c77d7501e7c25d578bf` mantém a lacuna: `readRoutineResult` expõe metadados autorizados e não fornece o corpo factual persistido e imutável necessário ao consumidor. Referência, resumo textual ou resposta de provider não demonstram qual conteúdo foi realmente produzido. O audit C11 lista os blobs e os contratos lidos.

Paths do proprietário: `product/routines/capabilities.ts`, `product/routines/review.ts`, `product/routines/factory.ts`; contrato público coordenado por WP00. A ausência de factories importadas também aparece no inventário de typecheck.

**Seam requerido:** uma leitura autenticada por `runRef`, `resultRef` e digest esperado, recebendo o contexto confiável existente. A forma final deve ser definida no contrato C07 pelo proprietário. A leitura deve devolver o corpo persistido, suas referências e a proveniência verificada, ou uma recusa explícita; nunca reconstruir o corpo a partir de metadados correntes. Ela deve:

1. Reabrir o run admitido e o resultado associado, vinculados ao caso, versão/encarnação e principal corretos.
2. Conferir o digest dos bytes/corpo imutável e a ligação com o documento/resultado persistido.
3. Revalidar autoridade atual e todas as evidências C17 antes e depois da leitura, incluindo mudanças durante a chamada.
4. Manter a identidade histórica após novos resultados, sem substituir silenciosamente o resultado selecionado pelo mais recente.
5. Retornar indisponível/negado para resultado ausente, digest divergente, run de outro caso/principal, origem revogada ou proveniência incompleta.

Após o produtor existir, WP10 deve injetar o reader real no fluxo que entrega a contribuição C11 ao consumidor WP07. A prova positiva precisa incluir run nativo e recibos reais, persistência, reload e consumo do mesmo corpo pelo material de reunião. WP07 não cria um `SessionV2`, `SkillLoadReceipt` ou recibo de consumo de teste para preencher essa ausência.

## 3. Readers históricos de decisão e observado — WP11/WP13/WP14

| Produtor inspecionado | Disponível / lacuna | Delta requerido |
| --- | --- | --- |
| `sf2-decisions-ready`, `ba2822bb06a8ad741ecbcf0d47654d1a86a3a95b` | Há leitura histórica de cenário; comparação histórica ainda não tem reader equivalente. | Fornecer leitura por referência imutável, validando caso/versão/digest e evidências atuais, em vez de recalcular a comparação do caso corrente. |
| `sf2-portfolio-ready`, `27375325788fa571d39137728ec7f0666e89f22c` | Há histórico de portfolio; leitura de sensibilidade continua presa ao caso corrente. | Disponibilizar o resultado histórico autorizado da sensibilidade, com unidade, eixos, intervalos e cobertura originais. |
| `sf2-memory-ready`, `02ac8172c17ad57e830bfb23d3ff1d1b1191852b` | Adaptador de observado entrega a observação corrente ou indisponível. | Ler resultado/cutoff preservado com fonte e cobertura reais; impedir que um cutoff posterior substitua o selecionado. |

Consumidores WP07: `decision-access.ts`, `sensitivity.ts`, `outcome-access.ts`, `outcome.ts` e sua composição em `selection.ts`. Os testes aprovados verificam identidade, incompatibilidade, ausência e recusa de cutoff divergente. Não provam que o produtor histórico ausente foi implementado. Actual ausente permanece ausência e nenhum delta de comparação se transforma em economia causal atribuída à IA.

## 4. Dashboard, histórico C06 e continuidade física — WP02/WP08/WP10

O inventário atual de branches/blobs e os seams estão em [PRODUCER-RECHECK.md](PRODUCER-RECHECK.md). WP02 `5a0f1acf9fa2cdc0171cf3f5178b61ab3bcd8d49` já fornece Executive, IT Performance e recorte parcial de IT Operations; WP08 `09df93d48c0f4ef441c7f394db5ced086e8140c6` já fornece `createThreadHistory.readVersion`. A pendência atual desses APIs é composição/integração, não ausência no produtor. O [patch de bindings](wp10-producer-bindings.patch), contra WP10 `d41ea01b8d9aa068301c1643c1ec3dc088900533`, é concreto, **não aplicado e não testado**; suas pré-condições e o lifecycle/registro ainda necessário estão no recheck.

O consumidor próprio já tem prova hospedada com C17/BCS/C06 e SQLite reais para captura, reply/resolve, reinício do store, revogação e rejeição de uma fonte recriada com o mesmo ID. Essa prova não contém edição histórica de mensagem nem associação entre uma página agregada e um registro. O reader histórico deve compartilhar as instâncias canônicas e o reader recipient-aware, em vez de criar outro armazenamento de conversa.

O mapping de página para registros/thread deve transportar a mesma encarnação, versão, campos, período e identidade de origem. A continuidade após exclusão/substituição precisa de histórico/tombstone autorizado do produtor C17. Reutilização de nome ou ID lógico não prova continuidade. As mesmas condições se aplicam à relação C06 e à ação canônica reaberta no fechamento: a revisão não cria um segundo cadastro de ação.

## 5. Montagem dos consumidores e paridade nativa — WP10/WP12

Entradas próprias entregues para composição no host existente:

| Entrada | Dependência que o host precisa fornecer |
| --- | --- |
| `createReviewApplication` | State/UI/human authority reais, host, alvo de criação, política estreita de relatório, ports C02/C06, readers históricos e resolver C17. |
| `application.http(request, surface)` | Montagem no roteamento autenticado existente para os modos `review-*`; sem listener ou identidade paralelos. |
| `application.descriptors` | Registro real dos três exports `sf_review_prepare`, `sf_report_prepare`, `sf_artifact_get` em UI/native/private-MCP, preservando `dispatchSfCapability`. |
| `createReviewPreparationView` | Seletores autorizados, sessão atual e callbacks do host para atualização/revogação; entradas existentes Prepare review/Generate Report. |
| `createReviewBrowser` | Referência preservada, verificação explícita de atualização e navegação autorizada de fonte/seção. |
| `createReviewContributionView` | Reader C11 real e saídas persistidas verificadas; referências de resultado não são IDs de revisão. |

Paths externos: `src/surfaces.ts`, `apps/cli/src/sucafina-product/host-context.ts` e os registries nativos existentes do proprietário. WP07 não edita esses arquivos. Os adapters HTTP/browser próprios são concretos; a montagem isolada em Chromium com SQLite/Planner não equivale a montagem na instalação ou a execução nativa.

S0 deve coletar a execução positiva UI/native/MCP na mesma base e autoridade, com handler/export, versão, resultado, run IDs e recibos reais. Os negativos devem incluir chamada direta sem concessão, stale, indisponível, revogação e tentativa com caso/principal/manifesto/skill divergente. Os recibos C/AM/D globais serão compostos depois, conforme o handoff; nenhum check cirúrgico desta PR os substitui.

## 6. Jornada anual aprovada e limites da prova de desempenho

O bloqueio funcional anual anterior foi **resolvido no escopo hospedado do consumidor**. O run [43537439411](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43537439411), job `132269744477`, executou o produto W `dcde725380e76ff3180b1415e3c0838b9ca7df34` pelo snapshot S `1a2b5cdd71a401d07a6abbaa36e8753e4207fc04`: **2 PASS / 0 FAIL**, incluindo a jornada completa de janeiro a dezembro de 2027 e a contribuição. Os limites de interação continuam em 5 segundos; não houve redução do ano, truncamento da seleção ou cache de autorização. A segunda preservação respondeu em **2.954 ms** e as duas comparações completas em **3.283 ms** e **3.265 ms**. São medições dessa fixture hospedada, não um benchmark de produção ou garantia de latência para qualquer volume.

O snapshot original S `66071da10fce65e51cf47b218d019386aef29485` gerou tardiamente o run [43537466887](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43537466887), job `132269833269`, também **2 PASS / 0 FAIL**, com a mesma tree `e2a128a8c33b6b407bd43ecfc0d874ff392bbb1d`. O retry foi um commit vazio após consultas sem run observado. Os dois workflows acabaram sobrepostos; o incidente operacional está registrado em [checks.json](checks.json), sem contar o segundo run como cobertura adicional e sem declarar cumprimento perfeito do limite de um run em voo.

As falhas anteriores permanecem reais: comparação em 5.122 ms no run `43528912346`; segunda preservação em 6.509 ms no run `43530154667`, 5.475 ms no run `43534944664` e 5.172 ms no run `43536210514`. O último acrescentou instrumentação de leitura sem mudar resultados: a segunda preservação fez 162 chamadas a `currentSnapshots` (2.711 ms), com tempos inclusivos de métodos, portanto não somáveis. O run mensal `43530831862` continua identificado como janeiro de 2027 e não foi renomeado como anual.

A correção própria em `product/reviews/port.ts` persiste um recibo compacto `{ schema: "sf-review-receipt-v1", reviewRef, reviewDigest }` no retorno da transação C08. O corpo integral permanece uma vez na coleção protegida de revisões. Antes, o retorno era outra cópia completa da revisão, armazenada também no recibo de idempotência; as materializações posteriores copiavam ambas. Retry e retorno após commit reabrem a revisão pela porta de leitura autorizada existente e conferem o digest. O consumidor aceita recibos legados, preserva a identidade de comando e devolve o primeiro resultado confirmado quando há corrida. Recibos históricos grandes não foram migrados, e não há promessa de ganho para esses corpos já existentes.

As otimizações anteriores continuam: remoção de quatro leituras HTTP redundantes, deduplicação de referências integralmente iguais apenas dentro de cada passe e redução de releituras C06 repetidas mantendo os fences antes/depois. Nenhuma decisão de autorização é reutilizada entre requisições; Planner não recebeu memoização. A regressão de recibos e seus resultados exatos estão em [checks.json](checks.json).

A amplificação restante do host é um tema separado de escala para WP10/WP00: `runtime/local-store.ts#currentSnapshots` ainda materializa os três snapshots completos, e `product/integration/product-authority.ts` o consulta repetidamente. Uma evolução do proprietário pode oferecer uma projeção mínima de identidade, papéis e escopos vinculada à geração/transação real, mantendo revogação e isolamento em cada fronteira assíncrona. Isso não é mais apresentado como pré-condição para o PASS anual desta fixture. A montagem real da instalação, a política de viewer e as provas nativas descritas nas seções anteriores continuam pendentes.

## Ordem de integração sugerida

1. Alinhar os contratos/produtores C08/C07/C17 e sanar o typecheck listado em [TYPECHECK-EXTERNAL.md](TYPECHECK-EXTERNAL.md).
2. Compor os readers e a política de artefato privado; montar os consumidores próprios no host existente.
3. Executar as jornadas autorizadas de seleção/preservação/reload/comparação/export, inclusive viewer, exclusão física, thread histórica e revogação.
4. Coletar as provas nativas/C11/C16 e atualizar cada critério afetado com run e recibo reais.
5. Revisar a PR e integrar em `sf2-stack` quando aceita. Esta entrega não faz merge em `dev` nem deploy.
