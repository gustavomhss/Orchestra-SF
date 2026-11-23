# Auditoria adversarial: comportamento e Planning

## Resultado

**Há um defeito P1 reproduzido: Teams perde texto nunca enviado quando a conexão de eventos termina, mesmo depois de revalidar a mesma Team e a mesma autoridade.** A auditoria acrescentou somente um teste de diagnóstico; não alterou o produto. O navegador executou o bundle de produção. Os 12 casos anteriores passaram e o caso novo falhou exatamente na asserção de preservação do rascunho.

Além disso, foram encontrados três problemas P2 de identidade e orientação e quatro problemas P3 de apresentação. BA-02 é uma observação de feedback durante reconexão, fora da contagem de defeitos confirmados. Os achados visuais abaixo decorrem de PNGs originais abertos, não de nomes de arquivos, número de testes ou thumbnails.

Base: `5b48dab52621037168ad4e3a6243c79a4fe5ad6e` (dev fixado). Branch do diagnóstico: `sf-audit-behavior`; commit `e82d41143cc8041a970e9a5081ebb88df2349b4e`. [Manifesto completo](sandbox:artifact-extract/behavior-audit.json), com a lista exata de 97 imagens únicas de Planning e 3 imagens do probe, dimensões e SHA-256.

### Prioridades

| ID | Nível | Achado | Evidência |
| --- | --- | --- | --- |
| BA-01 | P1 | Teams apaga um rascunho nunca enviado após interrupção do stream | Novo CI + fonte |
| BA-02 | Não classificado | Aviso permanece durante READY/CONNECTING; stale após stream aberto não provado | Observação de CI + risco na fonte |
| BA-03 | P2 | Editar uma alocação existente mostra Add allocation | PNG original + fonte |
| BA-04 | P2 | Ações de versões perdem toda a identificação da linha em 320px | PNG original + fonte |
| BA-05 | P2 | Revisões elevam UUIDs e chaves técnicas à identidade principal | PNG original + fonte |
| BA-06 | P3 | Aviso bloqueante duplica a mesma razão | PNG original + fonte |
| BA-07 | P3 | Comparação mensal rola título e cabeçalho Month para fora do recorte | PNG original + fonte |
| BA-08 | P3 | KPIs perdem baseline comum quando o rótulo PT-BR quebra | PNG original + fonte |
| BA-09 | P3 | Aprovações comprimem a identidade apesar de espaço no assunto | PNG original + fonte |

## BA-01 — P1: perda de rascunho Teams

O percurso é deliberadamente mínimo: abrir novo chat, escrever uma frase sem enviar, terminar somente a conexão de eventos, acionar **Try again** e receber novamente a mesma autoridade. O editor volta editável e vazio. A operação de recuperação não enviou nem repetiu mensagem: o ledger contém apenas GETs e `writes: []`.

[Run 45122542709](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45122542709), job `137519394227`, snapshot `682df318a52466621eccd1cf9db7f187963f1c30`. Resultado oficial: **12 passed, 1 failed, 0 skipped, 0 retries**. Chromium, Linux x64, 1 worker, 1 repetição. O teste novo durou 11.933 ms. A falha ocorre na linha 458, depois das verificações de READY, editor editável, screenshots e ausência de escrita. A asserção consulta o editor vazio 14 vezes durante a janela de 10 segundos.

### O que a fixture prova

`finishEventStreams()` itera uma cópia das conexões pendentes naquele momento, encerra cada uma e a remove do mapa. Não existe um latch que encerre as futuras conexões. A segunda chamada `/api/event` é uma nova requisição que fica pendente. O fixture mantém o mesmo principal, Team, revisão efetiva e authorityGeneration.

O estado recuperado deve ser descrito como **READY/CONNECTING, com transporte HTTP pendente**. O caso não qualifica Microsoft/OAuth real nem um stream SSE aberto e persistente. A prova é suficiente para a perda do rascunho no controlador e UI reais; não mede a frequência dessa interrupção em produção.

O `error-context.md` posterior mostra indisponibilidade porque o bloco `finally` chama `fixture.dispose()` depois de a asserção falhar, abortando a segunda conexão. Esse contexto de teardown não é o estado da captura de recuperação. Durante a asserção, o editor existiu e estava vazio; esse editor só é renderizado no ramo `state.status === ready`.

### Causa e correção necessária

