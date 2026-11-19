# Handoff — finish-proposaldraft-20261119

SHA de código: deff10482b4d2846ca838bb3e8e6f0e205f81f56 (UI54/CAP02 qualificados no run44630358847; registro permanente e integração pendentes)
Data: 2026-11-19
Estado: partial

## Feito
- Expostos os dois leitores originais de proposta privada: `dashboard.dashboard-draft-read` e `dashboard.dashboard-hot-topic-draft-outcome`.
- Inputs fechados correspondem a `dashboard-http.ts:133-139` e `:88-89`; respostas conservam o envelope original SfDomainDashboardOutput.
- Ambos são POST de leitura em /dashboard; os IDs são extensões, sem alteração do catálogo congelado de 305 operações.
- UI54 agora tem editor da proposta privada: seleção humana de caso/fonte reais, save via C08 original, revalidação histórica e comparação base/current/local mais origem atual. A confirmação da nova base começa desmarcada; valores locais continuam intactos até revisão explícita.
- Falha transitória pausa a escrita e preserva valores; negação real apaga valores. Alteração de identidade do dono limpa o estado; mudança da geração exige nova leitura.
- A recuperação do primeiro save usa somente seu idempotencyKey original e a rota original de outcome, sem replay. O botão permanece dependente da ligação F02 estrita e da disponibilidade real.
- CAP02 oferece entrada para uma nova proposta privada; esse botão navega para UI54 e não escreve o registro CAP02.
- Instalação de testes em `proposals-support/host.ts` usa o factory original Operations, C08 e SQLite reais, sessão cifrada e rotas nativas. Os controles privados retiram autoridade ou observam estado original; seed-choice reutiliza a escolha condicionada do fixture WP02 original, com total/subtotal null e sem alegação financeira.
- Negação da escrita não apaga a leitura privada. Save 403 bloqueia a escrita e retém os valores até uma nova leitura real; somente negação de leitura/contexto limpa o editor e os metadados do pai.
- Releitura da mesma base não exige nova confirmação; mudança de fonte/proposta exige confirmação. Retirada de escrita desabilita campos sem descartar valores.
- CAP02 detalhe agora usa dashboard.dashboard-capture e dashboard.dashboard-history originais: retrato individual em preferences, com histórico sob ACL atual, fonte/incarnation/version, valores/períodos/evidenceState. Não confunde capture com review-preserve.
- UI54 atualiza workbench após preparar C12; revisão permanece estável durante Apply pendente e confirma somente um comando/recibo. Leitores encerrados não são abortados no cleanup.
- Selects têm nomes acessíveis explícitos. O fixture bufferiza uma única resposta HTTP original com route.fetch(maxRetries:0,maxRedirects:0) e route.fulfill({response:original}), preservando status/headers/bytes; nenhuma resposta positiva inventada ou requisição repetida.
- O fixture retém corpo/status da mesma APIResponse em WeakMap<Request,...> antes de fulfill; asserções consomem esses bytes originais sem nova requisição. Também cobre as respostas originais interceptadas para retirada de autoridade e Apply pendente. Resposta sem observação exata falha explicitamente.
- O código de produtor e runtime/application.ts permanecem intocados.

## Pendente
- `sf/ci/suites.json` e `script/sf-ci/gate.mjs`: registrar propostas e demais WPs nas mesmas três suítes UI, com seleção explícita e igualdade exata entre arquivos selecionados e reportados. Root aprovou este WP7 após o gate9 completo.
- Integração dos blobs qualificados UI54/CAP02 e migração dos cinco testes legados devem ser compostas com o registro permanente; parent root coordena o merge.
- Baselines completas do CI só podem vir de inventário real no Actions e revisão independente. O gate estreito não fornece baseline das suítes canônicas.
- `modules/sucafina/Sucafinav1/test/product/wp02/host-workbench.test.ts:139,241,461` e `.../dashboard-installed-closure/consumer-read.test.ts:53,168`: ainda mantidos até equivalência nativa passar; root coordena o remapeamento canônico. Os 2 units puros host-workbench :406/:430 permanecem.
- Parent root compõe F02, health e registros; nunca copiar common/registry antigos desta branch sobre os adapters compostos.
- Estado partial apenas por registro permanente/migração/integração; os cinco fluxos estão qualificados pelo run44630358847. Nenhuma integração ou GO afirmados.

