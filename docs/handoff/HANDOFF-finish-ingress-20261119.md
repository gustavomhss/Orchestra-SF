# Handoff — finish-ingress-20261119

SHA: 6985fc9969d4780870977486e1b88e926e8811a1 (código)
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
- Controles nativos Sign out/Refresh access usam createSfAuthActions.logout e handle.reload. O código exige POST original204 antes de invalidar a geração. ready() conserva a instância original, registrada na WeakMap privada, sem passar o transporte pelo proxy do store. O run 44580949588 provou logout204, contexto401, limpeza visual e releitura401 no spec native-ingress. Não há sinal de sessão artificial entre abas.
- CAP23 libera somente a referência de AbortController já concluído, após execução e validações de geração e antes de atualizar a UI. O run 44580949588 observou POST200/ok e nova versão autorizada, mas requestfailed ERR_ABORTED; o ajuste befd26b mantém a asserção de término da requisição e aguarda ingress11.
- WP2 commitado em 6985fc9: controles nativos de Hot Topics, revisão/retirada de exatamente1 registro na UI47, leitura preservada UI48, CAS explícito e sinais autorizados. OPEX mantém revisão sem POST, cancelamento, perda da resposta real, releitura autorizada sem segunda escrita e revogação da sessão durante leitura em voo. Falta qualificar os dois specs originais.
- UI34/BI preparado em b27ce63: criação UI33 existente, edição mínima para anexar somente evidência Planner descoberta/inspecionada por BI01 original, revisão explícita e decision-edit com CAS original. Fixture mensal usa o grid nativo e verifica os12 meses, inclusive zeros. Depende do binding do integrador; ainda sem gate de negócio.
- Chamadores WP03, Dashboard, BI, WP10 e prepare-installation agora usam signIn/origem pública reais. As asserções de negócio ainda não migradas continuam presentes.
- O tipo SfTransportFetch declara somente a assinatura HTTP, sem exigir Bun.fetch.preconnect no wrapper do browser. Mantém o receiver correto já qualificado.
- Criações nativas CAP23, OPEX/CAPEX e Risks omitem id quando ausente. O run client 44578426680 provou que o schema original rejeita propriedade id:undefined antes da conversão JSON. O codec estrito permanece intacto.
- Código incorpora a integração 41ba8c6f220138a97ee33ac4e70d996e8cbfbbf9.

## Pendente
- Terminação do primeiro POST CAP23 — packages/app-shell/src/orchestra/chapters/sucafina/planner/versions/index.tsx:260 e model.ts:188 — corrigida a referência do controller concluído em befd26b, ainda sob gate ingress11. O resultado anterior é failure1/passed1, não qualificação da escrita completa.
- WP2 — packages/app-shell/e2e/sucafina/dashboard-installed/records-signals-history.spec.ts:40 e confirmation-access.spec.ts:34 — código nativo commitado; aguardando composição com os produtores Reviews originais e gate dos dois specs. Não declarar cobertura antes desse run.
- BI — packages/app-shell/e2e/sucafina/bi-installed/installed-fixture.ts:49 e packages/app-shell/src/orchestra/chapters/sucafina/decisions/intent/sources.tsx:1 — código commitado, depende de decisions.decision-edit do integrador e gate. browser.ts:13 continua em migração por WP5; não concorrer nessa posse.
- WP03 — packages/app-shell/e2e/sucafina/wp03/planner-mounted.spec.ts:30 — ingresso corrigido; mensal, CAPEX e controles oficiais ainda precisam de migração e gate próprio.
- WP10 — packages/app-shell/e2e/sucafina/wp10/composition.spec.ts:158 e extended-flows.ts:18 — migração de corpo ainda pendente. O contexto CDP persistente não tem baseURL; usar URLs absolutas da origem pública real.

