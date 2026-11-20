# Handoff — finish-auth-20261119

SHA: f8d727568740d4d7795ebb441444c94c12d952e2 (código qualificado; este handoff é o commit seguinte)
Data: 2026-11-19
Estado: complete

## Feito

- Limitadas as renovações Microsoft simultâneas ao `secrets.authentication.limits.maxRecords` da instalação, depois de coalescer chamadas do mesmo handle e antes de chamar o provider. A conclusão original em `finally` continua sendo o único ponto que libera a entrada em andamento.
- Mantida a prova de que coletar uma geração de sessão não libera uma chamada HTTP ainda pendente; o quarto refresh é recusado enquanto os três anteriores aguardam. Adicionada a prova de que, após esses três terminarem, a capacidade é liberada e o quarto refresh realmente alcança o provider.
- Migrado o teste T8 de leituras protegidas do HTML descomissionado para o export JSON original. Ausência de sessão, expiração e logout continuam exigindo HTTP 401 e agora também o corpo exato sem dados privados. Incluídos controle autenticado 200/JSON e legado 404.
- Corrigido o destino esperado do enrollment privado para `/`, já emitido por `runtime/operator-identity.ts`. Mantidas as verificações de cookie restrito ao mount, privacidade do código/handle, origem e referrer policy.

## Pendente

- Nenhum pendente na fatia de autenticação acima.
- `modules/sucafina/Sucafinav1/test/product/operations-functional-closure/mount-boundary.test.ts:97` — inventário histórico do run 44551871355 ainda exige HTML Planner. Migração e nova verificação pertencem à fatia de mounts, não foram qualificadas por este run.
- `modules/sucafina/Sucafinav1/test/product/installed-post-cause/probe.test.ts:141` — inventário histórico ainda espera o GET de Versions legado antes do teste de transporte. Também permanece fora desta qualificação.
- Este estado complete descreve somente esta fatia. Não qualifica o conjunto sf-ci, os demais grupos históricos ou o pacote.

## Decisões e justificativas

- Contrato do limite: `runtime/local-contract.ts:15–16` já expõe `AuthenticationSecrets.limits`; nenhum campo de configuração, papel ou grant novo foi criado.
- Causa concreta: `runtime/local-identity.ts:196–212` possuía deduplicação por handle e remoção em finally, mas nenhum limite entre handles. O limite agora é verificado em `runtime/local-identity.ts:200–203`; sessões coletadas continuam contabilizadas enquanto seu trabalho real não termina.
- Asserções removidas: nenhuma asserção de segurança ou negócio foi removida. A asserção do redirect foi atualizada de `/sucafina/dashboard` para o destino original atual `/`. Os três 401 foram mantidos em um GET protegido que continua instalado (`?download=json`), preservando o contrato de autenticação e separando-o do 404 obrigatório do HTML.
- Nenhum timeout, skip, baseline, coverage ou workflow alterado. `runtime/application.ts` foi apenas consultado: `serveDownload` autentica antes da leitura e revalida antes do retorno.
- A prova de limite é por instância de identidade/instalação, usando o limite já fornecido pelo armazenamento. O teste não afirma um semáforo compartilhado entre processos.

## Como retomar

1. Partir de `finish-auth-20261119` no código f8d727568740d4d7795ebb441444c94c12d952e2 ou do commit de handoff seguinte.
2. Revisar a fatia de quatro arquivos e integrá-la em `sf-join-four` pelo responsável pela integração.
3. Continuar os dois consumidores de mounts apontados acima com os produtores nativos reais, conservando os cenários de transporte, persistência e negação.

## Comandos e resultados

- Gate GitHub Actions: https://github.com/gustavomhss/Orchestra-SF/actions/runs/44580496160 — SUCCESS.
- Código: f8d727568740d4d7795ebb441444c94c12d952e2. Snapshot CI: 1821939dcc4c4c8cd593fd5a1ae149862fc8a2fc.
- Job de teste: 135759516592 — SUCCESS. Cleanup: 135760421128 — SUCCESS.
- Pedido atômico em `ci-run-linux-auth-cap-20261119`:
  `{"package":"sucafina","runner":"bun","args":["Sucafinav1/test/t8-auth-frontier.test.ts","Sucafinav1/test/operator-identity.test.ts","Sucafinav1/test/product/auth-retention-fix/races.test.ts"]}`.
- Resultado: 28 pass, 0 fail, 229 expect() calls; 3 arquivos, 1.134 s.
- Typecheck app-shell e guards: não executados por este gate Bun; nenhum resultado inferido.
- sf-ci e sf-factory-package: não disparados por esta fatia.
