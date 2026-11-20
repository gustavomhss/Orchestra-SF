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
