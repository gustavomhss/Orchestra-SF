# Quatro sessões novas — provas reais e instalação

Um bloco completo por chat novo. Pacotes imutáveis:54d5786473feae8e1c7029677503ade4933605e7.

## Missão 196

```text
Trabalhe em gustavomhss/Orchestra-SF, em uma sessão NOVA, missão 196: Completar AM01 e AM02: cinco perfis, 18 skills, 39 operações.

Branch preparada: sf-proof-profiles. HEAD reservado: ab37cd458f02b0f74b321c3dd934924909fcf2c8. Epoch: native-closure-e1-browser196. Base do produto integrado:6607c60d2a2be183d59c2e929b3ff06633e1cb54. Preserve código e trabalho anteriores. Crie PR para sf2-stack ao entregar; não faça merge em dev.

Leia PRIMEIRO seu pacote COMPLETO e os anexos próprios/critério/contratos canônicos nele referenciados:
https://github.com/gustavomhss/Orchestra-SF/blob/54d5786473feae8e1c7029677503ade4933605e7/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/196.json
Leia AGENTS, código real e dependências antes de editar. Planejamento imutável:dbf9547211d9b0fade619790de7c19c0869b7c7d. Normativo UX:cbac654784714f68779ae1434d30e6ea8970c4d1. Retome os critérios completos do pacote; não substitua a missão por novo plano.

A entrega é COMPLETA, de código e cenários reais:
1. Reaproveitar portfolio-recall-proof.test.ts e forecast-domain-correlation.test.ts reais já integrados; não duplicar harnesses WP12/withSkillHost, nem substituir execução por correlator.
2. Implementar a cobertura positiva/negativa que falta para os cinco perfis e todas as 18 skills. Exigir SkillLoadReceipt real com source/version/digest, execução da skill, output persistido e consumidor real, inclusive sf_reviewer em execução distinta.
3. Exercer os 39 caminhos dos oito packs por wrapper C16 com binding real e comparar UI/agente/MCP sobre mesmos principal/caso/versão/porta; chamadas não concedidas recusadas. Não usar ausência de skill como autorização alternativa.
4. Cada caso deve chamar implementação real por APIs públicas suportadas e validar recibo/consumo. Teste de metadados, catálogo, fake Session/Skill/ToolRegistry ou schema aceita não substitui o caso.
5. Resolver toda implementação independente; fornecer à191 seletores existentes/novos exatos e manifesto de recursos externos mínimos por caso. Alterações de produto necessárias são patches completos inertes para189, não edições fora de seus paths.

Comece pelos cenários independentes, usando os harnesses/implementações reais que já existem. Não entregue só correlator, inventário, mocks, catálogo ou outro plano. Cubra o escopo inteiro da missão e devolva bugs causais ao dono sem parar os casos independentes. Caso um recurso externo indispensável não esteja exposto, conclua todos os drivers e correções possíveis e registre exatamente o input não secreto/ação suportada faltante; jamais fabrique recibos, identidades, grants ou PASS.

Escreva SOMENTE nos write_paths do pacote e em modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure196/. Alterações fora deles são patches completos INERTES para a integradora189, com pre/post e contexto. A189 continua única escritora de sf2-stack. A190 compila; a191 é único dispatcher de CI; a199 cuida da fixture instalada e as194/195 dos specs U15/U39/U40. Não crie writer concorrente nem espere aprovação rotineira S0.

Não rode testes, typecheck, builds ou validators localmente. Não dispare workflow/CI em paralelo. Entregue requests cirúrgicos com SHA/seletores à191 pela PR106 e à189 pela PR65; comentários são avisos, não ACK nem wake de chat. Epic/oito seleções finais serão executados no bundle C aceito. Não alegue que uma prova passou sem run real e consumo verificável.

Use SOMENTE GitHub MCP para remoto, expected-head CAS, force:false. Sem gh/git push/novo token, sem alterações Azure/infra/engines/allowlist/guards, sem reiniciar desktop/server. Registre o modelo efetivo e session ID quando expostos, sem inventar. Confira S0-FENCE e publique ACK antes da primeira escrita; preserve qualquer commit tardio e reconcilie antes de CAS.

Feche com código comitado/publicado e PR, HANDOFF completo: paths, pre/post blobs, critérios/casos, comportamento, evidências realmente obtidas, NOT_RUN/bloqueios externos exatos, consumidor e próxima ação. Não encerre em intenção ou pacote de recomendações. A Goal nativa permanece pausada; esta missão não autoriza novo supervisor/watchdog. GLOBAL_RELEASE continua falso.
```

