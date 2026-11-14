# Revisão cruzada delimitada — WP05/WP03

Data: 2026-11-14. Revisores são agentes independentes da implementação do trecho revisto dentro da sessão astra-finance. Esta inspeção estática não substitui os gates C/D nem prova native ou aceitação integrada.

## WP03 revisa WP05

Escopo: W2 de `product/analytics/capabilities.ts#revalidateBiSnapshot`, seus usos em `product/analytics/consumer.ts#readBiDestination` e `test/product/wp05/consumer.test.ts`. W2 publicado em `981ad44102b2e2e67d31bfc8fb7d97208e390e5b`; teste de produto ainda aguarda execução neste registro.

Resultado informado pelo revisor: sem blocker no delta de snapshot/digest. O callback recebe cópia; mudanças na seleção/projeção retornam recusa; o objeto devolvido ao consumidor não é entregue ao callback. Os testes exercitam o fence final após a resolução C17 e exigem ausência de payload recusado.

Finding adicional: `BusinessEvidenceResolution` permite `currentRef`, mas o consumidor anterior comparava apenas `source.ref`. Uma resolução com `state: fresh` e `currentRef` diferente contradizia a seleção exata da marca.

Correção W2: se `currentRef` estiver presente, seu valor integral deve coincidir com a referência selecionada. Divergência devolve `stale / selection-source-changed`. Contraprova pareada: referência atual idêntica permanece `ok`; referência diferente com digest válido é recusada sem `value`. O resultado hospedado deve ser associado ao commit publicado antes de qualquer afirmação de PASS.

## WP05 revisa WP03

Escopo: ampliação composta de `product/planner/exact-threshold.ts` e `product/planner/interval-proof.ts`, incluindo confronto com `scenario.ts` e `preview-comparison.ts`. Base da revisão: implementação W1 `8184761b61f78d6aeac73232fdc879e93f85bc5e` e pequeno delta W2 descrito abaixo.

Resultado: nenhum blocker estático encontrado no domínio ampliado. O helper admite uma escrita direta USD não-HR para o parâmetro, recusa targets duplicados e defer que escreva indiretamente no parâmetro. Os comandos reais preservam validações de período aberto, moeda, referência de replacement e duplicidade. Os extremos e cada probe verificam o valor exato do parâmetro, ordem de componentes e digest dos custos fixos; o reissue final verifica metadata e cenário. O limite continua sendo prova de custo conhecido, sem promoção automática para comparação completa ou ação aplicada.

Melhoria enviada ao owner: os extremos eram clonados após await, enquanto cada `probe` mantinha o objeto retornado pelo callback. Clonar o resultado em cada probe remove alias potencial de referências entre awaits. WP03 informou aplicar a mudança W2; a evidência de Actions deve citar o pin correspondente.

## Checks atuais conhecidos

O parent informou o check W1 hospedado `43577976225`: nenhum diagnóstico TypeScript próprio de WP05; package typecheck falhou com 153 diagnósticos totais, incluindo outros namespaces. Guards passaram. Essa informação é scope de diagnóstico, não resultado de testes de produto nem typecheck global verde. O test run W1 informado é `43577975248`, ainda em acompanhamento no momento deste registro. W2 check `43579025258` mantém 131 diagnósticos externos e zero em WP03/WP05/WP11; guards PASS. W3 `66bbe152c145f04c16223a938589c63cedb3b716` teve check disparado, ainda sem resultado neste registro.


## WP05 revisa o helper WP11 do mesmo caso

Escopo: `test/product/wp11/renewal-choice-fixture.ts` e sua composição com `product/decisions/baseline-coverage.ts`, no W3. Nenhum blocker estático encontrado. A resolução C08 tem prioridade; o fallback só continua em `baseline-coverage-unavailable`, propagando refusals, ambiguidades e stale. O registro liga a classificação ao escopo financeiro e permite sua leitura em uma versão posterior do mesmo caso quando esse escopo e a evidência permanecem iguais. As revisões de alternativas preservam essa ligação; as duas fontes depois da inclusão de training usam C08 corrente antes do bootstrap.

O helper novo usa fonte copiada para preservar a evidência da escolha antiga. `Versions.copy` consome `environment.id` uma vez; o `OPEX.save` tem lineId explícito e o path observado não pede outro ID. Por cautela determinística, o helper WP05 agora reserva o primeiro ID para a nova versão e devolve IDs distintos nas chamadas seguintes. Isso não altera o engine.

Limite: trata-se de revisão estática de uma fixture com fontes/grants sintéticos declarados. Execução hospedada precisa confirmar cadeia de persistência, regra, cobertura e cenário source-only. O teste BI consumidor não se anuncia como fluxo instalado/native ou aplicação da escolha.


## Follow-up da revisão independente de consumidores

Relatório externo de revisão sobre W3: SHA256 `7e2cd81b74fab196fd413605f16a8fdaa93dad034871d610e760c7e303549aed`. C1 identificou a perda de navegação em contribuições canônicas com duas fontes; G2 identificou a falta de assertion do sinal/orientação efetivamente exibidos no DOM. Ambos receberam implementação própria delimitada, registrada como FIN05-G e FIN05-H no mapa integral. A implementação não transforma a inspeção em PASS nem em fechamento de C/D; a revalidação hospedada deve vincular os commits e resultados publicados.

