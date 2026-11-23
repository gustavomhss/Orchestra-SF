# Preparação do go-live — G05, G06, G07, G08 e G10

**#709 e #711 estão integrados como preparação de componentes; `orchsf-vm` existente está autorizado para os ensaios. Os cinco gates finais continuam abertos.** A rota é #613 → #710 → #673, seguida de C/T e ACKs, G05/G06/G07 em Actions, G08 na VM atual e G10 no mesmo host após preservar a evidência de G08. Faltam a qualificação do candidato efetivo, o tar verificado e os recibos instalados.

Observação desta edição: **2026-11-23T00:31:28Z (22/11/2026, 21:31:28 em America/Sao_Paulo)**. Último dev observado: `9d322c5d461942eba5948325ec8a73185ec8a432`, árvore `2ec90090b0b9cf0b7061e0029f1bc8fdc92536d8`. Os cortes anteriores de #704/#707 e todos os seus recibos permanecem no histórico. Essa identidade **não é o candidato final confirmado**.

O [registro estruturado](status.json) contém dono, SHA/árvore, artefato, recibo e bloqueio por gate. O [registro de execução](execution-2026-11-22.md) conserva os resultados anteriores, inclusive tentativas negativas, e separa cada prova por fonte. O [runbook instalado de G08](g08-installed-execution.md) descreve a rota concreta entregue pela #698.

## Estado recebido neste corte

