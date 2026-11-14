# Sessão16 — correções concretas de composição

**Entrega concluída como proposta: PROPOSED/NOT_APPLIED.** Uma única [PR #66](https://github.com/gustavomhss/Orchestra-SF/pull/66), `sf2-seam-fixes → sf2-control`, aberta como draft, sem merge. Somente documentação e payloads de patch neste diretório foram escritos. A sessão14 permanece a única autora de aplicação no produto.

## Pacotes consumíveis

| Pacote | Correção entregue | Entradas de produto propostas | Publicação incremental |
| --- | --- | ---: | --- |
| [SF2-SEAM-001](01-review-thread-context/manifest.json) | Contexto C05 até o HTTP autenticado: produtor, services, application e HTTP. | 4 | `1e79b8cb30df3d01b447385aa66033b0a5dd79d1` |
| [SF2-SEAM-002](02-sourcing-money/manifest.json) | Produtor monetário e consumidores Requests/register; valor de sourcing separado da PO futura. | 2 | `8a0f6bcc16bfa7ad39976841ed4e910d3d891337` |
| [SF2-SEAM-003](03-sourcing-assembly/manifest.json) | Import de histórico e montagem sourcing no Workbench, preservando Forecast, Work, scenario e intent atuais. | 2 | `3c433e4be688a3d68e9f61ea1e96cfe344c58df4` |

O [manifesto consolidado](bundle.json) fornece as oito entradas exatas e 60 dependências diretas existentes sem pins conflitantes. Não há colisão de caminhos entre os três pacotes. Cada unidade deve ser consumida atomicamente. Os seis postimages dos dois primeiros pacotes são blobs publicados pelos autores; o terceiro inclui [patch unificado completo](03-sourcing-assembly/sourcing-assembly.patch.txt) e duas postimages integrais, já conferidas pelo GitHub.

A primeira correção foi publicada antes do restante do pacote; o integrador não precisou esperar este fechamento.

## Alvo conferido e limite do destino real

A aplicabilidade estática dos três pacotes foi conferida exclusivamente em:

- Commit de composição WP10: `f511f30b73289c2f21c843254569d31c02eb9608`.
- Árvore: `ee2964cd6cc96ee2697e9d05835777870a843f65`.
- Subárvore de produto: `dd7128a2565cdb2f60309e35e05f2bb592dbb250`.

**Não aplicar estes deltas diretamente ao snapshot de destino `47273c4f20c7c1af9b08537d26618901c36725e3`.** A [conferência do destino](destination-check-47273c4.json) encontrou preimages e dependências ausentes ou diferentes. Esse stack ainda estava no intake inicial de import recovery, com status do integrador `COMPOSED_NOT_VALIDATED`; faltavam aplicações/services de Reviews, sourcing e adapters host necessários. O relatório fornece os hashes reais por caminho.

A sessão14 deve concluir o intake dos outputs dos autores, fixar sua árvore candidata real e conferir os preimages, as dependências e as cadeias instaladas de cada manifesto. Se houver divergência, precisa reconciliar o delta nesse SHA e registrar o novo recibo antes de aplicar. Não forçar aplicação, substituir o stack pela árvore inteira de WP10 ou presumir que o patch serve a qualquer head posterior.

O uso do pin WP10 não aceita a correção Memory em andamento nem autoriza copiar seus demais arquivos. Os deltas propostos são apenas as oito entradas explicitadas.

## Comportamento preservado

**C05.** O produtor fixa review/versão/digest/seção e evidência de fonte, compara duas leituras imutáveis, mantém identidade de método/produtor e revalidação após awaits. A montagem usa o HTTP autenticado com origem, corpo limitado, `sf_review_prepare`, digest, identidade do Request e `finish`. Esta entrega emite o pin; não fecha attachment/reply/reuse, `reviewAnswerSource` ou o percurso completo de C05.

**Sourcing monetário.** Selecionar uma cotação pode criar uma PO futura enquanto o pedido ainda está em sourcing. O produtor e os consumidores agora são propostos em conjunto para conservar o valor submetido de sourcing e projetar a PO separadamente. Ausência não vira zero; status, aprovação, câmbio e request armazenados não são regravados por essa apresentação.

**Sourcing no Workbench.** O renderer deixa de importar um helper que Forecast não exporta, preservando seu markup. A rota usa o handler e o provider reais já existentes na base conferida. O HTTP mais recente conserva Work, contexto de contrato, perguntas, review, record search, scenario e intent. O controller atual do histórico permanece em Forecast; não há cópia da versão antiga nem controller duplicado.

Autorização, CAS, C16, owner de Memory, observações e identidade permanecem obrigatórios. Nenhuma assertion foi removida, nenhum contrato de segurança ficou opcional e nenhum adapter foi substituído por stub.

## Pendências explícitas para aplicação e recheck

1. **Intake do candidato pela sessão14.** O destino observado não satisfaz os preimages. A conferência é por caminho; não é autorização para substituir árvores de autores.
2. **Exports/sessão11.** A suíte monetária existente depende de downloads inclusive no caso de PO submetida/cancelada. `downloads.ts@3a18d541…` no alvo WP10 não oferece sete colunas e o parágrafo monetário exigidos. [Inputs e closure de verificação](02-sourcing-money/verification-inputs.json) fixam os blobs e o bloqueio. Não pular ou relaxar assertions.
3. **Typecheck canônico no candidato real.** O CHECK30 histórico de `d4fb072…` corrobora o import ausente; não é execução em `f511…`. O pacote003 cobre esse conflito de produto. Os outros doze diagnósticos históricos são de fixtures/callers WP04/WP06/WP08/WP09, com seus responsáveis existentes; não tornar `verifyScenarioOperations` opcional para ocultá-los.
4. **Verificação funcional já atribuída.** Após aplicação, conferir postimages e SHA candidato; reavaliar C05 autorizado/negado/revogado, valor monetário/FX/PO/cancelamento, selectors sourcing, montagem real, versão/digest da fonte e histórico no browser. Typechecks, testes, browser, guards e provas nativas estão **NOT_RUN** aqui.
5. **Preservar lanes ativas.** ACK UI/sessão10, exports/11, forecast/12, Memory/13, Finance performance e continuação Finance/sessão18, E2Es, CI, rastreabilidade e revisores oficiais não foram assumidos.

Uma suspeita antiga de Finance sobre `source-fence-read.ts` foi descartada para este pin: o adapter atual `5f1c4b43…` já preserva snapshots e evita writer aninhado. Reaplicar o patch antigo seria regressão. Isso não fecha o resultado de performance `FIN-IND-005`.

## Heads e handoffs lidos

Os handoffs foram lidos integralmente nos pins abaixo. A última observação de refs foi **2026-11-14 19:56:50 UTC**; ela é um snapshot finito, não acompanhamento automático.

| Área | Branch | Pin do handoff/leitura | Último head observado |
| --- | --- | --- | --- |
| WP10 | `astra-wp10` | `f511f30b73289c2f21c843254569d31c02eb9608` | `a00ba2a55190e9ee1fe52fa3030a9cc297b2825a` |
| Finance | `finance-resume` | `454b97daf614176507711df889bd45743467f7af` | `9a2ab893be9f2af2078f67ca867c13892452752e` |
| Operations | `astra-operations` | `15df31a67efab0aae6e2bff2b7eb8e5e59511324` | `15df31a67efab0aae6e2bff2b7eb8e5e59511324` |
| Colaboração | `collab-resume` | `62e5629dbf31be2bb662dda152c96021f22b0ca5` | `62e5629dbf31be2bb662dda152c96021f22b0ca5` |
| Interface | `interface-resume` | `2ee71fc90055814912654ae198f7a1dcf9583943` | `2ee71fc90055814912654ae198f7a1dcf9583943` |

WP10 avançou com recibos e teste Memory; Finance avançou com intake/testes da sessão18. Essas mudanças foram inspecionadas, mas não alteram o alvo declarado dos patches nem recebem aceitação deste pacote. Operations, Colaboração e Interface permaneciam nos mesmos heads.

O [read-set](read-set.json) registra AGENTS, COMMON e missão em `557adbd63f5700f487447cbb6167fe7c71e9bcdb`, o pack S0-B completo e seus apêndices em `dbf9547211d9b0fade619790de7c19c0869b7c7d`, os handoffs, os heads observados e as pendências por owner.

## Conferência realizada nesta sessão

- Oito preimages exatos, incluindo ausência do novo arquivo C05.
- Seis postimages existentes conferidos contra as fontes publicadas.
- Cinco hunks do patch sourcing reaplicados textualmente; contextos, remoções, contagens e offsets correspondem às duas postimages.
- Dois novos blobs de postimage confirmados pelo GitHub, byte a byte.
- Pins das dependências diretas, consumidores e adapters inspecionados; ausência de colisão entre os pacotes.
- Publicações incrementais via GitHub MCP com compare-and-swap e `force:false`.
- Diff publicado limitado ao prefixo autorizado, sem modificação de produto ou branches dos autores.

Esta é conferência estática de artefatos. Não houve execução de produto, teste, typecheck, guard, browser, E2E, prova nativa ou dispatch de CI. As leituras auxiliares internas não constituem revisão oficial.
