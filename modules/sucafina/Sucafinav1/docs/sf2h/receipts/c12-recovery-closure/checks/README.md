# Pedido de compiler/guards à45 — missão65

**REQUESTED_NOT_RUN.** Este pedido identifica o produto W2 da PR74. Os testes funcionais de W2 passaram; compiler e guards continuam solicitados à45, sem execução creditada por este documento.

| Identidade | Valor |
| --- | --- |
| Branch | `c12-recovery-proof` |
| PR draft | [74](https://github.com/gustavomhss/Orchestra-SF/pull/74) |
| W2 | `99919e946fa065cbcd458446fc71ab3f50f73267` |
| Tree de W2 | `95e8f51bcfe3f613177e676a1053c2ab87dd8d6d` |
| Base de guards observada | `origin/dev` → `a1d37698a7bb097c1578f827eba6a19b9917ef07` |
| Handoff de integração | [PR65](https://github.com/gustavomhss/Orchestra-SF/pull/65), aguardando retomada autorizada |
| Owner de compiler/guards | 45 |

## Execução solicitada

1. Em `modules/sucafina`, executar **`bun typecheck`**, pelo script canônico do pacote.
2. Na raiz, executar **`bun run check:guards --base origin/dev`**, registrando o SHA real de `origin/dev` e sua relação com W2.

45 deve reconciliar sua fila e deduplicar por árvore de produto, comando, configuração, runtime, base e workflow/validator antes de disparar. O resultado precisa identificar W e eventual snapshot S, relação entre ambos, jobs, logs, exit status e diagnósticos completos. Material novo exige W atualizado e nova seleção afetada; um commit posterior somente de recibos não recebe crédito retroativo de execução.

## Fronteira de autoridade

A missão65 usa apenas o request cirúrgico existente para testes de produto. O owner45 conserva a infraestrutura de compiler/checks.60 está **TERMINAL, com lease encerrado**, no registro `faa30fddb7e7b61696b66fd069f51cf18c51125f`. O handoff é destinado àPR65 e aguarda retomada explicitamente autorizada; nenhum sucessor ou lease ativo de integração é presumido.

No head observado de `astra-compose`, `d317873c18bf224c4c1f4d3425179d12ad53e81b`, `sf2-scoped-check.yml` não existe. O workflow existente `astra-compose-check.yml`, blob `e7a815a797e960e826af4268dd381cb4c5df6ffc`, dispara pela ref exclusiva `astra-check-compose`.65 não tomou essa ref, não importou o workflow e não criou uma plataforma de CI paralela. A observação desses paths não constitui concessão de escrita.

O padrão de solicitação preserva a fronteira já registrada em `integration/closure-intake-57/source-outputs/runtime56/checks/REQUEST-45.json`. Os comandos deste pedido são obrigatórios mesmo que os testes cirúrgicos passem.

## Escopo técnico de W2

A comparação GitHub da base com W1 confirmou mudanças somente nos três arquivos de produção autorizados: `apply.ts`, `prepared-apply.ts` e `receipt-review-binding.ts`. Esses três blobs permanecem iguais na entrega W2 identificada pelo root; a comparação dos bytes locais conservou seus hashes. W2 acrescenta a correção do período diário da fonte Hot Topic e os discriminantes novos. Há testes no namespace próprio e documentos no namespace de recibos.

O novo registro `originalIntent` fica **dentro do valor da transação applicationAttempt já existente**. Ele conserva a requisição original, digests de escolha/mudança/review e a identidade do binding. Os recibos canônicos continuam valores brutos, a transação de aplicação conserva sua identidade e não surge novo namespace ou schema C08.

O produtor direto `createSfPreparedApply` continua sem criar uma reserva separada. Quando existe uma tentativa externa, valida sua intenção original; quando não existe, conserva o caminho direto já suportado. A execução continua trabalhando sobre uma cópia e só copia o efeito para o snapshot depois de validar versão do recibo e grant. Falha nessa etapa mantém `commit:false`; efeito, recibo e auditoria permanecem na mesma unidade de commit. Além da revisão do diff, a seleção funcional W2 passou pelos gates existentes de Finance Apply/alias/rollback; compiler e guards continuam separados.

O pacote `external/first-save/` contém somente postimages e diff **NOT_APPLIED** para um lookup externo. Não é código ativo, não é importado por testes e não inclui mudança aplicada à UI52 ou aos produtores61.

## Evidência funcional separada

O snapshot S2 `041e9d7dd055043a1a3de5c8261e399f8da2de73` e o [run43668690783](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43668690783), job `132673683798`, pertencem à seleção funcional de W2: **27PASS / 0FAIL / 824 expectativas / 11 arquivos / 24,47s**. O root verificou o log real pelo GitHub MCP. Os dois cenários first-save passaram; o trace específico conserva os digests/resultados originais e o limite de corpo retido. A atualização documental não executou testes nem realizou ações remotas.

O histórico W1/S1 permanece **FAIL:23PASS / 1FAIL**, run `43668120365`, job `132671948853`. A falha foi403 na emissão de fonte Hot Topic, antes do registro, porque a fixture passou horizonte anual a um produtor cujo escopo é o dia corrente do host. W2 corrige somente esse input de fonte, sem ampliar grants ou alterar o produtor. O pedido45 anterior para W1 foi substituído pelo W2, sem inventar um resultado de compiler/guards para nenhum deles.

Source PASS não fecha a integração60, o lookup mínimo de primeiro save, o consumidor UI, AM04 integral, execução nativa/modelo, revisão independente ou aceite global. Nenhum diagnóstico herdado ou próprio deve ser removido, ignorado ou promovido a waiver por este pedido.
