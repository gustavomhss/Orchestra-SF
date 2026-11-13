# Revisão adversarial formal — produto, rodada 2

**Veredicto: REQUIRES_CHANGES.** Os quatro defeitos originais de produto foram reconciliados no plano. Há **um novo P1**, relativo ao caminho autorizado de sete operações. Não há P0 ou P2 novo registrado.

- **Candidato exato:** `38986380cd7b5697c0be30c1f55d43eddee63045`
- **Branch/repositório:** `sf-product-plan`, `gustavomhss/Orchestra-SF`
- **Baseline:** `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`
- **Revisor:** agente independente `/root/sf_formal2_product`, sem autoria no candidato.
- **implementation_test_status: NOT_RUN**

Todos os caminhos abaixo são relativos a `modules/sucafina/Sucafinav1/docs/sf2h-plan/`, salvo indicação. A cópia congelada foi identificada pelo recibo da integradora, que informa 98 blobs conferidos por Git blob SHA1. Li esse recibo; não reivindico ter repetido a conferência integral dos blobs.

## Método e cobertura

Li primeiro os protocolos geral e da rodada 2, depois o parecer de produto da rodada 1. Examinei a fonte canônica, os contratos C01–C17, as 18 linhas de `resident-ui-consumption.json`, os manifestos e as seis provas residentes, além das tarefas produtoras e consumidoras pertinentes. Não li os pareceres das outras especialidades. Não editei o candidato ou o GitHub, não implementei e não executei testes de produto.

As 28 capacidades da matriz correspondem às 16 entradas Dashboard, sete Planner e cinco Procurement de `src/nav.ts` e ao registro de `index.ts`, consultados diretamente na baseline pelo GitHub MCP. A matriz mantém R01–R41, IA01–IA18 e J01–J13; o inventário fino de comandos/campos e a paridade de execução continuam atribuídos a WP00/WP02–WP04.

A revisão examinou também as bordas que poderiam desaparecer em uma demonstração centrada em André: operação direta sem caso obrigatório, contribuidor e segundo ator, Finance/HR, requester/buyer/approver, acesso menor, teclado, tela estreita, busca/retorno, estado vazio, erro, conflito e rascunho. WP07 exige preservar a base da reunião e exportar o conteúdo completo, incluindo 25 registros e notas longas. Critérios de compreensão e de uso controlado são futuros; o plano não os apresenta como pesquisa, adoção ou economia já medidas.

## Reexame dos achados originais

| Achado | Estado | Fundamento verificável |
| --- | --- | --- |
| **P-F01 — adendo sem decomposição canônica suficiente** | **CLOSED** | C15–C17, RA01–RA06, manifesto 5/18/8, matriz completa de consumo e AM01–AM06 foram integrados. WP01.T05.CHK.30/31 e WP12.T02.CHK.11 exigem witness de carga/saída persistida/ação após reload para cada skill. C11/WP12.T03 exigem Revisor em nova execução; C17/WP10.T07/WP14.T02/T05 exigem Atlas real e recuperação após reinício. O defeito original de ausência de decomposição está fechado; o novo conflito interno das concessões é registrado separadamente em P-R2-01. |
| **P-F02 — invalidação por versão global** | **CLOSED** | C06, linhas 147–159, separa registro imutável, versão observada, fingerprint de escopo, projeção atual e expectedStorageVersion. Preserva CAS/locks, exige releitura/revalidação após conflito e não presume transação global. WP08.T03/T04, WP09.T02/T03, CONFIRM-SCOPE e proof-map concordam: fevereiro independente não recobra janeiro; alteração material/dependência gera uma pendência; revogação/substituição têm tratamento próprio. |
| **P-F03 — categoria de custo inteiramente omitida** | **CLOSED** | C10 usa inventário versionado independente das linhas e deriva missing-category. included/not-applicable exigem suporte; soma usa a identidade do componente uma vez; zero não equivale a ausência. WP11.T02.CHK.20/21, WP05.T05, WP12.T03, WP13.T02/T03 e WP14.T01 consomem a mesma cobertura. O fixture omitido usa cotação que exclui treinamento, mantém subtotal 210000/total null/conditioned e, após 40000, exige 250000, diferença -10000 e limiar 15000, preservando a escolha histórica. São oráculos sintéticos planejados. |
| **P-F04 — exclusão global da extração documental** | **CLOSED** | WP06.T05 fornece PDF digital/DOCX/texto; WP09.T04 consome C14 sem parser ou confirmação paralelos. JSON, Markdown, campaign, C14 e J11 preservam essa fronteira. Os checks cruzados .CHK.20 exigem a mesma evidenceRef antes/depois da confirmação e propagação de atualização/revogação ao dossiê. **Disposição do P2: corrigido.** |

### O que mudou materialmente nas provas de produto

A confirmação agora distingue o que a pessoa efetivamente viu da validade atual daquele escopo. A mudança irrelevante não cria nova revisão humana; dependências materiais, acesso e encarnação são reavaliados. O contrato distingue a versão da fonte da revisão de armazenamento, inclusive quando elas coincidem no exemplo v7/v8.

A cobertura de custos também deixou de depender de alguém cadastrar uma linha vazia: uma categoria esperada e ausente gera pendência derivada. O mesmo estado chega à mesa, ao gráfico/tabela, ao crítico e ao portfólio. A parcela de implantação pode cobrir migração e treinamento sem ser somada de novo. A variante de treinamento adicional usa outra cotação, evitando uma contraprova baseada em dupla contagem.