## Missão 197

```text
Trabalhe em gustavomhss/Orchestra-SF, em uma sessão NOVA, missão 197: Completar AM03 e AM04: isolamento, revogação e efeito único.

Branch preparada: sf-proof-authority. HEAD reservado: 5e32f2ad8dfc9d71e165e348769d9203fff91add. Epoch: native-closure-e1-browser197. Base do produto integrado:6607c60d2a2be183d59c2e929b3ff06633e1cb54. Preserve código e trabalho anteriores. Crie PR para sf2-stack ao entregar; não faça merge em dev.

Leia PRIMEIRO seu pacote COMPLETO e os anexos próprios/critério/contratos canônicos nele referenciados:
https://github.com/gustavomhss/Orchestra-SF/blob/54d5786473feae8e1c7029677503ade4933605e7/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/197.json
Leia AGENTS, código real e dependências antes de editar. Planejamento imutável:dbf9547211d9b0fade619790de7c19c0869b7c7d. Normativo UX:cbac654784714f68779ae1434d30e6ea8970c4d1. Retome os critérios completos do pacote; não substitua a missão por novo plano.

A entrega é COMPLETA, de código e cenários reais:
1. Reaproveitar provider-generation/correlation e testes reais de lifecycle já integrados; complementar a cobertura funcional ausente, não criar outro correlator.
2. AM03: duas sessões/atores reais, mesmo perfil/contextos distintos; negativa de IDs/grants/actor/role forjados, revogação entre discovery/execution e search/detail, troca de provider objeto/generation e novo binding após reabrir sessão.
3. AM04: usar comandos reais do domínio e ação humana autorizada; interromper depois do commit e antes do retorno, recuperar recibo e provar exatamente um efeito no retry. Chave+digest iguais retornam resultado; conteúdo diferente falha; preservar estados parciais por domínio.
4. Usar falhas controladas no ponto público existente de execução/retorno, armazenamento real e reload genuíno; mocks de recibo/autoridade não passam. Não parar por depender de um bug externo: devolver patch causal à189 e continuar casos independentes.
5. Completar código e entregar requests cirúrgicos à191 com inputs/efeitos/recibos/casos e recursos externos ausentes exatos, sem rodar testes localmente ou lançar CI paralelo.

Comece pelos cenários independentes, usando os harnesses/implementações reais que já existem. Não entregue só correlator, inventário, mocks, catálogo ou outro plano. Cubra o escopo inteiro da missão e devolva bugs causais ao dono sem parar os casos independentes. Caso um recurso externo indispensável não esteja exposto, conclua todos os drivers e correções possíveis e registre exatamente o input não secreto/ação suportada faltante; jamais fabrique recibos, identidades, grants ou PASS.

Escreva SOMENTE nos write_paths do pacote e em modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure197/. Alterações fora deles são patches completos INERTES para a integradora189, com pre/post e contexto. A189 continua única escritora de sf2-stack. A190 compila; a191 é único dispatcher de CI; a199 cuida da fixture instalada e as194/195 dos specs U15/U39/U40. Não crie writer concorrente nem espere aprovação rotineira S0.

Não rode testes, typecheck, builds ou validators localmente. Não dispare workflow/CI em paralelo. Entregue requests cirúrgicos com SHA/seletores à191 pela PR106 e à189 pela PR65; comentários são avisos, não ACK nem wake de chat. Epic/oito seleções finais serão executados no bundle C aceito. Não alegue que uma prova passou sem run real e consumo verificável.

Use SOMENTE GitHub MCP para remoto, expected-head CAS, force:false. Sem gh/git push/novo token, sem alterações Azure/infra/engines/allowlist/guards, sem reiniciar desktop/server. Registre o modelo efetivo e session ID quando expostos, sem inventar. Confira S0-FENCE e publique ACK antes da primeira escrita; preserve qualquer commit tardio e reconcilie antes de CAS.

Feche com código comitado/publicado e PR, HANDOFF completo: paths, pre/post blobs, critérios/casos, comportamento, evidências realmente obtidas, NOT_RUN/bloqueios externos exatos, consumidor e próxima ação. Não encerre em intenção ou pacote de recomendações. A Goal nativa permanece pausada; esta missão não autoriza novo supervisor/watchdog. GLOBAL_RELEASE continua falso.
```

## Missão 198

