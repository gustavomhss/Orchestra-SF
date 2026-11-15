# Missão52 — revisão independente da proposta P6 de projeção, v2

## Parecer

**STATIC_PASS / NOT_RUN.**

A revisão estática não identificou bloqueio remanescente nos três arquivos da proposta v2. Os três ajustes de identidade recomendados na revisão anterior estão presentes. Este parecer aprova somente a coerência estática do material identificado abaixo; não concede aceitação funcional, de desempenho, financeira, nativa ou de integração.

A proposta permanece **HOLD** para decisão de composição e qualificação. Não foi executada nominal09 como parte desta revisão. Nenhum ganho de tempo é previsto ou aceito por este documento.

Revisor: agente de revisão somente leitura `/root/pack_criteria`, subordinado à missão52. A47 continua sendo a única integradora. Não houve edição remota, dispatch, teste do produto, typecheck, build ou execução de código do produto.

## Material exato revisado

- Material: [p6-projection-material-v2.json](sandbox:/workspace/scratch/fec39c0682b3/m52-work/p6-projection-material-v2.json).
- SHA-256 do material: `a011dd1779d52a4b669f8a742b16ca0e536443684b4f7bf83d2570838e090d67`.
- Patch completo: [p6-projection-complete-v2.patch](sandbox:/workspace/scratch/fec39c0682b3/m52-work/p6-projection-complete-v2.patch).
- SHA-256 do patch: `b602f801cad67cb50e74f87e6be081d66b74366a2b12e9da4a44208613c30bf5`.
- Base de produção isolada: W `78f2362bd09fcbf606505d7833860f1af07b8e6f`.
- Composição base: C27 `b10c424a6b318879fc30f11d03ba1cfeffda7d1a`, tree `31be8f81803b77f03e9089e09118f78218b26262`.
- Os preimages e postimages não contêm a instrumentação temporária D7/D8.

| Caminho | Preimage Git | Postimage Git |
|---|---|---|
| `modules/sucafina/Sucafinav1/product/planner/stored-scenarios.ts` | `529e29806b3faf15f88eec009c198e783f4248a3` | `1761a5d2558c9091d1c02730774751ace44e9131` |
| `apps/cli/src/sucafina-product/planner-evidence.ts` | `13153182e357b716a12d2554654905d54fa30ee4` | `30e67e56d5b78ebb2adebbec10194f19d725b570` |
| `apps/cli/src/sucafina-product/business-services.ts` | `0181267b67b74a8df338999ddb7745cfee42bb29` | `844edd2860e11d5de165c09c7863f4cc6ef5ad67` |

Os seis hashes Git foram recalculados sobre o conteúdo completo dos blobs. O SHA-256 do patch foi conferido sobre o arquivo efetivo. Essa conferência é de integridade de artefatos, não teste do produto.

## Ajustes confirmados na v2

A diferença entre as versões v1 e v2 limita-se aos seguintes pontos em `planner-evidence.ts`:

1. A primeira admissão chama `current()` novamente depois do `await host.revalidate(call)`, antes de invocar o método de fonte capturado.
2. Depois da primeira resolução de fonte, uma nova verificação de `current()` interrompe a operação com `stale` se a identidade mudou.
3. A última leitura de snapshot e a segunda resolução de fonte foram separadas. Entre elas, `current()` impede a invocação do método de fonte antigo caso a fachada tenha mudado durante a leitura.

A verificação final continua comparando as observações, validando autoridade e verificando `current()` depois do último await. Os ajustes não adicionam leitura de domínio, cache, replay ou fallback.

## Autoridade, identidade e isolamento

O projector captura a referência e a seleção de período/moeda com `structuredClone`. Também captura o digest do contexto, o Request, o objeto de fontes e o método `resolveForecastSource`.

A função `current()` verifica o Request original, seu sinal de aborto, o contexto, os argumentos originais e a identidade do objeto/método de fonte. O método real é chamado com `resolveSource.call(sources, ...)`, preservando seu receiver.

A admissão exige referência canônica, instalação e projeto correspondentes ao contexto, superfície Planner, tipo planner-version e período. As observações de fonte precisam corresponder à referência exata e ao `versionId` esperado. As duas leituras de snapshot autenticam o principal na política Planner, usam as mesmas regras de roles/assigned/domains e rejeitam o principal local de fallback.

