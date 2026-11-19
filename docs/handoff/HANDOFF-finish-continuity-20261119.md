# Handoff — finish-continuity-20261119

SHA: 064e75a88b9214a317df9e538d87c2fb3f2bd576 (código em verificação; este handoff é o commit documental seguinte)
Data: 2026-11-19
Estado: partial

## Feito

- `product/collaboration/authority.ts:127`: referências de thread e mensagens são unidas somente dentro de cada passe de autorização, pela representação canônica do corpo completo. Diferenças de campos, versão, período, instalação ou projeto continuam sendo autorizadas separadamente. Não há cache entre chamadas.
- `test/product/wp08/threads-context.test.ts:57`: acrescenta negativas para referências com mesmo ID mas corpos diferentes e confirma revogação/restauração de fonte entre chamadas com o mesmo contexto.
- Contexto, fontes atuais/históricas, destinatários e as verificações de commit/releitura continuam usando os produtores originais.
- Gate [44585501284](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44585501284): **failure**, 8 pass / 3 fail / 148 expect, quatro arquivos em 145,56 s. Job de teste `135777201508` failure; cleanup `135780466281` success.
- Os controles de referência/contexto e os seis testes de recipient-receipt-fences passaram, incluindo revogação antes do retry, após o leitor final, no lease C05, no commit e substituição física com mesmo ID. O caso de janeiro sem continuidade em fevereiro passou.

## Pendente

- `modules/sucafina/Sucafinav1/test/product/wp08/thread-period-continuity.test.ts:17`: Hot Topic day 30,43 s e project year 30,51 s; ambos excedem o limite original de 5 s. Nenhum erro de expect foi registrado, mas ambos os testes falharam.
- `modules/sucafina/Sucafinav1/test/product/wp08/thread-actors.test.ts:10`: cenário de participantes/homônimo 11,95 s, acima do limite original de 5 s. Este consumidor foi incluído para medir a mesma cadeia de autorização.
- `modules/sucafina/Sucafinav1/product/collaboration/host.ts:208`: próximo ponto concreto de investigação é o fallback de membership que reabre a thread duas vezes; existe uma checagem direta de identidade para C05 em 202–212. Nenhuma alteração foi aplicada ali neste SHA.
- Não abrir/mesclar esta fatia como qualificada até obter resultado apropriado para os consumidores acima.

## Decisões e justificativas

- Asserções removidas: nenhuma. Nenhum timeout aumentado; nenhuma mudança de assertions para aceitar falhas.
- A igualdade usa `canonicalSfValue(ref)`, não refId/refDigest ou valores de exibição. O array transitório deixa de existir ao final do passe; todas as chamadas posteriores reabrem a autorização.
- A mudança elimina trabalho duplicado confirmado, mas o gate mostra que não basta. Não é uma alegação de correção completa de performance.
- Não houve cache de autoridade entre chamadas/mutações, wrapper readSnapshotRoot em mutações, alteração de application.ts, workflow, suíte, baseline, coverage ou receipt.
- O diagnóstico anterior com sementes mínimas (run 44581002299) também excedeu o limite; essas alterações diagnósticas não foram incorporadas.

## Como retomar

1. Partir desta branch, cuja base é `ab1173bb0967a4c509baec1c7fe713c6776123f4`.
2. Investigar o trabalho repetido da checagem de membership em host.ts, mantendo as leituras autorizadas de answer/scope, observações, fences e revalidação do contexto.
3. Executar novamente somente os consumidores abaixo após uma correção concreta. Não esconder os cenários em hooks ou retirar negativos.
4. Root coordena a auditoria agregada futura; nenhum sf-ci completo foi disparado por esta fatia.

## Comandos e resultados

```json
{"package":"sucafina","runner":"bun","args":["Sucafinav1/test/product/wp08/threads-context.test.ts","Sucafinav1/test/product/wp08/thread-actors.test.ts","Sucafinav1/test/product/wp08/recipient-receipt-fences.test.ts","Sucafinav1/test/product/wp08/thread-period-continuity.test.ts"]}
```

- Código: `064e75a88b9214a317df9e538d87c2fb3f2bd576`.
- Snapshot: `6babc13af5d07b0858c8e22f25a3425d322ab34c`.
- Branch CI: `ci-run-linux-threadrefs-20261119`; cleanup success.
- Run `44585501284`: completed/failure, 8 pass / 3 fail / 148 expect.
- Typecheck app-shell/SF E2E e guards: não rodados por esta fatia.
- Nenhuma execução local ou acesso à máquina do dono. Sem declaração de GO.
