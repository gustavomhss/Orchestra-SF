# Handoff — finish-ingress-20261119

SHA: 7c881542fd49d516a9f2b055032055b661a0ac96 (código)
Data: 2026-11-19
Estado: partial

## Feito
- O ingresso real do CLI/instalação para o shell :3000 foi qualificado no run [44573615311](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44573615311): **success, 1 passed**. A prova atravessa enrollment original, descoberta autenticada, contexto original, seleção visual do servidor/projeto, CAP23, reload completo e year=2026.
- Origem pública explícita no CLI e instalação local; defaults normais preservados. Proxy de teste conserva Host, Origin, paths, cookies e respostas. Nenhum descriptor, concessão, recibo ou registro de storage foi fabricado.
- Fixtures WP03/Reports usam o enrollment/cookie originais. O helper preenche o controle real de conexão com a credencial privada emitida pelo Daemon e escolhe o projeto existente.
- A conexão inicial sem servidor admitido usa o componente de recuperação existente. Ações de ingresso possuem limites de até 10s, sem aumentar timeout dos cenários.
- F01 valida a query completa de cada família antes de extrair o owner; queries desconhecidas, repetidas e seletores parciais continuam rejeitados.
- Causa confirmada do bloqueio restante: fetch nativo era entregue sem receptor e chamado como método do objeto de opções. O adaptador agora chama platform.fetch ou globalThis.fetch com receptor correto; esse código passou no run 44573615311.
- Em 4923490, loadContext conserva a própria instância que recebeu ctx.context real. createTransport a aceita somente com binding por identidade e geração exata. O provider deixa de reutilizar transporte vencido após reload. Nenhum stamp é injetado, copiado ou dispensado.
- Controles nativos Sign out/Refresh access usam createSfAuthActions.logout e handle.reload. O código exige POST original204 antes de invalidar a geração. O gate9 ainda não emitiu esse POST: o transporte retornado pelo store era proxy e não correspondia à WeakMap privada. ready() agora conserva a instância original; aguarda gate10. Não há sinal de sessão artificial entre abas.
- Chamadores WP03, Dashboard, BI, WP10 e prepare-installation agora usam signIn/origem pública reais. As asserções de negócio ainda não migradas continuam presentes.
- O tipo SfTransportFetch declara somente a assinatura HTTP, sem exigir Bun.fetch.preconnect no wrapper do browser. Mantém o receiver correto já qualificado.
- Criações nativas CAP23, OPEX/CAPEX e Risks omitem id quando ausente. O run client 44578426680 provou que o schema original rejeita propriedade id:undefined antes da conversão JSON. O codec estrito permanece intacto.
- Código incorpora a integração 41ba8c6f220138a97ee33ac4e70d996e8cbfbbf9.

## Pendente
- Nova geração/logout — packages/app-shell/src/orchestra/chapters/sucafina/context/index.tsx:326 e host/owner-runtime231.tsx:229 — gate9 provou primeiro POST CAP23 count1/HTTP200/ok:true, mas falhou antes do POST de logout. Gate10 44580949588 verifica a identidade original do transporte e a revogação completa. Correção de evidência: a versão anterior deste handoff interpretou incorretamente a linha da promessa de timeout como prova de logout204; esse resultado NÃO foi observado no gate8/9.
- WP2 — packages/app-shell/e2e/sucafina/dashboard-installed/records-signals-history.spec.ts:35 e confirmation-access.spec.ts:37 — remapeamento para seleção de um registro por UI47/48, CAS, sinais, confirmação nativa e leitura tardia preparado, ainda não commitado. Nenhum check de negócio foi apagado.
- BI — packages/app-shell/e2e/sucafina/bi-installed/installed-fixture.ts:49 e :279 — preparação Decisions/editor mensal ainda dirige o console morto. Preservar cobertura, totais e os 12 meses ao migrar.
- WP03 — packages/app-shell/e2e/sucafina/wp03/planner-mounted.spec.ts:30 — ingresso corrigido; restante do cenário ainda precisa de seu gate próprio.
- WP10 — packages/app-shell/e2e/sucafina/wp10/composition.spec.ts:158 e extended-flows.ts:18 — migração de corpo ainda pendente. O contexto CDP persistente não tem baseURL; usar URLs absolutas da origem pública real.

## Decisões e asserções
- Asserção remapeada: CAP23 body.value string não existe na resposta montada. runtime/application.ts:367–371 entrega intencionalmente só ok/warnings, mantendo dados de negócio atrás da leitura autorizada. O teste agora exige GET CAP23 antes/depois, delta de exatamente1ID, ID/nome/ano reais, clique no registro exato, igualdade de campos e identidade após reload, contador de escrita1. O capítulo mostra a lista atual sem atribuir um ID inferido à resposta do comando.
- Nenhuma asserção foi apagada sem substituição documentada. Sem skip, timeout maior, baseline/coverage/digest inventado ou declaração de GO.
- runtime/application.ts não foi editado; nenhum console morto foi recriado e o navegador não visitou :4110.
- O diagnóstico registra estados/razões de transporte, nunca cookie, senha, headers ou conteúdo privado.
- O próprio codec ctx.context foi executado em Actions com o descriptor real. O run 44572449631 demonstrou codec válido, origem coincidente e geração corrente antes da falha de receiver.
- O spec estreito novo agrega refresh de contexto, logout 204 e releitura 401; o gate 8 também seleciona o primeiro save original de Planner, sem reenviar comando incerto.
- A ordem posterior do dono autoriza corrigir causas e repetir gates até completar; o limite anterior de uma verificação/20 min não encerra esta rodada.

## Como retomar
1. Branch finish-ingress-20261119, código 7c881542fd49d516a9f2b055032055b661a0ac96.
2. Ler o gate 10 (44580949588) e corrigir a primeira falha observada. Não considerar transporte/POST qualificados pelo gate 7 de leitura.
3. Gate: primeiro criar commit não referenciado com .ci-run.json parent do código; depois criar branch ci-run-linux nesse commit. Isso evita disparo vazio.
4. Configuração gate 10: package=app, runner=playwright, config=e2e/playwright.production.config.ts; specs wp03/native-ingress.spec.ts e bi-installed/installed-planner-ingress.spec.ts.
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
| [44575467126](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44575467126) |4923490|failure, 2 failed; typecheck SF E2E passou. CAP23 count=0 antes do POST; timeout de resposta no fluxo logout, sem prova de204.|
| [44576103909](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44576103909) |snapshot Reports do integrador|failure no app typecheck: wrapper exigia Bun.fetch.preconnect; nenhum E2E executado. Corrigido no código0b0cf31.|
| [44578426680](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44578426680) |snapshot client do integrador|success, 3 passed / 8 expect; sourceAccepted=false para id:undefined. Diagnóstico exige omissão no caller, sem relaxar codec.|
| [44579042477](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44579042477) |bfe42f9|failure, 2 failed; typecheck SF E2E passou. POST CAP23 count1/HTTP200/ok:true; body.value ausente. Logout não emitiu POST, provider ready e alerta de falha.|
| [44580949588](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44580949588) |7c88154|in_progress; config8f5581aa77d95213f7a98d40f5d4e71ab0ce703d; identidade do transporte, registro real e logout/reload pendentes.|

Toda verificação foi executada em GitHub Actions. Typecheck completo do app-shell e guards não foram executados por este agente nesta rodada.
