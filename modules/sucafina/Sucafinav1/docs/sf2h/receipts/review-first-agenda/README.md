# Mission39 — primeira pauta com vários tópicos e domínios

Finding: **M27-C05-FIRST-AGENDA**. Branch própria `review-agenda`, a partir do C9 imutável `c1bd1c91b0e0d32db3074408e815e36107384073`. PR única para `sf2-stack`.

## Entrega

O novo catálogo usa os produtores existentes de Dashboard, Planner/Forecast e Procurement sob a autoridade corrente. A workspace permite descoberta por domínio e período, inclusão explícita, remoção, ordenação e prévia completa antes da captura C05. Cada item mantém sua referência e competência. Uma mudança de origem retém as escolhas e exige Refresh, nova prévia e confirmação humana. Uma revogação limpa seletores, notas e conteúdo privado, encerra a instância e invalida respostas assíncronas pendentes.

`discover` e `discoveryPeriod` são entradas opcionais. Os callers atuais conservam a assinatura e as portas de preparação/preservação existentes. O retry de preservação fixa o mesmo payload e a mesma identidade da tentativa incerta. O serviço de Procurement usa o período protegido de cada seletor, inclusive no adaptador de evidência da leitura histórica.

## Integração entregue à sessão33

`integration-session33/complete.patch` contém o diff completo de quatro arquivos compartilhados: `review-services.ts`, `extended-business-services.ts`, `extended-http.ts` e `extended-browser.ts`. O catálogo GET precisa ser interceptado antes do handler POST de reviews. O serviço de agenda precisa ser injetado na preparação e na resolução histórica de evidência. O browser injeta a descoberta com a guarda existente e mantém o período inicial.

O manifesto fixa o blob de cada preimage e postimage. As imagens completas estão em `.ts.txt`, para permanecerem inertes e não entrarem no typecheck. Conferir todos os preimages antes de aplicar; qualquer divergência exige reconciliação explícita com o proprietário. A aplicação do patch foi conferida em materialização descartável, e todos os resultados coincidem byte a byte com os postimages. Isso é verificação de integridade do patch, não execução do produto.

## Cobertura proposta à sessão36

`reports-session36/complete.patch` é uma proposta contra `73b716b89d84dfba10070cf4a9369ca9c9e75159`. Ela conecta o helper novo à jornada RPT-01 e inicializa somente fontes de negócio. Os arquivos reais `reports.spec.ts` e `reports-support/production-state.ts` não são modificados nesta branch. RPT-02 a RPT-04, 25 projetos, nota longa, exportações, reload e 1320 → 1400 permanecem no postimage. Usa-se a seleção final `CI-UI-REPORTS` existente; não há nona seleção.

## Validação e limites

A seleção cirúrgica é `Sucafinav1/test/product/review-first-agenda/first-agenda.test.ts`, no runner Bun do GitHub Actions: dois testes com SQLite, produtores, autoridade, handlers HTTP e UI reais. A montagem de browser é mínima e o transporte interceptado chama os handlers; ela não abre servidor nem substitui os componentes de produção. Isso não qualifica sozinho o router instalado.

O manifesto `CRITERIA.json` preserva as 86 bindings S3-A, identifica as provas focadas e mantém o restante sem reivindicação de fechamento. O resultado de Actions, W/S, dedupe, árvore, nonce e verdict serão anexados após a execução. `CI-CHECK-LIMITATIONS.json` registra que C9 não expõe um dispatcher cirúrgico de typecheck/guards com ref alternativo, e que o dispatcher da sessão36 pertence a `astra-check-wp07`. Não se criou workflow, não se moveu aquela branch e não se executou check local.

A expectativa antiga de manter controles após revogação no teste monolítico WP07 é incompatível com a limpeza exigida por esta missão; ela está registrada em `test/product/review-first-agenda/legacy-regression-proposal.json`, sem alteração ou enfraquecimento do teste antigo. O novo teste exige limpeza integral e rejeita retorno tardio. A perda de resposta e o retry idempotente são exercitados pelo teste cirúrgico próprio.

O handoff terminal será acrescentado com os SHAs e os resultados observados. O bundle somente estará funcional no host instalado depois do consumo explícito dos patches compartilhados pela sessão33 e da proposta de cobertura pela sessão36.
