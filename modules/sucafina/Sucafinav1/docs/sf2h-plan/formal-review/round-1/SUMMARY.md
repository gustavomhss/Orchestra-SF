# Revisão adversarial formal — consolidação da rodada 1

**Veredicto: REQUIRES_CHANGES.** Os três revisores concluíram de forma independente que o plano ainda exige correções antes da execução integral. Nenhum apontou P0.

**Snapshot avaliado:** [`ec9d36da2385007b64a0aa627582ce7e60629a44`](https://github.com/gustavomhss/Orchestra-SF/commit/ec9d36da2385007b64a0aa627582ce7e60629a44). **Branch:** `sf-product-plan`. O [recibo](checkpoint.json) registra 73 arquivos com hashes de blobs conferidos no GitHub. A baseline de código é `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`.

Esta rodada avaliou o planejamento completo, inclusive a equipe residente, skills, MCP e Atlas. Não implementou o produto, não executou testes de produto e não corrigiu o snapshot durante o julgamento. **implementation_test_status: NOT_RUN.**

## Pareceres independentes

| Revisor | Foco | P0 | P1 | P2 | Parecer |
| --- | --- | ---: | ---: | ---: | --- |
| R1 | Produto, UX e completude | 0 | 3 | 1 | [Produto](product.md) · [JSON](product.json) |
| R2 | Contratos, identidade, MCP e Atlas | 0 | 3 | 0 | [Contratos](contracts.md) · [JSON](contracts.json) |
| R3 | Prazo, paralelização, ownership e CI | 0 | 2 | 1 | [Execução](execution.md) · [JSON](execution.json) |

**Contagem original: 8 P1 e 2 P2. Consolidação: 6 frentes P1 e 2 ajustes P2.** P-F01, T-F01 e E-F01 descrevem perspectivas complementares da mesma incorporação do adendo e estão agrupados em FR1-A. Os contratos específicos de identidade MCP e adaptação Atlas têm correções próprias, em FR1-B e FR1-C. Esta consolidação não altera nem apaga os pareceres originais.

## Correções verificáveis

### FR1-A — P1 — Incorporar equipe residente, skills e entregas do adendo no plano executável

**Achados de origem:** P-F01, T-F01, E-F01. **Estado:** OPEN. **Responsáveis propostos:** S0/WP00; WP12, WP10, WP01, WP06, WP09 e WP14 nos respectivos produtores e consumidores.

O adendo exige cinco perfis, dezoito skills, oito packs e Atlas, mas tasks, contratos, ownership, recursos e provas canônicos ainda representam a campanha anterior. Uma análise genérica pode cumprir os checks existentes sem provar a equipe residente.

**Critérios de fechamento:**

1. Identificar cada perfil, skill, pack, adapter e consumidor com task, writer e path únicos; preservar as cinco famílias de axiomas em campanha, WP e task.
2. Definir manifest de perfis/skills, fontes distribuídas, versão/digest, carga efetiva, permissões e saídas tipadas consumidas na UI ou rotina; distinguir execução própria do Revisor.
3. Mapear as seis provas do adendo a critérios e recibos; falhar quando houver somente catálogo ou nomes de perfis sem contribuição real.
4. Reconciliar o mesmo conjunto em campanha, contratos, WPs, coverage, ownership, DAG, cronograma, prompts, evidence-plan, proof-map e índices; contabilizar S0, WP12 e a capacidade parcial de S4/WP14 sem ampliar slots implicitamente.

### FR1-B — P1 — Fechar identidade e caminho de execução do MCP Sucafina

**Achados de origem:** T-F02. **Estado:** OPEN. **Responsáveis propostos:** S0/WP00 e WP10; WP12 e domínios como consumidores.

A API provided da baseline não transmite automaticamente o principal empresarial por chamada; a especificação ainda não escolhe e atribui o binding confiável nem a recusa de provider homônimo.

**Critérios de fechamento:**

1. Contratar origem e transporte confiáveis de installation/project/location/session/case/actor/profile, ciclo de vida, revalidação e chegada às portas de domínio; não aceitar identidade declarada pelo modelo.
2. Nomear componente, export/path e writer dentro do ownership; especificar recusa de provider homônimo ou geração substituída.
3. Incluir duas sessões/principais concorrentes, chamada direta, revogação, operação não concedida e provider homônimo; vincular a paridade UI/agente/MCP e os oito packs ao gate canônico T+20.

### FR1-C — P1 — Contratar a adaptação empresarial real do Atlas

**Achados de origem:** T-F03. **Estado:** OPEN. **Responsáveis propostos:** S0/WP00; WP14 transformação e recuperação, WP06 referências, WP10 boundary e persistência.

A tradução das entidades de negócio, o armazenamento protegido, o scanner e o recorte autorizado não possuem divisão de produção/consumo suficiente. Recuperar o ledger SF por conta própria não prova integração Atlas.

**Critérios de fechamento:**

1. Definir BusinessEvidenceRef/resolver, projeção autorizada, mapeamento owner/kind/entry, scanner e falhas, adapter DurableMemory e serialização/atomicidade com o armazenamento SF.
2. Manter ledger do caso como fonte oficial, sem PRs ou identidades fictícios; compatibilizar o trabalho com o invariante de WP14 que não lhe atribui persistência.
3. Exigir consumo instrumentado dos módulos reais, append/read após reinício, dois atores com o mesmo perfil, owner omitido/forjado, revogação, mudança de encarnação e falha de scanner.

### FR1-D — P1 — Resolver validade da confirmação por escopo material

**Achados de origem:** P-F02. **Estado:** OPEN. **Responsáveis propostos:** WP08 e S0/WP00; WP09 no consumidor de cobrança.

WP08.T03 manda invalidar na mudança de versão e, simultaneamente, preservar confirmação de período/campos sem mudança material. A rotina pode cobrar novamente uma revisão ainda válida.

**Critérios de fechamento:**

1. Definir em C06 versão observada versus validade sobre campos, período e dependências materiais, preservando autoria e base originalmente confirmadas.
2. Sincronizar work, DoD, checks e proof-map; provar que mudar janeiro invalida janeiro e mudar somente fevereiro sem dependência conserva janeiro e não gera nova cobrança.

### FR1-E — P1 — Detectar categorias de custo inteiramente omitidas

**Achados de origem:** P-F03. **Estado:** OPEN. **Responsáveis propostos:** WP11 e S0/WP00; WP12, WP13 e WP05 como consumidores.

A soma dos componentes cadastrados pode estar correta sem que migração, treinamento, impostos ou outras categorias pertinentes tenham sido tratadas. Falta condição verificável de cobertura econômica.

**Critérios de fechamento:**

1. Representar categorias pertinentes como incluídas com referência, inaplicáveis com justificativa/evidência ou pendentes; não presumir regras fiscais, custo zero ou custos sem fonte.
2. Consumir a mesma condição de completude na UI, BI, crítica e portfólio; completar AI-RENEWAL e adicionar categoria que não foi sequer cadastrada.
3. Manter comparação condicionada até resolução; distinguir zero informado de omissão e reavaliar a decisão quando um custo posterior inverter o resultado.

### FR1-F — P1 — Eliminar instruções divergentes nos handoffs e gates

**Achados de origem:** E-F02. **Estado:** OPEN. **Responsáveis propostos:** S0/WP00, S1, S2 e S4.

Handoffs de WP03/WP06 ainda esperam WP00.T04, mas DAG/janelas liberam construção por WP00.T02. Também há branches antigas e prazo T+80 residual em WP14.

**Critérios de fechamento:**

1. Usar T02 para congelamento contratual e T04 somente para qualificação nativa real; permitir início determinístico de WP03/WP06 em T+10 mesmo se GNATIVE estiver bloqueado.
2. Unificar branches com ownership e consumo de WP14 em T+75; regenerar todas as representações e eliminar referências antigas conflitantes.

### FR1-G — P2 — Corrigir a exclusão global antiga de extração documental

**Achados de origem:** P-F04. **Estado:** OPEN. **Responsáveis propostos:** WP09 e S0/WP00.

WP09.T04 diz que nova extração documental está fora da campanha, apesar de IA11/WP06 a exigirem.

**Critérios de fechamento:**

1. Explicitar que WP06 fornece a extração e WP09 consome suas evidências pelas portas acordadas; sincronizar Markdown, JSON do WP e campaign.json sem duplicar parser.

### FR1-H — P2 — Precisar seleção e evidência de CI-APP

**Achados de origem:** E-F03. **Estado:** OPEN. **Responsáveis propostos:** S0-C / WP10.T04.

CI-APP usa args vazios e roda a árvore src, mas anuncia suíte Bun completa do app; test-browser exige seleção explícita ou outro gate cumulativo identificado.

**Critérios de fechamento:**

1. Renomear o recorte e acrescentar request package=app, runner=bun, args=[test-browser], ou identificar o gate cumulativo que cobre a árvore.
2. Distinguir as seleções e vincular os recibos ao mesmo candidato; specs Playwright SF não substituem automaticamente a suíte Bun de browser.

## Sequência recomendada para a correção

1. S0 fecha FR1-A/B/C como uma reconciliação coerente de contratos, ownership, consumidores e orçamento. A decomposição deve continuar disjunta, com as cinco famílias de axiomas e sem contar slots adicionais implícitos.
2. Em paralelo, os donos de domínio corrigem FR1-D/E; S0 com S1/S2/S4 corrige FR1-F, e WP09/S0-C fecham FR1-G/H.
3. A integração regenera os artefatos derivados e verifica divergências entre campanha, WPs, contratos, cronograma, prompts e provas. Cada um dos dez achados deve ter referência à mudança e à rechecagem, ainda que compartilhe a mesma correção.
4. Um novo commit fixa o candidato corrigido. A rechecagem do plano ocorre nesse SHA e considera os critérios alterados e seus consumidores; os relatórios desta rodada permanecem históricos e imutáveis.

## O que os pareceres sustentam

A campanha principal preserva cobertura explícita de Dashboard, Planner, Procurement, colaboração, BI, documentos, rotinas e IA, incluindo trabalho antes/durante/depois da decisão. R1 não encontrou fundamento para reduzi-la a acabamento de UI ou à home de André. R2 reconhece controles planejados de valores canônicos, importação, encarnação e recibos por domínio. R3 reconhece a contagem explícita de slots, a distinção entre construir por contrato e consumir produtores reais e a proveniência de CI por SHA. Essas observações não certificam a implementação futura.

Não foi demonstrada impossibilidade de integrar MCP/Atlas nem impossibilidade matemática das duas horas. O problema demonstrado é a falta de algumas decisões normativas e a inconsistência de handoffs. O prazo permanece condicionado à qualificação e à revisão de capacidade; não foi medido.

## Condição de aprovação

**O plano permanece REQUIRES_CHANGES enquanto qualquer frente P1 estiver aberta.** Os dois P2 devem acompanhar a reconciliação para eliminar instruções antigas e evidência ambígua. Aprovar uma revisão futura do plano não constitui aceite de produto nem prova da meta de 120 minutos. A implementação continuará exigindo suas próprias evidências reais no candidato correspondente.

Escopo integral preservado; nenhuma nova solicitação de acesso corporativo ou mudança de deploy foi introduzida. Este commit acrescenta relatórios, consolidação e metadados de status. As especificações canônicas julgadas permanecem inalteradas.

**Fontes:** relatórios R1/R2/R3 acima, com paths, símbolos, contraexemplos, consequências e correções; [protocolo](../PROTOCOL.md); [estado do escopo no snapshot avaliado](https://github.com/gustavomhss/Orchestra-SF/blob/ec9d36da2385007b64a0aa627582ce7e60629a44/modules/sucafina/Sucafinav1/docs/sf2h-plan/SCOPE-STATUS.md); [resumo estruturado](summary.json).
