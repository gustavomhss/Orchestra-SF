# WP10 — W20 Portfolio reconciliation composition

Builder de composição e evidências; não é um parecer independente. Nenhum teste, build, typecheck ou runtime de produto foi executado localmente. O candidato W20 ainda não foi publicado ao selar este pacote.

## Alterações

- `portfolio-reconciliation-services.ts`: origem C08 privada, binding/seleção atuais em N/N, binding e candidato históricos canônicos em N<N, caso/Request/cabeçalhos/autoridade reabertos ao final. Reconstrói somente identidades da sequência limitada de combinações; não calcula dinheiro.
- `portfolio-reconciliation-http.ts`: página somente de leitura no mount existente, admissão real `sf_case_read`, originais preservados, mudanças/recibos reais e materialidade desconhecida explícita. O browser fornece apenas identificadores/versionamento, sem binding/proof autorizado pelo transporte.
- `portfolio-services.ts`: injeta somente readPortfolio no produtor publicado e disponibiliza o catálogo privado. O diff deixa íntegros coverage authority, fallback de cobertura e default-deny das operações.
- `portfolio-http.ts`: rota `decision-portfolio-reconcile` usa o grant existente `decisions.portfolio.read`; página GET utiliza `sf_case_read`. Nenhum grant, descritor ou surface nova.
- `decision-controls.ts`: link contextual para a página.
- `portfolio-reconciliation.test.ts`: um caso de integração real hospedado, de inputs vazios/forecast até cobertura humana, promoção com operação real, seleção, Portfolio persistido, escolha e leitura. N/N e N<N; POST e HTML; origem/encarnação adulteradas, revogação e fonte removida; snapshots C08 comprovam leitura sem mutação.

## Execução hospedada solicitada

Fullfile: `modules/sucafina/Sucafinav1/test/product/wp10/integration/portfolio-reconciliation.test.ts`. Um caso, timeout 360 s, deadline cooperativo 345 s. Não há resultado de execução neste pacote. A fonte com contraprovas não equivale a PASS.

## Guia e limites

Guia adicionado: `docs/guides/sucafina-portfolio-reconciliation.md`. Materialidade permanece unknown sem mapping real de registry/Planner/componentScope. Fonte mudada em N/N não usa a porta histórica; N<N preserva o contrato publicado e exige autoridade/evidência legíveis. A prova cobre um caso com uma combinação; não comprova aplicação de domínio, recibo positivo de aplicação, gráficos/visual em navegador, native ou global.

Os quatro inputs estrangeiros diretamente compostos estão pinados e verificados em `source-manifest.json`; nenhum arquivo estrangeiro foi editado. `static-inspection.json` registra somente inspeção textual/imports/hashes e preservação de bytes do baseline após remover o seam declarado. `criterion-scope.json` contribui evidência potencial a critérios literais sem alterar a matriz de 171 ou seus sete tasks.
