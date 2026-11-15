# Seis sessões novas — 200 a 205

Um bloco completo por chat NOVO. Branches reservadas; não iniciadas por esta publicação. Pacotes:f552f02336a4de85e7c62ca1e19baed23d17ae8b.

## 200

```text
Trabalhe em gustavomhss/Orchestra-SF, em uma sessão NOVA. Missão 200: Retomar o dispatcher único e fechar a fila de testes.

Branch preparada:sf-ci-validation; HEAD reservado:38b88f976992da68085bdf2f0b9ed549ee49b517; epoch:product-ci-e6-browser200. Preserve a PR106 existente. Confira o HEAD vivo e o S0-FENCE antes de qualquer escrita e registre ACK/modelo efetivo/session se exposto. Não invente sessão ou morte de predecessor.

Leia seu pacote COMPLETO e todos os critérios/anexos próprios obrigatórios:
https://github.com/gustavomhss/Orchestra-SF/blob/f552f02336a4de85e7c62ca1e19baed23d17ae8b/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/200.json
Leia AGENTS, código real e dependências antes de alterar. Planejamento imutável:dbf9547211d9b0fade619790de7c19c0869b7c7d. Normativo UX:cbac654784714f68779ae1434d30e6ea8970c4d1. O pacote inclui as referências completas da ordem anterior: leia-as, preservando contratos/critério, sem repetir planejamento ou patches já integrados.

Conclua o escopo inteiro:
1. Restaurar HANDOFF-191.md, QUEUE-191.json, RUNS-191.json e FINDINGS-191.json no head225bddc1df6e50a479c933a531712454404db83d. Reconciliar todos os runs reais antes de qualquer dispatch.190 continua compilador e pode ter run próprio em voo: não duplicar seus checks.
2. Processar cada patch consumido no W vivo com testes cirúrgicos exatos.193 corrige Decisions; A01/A11 aguardam consumo dos dois projections;182/183/184 browser;161 lifecycle;194/195 jornadas;196–199 provas/fixture. Confirmar postblobs antes de reexecutar falhas conhecidas. Run43773852118 foi browser7PASS/1FAIL S05, não lifecycle.
3. B3 F01/A12 passou31/31 e B4AMnegativo20/20, em SHAs distintos; preservar provas históricas sem convertê-las em finalC. Seleção vazia, skip, artefato obrigatório ausente ou fonte diferente nunca PASS.
4. Manter a fila até esgotar trabalho liberado. Ao terminar um lote, consumir o próximo pronto sem encerrar por quota arbitrária de quatro lotes. Dependências pendentes não impedem outra seleção causal liberada. Registrar checkpoint consumível quando bloqueio externo real, host ou contexto exigirem handoff.
5. No C coerente aceito por189, executar o bundle epic/e2e e oito seleções finais +gates obrigatórios conforme plano. Não alterar/relaxar workflow/validator/fixtures, nem gerar um C de produto fora de189. Receipts D e guards C/G7,D/G8 separados.

Evidência causal de compilação: run43772959867/job132992733158/artifact14185067705, findings no sf-compiler-checks em modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation190/FINDINGS-190-W77e.md. Leia diagnósticos reais e reconcilie o HEAD atual, pois W77e não é o produto mais recente. Browser43773852118 teve7PASS1FAIL, não prova nativa positiva.

Escreva somente nos write_paths do pacote e modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation200/.189 é única integradora sf2-stack;190 compila;200 é único dispatcher de CI produto, mesma PR106/branchsf-ci-validation.193–199 mantêm suas missões. Não editar seus paths. Shared fixes fora do escopo são patches completos INERTES, com pre/post, para189 aplicar por CAS.

Execute apenas a interface GitHub Actions autorizada existente, com snapshot/seleção exatos e dedup por árvore/inputs. Reconcilie os runs em voo antes do dispatch; reanexe os existentes. Não crie workflow/validator novo nem concorrência com190. Encaminhe imediatamente falhas ao writer responsável e prossiga na fila liberada. Full epic/e2e e oito seleções finais no C aceito, sem converter green de outroSHA em prova deC.

Faça toda a implementação autorizada até código e PR consumíveis; não entregue só relatório ou recomendações. Dependência em voo não interrompe casos independentes. No handoff, inclua commits, paths/pre/post blobs, critérios/casos, comportamento, validação real/NOT_RUN e consumidor. Use GitHub MCP apenas para operações remotas, expected-head CAS, force:false; sem gh/git push/token/force/devmerge/deploy/Azure/engines/guardbypass/restart. Preserve todos os outputs anteriores. Comentários são avisos, não ACK nem wake de chats.

Goal nativa continua pausada, sem segundoS0/watchdog. GLOBAL_RELEASE permanece falso até todos os gates/AM/revisões/C/D. Não pare após um número arbitrário de lotes: avance até esgotar seu trabalho pronto ou um limite/bloqueio real, salvando handoff completo se o host exigir.
```

