# Handoff — finish-ingress-20261119

SHA: 49234909ad66e323ceb43b6a6ecdf067336c418b (código)
Data: 2026-11-19
Estado: partial

## Feito
- O ingresso real do CLI/instalação para o shell :3000 foi qualificado no run [44573615311](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44573615311): **success, 1 passed**. A prova atravessa enrollment original, descoberta autenticada, contexto original, seleção visual do servidor/projeto, CAP23, reload completo e year=2026.
- Origem pública explícita no CLI e instalação local; defaults normais preservados. Proxy de teste conserva Host, Origin, paths, cookies e respostas. Nenhum descriptor, concessão, recibo ou registro de storage foi fabricado.
- Fixtures WP03/Reports usam o enrollment/cookie originais. O helper preenche o controle real de conexão com a credencial privada emitida pelo Daemon e escolhe o projeto existente.
- A conexão inicial sem servidor admitido usa o componente de recuperação existente. Ações de ingresso possuem limites de até 10s, sem aumentar timeout dos cenários.
- F01 valida a query completa de cada família antes de extrair o owner; queries desconhecidas, repetidas e seletores parciais continuam rejeitados.
- Causa confirmada do bloqueio restante: fetch nativo era entregue sem receptor e chamado como método do objeto de opções. O adaptador agora chama platform.fetch ou globalThis.fetch com receptor correto; esse código passou no run 44573615311.
- Em4923490, loadContext conserva a própria instância que recebeu ctx.context real. createTransport a aceita somente com binding por identidade e geração exata. O provider deixa de reutilizar transporte vencido após reload. Nenhum stamp é injetado, copiado ou dispensado.
- Controles nativos Sign out/Refresh access usam createSfAuthActions.logout (POST original 204) e handle.reload. Só após logout confirmado a geração é invalidada e o contexto relido. Não há sinal de sessão artificial entre abas.
- Chamadores WP03, Dashboard, BI, WP10 e prepare-installation agora usam signIn/origem pública reais. As asserções de negócio ainda não migradas continuam presentes.
- Código incorpora a integração 41ba8c6f220138a97ee33ac4e70d996e8cbfbbf9.

## Pendente
- Nova geração/primeiro POST/logout — packages/app-shell/src/orchestra/chapters/sucafina/host/owner-runtime231.tsx:363 e context/index.tsx:195 — código 4923490 aguarda gate 8. O sucesso do run 44573615311 cobre o ingresso anterior, não essas mudanças novas.
- WP2 — packages/app-shell/e2e/sucafina/dashboard-installed/records-signals-history.spec.ts:35 e confirmation-access.spec.ts:37 — remapeamento para seleção de um registro por UI47/48, CAS, sinais, confirmação nativa e leitura tardia preparado, ainda não commitado. Nenhum check de negócio foi apagado.
- BI — packages/app-shell/e2e/sucafina/bi-installed/installed-fixture.ts:49 e :279 — preparação Decisions/editor mensal ainda dirige o console morto. Preservar cobertura, totais e os 12 meses ao migrar.
- WP03 — packages/app-shell/e2e/sucafina/wp03/planner-mounted.spec.ts:30 — ingresso corrigido; restante do cenário ainda precisa de seu gate próprio.
- WP10 — packages/app-shell/e2e/sucafina/wp10/composition.spec.ts:158 e extended-flows.ts:18 — migração de corpo ainda pendente. O contexto CDP persistente não tem baseURL; usar URLs absolutas da origem pública real.

## Decisões e asserções
- Asserções removidas nesta rodada: nenhuma. Sem skip, timeout maior, baseline/coverage/digest inventado ou declaração de GO.
- runtime/application.ts não foi editado; nenhum console morto foi recriado e o navegador não visitou :4110.
- O diagnóstico registra estados/razões de transporte, nunca cookie, senha, headers ou conteúdo privado.
- O próprio codec ctx.context foi executado em Actions com o descriptor real. O run 44572449631 demonstrou codec válido, origem coincidente e geração corrente antes da falha de receiver.
- O spec estreito novo agrega refresh de contexto, logout 204 e releitura 401; o gate 8 também seleciona o primeiro save original de Planner, sem reenviar comando incerto.
- A ordem posterior do dono autoriza corrigir causas e repetir gates até completar; o limite anterior de uma verificação/20 min não encerra esta rodada.

## Como retomar
1. Branch finish-ingress-20261119, código 49234909ad66e323ceb43b6a6ecdf067336c418b.
2. Ler o gate 8 e corrigir a primeira falha observada. Não considerar transporte/POST qualificados pelo gate 7 de leitura.
3. Gate: primeiro criar commit não referenciado com .ci-run.json parent do código; depois criar branch ci-run-linux nesse commit. Isso evita disparo vazio.
4. Configuração gate 8: package=app, runner=playwright, config=e2e/playwright.production.config.ts; specs wp03/native-ingress.spec.ts e bi-installed/installed-planner-ingress.spec.ts.
5. Após a prova, aplicar as mudanças de negócio WP2/WP3/WP10 e verificar os specs correspondentes. Root possui Reports/first-agenda; WP5 possui Operations.
6. Root faz a integração. Este agente não fez merge/push em sf-join-four nem em branch proibida.

## Runs
| Run | Código | Resultado observado |
|---|---|---|
| [44562317697](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44562317697) |93fcfca|failure, 1 failed: seletor regex não ativava proxy; readiness não atingido.|
| [44563472283](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44563472283) |88c06fc|failure, 1 failed: typecheck passou, timeout no ingresso visual.|
| [44565957703](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44565957703) |a6c4c09|failure, 1 failed: discovery/context HTTP200; conexão visual ainda bloqueada.|
| [44568058579](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44568058579) |61f4d6f|failure, 1 failed: cadastro/projeto passaram; F01 não liberava CAP23.|
| [44571193684](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44571193684) |a892bb6|failure, 1 failed: discovery ready, provider unavailable, sem resposta de contexto do browser.|
| [44572449631](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44572449631) |6597dc8|failure, 1 failed: codec passou; transport network, geração 1/1 e sameOrigin=true.|
| [44573615311](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44573615311) |af8f4b4|**success, 1 passed**; typecheck SF E2E passou; CAP23/reload/year reais.|
| [44575467126](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44575467126) |4923490|in_progress; config8640295f161990205b528b3f79b9315c518573ce; primeiro POST e logout/reload ainda não concluídos.|

Toda verificação foi executada em GitHub Actions. Typecheck completo do app-shell e guards não foram executados por este agente nesta rodada.