Nenhum host, contrato, artifact-store ou produtor de diferença foi modificado por WP05 para esses fixes. A/B são escolhas explícitas da row fornecida pelo produtor; C17 reabre a row atual e compara a referência integral, não apenas refId ou digest declarado. O delta mantém o fence final para revogação e callbacks mutantes. A orientação visual mostra o signed delta já persistido, sem computar sua negação.


### Revisão estática cruzada do fix C1

WP03 revisou independentemente `source-navigation.ts`, `consumer.ts`, `view.ts` e `waterfall.ts` antes da nova prova hospedada. Resultado informado: nenhum escape encontrado para referência de terceira row; membership compara o digest integral com sourceRefs/drilldown da row redispatchada, seguido de version/engine/context, C17/currentRef e fence final. O helper mostra identidades A/B e deduplica refs integrais sem selecionar silenciosamente a primeira. Limite explícito do revisor: navegação e retorno do host instalado ainda não provados; não é parecer C/D.

Pins das correções: C1 W8 `453edcd3c3c2a20413ef0d3f679b0fbc46fca2b5` / tree `7f9fc2de8d5ee0a560c252413ab76d0e4564bab7`; G2 W6 `df29a62e5ede5b9ff9344b4f5b51eba4102e2093` / tree `3e0a13a9085ca446aec553052a61041281c2e1d9`. As duas aguardam Actions cirúrgico próprio. Check W7 `43581794354` tem zero diagnósticos próprios e guards PASS, mas é anterior ao W8. O test backend S4 `43581792536` está em andamento e não prova os fluxos browser C1/G2.


## Extensão coordenada de fixture para implantação70000

WP05 autorizou WP11 a editar somente `test/product/wp05/engine-revision-fixture.ts` para reutilizar a composição de fontes num factory interno e acrescentar `createWp05ImplementationRevision`. A leitura posterior confirmou que `createWp05TrainingRevision` conserva guard, valores, comandos e sequência de IDs. A extensão usa copy/save canônicos e preserva o digest original. Seu consumidor financeiro é `test/product/wp11/implementation-quote-history.test.ts`, com publicação/Actions coordenados pelo root.

O retorno `scenario/result` continua sendo preview hipotético. Após a observação enviada ao autor, o novo export passou a substituir somente implementation:11 por70000 nesse preview, preservando training. Para confirmar o quote70000, o teste WP11 ignora revision.result e usa cenário source-only sem operações pelo produtor/C08. Não se atribui essa extensão ao tree W8 já publicado nem se infere aceite BI adicional.


## Check W9 — narrowing da fixture A/B

Run `43582252267`, job `132409273397`, produto `9913b0c622aa09da7914f231bd9f2ff54d872634`, tree `f43b8e39733c6d93048c4d48001af8d0f398ac5d`. O log confirmou 131 diagnósticos externos e três TS2769 no teste `planner-origins.test.ts`, sem diagnóstico de produto C1/G2. As comparações aceitavam estaticamente uma referência nullable e um expected ID undefined, embora o cenário exija records Planner.

O fix restrito à fixture agora exige referência não null de kind record e identidade autorizada existente por guards de runtime antes das mesmas assertions de igualdade integral/ref atual/recordId. Não usa cast, suppression, retry ou timeout maior. Guards W9 passaram: 78 regras, 766 paths, 13 warnings, zero erros. O narrowing está pronto para publicação e novo check; nenhum PASS posterior é inferido. Receipt detalhado: `check-w9-followup.json`.


## Adendo independente W10 — respostas C1R e G2 literal

O adendo `review-consumers-addendum.md` examinou somente W10 `660db9a46e4c1d7ff87c23f6bb37f451cc703ccb` / tree `bbc79890ba339e0fca0fb34f55bd4d1c69a7953e` e encontrou zero divergências nos734 blobs não documentais. Não executou testes nem conferiu os receipts vivos. Confirmou C1 original corrigido, com regressão C1R de foco aberta; confirmou C2 no produtor/runtime; conservou G2 literal e execução abertas.

FIN05-I responde C1R em W12 `217c9bcc75d499eff3884fb4afe662d5c0029935` / tree `eeae1c748b3e1e73be8686c3f1df325e2fac3824`. Limpa o chooser e confirma foco efetivo em elemento visível. A prova escrita escolhe A/B e chama o export real de restore no mesmo mount; não reutiliza apenas cancel/Escape. Nenhum PASS posterior é inferido.

FIN05-J responde ao literal G2 usando referência opcional de comparação inversa persistida. O adapter liga par/ref/case correntes e conserva duas leituras/fences; o renderer copia knownDifference e estado para tabela/barra com orientação explícita. O teste real grava o inverso já emitido pelo Planner, afirma30000 Condicionada→-10000 Completa no DOM e conserva as fontes das duas alternativas e o histórico ChoiceRecord. O delta foi publicado em W14 `fe13ee693bdcec1830190bcdb5cc7f2794942c1f` / tree `1ce4e9fcb2e9fb81e12dcfd773aa2daae64be39a` e aguarda check/revisão delimitada/Actions, sem parecer independente favorável antecipado. Host/parser/HTTP ainda precisam compor o opcional, conforme external-handoff.md.

A correção de tipagem anterior foi publicada em W11 `88144ff9495c4061fd1661c55e8c6d802bf197a7`; resultado de recheck ainda não foi reconciliado neste documento. S4 `43581792536` trouxe três PASS WP05 e um timeout no caso omitted→40000; esse resultado não valida o browser novo nem resolve o risco de duração. O mapa mantém108 critérios NOT_ACCEPTED, com textos/IDs imutáveis.
