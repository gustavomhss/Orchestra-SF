# Orchestra-SF — cold review adversarial do plano Teams-profile

> **Nota de continuidade:** esta é a cold review histórica do plano pinado abaixo. A investigação posterior de blast radius está em [teams-profile-blast-radius.md](./teams-profile-blast-radius.md), com catálogo exato de testes, fecho das fixtures, produtores operacionais e bloqueios adicionais de qualificação no código `687759276c2c9121c2cfd20a5994b277ceb7ee4d`. Seus resultados não devem ser inferidos do parecer histórico; nenhum teste foi executado nesta ampliação.

**Data:** 19/11/2026, America/Sao_Paulo.  
**Documento revisado:** `4d984e0bd3a3bd5445fcd504b96be4f7888da5da`.  
**Base principal de código:** `f7dd58e32bc834f1485df20b91adbf759b4c4ad0`.  
**Integração reconciliada na revisão principal:** `392cecab68288d4b669828adc5d1aaa738693d80`.  
**Observação posterior de CI:** `72830e53adfcb2059575b249e76c88753beb04e8`.  
**Branch de entrega:** `teams-profile-plan`.  
**Estado:** CR01 e CR02 resolvidos no plano e rechecados independentemente em `353e74afb2d7fdbceb8842188e42f30d743186d6`; reconciliação UI/CI confirmada no mesmo commit.  
**Implementação:** NOT_STARTED. **Testes, build, Actions, tenant e migração real:** NOT_RUN.

## 1. Veredito e alcance

A versão revisada precisava de **duas correções de planejamento: uma P1 e uma P2**. Não foi identificado P0 na amostra. A frente de UI/clientes/rotas/CI não encontrou outro achado material. A atualização das referências de integração não foi contada como defeito adicional.

| ID | Severidade | Lacuna aceita | Correção no plano |
|---|---|---|---|
| CR01 | P1 | Exigir Team selecionável antes de qualquer destino deixa bootstrap/admin sem caminho de entrada ou recuperação. | §§3.2/4.3, WP1 e A45: admissão administrativa independente, restrita ao grupo corporativo. |
| CR02 | P2 | Restore pós-corte não declara quais provas de efeito posteriores ao checkpoint não podem retroceder. | §7.3, WP4 e A46: preservar/reconciliar recibos e marcadores; suspender efeitos quando a prova faltar. |

São achados sobre o contrato proposto e sua qualificação. Não afirmam que já houve lockout, duplicação de efeitos ou vazamento no produto atual. Em recuperação, o código existente contém proteções que a migração deve carregar para os stores novos.

O [plano corrigido](./teams-profile-migration.md) e o [inventário](./teams-profile-inventory.json) continuam sendo documentos de preparação. O fechamento integral de WP0, a implementação e a prova no artefato Linux/tenant real permanecem obrigatórios.

## 2. Método

Três revisores novos receberam o SHA do documento, o pin de código, restrições de trabalho e uma frente independente. Começaram sem herdar a conversa dos autores e sem usar o resultado da revisão anterior como aprovação:

- **cold_auth:** identidade Microsoft, elegibilidade de Team, papéis/grants e entrada administrativa.
- **cold_data:** persistência, migração, retomada, cutover e recuperação.
- **cold_scope:** UI, clientes, rotas, resíduos, critérios de aceite e CI.

O integrador releu os pontos determinantes de cada achado e avaliou o delta da integração. Foram usados somente leitura de fontes pelo GitHub e processamento dos documentos; nenhum checkout, shell, teste local, alteração de produto, publicação de comentário, execução de CI ou mudança no tenant.

Cada candidato precisou mostrar uma condição concreta, um trecho insuficiente do plano e evidência de código. Riscos já proibidos pelo plano não foram contados novamente. Não se realizou varredura textual de todos os blobs ou rastreamento do bundle final.

## 3. CR01 — P1: bootstrap e recuperação administrativa dependem de um Team que pode não existir

### Contradição

Na versão revisada, §3.2 mandava cruzar Teams elegíveis com profiles habilitados e, sem opção, mostrar ausência de acesso. O fluxo não oferecia destino independente da seleção. Entretanto, §1.6 exige administração suprema por grupo corporativo e §4.2 diferencia esse papel de owner de Team, admin de superfície e operador local.

Um grupo administrativo válido não garante um Team de negócio selecionável. Tampouco garante que o novo store já tenha seu primeiro profile habilitado.