## Decisões e justificativas
- Asserções removidas: nenhuma. Os testes legados continuam presentes. Todos os fatos/negativos foram portados para 5 jornadas Playwright; a mecânica de checkbox/refresh do console virou a confirmação S03 original, releitura do review e ausência de segundo Apply enquanto o retorno original está retido. O valor financeiro permanece condicionado/null do fixture original, sem fabricar baseline novo.
- Retirada de captura agora é verificada no botão CAP02 do produtor dashboard-capture, não no botão distinto de preservação de pauta. O fluxo positivo verifica ambas separadamente.
- Inspeção `44608463854` SUCCESS leu somente artifact original: os error-context não continham DOM após fechamento do contexto. Nenhuma inferência de tela foi apresentada como observada; diagnóstico local do painel é emitido antes do cleanup se selecionar falhar.
- O produtor privado existe (`dashboard-decisions.ts:119-208`), inclusive revalidação com leitura retirada, fonte histórica, active draft e fences. A falta está na ligação/consumidor UI54, não em dados de negócio.
- CAP02 CRUD de Hot Topics não substitui proposta privada C08. Os fluxos permanecem distintos.
- `hot-topic-draft.ts:133-186` encontra o primeiro save somente pela operação original e valida seu recibo/digest contra o draft protegido. Não basta selecionar um item semelhante de uma lista.
- Registry/common nesta branch têm base main350dfc1, anterior à composição atual de adapters. Ao compor com a branch retry, aplicar apenas os dois novos IDs, preservando os overrides de rotas e a construção SfFrozenOperationRoutes daquela branch.

## Como retomar
1. Sobrepor somente os três blobs de092c6d (proposals/index.tsx, sf-u38.ts e proposals.spec.ts) ao código composto do gate8, 3cfe8242dde39aa5e5fefa3629b6c3acf900275c. Preservar todos os outros revalidadores e health compostos; root revisa o diff antes de gate9.
2. Pedido test-ci: package `app`, directory `packages/app-shell`, runner `playwright`, config `e2e/playwright.production.config.ts`, args `["e2e/sucafina/dashboard-installed/proposals.spec.ts"]`, env ORCHESTRA_CHANNEL=prod.
3. Corrigir erros concretos, registrar SHA/run/resultado. Depois remapear as jornadas Bun correspondentes, mantendo as duas unidades puras e todas asserções de negócio.

## Comandos e resultados
- Typegate composto [44605860232](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44605860232): CLI/SF E2E/Sucafina SUCCESS; app-shell FAILURE em draft.tsx:242-243 porque Fields readonly do Schema foi usado no createStore. Corrigido por tipo local mapeado removendo apenas readonly; contrato e validação preservados.
- `bun run check:guards --base origin/dev`: não rodado neste checkpoint.
- Fronteira F02/codec: [44604361124](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44604361124) SUCCESS, 19 pass / 0 fail / 380 expect. Snapshot `9a541ff36821c6952aa2f5b7d0a26fef260f3ccd`, parent `f5760ad992f59d258406aa52679e469c512294e5`; essa prova cobre transporte/codec, não C08/UI.
- Primeiro pedido de navegador [44606254001](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44606254001): FAILURE antes de executar produto, TEST_PACKAGE_NOT_FOUND:app-shell. O pacote atual é `app`, config `e2e/playwright.production.config.ts`; briefing estava desatualizado nesse campo. Cleanup SUCCESS. Nenhuma evidência de navegador nessa tentativa.
- [44606767134](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44606767134): FAILURE, 3 testes falharam; CLI/host/app-shell/SF E2E typechecks SUCCESS; cleanup SUCCESS. Casos1/3 aguardaram Select case; caso2 perdeu corpo CDP após HTTP200. Diagnóstico original arquivado por run [44608463854](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44608463854), SUCCESS. Fixes de nomes acessíveis/cleanup/pass-through estão neste checkpoint; novo gate ainda pendente. Auditoria original [44585817131](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44585817131) falhou nos redirects do console descomissionado; essa evidência não é um gate da alteração atual.

