# P11 — conexão independente de leitura da autenticação

Estado: **proposta compartilhada inerte, não aplicada e não executada por este agente**. O material contém os dois arquivos completos em `files:[{path,preimage,postimage,precontent,content}]`; `complete.patch` contém o delta integral. Não houve mudança de fonte ativa, teste local, compilação, dispatch ou escrita remota.

## Base e autoridade

- Alvo reconciliado: `384f9eb172f0e6761a2af1e92d8b4bb11d9b01df`, tree `3115f239fe8bcdc5ea38b5089b6208224620d214`, C45 mais handoff documental terminal71. O agente de composição releu ambos os preimages exatos via GitHub MCP nesse alvo.
- Os preimages também foram lidos integralmente em W13 `7409883a9a36e20cabef00d25627dec88b4cf094` sobre C44. A mudança posterior de base não alterou esses blobs.
- A71 está ENDED no alvo reconciliado. Este material não presume uma lease de integração, não integra no stack e não consome89.

| Arquivo | Preimage | Postimage |
| --- | --- | --- |
| `modules/sucafina/Sucafinav1/runtime/local-store.ts` | `d9eaac043514141abb2f1f978a6fd2ceaf4040d6` | `5d7bccf29c38bc6a6b83ec2f2b3d543640b8dada` |
| `modules/sucafina/Sucafinav1/runtime/auth-maintenance.ts` | `af6e6749f7b61e07c419c90a264fdc48f3b32e21` | `6f024be93e31329270cc266742038a6e58807b1c` |

O segundo arquivo muda apenas o comentário que antes prometia uma conexão nova a cada callback. Nenhum corpo de função de AuthMaintenance muda.

## Mecanismo observado no código

A fixture das cinco jornadas instala `local-operator`, e `local/entry.ts` seleciona `createOperatorIdentity`. O operador em `runtime/operator-identity.ts` é byte-idêntico entre W11/C35 e W13/C44 (`4845de24285df2459991da7d9895aad95eb93b19`). Uma sessão válida executa três `secrets.get`: fence de revogação anterior, payload de sessão e fence posterior; há um decrypt AES-256-GCM. Não há bcrypt, Graph ou refresh de rede nesse caminho.

Os nomes `operator-session:*` e `operator-revoked:*` não entram no regex de handles managed de AuthMaintenance. Cada get do operador consulta o payload real e copia seus bytes. `product-authority.ts` (`8d563561be19d4f50a68033d4ba4ac2bf8cb3ea0`, linhas87–115) autentica as três superfícies em cada `principal()`. Portanto, **uma chamada bem-sucedida de principal tem nove consultas genéricas e três decrypts**. A leitura de estado autoriza antes e depois: seu caminho bem-sucedido adiciona dois principal, dezoito gets e seis decrypts. Isso é contagem estática de caminhos, não contagem de invocações medida no run.

O LocalStore antigo de W11 (`a36440a750d5671a34c3ab41b2af48093af9f7ee`) fornecia secrets.get via `operation(false)` e herdava a conexão do root empresarial quando existente. O atual separa corretamente a autenticação desse snapshot, mas cada callback de leitura faz `connect()` e `close()`. `connect()` abre SQLite e executa `PRAGMA busy_timeout=0; PRAGMA synchronous=FULL`. Assim, no caminho atual, os nove gets de principal abrem e fecham nove conexões. A proposta preserva o isolamento novo e todos os gets; reutiliza apenas a conexão de leitura independente.

Fontes exatas do caminho e manifesto estão em `../auth72-read/`. Os números e conclusões acima não implicam que SQLite seja a causa exclusiva do tempo observado.

## Mudança proposta e guardas

1. Capturar `dev` e `ino` no `file.stat()` que já valida o arquivo na abertura. A validação existente e o fechamento do FileHandle permanecem sob `try/finally`.
2. Criar uma única conexão Auth de forma lazy, usando o mesmo `connect()` e seus PRAGMAs. Ela não participa de `operation()`, do write queue, do ALS empresarial ou de `readSnapshotRoot`.
3. Antes e depois de cada callback, validar o caminho físico: `lstatSync` exige o mesmo device/inode, arquivo regular, mesmo UID e modo privado; `realpathSync(path) === path` recusa aliases. Uma substituição persistente ou caminho inseguro recusa a leitura; o objeto não adota um novo inode automaticamente.
4. Exigir `db.inTransaction === false` antes e depois. Os callbacks privados do factory são síncronos e só executam SELECTs com `.get()`. Nenhum cursor, transação, valor, identidade de ator ou decisão de ACL é retido entre chamadas.
5. Preservar `lifecycle.closed`, `requireScope` e aborto antes/depois. Falha de scope, statement, autocommit ou filesystem descarta a referência à conexão, tenta fechá-la e relança a falha original. Não retorna o resultado observado antes da falha posterior.
6. `dispose()` continua recusado dentro do ALS, marca closed imediatamente e memoriza uma única Promise. Depois de `Promise.allSettled([...active])`, fecha o handle Auth e limpa materializations em `finally`, inclusive se close falhar.

Todos os writers, COMMITs, lock budgets, filas, snapshots, leases, critérios, fences, políticas, linhas de produto de Procurement/C12/CurrentChoice e chamadas de autoridade ficam intactos. Os cinco títulos, ações UI, assertions e budgets não são parte deste patch.

