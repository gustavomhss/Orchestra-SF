Trabalhe em uma SESSÃO NOVA do Astra no repositório gustavomhss/Orchestra-SF.
Missão 231: Fechar a composição real F01 e retomada de Hoje.
Branch JÁ CRIADA: sf-home-binding.
HEAD esperado para iniciar: 732e2d2045815d22960f9c5a7eb3cf8172b472ef.
Base de entrada: 998f0afd6047409956418f40c570dc9c48dc6c8f.
Época de escrita: home-host-binding-e1-browser231.
Você deve concluir esta frente até código/patches e handoff revisáveis, com PR; não entregar apenas plano ou intenção.

PACOTE COMPLETO DA SUA MISSÃO:
https://github.com/gustavomhss/Orchestra-SF/blob/75c14f24736c25a18b311690c3a7ba7cb333d629/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/231.json

Leia AGENTS aplicáveis; START.md, WORKFLOW.md, execution/COMMON.md e o pack completo execution/actors/S0.json em modules/sucafina/Sucafinav1/docs/sf2h-plan/ no commit FIXO dbf9547211d9b0fade619790de7c19c0869b7c7d, usando apenas as atribuições e anexos pertinentes desta missão. Preserve o escopo original de 15 WPs/74 tasks/17 contratos/1610 critérios e o UX aprovado cbac654784714f68779ae1434d30e6ea8970c4d1. T0 é 2026-11-13T04:01:10Z; a campanha está CONTINUING_LATE. A Goal nativa permanece pausada; esta missão manual não autoriza novo supervisor, watchdog ou reativação.

INPUTS JÁ LOCALIZADOS, PARA EVITAR REDESCOBERTA:
https://github.com/gustavomhss/Orchestra-SF/blob/c2f0ef0ce180aad3fe31bd3af8485400ee4e0d79/modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure227/HANDOFF-227.json
https://github.com/gustavomhss/Orchestra-SF/blob/c2f0ef0ce180aad3fe31bd3af8485400ee4e0d79/modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure227/INERT-211-BINDING.md
https://github.com/gustavomhss/Orchestra-SF/blob/33474b2158a4703f256191f61f1a16ac85c26004/modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure228/CANDIDATE-DETACHED-TREE-V2.json


O problema foi confirmado no código: chapter-route.tsx da base não registra sf-home/sf-decisions. A 227 entregou SfContextDependencies.navigation e a implementação de retomada, mas seu INERT-211-BINDING.md usa variáveis ilustrativas de uma composição ainda não conectada. A 228 arquivou o adapter today-resume-binding.tsx e o marcou F01_CALLSITE_NOT_WIRED.
Sua missão é resolver o ponto REAL de montagem, não entregar outro wrapper sem callsite. Implemente o módulo novo owner-runtime231.tsx e entregue patches completos INERTES dos arquivos existentes de rota/root/registro/sidebar/SDK necessários para usá-lo. Preserve o singleton createSfNavigationState com resolveAuthorizedRoute, selected, currentHref, currentOwnerKey, hasDirtyDrafts, confirmDiscard, invalidateOwner, commit e validateRetained alimentados pelas fontes reais existentes. Não invente callbacks, instalações, identidade ou concessões.
Consuma as alterações227 por SHA. Não reescreva navegação/contexto/Home existentes nem use a árvore antiga inteira para substituir a atual. Encadeie a UI29, o projection.case original com duas leituras, o UI34 admitido pelo F01 e o retorno/foco one-shot. Se falta uma fonte pública real, identifique o produtor e entregue a implementação mínima completa proposta como patch inerte; não fabrique sucesso.

EXECUTE TODO O ESCOPO:
1. Complete real root composition, not another unused wrapper. The 227 SfTodayBoundOwnerProvider adapter and 228 proposed postimage exist but have no actual callsite. chapter-route.tsx in base does not register sf-home/sf-decisions. Recover actual approved F01 route/owner/context construction and route-registry before authoring.
2. Implement owner-runtime231.tsx connecting existing authenticated original sources, singleton createSfNavigationState, SfContextProvider and native Home/UI34 route handling. Preserve shell identity/design, selected ServerConnection, directory, installation, access revision, revocation, drafts, history and one-shot return/focus. Register only approved native chapter surfaces needed for this composition; preserve other delivered chapters.
3. Deliver COMPLETE inert patches for all existing-file callsites (chapter-route.tsx, root route/sidebar/context/dependency binding as actually necessary), with imports, no undefined illustrative variables or TODO callbacks. Do not write existing paths owned by211/228 or substitute owner/identity/HTTP stubs. If source required is truly absent, give exact missing API with full minimal inert implementation proposal.
4. Reuse 227 exact context/navigation code and original228 adapter, do not rewrite them. Explain how all required 227 leaves are consumed. Include genuine browser driver and negative revoked/owner-switch/stale/dirty-draft/back tests. No local tests or independent CI.

FRONTEIRA DE ESCRITA:
- packages/app-shell/src/orchestra/chapters/sucafina/host/owner-runtime231.tsx
- packages/app-shell/test-browser/sucafina-native/host-binding231.test.ts
- modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/**
Fora desses paths, entregue patch completo INERTO nos seus receipts, com pre/post exatos. Arquivos existentes e branches211/228 são somente leitura. A 211 ainda conserva a autoridade do bundle; o handoff confiável 211→228 não foi observado. Não transfira autoridade por silêncio ou idade de commit. Não escreva em sf2-control nem sf-closure-bundle. O seu PR é um output para consumo controlado; não faça merge em dev. Abra PR contra sf-closure-bundle (PR191), com produto e patches externos claramente distinguidos.

REGRAS OPERACIONAIS:
- Confira HEAD e S0-FENCE por GitHub MCP antes de escrever; registre ACK com época, entradas e modelo/session reais quando disponíveis. Se a branch avançou, reconcilie o delta; não resetar.
- Remoto somente GitHub MCP; CAS/expected-head, force:false. Sem gh, git push/fetch remoto, force push ou novo login/token.
- Não execute testes, typecheck, build ou validadores LOCALMENTE. Não dispare CI; entregue CI-REQUEST.json para a232, com seleção cirúrgica exata e dependências reais.
- Não altere Azure, recursos externos, políticas financeiras ou identidade corporativa, engines Maestro/Relay/Schedule, SDK gerado, desktop/server ou guards para fazê-los passar. Não leia nem imprima segredos.
- Sem mocks como prova AM positiva, grants/Task/identidades inventados, providers substituídos ou evidência reciclada como se fosse do novo C.
- Comentário em PR não injeta instrução nem acorda um chat existente. Trabalhe até o seu handoff completo; preserve próximos consumidores e não espere feedback de chats antigos.
- Não confunda proposta inerte, código comitado e testes de desenvolvimento com GLOBAL_RELEASE. Falta de capacidade externa bloqueia só a prova dependente; termine todo trabalho independente.

CHECKLIST DE ENTREGA EM modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/:
ACK.json; HANDOFF.json com versão, paths, blob pre/post, comportamento, critérios cobertos/abertos, achados e consumidor; patches completos com proveniência; CI-REQUEST.json e RECHECK.json; release explícito da sua autoridade quando encerrar.
Marque tudo que não executou como NOT_RUN. No retorno, limite-se a PR + commit + comportamento entregue + checks realmente executados + pendências e próximo consumidor. Não finalize só em BLOCKED_CONTRACT, inventário de ports ou aprovação sem prova.