- Gate3 [44610326842](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44610326842): FAILURE no typecheck SF E2E, host.ts:114/122 TS18048 authority possibly undefined. CLI/host e app-shell SUCCESS; nenhum navegador executado; cleanup135867029936 SUCCESS. Snapshot `dd34c4e175ef04084ce636955aab5736e88eb99f`, código `26ad8f21f5bd4d377bb5c85b3a3d95e6b3c8b107` sobre composição25. Function declaration virou const async após o guard original, sem cast ou alteração de autoridade. Esse snapshot não inclui retenção769d nem esse ajuste e não está qualificado.
- Reports9 [44606978085](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44606978085): root observou FAILURE com NoData CDP mesmo após pass-through. Esse defeito compartilhado justifica reter o corpo original por Request no fixture; não é evidência de aprovação das propostas.

## Mapeamento das jornadas (legado preservado até qualificação)

| Jornada original | Jornada nativa | Fatos preservados |
| --- | --- | --- |
| consumer-read.test.ts:53 | proposals.spec.ts:134 | Identidade/incarnation, CAS409, v1→v2→v3, origem original/atual, base anterior/proposta atual/edição local, revisão explícita. |
| consumer-read.test.ts:168 | proposals.spec.ts:241 | Leitura interrompida, retirada de escrita entre admissões, captura bloqueada e limpeza somente após perda real de leitura. |
| host-workbench.test.ts:461 | proposals.spec.ts:383 | Save403 retém edição, leitura readonly, capture403, ausência de draft em preferences e domínio intacto. |
| host-workbench.test.ts:241 | proposals.spec.ts:438 | Duas propostas independentes, mesma identidade no conflito/releitura, CAS da versão correta e nenhuma alteração da proposta independente. |
| host-workbench.test.ts:139 | proposals.spec.ts:529 | Pauta, retrato individual, histórico, escolha condicionada, review, confirmação humana e um único Apply/recibo. |

As duas unidades sem navegador de host-workbench (:406, :430) permanecem no gate Bun. O remapeamento canônico será feito pelo root somente após equivalência nativa qualificada.

- Gate4 [44612824007](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44612824007): FAILURE, 5 failed / 0 passed; os três typechecks SUCCESS. Snapshot `396ccdcf7c0363c5295670a53875bfae7d503de9` sobre assembly26 `fa6d8a86b3695301cba6fd7d539ad1d2d429ee9b`. Casos1/3/4 chegaram ao Save, sem POST; caso2 encerrou no limite original60s; caso5 não montou UI47. Não houve erro CDP NoData observado nessa execução.

## Correções após gate4 (ainda não qualificadas)
- UI54 recebia discovery de createStore e enviava caseRef de createStore aos produtores de review/prepare/apply. Aplica o padrão existente structuredClone(unwrap(...)) ao mesmo DTO completo, sem JSON roundtrip, alteração de campos, recálculo de evidência ou relaxamento do schema. A hipótese compartilhada foi diagnosticada em CAP25/CAP27 pelo root; a correção de UI54 ainda depende do próximo run.
- O fixture acrescenta somente `sf_review_prepare`, operação original admitida para projection.review em native-ui/report-health.ts:65–91 e para os leitores de pauta em :168–190. Permanecem os produtores/ACL/health reais; não há override de disponibilidade ou vínculo.
- A antiga coluna Origem passa a ser verificada no parágrafo nativo que já renderiza sourceRefs: igualdade dos dados originais surface/type/id/version/incarnation, além de valores/unidades/períodos/evidenceState em todas as células.
- Nenhuma asserção removida; os cinco testes legados ainda não foram excluídos ou remapeados.

## Gate5 e auditoria original
- [44615301691](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44615301691): FAILURE, 5 failed / 0 passed; os três typechecks SUCCESS. Snapshot `b1d173beac4daea9054cb7cce73fcfa6af05536e`, assembly27 `dde78b94d45b384f589435ba57a89659772f9970`; job135882256489 e cleanup135886311106 SUCCESS. Os casos1/4 receberam POST200/ok e workbench200/ok, depois perderam Saved; casos2/3 receberam draft-read200, depois não exibiram Retained; caso5 chegou ao detalhe CAP02, mas um route.fetch ainda em curso falhou quando o contexto foi fechado.
- Auditorias somente de leitura [44618012325](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44618012325) e [44618290244](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44618290244): SUCCESS. Abriram o artifact original14574791796, inclusive report ZIP embutido no HTML e proposal-host.log; não executaram testes de produto.
- Limitação observada: os cinco error-context não guardaram Page snapshot; o attachment do host contém inicialização/eventos, sem traffic/response bodies. Não foi possível inferir igualdade ou estado de UI desses arquivos. Os documentos originais estão na branch `audit-proposal-screens-20261119`.

