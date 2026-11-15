# Três sessões novas — 193, 194, 195

Cada bloco é um único prompt completo para uma sessão nova. Pacotes e controle: e027e7ba4141d42075714939f8d9f686b1fec157.

## 193 — Fechar Decisions com o decoder real de Effect 4

```text
Trabalhe no repositório gustavomhss/Orchestra-SF, em uma sessão NOVA. Você assume a missão 193: Fechar Decisions com o decoder real de Effect 4.

Use a branch existente sf-ux-w16 e a PR #135. Não crie outro produto nem descarte o trabalho anterior. Sua autoridade é source-closure-e1-browser193, registrada no commit 13c27e4bd41ad277c18c5585d941feed04727b78; confira o HEAD vivo e o S0-FENCE antes de escrever. A autoridade anterior 173 foi transferida para esta missão. Use GitHub MCP e CAS/expected-head, force:false.

Leia seu pacote COMPLETO, com critérios e anexos obrigatórios, nesta fonte imutável:
https://github.com/gustavomhss/Orchestra-SF/blob/e027e7ba4141d42075714939f8d9f686b1fec157/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/193.json
Leia AGENTS aplicáveis e as fontes reais antes de editar. O pacote remete ao pacote completo anterior e às ordens aprovadas; preserve o SHA de planejamento dbf9547211d9b0fade619790de7c19c0869b7c7d e o normativo UX cbac654784714f68779ae1434d30e6ea8970c4d1. Esta é continuação de implementação, não outro planejamento.

Entregue integralmente:
1. Corrigir accepts e os tipos de schema em decisions.test.ts para a API real de Effect 4 beta.83 instalada. Falha comprovada: run43772149086, job132990216337, Schema.decodeUnknownEither undefined; 3 pass/8 fail.
2. Preservar todas as 11 provas positivas e negativas, onExcessProperty:error, rejeição de campos extras e CAS. Inspecionar APIs reais já usadas em schemas reparados; não usar any/casts para esconder erro nem reduzir assertions.
3. Entregar patch completo, pre/post blobs e pedido de rerun do seletor exato à191. Não repetir as correções de schema173 já consumidas.

F04 novo, quando pertinente:
https://github.com/gustavomhss/Orchestra-SF/blob/96c01020db59d9b4f8d44300638418d67ee11fea/modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure187/HANDOFF-162.md

Escreva somente nos paths da sua missão e modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure193/. Sem editar sf2-stack, SDK gerado, infraestrutura ou engines. A integradora atual é189/PR65; compilador190/PR107; único dispatcher de testes191/PR106. Os números162/163/164 nos documentos antigos estão superados.

Conclua código, testes pertinentes e o handoff na mesma sessão. Não rode testes, builds, validators ou typecheck localmente, nem dispare CI concorrente. Entregue ao dispatcher191 o pedido cirúrgico com seletor e SHA; 189 incorpora o delta e191 valida no bundle pertinente. Não alegue PASS sem run real. Falta de identidade externa bloqueia somente a prova instalada: conclua toda correção independente e descreva o input exato ausente, sem fabricar autorização ou relaxar as assertions.

Comite e publique na branch/PR existente via GitHub MCP. Entregue HANDOFF completo com paths/pre/post blobs, SHA, comportamento obtido, dependências, validação real/NOT_RUN e próximo passo executável. Avise189 e191 na PR e registre o recibo, sem chamar comentário de ACK. Não pare em proposta, resumo ou OUTPUT_READY sem patch completo. Não faça merge em dev nem altere recursos Azure. GLOBAL_RELEASE continua falso.
```

## 194 — Fechar U15 com negação, CAS e retorno perdido reais

```text
Trabalhe no repositório gustavomhss/Orchestra-SF, em uma sessão NOVA. Você assume a missão 194: Fechar U15 com negação, CAS e retorno perdido reais.

Use a branch existente sf-ux-n22 e a PR #153. Não crie outro produto nem descarte o trabalho anterior. Sua autoridade é source-closure-e1-browser194, registrada no commit 97c2c456cd0edf688392faa06bd1dffe6233a890; confira o HEAD vivo e o S0-FENCE antes de escrever. A autoridade anterior 185 foi transferida para esta missão. Use GitHub MCP e CAS/expected-head, force:false.

Leia seu pacote COMPLETO, com critérios e anexos obrigatórios, nesta fonte imutável:
https://github.com/gustavomhss/Orchestra-SF/blob/e027e7ba4141d42075714939f8d9f686b1fec157/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/194.json
Leia AGENTS aplicáveis e as fontes reais antes de editar. O pacote remete ao pacote completo anterior e às ordens aprovadas; preserve o SHA de planejamento dbf9547211d9b0fade619790de7c19c0869b7c7d e o normativo UX cbac654784714f68779ae1434d30e6ea8970c4d1. Esta é continuação de implementação, não outro planejamento.

Entregue integralmente:
1. Consumir o contrato F04 da187@96c01020db59d9b4f8d44300638418d67ee11fea, sem editar a fixture nem produto compartilhado.
2. Para ator denied, usar requireNativeJourney({actor:'denied',capabilityId:'CAP14',intent:'denied'}) e verificar ausência do conteúdo no DOM; não exigir superfície autorizada visível para provar negação.
3. Armar lost-response somente no nativeDashboardCommandTarget da página Vendor Contracts, não POST genérico Dashboard; provar leitura após perda sem replay.
4. Preparar stale por segundo ator realmente admitido que avance a versão CAS antes do POST. Usar refs/versões reais; cinco URLs sozinhas não criam stale/409.
5. Preservar seis jornadas obrigatórias e falha explícita de fixture ausente; sem skips, env que fabrique autoridade ou mocks como prova instalada.

F04 novo, quando pertinente:
https://github.com/gustavomhss/Orchestra-SF/blob/96c01020db59d9b4f8d44300638418d67ee11fea/modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure187/HANDOFF-162.md

Escreva somente nos paths da sua missão e modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure194/. Sem editar sf2-stack, SDK gerado, infraestrutura ou engines. A integradora atual é189/PR65; compilador190/PR107; único dispatcher de testes191/PR106. Os números162/163/164 nos documentos antigos estão superados.

Conclua código, testes pertinentes e o handoff na mesma sessão. Não rode testes, builds, validators ou typecheck localmente, nem dispare CI concorrente. Entregue ao dispatcher191 o pedido cirúrgico com seletor e SHA; 189 incorpora o delta e191 valida no bundle pertinente. Não alegue PASS sem run real. Falta de identidade externa bloqueia somente a prova instalada: conclua toda correção independente e descreva o input exato ausente, sem fabricar autorização ou relaxar as assertions.

Comite e publique na branch/PR existente via GitHub MCP. Entregue HANDOFF completo com paths/pre/post blobs, SHA, comportamento obtido, dependências, validação real/NOT_RUN e próximo passo executável. Avise189 e191 na PR e registre o recibo, sem chamar comentário de ACK. Não pare em proposta, resumo ou OUTPUT_READY sem patch completo. Não faça merge em dev nem altere recursos Azure. GLOBAL_RELEASE continua falso.
```

