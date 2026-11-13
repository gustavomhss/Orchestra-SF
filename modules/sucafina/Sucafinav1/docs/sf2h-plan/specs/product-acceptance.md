# Correções normativas de produto — FR1-D/E/G e consumo das skills

**Estado: especificação integrada; revisão independente pendente. Produto e testes de implementação: NOT_RUN.** As correções estão em [../campaign.json](../campaign.json). Os pareceres históricos da rodada 1 permanecem intactos.

## 1. Confirmação humana: base observada e validade atual

O contrato C06 passa a conservar duas coisas distintas. O registro imutável diz quem confirmou qual referência, encarnação, campos, período e dependências, em qual versão observada. A projeção atual informa se esse mesmo escopo continua válido para o consumidor autorizado. A pessoa que viu a versão 7 não passa a ser apresentada como revisora de todos os campos da versão 8.

A validade usa um fingerprint determinístico do escopo autorizado: identidade/encarnação, dados e ausência dos campos pertinentes, período, moeda/unidades e dependências materiais declaradas pelo produtor. O fingerprint exclui a versão global, timestamps de auditoria e dados fora do escopo. Uma dependência pertinente alterada invalida a confirmação mesmo que um total final coincida por compensação. O modelo não escolhe quais dependências ignorar.

| Situação | Estado atual e efeito | Auditoria |
| --- | --- | --- |
| Janeiro confirmado em v7; só fevereiro independente muda em v8 | `valid`; nenhuma cobrança nova de janeiro | Versão observada continua v7; versão avaliada pode ser v8 |
| Janeiro ou dependência pertinente muda | `stale`; uma pendência canônica de revisão, sem duplicação por retry | Registro e conteúdo originalmente confirmados permanecem |
| Acesso pertinente revogado ou dependência não verificável | `unavailable`; sem valores, fingerprint ou links restritos; sem cobrança à pessoa sem acesso | Registro protegido preservado |
| Origem removida ou substituída | Nunca herdar validade; `stale` se a condição puder ser divulgada, caso contrário `unavailable` | ID reutilizado não restaura a encarnação anterior |
| Acesso retorna | Revalidar origem/dependências atuais; só o mesmo escopo e encarnação podem continuar válidos | Nenhuma reescrita da revisão histórica |

O comando de confirmar compara o fingerprint esperado ao atual. Concorrência material gera conflito e preserva o rascunho. Concorrência apenas fora do escopo pode ser aceita após comprovar igualdade, mantendo separadas a versão observada e a avaliada. O metadata-command conserva `observedSourceVersion = 7` e usa a revisão atual da unidade protegida em `expectedStorageVersion` (por exemplo, 8). O host revalida o escopo antes da tentativa. Isso preserva CAS/locks C03/C08: falha de CAS exige releitura e revalidação antes de retry idempotente; mudança material gera conflito. A versão da fonte e a do armazenamento são distintas, mesmo quando coincidem no exemplo. A confirmação grava apenas sua área de colaboração e não promete transação global entre fontes. Cada reuso consulta novamente a validade, em vez de confiar numa flag persistida.

`CONFIRM-SCOPE` define branches independentes para janeiro/fevereiro, dependência, concorrência, revogação, substituição, remoção, acesso restaurado e ausência versus zero. WP08.T03 produz; Meu trabalho e WP09.T02/T03 consomem a mesma projeção. E09/E13 exigem a contraprova de não recobrança, além da invalidação material.

## 2. Cobertura de custos: omissão também aparece

C10 introduz um inventário versionado por tipo de decisão. O primeiro inventário, `renewal-transition-v1`, exige avaliar serviço, sobreposição, implantação, saída contratual, migração, impostos, treinamento, custos internos e outras categorias pertinentes identificadas no escopo. As categorias orientam a investigação; não determinam alíquotas, obrigações fiscais, preços ou recomendações financeiras. Outros tipos de decisão devem declarar seu inventário. Enquanto isso não ocorrer, a cobertura continua pendente.

Cada categoria está incluída com referência a componente/fonte, demonstravelmente inaplicável com justificativa/fonte, ou pendente. O validador compara o inventário às entradas: uma categoria que não foi cadastrada recebe `pending(reason=missing-category)` derivado. Não é necessário que alguém tenha lembrado de criar uma linha vazia. O inventário obrigatório não pode ser reduzido para fazer a avaliação passar.

Uma mesma parcela pode cobrir várias categorias quando sua fonte o declarar: o preço de implantação pode incluir migração e treinamento. O motor soma identidades de componentes uma vez; a tabela de cobertura não cria parcelas. Zero informado exige fonte e continua distinto de ausência, null, câmbio faltante e declaração de inaplicabilidade sem suporte.