## 201

```text
Trabalhe em gustavomhss/Orchestra-SF, em uma sessão NOVA. Missão 201: Fechar tipagem de Work/A12 sem relaxar schemas.

Branch preparada:sf-work-types; HEAD reservado:835f751fa8d0e37ba2c4b009db0bf6a0aec5544a; epoch:compiler-source-e1-browser201. Base de produto4426445c05823ed4932b8a8e35391df024bf74f3. Abra PR para sf2-stack ao entregar. Confira o HEAD vivo e o S0-FENCE antes de qualquer escrita e registre ACK/modelo efetivo/session se exposto. Não invente sessão ou morte de predecessor.

Leia seu pacote COMPLETO e todos os critérios/anexos próprios obrigatórios:
https://github.com/gustavomhss/Orchestra-SF/blob/f552f02336a4de85e7c62ca1e19baed23d17ae8b/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/201.json
Leia AGENTS, código real e dependências antes de alterar. Planejamento imutável:dbf9547211d9b0fade619790de7c19c0869b7c7d. Normativo UX:cbac654784714f68779ae1434d30e6ea8970c4d1. O pacote inclui as referências completas da ordem anterior: leia-as, preservando contratos/critério, sem repetir planejamento ou patches já integrados.

Conclua o escopo inteiro:
1. Corrigir TS2345 work.ts:21,51 no StructWithRest/Record conforme API instalada Effect4 beta83. Preservar schema fechado, limites, validações negativas e os contratos de A12.
2. Corrigir as incompatibilidades dos testes work.test.ts inclusive217/234 contra os tipos públicos reais. Não apagar casos/assertions nem substituir por any/casts para fabricar green.
3. Reaproveitar A12 integrado e NAV-01 POST privado; não reimportar branch antiga ou alterar transport/registry compartilhados. Outras mudanças necessárias são patch inerte para189.
4. Entregar patch completo com pre/post blobs de cada arquivo e pedido de typecheck190/teste200. A12 já teve15 testes de contrato aprovados em W anterior; isso não elimina a falha estática nova.

Evidência causal de compilação: run43772959867/job132992733158/artifact14185067705, findings no sf-compiler-checks em modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation190/FINDINGS-190-W77e.md. Leia diagnósticos reais e reconcilie o HEAD atual, pois W77e não é o produto mais recente. Browser43773852118 teve7PASS1FAIL, não prova nativa positiva.

Escreva somente nos write_paths do pacote e modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair201/.189 é única integradora sf2-stack;190 compila;200 é único dispatcher de CI produto, mesma PR106/branchsf-ci-validation.193–199 mantêm suas missões. Não editar seus paths. Shared fixes fora do escopo são patches completos INERTES, com pre/post, para189 aplicar por CAS.

Não rode testes/typecheck/build/validators localmente nem dispare CI. Entregue requests cirúrgicos à200 na PR106 e à190 na PR107 após consumo189; não relaxe schemas, fixtures ou assertions para passar compilação.

Faça toda a implementação autorizada até código e PR consumíveis; não entregue só relatório ou recomendações. Dependência em voo não interrompe casos independentes. No handoff, inclua commits, paths/pre/post blobs, critérios/casos, comportamento, validação real/NOT_RUN e consumidor. Use GitHub MCP apenas para operações remotas, expected-head CAS, force:false; sem gh/git push/token/force/devmerge/deploy/Azure/engines/guardbypass/restart. Preserve todos os outputs anteriores. Comentários são avisos, não ACK nem wake de chats.

Goal nativa continua pausada, sem segundoS0/watchdog. GLOBAL_RELEASE permanece falso até todos os gates/AM/revisões/C/D. Não pare após um número arbitrário de lotes: avance até esgotar seu trabalho pronto ou um limite/bloqueio real, salvando handoff completo se o host exigir.
```

