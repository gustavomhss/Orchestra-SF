Trabalhe em uma SESSÃO NOVA do Astra no repositório gustavomhss/Orchestra-SF.
Missão 230: Revisão independente e correção completa da recuperação C12.
Branch JÁ CRIADA: sf-c12-review.
HEAD esperado para iniciar: 96a398b80c61b9acb53b1ff479d51b4e19bcfd7c.
Base de entrada: 998f0afd6047409956418f40c570dc9c48dc6c8f.
Época de escrita: c12-review-e1-browser230.
Você deve concluir esta frente até código/patches e handoff revisáveis, com PR; não entregar apenas plano ou intenção.

PACOTE COMPLETO DA SUA MISSÃO:
https://github.com/gustavomhss/Orchestra-SF/blob/75c14f24736c25a18b311690c3a7ba7cb333d629/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/230.json

Leia AGENTS aplicáveis; START.md, WORKFLOW.md, execution/COMMON.md e o pack completo execution/actors/S2-R2.json em modules/sucafina/Sucafinav1/docs/sf2h-plan/ no commit FIXO dbf9547211d9b0fade619790de7c19c0869b7c7d, usando apenas as atribuições e anexos pertinentes desta missão. Preserve o escopo original de 15 WPs/74 tasks/17 contratos/1610 critérios e o UX aprovado cbac654784714f68779ae1434d30e6ea8970c4d1. T0 é 2026-11-13T04:01:10Z; a campanha está CONTINUING_LATE. A Goal nativa permanece pausada; esta missão manual não autoriza novo supervisor, watchdog ou reativação.

INPUTS JÁ LOCALIZADOS, PARA EVITAR REDESCOBERTA:
https://github.com/gustavomhss/Orchestra-SF/blob/f4fc2af5809f8af6c2dc5b8ddcb176ee3409f002/modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair220/HANDOFF-211-214.json
https://github.com/gustavomhss/Orchestra-SF/blob/f4fc2af5809f8af6c2dc5b8ddcb176ee3409f002/modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair220/INERT-PATCH-211-v2.json
https://github.com/gustavomhss/Orchestra-SF/blob/33474b2158a4703f256191f61f1a16ac85c26004/modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure228/CANDIDATE-DETACHED-TREE-V2.json


Você é revisor independente desta alteração, sem autoria prévia do C12. Sua revisão NÃO substitui as três revisões finais da campanha. O rótulo antigo HUMAN_POLICY_REVIEW_REQUIRED não é por si só prova de mudança de política: confronte o patch com o contrato original. Se houver mudança de alçada ou política financeira, mantenha-a fora do produto e explicite o ponto; se for reparo de implementação mantendo a política existente, dê um parecer técnico verificável. Não crie uma dependência circular de aprovação.
O candidato inerte228 propõe mudanças em product/procurement/{scenario-preparation,prepared,prepared-review}.ts, condicionadas à sua revisão. Leia as três na íntegra e seus consumidores, incluindo fixtures de C12/AM04/AM05. Entregue decisão e, para cada achado obrigatório, patch completo INERTO e seleção cirúrgica de regressão. Não pare em uma lista de findings que outro agente terá de redescobrir.

EXECUTE TODO O ESCOPO:
1. Review all three C12 recovery changes and fixture changes against original C12 contract, AM04/AM05 and existing financial approval policy. Distinguish repairing original capture/receipt causality from changing authority or policy.
2. Trace exact original prepare -> review -> capture -> memory consumption, idempotence and denied/revoked/stale behavior using real implementations. A fixture fix cannot replace an absent production capture.
3. Deliver ACCEPT_UNCHANGED_POLICY or FIX_FIRST with exact evidence, pre/post blobs and full inert corrective patch plus surgical tests if needed. Do not require new human financial approval merely because earlier receipt labels say HUMAN_POLICY_REVIEW_REQUIRED; require approval only if actual scope changes an existing policy.
4. Explicitly separate source review from final independent release approval. No product writing and no tests/CI.

FRONTEIRA DE ESCRITA:
- modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure230/**
Fora desses paths, entregue patch completo INERTO nos seus receipts, com pre/post exatos. Arquivos existentes e branches211/228 são somente leitura. A 211 ainda conserva a autoridade do bundle; o handoff confiável 211→228 não foi observado. Não transfira autoridade por silêncio ou idade de commit. Não escreva em sf2-control nem sf-closure-bundle. O seu PR é um output para consumo controlado; não faça merge em dev. Abra PR contra sf-closure-bundle (PR191), com produto e patches externos claramente distinguidos.

REGRAS OPERACIONAIS:
- Confira HEAD e S0-FENCE por GitHub MCP antes de escrever; registre ACK com época, entradas e modelo/session reais quando disponíveis. Se a branch avançou, reconcilie o delta; não resetar.
- Remoto somente GitHub MCP; CAS/expected-head, force:false. Sem gh, git push/fetch remoto, force push ou novo login/token.
- Não execute testes, typecheck, build ou validadores LOCALMENTE. Não dispare CI; entregue CI-REQUEST.json para a232, com seleção cirúrgica exata e dependências reais.
- Não altere Azure, recursos externos, políticas financeiras ou identidade corporativa, engines Maestro/Relay/Schedule, SDK gerado, desktop/server ou guards para fazê-los passar. Não leia nem imprima segredos.
- Sem mocks como prova AM positiva, grants/Task/identidades inventados, providers substituídos ou evidência reciclada como se fosse do novo C.
- Comentário em PR não injeta instrução nem acorda um chat existente. Trabalhe até o seu handoff completo; preserve próximos consumidores e não espere feedback de chats antigos.
- Não confunda proposta inerte, código comitado e testes de desenvolvimento com GLOBAL_RELEASE. Falta de capacidade externa bloqueia só a prova dependente; termine todo trabalho independente.

CHECKLIST DE ENTREGA EM modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure230/:
ACK.json; HANDOFF.json com versão, paths, blob pre/post, comportamento, critérios cobertos/abertos, achados e consumidor; patches completos com proveniência; CI-REQUEST.json e RECHECK.json; release explícito da sua autoridade quando encerrar.
Marque tudo que não executou como NOT_RUN. No retorno, limite-se a PR + commit + comportamento entregue + checks realmente executados + pendências e próximo consumidor. Não finalize só em BLOCKED_CONTRACT, inventário de ports ou aprovação sem prova.