`ScenarioResult` e `ScenarioComparison` fornecem um subtotal conhecido, total plenamente coberto quando possível, estado da comparação, referências de cobertura e condições não resolvidas. UI, BI, crítica e portfólio usam a mesma avaliação versionada. Um número matematicamente reconciliado não promove a comparação a completa. Estimativas, hipóteses e categorias pendentes mantêm a condição explícita. A completude financeira também não confirma prazo ou viabilidade operacional.

### Fixtures numéricas

| Caso | Valor conhecido ou total | Diferença frente à renovação de USD 240000 | Teto de implantação para vantagem mínima de USD 20000 | Condição |
| --- | ---: | ---: | ---: | --- |
| Base com inventário resolvido | 60000 + 45000 + 105000 = 210000 | 30000 | 55000 | Financeiramente completa; prazo pode continuar pendente |
| Base com implantação alterada para 70000 | 235000 | 5000 | 55000 | Cobertura completa; mínimo de vantagem rompido |
| Variante com treinamento inteiramente omitido | Subtotal 210000 | Diferença conhecida 30000 | 55000, condicionado | `missing-category`; total coberto e diferença completa indisponíveis |
| Mesma variante após treinamento adicional confirmado de 40000 | Total 250000 | -10000 | 15000 | Cobertura completa; comparação de custo invertida e mínimo rompido |
| Controle com treinamento explicitamente gratuito | Total 210000 | 30000 | 55000 | Zero confirmado; diferente de omissão |

A base e a variante omitida usam cotações sintéticas diferentes. Na base, a implantação de 45000 já inclui treinamento. Na variante, outra cotação de 45000 inclui migração, mas exclui treinamento. Isso evita somar posteriormente um custo que a fonte inicial já declarava incluído. As duas alternativas têm declarações explícitas para todas as demais categorias; os preços fictícios declaram os encargos incluídos sem introduzir taxas.

Uma escolha humana feita com comparação condicionada pode registrar a ressalva; ela não elimina a pendência nem autoriza aplicação. `ChoiceRecord` preserva versão da alternativa, inventário, cobertura, subtotal, critérios, fontes e ressalvas usados na época. O custo posterior é calculado pelo produtor e enviado ao classificador puro WP14; o sinal apresenta antes/depois e a condição afetada, sem trocar automaticamente a escolha.

## 3. Extração documental: responsabilidade local explícita

A extração de PDF digital, DOCX e texto continua obrigatória em WP06.T05. WP09.T04 recebe `DocumentEvidence` C14 e referências C02/C07 para o dossiê; não implementa parser. A antiga exclusão global da campanha é removida.

O consumo conserva arquivo, versão, trecho e estado. Campo extraído é candidato; só a confirmação atual pode alimentar a premissa utilizável. Atualização, rejeição, ausência de texto ou revogação continuam visíveis como pendência/restrição. O check integrado usa a mesma `evidenceRef` antes e depois da confirmação e verifica cenário/dossiê sem cópia ou confirmação paralelas.

## 4. Dezoito skills com uso verificável

A matriz completa está em [../resident-ui-consumption.json](../resident-ui-consumption.json). Cada linha contém entrada de trabalho, inputs tipados, operações, saídas, tasks produtoras e consumidoras, estados de falta/falha/stale, discriminador negativo e ligação às seis provas do adendo. Os IDs são exatamente os do adendo.