```text
Trabalhe em gustavomhss/Orchestra-SF, em uma sessão NOVA, missão 198: Completar AM05 e AM06: Atlas/scanner e Relay reais.

Branch preparada: sf-proof-persistence. HEAD reservado: 3d12706365880ee4e12d01db6c875029183a00b0. Epoch: native-closure-e1-browser198. Base do produto integrado:6607c60d2a2be183d59c2e929b3ff06633e1cb54. Preserve código e trabalho anteriores. Crie PR para sf2-stack ao entregar; não faça merge em dev.

Leia PRIMEIRO seu pacote COMPLETO e os anexos próprios/critério/contratos canônicos nele referenciados:
https://github.com/gustavomhss/Orchestra-SF/blob/54d5786473feae8e1c7029677503ade4933605e7/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/198.json
Leia AGENTS, código real e dependências antes de editar. Planejamento imutável:dbf9547211d9b0fade619790de7c19c0869b7c7d. Normativo UX:cbac654784714f68779ae1434d30e6ea8970c4d1. Retome os critérios completos do pacote; não substitua a missão por novo plano.

A entrega é COMPLETA, de código e cenários reais:
1. Reaproveitar scanner-write-gates e routine-native-admission/native-owner-binding existentes; completar os cenários canônicos, não outro correlator/ledger sintético.
2. AM05: business-memory-ports com factories reais, scanner binário real/versionado, clean/canary/timeout/ausência; append+commit+read, reinício e nova leitura, isolamento de owner/ator/caso, revogação/encarnação, falha de commit e resposta perdida. Scanner indisponível não é PASS.
3. AM06: admissão C07 pública existente pinada, Relay, perfil/skill, operação SF, run/result e consumidor produto com IDs/versões reais; retry/intervenção/cancelamento/revogação. Em routine-result, prepare/run devem ser recusados sem recursão.
4. Não alterar engines Maestro/Relay/Schedule, allowlists ou guardrules, nem criar admissão privada/bypass. Se uma capacidade pública realmente faltar, identificar API/critério e devolver patch de binding SF completo à189; preservar o bloqueio da prova dependente e concluir todo cenário independente.
5. Fornecer drivers/specs completos e requests exatos à191. Não alegar persistência real com ledger SF isolado, fake scanner, stub Relay ou texto de LLM.

Comece pelos cenários independentes, usando os harnesses/implementações reais que já existem. Não entregue só correlator, inventário, mocks, catálogo ou outro plano. Cubra o escopo inteiro da missão e devolva bugs causais ao dono sem parar os casos independentes. Caso um recurso externo indispensável não esteja exposto, conclua todos os drivers e correções possíveis e registre exatamente o input não secreto/ação suportada faltante; jamais fabrique recibos, identidades, grants ou PASS.

Escreva SOMENTE nos write_paths do pacote e em modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure198/. Alterações fora deles são patches completos INERTES para a integradora189, com pre/post e contexto. A189 continua única escritora de sf2-stack. A190 compila; a191 é único dispatcher de CI; a199 cuida da fixture instalada e as194/195 dos specs U15/U39/U40. Não crie writer concorrente nem espere aprovação rotineira S0.

Não rode testes, typecheck, builds ou validators localmente. Não dispare workflow/CI em paralelo. Entregue requests cirúrgicos com SHA/seletores à191 pela PR106 e à189 pela PR65; comentários são avisos, não ACK nem wake de chat. Epic/oito seleções finais serão executados no bundle C aceito. Não alegue que uma prova passou sem run real e consumo verificável.

Use SOMENTE GitHub MCP para remoto, expected-head CAS, force:false. Sem gh/git push/novo token, sem alterações Azure/infra/engines/allowlist/guards, sem reiniciar desktop/server. Registre o modelo efetivo e session ID quando expostos, sem inventar. Confira S0-FENCE e publique ACK antes da primeira escrita; preserve qualquer commit tardio e reconcilie antes de CAS.

Feche com código comitado/publicado e PR, HANDOFF completo: paths, pre/post blobs, critérios/casos, comportamento, evidências realmente obtidas, NOT_RUN/bloqueios externos exatos, consumidor e próxima ação. Não encerre em intenção ou pacote de recomendações. A Goal nativa permanece pausada; esta missão não autoriza novo supervisor/watchdog. GLOBAL_RELEASE continua falso.
```

## Missão 199

