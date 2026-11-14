# Revisão independente — timeline BI

**Parecer: nenhum novo finding bloqueante nos dois blobs finais revisados.** A correção é compatível com a falha observada de geometria SVG com altura zero. A execução cirúrgica no GitHub Actions permanece pendente. Este parecer não atribui PASS de produto, READY, DONE ou aceite global.

Revisor: `/root/bi_timeline_review`. Autor do produto: `/root/bi_timeline_visibility`. O reforço final do oracle da tabela foi aplicado por `/root`, após apontamento independente. O revisor não editou produto ou testes.

## Pins e escopo

Baseline W22: `cfbf7c824d4351431d35533dbe2572de11084b9d`; tree `26843c698c3cf7b923d364434fae443a63efafaa`. Os originais de `bi-timeline-before/` foram comparados ao `remote-state.json` e coincidiram antes de o root atualizar esse manifesto mutável. A checagem final usa os pins W22 capturados. O integrador deve associar os blobs abaixo ao commit/tree publicados e ao snapshot de CI.

| Caminho relativo a `modules/sucafina/Sucafinav1/` | Blob baseline | Blob final revisado |
| --- | --- | --- |
| `product/analytics/decision-view.ts` | `4a4edc6549684202b3d5ddab4933d6ff56e0aa59` | `bb4e49ccf5eb0ea8957400322fb3a75e8e2ce5f8` |
| `test/product/wp05/choice-history-bi.test.ts` | `c939c5e39c80f3cdbc08fd700cd017a7b0ed50b4` | `cf93dff4919989322c28a3a04fd6380629f3caa1` |

SHA256 final do produto: `73aa057a8ed81927d9bfe59e883edfcb0e544e3a8c4548e58f60773f6873f748`.

SHA256 final do teste: `9c2ea2c79875277a48d36d60921eee93d8b1ec3b84e0967a4777d66e3b138735`.

O JSON acompanhante contém tamanhos, hashes anteriores/posteriores, diff completo e pins auxiliares. O teste final substitui o freeze inicial `68b68ee4b6638b6c4d0d4ab5624abcf32b0774ef` somente pelo reset antes do clique da tabela.

## Falha observada

[Run 43589341922, job 132430554445](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43589341922/job/132430554445) executou W21 `8d065831356e8a73cfd0e4fbb072c5041b95d05f` no snapshot `bd50d55e7613e9571e0e9ffaf71ce7a5ba8d9531`. Resultado: **0 pass, 1 fail, 80 expect calls**. O caso durou `158571.55 ms`, dentro do limite global existente de `180000 ms`.

O erro foi um **timeout de clique de 10000 ms**. O Playwright encontrou o grupo `training:11`, índice 46, origem `transition-confirmed`, mas registrou `element is not visible`. A fase `training-origin` foi alcançada após as verificações da tabela e comparação. As assertions anteriores para total canônico completo `250000`, vantagem `-10000`, referências e preservação da escolha humana haviam sido atravessadas. Esse progresso pertence a um run falho e não comprova os passos posteriores.

O cleanup terminou com transporte desconectado e nenhum processo vivo no grupo isolado do browser. O controle omni foi `not applicable` e declarou ausência de spawn; não há prova nativa nesse run.

Os logs foram fornecidos pelo pai após download via GitHub MCP. O revisor leu seu conteúdo e recalculou os hashes:

| Log | Bytes | SHA256 |
| --- | ---: | --- |
| `test13.log` | 85987 | `9a82c70776bd8301ae7fe233465fc51b394e65f016ef7deac477c00263b8771f` |
| `test13-clean.log` | 83149 | `5e0e0b7f24d98747c08c95ecdda8374a5489a1e1a2d9e5662bf392d9d074a32e` |

## Diagnóstico e correção

**BI-TL-01 — falha de interação observada; correção presente, execução pendente.** Antes, cada grupo interativo continha apenas uma linha horizontal, com `y1 == y2`. A caixa geométrica tem altura zero apesar do stroke visível. Isso é compatível com a recusa de visibilidade. A revisão não mediu a caixa em browser; a nova assertion deverá confirmar dimensões positivas na execução autorizada.