### Evidência

| Fonte no pin principal | Fato observado |
|---|---|
| [microsoft-policy.ts][C01], linhas 12–34 | Política usa grupos por papel/superfície e grants por Object ID; não exige Team para essa configuração. |
| [product-authority.ts][C02], linhas 89–119 | Admissão combina principal, papéis, grants e escopos; Team não é pré-condição atual. |
| [local-bootstrap.ts][C03], linhas 13–34 e 37–59 | Materializa apenas roleMaps ausentes e preserva mapas existentes/vazios; bootstrap não depende de picker de Team. |
| [microsoft-entra-client.test.ts][C04] | Contrato inclui login web mínimo/convidado e atribuição de papel por grupo. A listagem de Teams não é esse mesmo contrato. |

O bootstrap existente comprova uma propriedade que precisa ser preservada; não comprova que a administração suprema já esteja integrada.

### Contraexemplo

1. Tenant e grupo administrativo foram configurados pelo dono.
2. O administrador autentica e sua membership atual é válida.
3. A instalação está nova, não tem profiles habilitados, perdeu o último profile ou esse administrador não participa dos Teams de negócio.
4. A interseção de seleção é vazia.
5. O fluxo termina em ausência de acesso; o administrador não alcança a configuração necessária para habilitar/recuperar um profile.

A01 pressupõe equipe autorizada. A02 cobre zero opções, mas não exigia recuperação administrativa. A04 cobre a identidade do convidado, sem decidir o acesso do ator com grupo/grant válido e zero Teams. O bloqueio passava por esses cenários.

### Correção e prova exigida

Separar a admissão administrativa da seleção de Team. A entrada nativa de configuração/recuperação funciona sem profile selecionado, mas exige principal Microsoft, tenant e grupo corporativo atuais, verificados no backend. Ela não concede leitura de conteúdo privado, papéis de superfície, seleção de equipe ou operação de negócio.

WP0 também classifica os atores existentes que ficariam sem Team. Jornadas que passam a exigir equipe precisam de vínculo comprovado ou decisão explícita de transição antes do corte; não escolher o primeiro Team, inventar Team pessoal ou promover um grupo de segurança a profile.

**A45** exige primeira entrada com zero profiles, último profile removido, administrador sem Team, usuário comum/convidado sem Team, revogação do grupo administrativo e roleMap vazio. A autoridade administrativa não depende da enumeração de Teams; falha em verificar o próprio grupo administrativo continua negando acesso.

**Por que P1:** o algoritmo proposto transforma seleção em pré-condição global e pode impedir a própria configuração/recuperação da instalação. Resolver isso não demanda novo framework de identidade, apenas uma fronteira de admissão corretamente definida.

## 4. CR02 — P2: restore posterior ao corte pode perder a prova do que já aconteceu

### Lacuna

§7.3 exigia política atual, versão compatível e proteção contra restaurar acesso revogado. §§6/7.1 já protegiam recibos em termos gerais. Faltava transformar essa obrigação em procedimento e teste para recuperar um checkpoint **anterior a trabalho executado depois do corte**, mesmo quando a autoridade continua válida.

### Evidência

| Fonte no pin principal | Dependência/proteção observada |
|---|---|
| [scheduled-task.ts][C05], linhas 120–147 e 272–301 | Reconhecer slot consumido e admissão anterior depende dos registros duráveis de run e SessionInput. |
| [session/input.ts][C06], linhas 48–75 | Sem admissão existente e sem reconciliação histórica, o prompt é novamente admitido. ID igual não prova efeito anterior quando seu armazenamento também retrocedeu. |
| [runtime/operations.ts][C07], linhas 362–395 | Restore atual preserva delivery/claims/schedule/inbox/job state, une números emitidos e conserva máximos dos contadores. |
| [runtime/local-recovery.ts][C08], linhas 27–28 | SQLite recuperado não substitui diretamente banco/auth vivos; recuperação passa por adapters em área descartável. |
| [operations-runtime.test.ts][C09], linhas 147–190 e 217–255 | Exige contadores monotônicos, união de identificadores e ausência de replay de notificações. Esses testes não estavam nominalmente no inventário anterior. |

### Contraexemplo

