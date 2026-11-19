# Handoff — finish-bi-browser-20261119

SHA: 2adac1e88b980ba86abc5c42ddb5962288ed96c7 (código; este handoff é um commit posterior)
Data: 2026-11-19
Estado: partial

## Feito

- Partida exata de sf-join-four@ab9c515abee460c294bd061c99f41dbd0064fdf6; branch isolada. Nenhum merge ou push em branch protegida nesta fatia.
- Migração de e2e/sucafina/bi-installed/browser.ts e das duas suítes installed-bi para /orchestra/sf-bi/BI09 e BI10 na origem pública :3000. Bootstrap usa installation.signIn(page), que pertence à fatia de ingresso e conserva sessão e seleção reais.
- Catálogo U21 chama as operações originais bi.bi-options, bi.bi-data, bi.bi-source e bi.bi-decision. UI exige uma selectionRef publicada ou, para BI01–BI04, baseRef/candidateRef/currency explícitos; versões vêm somente de options.versions[].ref. Não usa versão mais recente implícita.
- U22 renderiza os fatos já publicados: valor/origem/ausência, comparação inversa persistida, composição com extremos originais, marcos e fontes. Nenhum subtotal, comparação financeira, interpolação, câmbio ou reconciliação é calculado no cliente; somente posições visuais usam escala.
- Origem de um valor é resolvida pelo par valueId/refDigest presente na projeção atual. Navegação de detalhe conserva o token/snapshot original. Um destino Planner já autorizado passa por safeBiDestination e abre CAP17 nativo com a mesma versão/ano e a seleção original da instalação.
- Teclado Enter/Espaço, cancelamento/Escape, retorno de foco, detalhe de portfólio e retorno à análise agora têm controles nativos.
- Filtro de datas altera somente apresentação; valores de períodos parcialmente escolhidos ficam integrais. Recarga guarda apenas seletores e datas, relê opções e projeção pelo transporte atual e não guarda dados ou autoridade.
- Negativa de período conserva tabela vazia, escolha vazia e ação desabilitada. Resposta privada 401/403 remove opções, valores, origens e detalhe; specs mantêm a prova de revogação real da sessão.

## Pendente

- packages/app-shell/e2e/sucafina/bi-installed/installed-bi.spec.ts:12 — execução completa ainda não qualificada. Depende dos blobs de ingresso e do setup BI atual do outro WP, ausentes na base isolada desta branch.
- packages/app-shell/e2e/sucafina/bi-installed/installed-bi-regressions.spec.ts:42 — executar as duas regressões de recarga/crop e escolha de fontes pelo teclado com o mesmo setup autorizado.
- packages/app-shell/e2e/sucafina/bi-installed/browser.ts:19 — asserção existente de Content-Security-Policy foi preservada; confirmar a resposta do shell nativo no gate, sem inventar header ou suprimir a prova.
- packages/app-shell/src/orchestra/chapters/sucafina/bi/catalog/index.tsx:177 — confirmar em Actions tanto as escolhas publicadas quanto os controles explícitos de versões consumidos pelo helper WP10.
- packages/app-shell/src/orchestra/chapters/sucafina/bi/catalog/index.tsx:385 — destino nativo implementado nesta fatia é Planner CAP17, necessário às provas BI09/BI10. Outros destinos continuam dependentes dos respectivos capítulos/consumidores; não há declaração de cobertura universal de links.

## Decisões e justificativas

- Asserções removidas: nenhuma. Números 240000/210000/250000, cotação 40000, diferenças -30000/10000, vantagem inversa 30000/-10000, ausência/null, identidade, origem, composição, foco, recarga, filtro visual e revogação permanecem.
- Textos/seletoras do antigo asset foram remapeados ao catálogo e renderer nativos reais. O POST/GET de domínio permanece no mount original como API; nenhuma página de navegador usa o console descomissionado.
- Em acesso privado, a seleção é removida junto com o conteúdo pelo SfStatePanel existente. A antiga prova de uma única opção vazia passa a exigir ausência do seletor; as verificações de ausência de tabelas/SVG/detalhes/links e rejeição do cookie antigo continuam.
- O filtro humano salvo em sessionStorage não é uma projeção nem um grant. A escolha só volta a produzir uma visualização após releitura de opções e dados sob a autoridade atual.
- Não se alterou runtime/application.ts, produtor financeiro, exportações, recibos, baseline, coverage ou digest. Nenhuma declaração de GO.

## Como retomar

1. Usar o código 2adac1e88b980ba86abc5c42ddb5962288ed96c7 desta branch e compor somente os sete arquivos alterados sobre a integração com o ingresso e o setup BI qualificados.
2. O root preparou o composto 03d2a11f3b8ffe51888601c5ad50ae0b16058dea; o gate de ingresso/typechecks tem snapshot 252598512b4d639e4719da4ff2b0aca2fded1671. Consultar o run efetivo antes de afirmar resultado.
3. Criar branch ci-run-linux-* somente após commit de .ci-run.json com package app, runner playwright, config e2e/playwright.production.config.ts e args das duas suítes installed-bi.
4. Ler o primeiro erro real de tipo/protocolo/seletor; corrigir só a causa observada. Preservar todos os valores, identidades, autorização e negativas. Não aumentar timeout.
5. Atualizar este handoff com SHA do snapshot, run/job, contagens e resultado terminal. Root integra somente após revisão e evidência.

## Comandos e resultados

- Typecheck app/schema/E2E: solicitado no gate composto de ingresso; resultado não disponível no momento deste handoff.
- Guardrails: sem execução local. Inspeção dos arquivos alterados confirma ausência de navegação do navegador para :4110/console morto e ausência de skips/timeout aumentado. Isso não substitui o gate.
- Test-ci BI09/BI10: ainda não executado nesta fatia.
- SF-CI / pacote: não executados por este agente nesta rodada.
- Evidência externa relacionada: factory Operations qualificada pelo outro agente em run 44583932001, 7 pass / 0 fail / 85 expect; isso não qualifica BI.