A fonte não sustenta corte vertical como causa: o viewBox já cresce com a quantidade de marcas, o loop percorre todas elas e o grupo de índice 46 foi encontrado. A mudança preserva esse dimensionamento e adiciona ao próprio grupo um retângulo transparente, `pointer-events="all"`, altura 20 e largura de pelo menos 20, limitado horizontalmente ao intervalo 0..600.

Para a geometria válida, `0 ≤ x1 ≤ x2 ≤ 600`, logo a largura fica entre 20 e 600; o clamp mantém x e x+largura dentro do horizonte gráfico. A linha i fica em `24i+10`, dentro do retângulo de `24i` até `24i+20`; há quatro unidades até a próxima área. O último retângulo termina em `24n−4`, enquanto o viewBox termina em pelo menos `24n+5`. Essa regra acomoda todos os 48 componentes válidos da fixture, sem cap, slice ou descarte novo. Períodos de um único dia também recebem largura positiva.

Endpoints, ordem das marcas, title, foco visual, role, aria-label, tabindex e handlers click/Enter/Space permanecem iguais. A nova área não cria outro tabstop ou handler. A origem permanece `component.sourceRefs[0]`. Lista e tabela continuam consumindo os componentes canônicos, preservando ausência, zero, moeda e evidência. O diff não altera fórmulas, autorização, produtores, host, contratos ou artifact-store.

## Teste e finding resolvido

A contagem existente compara todos os grupos interativos com todos os componentes que possuem origem; a tabela é comparada integralmente aos componentes canônicos. A assertion nova verifica largura e altura positivas para **cada** grupo. Juntas, essas verificações detectam geometria degenerada e não aceitam subconjunto truncado da fixture.

**BI-TL-02 — fragilidade preexistente do oracle, resolvida no candidato.** O clique na tabela podia observar `data-source` deixado por Enter. O root acrescentou a limpeza do campo antes desse clique, igual à limpeza que já precedia Enter. Agora ponteiro no SVG, Enter e clique na tabela devem produzir observações próprias, comparadas à mesma referência completa.

As **68 linhas originais de assertions** permanecem byte a byte e na mesma ordem; há **69** no candidato. Essa contagem estática difere das 80 chamadas do log porque o helper executa em mais de uma fase. O clique permanece normal, sem `force`; o caso mantém `180000 ms`, clique/navegação mantêm `10000 ms` e o helper de browser mantém `60000 ms`. Nenhuma assertion ou timeout foi afrouxado.

## Verificações e pendências

Foram feitas somente leitura de fonte/log, recomputação de Git blob e SHA256, comparação de diff/assertions e análise dos limites geométricos. AGENTS e CI.md foram lidos. O revisor executou **zero** comandos Bun, testes de produto, browsers, dispatches CI, escritas remotas e edições de produto/teste.

O integrador deve associar os bytes revisados ao W/tree publicado e executar exclusivamente `Sucafinav1/test/product/wp05/choice-history-bi.test.ts` via CI.md/GitHub MCP, com deduplicação e registro de S, request, run/job e conclusão. A prova precisa alcançar ponteiro, Enter, tabela, origens exatas e preservação final da escolha. Geometria positiva sozinha não fecha a jornada. Typecheck do package e guards AGENTS devem ser associados ao produto entregue; não foram executados pelo revisor read-only.

## Riscos e limites

- S13 consumiu aproximadamente 158,57 de 180 segundos, incluindo dez segundos de clique falho. A leitura final do caso não chegou a executar. A duração do candidato ainda precisa ser observada; este parecer não recomenda ampliar timeouts.
- A assertion geométrica cobre todas as marcas, mas não clica em cada uma. `training:11` mantém um clique real; o loop completo e o mapeamento de origem foram preservados para as demais.
- A fixture monta `renderBiView` e observa callbacks. Isso sozinho não demonstra shell instalado, transporte/autorização completos de C17, execução nativa, conformidade touch ou acessibilidade em todos os browsers.
- Períodos inválidos ou totalmente fora do horizonte continuam sem geometria SVG, conforme comportamento anterior, mantendo seus detalhes na lista/tabela. O patch não redefine essa regra nem introduz truncamento novo.
- Provas nativas, C/D, revisões adicionais da campanha e epic final do bundle por S0 permanecem obrigatórios. A validade deste parecer está restrita aos blobs exatos acima.
