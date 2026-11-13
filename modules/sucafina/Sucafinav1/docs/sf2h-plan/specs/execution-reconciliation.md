# Execução reconciliada — Orchestra SF

## Workflow v3.2 e precedência operacional

O [workflow atual](../WORKFLOW.md) e `execution_workflow` na fonte tornam explícitos lançamento/ACK/admissão, contexto por ator, integração por prontidão, branch sf2-control e envelope C/D. As janelas25/40/55/75 citadas abaixo são checkpoints cumulativos, não barreiras. A composição nativa recebe seus inputs em10–18. S0 reserva55–60 para guias normativos e60–75 para consumidores/ajustes; depois do freeze só evidencia em D. Estes ajustes estão no cronograma canônico. O estado da revisão atual está em [formal-review/README.md](../formal-review/README.md); o parecer da versão anterior conserva seu SHA histórico.

**Execução integrada à fonte canônica; produto e CI não executados.** A reconciliação em [../campaign.json](../campaign.json) corrige FR1-F/E-F02 e FR1-H/E-F03 e torna a parte operacional de FR1-A/E-F01 explícita. Ela foi aplicada por IDs ao snapshot `5e6510cf5f514d30116d989ef27ee529b02f3184`, depois do delta técnico. A baseline de código permanece `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`.

A reconciliação preserva os 15 WPs e amplia 71 para 74 tasks. As três unidades novas são WP10.T06, runtime residente e MCP; WP10.T07, integração e empacotamento Atlas; e WP14.T05, tradução empresarial pura. Essa divisão oferece minutos, escritor, arquivos, outputs e provas próprios para o trabalho adicional. O adendo não fica embutido no tempo da integradora.

## 1. Capacidade real e trabalho distribuído

A hipótese de execução é **cinco sessões efetivamente abertas, com quatro slots cada, incluindo a coordenadora**. Há vinte slots físicos. Três builders encerram antes de três reviewers novos ocuparem seus slots: são 23 identidades ao longo da campanha, com pico de vinte simultâneas. A ferramenta deve confirmar que o builder saiu antes do spawn seguinte.

| Ator | Reserva principal | Entrega e fronteira |
| --- | --- | --- |
| S0 | T0–10; T+10–75; T+75–120 | Contratos, composition roots, provider C08, fila de integração, candidato e encerramento |
| S0-A | T0–10; T+10–55 | Corpus e oráculos; depois T07, incluindo empacotamento Atlas, BusinessContextService e memória protegida |
| S0-B | T0–10; T+10–45 | Preflight; depois T06, AgentV2, loader, contexto de execução e bridge MCP privada |
| S0-C | T0–40; T+43–75; T+75–118 | CI/harness; depois WP14; depois controle final de CI e recibos |
| S1 | T+10–13 e T+16–29 | Seis fontes Finance/Portfólio, com coordenação preservada em T+13–16; depois handoffs e correções de WP02 |
| S2 | T+13–22 e T+24–35 | Documentos WP06.T05; coordenação em T+22–24, controle de CI T+40–75 e correções de WP05 depois |
| S3 | T+16–20; T+23–38 | Qualificação nativa e cinco fontes Maestro/Revisor; depois coordenação e correções de WP07 |
| S4 | T+10–43; T+55–118 | Tradução e primeiras funções WP14; depois provas reais de perfis, skills e Relay |
| Doze builders das frentes | T+10–70/72, conforme tasks | UI, domínios, BI, imports, reuniões, colaboração, rotinas, decisão, IA e portfólio |

`actor_allocations` enumera todas as fatias sem sobreposição por ator. A reserva de uma coordenadora para autoria substitui sua atividade de coordenação naquele intervalo. O plano mantém as janelas para encaminhar bloqueios e receber outputs. Jobs de CI podem continuar sem atenção contínua, mas quantidade de runners, fila e duração são observações, não capacidade presumida.

## 2. A cadeia real de GNATIVE até T+20

O gate não depende de tasks inteiras que terminam mais tarde. Cada incremento tem um produtor, um artefato, uma entrega antecipada e um consumidor.

| Até | Output | Produtor | Conteúdo consumido |
| --- | --- | --- | --- |
| T+13 | AI-NATIVE | WP12.T01; fonte escrita por S1 | `sf_finance`, `sf-explicar-forecast` e `native-probe.json`, com arquivos distribuídos, versões e digest real |
| T+14 | NATIVE-CASE | WP11.T01 / S4-A | `createDecisionCasePort`, caso C09 mínimo com ID, versão e encarnação, vinculado ao principal autenticado |
| T+15 | NATIVE-PLANNER | WP03.T01 / S1-C | `createPlannerPort.compareForecast`, usando o motor financeiro e C02/C10 reais |
| T+16 | NATIVE-RUNTIME | WP10.T06 / S0-B | `registerSfResidentAgents`, `loadSfSkill`, contexto confiável e `createSfBusinessMcpBridge` |
| T+18 | NATIVE-COMPOSE | WP10.T01 / S0 | Roots reais, caso persistido, sessão autorizada, modelo, perfil, skill, ponte, porta e retorno ao produto |
| T+18–20 | GNATIVE | WP00.T04 / S3 | Execução real, comparação com a mesma porta usada pela UI, chamada não concedida recusada e conflito de provider recusado |

