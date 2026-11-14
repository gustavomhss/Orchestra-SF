# W26 — limite exato ligado aos consumidores reais do host

Finding de origem: `R1-W26-HOST-EXACT-THRESHOLD-01`, revisão independente pré-intake `reviews/R1/intake-W26-pr36.json`, sobre W25 `3d59829e5d9e438cbb443428a9479d7f63b5bf31`.

As composições principal e fallback já possuíam unidades canônicas e preview real de Planner, mas omitiam o callback `exactThreshold`. A alteração instancia o produtor público existente `createPlannerExactThreshold({ units, preview })` e adapta exclusivamente `binding.baselineRef` para a assinatura pública do produtor. O mesmo callback é entregue à avaliação por `createPortfolioProduct` e à recertificação durável por `createPortfolioProofVerifier`.

No fluxo principal, as dependências permanecem opcionais quando não existem cenários armazenados. No fallback, o produtor usa as unidades e o preview reais já compostos. Quando `sharedPortfolio` fornece produto/proof, essas identidades continuam sendo utilizadas; não há substituição de resultados, engine ou autoridade.

Não há fórmula de limite no host, constante financeira substituta, novo cache, bypass de unidade/cobertura ou edição estrangeira. O produtor canônico mantém sua busca, provas de componentes, evidências e limites IEEE. A API pública do serviço não expõe um callback apenas para testes.

Esta correção de autoria requer prova hospedada pelo consumidor HTTP real e pela leitura persistida. Os testes WP13 com callbacks próprios de fixture não fecham o finding do host. Nenhum aceite financeiro completo, nativo ou global é inferido desta inspeção.