1. Cria-se checkpoint e o modelo Teams é ativado.
2. Um job autorizado consome um slot, admite prompt e produz efeito.
3. Recupera-se o checkpoint anterior com binário compatível e política atual.
4. Se também retrocederem os registros que comprovam consumo/admissão, o scheduler volta a enxergar trabalho pendente.
5. A membership permanece válida e, por isso, não impede nova admissão.

O mesmo princípio vale para números já emitidos e notificações. A30 exercita revogação; A24 exercita crash com prova durável ainda existente. Nenhum exigia esse rewind após efeito pós-corte.

### Correção e prova exigida

WP4 declara por store o que pode ser restaurado e o que deve continuar refletindo o estado posterior ao checkpoint: recibos/admissões, slots consumidos, deduplicação, cancelamentos/tombstones, revisões relevantes e identificadores/contadores emitidos. Preserva os adapters existentes e não aplica merge genérico a estados de ciclo de vida.

**A46** exige checkpoint → corte → efeito confirmado → restore com autoridade ainda válida → restart/retry. Se a prova posterior se perdeu ou o resultado externo é desconhecido, consumidores capazes de produzir efeitos ficam suspensos até reconciliação. Não inventar recibo nem reenviar automaticamente por falta dele.

Foram incluídos `operations-runtime.test.ts`, `local-backups.test.ts` e `local-backup-resilience.test.ts` como regressões existentes a selecionar. Eles não substituem o novo caso composto de A46.

**Por que P2:** a obrigação geral de preservar recibos já existe e o restore vigente é defensivo. A falha está na especificação e qualificação temporal da recuperação da migração; não há evidência de uma implementação nova que já execute restore inseguro.

## 5. Delta de integração reconciliado

O compare [pin → head observado][C10] contém **13 commits e 17 arquivos**. A primeira rechecagem parava em `a5b15b51…` e tinha dois fixtures; o trecho posterior acrescenta 11 commits/15 arquivos. A descrição antiga foi preservada como histórica e substituída como referência de freshness.

| Mudança observada | Obrigação carregada para o plano |
|---|---|
| [ready() por geração][C11] e `owner-ready.test.ts` | Manter wrapper congelado estável na geração, transport original e invalidação em reload/revogação/logout/unmount; resultado tardio não troca o sucessor. |
| Atlas e memória | Renovar observação consumida pela fronteira original, sem ressuscitar a identidade consumida nem conservar acesso após encerramento/revogação. |
| Planner | Preservar observação da fonte completa da resposta; não reduzir silenciosamente o escopo ao resumo financeiro. |
| BI | Prova permanece privada da chamada consumida, com proteção contra mutação e revisão de fonte/contexto. |
| [Contexto de aprovação do CI][C12] | Request não concede aprovação; snapshot/source PR/label/ator/refs precisam satisfazer o contrato, e os dois guards continuam obrigatórios quando o contexto é admitido. |

No CI, o snapshot que transporta aprovação altera somente `.ci-run.json`; seu parent deve ser o head exato de um PR único e elegível com base `sf-join-four`. Erro/ambiguidade deixa approval vazio. O código admite reviewer humano elegível independente e a exceção do dono pessoal; restrições mais estreitas do usuário prevalecem. Este estudo não aplica labels nem fornece decisão de aprovação.

Essa reconciliação não é rebase, execução desses testes ou aprovação da integração. Cada caminho novo registra seu `evidenceCommit` no inventário.

### Observação posterior de CI

Durante o fechamento documental, o compare [392cecab → 72830e53][C13] acrescentou 7 commits/17 arquivos de CI, fixtures e documentação. O revisor da frente e o integrador leram os contratos relevantes: `suites.json` permaneceu igual, o planejador distribui sua seleção completa com pesos históricos e fallback, e o job `sf/static-and-contracts` continua obrigatório no verificador final. O blob do resolver source-PR não mudou; o novo cancelamento de runs não os transforma em evidência de PASS.

Quatro testes estáticos passaram de executar comandos repetidos a verificar sua ligação e obrigatoriedade no job estático. O [helper de contrato][C14] declara que essa prova não é recibo de execução de compilador/guard. Seu PASS isolado em recorte não substitui os resultados reais do [workflow][C15] nem os gates adicionais desta migração. Essa precisão foi acrescentada a §9.3/FRESH03. O revisor confirmou compatibilidade da observação com o plano, sem novo finding; não houve auditoria de todas as otimizações, validação de desempenho ou execução de testes.

## 6. Hipóteses examinadas e não aceitas como novos achados

