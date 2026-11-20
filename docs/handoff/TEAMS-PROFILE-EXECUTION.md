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

## Implementação e evidência dirigida

As fatias abaixo foram incorporadas à branch isolada. Seus resultados pertencem aos respectivos SHAs de fonte; não são uma qualificação do candidato final.

| Fatia | Fonte testada | Arquivos | Pass | Fail | Skip | Run |
|---|---|---:|---:|---:|---:|---|
| Schema TeamProfile estrito | `d8fc9a2e` | 8 | 68 | 0 | 0 | [44677405980](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44677405980) |
| Contrato preparatório F04 v1 | `616e94c1` | 9 | 52 | 0 | 0 | [44677469998](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44677469998) |
| Wiring da configuração privada | `8de13695` | 3 | 14 | 0 | 0 | [44678489644](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44678489644) |
| Graph + sessão + configuração | `f719dfd0` | 19 | 347 | 0 | 1 | [44678772113](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44678772113) |
| Grupo administrativo e Team por ID | `057909d7` | 10 | 294 | 0 | 0 | [44679808152](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44679808152) |
| Captura de uma geração de sessão + leitores | `d76b74ec` | 20 | 434 | 0 | 1 | [44679893363](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44679893363) |

Os recortes se sobrepõem; suas contagens não devem ser somadas como casos únicos. O skip é o mesmo caso preexistente de ownership estrangeiro, ainda pendente.

O login mínimo continua restrito; `teams: "direct"` habilita explicitamente a leitura delegada de Teams. Escopos omitidos no refresh não herdam consentimento. O leitor distingue lista completa vazia de erro, valida tenant/principal e limita tempo, páginas e bytes. A sessão privada fornece uma closure com revalidação da mesma geração, sem exportar cookie ou tokens. O grupo administrativo é verificado independentemente de Team e de RoleRows; essas observações ainda não concedem acesso de negócio.

Foram observadas e corrigidas duas falhas reais: o primeiro teste do prazo máximo do Graph expirou, e o primeiro recorte combinado encontrou uma fixture que passava array onde o provedor esperava texto de escopos. O timer passou a pertencer à operação; o orçamento original do teste permaneceu igual. A fixture foi corrigida e recebeu prova adicional de perda de consentimento após refresh. Os runs vermelhos permanecem registrados no ledger.

## Trabalho em andamento

O store de configuração de Teams, a admissão pelo grupo supremo e a rota administrativa nativa estão em implementação. O pool G04 preserva os 40 arquivos fonte, com uma entrada única e atribuição por caso; sua qualificação ainda depende da execução real e do encerramento verificado do browser.

A workflow existente `.github/workflows/sf-static-surgical.yml` foi reconciliada individualmente do commit `3910a644…`, blob `e587b7bc6030ff4646b813892484f8a456b6040b`. Seus 16 comandos reais, guards sem aprovação fornecida e agregação de falha foram preservados. Ela permite observar geração, typechecks e build no candidato exato; ainda não foi executada nesta branch e não substitui `sf-ci`/`sf/verify`.

A UI, os consumidores de runtime e os dados ainda não foram cortados para Teams. Nenhuma migration real foi executada.

## Condições ainda abertas

O censo real de dados/atores, o ledger final de resíduos, o ambiente Azure descartável, o consentimento e os contextos Microsoft originais não foram observados. Não há migration, restore, tenant LIVE ou release qualificados. Os dez gates do plano continuam obrigatórios no mesmo candidato final.

A integração concorrente foi observada em `3910a644c7fdab1a438c2b5b39d69afc19361709`, 129 commits à frente do pin. Esses patches não foram misturados silenciosamente; a reconciliação antes de promoção continua obrigatória.

O [ledger estruturado](./TEAMS-PROFILE-EXECUTION.json) registra requests, SHAs de fonte/snapshot, todos os casos observados, deltas e bloqueios. Este documento é um checkpoint de execução, não um handoff de conclusão.