## 202

```text
Trabalhe em gustavomhss/Orchestra-SF, em uma sessão NOVA. Missão 202: Fechar tipagem F01 do contexto vivo e seus testes.

Branch preparada:sf-context-types; HEAD reservado:9a2ca9055c8cf7f82deb5fa2d711383e5729b2da; epoch:compiler-source-e1-browser202. Base de produto4426445c05823ed4932b8a8e35391df024bf74f3. Abra PR para sf2-stack ao entregar. Confira o HEAD vivo e o S0-FENCE antes de qualquer escrita e registre ACK/modelo efetivo/session se exposto. Não invente sessão ou morte de predecessor.

Leia seu pacote COMPLETO e todos os critérios/anexos próprios obrigatórios:
https://github.com/gustavomhss/Orchestra-SF/blob/f552f02336a4de85e7c62ca1e19baed23d17ae8b/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/202.json
Leia AGENTS, código real e dependências antes de alterar. Planejamento imutável:dbf9547211d9b0fade619790de7c19c0869b7c7d. Normativo UX:cbac654784714f68779ae1434d30e6ea8970c4d1. O pacote inclui as referências completas da ordem anterior: leia-as, preservando contratos/critério, sem repetir planejamento ou patches já integrados.

Conclua o escopo inteiro:
1. Corrigir TS7006 live-context.ts:99 e TS2322:152 preservando correlação entre family/resource/operation e união de availability. Não ampliar unions até aceitar CAPs/ações inexistentes.
2. Corrigir os18 diagnósticos de testes reais de live-context mantendo request original, principal autenticado, policy/accessRevision e negativas de binding/owner/revogação. Ler o log completo, separar erros transientes da dependência Work201 dos próprios.
3. Reaproveitar o wiring171/172 já integrado pela189. Não editar host-context, product-authority ou contratos compartilhados; se necessário fornecer patch inerte com pre/post para189.
4. Completar implementation e request de typecheck190/testes200, com fonte e consumidores explícitos. Não interpretar os16 casos negativos já aprovados como prova instalada positiva.

Evidência causal de compilação: run43772959867/job132992733158/artifact14185067705, findings no sf-compiler-checks em modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation190/FINDINGS-190-W77e.md. Leia diagnósticos reais e reconcilie o HEAD atual, pois W77e não é o produto mais recente. Browser43773852118 teve7PASS1FAIL, não prova nativa positiva.

Escreva somente nos write_paths do pacote e modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair202/.189 é única integradora sf2-stack;190 compila;200 é único dispatcher de CI produto, mesma PR106/branchsf-ci-validation.193–199 mantêm suas missões. Não editar seus paths. Shared fixes fora do escopo são patches completos INERTES, com pre/post, para189 aplicar por CAS.

Não rode testes/typecheck/build/validators localmente nem dispare CI. Entregue requests cirúrgicos à200 na PR106 e à190 na PR107 após consumo189; não relaxe schemas, fixtures ou assertions para passar compilação.

Faça toda a implementação autorizada até código e PR consumíveis; não entregue só relatório ou recomendações. Dependência em voo não interrompe casos independentes. No handoff, inclua commits, paths/pre/post blobs, critérios/casos, comportamento, validação real/NOT_RUN e consumidor. Use GitHub MCP apenas para operações remotas, expected-head CAS, force:false; sem gh/git push/token/force/devmerge/deploy/Azure/engines/guardbypass/restart. Preserve todos os outputs anteriores. Comentários são avisos, não ACK nem wake de chats.

Goal nativa continua pausada, sem segundoS0/watchdog. GLOBAL_RELEASE permanece falso até todos os gates/AM/revisões/C/D. Não pare após um número arbitrário de lotes: avance até esgotar seu trabalho pronto ou um limite/bloqueio real, salvando handoff completo se o host exigir.
```