## Correções causais após gate5 (4ed9093, aguardando revisão/gate)
- `host/owner-runtime231.tsx:587-605` coloca view em resolving e desmonta a folha ao admitir a nova URL. `proposals/draft.tsx:217` agora retém somente o resultado real {draftRef,version} recebido do produtor, junto do input exato, no registry efêmero do owner. Não inventa operationRef nem chama confirmSave com identificador sintético.
- `proposals/draft.tsx:142` consome/descarta o resultado quando a descoberta original autorizada corresponder a todos os campos, referências e versão esperados. Abrir uma proposta por leitura sem o resultado retido nunca produz Saved.
- `host/draft-revalidation-proposal.ts:14` revalida apenas esse escopo UI54, por dashboard.dashboard-draft-read original: input fechado, case/id/incarnation e draftRef exato do resultado, source original, destino e disponibilidade atuais. O PortResult não publica body.context: fresh.stamp nomeia o contexto F01 observado; o F02 cerca o transport/generation e o registry cerca signal/owner. Nenhuma alteração no F01 global ou uso de CAP02.domain como autorização de proposta privada.
- Causa estática da segunda falha: `apps/cli/src/sucafina-product/dashboard-services.ts:210` cria fields na ordem action/owner/due/notes/priority; `dashboard-decisions.ts:205` usa action/owner/due/priority/notes. O JSON.stringify da comparação distinguia a ordem apesar de valores idênticos. Após validação, draftFor ordena somente os cinco campos conhecidos e conserva quaisquer propriedades remanescentes; nenhuma referência/array/valor é omitido.
- Cleanup do spec aguarda todos os handlers originais de página/contexto antes de fechar. Não converte falha de fetch em sucesso nem ignora erros. Se uma jornada falhar, o fixture anexa suas últimas oito observações originais do host e texto das páginas ainda montadas; o erro original continua lançado.
- Asserções removidas/relaxadas: nenhuma. Permanecem 211 chamadas expect e os timeouts originais; não houve reexecução de produto ainda.
- `proposals.spec.ts:134` e `capture.tsx:1`: ainda unbound de qualificação dos cinco fluxos, até o gate no checkpoint composto terminal. Os testes legados continuam mantidos. Nenhuma alegação de integração ou GO.

- Revisão do root acrescentou igualdade explícita current.draftRef === original.draftRef no revalidador (a9b4e29), além da comparação integral no consumo. O leitor de edição pode retornar uma versão ativa mais nova; o portador de confirmação não restaura esse resultado como se fosse o mesmo draftRef.

## Gate6 e evidência original
- Pedido `ci-run-proposals6-20261119`: [44621479411](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44621479411) FAILURE de infraestrutura antes de checkout/install/tipos/browser; `test-ci.yml:30-36` exige `ci-run-linux-*`. Cleanup135904146287 SUCCESS. Não é resultado de UI.
- Após esse terminal, o mesmo snapshot `7098d64ae0df041d5780b54e7ed047db1ff544d5`, parent assembly32 `b75cd49fc53701209c116511fc6643693b09c2d7`, foi publicado em `ci-run-linux-proposals6-20261119`.
- Run [44621582202](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44621582202): FAILURE, 5 failed / 0 passed; CLI/host, app-shell e SF E2E typechecks SUCCESS. Job135904364765; cleanup135908575519 SUCCESS. Nenhum teste paralelo ou sf-ci adicional.
- Progresso observado: caso2 passou a interrupção/releitura e Retained inicial, depois falhou na mensagem após retirada de escrita. Caso5 passou por pauta, captura, histórico e imutabilidade e chegou ao save privado. Casos1/4/5 falharam apenas na mensagem Saved nessa etapa.
- Audit somente de leitura [44623086336](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44623086336), SUCCESS, extraiu os cinco attachments `proposal-original-observation.json` do artifact14578835200. Fonte arquivada em `audit-proposal-screens-20261119:docs/handoff/observed-proposal-original-44621582202.md`. Corpos/status e texto do DOM são os originais, com campos de credencial filtrados; nenhum replay/reteste.