As skills têm entradas de trabalho e consumidores específicos. Finance explica composição e limites; Compras confronta condições e evidências; Portfólio trata compromissos e dependências. A revisão independente exige execução própria, e os resultados precisam continuar utilizáveis depois de recarregar. Catálogo, chat ou consumerRef nunca aberto não fecham o aceite.

## Novo achado P-R2-01 — P1

### Sete operações publicadas não têm caminho de concessão compatível com C16

**Requisitos atingidos:** RA03, AM02/AM06, WP00.T02.CHK.10, WP09.T01.CHK.18 e C15/C16. **Bloqueia execução integral: sim. Confiança: alta (0,93).**

**Localização:**

- `campaign.json`: `resident_ui_consumption.common.allowlist_source` (linha 22945); `resident_ai.skills[].allowed_operations`; `resident_ai.mcp_packs[].operations`.
- `contracts.json`: C16, linhas 543–566 e 608.
- `specs/resident-runtime.md`: sequência normativa e interseção da lease, linhas 21–31.
- `agents-atlas-mcp.json`: AM02.skills e positive_checks, linhas 3364–3378.
- `resident-proof-plan.json`: AM02.pack_matrix e AM06.checks.
- `AGENTS-ATLAS-MCP.md`: linha 102.

### Evidência e reprodução

A fonte canônica define `resident_ai.skills[].allowed_operations` como a allowlist normativa. O ingresso exige uma skill carregada, e a especificação define a autoridade da lease como a **interseção** de principal, instalação/projeto/location, sessão/caso, perfil/skill, operação e regra do domínio. C16 exige SkillLoadReceipt válido.

Esta consulta de inspeção documental, executada sobre o candidato, mostra as operações dos packs que não pertencem a nenhuma allowlist de skill:

```sh
jq '[.resident_ai.mcp_packs[].operations[].id] -
    [.resident_ai.skills[].allowed_operations[]] | unique' campaign.json
```

| Pack | Operações sem concessão em qualquer skill |
| --- | --- |
| Performance | `sf_dashboard_read` |
| Documents & Reports | `sf_import_preview` |
| Routines | `sf_routine_catalog`, `sf_routine_prepare`, `sf_routine_run`, `sf_routine_status`, `sf_routine_result` |

As sete têm produtores e concessões em perfis. Isso não basta para a interseção exigida. Entre as seis operações do pack Routines, somente `sf_watch_prepare` aparece em uma allowlist de skill.

WP09.T01.CHK.18 exige execução das cinco operações de rotina por UI/native/MCP. AM02 exige chamada permitida de cada operação com base, autoridade e handler correspondentes. O contrato da prova C16 refere as 39 operações.

**Defesa examinada:** AGENTS-ATLAS-MCP.md:102 diz que AM02 também testa chamadas diretas e não exige skill artificial; AM02.skills está vazio. Isso é uma descrição da estratégia de prova. Ela não define ingresso ou modalidade de autoridade alternativos à sequência e à interseção de C16. Uma chamada direta continua precisando de concessão efetiva. Não se exige criar uma décima nona skill; exige-se reconciliar os caminhos já prometidos.

### Contraexemplo

Uma pessoa autorizada solicita uma rotina válida, publicada e já admitida em C07. O host cria o binding `sf_maestro`, lê o caso real e carrega qualquer uma das sete skills permitidas desse perfil. O perfil concede `sf_routine_catalog` e `sf_routine_run`; nenhuma skill as concede. Aplicar literalmente C16 recusa a chamada antes do handler. Trocar ou combinar as 18 skills não muda isso.

Uma prova que produza o resultado positivo ignorando a skill usaria uma exceção de autoridade não definida no contrato. O mesmo problema ocorre com as outras cinco operações.

### Consequência

O executor precisa escolher entre preservar a fronteira e deixar escopo obrigatório sem execução positiva, ou inventar uma exceção para fechar a paridade. Isso impede considerar o planejamento integral pronto. **Não é uma alegação de vulnerabilidade ou falha medida em produto implementado.**

### Correção verificável

1. Reconciliar na fonte canônica o caminho autorizado de cada operação. Vincular as operações a workflows pertinentes das skills existentes e sincronizar allowlists, inputs, saídas, consumidores e provas, preservando as 18 skills e os 39 handlers.
2. Preservar o limite do principal e a admissão C07. Não conceder operações indiscriminadamente nem tratar o teste direto como bypass. Se houver uma modalidade de controle fora de skills, seu ingresso autenticado, autoridade, limites e relação com C16 precisam ser explícitos.
3. Conferir, no plano, ao menos um caminho de concessão efetivo por operação e a recusa fora dele. Regenerar os espelhos e atualizar AM02/AM06.
4. Exigir na implementação futura recibos positivos e negativos das sete operações no caminho real. A correção do plano não pode marcar essas provas como executadas.

**Dono sugerido:** WP00.T02 e WP12.T01/T02, com WP10.T06 e WP09.T01; WP02.T01/WP06.T02 para seus consumidores.

## Limites do parecer

O JSON acompanhante contém os caminhos examinados e o registro estruturado completo. A paridade fina do legado, a compilação e as APIs de runtime, os efeitos reais de autorização, Atlas/RAG/Relay, o produto visual e a duração do trabalho ainda precisam das provas futuras e das revisões correspondentes.

A intenção de corrigir posteriormente não muda este veredicto no SHA congelado. Após correção, é necessário um novo candidato e rechecagem da área afetada. **implementation_test_status permanece NOT_RUN.**

