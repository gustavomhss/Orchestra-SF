# Teams Profile — execução

## Base e plano

- Plano aprovado: `3148412a24f9fbdcc22149b47cf739dbd539eb8d`.
- Produto congelado: `687759276c2c9121c2cfd20a5994b277ceb7ee4d`, tree `c3ac6f64b79e75fc5a178c90692f36435e99d236`.
- Branch isolada: `teams-profile-work`.
- Os 24 blobs do plano foram portados sem copiar o código antigo da branch documental. A comparação documental revelou ancestral comum `f7dd58e32bc834f1485df20b91adbf759b4c4ad0`, 7 commits documentais de um lado e 33 de produto do outro.

## Baseline observada

Os snapshots abaixo têm parent único igual ao pin e alteram somente `.ci-run.json`. Os logs foram lidos; seleção e contagens foram reconciliadas com cada request normativo. As contagens não são prova do candidato novo.

| Receita | Arquivos | Pass | Fail | Skip | Run |
|---|---:|---:|---:|---:|---|
| TP-030 | 7 | 45 | 0 | 0 | [44676827296](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676827296) |
| TP-034 | 18 | 267 | 0 | 1 | [44676829864](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676829864) |
| TP-001 | 24 | 72 | 0 | 0 | [44676833630](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676833630) |
| TP-021 | 22 | 248 | 0 | 1 | [44676836570](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676836570) |
| TP-004 | 8 | 40 | 0 | 0 | [44676936519](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676936519) |

O skip de ownership estrangeiro requer privilégio de fixture e permanece pendente; o caso nativo Windows está fora do alvo Linux e não é contado como pass. Nenhum skip novo foi criado.

A baseline integrada via `workflow_dispatch` permanece NOT_RUN: a conexão GitHub disponível não expõe essa operação. Não foi usado um merge sintético de PR como evidência do pin.

## Frentes em implementação

Contrato Schema canônico, leitor Graph opt-in, binding à sessão Microsoft real e correção preparatória F04. Cada frente possui branch isolada, proprietário de arquivos e testes pelas Actions. A UI e os dados não são cortados para um backend incompleto.

## Condições ainda abertas

O censo real de dados/atores, o ledger final de resíduos, o ambiente Azure descartável, o consentimento e os contextos Microsoft originais não foram observados. Não há migration, restore, tenant LIVE ou release qualificados. Os dez gates do plano continuam obrigatórios no mesmo candidato final.

A integração concorrente foi observada em `3910a644c7fdab1a438c2b5b39d69afc19361709`, 129 commits à frente do pin. Esses patches não foram misturados silenciosamente; a reconciliação antes de promoção continua obrigatória.

O [ledger estruturado](./TEAMS-PROFILE-EXECUTION.json) registra requests, SHAs de fonte/snapshot, todos os casos observados, deltas e bloqueios. Este documento é um checkpoint de execução, não um handoff de conclusão.
