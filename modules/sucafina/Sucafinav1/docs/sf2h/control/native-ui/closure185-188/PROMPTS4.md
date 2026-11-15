# Quatro novas sessões — 185 a 188

Copie cada bloco inteiro para uma sessão NOVA. As branches estão preparadas; isso não equivale a ACK ou início. A 162 mantém a integração. As sessões 165–184 permanecem com seus escopos.

## 185 — Contratos — executar seis jornadas sem skip

```text
Trabalhe em uma NOVA sessão Astra no repositório gustavomhss/Orchestra-SF.

Missão 185: Contratos — executar seis jornadas sem skip.
Branch preparada: sf-ux-n22. Continue a mesma PR #153.
Epoch: closure-e1-browser185.
HEAD preparado: 3429cf23157a56b6ff5d5b4794d1207fad31f1fa.

Leia na íntegra o pacote abaixo, incluindo os work orders, critérios, contratos, anexos e instruções AGENTS indicados:
https://github.com/gustavomhss/Orchestra-SF/blob/8100bdc01566bf88532f2b497690cec3c84b551c/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/185.json

Corrija as seis jornadas CAP14/U15 que usam test.skip. Preserve os cenários e as asserções. Conecte os testes ao harness F04 real; quando faltar uma identidade, instalação ou fixture obrigatória, produza uma falha explícita com a causa. Não use mocks de autorização nem apague casos para obter verde. Você só pode editar u15.spec.ts e seus recibos.

Antes de editar, confira HEAD, fence, fontes e dependências reais. Preserve os commits anteriores. Se houver mudanças inesperadas, reconcilie sem reset ou force. Publique ACK com epoch, inputs por SHA e modelo/session ID somente quando realmente expostos.

A 162 continua como única integradora. As sessões 163/164 deixaram handoffs terminais: publique pedidos duráveis de validação para a autoridade atual ou sucessora explícita, sem presumir que um comentário acorde o chat. Não execute testes, typecheck, parsers, validadores ou builds localmente. Não crie outro dispatcher ou workflow de CI. As sessões 165–184 mantêm seus escopos.

Execute todo o trabalho independente agora até entregar código ou a revisão concreta autorizada. Não devolva apenas outro plano. Entregue patch completo, SHAs/tree/blobs de fonte e consumidor, critérios cobertos, provas reais ou NOT_RUN, pendências e próxima ação exata. Missing fixture, skip ou mock não é prova positiva.

Use somente GitHub MCP para operações remotas, com CAS e force=false. Sem gh/git push, merge em dev, deploy/Azure, alterações nos engines, segredos, restart ou nova Goal/controlador. A Goal nativa permanece pausada. GLOBAL_RELEASE continua pendente dos gates integrais.
```

## 186 — OPEX/CAPEX — remover skips com pré-requisitos reais

```text
Trabalhe em uma NOVA sessão Astra no repositório gustavomhss/Orchestra-SF.

Missão 186: OPEX/CAPEX — remover skips com pré-requisitos reais.
Branch preparada: sf-ux-n13. Continue a mesma PR #150.
Epoch: closure-e1-browser186.
HEAD preparado: 9d0e41d003800a8da2f7d60f67433fdf71d88916.

Leia na íntegra o pacote abaixo, incluindo os work orders, critérios, contratos, anexos e instruções AGENTS indicados:
https://github.com/gustavomhss/Orchestra-SF/blob/8100bdc01566bf88532f2b497690cec3c84b551c/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/186.json

Corrija as marcações de skip das jornadas U39/U40, de OPEX e CAPEX. Preserve leitura, revisão de rascunho, distinção entre zero e ausência e os cenários de responsividade. Exija instalação e identidades autorizadas reais do F04. Ausência de pré-requisito deve falhar explicitamente. Não conceda acesso por uma flag inventada. Você só pode editar u39.spec.ts, u40.spec.ts e seus recibos.

Antes de editar, confira HEAD, fence, fontes e dependências reais. Preserve os commits anteriores. Se houver mudanças inesperadas, reconcilie sem reset ou force. Publique ACK com epoch, inputs por SHA e modelo/session ID somente quando realmente expostos.

A 162 continua como única integradora. As sessões 163/164 deixaram handoffs terminais: publique pedidos duráveis de validação para a autoridade atual ou sucessora explícita, sem presumir que um comentário acorde o chat. Não execute testes, typecheck, parsers, validadores ou builds localmente. Não crie outro dispatcher ou workflow de CI. As sessões 165–184 mantêm seus escopos.

Execute todo o trabalho independente agora até entregar código ou a revisão concreta autorizada. Não devolva apenas outro plano. Entregue patch completo, SHAs/tree/blobs de fonte e consumidor, critérios cobertos, provas reais ou NOT_RUN, pendências e próxima ação exata. Missing fixture, skip ou mock não é prova positiva.

Use somente GitHub MCP para operações remotas, com CAS e force=false. Sem gh/git push, merge em dev, deploy/Azure, alterações nos engines, segredos, restart ou nova Goal/controlador. A Goal nativa permanece pausada. GLOBAL_RELEASE continua pendente dos gates integrais.
```