## 203

```text
Trabalhe em gustavomhss/Orchestra-SF, em uma sessão NOVA. Missão 203: Fechar transporte Client/F02 e os tipos públicos.

Branch preparada:sf-transport-types; HEAD reservado:50acf465f573ff27255c97634d9b98f04985a281; epoch:compiler-source-e1-browser203. Base de produto4426445c05823ed4932b8a8e35391df024bf74f3. Abra PR para sf2-stack ao entregar. Confira o HEAD vivo e o S0-FENCE antes de qualquer escrita e registre ACK/modelo efetivo/session se exposto. Não invente sessão ou morte de predecessor.

Leia seu pacote COMPLETO e todos os critérios/anexos próprios obrigatórios:
https://github.com/gustavomhss/Orchestra-SF/blob/f552f02336a4de85e7c62ca1e19baed23d17ae8b/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/203.json
Leia AGENTS, código real e dependências antes de alterar. Planejamento imutável:dbf9547211d9b0fade619790de7c19c0869b7c7d. Normativo UX:cbac654784714f68779ae1434d30e6ea8970c4d1. O pacote inclui as referências completas da ordem anterior: leia-as, preservando contratos/critério, sem repetir planejamento ou patches já integrados.

Conclua o escopo inteiro:
1. Corrigir a raiz dos22 diagnósticos de transport.ts no run43772959867: Decoder/schema de entrada/saída, narrowing de responseMode/maxRequestBytes, discriminação transport-error vs respostaHTTP, status/body/headers e indexação do contexto.
2. Fechar bindings.ts:36 e people.ts:18 usando generics/API Effect instalada e disponibilizar o tipo público SfTransportResult requerido por context.ts:9, preservando o contrato real. Não usar any ou type assertion para esconder incompatibilidade.
3. Manter NAV-01: busca privada só POST JSON body, limite4096, nenhuma q em URI/log. Preservar abort/outcome-unknown/sem replay automático, errolegível, closed decoding, principal/policy/accessRevision atuais e request original nos consumidores.
4. Ler os testes reais de F02 e o contrato normativo; exercitar comportamento nas regressões necessárias sem espelhar implementação. Só escrever nos paths concedidos. Edits de testes existentes ou shared registry/router são patch inerte para189; não tocar SDKgerado ou runtime Core/Server.
5. Entregar solução completa e pre/post blobs; requests cirúrgicos para200 e typecheck190. Não reverter NAV-01 para GET para passar compilador.

Evidência causal de compilação: run43772959867/job132992733158/artifact14185067705, findings no sf-compiler-checks em modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation190/FINDINGS-190-W77e.md. Leia diagnósticos reais e reconcilie o HEAD atual, pois W77e não é o produto mais recente. Browser43773852118 teve7PASS1FAIL, não prova nativa positiva.

Escreva somente nos write_paths do pacote e modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair203/.189 é única integradora sf2-stack;190 compila;200 é único dispatcher de CI produto, mesma PR106/branchsf-ci-validation.193–199 mantêm suas missões. Não editar seus paths. Shared fixes fora do escopo são patches completos INERTES, com pre/post, para189 aplicar por CAS.

Não rode testes/typecheck/build/validators localmente nem dispare CI. Entregue requests cirúrgicos à200 na PR106 e à190 na PR107 após consumo189; não relaxe schemas, fixtures ou assertions para passar compilação.

Faça toda a implementação autorizada até código e PR consumíveis; não entregue só relatório ou recomendações. Dependência em voo não interrompe casos independentes. No handoff, inclua commits, paths/pre/post blobs, critérios/casos, comportamento, validação real/NOT_RUN e consumidor. Use GitHub MCP apenas para operações remotas, expected-head CAS, force:false; sem gh/git push/token/force/devmerge/deploy/Azure/engines/guardbypass/restart. Preserve todos os outputs anteriores. Comentários são avisos, não ACK nem wake de chats.

Goal nativa continua pausada, sem segundoS0/watchdog. GLOBAL_RELEASE permanece falso até todos os gates/AM/revisões/C/D. Não pare após um número arbitrário de lotes: avance até esgotar seu trabalho pronto ou um limite/bloqueio real, salvando handoff completo se o host exigir.
```