## Por que `.get()` não retém um snapshot de leitura

O repositório declara `bun@1.3.14`; não afirmamos que o binário efetivo do runner foi medido separadamente. A fonte primária dessa versão foi lida via GitHub MCP e está salva em `evidence/`:

- `oven-sh/bun@bun-v1.3.14/src/jsc/bindings/sqlite/JSSQLStatement.cpp`, blob `2b71e5266f8d120f739a77725a82b443d10725b1`. `jsSQLStatementExecuteStatementFunctionGet`, linhas2183–2235, faz reset, step, constrói a linha e continua step até sair de SQLITE_ROW; só retorna sucesso em SQLITE_DONE/SQLITE_OK. `isInTransaction`, linhas1495–1528, consulta `sqlite3_get_autocommit`.
- `oven-sh/bun@bun-v1.3.14/src/js/bun/sqlite.ts`, blob `416d67327921da7423366be60f865a3e45f065b1`. `Database.query` guarda statements compilados, não valores. `Database.close` limpa/finaliza o query cache antes do fechamento.

O flag autocommit isolado não provaria a ausência de cursor implícito. A conclusão depende também de `.get()` drenar até DONE e dos callbacks privados conhecidos não retornarem iterators/promises nem exporem a conexão. Em qualquer exceção, a proposta descarta o handle para não conservar um statement potencialmente incompleto.

## Contratos de frescor e testes existentes

As fontes Auth72 já existentes foram lidas integralmente e salvas em `evidence/auth72-*.txt`: `readonly-composed.test.ts` (`59d5aa8328af3d1542ddb29020fb9b059ec26c5a`), `races.test.ts` (`c828e3504a4f9fc0e9cf37c34fe78988e4da93be`), `retention.test.ts` (`531a79bcc0ad1398ea04dd150f26bf0eb421cbf6`) e fixture (`f0b23f1dcbc3529cd215ac6d58b9caf351be5e77`). Seus contratos relevantes são revogação local antes de admissão da escrita, revogação durável entre instâncias, callback/refresh em voo recusado, expiração exata sem coleta em leitura, leitura que não resgata root poisoned, correlação retida e limites persistidos.

Uma raiz real `readSnapshotRoot` usa BEGIN IMMEDIATE; ela impede um writer de outra instância de confirmar enquanto esse lock está retido. Portanto, o teste de interleaving precisa criar o writer fora do ALS e comprovar a confirmação e leitura posterior após a liberação, sem inventar um COMMIT dentro da raiz retida. A capacidade de revogação local continua podendo cercar uma chamada em voo antes de conseguir o lock de escrita. Os testes adicionais P11 são preparados pelo agente de critérios, com instâncias reais de LocalStore; nenhuma execução ocorre neste subtrabalho.

## Evidência temporal e limites

O perfil diagnóstico14 (`m52-audit/diagnostic14-43679231538/profile-summary.json`) contém 270 registros com campos permitidos. Seus marcadores `http.after-withCase` foram aproximadamente 8.556s, 8.512s e 12.740s; o último produtor terminou ok após o deadline original da UI, sem resposta HTTP entregue. As durações inclusivas de Planner foram aproximadamente 5.358s, 5.332s e 9.592s. Isso confirma custo distribuído por leituras reais, mas o perfil não mede separadamente a abertura SQLite, filesystem, decrypt, clone ou CPU. Durações aninhadas não podem ser somadas como custo exclusivo. P11 continua hipótese de correção a qualificar, sem promessa de ganho ou PASS de jornada.

As verificações de filesystem antes/depois cobrem substituição persistente, perda de arquivo, aliases e permissões inseguras. Elas não tornam atômicas a abertura por pathname e as syscalls de verificação; uma troca adversarial ABA entre syscalls é limite residual, também não resolvido pela abertura anterior por path. Não há promessa nova de hot-replacement transparente. Nenhuma normalização de segurança, cache de autorização, redução de observações ou aumento de timeout é proposta para tratar essa limitação.

## Revisão e próxima evidência

`composition_audit` concluiu a revisão estática independente e a reconstrução textual dos dois pre/postimages, sem blocker. O parecer atual é `m52-audit/P11-auth-independent-static-review.json`, SHA256 `d85a0aa646c46da2b22873365f98eee7dc4847111da01d2cedbdb83fe2e486b6` (7.387 bytes), que substitui a revisão documental anterior `e154e8e07b5d8602a7231f415a9885c9a054825944c38358bf32e2fe1e5e9457`. A correção distingue o COMMIT externo somente após a liberação de BEGIN IMMEDIATE da revogação local pendente em voo. O código, o patch e o material permanecem byte-idênticos. O campo PENDING_INDEPENDENT_REVIEW no material registra o momento de criação do candidato; este parecer separado registra a revisão posterior.

Isso não é resultado de teste. A qualificação pertence à raiz: somente Actions cirúrgicos existentes, deduplicados, testes adicionais de frescor e depois as cinco jornadas UI originais. O resultado financeiro nominal mais recente continua no recibo13/C44; P11 e o diagnóstico não transferem aceitação financeira nem modificam política.