| Frente | Resultado recebido | Consequência |
| --- | --- | --- |
| Azure / host existente | O [inventário ARM 45061014414](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45061014414) e a [orientação Owner posterior](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7088154702) têm escopos separados | Uso de `orchsf-vm` autorizado; reserva, runner e contextos Microsoft ainda precisam ser materializados. O registro ARM original continua sem observação guest. |
| Processo G08 | [#705](https://github.com/gustavomhss/Orchestra-SF/pull/705), merge `08e05d9`; [45066918996](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45066918996): 498/498, guards e spawn-imports PASS | Componente integrado, árvore idêntica à fonte revisada; não executou G08 instalado. #706 foi encerrado por sobreposição. |
| Perfis de infraestrutura #709 | [61/61 controles](https://github.com/gustavomhss/Orchestra-SF/pull/709#pullrequestreview-6015029109), merge `08c96c5d`; quatro avisos de harness preservados | Preparação integrada; os perfis opcionais não serão aplicados à rede compartilhada atual. Não houve apply Azure por esse CI. |
| Origem existente #711 | [23/23 controles e readback independente](https://github.com/gustavomhss/Orchestra-SF/pull/711#issuecomment-7088167078), merge `9d322c5d`, mesma árvore da fonte testada | `disposable:false` pode representar a origem existente; classe FILESYSTEM_COMPONENT_CONTROLS, sem restore do backup original nem qualificação instalada. |
| Design/#613 | [T4 em C6e: 14/15, C17 negativo](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7087939493); [A4 em C757: 5/6 instalado](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7087702050); P5/P6 são diagnósticos | UI42 ainda expira no primeiro preview; UI43/UI44 não foram alcançadas. Head público 0a/draft e 12 aceites históricos preservados. e1c4 recebeu aceite estático de BI, com runtime pendente. |
| Visual/#710 | Head revisado `744d24f2` e [finding UI41](https://github.com/gustavomhss/Orchestra-SF/pull/710#pullrequestreview-6015334664) | Conciliar sobre o Design aprovado, preservar o oráculo de estado vazio e os hunks da Migração; nenhuma qualificação combinada recebida. |
| Migração/#673 | Pai `b2f97817` / T `289fd8ac` congelado e revisado; sem CI isolado | SF, Decisions e APP-SRC exigem baselines reais. Os intakes negativos 45059200284 e 45062218008 foram recebidos integralmente, sem transferência de PASS. |

A [correção BI e1c4](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7088302107), árvore `e0c1c280`, recebeu revisão estática: conclusão/falha da mesma Request e precedência de erro em detach foram reparadas, sem novo GET ou mudança de tolerância/prazo. A execução com `original-request-completed` e os oráculos continua pendente. A prova real no runtime Release **Bun 1.4.1 / 4661e494f…** também falta; o Bun 1.3.14 dos focais não a substitui.

Os [diagnósticos P5](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7088008968) e [P6](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7088329867) executaram snapshots instrumentados filhos de C6e, com `qualification:false`. C17 completou nesses snapshots; UI42 permaneceu negativa no waiter original de 60 s. Amostragem periódica com overflow não mede CPU, frequência total ou tempo por caller. Nenhum PASS apaga T4 ou qualifica e1c4, Bun 1.4.1 ou o tar.

### Prova histórica do corte #707

O [intake independente de 44e](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7085714579) identifica cada snapshot realmente executado, os oito jobs/cleanups e os três ZIPs originais. C17 original concluiu em **104.187,50 ms / 105.000 ms**, com 812,5 ms de margem; isso não demonstra ganho estável nem qualifica a variante diferente da Migração. O [finding BI06](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7085742679) exige capturar os bytes do mesmo evento, mantendo a tolerância `1e-5`; os dois corpos e os instantes originais não foram preservados. A causa da diferença não foi atribuída ao clone ou ao arredondamento.

### Rota corrente de integração e execução

A [sequência vigente](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7088139499) é **#613 → #710 → #673**. O writer `sf613-finish` conserva Design/Core; o writer visual reconcilia #710 sobre o Design aprovado, incluindo o finding UI41, e Migração incorpora o dev resultante no próprio #673. Os [limites de composição](https://github.com/gustavomhss/Orchestra-SF/pull/710#issuecomment-7088132472) e o [handoff de Migração](https://github.com/gustavomhss/Orchestra-SF/pull/673#issuecomment-7088139755) preservam as seis uniões preparadas, os 20 jobs A2 e um job suplementar com quatro invocações originais. Os 11 Reports e o pool originais continuam obrigatórios; atualizar baselines muda o candidato e exige sua qualificação própria. A campanha visual opt-in de 420 s não substitui os prazos canônicos de 210/180 s.

**Uso do host autorizado; reservas operacionais ainda não confirmadas.** A [orientação vigente](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7088154702) retira as propostas de duas/três VMs extras, aumento de cota e orçamento de USD 300. Antes de substituir o piloto em `orchsf-vm`, preservar dados, configuração, instalação e evidências; Claw e a outra VM ficam fora das alterações. G08 requer reserva/IMDS/janela, runner/environment/private_root e quatro contextos Microsoft reais. G10 ocorre depois de preservar G08 e ainda depende de [inventário do canal privado e da capacidade de recuperação independente do backup original](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7088112697), além de chave, responsáveis, observador e R instalado/retido. Não se presume ausência de SSH/SFTP/Blob nem necessidade de outra VM.

No [checkpoint de acesso recebido](https://github.com/gustavomhss/Orchestra-SF/pull/628#issuecomment-7088172949), duas reconexões do browser não retornaram documentação/estado e foram interrompidas. Isso não revoga o login ou a autorização Azure anteriores. Esta edição não antecipa resultado de tentativas posteriores.

Nenhum tar novo, ACK final, reserva confirmada, aceite instalado ou decisão de produção foi criado neste corte. Os registros encerrados de #349/#588 e do escopo técnico G09/#647 permanecem preservados.

## Donos e mandato

| Recorte | Dono e responsabilidade |
| --- | --- |
| Integração e G05/G06/G07/G08/G10 | Astra go-live: preparação, integração revisada, coordenação e execução da frente |
| G01–G04 e pool | Writer `focal_migration`, [#673](https://github.com/gustavomhss/Orchestra-SF/pull/673), preservado sob a coordenação |
| Release e G07 | Astra go-live, mandato de coordenação/execução já registrado em [#657](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7080753498) e [#247](https://github.com/gustavomhss/Orchestra-SF/pull/247#issuecomment-7080852007); B vinculará C/T, ACKs e ator GitHub efetivo |
| UI42/UI43/UI44 e design | Frente existente [#613](https://github.com/gustavomhss/Orchestra-SF/pull/613), ainda 12/15 áreas qualificadas |
| QA/Entra/host | Astra coordena no host existente autorizado; reserva, runner e contextos Microsoft originais ainda precisam ser vinculados |
| Recuperação/backup/chave/observador | Astra conduz G10 depois de G08; canal privado/destino independente do backup original, reserva, chave e observador continuam pendentes |
| Compras 222 (2) | Aceite4/4 preservado no QA original, sem transferência para outro candidato ou tar |
| #349, G09 e #588 | Permanecem com os responsáveis de suas frentes, conforme o mandato original |

A revisão técnica por assistentes e os COMMENTs da conta compartilhada são identificados como tal. Não representam aceite humano presumido. O papel `recovery` continua pertencendo a G10. A produção exige aprovação específica da janela e decisão go/no-go.

## Integrações recebidas nesta etapa

| Entrega | Merge em dev | Evidência da fonte qualificada |
| --- | --- | --- |
| [#693](https://github.com/gustavomhss/Orchestra-SF/pull/693) — CAP03 reader/Client/factory | `70e3228cf2db` | [45051010616](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45051010616): 67 Bun; controles de componente |
| [#691](https://github.com/gustavomhss/Orchestra-SF/pull/691) — CAP03 UI e View source | `7e3e5e2bfd24` | [45050299263](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45050299263): 79 Bun; controles de componente |
| [#694](https://github.com/gustavomhss/Orchestra-SF/pull/694) — 50 jornadas nativas e F04 | `9804ee308485` | [45051200489](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45051200489): 40 Node + 25 Bun; controles de componente |
| [#697](https://github.com/gustavomhss/Orchestra-SF/pull/697) — Observador original de restart | `19fbe6542cdc` | [45052572893](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45052572893): 42 Node + 49 Python; controles de componente |
| [#700](https://github.com/gustavomhss/Orchestra-SF/pull/700) — Registro Microsoft e rota Edit | `327e95d552fa` | [45055263348](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055263348): 40 Node + 42 Bun + 21 DOM; controles de componente |
| [#701](https://github.com/gustavomhss/Orchestra-SF/pull/701) — Origem dos produtores e autorização | `5cf8419032b5` | [45055493019](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055493019): 128 Bun; controles de componente |
| [#699](https://github.com/gustavomhss/Orchestra-SF/pull/699) — Recusa JSON e lifecycle nativo | `47fa6b594ce9` | [45055028234](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055028234): 40 Node + 54 Bun; controles de componente |
| [#698](https://github.com/gustavomhss/Orchestra-SF/pull/698) — Coordenador e agregador completo | `b7776698e619` | [45055970646](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055970646): 254 Node + 5 Bun; controles de componente |

A #699 foi entregue e integrada por seu writer existente. O readback confirmou seus hunks de runtime completos junto ao `Pick<NativeManifest, "target">` da #700; os outros24 blobs da #700 e o manifesto histórico v2 foram preservados. O merge da #698 não altera esses paths.

As contagens acima não devem ser somadas como prova de um candidato final. #691 foi qualificada numa composição explícita com o Client da #693. #698 foi qualificada com #700/#701 já integradas e também fez o parser real de proveniência validar seu YAML real. Nenhum desses runs executou a homologação instalada.

As entregas anteriores #665/#677/#685/#688/#689/#690/#692/#695 e seus recibos permanecem no ledger. As fronteiras HTTP já corrigidas, a política persistente corrente, Imports privados, decoder/checkpoint e a rota de release não são pendências de implementação.

## Corte histórico após o #702 — 19:18:45 UTC

O [#703](https://github.com/gustavomhss/Orchestra-SF/pull/703) resolveu a admissão do próprio agregador G08. O merge `f5132fabfa265ba6bef17b0e0aa2ebe2c2beafdc` conserva exatamente a árvore `4462e8f53b3fca019d9c5f5fbbf71cb4c04f56b4` da fonte revisada. O [focal 45058460020](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45058460020) passou **490/490 controles** e os guards; ZIP, CRC, relatórios e fontes foram conferidos. A agregação continua retrospectiva: observa seu checkout e job atuais e relê as onze provas originais, sem exigir nova reserva ativa para essa leitura. Isso não executa nem fecha G08 instalado.

O [seletivo do #613](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7084208298) terminou **7/8**, na fonte separada `a7b4281`. O C17 original completou todas as fases em **101,270 s**, dentro dos 105 s; o controle de carregamento de módulo falhou porque o import com query reutilizou o export. A [revisão independente](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7084196985) encontrou ainda possível aceitação indevida sob um hook stateful anterior ao helper. A fonte permanece bloqueada para promoção. O head do #613 continua `0a1247d`, **12/15 áreas**, com UI42–UI44 pendentes na instalação.

A Migração mantém como último focal recebido o 9612, com Decisions **3/5**. As correções de tipos e do observador foram revisadas estaticamente no head `44334fe`; o [run diagnóstico 45059200284](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45059200284) foi iniciado sobre um snapshot separado, e seu resultado ainda não foi recebido nesta observação. Os cinco casos, os prazos originais e retries zero permanecem. Reports conserva os **11 oráculos originais** reutilizáveis, mas seus consumidores mudaram: os 11 casos precisam de replay no candidato efetivo após a composição, incluindo #613.

O primeiro head documental do #704 (`21d43e8`) recebeu revisão e [guards verdes](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45059194082), mas se sobrepôs ao #702 integrado. Esse resultado fica histórico. Esta composição preserva o #702 e exige revisão e CI próprios. C/T final, ACKs, tar, reservas e aceites continuam nulos; **0/5, NOT_READY**, sem decisão de produção.

## Estado por gate

| Gate | Dono | Entrega disponível | C/T, artefato e recibo finais | Bloqueio para fechamento |
| --- | --- | --- | --- | --- |
| [G05](g05-g06-controls.md) | Astra go-live | HTTP/SQLite reais, isolamento por Team, fronteiras Web e CAP03 readonly integrados; recibos de componente preservados | Nulos | Composição final e replay completo coverage/auth/effect/HTTP/isolamento no mesmo C/T |
| [G06](g05-g06-controls.md) | Astra go-live | ClamD real e16 casos selecionados no B4, Imports privados e política corrente integrados | Nulos | Reexecução completa no C/T final, com payloads, efeitos, armazenamento e cleanup observados |
| [G07](g07-linux-package.md) | Astra go-live | Verificador e rota #668 entregues: B distinto de C, dois ACKs antes do produtor, Q posterior | Nulos | C/T confirmado e ACKs; prova no Bun 1.4.1 real; gerar/verificar o tar original com proveniência e operador vinculados |
| [G08](g08-teams-qa.md) | Astra go-live | Executor completo:99 obrigações em11 invocações, registro/observador/proveniência/agregador; host existente autorizado | Nulos | Mesmo tar G07, reserva/IMDS/janela e runner admitidos, Microsoft real, produtores completos e recibo agregado |
| [G10](g10-cutover-rollback.md) | Astra go-live | Backup/clone, decoder, política corrente e #711 para a origem existente | Nulos | Depois de preservar G08: R retido/compatível, backup original em rota privada independente, chave, observador e ensaio de corte/restore/restart/retry/rollback |

G08 exige **Teams 9 + U15(6) + U39(22) + U40(22) + F04(3) + AZ02(37)**. AZ02 conserva32 IDs históricos e cinco adições, em fases 16/14/2/2/2/1; não é uma suíte Playwright. F04 é Bun/HappyDOM em processo separado após o registro. Todas as99 obrigações permanecem **NOT_RUN na instalação**.

## Migração e design: provas anteriores preservadas

As provas desta seção pertencem ao corte anterior do #702. O seletivo a7 e o diagnóstico posterior estão discriminados acima; nenhum resultado é transferido entre fontes.

A [#673](https://github.com/gustavomhss/Orchestra-SF/pull/673) compôs dev19fbe e teardown no head `9612e7db0319c41ea0161e3924f332d9d76b0f9b`, T `b1dc4bdc3b4a73667e9ee8011667616565d2f9bc`. O [run 45055109181](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055109181) terminou com Decisions 3/5 (dois timeouts originais de 180 s) e dois diagnósticos na inclusão E2E: resultado de page.route incompatível com Promise<void> e declaração original de Window.api fora do tsconfig SF. A recepção independente conferiu os quatro ZIPs e delimitou os reparos para o writer da Migração. Os guards preservam47/69 avisos nas duas bases. #699/#700 não corrigem esses dois paths. Nenhum resultado parcial é promovido a ACK final.

**Operations 5/5 já foi recebido** no [focal45051170458](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45051170458), fonte bf1c680, conforme [recibo original](https://github.com/gustavomhss/Orchestra-SF/pull/673#issuecomment-7083227030). SF4 97/97, SF5 156/156 e SF8 140/140 do c9a9b0 continuam históricos. O pool 209/209 do diagnóstico não substitui o replay original sem overlay na composição final. Reports 11/11 continua restrito à fonte e aos consumidores em que foi produzido.

A [#613](https://github.com/gustavomhss/Orchestra-SF/pull/613) continua 12/15. O focal 255c35c6 recebeu 8/10; a correção exclusiva do driver de tipos passou 3/3 em [45054387720](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45054387720), enquanto C17 / 105 s permanece aberto. O diagnóstico CPU [45054997790](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45054997790) falhou, com cleanup SUCCESS, e publicou o artefato 14766639145. Sua metadata não qualifica o perfil ou o produto. A ausência de artefato registrada anteriormente pertence ao coletor cancelado 45045175421, preservado no histórico.

## Acesso operacional no corte anterior — histórico

O bloqueio descrito nesta seção pertence ao corte anterior. O inventário 45061014414 o resolveu; as pendências atuais de reserva e acesso estão no início deste documento.

A repetição somente leitura do [inventário 45036787201, tentativa 2](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45036787201/attempts/2), concluída às 15:49:43 em São Paulo, confirmou o bloqueio antes do login: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` e `AZURE_RESOURCE_GROUP` chegaram vazias no contexto `azure-mvp`. Login e comandos ARM ficaram SKIPPED. O artefato 14766939588 (876 bytes) foi adquirido e conferido; receipt `ee9d5d941754ae9da9804e2fa569ef89712a8aafa7ee7f64a4189b276dc02de5`. A tentativa 1 das 15:10UTC permanece histórica. A nova leitura de dispositivos também encontrou o Mac offline, visto pela última vez há110 h; não há acesso operacional estabelecido por esse canal.

| Entrada necessária | Responsabilidade pela disponibilização | Próxima ação da frente |
| --- | --- | --- |
| Configuração existente de Azure no contexto correto | Administrador do repositório/environment | Repetir inventário somente leitura e registrar os recursos realmente observados |
| Host/runner QA e contextos Microsoft | Operador do ambiente e responsável Entra | Registrar reserva e autorizações; executar os11 produtores originais de G08 |
| Host/clone de recuperação, backup/chave e observador | Responsáveis operacionais desses recursos | Executar G10 e medir RPO/RTO, mantendo o registro externo fora do restore |
| C/T e ACKs | Migração e Release, coordenadas por Astra | Admitir B e executar G05/G06/G07 na identidade final |
| Janela e decisão de produção | Gustavo | Decidir após receber os gates e seus recibos; a virada não foi autorizada |

O environment existir, uma label constar no workflow ou uma API de metadata retornar403/404 não prova reserva nem ausência de infraestrutura. Não houve mutação de host, concessão de grant ou instalação por esta frente.

## Sequência de fechamento

1. Concluir #613 com dev efetivo, UI42–UI44, matriz técnica original, runtime Release real, revisão independente e CI verde no head aprovado.
2. Conciliar e qualificar #710 sobre esse Design, preservando controles/oráculos e os hunks reservados da Migração.
3. Compor o dev resultante no #673, receber A2 completo/pool/Reports/suplementos, obter baselines autênticas e qualificar o candidato, incluindo a instalação impactada.
4. Confirmar o mesmo C/T com Migração e Release e registrar os dois ACKs originais; o operador efetivo fica vinculado em B.
5. Executar G05 e G06 completos nesse candidato.
6. Produzir o tar pela rota original e verificar G07, sem reconstrução entre gates.
7. Executar G08 no host existente autorizado; preservar sua evidência antes de G10 no mesmo host, com restauração independente do backup original e os controles operacionais exigidos.
8. Reunir os recibos finais e apresentar a decisão go/no-go e a janela proposta a Gustavo.

O estado permanece **0/5 gates finais; NOT_READY**. As implementações integradas e os recibos de preparação estão entregues. C/T final, tar, reservas confirmadas, provas instaladas e decisão de produção permanecem ausentes. O backlink de Compras 222 (2) continua pendente para qualquer vínculo além de seu QA original.
