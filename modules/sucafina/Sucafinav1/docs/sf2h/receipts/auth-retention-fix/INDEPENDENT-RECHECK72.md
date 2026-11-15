# Mission72 — Rechecagem independente da correção de retenção

**Resultado: PASS / NO_BLOCKING_FINDING, limitado ao código-fonte W1 e à evidência cirúrgica R1.**

A rechecagem não encontrou defeito bloqueante aberto na implementação publicada em `22b4e97cfbb22703eeedb34af3b33ba74d323806`. O achado independente **CR72-01** foi corrigido antes de W1 e sua regressão passou no GitHub Actions. Esta conclusão não concede PASS à composição com readonly59, à integração em `sf2-stack`, ao compilador/guards, nem ao fechamento global da campanha. A autoridade FINAL permanece com **S0 / 71 / 45**, conforme suas atribuições.

## 1. Independência e método

Revisor: agente independente `/root/ci_and_readonly`, nesta mesma sessão de missão72.

- Não fui autor de nenhum dos cinco arquivos de produto revisados nem dos 24 novos testes de regressão de fonte.
- Minha autoria anterior se limitou a espelhos de referência e propostas **inertes** para a composição: preservação de readonly59 e atualização do ponteiro/mapa da fixture Microsoft49. Essas propostas não foram instaladas na branch fonte.
- Revisei os cinco arquivos de produto, os testes novos e os pontos relevantes de C28/readonly59; conferi o diff contra C28 e busquei novamente os cinco arquivos publicados em W1 pelo GitHub MCP.
- Conferi os blobs Git dos arquivos publicados contra os espelhos de trabalho. Li independentemente os logs, metadados, commits de runner, requisição normalizada e resultados de B0/R1 pelo GitHub MCP.
- Não executei testes, compilador, guards ou código de produto localmente. Não fiz mutações remotas e não alterei código ou testes.

## 2. Identidade exata do código revisado

| Elemento | Identificador |
| --- | --- |
| Base C28 | `faa30fddb7e7b61696b66fd069f51cf18c51125f` |
| Fonte W1 | `22b4e97cfbb22703eeedb34af3b33ba74d323806` |
| Árvore W1 | `8b36c0ebd5412251c15b33b6cb726fcbedddce45` |
| Runner R1, S | `dda8ba9d0624b921d7b206f96c55ea9aa25d4955` |
| Relação S → W1 | S tem W1 como pai único e altera somente `.ci-run.json`. |

Todos os paths abaixo são relativos a `modules/sucafina/Sucafinav1/`.

| Arquivo | Blob publicado e conferido |
| --- | --- |
| `runtime/local-contract.ts` | `d82b40928a235f2d249e45e59732f281dfded97f` |
| `runtime/local-identity.ts` | `473b9dbfe56092af26f0de2927767b8d64b79e1b` |
| `runtime/local-store.ts` | `7cca20a0fc9741c0b57bda9684e5e69fedcc027b` |
| `runtime/auth-maintenance.ts` | `af6e6749f7b61e07c419c90a264fdc48f3b32e21` |
| `local/entry.ts` | `04fa7d53b8f2a4d4f7375c0f069a6ae38523e877` |

