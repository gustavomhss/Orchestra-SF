# WP06 — impacto completo W4 → W5 proposto

Base `644324778e4a21d22424515dd698d5b8d6c01893` / árvore `6ec8797d360ecec89f1734031b0d1e3e98dd3605`. O parecer é condicionado à comparação do candidato publicado, não atribui PASS novo e não aceita WP/global.

## Escopo material revisado

| Arquivo | Blob obrigatório de W5 | Consumidor que exige prova |
|---|---|---|
| business-services (wrapper OPS01B mínimo) | `9aee116a091c684ba467f81316d2fb915b3f8758` | H01 ampliado chama diretamente business.procurementDossier. O CLI de WP06 continua um consumidor distinto. |
| decision-apply (UI owner exata) | `2e6c081ad2a5282654707f7fc7278183e7dfb20d` | H09 executa o script revisto contra review/Apply/receipt reais do HTTP de Procurement. |
| decisions/apply (restauração CAS publicada) | `4bdd12ac162d61465557363953e25dfd99fad5e8` | H02/H03/H05/H06 de host-integration alcançam a reconciliação pós-domain. |

O CAS restaura o hunk publicado em PR23 dentro do produtor Finance: após recibo do domínio, relê caso inteiro e CAS, confere recibo autoritativo/autoridade e recusa alteração concorrente. Imports, assinatura e inicialização do módulo não mudam. Não é mudança de política ou scoring.

## Corpus81 e exceções por símbolo

As 81 fontes de testes foram localizadas e inspecionadas; nenhuma chama diretamente createPreparedExecution, business.procurementDossier ou o endpoint de decisão Apply. Essa busca não é usada sozinha: combina-se com o grafo anterior e a inspeção dos callbacks/descriptors lazy.

Os 31 arquivos históricos fechados usam 100 fontes sem interseção com os três deltas ou os novos fixtures. Entre os demais, os três specs C12 do corpus — WP04 prepared-production, WP11 prepared-apply e WP11 planner-apply — chamam **createSfPreparedApply diretamente**, de prepared-apply.ts. Não alcançam createPreparedExecution nem o novo bloco pós-domain; seus passes W4 continuam atribuídos ao run falho em agregado.

WP11 case-port fica fora81. Sua única utilização de createPreparedExecution retorna nas cinco tentativas antes da classificação/reconciliação: recibo indisponível, falta de confirmação, revogação durante confirmação, resposta perdida após commit e retry sem proof de review vinculado. O nome do caso não é tomado como prova do bloco que ele não executa. Não há motivo para repeti-lo apenas pelo hunk CAS.

Os 81 registros mantêm suas decisões anteriores, inclusive Atlas pendente. **Não se recomenda nova seleção WP06 pelos deltas exatos acima.** Host-integration é o arquivo material e já inclui as provas novas H01/H09.

## Browser e nativo

Native import-analysis W3 e browser imports14/Procurement8 W2 preservam seus escopos: os caminhos não executam o dossiê de negócios, o Apply preparado ou o script de Workbench. O browser documents8 W4 e os cinco casos reais CLI dossier-runtime também não chegam a esses símbolos. As provas ficam nos SHAs/runs originais, com os limites de fixture mantidos.

H09 introduz somente os quatro fixtures owner byte-exatos: wp01/browser-fixture, wp02/browser-driver-fixture, wp01/browser-startup.test e wp01/browser-lifecycle.test. O driver incorpora o refresh owner `50906b86` / blob `76188b9f567861b30dba3b22afce66d60a2424c8`: três linhas de diagnóstico `DEBUG=pw:browser` no processo Node, sem alteração de API, assertions ou deadline. Nenhum fixture é importado pelos81; a seleção é explícita `./startup`, `./host-integration`, `./lifecycle`, sem nova configuração Playwright, preload ou descoberta genérica. Seus testes de startup/finalização precisam passar junto de H09; o owner anterior falhou no hook de lançamento e não fornece essa prova.

Os hashes, cinco callers CAS, todas as81 linhas, limites e pins dos quatro fixtures estão no JSON. A comparação W5 publicada ainda deve confirmar o escopo antes da reutilização. AM, GNATIVE real, aceites humanos, Atlas e epic global não são promovidos por esta análise.