## Decisões e asserções
- Asserção remapeada: CAP23 body.value string não existe na resposta montada. runtime/application.ts:367–371 entrega intencionalmente só ok/warnings, mantendo dados de negócio atrás da leitura autorizada. O teste agora exige GET CAP23 antes/depois, delta de exatamente1ID, ID/nome/ano reais, clique no registro exato, igualdade de campos e identidade após reload, contador de escrita1. O capítulo mostra a lista atual sem atribuir um ID inferido à resposta do comando.
- WP2 histórico: dashboard-capture/dashboard-history foram remapeados para dashboard-agenda/dashboard-review-preserve/review-read originais. A prova exige seleção de exatamente1 recordRef emitido pelo produtor, identidade real, projeção completa, snapshot anterior e ausência de conteúdo editado. Não há identidade de captura inventada; a UI48 lê o review preservado pelo produtor.
- WP2 OPEX: CAP04.save-entry não tem previewRef/read-preview. A revisão nativa é apresentação explícita sem POST; a escrita original ocorre uma vez. Depois da perda real de entrega, GET CAP04 prova valores persistidos, mas outcome-unknown permanece sem receipt fabricado. A revogação retém uma leitura CAP04 real e usa logout204, Refresh access401 e negação403 do comando tardio com o owner header original somente em memória.
- CAP01: signal.date é vencimento/renovação do registro e não mês da observação. O filtro cliente que descartava sinais autorizados por mês/ano foi removido; elegibilidade continua exclusivamente do produtor. Totais financeiros só aparecem quando o ano da seleção da projeção corresponde à rota. Nenhum total é recalculado no browser.
- Nenhuma asserção foi apagada sem substituição documentada. Sem skip, timeout maior, baseline/coverage/digest inventado ou declaração de GO.
- runtime/application.ts não foi editado; nenhum console morto foi recriado e o navegador não visitou :4110.
- O diagnóstico registra estados/razões de transporte, nunca cookie, senha, headers ou conteúdo privado.
- O próprio codec ctx.context foi executado em Actions com o descriptor real. O run 44572449631 demonstrou codec válido, origem coincidente e geração corrente antes da falha de receiver.
- O spec estreito novo agrega refresh de contexto, logout 204 e releitura 401; o gate 8 também seleciona o primeiro save original de Planner, sem reenviar comando incerto.
- A ordem posterior do dono autoriza corrigir causas e repetir gates até completar; o limite anterior de uma verificação/20 min não encerra esta rodada.

## Como retomar
1. Branch finish-ingress-20261119, código 6985fc9969d4780870977486e1b88e926e8811a1.
2. O integrador criou composição 648401b494be53230b6efa50f7b93771eb6de11b, incluindo apenas o código anterior befd26b, Reports, bindings e main. Gate ingress11 usa os mesmos2 specs com typechecks CLI/app/SF E2E. Aguardar esse resultado para a terminação real do POST.
3. Compor os11 arquivos novos de WP2 sobre esse snapshot, sem sobrescrever os4 arquivos compartilhados de Reports/bindings do integrador. Rodar records-signals-history.spec.ts e confirmation-access.spec.ts.
4. Gate: criar primeiro commit não referenciado com .ci-run.json parent do código e só então criar branch ci-run-linux diretamente nesse commit. package=app, runner=playwright, config=e2e/playwright.production.config.ts.
5. Continuar WP03/WP10; WP5 possui browser.ts/U22 e Operations. O integrador possui Reports/first-agenda/bindings. Os remapeamentos acima são contratos de prova, não resultados PASS.
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
| [44580949588](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44580949588) |7c88154|**failure, 1 failed / 1 passed**. native-ingress passou CAP23/reload, Refresh access200, logout204, contexto401 e limpeza/releitura401. Primeiro save recebeu200/ok e persistiu versão real, mas requestfailed ERR_ABORTED impediu PASS. Typecheck SF E2E passou.|

Correção de evidência: as versões anteriores deste handoff interpretaram a linha de timeout da promessa como prova de logout204 nos gates8/9. Esses gates não emitiram o POST. A prova positiva de logout está somente no run44580949588.

Toda verificação foi executada em GitHub Actions. Guards finais ainda pertencem ao integrador. Nenhum resultado foi fabricado.
