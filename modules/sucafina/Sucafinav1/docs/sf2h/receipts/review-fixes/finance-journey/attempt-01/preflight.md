# FIN-IND-005 — tentativa 01, hipótese registrada antes do run

Status deste arquivo: PREPARED_NOT_RUN. O recibo do resultado será um novo arquivo, sem reescrever este registro.

## Limites e fontes

Branch finance-journey, base `3ea9dc2efe0de8d283f9625774697e431f55a0d7`, PR contra finance-resume. Escrita somente em novos testes e recibos desta missão. Produtores, workflows, políticas, deadlines e testes anteriores permanecem na árvore de base.

Lidos: AGENTS; COMMON da missão em `30e2215749d5295f81fdeafccb9e69ba21d0cdb8`; CI.md e WP11.pack.json completo em `a3d29d011ba3607a57914701300f09117a3e2de9`; execution/COMMON.md, WP13 e os anexos product-acceptance/resident-runtime em `dbf9547211d9b0fade619790de7c19c0869b7c7d`. A leitura do pack foi dividida entre análise principal e revisão auxiliar de contratos, mapas e anexos. Nenhuma delas constitui aceite independente da campanha.

## Correção do diagnóstico de fase

[Run original 43620619049](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620619049), job 132525249982, snapshot `c7a0956f850525a03ccd28b26cb8d90808f4d83f`: 0 pass / 1 fail / 10 expects.

A fábrica createRenewalChoiceHistory retornou após a fase omitted (11386ms). A avaliação anterior e choose também retornaram; resolveTraining chegou a transition-confirmed:complete em 115913ms. As dez assertions identificam a passagem até total250000/comparisonStatus complete. O rótulo de checkpoint ficou parado enquanto a avaliação confirmada prosseguiu.

A pilha real termina no isStillValid da autoridade de cobertura (teste original linha161), que chama issuer.revalidate. Entre 115913ms e o deadline180003ms: +832 c08.read.cases, +94 preferences, +6583 host.revalidate e nenhuma nova transaction.cases. São contadores/timings inclusivos; não somar durações aninhadas.

O finding original é preservado. Sua lacuna de evidência continua válida; o trecho que atribuía a parada à construção da fixture recebe esta localização mais precisa.

## Discriminante

O teste novo preserva todas as assertions da jornada S11 e acrescenta inspeção do componente training40000, vantagem−10000, replay exato, fechamento do writer SQLite, nova autoridade de colaborador e recusas de outsider/revogação. O observer não adiciona leituras de domínio e chama os produtores reais com os mesmos argumentos. O factory de certificado exato é o mesmo usado pela fixture.

Cada chamada registra ID, início/fim/erro e tempo. As APIs observadas são units.issue/resolve/revalidate, preview, resultados read/readHistoricalScenario/readByRequest/write, autoridade resolve/isStillValid, cobertura issue/qualify/revalidate/verify e exact. O objetivo é distinguir revalidações repetidas de busca do solver ou persistência de amostra. A seleção não repete WP10 evaluate-store nem Memory same-request-new-proof.

Fixture180000ms e caso300000ms são os mesmos da prova original. Um timeout é falha de execução; não é prova de fórmula errada nem de sucesso. Assertions posteriores não alcançadas ficarão explicitamente NOT_REACHED.

## Autoridade e persistência

Os grants/fontes/declarações/seleção são sintéticos e já existiam na fixture. Os ports financeiros, C08, SQLite e reader reiniciado são reais. Não há evidência nativa AM, IA, MCP ou identidade empresarial real nesta seleção.

A cauda usa history.restart(), que fecha o store e a autoridade originais antes de abrir SQLite e admitir o colaborador. Recriar apenas serviços no mesmo store não seria reabertura real. A presença dessa cauda no arquivo não demonstra que ela executou.

O replay exercita a mutação idempotente autorizada antes do restart; a nova sessão exercita leitura e revogação. A reabertura verifica caso/escolha/alternativa atual, não o envelope persistido de sensibilidade do WP10 evaluate-and-store. Esse escopo separado continua com seu owner.

Tempos dos spans são inclusivos. O campo active enumera chamadas simultaneamente ativas, não uma árvore estrita de pais. Os contadores cobrem portas decoradas; chamadas internas fechadas sobre resolve/issue originais estão incluídas no tempo externo, sem ganhar contagem decorada artificial.

## Dependências observadas

diagnose-calculation e diagnose-memory ainda apontam `a1434e7ea7340aa1d1c8ce6bb48958b724218170`; consultas de PRs por head retornaram vazias. Isso não prova ausência de writer ativo. Foram lidos seus recibos W26 e runs43619479808/43618475702; não há delta publicado a consumir nesta observação.

## Checks

Só GitHub Actions test-ci poderá executar o teste. Request explícito em selection.json; W e S serão registrados no recibo do run. Sem teste local, full suite ou epic. Typecheck e guards ainda NOT_RUN, sem green atribuído por inspeção ou pela jornada.