O fluxo escolhido é `sf_finance` → `sf-explicar-forecast` → `sf_forecast_compare` → `createPlannerPort.compareForecast`. O caso não pode ser nulo, fictício ou apenas memória efêmera para fechar o gate. O modelo efetivo e a origem do principal ficam no recibo. O runtime usa a bridge privada e o binding definido pelo delta técnico; não passa a confiar em parâmetros de identidade gerados pelo modelo.

Em T+20, o contrato e a política dos oito packs estão publicados. Isso não equivale a executar todos os seus produtores, que têm entregas posteriores. Operações ainda indisponíveis retornam estado explícito. **AM02 exige todos os oito packs operacionais e sua paridade antes de G4/T+75.** A distinção é expressa em campanha, tasks, handoffs, provas e prompts.

WP03 e WP06 começam pelo contrato WP00.T02 em T+10, mesmo se GNATIVE estiver bloqueado. O mesmo erro contratual foi eliminado nos textos adjacentes de WP02, WP04, WP05, WP07 e WP08. Referências genuínas à qualificação nativa em WP09 e WP12 permanecem. As branches de Planner e imports coincidem com `sf2-planner` e `sf2-imports`.

## 3. Documentos, Atlas e memória com escritores distintos

A fila antiga deixava documentos em T+53–72, tarde demais para construir e provar Atlas. A nova execução separa essa capacidade da sequência de parsers de planilha:

- S2 escreve WP06.T05 nos caminhos de `product/documents/`, entre T+13–22 e T+24–35. Entrega `resolveSfDocumentEvidence` e o adapter RAG público em T+20; a extração de PDF digital, DOCX e texto fica pronta em T+35.
- S2-C mantém a sequência WP06.T01–T04 de imports até T+53. Nesse ponto, recebe o lease documental e assume correções e consumo. Não existe escrita concorrente em documentos.
- S4 entrega `mapSfAtlasEntry` em T+20. A função traduz owner, kind e entrada, sem persistência e sem criar identidades técnicas ou PRs fictícios.
- S0 entrega o provider protegido de C08 em T+25. S0-A constrói T07 entre T+10 e T+55, consumindo os três produtores anteriores. O primeiro roundtrip Atlas está reservado para T+45; o serviço completo, para T+55.

O consumo de Atlas usa `@orchestra/atlas-boundary/business-memory-ports` para os factories e `@orchestra/atlas-boundary/native-memory` para o scanner canônico. Os nove caminhos Atlas são exatos: package.json, build.ts, native-bound.ts, nova business entry, quatro artefatos gerados e teste focal. A regra de resolução limita-se à dependência literal do factory para a constante do scanner; o novo bundle não recebe código de subprocesso. Os dois subpaths, AST, check:generated e check:spawn-imports integram ATLAS-PACKAGE/T+20, sem alterar engines/guard/allowlist. [atlas-packaging.md](atlas-packaging.md) detalha a distribuição. A implementação não pode fechar a prova apenas lendo o ledger SF.

O scanner é observado no preflight, com binary path e versão. A ausência não é convertida em sucesso de um scanner simulado. T07 tem o dono da dependência de build e registra o custo de prepará-la; a prova final exige execução real dos casos clean, canary e indisponibilidade. O estado de memória permanece explícito até essa condição ser satisfeita.

WP14 conserva seu limite de funções puras. S4 escreve T05 em T+10–20, T01 em T+22–34 e T02 em T+35–43. Em T+43, S0-C aceita o head e o lease e passa a ser seu único escritor: T03 ocupa T+43–56 e T04, T+56–68. A prova de consumo termina em T+75. S0-A não é um resgate presumido, pois continua ocupado com Atlas.

## 4. Dezoito fontes de skills com leases por arquivo

Os dezoito `source_path` seguem a forma `product/ai/skills/<skill-id>/SKILL.md`. O owner lógico é WP12; o escritor efetivo está em cada lease. S4-B escreve os perfis e os manifests, recebe os commits dos colaboradores e só assume suas fontes depois do encerramento dos leases.

