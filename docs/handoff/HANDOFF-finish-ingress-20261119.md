# Handoff — finish-ingress-20261119

SHA: 61f4d6f6d63931c6c97c1eeb8576bf0ed9d7f228 (código desta rodada)
Data: 2026-11-19
Estado: partial

## Feito
- Configuração explícita de origem pública no CLI e na instalação local. O default normal continua `http://localhost:4110`; `--public-origin` exige instalação explícita, e o perfil local aceita somente origem HTTP loopback canônica.
- Proxy de teste do shell :3000 para o listener real da fixture, preservando Host, Origin, paths, cookies e respostas. Nenhum descriptor, resultado, concessão ou registro de localStorage é fabricado.
- Fixtures WP03 e Reports usam a origem pública emitida pelo host, enrollment original e o cookie original. O helper `installed-shell.ts` lê a senha privada emitida pelo próprio Daemon, a descoberta autenticada e o contexto nativo real.
- Evidência positiva no run 44565957703: CLI pronto, discovery autenticado HTTP200 e contexto original HTTP200; a asserção do stamp/principal foi atravessada antes do bloqueio de UI.
- `owner-runtime231.tsx`: valida a consulta completa pelo parser de cada família antes de extrair o triplo server/project/installation. Queries legítimas de período deixam de ser confundidas com campos extras do owner; campos desconhecidos, repetidos e seletores parciais continuam rejeitados.
- `app.tsx`: sem servidor admitido, a conexão inicial mostra o componente de recuperação existente. Antes, a árvore era montada sem conexão e mostrava somente Retry, impedindo cadastrar a credencial real.
- O helper preenche o formulário original de recuperação ou o gerenciador de servidores já conectado. Cada ação de ingresso tem limite de até 10s, menor que o limite anterior. Não houve aumento de timeout do teste.
- O spec estreito exige CAP23 visível, mesma origem, principal original, persistência após reload e acesso com `year=2026`.

## Pendente
- Prova completa — `packages/app-shell/e2e/sucafina/wp03/native-ingress.spec.ts:6` — run 44568058579 ainda em execução. Não há resultado aprovado do capítulo nesta rodada.
- Cadastro inicial e seleção do projeto — `packages/app-shell/e2e/sucafina/installed-shell.ts:54` — a correção de startup está em 61f4d6f; aguarda o mesmo gate real.
- Chamadores ainda copiam somente o cookie — `packages/app-shell/e2e/sucafina/wp03/planner-mounted.spec.ts:25`, `dashboard-installed/confirmation-access.spec.ts:29`, `dashboard-installed/records-signals-history.spec.ts:25`, `bi-installed/installed-planner-ingress.spec.ts:77` — migração para signIn preparada, ainda não commitada, aguardando qualificação do ingresso.
- Fixture BI — `packages/app-shell/e2e/sucafina/bi-installed/installed-fixture.ts:49` — ainda usa Decisions legado na preparação de casos; `:279` mantém editor mensal legado. Os checks de cobertura, totais e doze meses permanecem.
- WP2 — `packages/app-shell/e2e/sucafina/dashboard-installed/records-signals-history.spec.ts:35` e `confirmation-access.spec.ts:37` — controles de histórico, conflitos e confirmação ainda precisam ser migrados; nenhuma asserção de negócio foi removida.
- WP10 — `packages/app-shell/e2e/sucafina/wp10/composition.spec.ts:158` — este agente assumiu a migração após o ingresso. O contexto CDP persistente não possui baseURL; as navegações devem usar URLs absolutas da origem pública real.

## Decisões e justificativas
- Asserções removidas: nenhuma. Sem skip, aumento de timeout, baseline, coverage, digest ou declaração de GO.
- Não foi editado `runtime/application.ts`; nenhum console morto foi recriado e o navegador não foi direcionado a :4110.
- O primeiro gate revelou que o seletor do runner usa separadores regex `[\\/]`. A configuração agora normaliza esse formato antes de ativar o proxy SF.
- O terceiro gate separou servidor e UI: descoberta/contexto passaram; a seleção visual ficou bloqueada. A correção segue o controle de recuperação já presente no produto, sem introduzir servidor alternativo.
- A nova ordem do dono autoriza corrigir causas e repetir gates até concluir. O limite anterior de uma verificação/20min não interrompe esta rodada.

## Como retomar
1. Usar `finish-ingress-20261119`, código 61f4d6f6d63931c6c97c1eeb8576bf0ed9d7f228.
2. Ler run [44568058579](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44568058579) e corrigir sua primeira falha observada, preservando o teste de CAP23/reload/período.
3. O gate cria primeiro um commit com .ci-run.json parent do código e só depois a branch ci-run-linux, evitando disparo vazio. Configuração: `{"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/wp03/native-ingress.spec.ts"]}`.
4. Depois da prova, migrar os chamadores WP03/Dashboard/BI/WP10 para signIn e executar os specs próprios. Root mantém Reports e first-agenda; WP5 mantém Operations.
5. Entregar SHAs e runs ao root para integração. Nenhum merge em sf-join-four foi feito por este agente.

## Comandos e resultados
- [44562317697](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44562317697), código 93fcfca58a33cb848822e67f8c23156a729af7d1: **failure, 1 failed**. Seletor não ativava proxy; readiness não atingido.
- [44563472283](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44563472283), código 88c06fcee93719f8d4758db35a46328112c38bda: **failure, 1 failed**. Typecheck SF E2E passou; timeout 60s no ingresso. Build e Chromium concluíram.
- [44565957703](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44565957703), código a6c4c09b9bf2303d7457b7d08872104276403704: **failure, 1 failed**. Typecheck passou. Às 16:33:19 UTC: CLI pronto → discovery admitido → contexto admitido → início da seleção de credencial. Timeout 60s na etapa visual; sem falha de infraestrutura.
- [44568058579](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44568058579), código 61f4d6f6d63931c6c97c1eeb8576bf0ed9d7f228, config c29f083482e85b314e6aba6993c27c4eaa88d9ce: **in_progress**, sem conclusão observada.
- Typecheck completo app-shell e guards: não executados por este agente nesta rodada. Toda verificação foi feita em GitHub Actions.
