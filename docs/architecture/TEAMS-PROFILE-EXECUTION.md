# Teams Profile — execução

## Estado atual — checkpoint 265d3811

Implementação em andamento, sem qualificação final. A UI Web nativa, o workspace de sessões, a configuração compartilhada de Team e o adaptador técnico de sessões estão incorporados. A regressão HTTP 500 no boot corporativo foi corrigida no consumidor de Inbox; o corte dirigido de Core Sessions e a barreira real passaram após corrigir a notificação de observadores do Effect. Esses resultados têm escopo e fontes próprios: a migração continua declarando `installationComplete: false`.

A jornada completa de navegador G02 ainda está vermelha no prazo original de sete segundos, com prompt e leitura de mensagens pendentes. O recorte HTTP/SSE corrigido passou em 12 testes e foi integrado; a próxima observação conjunta do navegador continua pendente. BEFORE e AFTER de desempenho têm 18 execuções completas cada, mas as medianas de troca de abas regrediram **11,4% a 24,8%**, sem causa de tempo demonstrada. O pool G04, o artefato instalado, a recuperação completa e os demais gates permanecem abertos.

Fonte integrada deste checkpoint: [265d3811d6c44ed3f62908d3b455122fbbf65b88](https://github.com/gustavomhss/Orchestra-SF/commit/265d3811d6c44ed3f62908d3b455122fbbf65b88). Todos os dez gates continuam `NOT_RUN_ON_FINAL_CANDIDATE`. Os checkpoints abaixo são históricos; o novo checkpoint ao final e o ledger JSON atualizam as pendências sem reescrever os runs anteriores.

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

Os 40 arquivos originais são registrados por uma única entrada Bun, com startup, consumidores e finalizador originais. No source inicial `b7b9f75d`, a comparação dos 40 pares de blobs confirmou equivalência dos corpos, assertions e prazos após normalizar apenas wrapper/import/indentação. Essa equivalência não é atribuída às correções posteriores de fixtures e produtores, que têm deltas e evidência próprios. O pool passou a ser pré-requisito obrigatório de `sf/verify`, mantendo as oito suites atuais.

O contrato Node passou com 138 casos em [44680523755](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44680523755); a integração do gate passou com 139 casos em [44680862794](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44680862794). Esses resultados não substituem browser real.

A execução real [44680535224](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44680535224) **falhou**. O Bun reportou 11 pass e 196 fail, além de um erro. O journal distingue 206 casos declarados de **46 corpos iniciados e terminados**: 11 retornaram, 35 lançaram erro e 160 não iniciaram. O registry recusou a continuação após execução incompleta; não existe recibo G04 positivo.

O finalizador original passou: 43 leases e 43 releases, zero contextos e processos encerrados. Isso prova cleanup, não sucesso dos consumidores. Falhas de criação, forecast, autorização/HTTP e fixtures históricas continuam abertas. Um pin de loader já divergente do contrato no produto congelado foi preservado, sem revalidar hashes históricos artificialmente.

## Checagem estática comparada

A workflow `.github/workflows/sf-static-surgical.yml` veio do commit `3910a644…`, blob original `e587b7bc6030ff4646b813892484f8a456b6040b`, com os 16 comandos canônicos e os dois guards reais. Ela foi reforçada para recusar prova positiva quando arquivos tracked mudarem durante a execução.

A observação da base [44680974070](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44680974070) preservou o produto congelado e adicionou somente a workflow. Geradores, compiladores, build web, spawn e guard da base de PR passaram. O guard contra `dev` falhou pelas alterações protegidas preexistentes em `godfile-waivers.json` e `script/spawn-allowlist.json`; nenhuma aprovação foi fornecida.

O primeiro candidato [44680970442](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44680970442) encontrou dois erros novos de inferência de tipos em tabelas de testes e um falso positivo de skip na fixture que verifica sua rejeição. O commit `5c419bf3…` preserva os tipos literais e explicita o registrar sintético; não remove assertions nem pula casos. O conjunto integrado `c232ce48` passou em 522 testes dirigidos, com zero falhas e três skips preexistentes de fixtures de UID ([44682417711](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44682417711)). A estática no mesmo source ([44682415652](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44682415652)) permaneceu vermelha: nove erros novos de tipagem em fixtures de testes, já corrigidos nas branches de implementação e ainda sem nova prova estática integrada. O guard contra dev continuou com os dois caminhos protegidos preexistentes; nenhuma aprovação foi fabricada.

## Scanner real incorporado

A fatia `6f9b66a2` acrescenta uma admissão de CI própria de Teams, vinculada ao SHA/tree da fonte e a um snapshot que muda somente `.ci-run.json`. Não se apresenta como a campanha histórica de Operations. O setup preserva o binário ClamAV pinado, as assinaturas oficiais e as três fontes originais do controle.

O verificador passou em **59 testes Node** ([44684026214](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44684026214)). O controle real passou em **7 testes, zero falhas e zero skips**, com **4 spawns Omni** ([44684352036](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44684352036)). Foram observados clean/EICAR/limite de tamanho/comando inválido/outage e as fronteiras privadas de importação e upload. O cleanup dos processos de propriedade do job terminou antes da emissão do recibo positivo.

O recibo declara `COMPONENT_REAL_CLAMD` e `installedTeamsProof: false`. Esse PASS pertence àquela fonte; G06 continua obrigatório no candidato final.

## WP1 efetivo e transportes: integração coesa

A autoridade efetiva passou em **111 testes, zero falhas e zero skips** na fonte `1a15b862` ([44686263757](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44686263757)). Ela relê os grants privados atuais, preserva as RoleRows reais e distingue configRevision de accessRevision. O primeiro run falhou porque a fixture não inicializava as fontes reais; a correção fez a mesma inicialização da composição, sem enfraquecer o guard.

O boundary de Request e a composição Microsoft passaram em **76 testes, zero falhas e zero skips**, na fonte `2a185381` ([44687661604](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44687661604)). O mesmo Request retém intenção, cookie e observação de sessão; alteração, refresh, logout, revogação e mudança de política invalidam o holder. Application/Bi usam o boundary de Team; a autoridade de produto recebe o autenticador original e aplica a própria guarda. A administração independente continua possível sem Team.

Os dois runs anteriores do boundary permanecem no ledger: 63 pass/13 fail e 75 pass/1 fail. O último revelou uma leitura de ambiente antes da resposta de logout, corrigida para admitir a rota antes daquela leitura. Os testes Microsoft antigos agora configuram o Team por login OIDC e endpoint administrativo reais da fixture; todas as assertions de role, ownership e códigos de resposta foram mantidas, com uma negativa nova para ausência de seleção.

A integração coesa foi feita em `50389115`: os contratos, transportes, boundary e todos os leitores de recibos entraram juntos. As correções seguintes chegaram a `b3b3dc5d`. O recorte de 36 arquivos passou em 675 casos, zero falhas e 3 skips preexistentes na fonte `b47d294d` ([44693507647](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44693507647)); os 4750 asserts incluem o isolamento entre dois usuários Microsoft. A primeira execução 5038 falhou no limite de 30 s desse caso; leituras independentes do mesmo snapshot foram paralelizadas, mantendo todas as assertions e o orçamento original. O caso passou em 23,09 s.

## Continuação G04 e fronteira de geração

A nova execução dos 40 arquivos, fonte `b8cd7308` ([44687241318](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44687241318)), continua **RED**. O journal registra 206 casos declarados, **149 corpos iniciados e finalizados**, 50 retornos e 99 exceções; 57 corpos não iniciaram. O Bun reporta 50 pass/157 fail e um erro. O finalizador original passou com 44 leases/releases, zero contextos e saída do driver/browser. A prova de cleanup não fecha G04.

Os waiters de recuperação de edição passaram a ter dono e erro recolhido na limpeza, mantendo os 29 corpos e 213 assertions. O replay e o timeout do save mensal chegaram ao resultado, mas dois casos detectaram que o render voltava ao valor inicial depois da confirmação; a correção está em andamento. A interrupção seguinte vem de waiters de recuperação de thread. As falhas dos demais produtores e pins históricos permanecem visíveis.

WP3 e WP4 agora compartilham um contrato privado de geração e ownership, ainda em implementação. A proteção de writer antigo será exercitada com conexões SQLite reais; não basta um if no handler nem uma flag global visível. Nenhum corte está liberado por esses contratos.


## Clientes, bootstrap e recibos observados

F02 passou em 55 testes; clientes Web, em 27. A composição real de Chromium com cookies HttpOnly, OIDC assinado, F02, negócio/admin e SQLite passou em 16 testes ([44687361580](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44687361580)). É prova de componente G02, não G04/F04 LIVE/G08. O bootstrap pelo NodeHttpServer real e proxy HTTPS explícito passou em 29 testes; Host incorreto continua421 e rotas privadas não herdam o acesso público à metadata ([44692440311](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44692440311)).

Os três clientes foram produzidos pelo gerador oficial, importando bytes com o mesmo Git blob SHA. A verificação oficial contra 50389115 terminou com exit 0 e diff vazio ([44691585626](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44691585626)).

O recorte final dos consumidores de recibos passou em 119 testes/31 arquivos ([44691159492](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44691159492)). Uma reserva sem recibo final continua indeterminada e impede redispatch; a leitura de recibo ausente permanece not-found. O teste AM01 de inferência instalada foi explicitamente excluído desse recorte: falhou também no baseline 1a15 com installed-host-catalog-empty, sem execução de inferência. Nenhum timeout, skip ou assertion foi alterado para contorná-lo. As primeiras execuções 118/2 e115/1 estão no ledger.

## Sessões, geração e UI em implementação

A baseline de 20 arquivos Core passou em 168 casos. SessionOwner e os handlers Server/CLI continuam em implementação e têm evidência própria, ainda sem qualificação corporativa final.

A fronteira de geração passou em 45 testes reais de SQLite/EffectDrizzle na fonte a3f8dd36 ([44693660695](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44693660695)). Ela bloqueia statements preparados antes do corte, impede empréstimo de conexão por outro fiber, não rouba leases por TTL e mantém rollback. Um marker existente vazio e um control store incompleto são erros, nunca um banco técnico. O control file privado recusa symlink, hardlink, outro UID e permissões abertas. A autoridade fica fora do snapshot de negócio; isso ainda não implementa nem qualifica todo o backfill/corte/restore.

O primeiro gerador oficial  de SessionOwner revelou a emissão de PK textual nullable apesar de .notNull no Drizzle. A revisão acrescentou uma CHECK explícita na fonte; a geração intermediária não será adotada nem tratada como schema final. Não se editaram migrations históricas à mão.

WP2 teve 138 passes em 30 arquivos de Bun/HappyDOM. Esses casos não são Chromium. A composição nativa Solid, a integração de New chat e os testes reais de duas janelas continuam em desenvolvimento.

## Atualização do pool completo de navegador

A fonte 87f2f961 executou todos os 206 corpos: 87 retornos e 119 exceções; o Bun reportou 87 pass/120 fail contando a verificação do pool. G04 continua RED ([44691251659](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44691251659)).

O loader histórico de recipient foi corrigido por cópia dos dois blobs originais exatos, sem atualizar os hashes esperados e sem reverter código de produção. A revisão independente confirmou que somente funções stateless são empacotadas; contexto e autoridade permanecem singletons externos. Isso continua COMPONENT_HISTORICAL. As execuções seguintes 62feb940 e a5700f09 encontraram waiters sem dono e diferenças de controles de reply, terminando com 19 e 18 corpos respectivamente; não se confundem os 63/61 resultados agregados do Bun com 206 casos executados. As correções estão isoladas e ainda não integradas.

## Trabalho restante

A autoridade efetiva de negócio, a cadeia F02/host, os clientes oficiais e os leitores de recibos foram integrados. A estática corrigida está sendo executada e não é presumida verde. UI/estado pessoal (WP2), ownership e consumidores de runtime (WP3), backfill/corte/recuperação (WP4) e qualificação/retirada (WP5) permanecem trabalho de implementação. A ausência de contextos externos não deve ser usada para apresentar esse código restante como concluído.

Nenhuma migração real de dados ou troca de autoridade de produção foi executada.

## Condições ainda abertas

O censo real de dados/atores, o ledger final de resíduos, o ambiente Azure descartável, o consentimento e os contextos Microsoft originais não foram observados. Não há migration, restore, tenant LIVE ou release qualificados. Os dez gates do plano continuam obrigatórios no mesmo candidato final.

A integração concorrente foi reobservada em `9d3a70179cc1ced293c58d4dfc032d5d2aa41bf6`, 158 commits à frente do pin, sendo 29 após a primeira observação em `3910a644…`. Esses patches não foram misturados silenciosamente; a reconciliação antes de promoção continua obrigatória.

O [ledger estruturado](./TEAMS-PROFILE-EXECUTION.json) registra requests, SHAs de fonte/snapshot, todos os casos observados, deltas e bloqueios. Este documento é um checkpoint de execução, não um handoff de conclusão.

## Checkpoint de integração: Session, SDK e manutenção técnica

Fonte integrada: [`e00e7c20`](https://github.com/gustavomhss/Orchestra-SF/commit/e00e7c20f5a0a486cd20024110aa0f03b72d11b3).
Os 58 caminhos desta integração incluem o namespace canônico, o HTTP sobre o mesmo grafo do host,
o SDK gerado pelo comando oficial, a inspeção atual de política e a ligação ao Request original no entry instalado.
O operador local mantém autenticação e manutenção técnica; não recebe grants de negócio e os endpoints de negócio recusam sua sessão.

| Evidência dirigida | Resultado | Run |
|---|---:|---|
| Core integrado anterior, 26 arquivos | 239 pass, 0 fail, 1 skip Windows preexistente | [44699164293](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44699164293) |
| SF integrado anterior, 8 arquivos | 115 pass, 0 fail | [44699170834](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44699170834) |
| Admissão opaca de migração, 4 arquivos | 100 pass, 0 fail | [44699894969](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44699894969) |
| HTTP corporativo e regressões, 12 arquivos | 63 pass, 0 fail | [44701581257](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44701581257) |
| Gerador canônico importado, 6 arquivos | 90 pass, 0 fail | [44701345189](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44701345189) |
| Geração oficial de três arquivos | exit 0; blobs conferidos | [44701673378](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44701673378) |
| SDK instalado / técnico, execuções separadas | 7 / 4 pass, 0 fail | [44702157391](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44702157391), [44702158466](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44702158466) |
| Operador técnico e manutenção SQLite | 26 pass, 0 fail | [44702250679](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44702250679) |

A geração preserva o filtro que impede Owner entre tenants. O modo importado é explicitamente vinculado ao ClientApi original; o modo standalone continua recusando schemas não portáveis.
A inspeção de autorização combina perguntas na mesma fronteira sem cache entre operações assíncronas e mantém revogação, recurso e geração atuais.

O pool G04 inteiro continua **RED**: 96 pass e 111 fail reportados pelo Bun,
com 206 corpos iniciados/finalizados, 96 retornos e 110 exceções, sem finalização forçada
([44698645708](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44698645708)).
A correção de recibo do destinatário preserva três respostas concorrentes idênticas e confirma a mensagem exata;
as famílias de decisão/cenário ainda estão em reparo.
O Web real construído também continua em diagnóstico; 156 testes de unidade/HappyDOM não equivalem a G02 instalado.

No static anterior, 15 verificações passaram e guard-dev recusou os dois arquivos protegidos sem aprovação
([44699059541](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44699059541)).
A aprovação não foi fabricada. Static e integração do novo source estão em execução.

G07 agora distingue factory técnica, pacote Web/native e o tar SF de produção, com inventário e hashes do arquivo real.
Essas alterações de pacote ainda não foram executadas na PR qualificadora. O motor de backfill/corte/restauração
e as provas Microsoft/Azure G08/G10 continuam pendentes. Nenhum corte, restauração viva ou deploy foi realizado.

A primeira rodada SF no source `e00e7c20` também passou: **149 pass, 0 fail, 13 arquivos, 1273 assertions** ([44702867050](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44702867050)).

## Checkpoint: tipos integrados e fronteira de restauro

Fonte integrada: [79bfaa5a](https://github.com/gustavomhss/Orchestra-SF/commit/79bfaa5a8d487b8453d1d35e74b2e65c0b50ae36).
O HTTP usa os grupos canônicos com contexto privado explícito do mesmo grafo.
CLI, ACP e TUI técnicos recusam envelopes corporativos antes de adotar ou expor os dados.

| Evidência dirigida | Resultado observado | Run |
|---|---:|---|
| HTTP integrado em e00e, 12 arquivos | 63 pass, 0 fail, 511 assertions | [44702863723](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44702863723) |
| Static integrado em ea8806, árvore idêntica | 15 comandos passaram; guard-dev bloqueado pelos dois arquivos protegidos | [44707320463](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44707320463) |
| Primeiro restauro dirigido, 7 arquivos | 60 pass, 5 fail, 1 skip preexistente | [44706205693](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44706205693) |
| Restauro C08 e regressões, 6 arquivos | 63 pass, 0 fail, 1 skip preexistente, 334 assertions | [44707605762](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44707605762) |

O restauro preserva os mapas atuais de autorização, inclusive vazios ou ausentes,
e o estado C08 acoplado com seus recibos e transações. A prova cria um caso por
admissão Microsoft assinada, restaura um checkpoint anterior, recria a autoridade
e repete a intenção original sem duplicar o caso. Perda de recibo, mudança de
incarnation e substituição incerta de blob recusam a restauração atomicamente.

A primeira execução expôs duas falhas na composição do teste: a lease de UI ainda
não consumida e a conversão incompleta do principal em Actor. Foram corrigidas
usando os contratos reais, sem reduzir assertions. A prova parity-pitr também
falhou pela ausência do executável Litestream fixado; continua separadamente
pendente e não foi contabilizada como coberta pela rodada de seis arquivos.

Nenhuma migração de instalação, corte de autoridade, restauração Azure ou
qualificação Microsoft real foi executada. O journal/corte do Core, o fechamento
dos demais produtores e os gates no candidato final permanecem abertos.

O coordenador de Session recebeu uma operação privada de fechamento permanente,
também aplicada ao final do seu Scope. A suíte original e os cinco controles de
concorrência passaram: **33 pass, 0 fail, 103 assertions**
([44708472156](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44708472156)).
A barreira recusa bind tardio, novos wakes e novos trabalhos exclusivos, suprime
sucessores e aguarda todos os finalizadores. Esse resultado não atesta que
scheduled tasks, hooks ou efeitos externos estejam drenados.


## Checkpoint: configuração, execução e recuperação das decisões

Fonte integrada: [0e0aafdd](https://github.com/gustavomhss/Orchestra-SF/commit/0e0aafdd2cd6af86a12766c22926c155f275792a).
A configuração compartilhada de Team usa a lease atual do Request original e CAS;
a execução exclusiva aguarda sua própria finalização privada sem esperar o sucessor coalescido.
As correções de decisões mantêm corpo e chave de intenção nos retries, exigem a admissão
atual e recusam respostas tardias depois da perda de acesso.

| Evidência dirigida | Resultado observado | Run |
|---|---:|---|
| Administração e configuração, 3 arquivos | 35 pass, 0 fail, 432 assertions | [44710851234](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44710851234) |
| Core integrado, 11 arquivos | 111 pass, 0 fail, 605 assertions | [44711178894](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44711178894) |
| Actions com Owner do mesmo Database, 3 arquivos | 20 pass, 0 fail, 826 assertions | [44712712942](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44712712942) |
| Static na fonte 5ba5d0d2, árvore idêntica | 15 comandos passaram; guard-dev bloqueado pelos dois arquivos protegidos | [44712718054](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44712718054) |
| HTTP de análise e preparação | 14 pass, 0 fail, 261 assertions | [44711150378](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44711150378) |
| Pool G04 integral na fonte 51da5e62 | 135 retornos, 71 exceções; gate RED | [44711982391](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44711982391) |

O pool preservou os 40 arquivos e 206 corpos iniciados/finalizados, sem finalização forçada.
O Bun reportou 135 pass e 72 fail porque também contabiliza o encerramento correto do gate.
Houve 39 fail→pass e nenhum pass→fail sobre o checkpoint anterior dessa frente.
Os 71 corpos restantes continuam em reparo; o console HTML aposentado não foi reaberto.

A barreira do host está isolada e ainda não integrada. Ela fecha admissão, aguarda os
finalizadores do coordenador, confirma o encerramento do processo nativo e interrompe
o daemon de schedules do mesmo grafo. A última rodada observada teve 100 pass e 2 fail
([44713428906](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44713428906)).
As duas falhas novas estavam na montagem dos testes: tentar obter uma nova lease
após revogação e omitir o agent explícito da Session de schedule. A próxima execução
usa a lease real retida e uma Session com agent concreto. O recibo dessa barreira
prova somente drenagem local, nunca conclusão de efeito externo desconhecido.

O vault corporativo, a interface nativa de sessões, o journal/corte do Core, o
inventário do artefato final e a qualificação conjunta continuam em implementação.
Nenhum corte de dados reais, deploy, aprovação de arquivo protegido, consentimento
Microsoft ou ambiente Azure foi presumido. Os dez gates permanecem não executados
no candidato final.

## Checkpoint: grafo único, vault pessoal e corte Core em diagnóstico

Fonte integrada: [bb02bd52](https://github.com/gustavomhss/Orchestra-SF/commit/bb02bd52d654699db2db0bb33ec1dd42c1f0716a).
A barreira do host passou a acompanhar os produtores reais de Session, processos nativos
e daemon de schedules. O grafo de Location reutiliza os serviços globais já publicados,
incluindo Database, Owner e Event, em vez de criar uma segunda identidade de armazenamento.
O vault usa Owner completo, cifra e AAD próprias, revisão/CAS e autorização atual por ação
e recurso. A configuração pessoal não herda ambiente, projeto ou conexão de outra pessoa.

| Evidência dirigida | Resultado observado | Run |
|---|---:|---|
| Barreira e writers corrigidos, 9 arquivos | 102 pass, 0 fail, 591 assertions | [44715528885](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44715528885) |
| Grafo/host integrado, 11 arquivos | 105 pass, 0 fail, 622 assertions | [44716722668](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44716722668) |
| HTTP Core e admissão administrativa, 2 arquivos | 9 pass, 0 fail, 108 assertions | [44716726491](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44716726491) |
| Static integrado em 5f5a3624 | 15 de 16 comandos passaram; guard-dev exige aprovação dos dois paths protegidos | [44716628414](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44716628414) |
| Vault/consumidores Core integrados, 9 arquivos | 58 pass, 0 fail, 259 assertions | [44718722463](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44718722463) |
| Vault/SF/HTTP integrado, 3 arquivos | 14 pass, 1 fail, 136 assertions | [44718726005](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44718726005) |
| Pool G04 na fonte 897b0463 | 166 retornos, 40 exceções; gate RED | [44717350835](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44717350835) |

A falha SF foi uma resposta **500**, não um timeout do teste: o boot de um provider tentou
ler credenciais sem o grant correspondente. A fixture somente registra o prompt e não
deveria descobrir providers. A correção permanece no consumidor; nenhum grant foi
acrescentado artificialmente à fixture. Execução positiva de LLM e MCP corporativos
ainda depende de definição privada explícita e não está qualificada.

O pool G04 executou e finalizou os mesmos 206 corpos dos 40 arquivos, sem finalização
forçada; Bun contabilizou 166 pass e 41 fail por incluir a recusa final do gate.
Foram 32 fail→pass e um pass→fail comparados ao checkpoint anterior da frente.
Os componentes restantes estão sendo montados com autenticação Microsoft real da
fixture, RoleMaps e grants atuais. Isso não reabre o console HTML aposentado nem
substitui a navegação instalada exigida em G02.

### Migração: código isolado e falhas preservadas

A branch `teams-core-migration` contém um motor de corte de **Core Sessions**: censo
coerente, mapa explícito ou quarentena, journal privado, checkpoint físico, barreira
do mesmo grafo, backfill aditivo, fences de geração e ativação CAS no controle atual.
A resposta declara `installationComplete: false`; outras categorias não vazias
continuam recusadas antes do corte. O controle atual fica fora do checkpoint de dados.
Isso ainda não é uma migração completa nem uma recuperação em produção.

A primeira rodada teve 6 pass e 9 fail, porque a fixture não publicava Database no
grafo raiz ([44717211717](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44717211717)).
A segunda teve 9 pass e 6 fail: os journals reais `migration` e `__drizzle_migrations`
precisavam de classificação técnica explícita
([44717504228](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44717504228)).
Os erros foram corrigidos pelos contratos reais, sem descartar conteúdo desconhecido.
As rodadas seguintes entraram em execução prolongada; o ponto de bloqueio está sendo
isolado por um diagnóstico Linux com prazo externo menor, sem aumentar prazos dos
testes nem declarar sucesso. A tipagem também apontou uma referência mutável a
`prepared`, corrigida capturando o checkpoint verificado antes da closure do journal.

Falta qualificar o corte real, a classificação e migração das demais categorias e
a recuperação que preserve os efeitos já confirmados. O teste de rollback de dados
é uma fixture descartável; nenhum banco real de usuário foi cortado ou restaurado.

### Desempenho antes da mudança nativa

A fonte pinada de benchmark `531aad70b4c6f2c2d686c4254c812b2f8395f9ad` fechou os
18 casos/repetições em três partições, com CPU 30x, carga e deadlines originais:

| Partição | Resultado | Run |
|---|---:|---|
| Tabs | 6 pass, 0 fail | [44714633809](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44714633809) |
| Timeline com painel fechado | 6 pass, 0 fail | [44714654393](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44714654393) |
| Timeline aberta e review | 6 pass, 0 fail | [44707583840](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44707583840) |

Os 18 registros completos estão no JSON, com a fonte e os snapshots. As tentativas
anteriores vermelhas/incompletas permanecem no histórico. Esse BEFORE pinado ainda
não prova o AFTER, G02 ou os dez gates no candidato final.

O inventário do arquivo de produção, o detector de resíduos e a composição dos gates
na mesma fonte/árvore/arquivo continuam pendentes. Microsoft real, Azure descartável,
aprovação de paths protegidos e release não foram presumidos.


## Checkpoint: UI integrada, boot corrigido e corte dirigido de Core Sessions

Fonte integrada: [265d3811](https://github.com/gustavomhss/Orchestra-SF/commit/265d3811d6c44ed3f62908d3b455122fbbf65b88).
Este checkpoint preserva os 101 registros anteriores do ledger e acrescenta as observações dirigidas de UI, clientes, navegador, desempenho, boot, corte e SSE. As execuções vermelhas, incompletas e os erros de seleção/import permanecem com suas fontes originais. Contagens de recortes sobrepostos não devem ser somadas como testes únicos.

### Web nativa e administração compartilhada

A entrada SF usa o componente Web nativo com seleção explícita da instalação e admissão Microsoft. O workspace conserva o namespace completo de instalação, tenant, principal e Team por janela; a seleção de Team não substitui ProjectId nem vira prova de autoridade. O cliente usa o mount real, o cookie corporativo e os codecs JSON canônicos. Respostas e envelopes SSE são validados antes de entregar dados à UI; logout, revogação, troca de owner e respostas tardias retiram o estado privado correspondente.

O formulário de TeamConfig lê o documento atual, preserva os campos declarativos e aplica CAS. Um POST cuja resposta se perdeu não é repetido automaticamente. A referência de incerteza guarda apenas owner completo, janela, revisão esperada e hashes do comando/documento; não guarda configuração, draft ou segredo. Depois de nova admissão e GET atual, a UI pode mostrar o estado observado. Mesmo quando hashes coincidem, isso não atribui autoria nem confirma o sucesso daquele POST.

| Evidência dirigida | Resultado e escopo | Run |
|---|---|---|
| Workspace inicial, fonte `9b821ce5` | 37 unit + 27 HappyDOM; 64 pass, 0 fail, 527 assertions | [44714785830](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44714785830) |
| Clientes iniciais do workspace | 12 pass, 0 fail, 91 assertions | [44714801156](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44714801156) |
| Configuração nativa, fonte `a4e247dd` | 37 unit + 36 HappyDOM; 73 pass, 0 fail, 628 assertions | [44720291866](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44720291866) |
| Clientes de configuração e Session | 18 pass, 0 fail, 128 assertions | [44720305051](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44720305051) |
| Incerteza administrativa, fonte `be15d176` | 37 unit + 39 HappyDOM; 76 pass, 0 fail, 680 assertions | [44722950069](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44722950069) |
| Cliente real sobre OIDC/Core/SQLite | 1 pass, 0 fail, 20 assertions; caso em 9.895 s de um prazo de 10 s | [44718358264](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44718358264) |

Bun/HappyDOM não é Chromium. A última linha usa HTTP e cliente reais, com execução que somente registra o prompt; não executa um modelo externo. O timeout anterior de dez segundos e a margem estreita do PASS permanecem visíveis.

O tipo portátil de `ClientOptions.fetch` veio da fonte do gerador e do comando oficial `bun run generate`. O run [44716387866](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44716387866) produziu o blob `4fa6d4a25d7d4cab798e147edc3cea8e6fb236e7`; os bytes foram importados sem edição manual. Os 66 testes do gerador passaram em [44717516693](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44717516693). A estática de `a4e247dd` executou os 16 comandos: 15 saíram com zero, enquanto guard-dev recusou os dois caminhos protegidos preexistentes ([44720308128](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44720308128)). Ela antecede a alteração administrativa `be15d176` e não qualifica o conjunto posterior.

### Adaptador técnico: envelope Active

A geração canônica passou a devolver `{ data, namespace? }` em `sessions.active()`. O adaptador técnico antigo encaminhava o envelope inteiro como mapa de IDs; o consumidor iterava suas chaves. A correção decodifica o envelope, devolve somente `data` e recusa namespace corporativo nesse caminho técnico. Não há nova autoridade, fallback de Team ou mudança manual no cliente gerado.

A reprodução teve quatro testes antigos passando e quatro novos falhando ([44725841005](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44725841005)). O primeiro PASS usou um spy global e fica registrado como intermediário ([44726210964](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44726210964)). A prova final usa **Bun.serve em loopback, o cliente gerado, fetch nativo e encerramento aguardado**, sem modificar globals: **8 pass, 0 fail, 24 assertions** ([44727277080](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44727277080)). Esse erro de contrato foi corrigido, mas ainda não demonstra a causa da regressão de tempo.

### Navegador G02: falhas preservadas e fronteira atual

A prova compilada continua com os prazos originais: 15 s para adquirir o navegador, 7 s por ação e 180 s para o caso. O ledger registra todas as tentativas nativas observadas, incluindo imports inválidos, navegação interrompida, falha de bridge/cleanup, leitura precoce do histórico e a incompatibilidade entre decoder de domínio e JSON canônico. Não foram substituídas por um único run conveniente.

Na fonte integrada `452e5bbf`, o run [44725633820](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44725633820) terminou antes de qualquer HTTP da aplicação: um comando `Browser.getVersion` foi enviado sem resposta, e o Chromium excedeu a parte restante do orçamento absoluto de 15 s. Node e Chrome foram observados ausentes 2.018 s depois durante cleanup. Isso prova limpeza, não inicialização normal ou sucesso da jornada.

O diagnóstico autorizado seguinte manteve flags, spawn, cleanup e prazos. Somente o consumidor de Teams coletou contadores limitados de `/proc`, sem command line, ambiente ou mapas. No run [44726765097](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44726765097), o navegador ficou pronto em **11.050 s**. Foram observados **156.893.184 bytes adicionais de leitura**, **1.239 major faults adicionais** e custo máximo de **0.959 ms por amostra**. A pressão de I/O registrada é do sistema inteiro. Esses dados mostram atividade de I/O durante a largada; não identificam o arquivo responsável nem demonstram estabilidade de startup.

A mesma execução chegou ao HTTP real:

| Operação | Resultado observado |
|---|---|
| GET lista de sessões | 200 em 296 ms |
| GET SSE global | 200 em 168 ms |
| POST criação de sessão | 200 em 1.929 ms |
| GET lista após evento | 200 em 610 ms |
| POST prompt | Ainda pendente após 5.079 ms no encerramento da ação |
| GET mensagens | Ainda pendente após 4.716 ms no encerramento da ação |

O caso falhou no prazo original de sete segundos com **1 pass, 1 fail e 38 assertions**, sem resposta 500 nem erro de runtime observado. A ordem de requests é compatível com o handler de Created aguardando a lista e depois encontrando a thread recém-instalada; o tipo exato do evento não foi instrumentado e essa associação permanece uma inferência. A leitura de mensagens continua preservada. A próxima rodada deve usar o conjunto qualificado de Server/autoridade; não há retry, warming ou ampliação de prazo para procurar uma amostra verde.

### Boot corporativo e inspeção pessoal

Os primeiros reparos em Catalog/plugin mantiveram o prompt em 500. O baseline técnico também revelou duas falhas de grafo anteriores; a primeira tentativa introduziu uma terceira. A construção de Catalog/Integration passou a ocorrer no contexto real do nó, e o diagnóstico seguinte localizou a leitura indevida em `inbox/install.ts:117`: o boot de Location tentava consultar todas as credenciais mesmo sem operação de Inbox.

O ramo corporativo agora deixa adoção, sincronização e contas globais de Inbox indisponíveis. Não converte a recusa em uma lista vazia nem amplia grants da fixture. Handles técnicos retidos também revalidam a marca corporativa. Os testes inspecionam os bytes históricos por conexão SQLite readonly independente quando o adapter corretamente se recusa a abri-los.

| Evidência | Resultado | Run |
|---|---|---|
| Core final, fonte `3d212cb7` | 68 pass, 0 fail, 254 assertions, 10 arquivos | [44724909866](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44724909866) |
| HTTP nativo e configuração, runtime `67326c41` | 7 pass, 0 fail, 85 assertions; prompt 200 em 6.814 s | [44723059269](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44723059269) |
| Schemas pessoais/provider | 52 pass, 0 fail, 429 assertions | [44725691953](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44725691953) |
| Inspeção de metadata SF / Core | 9 / 7 pass, 0 fail; 76 / 92 assertions | [44725848432](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44725848432), [44725864530](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44725864530) |

A inspeção pessoal verifica Owner, ACL, revisão, auditoria e geração sem abrir ciphertext. Um slot `active` descreve o registro armazenado; não comprova funcionamento do provider nem autoria de um POST desconhecido. O HTTP pessoal e seu painel estão em implementação. A execução positiva de provider/MCP privado ainda não está qualificada.

A estática do boot final teve identidade de fonte, inventário e execução válidos, com 15 comandos passando; guard-dev manteve a recusa dos dois paths protegidos ([44724924590](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44724924590)). Nenhuma aprovação foi presumida.

### Corte dirigido: causa real do bloqueio corrigida

A espera do corte não foi resolvida enfraquecendo HostMaintenance. Um observador de conclusão do Effect removia a si mesmo enquanto o array era percorrido, fazendo a notificação pular outro waiter. A correção preserva a notificação de todos os observadores e a drenagem real do mesmo grafo.

Na fonte `42ebfe46`, os testes de observador/barreira passaram em **5 casos, 38 assertions** ([44725029044](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44725029044)). O corte/recuperação dirigido passou em **18 casos, 156 assertions** ([44725031927](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44725031927)). A prova usa administração Microsoft, grants atuais, SQLite, checkpoint físico, backfill aditivo, rollback transacional e recuperação depois de COMMIT sem repetir os mapeamentos. Escrita após revisão, revogação durante a drenagem e categorias desconhecidas continuam recusadas.

O resultado permanece **`scope: "core-sessions"`, `installationComplete: false`**. Não é migração de instalação inteira, G10, recuperação Azure ou corte de dados reais.

### Desempenho: comparação completa, regressão aberta

A mesma divisão, seis casos por três repetições, CPU 30x, cargas, um worker, zero retries e deadlines foi preservada. O BEFORE pinado `531aad70` continua com as 18 execuções completas. O AFTER `a4e247dd` também fechou as 18:

| Partição AFTER | Resultado | Run |
|---|---|---|
| Tabs | 6 pass, 0 fail | [44720702122](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44720702122) |
| Timeline fechada | 6 pass, 0 fail | [44720715029](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44720715029) |
| Timeline aberta e review | 6 pass, 0 fail | [44720731505](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44720731505) |

Medianas de `firstCorrectObservedMs`, calculadas sobre as mesmas 15 observações de cada família:

| Família | BEFORE | AFTER | Variação |
|---|---:|---:|---:|
| Cold | 111,1 ms | 123,8 ms | +11,4% |
| Hot | 59,3 ms | 74,0 ms | +24,8% |
| Painel fechado, cold | 105,4 ms | 128,9 ms | +22,3% |
| Painel fechado, hot | 62,7 ms | 69,9 ms | +11,5% |
| Painel aberto, cold | 106,1 ms | 128,3 ms | +20,9% |
| Painel aberto, hot | 82,8 ms | 94,6 ms | +14,3% |

O relato inicial abreviou o intervalo como 11,1–24,8%; os valores preservados calculam **11,43–24,79%**, arredondados acima. Nenhuma observação bruta foi alterada.

As medianas de conclusão dos streams mudaram +1,91% na timeline simples fechada, −3,93% com diffs fechados e −5,13% com painel aberto. Os nove streams entregaram 160 deltas, sem pendências ou substituição do host da linha/Markdown. Esses resultados mistos não autorizam declarar ausência de regressão. O código do benchmark, os limites e as tentativas anteriores incompletas permanecem registrados no [relatório de desempenho](./teams-profile-native-ui-performance.json).

O status é **OPEN_REGRESSION**. A correção do envelope Active ainda não recebeu uma nova comparação temporal completa; não se atribui a ela a regressão nem se repete o benchmark para escolher resultado melhor.

### Pool G04, SSE e proveniência de fonte

O pool `ab742c30` executou os 206 corpos dos 40 arquivos: **198 retornos e 8 exceções**, sem finalização forçada, 48 leases/releases. Bun reportou 198 pass e 9 fail ao incluir a recusa final do gate ([44723832160](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44723832160)). A rodada `e1bd80d8` ficou incompleta: apenas 49 corpos iniciados/finalizados, 46 retornos e 3 exceções; o beforeAll de review excedeu 35 s e gerou a cascata. Seus 146 fails agregados não são 146 corpos executados ([44726542137](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44726542137)). G04 permanece vermelho.

O primeiro recorte SSE manteve 11 pass/1 fail porque a fixture de histórico não preparava o documento TeamConfig exigido ([44727058224](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44727058224)). A preparação foi corrigida pelo HTTP administrativo real, antes das leases. O source `ef695c74` passou em **12 testes, 119 assertions**, incluindo os quatro técnicos, cinco corporativos anteriores e três novos ([44728583115](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44728583115)). O listener canônico mantém duas observações atuais e o egress mantém cinco; revogação de RoleMap, expiração e namespace continuam exercitados. Isso não prova melhora de latência do prompt antes do próximo run integrado.

O recorte seguinte de leitura conjunta dos RoleMaps passou em **97 testes, 945 assertions**, com 12 casos novos, 47 de sessão Microsoft, 32 de autoridade e 6 de política Core ([44729433808](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44729433808)). Na medição dirigida, três mapas passaram de seis para duas chamadas Graph e a consulta parcial passou de cinco para duas, mantendo os mesmos atores. Mudança de grupos/mapas/intenção, logout, expiração e refresh continuam recusados. A estática e a integração coesa desse source ainda estavam pendentes neste checkpoint; isso não é medição de melhora do prompt completo.

A estática anterior de SSE reportou `sourceValid: false`, embora 15 comandos tenham saído com zero; esse resultado permanece inválido como prova de fonte. O diagnóstico de proveniência posterior executou 160 contratos Node sem falhas, mas recusou o preflight por worktree alterado ([44728622875](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44728622875)). Bun 1.3.14 apenas reordenou duas devDependencies do lock, sem mudar versões. Os bytes observados foram importados pelo blob `5ce9c75a60184305cd294f20ed9c3eedf4eb063f`; não se revalidou artificialmente a evidência antiga. Ainda não existe PASS de artefato/G09 por esse diagnóstico.

Os logs também registram a versão realmente resolvida: vários jobs Bun usaram setup Node 24.22.2 ou 24.22.3 depois do validador 24.15.0. Nos benchmarks, o setup Playwright voltou a 24.15.0. Sem um probe separado de `process.version`, a ordem observada de setup é registrada como tal.

### Limites deste checkpoint

Os dez gates continuam não executados no mesmo candidato final. A prova focada de Chromium é G02 de componente, não G08 instalado nem Teams LIVE. O censo real de instalação, a cobertura das categorias além de Sessions, o arquivo de produção, a recuperação Azure e a aprovação independente dos caminhos protegidos continuam pendentes. Nenhum deploy, corte de banco de usuário, aprovação ou consentimento foi realizado por este checkpoint.