| Escritor | Fontes | Reserva e entrega |
| --- | --- | --- |
| S1 | `sf-explicar-forecast`, `sf-comparar-cenarios`, `sf-avaliar-sensibilidade`, `sf-revisar-dependencias`, `sf-compor-portfolio`, `sf-reavaliar-compromissos` | Primeira skill T+13; demais até T+29; branch `sf2-skills-finance` |
| S3 | `sf-enquadrar-decisao`, `sf-preparar-revisao-executiva`, `sf-coordenar-perguntas`, `sf-contestar-decisao`, `sf-revisar-evidencias` | T+23–38; branch `sf2-skills-maestro` |
| S4-B | `sf-comparar-sourcing`, `sf-revisar-condicoes-contratuais`, `sf-preparar-compra`, `sf-extrair-evidencias`, `sf-produzir-bi-contextual`, `sf-produzir-material-reuniao`, `sf-consultar-memoria-decisoria` | T+25–42; branch `sf2-ai` |

A fonte antecipada `sf-explicar-forecast` pertence a WP12.T01. As outras dezessete fontes e o manifest final pertencem a WP12.T02. Isso distingue propriedade do arquivo e task que executa a missão. O Revisor continua com execução e instruções próprias em T03.

`AI-CATALOG-PORT` em T+25 é uma interface tipada e um builder de manifest. Ela permite construir a interpretação contra o contrato. **O bundle completo AI-CATALOG/AI-FULL chega em T+42; o consumo real das dezoito skills ocorre depois disso na janela de prova.** Nenhuma dependência exige esse output antes de sua publicação.

## 5. Três reviewers novos, com retorno de correções previsto

| Slot reutilizado | Encerramento do builder | Reviewer novo | Quem corrige o WP liberado |
| --- | --- | --- | --- |
| S1-B / WP02 | T+72 | S1-R1, produto e UX | S1, após receber o lease |
| S2-B / WP05 | T+72 | S2-R2, semântica e integridade | S2, após receber o lease |
| S3-A / WP07 | T+75 | S3-R3, IA/MCP/Atlas/Relay/documentos | S3, após receber o lease |

Não se renomeia o builder para chamá-lo de reviewer. O agente anterior termina e o novo não tem autoria. Os reviewers escrevem somente pareceres e recibos em prefixos próprios. As coordenadoras tornam-se writers de correção dos três WPs e não assinam seu próprio aceite. Os outros builders continuam disponíveis para corrigir suas fronteiras; S0-A/B/C mantêm seus papéis de autoria.

A leitura também consome orçamento: R1/R2 têm T+72–95 para leitura e primeiro parecer; R3 tem T+75–95. Os rechecks ocupam T+95–118. Inspeções por autores em T+55–75 ajudam a corrigir cedo, mas não substituem os pareceres. Se a duração observada exigir mais tempo, G2H deve registrar o impacto.

## 6. CI com seleção explícita

O workflow e os validators foram inspecionados pelo GitHub MCP no SHA fixado. O workflow diferencia `src`, com condição `solid`, de `test-browser`, que exige argumento explícito e condição `browser`. O alias `atlas-boundary` existe no registry e o resolvedor o converte para `modules/atlas/boundary`.

| Recipe | Request | Cobertura declarada |
| --- | --- | --- |
| CI-SF | `package=sucafina`, `runner=bun`, `args=[]` | Suíte do módulo Sucafina |
| CI-CLI | `package=cli`, `runner=bun`, `args=[]` | Suíte do CLI |
| CI-APP-SRC | `package=app`, `runner=bun`, `args=[]` | Árvore `src` do app |
| CI-APP-BROWSER | `package=app`, `runner=bun`, `args=[test-browser]` | Árvore Bun `test-browser` |
| CI-ATLAS-BUSINESS | `package=atlas-boundary`, `runner=bun`, `args=[--timeout,30000]` | Suíte completa da boundary; timeout por teste reproduz o script existente, sem filtrar seleção |
| CI-UI-OPERATIONS | Playwright, configuração production, `operations.spec.ts` | Operações e 28 capacidades |
| CI-UI-DECISIONS | Playwright, configuração production, `decisions.spec.ts` | Decisão, portfólio, memória e estados |
| CI-UI-REPORTS | Playwright, configuração production, `reports.spec.ts` | Reunião, documentos e exportações |

As oito requests são um mínimo da footprint, não a suíte global de Orchestra. G0 inventaria o conjunto exigido pelo epic e pelos pacotes alterados. As suites adicionais obrigatórias continuam gates. Os três specs Playwright só podem ser enviados depois de existirem na árvore candidata.

Há gates distintos para `bun run generate`, `bun run check:generated` e `bun typecheck` em `modules/atlas/boundary`, além dos typechecks dos pacotes afetados e dos guards exigidos por AGENTS. Rodar a suíte Bun não implica rodar `check:generated`. O workflow observado não contém dispatch de guards; o gate deve usar seu mecanismo existente sobre o checkout do candidato, sem inventar resultado nem alterar workflow.