## Correção causal após gate6 (4a6593f)
- O DOM original confirma UI54 admitida na rota do draft salvo, com campos persistidos; não é uma rejeição de rota.
- Nos corpos dos casos1/4, a evidência da seleção e a evidência persistida têm mesmos tipos, chaves, valores, refId/refDigest/incarnation e arrays. A ordem de refDigest em relação a installationId/projectId é diferente. O helper local `same` agora compara todos os valores de DTO JSON estruturalmente, mantendo conjuntos exatos de chaves e ordem dos arrays. Não classifica diferenças de digest/ref/incarnation como iguais; também distingue ausência de propriedade de undefined.
- Sob retirada de escrita, o produtor realmente emite nova incarnation/refId/refDigest da fonte, embora os campos materiais permaneçam iguais. `needsCurrent` continua true; comparação e aviso de mudança continuam visíveis; salvar continua bloqueado. A UI acrescenta a informação factual de que a edição local foi retida, junto ao aviso da autoridade de escrita.
- Apenas `proposals/draft.tsx` foi alterado neste delta. Nenhuma asserção, timeout, workflow de produto, F01 global ou produtor foi modificado. As 211 chamadas expect permanecem.
- Estado continua partial; `proposals.spec.ts:134,241,383,438,529` e `capture.tsx:1` aguardam gate7 no próximo snapshot composto. Os cinco testes legados continuam preservados até equivalência qualificada.

## Gate7 e auditoria original do encerramento
- Run [44623930895](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44623930895): FAILURE, **3 passed / 2 failed**; CLI/host, app-shell e SF E2E typechecks SUCCESS. Snapshot `fc566a0a339b674f71166119eac4563551315287`, parent assembly33 `f9ade6c8bf9b872400dbb1a49c70e867b2e4d701`. Job135912617792; cleanup135916439779 SUCCESS.
- Casos2/3/4 passaram integralmente: leitura interrompida e retirada real, retenção readonly/capture403, conflito de mesma identidade com duas propostas independentes. Nenhuma mudança nesses casos após esse run.
- Caso1 passou savesv1/v2 e CAS409; falhou no cálculo esperado da chave C08 porque Playwright executa em Node e digestSfValue usa Bun.CryptoHasher. Em69711218 o spec usa `createHash("sha256").update(canonicalSfValue(original.id)).digest("hex")`: canonicalização original e SHA256 idênticos, sem duplicar/alterar algoritmo do produto.
- Auditoria [44625382756](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44625382756), SUCCESS, reteve somente observation do caso1; o timeout do caso5 interrompeu seu attachment. Não foi alegado estado de UI ou deadlock com base nessa ausência.
- Auditoria [44625975743](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44625975743), SUCCESS, extraiu a timeline original do mesmo artifact14578598211, sem reteste. Documento `audit-proposal-screens-20261119:docs/handoff/observed-proposal-timeline-44623930895.md`.
- Timeline do caso5: prepare200/ok aos43.8s; review200/ok e campos antes/depois aos51.5s; Revise com texto igual aos55.7s; Apply200/ok, botão bloqueado, Revise sem reexecutar, tráfego Apply único e um recibo C08 aos57.8s. A espera de confirmação visible começou aos58s e foi interrompida pelo limite original60s.
- O alerta Applied ficava dentro do SfStatePanel; a releitura original do workbench iniciada após Apply colocava esse panel em loading e ocultava o alerta. Isso é causa de apresentação observada no código; não houve prova de deadlock ou falha do produtor.

