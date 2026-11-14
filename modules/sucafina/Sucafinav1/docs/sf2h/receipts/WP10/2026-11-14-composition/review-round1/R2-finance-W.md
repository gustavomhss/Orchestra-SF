# R2 — Finanças, semântica, permissões e persistência

**Parecer: CHANGES REQUIRED.** Há três achados obrigatórios de composição em W. Este é um parecer independente de leitura estática; não é aceite de runtime, CI, AM ou da campanha.

## Identidade, independência e lease

- Reviewer: **R2**, task `/root/review_finance`, sem autoria de produto e sem edição de produto.
- W: `eee00ac3ef2b68c987970535ba5bba5e4c6ad01b`; tree informada no freeze `dcfc04896c3a83e6a69d3ecd1d948ff54231ddf7`; parent `fdbb184f1df7c58f00ee8555e42bce017fd0e942`.
- Branch `astra-wp10`, PR #29 para `sf2-stack`.
- Lease readonly aceito antes da revisão. Builders encerrados na admissão conforme coordenador. Após início de correções do root, todas as novas leituras locais usaram `analysis/frozen-W/repo`.
- Os 175 deltas conferiram em SHA-256 e blob Git; a cópia congelada conferiu novamente em SHA-256. Os 103 pins estrangeiros locais conferiram com seus blobs, sem ausências ou divergências.
- O commit W foi lido pelo GitHub MCP. A resposta normalizada não expôs parent/tree; esses dois campos são os declarados no manifesto congelado, não uma segunda verificação remota independente.
- Autores informados pelo coordenador: root, authority_builder, composition_intake, runtime_analysis e produtores publicados. R2 é disjunto desses autores. Cada seção do JSON registra reviewer, conjunto de autores e owners de origem.

O escopo foi confrontado com as sete tasks e os 171 critérios próprios de `context/pack.json`. O mapa `analysis/criteria-current-draft.json` é insumo de builder e não foi aceito como parecer. Nenhum axioma foi reduzido.

## Achados obrigatórios

### R2-F01 — Preparação do Portfolio fica permanentemente indisponível

**Severidade alta. Owner: WP10 composição.** Critérios: WP10.T01.DOD.01, WP10.T01.SUC.01 e WP10.SUC.10.

Em `apps/cli/src/sucafina-product/host-context.ts:259–267`, o host cria os serviços estendidos sem `preparation` e compartilha o produto Portfolio com o domínio de decisão. `extended-business-services.ts:38–39` repassa esse valor ausente. `portfolio-services.ts:36–41` instala `confirmChoice/confirmAnswer = false` e respostas indisponíveis para valores da escolha e preparação de comandos.

A composição posterior de `decision-domain-services.ts:123–134` não corrige isso: embora defina uma preparação Procurement real, seleciona o produto compartilhado já existente.

**Reprodução estática:** combinação atual e autorizada, escolha humana compatível e provas válidas avançam por `product/portfolio/handoff.ts:20–54` até `decisions.prepareChanges`; esse objeto foi construído com o callback indisponível. O caminho de avaliação existe, mas o trabalho não chega à preparação de mudanças de domínio. Não foi executado um cenário em runtime.

**Correção mínima:** compor os adapters reais de preparação, valores e confirmação humana com ação/payload exatos, principal, caso/versão e fontes atuais. O recibo deve continuar no mesmo commit da mutação. Se faltar seam no produtor, a mudança estrangeira pertence ao seu owner.

**Recheck:** preparar/revisar/aplicar uma combinação humana válida; alterar payload, escolha, principal, versão ou fonte deve negar; resposta perdida e retry não duplicam efeito. Esta é falta de wiring próprio, não gate global nem melhoria opcional.

### R2-F02 — Evidência de cálculo C17 não tem consumidor no router

**Severidade alta. Owner: WP10 composição; WP03 somente se precisar ampliar o seam publicado.** Critérios: WP10.T01.DOD.01, WP10.T07.DOD.01/CMP.01/SUC.01 e WP10.SUC.10.