## 187 — F04 — harness instalado e identidades reais

```text
Trabalhe em uma NOVA sessão Astra no repositório gustavomhss/Orchestra-SF.

Missão 187: F04 — harness instalado e identidades reais.
Branch preparada: sf-ux-w05. Continue a mesma PR #120.
Epoch: closure-e1-browser187.
HEAD preparado: d300e495d309c1083a35e34755b04cf3c6f06ae5.

Leia na íntegra o pacote abaixo, incluindo os work orders, critérios, contratos, anexos e instruções AGENTS indicados:
https://github.com/gustavomhss/Orchestra-SF/blob/8100bdc01566bf88532f2b497690cec3c84b551c/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/187.json

Complete o harness F04 usando a instalação isolada, os provisionadores e as APIs legítimas já existentes. Conecte manifest, readiness, seleção de fixtures, identidades autorizadas e injeções de falha às jornadas. Forneça os pré-requisitos exigidos pelas sessões 185/186. Não simule autenticação, não crie outro servidor e não toque no desktop/server do usuário. Se o Electron real não estiver disponível, mantenha a prova de desktop pendente. O pacote restringe sua escrita aos arquivos F04.

Antes de editar, confira HEAD, fence, fontes e dependências reais. Preserve os commits anteriores. Se houver mudanças inesperadas, reconcilie sem reset ou force. Publique ACK com epoch, inputs por SHA e modelo/session ID somente quando realmente expostos.

A 162 continua como única integradora. As sessões 163/164 deixaram handoffs terminais: publique pedidos duráveis de validação para a autoridade atual ou sucessora explícita, sem presumir que um comentário acorde o chat. Não execute testes, typecheck, parsers, validadores ou builds localmente. Não crie outro dispatcher ou workflow de CI. As sessões 165–184 mantêm seus escopos.

Execute todo o trabalho independente agora até entregar código ou a revisão concreta autorizada. Não devolva apenas outro plano. Entregue patch completo, SHAs/tree/blobs de fonte e consumidor, critérios cobertos, provas reais ou NOT_RUN, pendências e próxima ação exata. Missing fixture, skip ou mock não é prova positiva.

Use somente GitHub MCP para operações remotas, com CAS e force=false. Sem gh/git push, merge em dev, deploy/Azure, alterações nos engines, segredos, restart ou nova Goal/controlador. A Goal nativa permanece pausada. GLOBAL_RELEASE continua pendente dos gates integrais.
```

## 188 — Guardrails — revisar gates e preservar evidências

```text
Trabalhe em uma NOVA sessão Astra no repositório gustavomhss/Orchestra-SF.

Missão 188: Guardrails — revisar gates e preservar evidências.
Branch preparada: sf-guard-evidence. Abra uma PR para sf2-stack ao entregar.
Epoch: closure-e1-browser188.
HEAD preparado: 913b6b8f143e6c3e869eee293d02f04259c7cdd1.

Leia na íntegra o pacote abaixo, incluindo os work orders, critérios, contratos, anexos e instruções AGENTS indicados:
https://github.com/gustavomhss/Orchestra-SF/blob/8100bdc01566bf88532f2b497690cec3c84b551c/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/188.json

Revise independentemente os 66 gates registrados: 56 agent-scratch e 10 js-test-skipped. As sessões 185/186 tratam os skips; a 187 trata o harness. Classifique cada log por origem, uso e consumidores, preservando commit, caminho e hash recuperáveis. Prepare um patch INERTE apenas para material comprovadamente descartável. O helper F04 é código de teste e exige análise própria. Não apague produto ou provas, não altere regras, não adicione ignores e não conceda labels de aprovação. Sua escrita fica limitada aos próprios recibos; a 162 avalia e aplica propostas.

Antes de editar, confira HEAD, fence, fontes e dependências reais. Preserve os commits anteriores. Se houver mudanças inesperadas, reconcilie sem reset ou force. Publique ACK com epoch, inputs por SHA e modelo/session ID somente quando realmente expostos.

A 162 continua como única integradora. As sessões 163/164 deixaram handoffs terminais: publique pedidos duráveis de validação para a autoridade atual ou sucessora explícita, sem presumir que um comentário acorde o chat. Não execute testes, typecheck, parsers, validadores ou builds localmente. Não crie outro dispatcher ou workflow de CI. As sessões 165–184 mantêm seus escopos.

Execute todo o trabalho independente agora até entregar código ou a revisão concreta autorizada. Não devolva apenas outro plano. Entregue patch completo, SHAs/tree/blobs de fonte e consumidor, critérios cobertos, provas reais ou NOT_RUN, pendências e próxima ação exata. Missing fixture, skip ou mock não é prova positiva.

Use somente GitHub MCP para operações remotas, com CAS e force=false. Sem gh/git push, merge em dev, deploy/Azure, alterações nos engines, segredos, restart ou nova Goal/controlador. A Goal nativa permanece pausada. GLOBAL_RELEASE continua pendente dos gates integrais.
```
