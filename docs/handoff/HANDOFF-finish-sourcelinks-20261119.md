# Handoff — finish-sourcelinks-20261119

## SHA
Código: 204e1d2203c6d5d252e9631a1be42311346d7241. Base: 6d8b5e18e69079478e05b0f6d9a812f3e6963711.
Fonte comportamental qualificada: bf2a2d3227c6f98552a0180a63c7928756db8e82.

## Data
2026-11-19

## Estado
complete para resolução de links e identidade da evidência; a jornada de navegador WP1 permanece parcial.

## Feito
- O resolvedor conserva a autorização original, evidência, identidade, versão e período e publica destinos nativos para Dashboard, Planner e Procurement.
- Os seletores year/month são os públicos dos capítulos. Planner conserva a versão original; Procurement conserva a entidade autorizada sem filtros inexistentes.
- A origem vem da URL original admitida. Nenhuma URL do produtor é reescrita pelo helper de navegador.
- source-destinations comprova três calendários primários, incluindo fevereiro bissexto, contra os produtores nativos CAP01/CAP11/CAP12 e confirma404 das antigas páginas.
- A fixture usa uma identidade estável da instalação e os mesmos serviços/C08. Os dois ajustes da fixture de source-identity restringem finish ao contextoUI e preservam tipos literais do recibo.

## Pendente com file:line e motivo
- packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:460: a navegação completa da revisão para a origem ainda depende do fechamento da jornada Reports; não qualificada por este teste de produtor.
- Gate final sf-ci do conjunto ainda não executado.

## Decisões e asserções removidas
As asserções de selects do HTML404 foram substituídas pela comparação exata de URL nativa, parser fechado, período da evidência e resposta do produtor original, mantendo os valores calendários.
Nenhuma asserção financeira, de autorização ou identidade foi removida. O único delta no teste desde o snapshot comportamental é a guarda explícita de presença de context.period antes da mesma comparação integral; dados e resultado esperado não mudam.

## Como retomar
Integrar este recorte, continuar Reports/Operations/Dashboard/BI, preservar os destinos recebidos do produtor e validar o conjunto no sf-ci final.

## Comandos e resultados
- [44602831989](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44602831989): **success**,9tests/146assertions; snapshotbf2a2d3227c6f98552a0180a63c7928756db8e82. Jobs135838530936 e135839615627 success. Executou source-identity.test.ts e source-destinations.test.ts.
- O código do resolvedor e as três fixtures auxiliares têm os mesmos blobs do snapshot acima. O teste conserva a comparação exata e acrescenta apenas a guarda estrutural descrita.
- [44605860232](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44605860232): run global failure no app-shell; job types(Sucafina)135849233055 success. Este resultado não é apresentado como aprovação global nem como teste de navegador.