## Correções causais após gate7 (aguardam gate8)
- `fc5c0d07377ba8f995da8fa48b864d4b287d891f` muda somente proposals/index.tsx: confirmação recebida do Apply real aparece fora do conteúdo condicionado pela leitura. Seu ownerKey, geração e transport devem ser exatamente os capturados na resposta original; troca de contexto não restaura confirmação. Releitura do workbench/recibo continua; não inventa receipt/status ou nova operação.
- `e0793cbb683c97352e8f3d1d4a52e2035032da1b` muda somente a navegação do caso5: após atualizar o registro externamente, usa Refresh access original na UI54/new já aberta. A primeira travessia CAP02→New private proposal continua verificada; evita repetir esse desvio completo. Observa a resposta original de workbench e verifica HTTP200/ok, painel visível e ausência do caso confidencial antes da seleção da fonte atual.
- Todas as **211 chamadas expect originais permanecem**; quatro checks da releitura foram acrescentados (215 atuais). Nenhuma asserção de dado/negação/CAS/recibo foi removida ou enfraquecida. Timeouts10/15/60s permanecem; nenhuma repetição de mutação, alteração de health/produtor ou workaround global.
- Os cinco testes legados ainda não foram removidos/remapeados. Root revisa os dois commits separáveis antes de compor e executar o único gate8.

## Gate8 — quatro jornadas completas, estado final da quinta ainda pendente
- Run [44626779891](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44626779891): FAILURE, **4 passed / 1 failed**. Todos os três typechecks SUCCESS; job135922599575, cleanup135927274250 SUCCESS.
- Código composto `3cfe8242dde39aa5e5fefa3629b6c3acf900275c`, snapshot `a2099c01c33fedebd2c8fe64c15a6af0a435ac6e`, parent assembly33 `f9ade6c8bf9b872400dbb1a49c70e867b2e4d701`. Somente os dois blobs e handoff revisados foram sobrepostos.
- Caso1 passou integralmente após o digest compatível com Node. Casos2/3/4 permaneceram aprovados sem alteração.
- Auditoria [44628411378](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44628411378), SUCCESS, extraiu somente a timeline original do artifact14579967771. Documento `audit-proposal-screens-20261119:docs/handoff/observed-proposal-timeline-44626779891.md`; nenhum reteste.
- Caso5: prepare/review/revise e Apply200/ok, bloqueio enquanto pendente, um comando e um recibo C08 passaram; o alerta Applied passou em7ms aos52.8s. A seguir `host.control()` de:689 não retornou antes60s; a requisição automática dashboard-workbench iniciada aos52.79s permaneceu pendente.
- O erro route.fetch disposed é consequência do encerramento pelo timeout. Não foi atribuído a erro de autorização, deadlock ou corrupção; não se alteraram withCase, caches, transações, timeouts ou asserções para ocultá-lo.
- Contrato lido para a próxima decisão: `product/decisions/apply.ts:25,138-162` devolve CommandReceipt original após fences, releitura do recibo e reconciliaçãoC08. A UI ainda não consome esse recibo diretamente. Proposta de correção enviada ao root; nenhuma alteração adicional de UI/produtor ou gate9 neste checkpoint.
- Legado continua presente até5/5; 215expect atuais e todas as expectativas de estado final/recibo são mantidas.

## Recibo original no consumidor após gate8 (092c6d, ainda não qualificado)
- Root escolheu o ajuste do consumidor. A UI usa o CommandReceipt devolvido pelo Apply original, cuja implementação em `product/decisions/apply.ts:25,138-162` já releu o recibo, confirmou os fences e reconciliou o caso antes do retorno.
- `proposals/index.tsx:120-131` confere id, idempotencyKey, commandDigest, targetIncarnation, principal atual, surface dashboard, versão e data na forma original; projeta apenas id/version/at/result para exibição. O union de falha usa os status reais de `runtime/contract.ts:52-62`.
- Somente `receipt.result.ok === true` permite o resultado aplicado. Um envelope statusok com recibo de falha mostra resultado não confirmado e os status/erros originais. Dados desconhecidos permanecem unknown; nenhum recibo nasce de uma proposta ou de uma leitura posterior.
- OwnerKey, geração, transport e changeId da rota cercam a exibição. Depois de receber um recibo, outro Apply fica bloqueado e a revisão/planned anterior não é apresentada como estado corrente.
- Remove apenas a redescoberta automática redundante desse acknowledgement. O botão Refresh source chama o leitor original explicitamente, sob a autoridade atual. Não se alterou produtor, C08, withCase, cache ou transação, nem se alegou deadlock resolvido.
- O spec mantém a leitura independente final de preferences/cases/receipts/registro e a prova de um Apply/recibo. Acrescenta comparação da UI com id/version/at e result.ok do corpo original retido, presença da releitura explícita e ausência de novo Confirm application: **221 expects**, sem remover as215 anteriores, sem aumentar os timeouts.
- Código `092c6d202557960541fb43b68e2cf995ee489e38`; arquivos somente proposals/index.tsx, sf-u38.ts (EN/PT) e proposals.spec.ts. Nenhum gate9 lançado neste checkpoint.