| Skill | Perfis permitidos | Saída principal | Consumidores |
| --- | --- | --- | --- |
| sf-enquadrar-decisao | sf_maestro | IntentFrame, AnalysisPlan | WP11.T01, WP01.T05 |
| sf-preparar-revisao-executiva | sf_maestro | DecisionBrief | WP07.T01, WP07.T02, WP01.T05 |
| sf-coordenar-perguntas | sf_maestro | QuestionProposal | WP08.T02, WP08.T06, WP01.T04, WP01.T05 |
| sf-explicar-forecast | sf_finance | FinancialAnalysis | WP01.T05, WP05.T01, WP09.T03 |
| sf-comparar-cenarios | sf_finance | ScenarioComparison | WP01.T05, WP05.T05, WP11.T02 |
| sf-avaliar-sensibilidade | sf_finance | SensitivityResult | WP05.T05, WP01.T05 |
| sf-comparar-sourcing | sf_procurement | CommercialComparison | WP01.T05, WP09.T04 |
| sf-revisar-condicoes-contratuais | sf_procurement | CommercialGap, EvidenceCandidate | WP09.T04, WP11.T02, WP01.T05 |
| sf-preparar-compra | sf_procurement | DossierDraft, PreparedChangeSet | WP11.T03, WP09.T04, WP01.T05 |
| sf-revisar-dependencias | sf_portfolio | DeliveryAssessment, DependencyConflict | WP13.T01, WP01.T05, WP08.T06 |
| sf-compor-portfolio | sf_portfolio | PortfolioComparison | WP01.T05, WP05.T05, WP13.T04 |
| sf-reavaliar-compromissos | sf_portfolio | ReconsiderationProposal | WP01.T05, WP08.T04, WP09.T07 |
| sf-contestar-decisao | sf_reviewer | CritiqueReport, UnresolvedCondition | WP11.T02, WP01.T05, WP08.T06 |
| sf-revisar-evidencias | sf_reviewer | ClaimIssue | WP01.T05, WP06.T05, WP11.T02 |
| sf-extrair-evidencias | sf_procurement, sf_maestro | DocumentEvidence | WP01.T05, WP11.T02, WP09.T04 |
| sf-produzir-bi-contextual | sf_finance, sf_portfolio, sf_maestro | ContextualBIProposal | WP05.T05, WP01.T05 |
| sf-produzir-material-reuniao | sf_maestro | MeetingMaterialProposal | WP07.T02, WP07.T04, WP01.T05 |
| sf-consultar-memoria-decisoria | sf_maestro, sf_finance, sf_procurement, sf_portfolio, sf_reviewer | CaseRecall, MatchExplanation | WP01.T05, WP11.T01, WP09.T07 |

As quatro skills compartilhadas têm grants explícitos: extração para Compras/Maestro; BI para Finance/Portfólio/Maestro; material para Maestro; memória para os cinco perfis, sempre no escopo autorizado. A reconciliação técnica com C15 conserva essas saídas e registra a matriz efetiva. Uma execução convoca somente os especialistas necessários.

Um witness por skill deve apontar perfil/versão, skill/versão/digest realmente carregados, run/modelo efetivos, entrada e operações autorizadas, objeto persistido e ação observada no consumidor após reload. Catálogo, arquivo presente, nome de agente ou referência de consumidor nunca aberta não bastam. As seis provas integradas podem produzir vários witnesses; não há obrigação de executar um teste isolado por frase.

Na interface, a contribuição, a fonte e a próxima ação ficam visíveis; perfil, modelo e run ficam no detalhe. Finance explica composição/limiar; Compras confronta condição comercial; Portfólio explica compromissos/dependências. O Revisor usa execução e instruções próprias, sem acesso adicional. Erro, falta de entrada, cancelamento e desatualização conservam o trabalho confirmado e não produzem objetos falsamente prontos. O usuário não precisa escolher manualmente cinco agentes nem recuperar dados perdidos no chat.

## Integração e verificação do plano

Aplicar os 66 patches por selector, conforme `integration_instructions`, sobre a fonte canônica. As alterações C06/C10 são completas; C09/C11/C14 recebem acréscimos. C15/C16/C17, binding, Atlas e ownership técnico permanecem sob a frente de contratos. A matriz cita WP14.T05, task nova acordada com essa frente. Patches de jornadas sincronizam `campaign.journeys` e `coverage.journeys`.

Regenerar os JSON/Markdown dos WPs, contratos, cobertura, índices e mapas de prova sem editar os relatórios históricos. Preservar todas as cinco famílias em campanha, WP e task. Os novos sufixos .20–.29 são critérios de produto; .30–.39 são de consumo das skills.

A validação estática aplicou todos os patches em uma cópia Python em memória, confirmou as strings antigas, preservou as cinco famílias e IDs únicos, conferiu os 18 nomes contra o adendo e reconciliou inventários e aritmética. Essa validação passou. **Todos os axiomas/checks de produto continuam NOT_RUN.** Não foi executado produto, UI, modelo, Relay, MCP, Atlas ou CI; a revisão independente do candidato integrado ainda cabe aos revisores designados.

### Fontes examinadas

- `formal-review/round-1/product.json` e `SUMMARY.md`, achados P-F02/P-F03/P-F04 e apoio a P-F01.
- `contracts.json`, `campaign.json`, `coverage.json`, `evidence-plan.json` e consumption map.
- WPs 08, 09, 11, 12 e 13; contratos consumidores pertinentes em WP01, WP05, WP06, WP07 e WP14.
- `sources/AI-PRODUCT-VISION.md` e `AGENTS-ATLAS-MCP.md`; fontes aceitas de produto, sem tratá-las como implementação.
