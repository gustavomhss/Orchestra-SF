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
| Schema da administração | `d2d7f41d` | 2 | 36 | 0 | 0 | [44680846131](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44680846131) |
| Store, política e admissão | `7659410d` | 5 | 123 | 0 | 2 | [44681667744](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44681667744) |
| HTTP administrativo e composição | `0fd69df9` | 5 | 43 | 0 | 0 | [44681871603](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44681871603) |
| HTTP final: aborto e stream sem EOF | `1bde9f6e` | 1 | 21 | 0 | 0 | [44682045589](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44682045589) |

Os recortes se sobrepõem; suas contagens não devem ser somadas como casos únicos. Os skips são fixtures preexistentes de ownership estrangeiro: backup e, no recorte do store, diretório e banco. Elas exigem privilégios de root e continuam pendentes; não contam como pass.

O login mínimo continua restrito; `teams: "direct"` habilita explicitamente a leitura delegada de Teams. Escopos omitidos no refresh não herdam consentimento. O leitor distingue lista completa vazia de erro, valida tenant/principal e limita tempo, páginas e bytes. A sessão privada fornece uma closure com revalidação da mesma geração, sem exportar cookie ou tokens. O grupo administrativo é verificado independentemente de Team e de RoleRows; essas observações ainda não concedem acesso de negócio.

Foram observadas e corrigidas duas falhas reais: o primeiro teste do prazo máximo do Graph expirou, e o primeiro recorte combinado encontrou uma fixture que passava array onde o provedor esperava texto de escopos. O timer passou a pertencer à operação; o orçamento original do teste permaneceu igual. A fixture foi corrigida e recebeu prova adicional de perda de consentimento após refresh. Os runs vermelhos permanecem registrados no ledger.

## Administração preparatória incorporada

O catálogo usa tabelas próprias do SQLite privado, vinculadas à instalação e ao tenant, com revisão monotônica, CAS e auditoria na mesma transação. A configuração do grupo supremo é relida; a associação corporativa e a geração da sessão são rechecadas depois de lookups e da fila do escritor. Configurar profiles não altera role maps, grants, credenciais nem registros de negócio.

A rota `/api/ui/team-profiles`, sob o mount da instalação Microsoft, aceita somente o contrato versionado e a referência exata de instalação/tenant. O POST valida origem, JSON estrito, duplicatas, UTF-8, limite de 8 KiB, Content-Length e fim real do stream, com prazo próprio de cinco segundos. A composição real e o caso de cancelamento que nunca resolve passaram em CI. O handle do resolver prova somente elegibilidade; ainda não emite a revisão efetiva de autoridade de negócio.

A revisão independente do store/resolver não encontrou bloqueante nesta fatia. Ela não qualifica rewind físico do banco nem integridade completa da história de auditoria; essas obrigações permanecem abertas.

## Pool G04: infraestrutura incorporada, execução vermelha

Os 40 arquivos originais são registrados por uma única entrada Bun, com startup, consumidores e finalizador originais. A comparação dos 40 pares de blobs confirmou equivalência dos corpos, assertions e prazos após normalizar apenas wrapper/import/indentação. O pool passou a ser pré-requisito obrigatório de `sf/verify`, mantendo as oito suites atuais.

O contrato Node passou com 138 casos em [44680523755](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44680523755); a integração do gate passou com 139 casos em [44680862794](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44680862794). Esses resultados não substituem browser real.

A execução real [44680535224](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44680535224) **falhou**. O Bun reportou 11 pass e 196 fail, além de um erro. O journal distingue 206 casos declarados de **46 corpos iniciados e terminados**: 11 retornaram, 35 lançaram erro e 160 não iniciaram. O registry recusou a continuação após execução incompleta; não existe recibo G04 positivo.

O finalizador original passou: 43 leases e 43 releases, zero contextos e processos encerrados. Isso prova cleanup, não sucesso dos consumidores. Falhas de criação, forecast, autorização/HTTP e fixtures históricas continuam abertas. Um pin de loader já divergente do contrato no produto congelado foi preservado, sem revalidar hashes históricos artificialmente.

## Checagem estática comparada

A workflow `.github/workflows/sf-static-surgical.yml` veio do commit `3910a644…`, blob original `e587b7bc6030ff4646b813892484f8a456b6040b`, com os 16 comandos canônicos e os dois guards reais. Ela foi reforçada para recusar prova positiva quando arquivos tracked mudarem durante a execução.

A observação da base [44680974070](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44680974070) preservou o produto congelado e adicionou somente a workflow. Geradores, compiladores, build web, spawn e guard da base de PR passaram. O guard contra `dev` falhou pelas alterações protegidas preexistentes em `godfile-waivers.json` e `script/spawn-allowlist.json`; nenhuma aprovação foi fornecida.

O primeiro candidato [44680970442](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44680970442) encontrou dois erros novos de inferência de tipos em tabelas de testes e um falso positivo de skip na fixture que verifica sua rejeição. O commit `5c419bf3…` preserva os tipos literais e explicita o registrar sintético; não remove assertions nem pula casos. A nova observação do conjunto integrado ainda precisa ser registrada.

## Trabalho restante

A autoridade efetiva de negócio e a cadeia F02/host ainda não foram migradas. UI/estado pessoal (WP2), ownership e consumidores de runtime (WP3), backfill/corte/recuperação (WP4) e qualificação/retirada (WP5) permanecem trabalho de implementação. A ausência de contextos externos não deve ser usada para apresentar esse código restante como concluído.

Nenhuma migração real de dados ou troca de autoridade de produção foi executada.

## Condições ainda abertas

O censo real de dados/atores, o ledger final de resíduos, o ambiente Azure descartável, o consentimento e os contextos Microsoft originais não foram observados. Não há migration, restore, tenant LIVE ou release qualificados. Os dez gates do plano continuam obrigatórios no mesmo candidato final.

A integração concorrente foi observada em `3910a644c7fdab1a438c2b5b39d69afc19361709`, 129 commits à frente do pin. Esses patches não foram misturados silenciosamente; a reconciliação antes de promoção continua obrigatória.

O [ledger estruturado](./TEAMS-PROFILE-EXECUTION.json) registra requests, SHAs de fonte/snapshot, todos os casos observados, deltas e bloqueios. Este documento é um checkpoint de execução, não um handoff de conclusão.
