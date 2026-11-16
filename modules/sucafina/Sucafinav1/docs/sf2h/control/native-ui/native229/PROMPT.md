Trabalhe em uma SESSÃO NOVA no repositório gustavomhss/Orchestra-SF. Você é o implementador 229, responsável por resolver integralmente o achado R3-TASK-03: origem nativa legítima de Task/Relay para o produto Sucafina. Entregue código revisável e PR, não apenas diagnóstico.

Sua branch já existe: sf-native-origin.
Head reservado: 82e3f1833ff538621dad99bc1c98e8eee3f169b8.
Base de produto: 998f0afd6047409956418f40c570dc9c48dc6c8f (sf-closure-bundle, PR191).
Época: native-origin-resolution-e1-browser229.
Campanha: sf2h-integral-20261112. T0: 2026-11-13T04:01:10Z.
Plano imutável: dbf9547211d9b0fade619790de7c19c0869b7c7d.
A Goal nativa está pausada; esta missão manual não autoriza criar ou reativar controlador/Goal.

Leia PRIMEIRO seu pacote COMPLETO, inclusive o handoff219 embutido:
https://github.com/gustavomhss/Orchestra-SF/blob/404d23a76ad4e5214bc26362ea91b4fe831ac067/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/229.json

Leia AGENTS aplicáveis, START.md, WORKFLOW.md, execution/COMMON.md e os critérios completos pertinentes de C07/C15/C16/C17, AM06 e WP09/WP10/WP12 na fonte fixa modules/sucafina/Sucafinav1/docs/sf2h-plan/. A fonte de UX aprovada é cbac654784714f68779ae1434d30e6ea8970c4d1. Preserve 15 WPs, 74 tasks, 17 contratos e 1610 critérios. Não reduza a aceitação para um mock ou MVP.

O que já existe e deve ser preservado:
A 219 implementou a fronteira HTTP humana A09, reautorização do comando e reconstrução do seletor C15. Ela NÃO entregou um produtor real de Task. Seu handoff está em sf-native-admission@8f4f7e102ac1b73dc014e23737cc62bba84043ee. Recupere o arquivo native-routine-producer219.ts pelo blob original dcd223898ca0bddb755ec2dc6b8e3fe2bd149cf4, respeitando o release publicado. Não copie o host-context219 inteiro: sua base é antiga e perderia composição posterior.

Execute:
1. Confira branch/head, S0-FENCE, paths, época, estado remoto e eventuais mudanças posteriores antes de editar. Registre ACK, modelo e identidade reais quando expostos. Não sobrescreva trabalho alheio.
2. Leia o fluxo real: Request humano autenticado e admissão A09 → SessionV2/prompt durável → execução real ToolRegistry/Task → CapabilityInvocation/Permission/aprovação C15 → publicação Relay fixada → run/result → consumo no SF. Verifique assinaturas e implementações públicas, inclusive Location e cancelamento.
3. Implemente a fábrica de origem nativa utilizando o caminho público suportado existente, se disponível. Não forje Session/Task/call IDs, Tool frames, grants, aprovações ou resultados. Um leitor/correlator de Task não é um executor proprietário. Preserve principal, caso, incarnation/version, intenção, geração de provider, revisão de acesso e revogação entre admissão e execução.
4. Se faltar realmente uma API pública, produza uma proposta mínima COMPLETA: patch INERTO da extensão e teste de regressão, patch completo do consumidor SF, pre/post, assinaturas, invariantes e demonstração precisa do ponto ausente. Não encerre com outra lista de ports ou BLOCKED_CONTRACT genérico. Core/engines permanecem somente leitura; uma proposta não autoriza aplicar mudanças nesses paths.
5. Acrescente drivers e testes cirúrgicos do comportamento real e negativas de revogação/cancelamento/intent stale. Não declare AM06 positivo sem execução real de provider/Task/Relay e retorno ao produto.
6. Entregue PR contra sf-closure-bundle, handoff com SHAs/pre/post e patch de composição host-context INERTO para o integrador consumir. Faça readback pelo GitHub.

Escrita exclusiva somente nestes paths:
- apps/cli/src/sucafina-product/native-routine-producer219.ts (recuperação exata da fonte 219, sem reescrever sua semântica);
- apps/cli/src/sucafina-product/native-routine-origin229.ts;
- modules/sucafina/Sucafinav1/test/product/native-origin229/**;
- modules/sucafina/Sucafinav1/docs/sf2h/receipts/native229/**.
Qualquer outra mudança necessária deve ser entregue como patch completo INERTO nos receipts. packages/core, server, protocol, engines Maestro/Relay/Schedule e as branches de 211/228 são somente leitura.

Não execute testes, typecheck, build ou validadores localmente. Não dispare CI próprio: entregue CI-REQUEST com seleção exata e inputs ao dispatcher sucessor do handoff223; não reenvie runs existentes. Não altere assertions para mascarar ausência de execução real. Não atualize ferramentas, instale infraestrutura, leia segredos, altere Azure, permissões financeiras, identidade corporativa ou engines; não reinicie desktop/server. Operações remotas somente GitHub MCP, com CAS/expected-head e force:false; sem gh, git push ou merge em dev.

A 211 continua sendo a autoridade da branch de composição até handoff confiável; a 228 reconcilia entregas e patches sem autoridade implícita sobre essa branch. Seus consumidores são composição228/211, validação central e revisão independente209. Não mande instruções novas a chats já iniciados e não suponha que comentário no PR acorde uma sessão.

Entregáveis mínimos no seu receipt:
HANDOFF.json com origem/época/paths/SHAs, solução concreta, comportamento obtido, critérios cobertos e abertos, patches externos inertes, consumidor e release explícito da sua escrita; CI-REQUEST.json com testes e inputs exatos; RECHECK-209.json; PROVENANCE.json. Marque checks que não rodaram como NOT_RUN. Finalize com link do PR e commit, sem chamar fonte entregue de GLOBAL_RELEASE.