## 204

```text
Trabalhe em gustavomhss/Orchestra-SF, em uma sessão NOVA. Missão 204: Fechar tipos de exportação XLSX e fixtures BI/People.

Branch preparada:sf-fixture-types; HEAD reservado:2c086e65163feaa15b59f91e9daa8a9d45e1a691; epoch:compiler-source-e1-browser204. Base de produto4426445c05823ed4932b8a8e35391df024bf74f3. Abra PR para sf2-stack ao entregar. Confira o HEAD vivo e o S0-FENCE antes de qualquer escrita e registre ACK/modelo efetivo/session se exposto. Não invente sessão ou morte de predecessor.

Leia seu pacote COMPLETO e todos os critérios/anexos próprios obrigatórios:
https://github.com/gustavomhss/Orchestra-SF/blob/f552f02336a4de85e7c62ca1e19baed23d17ae8b/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/204.json
Leia AGENTS, código real e dependências antes de alterar. Planejamento imutável:dbf9547211d9b0fade619790de7c19c0869b7c7d. Normativo UX:cbac654784714f68779ae1434d30e6ea8970c4d1. O pacote inclui as referências completas da ordem anterior: leia-as, preservando contratos/critério, sem repetir planejamento ou patches já integrados.

Conclua o escopo inteiro:
1. Corrigir TS2322 workbooks.ts:384, paperSize8|9 vs ExcelJS PaperSize, pelo tipo/valor público real da versão pinada. Preservar A3/A4, orientação, paginação/repetição, largura e conteúdo. Não castar número desconhecido nem reduzir colunas/páginas.
2. Fechar incompatibilidades estáticas das fixtures de bi.test.ts(11) e people.test.ts(4), distinguindo diagnósticos transitivos Client/Work201/203. Usar os contratos públicos reais, preservar todos os casos e expectativas e privacidade Talent. Não inventar fontes/campos/fake-grants para compilar.
3. Apenas correções pequenas e causais; não extrair abstrações, reescrever runtime, criar testes que espelhem tipos ou alterar fonte BI/People fora do allowlist.
4. Entregar patch completo e pre/post blobs. O erro de PaperSize bloqueou inventário E2E; após consumo189,190 deve compilar apenas inputs mudados e200 validar regressões de exportação/BI/People pertinentes.

Evidência causal de compilação: run43772959867/job132992733158/artifact14185067705, findings no sf-compiler-checks em modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation190/FINDINGS-190-W77e.md. Leia diagnósticos reais e reconcilie o HEAD atual, pois W77e não é o produto mais recente. Browser43773852118 teve7PASS1FAIL, não prova nativa positiva.

Escreva somente nos write_paths do pacote e modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair204/.189 é única integradora sf2-stack;190 compila;200 é único dispatcher de CI produto, mesma PR106/branchsf-ci-validation.193–199 mantêm suas missões. Não editar seus paths. Shared fixes fora do escopo são patches completos INERTES, com pre/post, para189 aplicar por CAS.

Não rode testes/typecheck/build/validators localmente nem dispare CI. Entregue requests cirúrgicos à200 na PR106 e à190 na PR107 após consumo189; não relaxe schemas, fixtures ou assertions para passar compilação.

Faça toda a implementação autorizada até código e PR consumíveis; não entregue só relatório ou recomendações. Dependência em voo não interrompe casos independentes. No handoff, inclua commits, paths/pre/post blobs, critérios/casos, comportamento, validação real/NOT_RUN e consumidor. Use GitHub MCP apenas para operações remotas, expected-head CAS, force:false; sem gh/git push/token/force/devmerge/deploy/Azure/engines/guardbypass/restart. Preserve todos os outputs anteriores. Comentários são avisos, não ACK nem wake de chats.

Goal nativa continua pausada, sem segundoS0/watchdog. GLOBAL_RELEASE permanece falso até todos os gates/AM/revisões/C/D. Não pare após um número arbitrário de lotes: avance até esgotar seu trabalho pronto ou um limite/bloqueio real, salvando handoff completo se o host exigir.
```

