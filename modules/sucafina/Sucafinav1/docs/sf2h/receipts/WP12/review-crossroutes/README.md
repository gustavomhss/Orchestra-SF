# WP12 — rotas reais entre revisão, relatório e material

Este incremento acrescenta um driver próprio isolado para três lacunas de implementação: `sf_report_prepare` e `sf_artifact_get` com **Maestro / revisão executiva**, e `sf_review_prepare` com **Maestro / material de reunião**. O mapa D21 e o adendo W22 permanecem imutáveis. Este documento corrige a classificação ampla dessas três rotas como dependências externas: existe uma via legítima com seleção humana pública no objetivo já admitido. Código escrito e revisão estática não são prova de execução nem aceite AM02.

## Seleção e autoridade

O humano seleciona uma comparação real de janeiro pela ação `review-agenda`, lê seu preview e preserva as mesmas seções por `review-preserve`. Somente depois dessas ações o driver cria o caso, cujo objetivo identifica explicitamente os seletores públicos devolvidos. Não lê Map privado, não cria identidade de artefato, não fabrica receipt e não afirma que o modelo descobriu os seletores sozinho.

Os inputs continuam exatamente `ExecutiveReviewInput` e `MeetingMaterialInput`. Não recebem campos novos. A seleção textual não concede autorização: cada porta instalada volta a verificar principal, caso, fontes, perfil, skill, recibo, payload e versão. O preview nativo deve coincidir com o preview real e com as seções, fontes e lacunas da revisão preservada.

## Execução e consumo

Havendo modelo instalado, cada missão deve executar as operações exigidas neste driver na Session real. O teste lê as mensagens em ordem crescente, verifica os recibos e exige que a chamada que produz o relatório preceda a leitura do artefato. O consumidor HTTP baixa **o artifactRef devolvido pela ferramenta nativa**. Um arquivo produzido anteriormente pela UI não é usado como substituto.

O DOCX contém duas seções de janeiro com 22 valores cada. O teste compara as três células de cada linha, por seção e ocorrência: identidade e valor observado — ou `unavailable` para null — com unidade/moeda; período; e IDs das referências de origem. Confere também cabeçalhos, ordem, 44 ocorrências e 38 identidades distintas. O renderer não possui uma coluna separada `evidenceState`; não há alegação de que ela exista.

`DecisionBrief` conserva seu contrato e os `orderedResultRefs` vazios na ausência de uma rotina. O relatório auxiliar permanece no resultado/recibo da Session e tem consumidor HTTP próprio. `MeetingMaterialProposal` deve ser exatamente o resultado real de `sf_report_prepare`, com evidência do `sf_artifact_get` correspondente. O consumidor `review-contribution` abre a contribuição, a revisão e os links reais; o host reaberto deve preservar a saída, a auditoria da Session e os downloads.

Sem modelo, o driver registra a disponibilidade e executa somente o caminho UI real, identificado como tal. Não existe contribuição sintética nem atribuição desse caminho à skill. Um modelo disponível que não conclua a missão causa falha.

## Limites preservados

As obrigações C07 de rotina continuam separadas. Este driver não reconstrói uma agenda efêmera depois do reload, não demonstra descoberta autônoma e não remove o teste independente de leitura histórica mensal após alteração da fonte. A falha403 desse teste continua registrada e sua expectativa200 permanece intacta.

`implementation.json` mantém os três índices do adendo anterior, os textos canônicos, o arquivo próprio, os consumidores e os limites de prova. `source-pins.json` conserva as fontes por commit/blob/hash. O recibo independente é estático. Nenhum produto ou typecheck foi executado localmente; o limite do novo teste é420 segundos, com marcadores de fase para diagnóstico no GitHub Actions.