`product/host-binding/business-context.ts:169–187` possui rotas para record, document, case-event e receipt, mas nenhuma para `kind: "calculation"` nem prova correspondente de continuidade. A montagem em `256–273` também não conecta esse produtor.

O produtor publicado é concreto: `product/planner/calculation-evidence.ts:14–62` lê o resultado C08, verifica input/result/engine/source closure e reproduz o cenário duas vezes. Nas linhas 41–42 cria o tipo canônico `BusinessEvidenceRef` com `kind: "calculation"`, `refId: planner-calculation:<runId>`, `calculationId: planner:scenario`, período e moeda. O source comprova o formato e o mecanismo; **R2 não observou emissão real em W**.

**Reprodução estática:** uma referência válida desse produtor chega a BCS/source-get e cai no fallback indisponível. Se participar da ancestry de um evento, `atlas-memory.ts:84–88,250–253` exige resolver também o cálculo; a autorização da fonte não fecha e não ocorre append. Falhar fechado é correto, mas não entrega o consumidor exigido.

**Correção mínima:** ligar reader e replay record-only reais e a resolução/prova de continuidade ao router. Não construir projeção fictícia nem tratar um digest fornecido pelo chamador como prova.

**Recheck:** cálculo real emitido/resolvido/consumido; divergência de input/result/engine/source; ciclo e orçamento; revogação antes de egress. Append/restart/recall requer execução real posterior. A conclusão não depende de supor que um arquivo ausente do scratch esteja ausente no remoto; o router completo é a evidência decisiva.

### R2-F03 — Revisão preservada deixa de abrir após edição normal da fonte

**Severidade alta. Owner: WP10 Review/persistência.** Critérios: WP10.T02.CHK.02, WP10.T01.DOD.01/SUC.10 e WP10.T03.CHK.01.

`host-context.ts:258–263` fornece apenas readers de contribuições e outcome. `review-services.ts:65` exige que a versão atual seja idêntica à versão capturada; em `76–80`, o caminho histórico depende do callback `historicalSource`, que o host não fornece. `product/reviews/port.ts:133,149` usa essas autorizações para reabrir a revisão.

**Reprodução estática:** preservar revisão com SourceRef v1; alterar um campo projetado do mesmo registro, mantendo acesso e encarnação; `source-lifecycle.ts:172–190` avança a versão do escopo para v2; reabrir a revisão v1 retorna `denied/access-unavailable`. O corpo pode continuar salvo, mas sua utilização e a comparação seguinte deixam de funcionar. R1 relatou independentemente o mesmo encadeamento.

**Correção mínima:** compor reader histórico real que verifique acesso atual por registro/campo, encarnação e captura imutável. Não relaxar a versão para aceitar tudo. Os readers adjacentes ausentes `portfolioHistory` e `handoffs` também precisam ser reconciliados nos seus caminhos obrigatórios.

**Recheck:** uma edição legítima mantém o snapshot apresentado; próxima revisão mostra diferença; revogação atual bloqueia histórico e download; troca de encarnação não reaproveita captura; Portfolio histórico e encerramento usam readers reais.

## Cobertura e observações positivas delimitadas

