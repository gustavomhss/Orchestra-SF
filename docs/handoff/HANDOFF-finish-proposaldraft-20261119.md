# Handoff — finish-proposaldraft-20261119

SHA de código: 4ed90938b10c3532b773fb5732688608e7a589f2 (checkpoint causal após gate5; ainda não qualificado)
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
- `packages/app-shell/e2e/sucafina/dashboard-installed/proposals.spec.ts:1`: qualificar os 5 cenários (2 consumer-read e 3 host-workbench), sem aumento dos timeouts originais. Composição atual: `fa3f3850494f0a42e9096858af0a447f44c61774` (assembly30), incluindo health/capture/history, Evidence e observedAt UI47. Parent prepara a próxima composição com estes quatro deltas.
- `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/hot-topics/capture.tsx:1`: novo consumidor original implementado, ainda sem gate. Save desconhecido não é repetido; GET histórico não atribui recibo a tentativa desconhecida.
- `modules/sucafina/Sucafinav1/test/product/wp02/host-workbench.test.ts:139,241,461` e `.../dashboard-installed-closure/consumer-read.test.ts:53,168`: ainda mantidos até equivalência nativa passar; root coordena o remapeamento canônico. Os 2 units puros host-workbench :406/:430 permanecem.
- Parent root compõe F02, health e registros; nunca copiar common/registry antigos desta branch sobre os adapters compostos.
- Sem qualificação de UI ou integração afirmada neste checkpoint.

## Decisões e justificativas
- Asserções removidas: nenhuma. Os testes legados continuam presentes. Todos os fatos/negativos foram portados para 5 jornadas Playwright; a mecânica de checkbox/refresh do console virou a confirmação S03 original, releitura do review e ausência de segundo Apply enquanto o retorno original está retido. O valor financeiro permanece condicionado/null do fixture original, sem fabricar baseline novo.
- Retirada de captura agora é verificada no botão CAP02 do produtor dashboard-capture, não no botão distinto de preservação de pauta. O fluxo positivo verifica ambas separadamente.
- Inspeção `44608463854` SUCCESS leu somente artifact original: os error-context não continham DOM após fechamento do contexto. Nenhuma inferência de tela foi apresentada como observada; diagnóstico local do painel é emitido antes do cleanup se selecionar falhar.
- O produtor privado existe (`dashboard-decisions.ts:119-208`), inclusive revalidação com leitura retirada, fonte histórica, active draft e fences. A falta está na ligação/consumidor UI54, não em dados de negócio.
- CAP02 CRUD de Hot Topics não substitui proposta privada C08. Os fluxos permanecem distintos.
- `hot-topic-draft.ts:133-186` encontra o primeiro save somente pela operação original e valida seu recibo/digest contra o draft protegido. Não basta selecionar um item semelhante de uma lista.
- Registry/common nesta branch têm base main350dfc1, anterior à composição atual de adapters. Ao compor com a branch retry, aplicar apenas os dois novos IDs, preservando os overrides de rotas e a construção SfFrozenOperationRoutes daquela branch.

## Como retomar
1. Sobrepor os quatro deltas do código `4ed90938b10c3532b773fb5732688608e7a589f2` à composição corrente do root (assembly30 já contém os nove blobs anteriores). O dispatcher recebe somente o import e branch da leitura privada; preservar os outros revalidadores.
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
- `host/draft-revalidation-proposal.ts:14` revalida apenas esse escopo UI54, por dashboard.dashboard-draft-read original: input fechado, case/id/incarnation, source original, destino e disponibilidade atuais. O PortResult não publica body.context: fresh.stamp nomeia o contexto F01 observado; o F02 cerca o transport/generation e o registry cerca signal/owner. Nenhuma alteração no F01 global ou uso de CAP02.domain como autorização de proposta privada.
- Causa estática da segunda falha: `apps/cli/src/sucafina-product/dashboard-services.ts:210` cria fields na ordem action/owner/due/notes/priority; `dashboard-decisions.ts:205` usa action/owner/due/priority/notes. O JSON.stringify da comparação distinguia a ordem apesar de valores idênticos. Após validação, draftFor ordena somente os cinco campos conhecidos e conserva quaisquer propriedades remanescentes; nenhuma referência/array/valor é omitido.
- Cleanup do spec aguarda todos os handlers originais de página/contexto antes de fechar. Não converte falha de fetch em sucesso nem ignora erros. Se uma jornada falhar, o fixture anexa suas últimas oito observações originais do host e texto das páginas ainda montadas; o erro original continua lançado.
- Asserções removidas/relaxadas: nenhuma. Permanecem 211 chamadas expect e os timeouts originais; não houve reexecução de produto ainda.
- `proposals.spec.ts:134` e `capture.tsx:1`: ainda unbound de qualificação dos cinco fluxos, até o gate no checkpoint composto terminal. Os testes legados continuam mantidos. Nenhuma alegação de integração ou GO.