Cada receipt liga candidato C, snapshot S, request normalizada, seleção esperada e observada, run, attempt, jobs, controle omni e artefatos. APP-SRC e APP-BROWSER têm receipts separados no mesmo candidato. Um resultado Playwright não substitui uma dessas seleções. Zero testes e seleção divergente não são sucesso.

## 7. Provas integradas e cobertura completa

| Prova | Resultado exigido | Pacotes |
| --- | --- | --- |
| AM01 | Cinco perfis, dezoito skills carregadas e usadas, outputs tipados consumidos, Revisor em execução própria | E11, E16 |
| AM02 | Oito packs e 39 operações congeladas, domínio comum e paridade UI/agente/MCP | E01, E16 |
| AM03 | Dois atores/sessões, chamada direta, concessão, revogação e provider/generation conflitantes | E11, E12, E15, E16 |
| AM04 | Escolha/aplicação autorizada e resposta perdida sem duplicar efeito | E10, E16 |
| AM05 | Referências, módulos Atlas reais, persistência após reinício, ACL, owner, encarnação e scanner | E12, E15, E16 |
| AM06 | Admissão, Relay, perfil/skill, operação SF, resultado e retorno visível ao produto | E11, E13, E14, E16 |

AM01 tem cinco execuções agrupadas, cada uma com skills e outputs nomeados. Juntas cobrem exatamente as dezoito skills, incluindo as compartilhadas. O mapa de AM02 identifica o produtor de cada pack e respeita a entrega mais tardia. AM05 distingue um adapter com o mesmo nome de um consumidor instrumentado dos módulos e ports reais de Atlas.

Os critérios acrescentados têm as cinco famílias de axiomas em WPs e tasks pertinentes. `proof_assignments` associa todos os novos critérios a provas e pacotes. Todos os estados de execução permanecem `NOT_RUN`. O gate da qualificação inicial não substitui as provas cumulativas do candidato final.

## 8. Condição de duas horas e continuação integral

Os intervalos são reservas de execução, não tempos medidos. GREADY, GNATIVE, G2H e G4 atualizam o diagnóstico. G2H exige roster real, leases, outputs pendentes, estimativas dos owners, seleção final, ocupação dos runners, fila/setup/execução/coleta e latência/concorrência observada do host.

A projeção usa o término mais tardio entre construção e consumo, CI, provas reais e revisão/correção, acrescido da reserva final do recibo. Entrada desconhecida produz `UNKNOWN`, não zero. A meta permanece `CONDITIONAL` até ser sustentada pelas observações. O timeout de 45 minutos do job não estima sua duração. As janelas de 20 e 15 minutos para as duas passagens finais continuam hipóteses explícitas a medir.

Se o prazo não couber, a sequência prossegue com o mesmo escopo. Publicam-se ETA, pendências, donos e dependências; slots realmente liberados podem receber trabalho disjunto mediante lease. Falha de transferência não cria dois escritores. Em T+120, só há aceite se todos os gates estiverem satisfeitos. Caso contrário, o recibo registra atraso e a execução continua.

Se a execução adotar um `dev` mais novo, o preflight reconcilia o workflow de CI e os validators com a nova árvore. O avanço de `dev` informado pelo integrador não autoriza editar a frente Azure ou mudar a baseline silenciosamente.

## 9. Integração e verificação desta entrega

C15–C17, as três tasks novas e as alocações estão integrados à campanha. Após qualquer mudança na fonte canônica, regenere campanha, WPs/Markdown, ownership, schedule, DAG, coverage, evidence-plan, proof-map, prompts e índices. Os relatórios da primeira rodada são históricos e não devem ser reescritos.

A verificação pontual deste delta passou para IDs, dependências de outputs, janelas, ocupação de slots, dezoito leases, cobertura 5/18/8/39, seis provas e oito recipes. Não implementou o produto, não rodou testes do repositório, não disparou CI e não executou as provas nativas. A revisão independente foi concluída no SHA indicado na [consolidação formal](../formal-review/round-2/SUMMARY.md); a aprovação mantém os gates e a meta de prazo condicionada.

### Fontes consultadas

- [AGENTS.md](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/AGENTS.md): CI, distribuição de conhecimento, typecheck e guards.
- [test-ci.yml](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/.github/workflows/test-ci.yml): seleção `src`/`test-browser`, controles, evento push e timeout.
- [Registry](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/script/module-registry.json), [resolvedor](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/script/test-ci-package.ts) e [validator](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/script/test-ci-request.ts): aliases e requests permitidas.
- [bunfig do app](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/app-shell/bunfig.toml) e [scripts do app](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/app-shell/package.json): cobertura Bun separada.
- [Scripts Atlas boundary](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/boundary/package.json) e [gerador](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/boundary/script/build.ts): geração, frescor, tipos e teste da boundary.