| Seção | Inspeção realizada | Resultado e limite |
|---|---|---|
| C08 e SQLite | state-provider, local-store, source-lifecycle, prepared-apply | CAS por namespace, idempotência, reautorização, recibo/mutação e COMMIT foram rastreados. Zero defeito adicional estabelecido nesta leitura; falha/restart/concorrência não foram executados. |
| Intenção e permissões | human-authority, product-authority, seleções BI/sensitivity/alternative | Ação/payload exatos, origem, principal autenticado, escopos e versões aparecem nos controles. Não substitui contraprovas reais de revogação. |
| BCS/C17 | business-context e integração Atlas | Há orçamento, profundidade/ciclo, dedup da passagem e revalidação de egress. F02 bloqueia a cobertura de cálculo. |
| Atlas | atlas-memory, atlas-store, atlas-scanner | Usa factories reais da boundary e facade síncrona no snapshot; envelope/index/outbox/receipt são atomizados. Não há prova observada de scanner real, artefatos gerados, AST ou processo reiniciado. |
| C11 AlternativeDraft | alternative-services, selections, captures e pontos do host | Proveniência/caso/ator/run/session/generation e replay foram inspecionados. Sem contribuição nativa real de W observada. |
| Baseline/Planner | baseline-services, planner-evidence, port/comparison/forecast-insights | Período e USD são explícitos; cobertura incompleta mantém total completo desconhecido; classificações não aplicáveis sem produtor ficam recusadas. |
| Portfolio/criteria/sensitivity | portfolio-services/authority e decision-domain | Evidência e resultados vinculados foram lidos; F01 impede encerrar o consumidor. |
| Procurement | port, decision-host e prepared-apply | Intenção humana, review digest, target/incarnação, receipt e versão rastreados. Fluxos de perda de resposta não foram executados. |
| Review/materiality | review-services/port, memory-services, decision-materiality-services | F03 bloqueia preservação após evolução. Condições/actuals são escolhas explícitas; watch ainda declara indisponibilidade real e não conta como rotina entregue. |
| Export/import/audit | public-state, dashboard-import/backup, source-lifecycle | Namespace privado é removido recursivamente da projeção pública e import/restore preserva metadados confiáveis. Matriz completa de relatórios/papéis não executada. |

### Semântica financeira exigida em T03.CHK.01

**Margem e economia:** `planner/comparison.ts:30–36` distingue mudança de custo (alternativa menos baseline) e economia (baseline menos alternativa). `forecast-insights.ts:43–46` calcula margem de orçamento como outlook menos budget. A fórmula principal `src/planner-accounts.ts:73–76` foi lida remotamente no SHA W e confirma exatamente essa subtração. Cobertura incompleta não promove `completeDifference` a um número aceito.

**Aging:** `procurement/port.ts:251–258` usa `approvalStageEntry`. A função original foi lida pelo MCP em W, `src/procurement-screen.ts:228–243`: primeiro responsável usa a última submissão da etapa; níveis posteriores usam a aprovação do nível anterior depois da submissão. A função retorna null se faltar a transição, sem recorrer à data de criação/importação.

Essas são conclusões do código lido, não declarações de uma jornada financeira executada. Os blobs remotos foram `510be5b2aeb82e740f342a5b649619116cb8ff1c` (procurement-screen) e `6ca9b19e8b54e3279c2c16667e92ad7df748b3ea` (planner-accounts).

## Provas pendentes e limites

Nenhum teste local, typecheck, build, import de produto, mutação remota, git remoto ou gh foi executado. Os únicos escritos de R2 são este relatório e seu JSON em `analysis/reviews`.

O coordenador informou snapshots de CI próprio `unitS=d6dd636ec1ff6c6162eab8bd67f9398f847cc0d5` e `checkS=e216f8c3ce944eb81d4869828959ed189068a73d`. R2 não recebeu conclusão, run/attempt/job/control/artifact verificável e não lhes atribui PASS ou validade automática de W. Históricos não qualificam o candidato.

Scanner clean/canary/unavailable, roundtrip de processo real, AM01–AM06, todas as jornadas e envelope C/D continuam sem aceite neste parecer. Full epic, oito seleções finais e as provas globais pertencem a S0 após compor o bundle completo. F01–F03 continuam correções obrigatórias próprias e não foram deslocadas para esses gates.

## Veredicto e próxima revisão

**W não recebe aceite R2.** Os três achados obrigatórios estão abertos. A arquitetura inspecionada contém controles úteis, mas existência de controles não prova entrega nem execução.

O autor deve corrigir os caminhos próprios, preservar ownership estrangeiro, publicar novo freeze W2 e fornecer evidência hospedada dos riscos afetados. R2 fará rechecagem independente das correções e dos consumidores, mantendo separadas revisão estática, CI, runtime nativo e aceite global.

