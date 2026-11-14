# W16 — prazo único do browser e prova cirúrgica de destinatários

Este incremento parte de `5fe39f1259d2f8631cef6172aaa7e6c92f436801`, tree `68a8d13d3d60164670a7e95310b2cf1afb294e43`. O delta de execução está limitado a três arquivos de harness próprios e seu README. Nenhum consumidor de produto, input estrangeiro, contrato, engine, implementação de identidade ou política financeira mudou.

## Motivo e comportamento

O [W15 / run 43593121437](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43593121437) terminou com três observações de falha de infraestrutura. Os dois corpos de destinatários não executaram. O prazo externo começou antes da preparação, mas o Node iniciou outro prazo completo para o Chromium; o caller cancelou antes do prazo interno. O log também observou espera em disco e ausência de resposta ao primeiro comando CDP. A ordem dos prazos está demonstrada; a causa única da espera em disco não está.

O pool agora inicia um único prazo total de 30 segundos e transmite seu deadline ao Node. Cada etapa consome o restante, inclusive imports, lançamento, conexão e obtenção do PID por CDP. Um prazo vencido falha antes de iniciar outro trabalho. O teste nomeado de startup admite 35 segundos para aquisição e observação do cancelamento. Os demais callers conservam default e teto de 15 segundos.

O cancelamento continua pertencendo ao mesmo escopo AppProcess/Omni. Após sua conclusão, um recibo separado observa os PIDs conhecidos dentro de uma janela comum de cinco segundos, iniciada no primeiro cancelamento. Ausência de PID, erro, processo ainda presente ou prazo excedido mantém a falha. Se o próprio finalizer ultrapassar a janela, sua conclusão continua aguardada e a observação é registrada como incompleta. Esse recibo nunca substitui o protocolo normal de encerramento nem comprova bridge, lease ou startup bem-sucedido.

## Preservação e revisão

- [Manifesto próprio](w16-browser-startup-own.json): hashes dos quatro arquivos, preservação das cinco assertions de startup, do finalizer e dos 24 corpos dependentes.
- [Peer independente](w16-browser-startup-peer-read.json): leitura de fonte e metadados, sem execução de produto.
- [Finding detalhado](../findings/w16-browser-startup.md) e [diff completo](../findings/patches/w16-browser-startup.patch).
- [Auditoria de preservação W15](w15-preservation-addendum.json): 24 commits recuperados e 32 recibos originais preservados.
- [Auditoria independente da matriz W15](w15-independent-metadata-audit.json): 153 critérios, nove tasks, 36 cláusulas gerais e observações históricas exatas.
- [Reconciliação upstream](w16-upstream-reconcile.json): pins lidos por GitHub MCP, com os novos incrementos Finance/Intelligence explicitamente separados dos inputs consumidos.

AGENTS e CI.md permanecem intactos. O README conserva o inventário dos 24 dependentes e esclarece a seleção por mudança ou falha concreta, conforme a instrução explícita do usuário de não executar suite por grupo nem runs equivalentes.

## Seleção autorizada

O request mantém exatamente esta ordem:

1. `./Sucafinav1/test/product/wp01/browser-startup.test.ts`
2. `./Sucafinav1/test/product/wp01/question-recipients.test.ts`
3. `./Sucafinav1/test/product/wp01/browser-lifecycle.test.ts`

Startup exercita o prazo alterado; destinatários contém os dois consumidores reais bloqueados no W15; lifecycle exige a mesma prova física e as mesmas leases. Nenhum timeout de operação ou body dos demais consumidores mudou. O SHA256 do request canônico é `c32f762df6e6290db31ff676a439e956520be61ef8b6ca8b5b42659c97510039`. A repetição desses arquivos em um novo W se justifica pelo reparo material do harness; não é rerun do W15 inalterado.

O W15 está terminal, incluindo cleanup do workflow, antes da abertura desta seleção. Seu cleanup não forneceu prova física completa; o recibo histórico conserva `NOT_PROVEN`. Um eventual sucesso no W16 não exercita automaticamente o novo caminho de cancelamento, não prova a causa da espera observada e não qualifica os callers standalone de 15 segundos.

Os recibos W15 de [produto](../runs/43593121437.json), [revisão](../runs/43593121437.md), [request](../runs/43593121437.request.json) e [static](../runs/43593123221.static.json) são publicados sem alterar seus bytes. Os resultados W16 serão identificados pelos seus próprios W/tree, S/tree, runs e jobs. Não se atribui PASS antecipado, aceite nativo ou DONE; S0 mantém a composição e os gates globais ao final de todos os grupos.