A primeira projeção conserva a comparação de campos, digest e ano. A segunda precisa ser idêntica à primeira. A fonte é resolvida novamente e a autoridade é revalidada antes de retornar. IDs duplicados em `projection.values` permanecem indisponíveis, como no caminho Forecast usado anteriormente por stored scenarios.

No consumidor, a referência e o horizonte entregues à capability são clones. A resposta também é clonada. A troca da função `input.projectForecast` durante seu await é rejeitada. O resultado não recebe acesso mutável ao caso ou à alternativa mantidos para a verificação final.

Esses guards adicionais fortalecem também o `readEvidence` BCS já existente, que utiliza o mesmo projector. O efeito não está restrito ao novo ramo de stored scenarios; não há relaxamento de admissão.

## Escopo da equivalência

A equivalência estática verificada é a produção da **projeção factual de Planner**. Ambos os caminhos usam `projectPlannerSource` e `buildPlannerFinancialProjection`, com o horizonte solicitado e a política da fonte. Valores conhecidos, valores nulos, ausência de FX, campos ausentes e qualificação da evidência continuam vindo desses produtores reais.

A operação completa `compareForecast` não é substituída nem declarada equivalente: ela também consulta cobertura de baseline e produz um `FinancialAnalysis`. O novo consumidor privado precisa somente da projeção; deixa de solicitar esse cálculo de cobertura de baseline cujo resultado era descartado.

A cobertura atual das alternativas permanece sob as três fases existentes de `scenario-comparison-port`. As leituras históricas, verificações por ocorrência, grupos de caso e leitura final do caso completo em stored scenarios estão preservados. Não há reutilização de observações entre chamadas ou fases.

O ramo externo Procurement está inalterado. O caminho público Forecast permanece intacto. Quando a capability privada não está disponível, o consumidor mantém a chamada pública original; moedas diferentes de USD seguem o caminho público original. Quando a capability é chamada e retorna uma negação ou outro resultado não `ok`, esse resultado é propagado sem tentar novamente pelo caminho público.

Nenhuma escolha humana passa a valer como aprovação formal. Não há alteração de política financeira, prepared change, Apply, receipt ou cenário financeiro.

## Composição e contratos TypeScript

`createPlannerProduct` encaminha a capability por `...input.storedScenarios`. A fábrica de stored scenarios retém o callback; não o executa durante a construção. Os consumidores intermediários inspecionados também não o acionam antes da inicialização de `projectPlannerEvidence`.

O retorno explícito `Promise<PortResult<DomainProjection>>` do callback de composição evita o ciclo de inferência entre product, plannerSources e projector. `DomainProjection["context"]["period"]` é o `Period` obrigatório do contrato. O narrowing para USD é compatível com a assinatura privada; a união de erro de `PortResult` é compatível com a variável de projeção e com o fallback.

Essa avaliação de tipos é exclusivamente estática/manual. **Typecheck: NOT_RUN.**

## Limites de desempenho e aceitação

O [perfil D8](sandbox:/workspace/scratch/fec39c0682b3/m52-audit/diagnostic08-43665193618/profile-summary.json), SHA-256 `be94f3cb959dc118df59616f22a698b77fcf12f15f49d9a42ce23ffd356f5180`, pertence à execução diagnóstica [43665193618](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43665193618).

Nesse perfil, seis chamadas internas de Forecast somaram aproximadamente 4.631 ms inclusivos. O intervalo HTTP medido foi aproximadamente 23.105 ms. São medidas da execução instrumentada, e não uma previsão do postimage. A proposta não demonstra, isoladamente, atendimento do prazo de 10.000 ms da UI. Os intervalos inclusivos não estabelecem custo exclusivo de CPU, clone ou armazenamento.

| Dimensão | Estado desta revisão |
|---|---|
| Integridade do material e patch | VERIFIED |
| Revisão estática de autoridade, fonte, clones e composição | STATIC_PASS |
| Typecheck | NOT_RUN |
| Testes do produto | NOT_RUN |
| Execução nominal do postimage | NOT_RUN |
| Ganho de desempenho | NOT_DEMONSTRATED |
| Integração pela A47 | NOT_APPLIED por esta revisão |
| Aceitação funcional, financeira, nativa ou global | NOT_GRANTED |

A liberação requer decisão da proprietária/integradora, composição concreta sem a instrumentação D7/D8 e evidência hospedada vinculada ao candidato exato. Este parecer não altera os 83 critérios nem seus proof bindings e não autoriza transferir resultados de candidatos anteriores.

