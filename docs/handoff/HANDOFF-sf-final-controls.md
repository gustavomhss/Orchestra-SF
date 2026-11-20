# Handoff — final Actions controls

Estado: PREPARED_ONLY / NOT_RUN.
Base de revisão: d4ded81224e05f2d3b9789b3eec40b9de8a32fa1. Não é o SHA final congelado.

Os dois workflows nesta branch são templates revisáveis. SF_FINAL_SHA / EXPECTED_FINAL_SHA usam o marcador explícito __FROZEN_SHA__, que deve ser substituído pelo SHA real depois do último merge elegível. A branch sf-final-controls não corresponde a nenhum trigger; nenhum controle é executado por esse push e esses arquivos não serão mergeados no produto.

No corte final, o integrador deve criar cada driver como filho direto do SHA congelado e copiar somente o respectivo workflow, já com SHA real. O driver de guards roda o comando canônico bun run check:guards --base origin/dev no checkout exato, sem label/waiver/--warn, preservando exit status e artefato mesmo nos dois GATE herdados. O driver de dispatch confere branch/repository/run_attempt/parent e ausência de dispatch anterior no SHA; faz uma única chamada ao workflow420530405 ref sf-join-four, sem retry. Depois do POST, somente leituras para reconciliar o run.

Ainda não há run final, artefato baseline ou pacote final. sf/ci/suites.json não muda. Nenhuma declaração de GO/deploy/SF_ORCHESTRA_WEB_PACKAGE_VERIFIED. sf-ci permanece reservado para o fim e será executado uma única vez. Os gates cirúrgicos e os diagnósticos anteriores não são substituídos nem promovidos.