`retire(stream)` chama `saveDraft()`, mas só cria a quarentena quando o motivo é `refresh`. Em seguida, substitui o mapa de rascunhos e o prompt por estruturas vazias. O refresh posterior não possui mais o texto que poderia restituir.

Preservar a mensagem em memória e fora da UI durante a interrupção de transporte, restituindo-a apenas depois da revalidação do mesmo owner, stamp F02 e authorityGeneration. **Manter os expurgos de logout, revogação e troca de principal e não fazer replay de POST.** A correção deve cobrir o rascunho nunca enviado sem confundi-lo com mensagem despachada cujo resultado é desconhecido.

Fontes:

- [packages/app-shell/src/context/team-sessions.ts (167–195; 259–299; 323–332)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/context/team-sessions.ts)
- [packages/app-shell/e2e/orchestra/team-profile-visual.fixture.ts (153–165; 200–218)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/e2e/orchestra/team-profile-visual.fixture.ts)
- [packages/app-shell/e2e/orchestra/team-profile-visual.spec.ts (412–460)](https://github.com/gustavomhss/Orchestra-SF/blob/e82d41143cc8041a970e9a5081ebb88df2349b4e/packages/app-shell/e2e/orchestra/team-profile-visual.spec.ts)
- [JSON do resultado](sandbox:artifact-extract/behavior-probe/audit-unsent-draft-recovery.json)
- [Proveniência e requisições](sandbox:artifact-extract/behavior-probe/COMPONENT-VISUAL-Teams-provenance.json)
- [Resultado oficial do Playwright](sandbox:artifact-extract/behavior-probe/test-ci-evidence/playwright-runtime.json)

Imagens abertas diretamente:

- [COMPONENT-VISUAL-Teams-audit-unsent-before-stream-close-dark-390.png](sandbox:artifact-extract/behavior-probe/packages/app-shell/e2e/test-results/orchestra-team-profile-vis-6e3a8-ins-a-never-submitted-draft-chromium/COMPONENT-VISUAL-Teams-audit-unsent-before-stream-close-dark-390.png)
- [COMPONENT-VISUAL-Teams-audit-unsent-stream-stopped-dark-390.png](sandbox:artifact-extract/behavior-probe/packages/app-shell/e2e/test-results/orchestra-team-profile-vis-6e3a8-ins-a-never-submitted-draft-chromium/COMPONENT-VISUAL-Teams-audit-unsent-stream-stopped-dark-390.png)
- [COMPONENT-VISUAL-Teams-audit-unsent-after-same-authority-refresh-dark-390.png](sandbox:artifact-extract/behavior-probe/packages/app-shell/e2e/test-results/orchestra-team-profile-vis-6e3a8-ins-a-never-submitted-draft-chromium/COMPONENT-VISUAL-Teams-audit-unsent-after-same-authority-refresh-dark-390.png)

## Achados adicionais e observação de feedback

### BA-02 — Não classificado: aviso permanece durante a nova conexão pendente

O refresh da mesma autoridade retorna o editor e Recent chats em **READY/CONNECTING**, mas o banner ainda instrui **Chat updates stopped. Refresh access before continuing.** O caso não recebeu evento no novo stream; portanto “updates stopped” ainda pode descrever corretamente o transporte. O fato confirmado é que o refresh aceito e a instrução de repetir refresh coexistem enquanto a conexão está pendente.

**Fonte e inferência:** `pages/team-profile.tsx:105–110` oculta `notice` somente quando ele duplica o erro local `unavailable`; `begin(refresh):139` preserva o aviso. A limpeza em `:195` depende de mudança de principal. `team-sessions.ts:264–266` muda `stream` para `open` quando chega um evento e não limpa esse notice. Isso sustenta um risco de aviso persistente após a recuperação, mas essa etapa não foi executada no probe.

**Qualificação corrigida após revisão adversarial:** BA-02 não é contado como P2 confirmado independente. Não afirmamos recuperação de updates nem aviso stale depois de stream aberto. A prova de perda de rascunho BA-01 permanece: o editor de READY volta editável e vazio.

**Próxima evidência mínima:** usar o fixture original para entregar um evento válido pela segunda conexão e verificar o aviso depois de `stream=open`, sem editar diretamente o estado da UI. O feedback pode distinguir revalidação aceita, conexão em andamento e updates recuperados.

Fontes:

- [packages/app-shell/src/pages/team-profile.tsx (105–110; 132–139; 182–209; 515)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/pages/team-profile.tsx)
- [packages/app-shell/src/context/team-sessions.ts (259–299)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/context/team-sessions.ts)

### BA-03 — P2: Editar uma alocação existente mostra Add allocation

O caso abre Edit do registro existente; o formulário conserva dados desse registro, mas o h2 usa a chave create-allocation incondicionalmente.

**Correção proposta:** Distinguir criação e edição por intenção/id, exibir Edit allocation + nome humano. Revisão deve identificar o registro, não apenas allocations.

Fontes:

- [packages/app-shell/src/orchestra/chapters/sucafina/planner/allocations/index.tsx (475–480; 551–557; 621–624)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/planner/allocations/index.tsx)
- [packages/app-shell/e2e/sucafina/design-wave-four-planner.spec.ts (229–248)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/e2e/sucafina/design-wave-four-planner.spec.ts)

Imagens: [CAP21-dark-320-distribution-editor-test-data.png](sandbox:artifact-extract/planning/packages/app-shell/e2e/test-results/sucafina-design-wave-four--f0183-nd-CAP21-shared-allocations-chromium/CAP21-dark-320-distribution-editor-test-data.png).

### BA-04 — P2: Ações de versões perdem toda a identificação da linha em 320px

Na captura do endpoint Actions existem duas linhas visualmente idênticas de Copy version / Lock version / Make official / Delete version; os nomes e estados estão fora do viewport.

**Correção proposta:** Preservar identidade junto às ações (coluna fixa, menu ancorado no nome, ou apresentação por cartões em largura estreita). Manter etapa de revisão com a identidade exata.

**Limite da conclusão:** Não foi observada mutação no registro errado. Fonte usa recordRef correto e revisão traz nome. É perda de contexto/risco de seleção, não bypass da confirmação.

Fontes:

- [packages/app-shell/src/orchestra/chapters/sucafina/planner/versions/index.tsx (375–414; 547–565)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/planner/versions/index.tsx)
- [packages/app-shell/src/orchestra/chapters/sucafina/shared/table/index.tsx (138–145; 229–247)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/shared/table/index.tsx)

Imagens: [CAP23-dark-320-version-actions-test-data.png](sandbox:artifact-extract/planning/packages/app-shell/e2e/test-results/sucafina-design-wave-four--4c658-d-CAP23-versions-comparison-chromium/CAP23-dark-320-version-actions-test-data.png); [CAP23-version-ledger-dark-desktop-test-data.png](sandbox:artifact-extract/planning/packages/app-shell/e2e/test-results/sucafina-design-wave-four--4c658-d-CAP23-versions-comparison-chromium/CAP23-version-ledger-dark-desktop-test-data.png); [CAP23-version-ledger-light-320-test-data.png](sandbox:artifact-extract/planning/packages/app-shell/e2e/test-results/sucafina-design-wave-four--4c658-d-CAP23-versions-comparison-chromium/CAP23-version-ledger-light-320-test-data.png).

### BA-05 — P2: Revisões elevam UUIDs e chaves técnicas à identidade principal

CAP20 e CAP22 usam UUID da versão como subtítulo/rodapé; CAP21 usa allocations; referências extensas aparecem três vezes na comparação, consumindo várias linhas em 320px.

**Correção proposta:** Usar nome humano + ano/versão na primeira hierarquia. Manter referência técnica exata em divulgação Record reference com copiar, quando necessária para rastreabilidade. Não remover proveniência nem trocar por identificador inventado.

Fontes:

- [packages/app-shell/src/orchestra/chapters/sucafina/planner/headcount/index.tsx (691–692)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/planner/headcount/index.tsx)
- [packages/app-shell/src/orchestra/chapters/sucafina/planner/fx/index.tsx (579–582)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/planner/fx/index.tsx)
- [packages/app-shell/src/orchestra/chapters/sucafina/planner/allocations/index.tsx (621–624)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/planner/allocations/index.tsx)
- [packages/app-shell/src/orchestra/chapters/sucafina/shared/change-review/index.tsx (238–242; 323–327)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/shared/change-review/index.tsx)

Imagens: [CAP22-dark-320-provenance-review-test-data.png](sandbox:artifact-extract/planning/packages/app-shell/e2e/test-results/sucafina-design-wave-four--4c658-d-CAP23-versions-comparison-chromium/CAP22-dark-320-provenance-review-test-data.png); [CAP25-dark-desktop-sourcing-review-actions-test-data.png](sandbox:artifact-extract/planning/packages/app-shell/e2e/test-results/sucafina-design-wave-four--e1d4f-cing-and-approval-decisions-chromium/CAP25-dark-desktop-sourcing-review-actions-test-data.png); [CAP20-dark-320-position-review-test-data.png](sandbox:artifact-extract/planning/packages/app-shell/e2e/test-results/sucafina-design-wave-four--f0183-nd-CAP21-shared-allocations-chromium/CAP20-dark-320-position-review-test-data.png); [CAP20-dark-desktop-unavailable-roster-impact-test-data.png](sandbox:artifact-extract/planning/packages/app-shell/e2e/test-results/sucafina-design-wave-four--f0183-nd-CAP21-shared-allocations-chromium/CAP20-dark-desktop-unavailable-roster-impact-test-data.png); [CAP21-dark-320-distribution-editor-test-data.png](sandbox:artifact-extract/planning/packages/app-shell/e2e/test-results/sucafina-design-wave-four--f0183-nd-CAP21-shared-allocations-chromium/CAP21-dark-320-distribution-editor-test-data.png); [CAP21-dark-320-distribution-review-test-data.png](sandbox:artifact-extract/planning/packages/app-shell/e2e/test-results/sucafina-design-wave-four--f0183-nd-CAP21-shared-allocations-chromium/CAP21-dark-320-distribution-review-test-data.png).

### BA-06 — P3: Aviso bloqueante duplica a mesma razão

A revisão Sync roster indisponível mostra Action not admitted by the original producer duas vezes seguidas. A lista concatena blockingReasons e confirmation.reasons sem eliminar duplicatas.

**Correção proposta:** Deduplicar razões por chave/parâmetros ou atribuir cada razão a um único componente. Preservar bloqueio de sincronização sem preview.

Fontes:

- [packages/app-shell/src/orchestra/chapters/sucafina/shared/change-review/index.tsx (312–318)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/shared/change-review/index.tsx)
- [packages/app-shell/src/orchestra/chapters/sucafina/planner/headcount/index.tsx (704–713)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/planner/headcount/index.tsx)

Imagens: [CAP20-dark-desktop-unavailable-roster-impact-test-data.png](sandbox:artifact-extract/planning/packages/app-shell/e2e/test-results/sucafina-design-wave-four--f0183-nd-CAP21-shared-allocations-chromium/CAP20-dark-desktop-unavailable-roster-impact-test-data.png).

### BA-07 — P3: Comparação mensal rola título e cabeçalho Month para fora do recorte

No recorte nomeado keyboard-monthly-scroll, Budget vira dget e Month vira onth; somente os th de tbody ficam sticky, caption e cabeçalho da primeira coluna acompanham o scroll.

**Correção proposta:** Manter título fora da região que rola e fixar o cabeçalho de identidade junto aos rótulos de mês. Revisar ambos endpoints sem reduzir os valores nem esconder colunas.

**Limite da conclusão:** Rótulos de mês no corpo permanecem presentes. A evidência mostra um checkpoint de teclado; não comprova wheel/trackpad, browser zoom ou todos os endpoints.

Fontes:

- [packages/app-shell/src/orchestra/chapters/sucafina/planner/compare/index.tsx (271–305)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/planner/compare/index.tsx)
- [packages/app-shell/src/orchestra/chapters/sucafina/planner/compare/compare.css (9–22; 36–43)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/planner/compare/compare.css)

Imagens: [CAP23-dark-320-keyboard-monthly-scroll-test-data.png](sandbox:artifact-extract/planning/packages/app-shell/e2e/test-results/sucafina-design-wave-four--4c658-d-CAP23-versions-comparison-chromium/CAP23-dark-320-keyboard-monthly-scroll-test-data.png).

### BA-08 — P3: KPIs perdem alinhamento vertical quando o rótulo PT-BR ocupa duas linhas

Em 1440×1100 PT-BR, Pedidos abertos neste filtro de status quebra em duas linhas e o valor 7 fica abaixo da linha visual dos quatro valores financeiros. O conjunto EN desktop mostra os cinco valores alinhados. A banda perde a simetria entre métricas na tradução.

**Mecanismo:** Cada métrica flui de modo independente: dt com altura natural, seguido de dd com margin-top:12px. O grid externo alinha somente as caixas, não a linha dos valores.

**Correção proposta:** Reservar uma linha compartilhada de rótulos com altura correspondente ao maior rótulo e uma linha compartilhada de valores, ou usar subgrid equivalente. Manter o layout mobile de rótulo/valor lado a lado e testar textos longos sem truncar informação.

**Limite:** Desalinhamento de apresentação, sem erro de cálculo ou ausência de valor. Não foi medido zoom real.

Fontes:

- [packages/app-shell/src/orchestra/chapters/sucafina/procurement/overview/overview.css (7–19; 42–46)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/procurement/overview/overview.css)
- [packages/app-shell/src/orchestra/chapters/sucafina/procurement/overview/index.tsx (139–145; 197–209)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/procurement/overview/index.tsx)

Imagens: [CAP24-pt-BR-dark-desktop-test-data.png](sandbox:artifact-extract/planning/packages/app-shell/e2e/test-results/sucafina-design-wave-four--53159-ll-five-areas-in-Portuguese-chromium/CAP24-pt-BR-dark-desktop-test-data.png); [CAP24-light-desktop-source-overview-test-data.png](sandbox:artifact-extract/planning/packages/app-shell/e2e/test-results/sucafina-design-wave-four--e1d4f-cing-and-approval-decisions-chromium/CAP24-light-desktop-source-overview-test-data.png).


### BA-09 — P3: Fila de aprovações comprime a identidade em desktop apesar do espaço livre no assunto

Em 1440×1100, PR-2026-0003 divide-se após PR-2026- e Open record/Abrir registro ocupa duas linhas na primeira coluna. Ao mesmo tempo, a coluna Subject/Assunto mantém grande área vazia. O código de referência fica mais lento de escanear e as linhas ficam desnecessariamente altas.

**Mecanismo:** A referência recebe widthPolicy content com minPx92, enquanto a coluna de assunto é flex weight1. O helper atribui width100% à única coluna flex e apenas min/max à coluna content; o resultado observado estreita a referência.

**Correção proposta:** Proteger a largura legível da identidade e do comando de abertura, reservar o restante ao assunto e manter quebra normal para títulos. Revalidar a mesma fila EN/PT-BR no desktop e o scroller 320px.

**Limite:** A identidade permanece completa e a navegação não foi demonstrada incorreta. É problema de proporção/legibilidade; não se afirma corrupção de alvo.

Fontes:

- [packages/app-shell/src/orchestra/chapters/sucafina/procurement/approvals/pr/index.tsx (624–628)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/procurement/approvals/pr/index.tsx)
- [packages/app-shell/src/orchestra/chapters/sucafina/shared/table/index.tsx (20–28)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/shared/table/index.tsx)
- [packages/app-shell/src/orchestra/chapters/sucafina/shared/table/table.css (90–96; 125–130; 219–230)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/shared/table/table.css)

Imagens: [CAP26-pt-BR-dark-desktop-test-data.png](sandbox:artifact-extract/planning/packages/app-shell/e2e/test-results/sucafina-design-wave-four--53159-ll-five-areas-in-Portuguese-chromium/CAP26-pt-BR-dark-desktop-test-data.png); [CAP26-light-desktop-pr-approval-list-test-data.png](sandbox:artifact-extract/planning/packages/app-shell/e2e/test-results/sucafina-design-wave-four--e1d4f-cing-and-approval-decisions-chromium/CAP26-light-desktop-pr-approval-list-test-data.png).

## Cobertura real e limites

| Dimensão | O que foi efetivamente examinado | O que permanece sem prova |
| --- | --- | --- |
| Produção e runner | Probe novo em Chromium: bundle production, 1 worker, retries 0, repeatEach 1; 12 passes e uma falha final de produto. | Firefox/WebKit, comportamento de GPU/dispositivo real e taxa de intermitência. |
| Teams e segurança | Código e testes existentes para troca de Team, revalidação, late HTTP/stream, logout/revoked, geração e operações incertas; probe novo de rascunho nunca enviado. | Microsoft/OAuth real, conexão persistente, rede móvel real. Os testes de unidade/browser lidos não foram executados de novo por este agente. |
| Navegação | Testes existentes de Team A→B→A, diálogo nativo, histórico e drafts por sessão; Planning list/detail/return, cancel/revise. | Matriz completa por rota × query/hash × dirty × back/forward; foco e scroll em todas as rotas. |
| Corridas e resultados desconhecidos | AbortController/generation, namespace, reads de reconciliação e ausência de replay constam do código e testes específicos. | Não é garantia universal para cada tela nem campanha randomizada de ordenação de respostas. |
| Foco e teclado | Sort focus CAP21, ArrowRight no scroller mensal CAP23, último anchor CAP28 e destino. Native discard dialog Teams nas 12 cases. | Screen reader, IME, teclado virtual móvel, zoom de navegador a 200%/400%, ordens Tab de todos os formulários. |
| Overflow e rolamento | Checkpoints de scrollers locais; zero pageOverflow/shellOverflow no probe Teams 390px. | Wheel/trackpad/touch não podem ser inferidos de screenshot ou scroll programático. Nem todos os endpoints foram inspecionados. |
| Inspeção visual deste agente | 97 hashes de PNGs originais Planning: 40 de 320×900 e 57 de 1440×1100, incluindo EN/PT-BR desktop/mobile e light/dark disponíveis. Mais três PNGs Teams 390×844. Os 100 paths Planning contêm três aliases por hash. | Não são 100 cenários independentes. Todo original único deste artefato foi aberto, mas o artefato não contém cada combinação de tema/locale/viewport/estado, nem todas as revisões/editores em PT-BR. |
| Material e contraste | Materiais/fonte observados nos PNGs; probe contém cálculo de camadas sólidas. Alvos das revisões amostradas cabem em 320px. | Não é conformidade WCAG global, análise de cada pixel sob blur/glass/imagem ou medição de performance gráfica. |

A captura chamada `CAP20-dark-320-position-editor` mostra principalmente o resumo e o começo do cartão; o nome não basta para dizer que todo editor foi visto. A captura posterior `CAP20-dark-320-rate-card-label` mostra efetivamente o trecho do formulário. Do mesmo modo, um foco visível ou um scrollLeft positivo comprova aquele checkpoint, não o acesso a todas as colunas.

## Qualidade da evidência anterior e flakiness

A rodada final de #715 registra **51 casos de navegador**: 37 foundation, 3 business, 6 planning, 5 workflows. Os quatro cohorts usaram retries zero e seus resultados oficiais passaram. O manifesto registra **59 checkpoints visuais focais**: 17 + 7 + 14 + 21. Isso não equivale a 59 correções, 59 telas completas ou uma matriz de todas as telas e estados.

Há uma nuance de contagem explícita: em foundation, sete originais foram abertos naquela rodada e dez eram aliases por SHA-256 de originais já vistos. Planning tinha 91 capturas nomeadas geradas, mas somente 14 focalmente revistas em #715. Este agente ampliou sua inspeção para todos os **97 hashes únicos** desse artefato (53 na primeira passagem + 44 na conclusão), listados individualmente no manifesto anexado. Os 100 paths incluem três aliases por SHA-256; esses aliases não foram creditados como novas observações. Capturas automáticas `test-finished` com hash próprio foram abertas, mas não contam como novos experimentos ou repetições.

O config genérico do Playwright possui `retries: CI ? 2 : 0`. Isso **não** significa que os runs citados mascararam falhas: `script/test-ci-request.ts:159–166` acrescenta `--workers 1 --retries 0 --repeat-each 1`, e os JSONs de execução confirmam esses valores. O reporter genérico de flaky apenas anota testes que falharam e depois passaram com retry; ele não muda o exit code. Não é um medidor da probabilidade de flakiness de uma suíte executada uma única vez sem repetição.

As falhas diagnósticas históricas de #715 incluem defeitos de produto e dois casos com setup de locale errado (`pt-BR` em vez da chave nativa `br`). Elas não devem ser agrupadas como flakes. O mesmo vale para timeouts e erros internos de polling de uma expectativa que termina passando. No probe novo, o timeout é o mecanismo da asserção de texto: o valor permaneceu vazio. Não houve timeout de setup, build ou navegação.

Fontes:

- [Manifesto #715](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/docs/qa/sucafina/visual-audit/round-two-runs.json)
- [ROUND-TWO.md](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/docs/qa/sucafina/visual-audit/ROUND-TWO.md)
- [Normalização de argumentos test-ci](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/script/test-ci-request.ts#L159-L166)
- [Playwright config genérico](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/playwright.config.ts)
- [Flaky reporter](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/e2e/utils/flaky-reporter.ts)

### Limites já declarados na evidência nativa

UI42 e UI44 aparecem como denied. UI43, UI51, UI52, UI53, UI61, UI63, UI64, UI65, UI66 e UI70 não tiveram a folha renderizada. Passar um percurso que preserva corretamente a recusa não qualifica a UI do produtor indisponível.

O conjunto anterior também registra: CAP10 detalhe/header a 320px ausente; UI49 extremo direito mobile ausente; UI50 sem nota longa não vazia; UI54 seções inferiores mobile fora do recorte; CAP28 último anchor/destino comprovados em EN/light/320, com PT apenas no estado inicial. A inspeção deste agente não remove essas limitações de outros cohorts.

## Hipóteses rejeitadas

A suspeita de falha de foco na substituição de linhas com os mesmos IDs foi retirada. O accessor passado a Solid `on(...)` reage à invalidação das dependências; não funciona como um memo que automaticamente suprime o callback porque a string de IDs permaneceu igual. Não há achado de produto nem teste novo desse ponto.

Também não se tratou de bug o simples fato de uma tabela larga possuir overflow local, um valor longo exigir edição horizontal dentro de input nativo ou um produtor retornar ausência honestamente. Os achados acima descrevem perdas concretas de texto, identidade, estado e legibilidade.

## Próxima verificação mínima para fechar os achados

1. Corrigir BA-01 com quarentena restrita à mesma autoridade, executar este mesmo probe sem alterar sua asserção, e executar os testes existentes de logout/revoked/principal-change/generation e pending POST para proteger os limites de privacidade e reconciliação. Acrescentar variantes para draft de sessão já existente e troca de Team somente se a implementação tocar esses caminhos.
2. Para BA-02, entregar um evento válido pela segunda conexão do fixture e observar o aviso depois de stream=open. Sem esse passo, classificar apenas feedback ambíguo durante CONNECTING, não warning stale após updates recuperados. Não editar state diretamente.
3. Para BA-03, usar o fluxo já existente de Edit allocation e uma asserção de heading coerente; revisar o PNG a 320px em EN/PT-BR.
4. Para BA-04/BA-07, verificar teclado nos dois endpoints, com identidade da versão/mês visível e confirmação de alvo exato; revisar 320px e desktop. Não reduzir a evidência à ausência de body overflow.
5. Para BA-05/BA-06, revisar os mesmos estados no componente original, preservando referências exatas em divulgação e os bloqueios de origem.
6. Para BA-08/BA-09, comparar os mesmos estados EN/PT-BR a 1440px e 320px, com rótulos e referências inteiros, alinhamento de valores e largura de colunas proporcionais. Não há necessidade de testes que apenas espelhem regras CSS.

Depois disso, a lacuna de cobertura com maior valor é uma matriz pequena e explícita de query/history + dirty/retry em rotas prioritárias, seguida de browser zoom real e teclado/screenreader. Não há justificativa para centenas de testes espelhando CSS ou para reexecutar indiscriminadamente a suíte enquanto o P1 permanece aberto.

## Escopo de alterações e coordenação

Somente o teste de diagnóstico foi adicionado, na branch isolada. Nenhum guard, skip, timeout, retry, produto ou política de autoridade foi enfraquecido. Nenhum build/test local foi executado e nenhum comentário/PR foi publicado por este agente.

As correções propostas de Planner devem ser coordenadas com PR #716; o trabalho ativo UI57–70 (#713) e UI42–56 (#613) também deve ser preservado. A auditoria permanece ancorada no dev fixado, sem misturar produto de PRs ainda abertos.

### Manifesto da execução nova

- Request: `app / @orchestra/app / packages/app-shell / playwright`.
- Config: `e2e/playwright.production.config.ts`.
- Arquivo: `e2e/orchestra/team-profile-visual.spec.ts`.
- Ambiente: `ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER=strict`, `ORCHESTRA_CHANNEL=prod`.
- Snapshot: `682df318a52466621eccd1cf9db7f187963f1c30`.
- Artifact ID: `14795020078`; 24067714 bytes.
- SHA-256 do ZIP: `081796dbfbedb8a62c8726623ae85e3b50d7a69719409b3a60fb0de6f46e7f68`.
- [Request original](sandbox:artifact-extract/behavior-probe/test-ci-evidence/request.json).
- [Manifesto da auditoria com imagens e hashes](sandbox:artifact-extract/behavior-audit.json).

As instruções de E2E foram observadas e os guias oficiais Playwright de best practices, actionability, assertions, locators, network e browser contexts foram lidos antes da revisão. Os guias são orientação de método, não evidência de que o produto passou por cada requisito.