- **Rebind de cookie jar, modal de draft vetando revogação, dois principais no mesmo Team, parent/fork/move/import e writers antigos no corte:** já têm obrigações explícitas e aceites no plano.
- **Rotas fora dos capítulos SF, eventos globais, breakpoints do Dock e clientes manuscritos:** exigem concretização no inventário integral, mas §§3.4/5/6/11 já incluem sua migração/recusa e prova de alcance. A amostra não revelou exceção permitida.
- **`projectId` em evidências históricas e digests:** pode permanecer como proveniência técnica imutável, com associação autorizada e sem selecionar profile. Isso é permitido por §3.3; sua presença isolada não prova resíduo ativo. Acrescentou-se a lista de famílias/readers ao inventário para impedir rehash de história ou uso desse ID como autoridade.
- **Novos arquivos na branch de integração:** são deltas a reconciliar, como WP0 já exige. Não foram artificialmente classificados como defeitos do plano.

## 7. Rechecagem e pendências de execução

Os três revisores releram os pontos de sua frente no commit `353e74afb2d7fdbceb8842188e42f30d743186d6`:

| Revisor | Objeto | Resultado |
|---|---|---|
| cold_auth | CR01; §§3.2/4.3, WP1/A45 e inventário | RESOLVED_IN_PLAN; sem pendência concreta no achado. |
| cold_data | CR02; §7.3, WP4/A46, adapters/testes e inventário | RESOLVED_IN_PLAN; sem promessa de execução única ou merge indiscriminado. |
| cold_scope | Contexto ready(), contrato CI, referências e inventário | RECONCILIATION_ACCURATE; sem achado material adicional na frente. |

A rechecagem encerra os dois achados documentais. Não certifica implementação, execução de testes ou tenant.

Após a rechecagem documental, continuam pendentes:

1. Repin no SHA real de implementação e inventário textual/semântico integral, incluindo rotas, APIs, stores, clientes manuscritos e artefato Linux.
2. Contratos implementados, migração ensaiada, ownership real classificado e recuperação qualificada.
3. Seleção efetiva e execução das regressões/aceites pertinentes em Actions Linux x64; nenhum skipped/vazio é PASS.
4. Consentimento, membership, entrada administrativa e revogação demonstrados no tenant real, com evidência distinta de fixtures.

O resultado documental não afirma migração concluída, testes verdes ou ausência global de resíduos.

[C01]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/modules/sucafina/Sucafinav1/runtime/microsoft-policy.ts
[C02]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/modules/sucafina/Sucafinav1/product/integration/product-authority.ts
[C03]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/modules/sucafina/Sucafinav1/runtime/local-bootstrap.ts
[C04]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/modules/sucafina/Sucafinav1/test/microsoft-entra-client.test.ts
[C05]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/core/src/scheduled-task.ts
[C06]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/packages/core/src/session/input.ts
[C07]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/modules/sucafina/Sucafinav1/runtime/operations.ts
[C08]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/modules/sucafina/Sucafinav1/runtime/local-recovery.ts
[C09]: https://github.com/gustavomhss/Orchestra-SF/blob/f7dd58e32bc834f1485df20b91adbf759b4c4ad0/modules/sucafina/Sucafinav1/test/operations-runtime.test.ts
[C10]: https://github.com/gustavomhss/Orchestra-SF/compare/f7dd58e32bc834f1485df20b91adbf759b4c4ad0...392cecab68288d4b669828adc5d1aaa738693d80
[C11]: https://github.com/gustavomhss/Orchestra-SF/blob/392cecab68288d4b669828adc5d1aaa738693d80/packages/app-shell/src/orchestra/chapters/sucafina/context/index.tsx
[C12]: https://github.com/gustavomhss/Orchestra-SF/blob/392cecab68288d4b669828adc5d1aaa738693d80/docs/guardrail/test-ci-context.md

[C13]: https://github.com/gustavomhss/Orchestra-SF/compare/392cecab68288d4b669828adc5d1aaa738693d80...72830e53adfcb2059575b249e76c88753beb04e8
[C14]: https://github.com/gustavomhss/Orchestra-SF/blob/72830e53adfcb2059575b249e76c88753beb04e8/modules/sucafina/Sucafinav1/test/product/fixture/ci-static-contract.ts
[C15]: https://github.com/gustavomhss/Orchestra-SF/blob/72830e53adfcb2059575b249e76c88753beb04e8/.github/workflows/sf-ci.yml