Fontes: [commit W1](https://github.com/gustavomhss/Orchestra-SF/commit/22b4e97cfbb22703eeedb34af3b33ba74d323806), [commit S](https://github.com/gustavomhss/Orchestra-SF/commit/dda8ba9d0624b921d7b206f96c55ea9aa25d4955) e [requisição cirúrgica de R1](https://github.com/gustavomhss/Orchestra-SF/blob/dda8ba9d0624b921d7b206f96c55ea9aa25d4955/.ci-run.json).

## 3. Achado independente CR72-01 — resolvido

### Defeito observado no candidato anterior

`revoke()` removia a barreira local imediata em um `.finally()` incondicional. Um timeout de admissão do writer ou uma falha de COMMIT também removia essa barreira, apesar de a revogação não ter sido persistida. Uma autorização aguardando Graph dentro de uma transação de negócio poderia então concluir sem observar a intenção local de cancelamento.

O achado dizia respeito a um **logout que falhou e retornou 503**. Não foi feita alegação de ressurreição após um logout 204 já concluído com sucesso.

### Reparo conferido em W1

A resolução bem-sucedida do writer, depois do COMMIT, remove a entrada local. Em caso de falha, apenas a promise em andamento é liberada; a barreira permanece até uma tentativa durável bem-sucedida ou até seu horizonte fixo seguro. Uma tentativa posterior usa o handle original e pode persistir a revogação. Ela não renova o prazo.

Para um login, a barreira de uma tentativa fracassada cobre também a possibilidade de outro processo consumir o challenge enquanto o writer aguarda admissão. A coleta remove entradas fracassadas já vencidas, mantendo o mapa limitado.

### Evidência executada

A regressão **“CR72-01 failed durable logout keeps its fence until a successful retry”** usa um timeout real de lock de 40 ms, segura a chamada Graph dentro da transação de negócio, observa o primeiro logout 503, exige autenticação nula, repete o logout com resultado 204 e confirma a revogação após reabrir o armazenamento.

Resultado: **PASS** em R1, job `132682240447`, duração registrada de **87,26 ms**.

## 4. Invariantes conferidos

A correlação durável distingue challenge emitido, callback pendente, login concluído, sessão ativa e revogação. O consumo remove o ciphertext do challenge, mas preserva a correlação necessária para cancelar um callback pendente. Uma sessão nova exige o pai ainda pendente e válido; duas instâncias não podem consumir o mesmo challenge duas vezes nem criar mais de uma sessão derivada dele.

O logout de handles sintaticamente válidos nunca emitidos não cria linhas persistentes nem entradas no mapa local. A barreira para um handle conhecido é instalada antes do primeiro `await`. A leitura de autoridade consulta metadados comprometidos em conexão nova, preservando a observação de revogações entre instâncias e após restart.

Admissão, capacidade e transições ocorrem sob o writer SQLite. Uma nova admissão acima da política é recusada sem expulsar sessão válida ou marcador necessário. A substituição por refresh preserva a expiração absoluta e o sujeito; tokens ou pessoas inválidos continuam falhando de forma fechada. O AES-256-GCM e o AAD baseado na chave de armazenamento permanecem inalterados.

O mapa de refresh em andamento tem limite de admissão, inclusive quando promises antigas sobrevivem à expiração e à coleta de gerações anteriores. O collector usa índices de expiração e um orçamento total por lote. Para o backlog gerenciado finito, a prioridade a payloads não impede a drenagem: a quota bloqueia nova emissão enquanto o limite está ocupado.

A manutenção começa na composição, fora do escopo de uma requisição/transação de negócio, inclusive sem perfil de operador configurado. O descarte aguarda o lote admitido antes de fechar o store.

### Limites efetivos

| Recurso | Limite padrão |
| --- | --- |
| Registros lógicos persistentes | 4.096 |
| Challenges emitidos ou pendentes | 512 |
| Bytes totais de payload na admissão | 33.554.432, ou 32 MiB |
| Payload individual novo ou atualizado | 65.536 bytes, ou 64 KiB |
| Exclusões por lote, somando payloads e handles | 128 |
| Intervalo padrão de manutenção | 60.000 ms |
| Vida máxima do challenge | 600.000 ms, ou 10 minutos |
| Expiração absoluta máxima da sessão | 28.800.000 ms, ou 8 horas |
| Correlação de login consumido | Até expiração do challenge + 28.800.000 ms |

Um registro lógico é uma linha de emissão ou um payload legado sem linha correspondente. Há no máximo duas linhas gerenciadas de autenticação por registro lógico; **4.096 não é um limite de linhas SQL somadas**. O limite de bytes se refere aos payloads, não ao tamanho físico do arquivo SQLite. A política permite reduzir os limites e persiste o valor adotado entre instâncias/reaberturas.

Payloads e marcadores legados válidos continuam reconhecidos e contados. Sua conversão preserva a chave lógica; o backlog vencido é removido em lotes, sem migração em massa durante a abertura. A coexistência de binários antigos e novos em uma atualização gradual não foi exercitada.

## 5. Evidência B0 — controle antes da correção

| Elemento | Valor conferido |
| --- | --- |
| Run | [43671182262](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43671182262) |
| Job | [132681354612](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43671182262/job/132681354612) |
| Commit com controle | `0f93897311a41b938ff321e9734ba99c3e92e2a4` |
| Pai do controle | C28 `faa30fddb7e7b61696b66fd069f51cf18c51125f` |
| Runner | `e0a94d9c1b2abc6e957aa0886587fba8bca7a091` |
| Resultado | Falha esperada: 0 pass, 1 fail |

O commit de controle adiciona somente a fixture e o teste de handles desconhecidos; não modifica o código de produto C28. Seu runner acrescenta somente `.ci-run.json`.

Os logs mostram que 16 requisições de logout, cada uma com dois handles nunca emitidos, elevaram `authentication_payloads` de **1 para 33 linhas** e de **221 para 253 bytes**. Os 32 bytes acrescentados são marcadores legados; essa medição é de bytes da tabela de payloads, não uma alegação de que todos eles sejam ciphertext.

## 6. Evidência R1 — fonte corrigida

| Elemento | Resultado conferido |
| --- | --- |
| Run | [43671466268](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43671466268) |
| Job de testes | [132682240447](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43671466268/job/132682240447) — success |
| Job de cleanup | `132682737016` — success |
| Workflow / evento / tentativa | `.github/workflows/test-ci.yml` / push / 1 |
| Total | 140 testes em 11 arquivos |
| Resultado | **138 pass, 2 skip, 0 fail** |
| Asserções / duração dos testes | 1.279 `expect()`; 14,38 s |
| Regressões novas | **24 pass**, nos cinco arquivos próprios |
| Regressões existentes | 114 pass; 2 skips herdados |

Os cinco arquivos próprios foram `unknown-handles`, `retention`, `capacity`, `races` e `maintenance`. Os seis existentes foram `local-identity`, `local-store`, `microsoft-session`, `microsoft-entra-client`, `microsoft-configuration` e `operator-identity`.

As duas exclusões são os testes preexistentes de UID estrangeiro para diretório e arquivo de banco, que exigem privilégios de fixture root. Não são skips introduzidos pela missão72.

A nonce **`b347fa51a8af27ecaa03df6be0fb47ba`** do ambiente corresponde ao veredito Omni dos logs: **not applicable**, seleção focal sem teste declarante, spawn ou delegação Omni. Isso não constitui prova de Omni.

A consulta de artifacts retornou **zero artifacts**, resultado esperado para esta seleção Bun na interface existente. A evidência examinada é o log real do job. O cleanup concluiu com sucesso e a consulta independente posterior da ref `ci-run-linux-astra-m72-22b4e97c-retention-r1` retornou 404.

## 7. Preservação de readonly59 e composição pendente

O diff de `local-store.ts` contra C28 está limitado à inicialização e ao contrato de segredos de autenticação. As quatro alterações de readonly59 — marcação da raiz readonly, envenenamento na tentativa de escrita após dispose, implementação de `readSnapshotRoot` e proteção da transação aninhada após dispose — não são substituídas pelo patch fonte72.

Os espelhos readonly59 e as propostas de composição continuam inertes. Identifiquei também um problema de escopo no primeiro teste proposto de composição: o logout era lançado dentro do callback de `readSnapshotRoot`, herdando AsyncLocalStorage e tentando uma escrita aninhada proibida. A proposta foi corrigida para iniciar o logout fora desse callback e liberar Graph antes de aguardar o writer enfileirado.

Os dois testes próprios de composição readonly59 permanecem **INERT_NOT_RUN** e foram excluídos de R1. O ponteiro/mapa Microsoft49 também não foi instalado na branch fonte. Não afirmo PASS de `microsoft-composition`, de readonly59 + missão72 ou do target de 71.

## 8. Conclusão e autoridade

**PASS / NO_BLOCKING_FINDING para a rechecagem limitada de W1 + R1.** O achado CR72-01 está resolvido no código publicado e na regressão executada. Não há outro achado bloqueante aberto no escopo revisado.

Continuam fora desta conclusão: compilador/guards de 45, aplicação e execução da composição por 71, prova de tenant Microsoft real, integração global e aceitação FINAL. As evidências são de código-fonte e testes cirúrgicos hospedados; não substituem essas autoridades.

Data da conferência: 2026-11-15 03:18:19 UTC.