## Fence da releitura explícita (deff1048)
- Revisão concreta do root: o acknowledgement fica fora do SfStatePanel e poderia sobreviver a uma releitura negativa se o owner não mudasse. O botão Refresh source agora limpa applicationResult **antes** de bump e da leitura original; dados privados do recibo anterior não permanecem após a releitura.
- `proposals/index.tsx:451`: nenhuma mudança de autorização, resultado do Apply ou produtor. O bloqueio de nova aplicação continua pelo estado original/review=null. Root autorizou o gate9 após este ajuste.
- Código `deff10482b4d2846ca838bb3e8e6f0e205f81f56`; único delta sobre092c6d é a limpeza do acknowledgement. Mantidas221 chamadas expect, leitura final independente e timeouts originais.

## Gate9 solicitado e registro permanente da migração
- Run [44630358847](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44630358847): **IN_PROGRESS**, ainda sem resultado de produto neste checkpoint. Job135935026633. Código composto `1a8b23cef45c721b012078ed71f17460bc59ccf6`, snapshot `1db9f18a623cc1331e07f582d989e5150d636da3`, branch `ci-run-linux-proposals9-20261119`.
- Sobre o código do gate8 `3cfe8242dde39aa5e5fefa3629b6c3acf900275c`, somente proposals/index.tsx, sf-u38.ts, proposals.spec.ts e este handoff foram sobrepostos. Pedido app/Playwright/productionconfig restrito ao spec; nenhum sf-ci adicional.
- Os cinco legados continuam intactos, mesmo se este gate passar, até root compor código e registro permanente em `sf/ci/suites.json`. Um run isolado não substitui a seleção futura no CI. Os dois units puros de host-workbench ficam preservados; a extração preparada confere ambos os corpos idênticos, sem commit de remoção.
- Nenhuma baseline, contagem de inventário, digest ou GO foi inferido deste gate. Estado permanece partial.

## Gate9 — cinco jornadas nativas qualificadas
- Run [44630358847](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44630358847): **SUCCESS, 5 passed / 0 failed (3.3m)**. CLI/host, app-shell e fontes SF E2E typechecks SUCCESS. Job135935026633 e cleanup135941507545 SUCCESS.
- Snapshot executado `1db9f18a623cc1331e07f582d989e5150d636da3`; código composto `1a8b23cef45c721b012078ed71f17460bc59ccf6`; código funcional de recibo `deff10482b4d2846ca838bb3e8e6f0e205f81f56` sobre092c6d.
- Passaram integralmente: leitura atual/fonte e dirty draft; interrupção e retirada de leitura/escrita; retenção readonly/capture403; conflito na mesma identidade com duas propostas independentes; pauta real, captura/histórico/imutabilidade e preparação/revisão/Apply C12 com recibo original e leitura final independente.
- O último caso verificou result.ok verdadeiro no CommandReceipt original, id/version/at iguais ao que a UI exibiu, exatamente um Apply/recibo, nenhum novo Confirm application e releitura explícita disponível. Não houve aumento de timeout nem inferência de resultado a partir da proposta.
- **221 chamadas expect mantidas**, incluindo todas211 originais mais4 da releitura e6 do recibo. Nenhuma asserção removida ou enfraquecida. Os cinco testes Bun legados continuam presentes até o registro permanente ficar pronto; os dois units puros de descoberta serão preservados integralmente.
- Próxima etapa autorizada pelo root: WP7 com specFiles explícitos nas mesmas8 suítes normativas, guards fechados e preparação de um Actions CI-SF-only fiel aos8shards originais, sem disparar esse inventário ou workflow420530405 neste checkpoint. Sem baseline inventada e sem declaração de GO.