```text
Trabalhe em gustavomhss/Orchestra-SF, em uma sessão NOVA, missão 199: Fechar o consumo da instalação F04 e a prova desktop D01.

Branch preparada: sf-installed-host. HEAD reservado: 587a4a8c632a2a510c5992cac226743ddcff6caa. Epoch: native-closure-e1-browser199. Base do produto integrado:6607c60d2a2be183d59c2e929b3ff06633e1cb54. Preserve código e trabalho anteriores. Crie PR para sf2-stack ao entregar; não faça merge em dev.

Leia PRIMEIRO seu pacote COMPLETO e os anexos próprios/critério/contratos canônicos nele referenciados:
https://github.com/gustavomhss/Orchestra-SF/blob/54d5786473feae8e1c7029677503ade4933605e7/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/199.json
Leia AGENTS, código real e dependências antes de editar. Planejamento imutável:dbf9547211d9b0fade619790de7c19c0869b7c7d. Normativo UX:cbac654784714f68779ae1434d30e6ea8970c4d1. Retome os critérios completos do pacote; não substitua a missão por novo plano.

A entrega é COMPLETA, de código e cenários reais:
1. Partir do produto integrado atual e consumir SOMENTE a closure F04 de187@96c01020db59d9b4f8d44300638418d67ee11fea descrita em ARTIFACT.json/HANDOFF-162.md após comparar pre/post; preservar alterações recentes da189. Não reimplementar F01/F02/auth.
2. Completar o driver de registro/consumo do manifesto privado para a instalação suportada existente: candidate SHA exato, contextos autenticados Microsoft distintos, provider/serverKey aprovado e rotas/ref/versões reais por seleção. Nenhum cookie/token/segredo/grant deve ir para Git, ferramentas de agente ou artefato público.
3. Entregar o contrato e helper consumível de CAP14(U15), CAP04/05(U39/U40) aos autores194/195, sem editar os specs deles. As admissões são revalidadas no produtor atual, nunca por nome de papel/flag/URL inventada.
4. Completar a preparação do teste D01 usando Electron empacotado, broker e partition reais por harness existente; teste web não satisfaz desktop. Não iniciar/reiniciar Orchestra local nem provisionar Azure/serviços globais. Hosted runner somente via191.
5. Entregar o código completo dos drivers/fixtures e, para recurso externo indisponível, um registro único e preciso de localização/configuração não secreta/ação suportada faltante. Terminar toda preparação possível; não alegar que script ou manifesto provam execução instalada.
6. A configuração compartilhada playwright.production.config.ts pertence à189: entregar patch completo inerte, não editar diretamente. Não renomear scratch.ts só para fugir do guard; preservar188 e pedir resolução causal à189/guard owner.

Comece pelos cenários independentes, usando os harnesses/implementações reais que já existem. Não entregue só correlator, inventário, mocks, catálogo ou outro plano. Cubra o escopo inteiro da missão e devolva bugs causais ao dono sem parar os casos independentes. Caso um recurso externo indispensável não esteja exposto, conclua todos os drivers e correções possíveis e registre exatamente o input não secreto/ação suportada faltante; jamais fabrique recibos, identidades, grants ou PASS.

Escreva SOMENTE nos write_paths do pacote e em modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure199/. Alterações fora deles são patches completos INERTES para a integradora189, com pre/post e contexto. A189 continua única escritora de sf2-stack. A190 compila; a191 é único dispatcher de CI; a199 cuida da fixture instalada e as194/195 dos specs U15/U39/U40. Não crie writer concorrente nem espere aprovação rotineira S0.

Não rode testes, typecheck, builds ou validators localmente. Não dispare workflow/CI em paralelo. Entregue requests cirúrgicos com SHA/seletores à191 pela PR106 e à189 pela PR65; comentários são avisos, não ACK nem wake de chat. Epic/oito seleções finais serão executados no bundle C aceito. Não alegue que uma prova passou sem run real e consumo verificável.

Use SOMENTE GitHub MCP para remoto, expected-head CAS, force:false. Sem gh/git push/novo token, sem alterações Azure/infra/engines/allowlist/guards, sem reiniciar desktop/server. Registre o modelo efetivo e session ID quando expostos, sem inventar. Confira S0-FENCE e publique ACK antes da primeira escrita; preserve qualquer commit tardio e reconcilie antes de CAS.

Feche com código comitado/publicado e PR, HANDOFF completo: paths, pre/post blobs, critérios/casos, comportamento, evidências realmente obtidas, NOT_RUN/bloqueios externos exatos, consumidor e próxima ação. Não encerre em intenção ou pacote de recomendações. A Goal nativa permanece pausada; esta missão não autoriza novo supervisor/watchdog. GLOBAL_RELEASE continua falso.
```