## 195 — Fechar U39/U40 com admissão Dashboard verificada

```text
Trabalhe no repositório gustavomhss/Orchestra-SF, em uma sessão NOVA. Você assume a missão 195: Fechar U39/U40 com admissão Dashboard verificada.

Use a branch existente sf-ux-n13 e a PR #150. Não crie outro produto nem descarte o trabalho anterior. Sua autoridade é source-closure-e1-browser195, registrada no commit 7534cb39a2024f5c4d258845a874e82156cb343d; confira o HEAD vivo e o S0-FENCE antes de escrever. A autoridade anterior 186 foi transferida para esta missão. Use GitHub MCP e CAS/expected-head, force:false.

Leia seu pacote COMPLETO, com critérios e anexos obrigatórios, nesta fonte imutável:
https://github.com/gustavomhss/Orchestra-SF/blob/e027e7ba4141d42075714939f8d9f686b1fec157/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/195.json
Leia AGENTS aplicáveis e as fontes reais antes de editar. O pacote remete ao pacote completo anterior e às ordens aprovadas; preserve o SHA de planejamento dbf9547211d9b0fade619790de7c19c0869b7c7d e o normativo UX cbac654784714f68779ae1434d30e6ea8970c4d1. Esta é continuação de implementação, não outro planejamento.

Entregue integralmente:
1. Consumir o contrato F04 da187@96c01020db59d9b4f8d44300638418d67ee11fea e atualizar U39/U40 contra as APIs reais da fixture.
2. Exigir requireNativeJourney com CAP04/CAP05, intent:edit, year:2026 e ator autenticamente admitido; verificar canRead/save/SfContext atual. dashboardAdmin depende de quarta sessão genuína, ou requester/holder com admissão realmente demonstrada.
3. Remover dependência de SF_N13_AUTH_READY/SF_N13_ADMIN_MUTATION como prova de permissão. Nome de papel, flags e strings não concedem autoridade.
4. Preservar filtros, fonte, zero vs ausência, review sem POST, responsividade320–1440 e zoom200%/400%. Configuração externa ausente deve impedir PASS explicitamente, sem encerrar a implementação possível.
5. Entregar ambos os specs completos e pedido concreto de validação191 após consumo189.

F04 novo, quando pertinente:
https://github.com/gustavomhss/Orchestra-SF/blob/96c01020db59d9b4f8d44300638418d67ee11fea/modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure187/HANDOFF-162.md

Escreva somente nos paths da sua missão e modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure195/. Sem editar sf2-stack, SDK gerado, infraestrutura ou engines. A integradora atual é189/PR65; compilador190/PR107; único dispatcher de testes191/PR106. Os números162/163/164 nos documentos antigos estão superados.

Conclua código, testes pertinentes e o handoff na mesma sessão. Não rode testes, builds, validators ou typecheck localmente, nem dispare CI concorrente. Entregue ao dispatcher191 o pedido cirúrgico com seletor e SHA; 189 incorpora o delta e191 valida no bundle pertinente. Não alegue PASS sem run real. Falta de identidade externa bloqueia somente a prova instalada: conclua toda correção independente e descreva o input exato ausente, sem fabricar autorização ou relaxar as assertions.

Comite e publique na branch/PR existente via GitHub MCP. Entregue HANDOFF completo com paths/pre/post blobs, SHA, comportamento obtido, dependências, validação real/NOT_RUN e próximo passo executável. Avise189 e191 na PR e registre o recibo, sem chamar comentário de ACK. Não pare em proposta, resumo ou OUTPUT_READY sem patch completo. Não faça merge em dev nem altere recursos Azure. GLOBAL_RELEASE continua falso.
```
