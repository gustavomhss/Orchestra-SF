# WP07 — deltas de integração para os proprietários e S0

## Estado e limite da entrega

Este documento descreve alterações necessárias **fora do ownership WP07**. Elas não foram aplicadas nem são declaradas concluídas. Os consumidores próprios estão em `product/reviews/` e `product/reports/storage.ts`; a matriz de 86 critérios conserva as pendências de produtor, autorização, montagem e prova nativa. A inspeção inicial usou `798c096c105bc68870cec6c5a10269f1457e2f18`; o candidato final testado é `c5143e6ad6d8dca61b09572c60f5a6ed64093f74`. Os SHAs de cada observação e os resultados posteriores constam em [checks.json](checks.json) e [EXECUTION.md](EXECUTION.md).

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

Fonte inspecionada: `sf2-relay-ready` em `b58601f92f3bc8742e5a7c72a34d5ddf1fd87fe8`. A leitura de `readRoutineResult` expõe metadados autorizados; não fornece o corpo factual persistido e imutável necessário ao consumidor. Referência, resumo textual ou resposta de provider não demonstram qual conteúdo foi realmente produzido.

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

O inventário exato de branches/blobs e os seams estão em [SELECTION-CONSUMERS-AUDIT.md](SELECTION-CONSUMERS-AUDIT.md). Integrar `createDashboardAgendaSelector` e `createThreadHistory.readVersion` é necessário, mas não basta para tópicos que o produtor ainda recusa. Executive, IT Performance e recorte parcial não vazio de IT Operations precisam de identidade física e projeção autorizada fornecidas pelo próprio produtor.

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

## 6. Custo da autoridade sobre revisões anuais — WP10/WP00

O teste de navegador anual continua **FAIL**, sem converter respostas HTTP 200 tardias em aprovação. No run `43528912346` (W `fc59841cec4691a0520eabcf2c24c0bbf9c4ddc1`), a comparação respondeu em 5.122 ms e excedeu a asserção de 5 segundos. No run `43530154667` (W `7664de39a5675cff81ac963c0fa51eb77621e74a`), a segunda preservação anual respondeu em 6.509 ms e o clique expirou. Não há benchmark de produção ou perfil CPU que atribua todo esse tempo a uma função única.

A inspeção estática encontrou amplificação concreta fora de WP07: `runtime/local-store.ts#currentSnapshots` executa `decodeSnapshot(encodeSnapshot(...))` para os três snapshots completos em cada chamada; `product/integration/product-authority.ts#resolve` consulta esse método e `principal` volta a consultá-lo. As revalidações legítimas de comentário, evidência, preservação e comparação repetem esse trabalho sobre snapshots que já contêm revisões e recibos imutáveis. Mover callbacks para uma transação externa não elimina essas cópias. Além disso, transações `transactionAll` aninhadas são proibidas pelo store; não se introduziu esse risco no consumidor.

WP07 removeu as quatro leituras HTTP redundantes antes da comparação autorizada, preservou as releituras e a revalidação final no servidor, deduplicou apenas referências integralmente idênticas dentro de cada passe C17 e indexou os digests completos dos valores de gráfico por chamada. Essas mudanças não são apresentadas como solução da lentidão anual restante.

**Delta para o proprietário:** instrumentar contagens/bytes/tempo de materialização e fornecer ao resolvedor de autoridade uma projeção mínima, imutável e atual de identidade, papéis e escopos, vinculada à geração/transação real. A evolução deve manter revalidação antes/depois de fronteiras assíncronas, cancelamento, revogação, isolamento e impossibilidade de mutação do snapshot raiz. Não reutilizar uma decisão de autorização entre requisições nem conceder leitura do payload privado para acelerar o caminho. Os contratos compartilhados e o store são escritos por seus proprietários.

A jornada funcional mensal usa o recorte de período aceito pelo Planner real, sem truncar a projeção retornada, remover etapas ou aumentar limites de tempo. O run `43530831862` aprovou a jornada em janeiro de 2027 no candidato `c5143e6ad6d8dca61b09572c60f5a6ed64093f74`. Essa prova cobre as interações naquele recorte; não substitui a jornada anual falha, a verificação de escala ou a integração nativa. As seleções anuais e os exports extensos mantêm provas separadas nos testes e nos recibos visuais.

## Ordem de integração sugerida

1. Alinhar os contratos/produtores C08/C07/C17 e sanar o typecheck listado em [TYPECHECK-EXTERNAL.md](TYPECHECK-EXTERNAL.md).
2. Compor os readers e a política de artefato privado; montar os consumidores próprios no host existente.
3. Executar as jornadas autorizadas de seleção/preservação/reload/comparação/export, inclusive viewer, exclusão física, thread histórica e revogação.
4. Coletar as provas nativas/C11/C16 e atualizar cada critério afetado com run e recibo reais.
5. Revisar a PR e integrar em `sf2-stack` quando aceita. Esta entrega não faz merge em `dev` nem deploy.