## 205

```text
Trabalhe em gustavomhss/Orchestra-SF, em uma sessão NOVA. Missão 205: Fechar S05: troca de owner e normalização do textarea.

Branch preparada:sf-thread-newlines; HEAD reservado:988d770ed29fa947ef20eb19ca94cd3379158c28; epoch:compiler-source-e1-browser205. Base de produto4426445c05823ed4932b8a8e35391df024bf74f3. Abra PR para sf2-stack ao entregar. Confira o HEAD vivo e o S0-FENCE antes de qualquer escrita e registre ACK/modelo efetivo/session se exposto. Não invente sessão ou morte de predecessor.

Leia seu pacote COMPLETO e todos os critérios/anexos próprios obrigatórios:
https://github.com/gustavomhss/Orchestra-SF/blob/f552f02336a4de85e7c62ca1e19baed23d17ae8b/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/205.json
Leia AGENTS, código real e dependências antes de alterar. Planejamento imutável:dbf9547211d9b0fade619790de7c19c0869b7c7d. Normativo UX:cbac654784714f68779ae1434d30e6ea8970c4d1. O pacote inclui as referências completas da ordem anterior: leia-as, preservando contratos/critério, sem repetir planejamento ou patches já integrados.

Conclua o escopo inteiro:
1. Diagnosticar por bytes reais o único fail browser do run43773852118/job132995508966: s05.test.ts:170 após troca de owner. Separar normalização DOM de CRLF→LF da preservação byte-exata do texto raw enviado ao comando.
2. Corrigir o componente ou assertion conforme contrato real DOM, sem relaxar expectativas, trimar conteúdo, reintroduzir draft do owner antigo, POST automático/replay ou fake-grants. Os outros7 testes browser passaram no mesmoW; revalidar só S05 alterado.
3. Ler o pacote completo184 e handoff187/contratos de colaboração; preservar incarnation/version/CAS, purge após revogação e outcome-unknown só reconciliável.
4. Entregar patch completo com pre/post blobs para189 e pedido cirúrgico200 no seletor ./test-browser/sucafina-native/s05.test.ts, sem testes locais nem CI próprio.

Evidência causal de compilação: run43772959867/job132992733158/artifact14185067705, findings no sf-compiler-checks em modules/sucafina/Sucafinav1/docs/sf2h/receipts/validation190/FINDINGS-190-W77e.md. Leia diagnósticos reais e reconcilie o HEAD atual, pois W77e não é o produto mais recente. Browser43773852118 teve7PASS1FAIL, não prova nativa positiva.

Escreva somente nos write_paths do pacote e modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair205/.189 é única integradora sf2-stack;190 compila;200 é único dispatcher de CI produto, mesma PR106/branchsf-ci-validation.193–199 mantêm suas missões. Não editar seus paths. Shared fixes fora do escopo são patches completos INERTES, com pre/post, para189 aplicar por CAS.

Não rode testes/typecheck/build/validators localmente nem dispare CI. Entregue requests cirúrgicos à200 na PR106 e à190 na PR107 após consumo189; não relaxe schemas, fixtures ou assertions para passar compilação.

Faça toda a implementação autorizada até código e PR consumíveis; não entregue só relatório ou recomendações. Dependência em voo não interrompe casos independentes. No handoff, inclua commits, paths/pre/post blobs, critérios/casos, comportamento, validação real/NOT_RUN e consumidor. Use GitHub MCP apenas para operações remotas, expected-head CAS, force:false; sem gh/git push/token/force/devmerge/deploy/Azure/engines/guardbypass/restart. Preserve todos os outputs anteriores. Comentários são avisos, não ACK nem wake de chats.

Goal nativa continua pausada, sem segundoS0/watchdog. GLOBAL_RELEASE permanece falso até todos os gates/AM/revisões/C/D. Não pare após um número arbitrário de lotes: avance até esgotar seu trabalho pronto ou um limite/bloqueio real, salvando handoff completo se o host exigir.
```
