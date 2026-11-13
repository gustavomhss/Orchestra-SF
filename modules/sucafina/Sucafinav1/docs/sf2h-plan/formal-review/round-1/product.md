# R1 — revisão formal de produto, UX e completude

**Commit avaliado:** `ec9d36da2385007b64a0aa627582ce7e60629a44`

**Veredicto: REQUIRES_CHANGES.** Foram identificados **0 P0, 3 P1 e 1 P2**. Os três P1 precisam ser reconciliados antes de considerar o plano pronto para execução integral. O parecer não afirma que a implementação falhou; ela não foi executada nesta revisão.

## Avaliação do conjunto

A campanha principal tem cobertura explícita de 28 capacidades, 41 requisitos, 18 capacidades de IA, 13 jornadas e 11 perguntas de BI, distribuídas em 15 WPs e 71 tasks. O catálogo de 16/7/5 entradas coincide com `src/nav.ts` da baseline. A preservação de comandos e campos tem dono e aceite em WP00.T01 e nos WPs de domínio; não depende apenas da contagem de páginas. Referências: `coverage.json`; `work-packages/WP00.json`, WP00.T01; baseline `index.ts` e `src/nav.ts`.

O plano também exige valor novo além de acabamento: caso persistente, fonte e contradição verificáveis, proposta tipada, reformulação após resposta humana, mudanças por domínio, reavaliação material, portfólio e memória. Teclado, edição em lote, operação direta sem caso obrigatório, colaboração e uso por Finance/HR/requester/buyer/approver estão contemplados. Reunião, fechamento, exportação, aplicação parcial e retomada têm obrigações concretas. Não há fundamento nesta amostra para alegar que o plano se resume à home de André ou a uma renovação. Referências: `campaign.json`, axiomas CMP.03/CMP.06; `coverage.json`, J01–J13; WP01.T05, WP03.T02, WP07.T02/T04, WP08.T06, WP11–WP14.

Os bloqueios abaixo são de coerência e de suficiência do contrato de aceite. O mais abrangente é a ausência da decomposição canônica do adendo, reconhecida pelo próprio `SCOPE-STATUS.md`.

## Achados

### P-F01 — P1 — Adendo ainda não convertido em entregas e provas rastreáveis

**Requisito.** O adendo deve entregar cinco perfis residentes, dezoito skills efetivamente carregadas, oito packs MCP e Atlas SF integrado, com saídas consumidas e cinco famílias de axiomas no plano executável; CAMP.CMP.05 e AGENTS-ATLAS-MCP.md, DoD/Completeness.

**Localização.**

- `modules/sucafina/Sucafinav1/docs/sf2h-plan/AGENTS-ATLAS-MCP.md:50; Experiência de uso; Encaixe na campanha existente; Axiomas desta camada; Seis provas integradas`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/coverage.json: ai_capabilities, journeys`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP12.json: scope_in; tasks WP12.T01–T04`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP01.json: WP01.T05`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json: C08, C11, C13`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/evidence-plan.json: packages E10–E15`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/proof-map.json: entries`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/SCOPE-STATUS.md: Limite da validação anterior`

**Evidência.**

- O adendo exige que cada skill tenha versão/digest, entradas, ferramentas, saída, limites, casos de aceite/recusa e prova de carregamento e uso (linha 50). Seu DoD exige as dezoito saídas consumidas, os cinco perfis, MCP e Atlas reais (linha 199).
- O encaixe atribui ao WP12 cinco perfis, roteamento, dezoito skills e revisão independente (linha 185), mas WP12.T01 continua oferecendo um catálogo genérico de read context/draft analysis/simulate/check/prepare questions/prepare changes; T02–T04 verificam uma análise, crítica e lifecycle genéricos.
- A matriz canônica conserva somente IA01–IA18 e J01–J13. Busca literal em campaign.json, contracts.json, work-packages, coverage.json, evidence-plan.json, proof-map.json, axiom-index.json e prompts não encontra sf_maestro/sf_finance/sf_procurement/sf_portfolio/sf_reviewer, sucafina-workbench, BusinessEvidenceRef ou BusinessContextService.
- C11 define AnalysisRequest/AnalysisResult e estados, mas não vincula cada missão/skill ao objeto persistente e ao consumidor de UI. E11 exige IA real em variante não roteirizada, sem discriminar as dezoito skills ou os cinco perfis. Os seis testes do adendo ainda não possuem IDs/mapeamento nos pacotes canônicos.
- SCOPE-STATUS.md reconhece expressamente que a validação anterior não comprova incorporação do adendo. O achado confirma uma lacuna declarada do checkpoint; não acusa falsa implementação nem ignora a leitura obrigatória do adendo.

**Cenário que refuta.** Uma execução entrega o fluxo genérico de WP12: encontra março versus maio, gera AlternativeDraft, critica custo de sobreposição, reformula após resposta e mostra tudo na mesa. Também registra cinco nomes e dezoito arquivos de skills. Os recibos de IA01–IA18/J09–J13 podem demonstrar esses comportamentos, mas sf-revisar-condicoes-contratuais e sf-revisar-evidencias nunca são invocadas, a crítica usa o mesmo perfil genérico, e um CaseRecall próprio substitui o consumo Atlas. Isso satisfaz os cenários canônicos citados sem demonstrar o resultado adicional contratado. O adendo impediria o aceite global se revisado manualmente, mas a campanha não oferece unidades de execução e rastreabilidade que permitam fechar essa divergência de forma verificável.

**Impacto.** A implementação integral não tem decomposição canônica suficiente para os novos resultados de produto. Contagens e arquivos podem ser confundidos com cobertura, e a interface pode continuar oferecendo uma única análise genérica apesar da promessa de contribuição especializada e memória integrada.

**Mudança verificável.**

1. Reconciliar o adendo em campaign.json, WPs, contratos, coverage e proof-map antes de liberar execução integral. Dar IDs rastreáveis às obrigações novas e associar as cinco famílias de axiomas às unidades responsáveis.
2. Para cada uma das dezoito skills, explicitar: entrada por trabalho na UI/rotina, perfil e versão/digest carregados, operação autorizada, saída tipada persistente, consumidor real, estado de falta/falha/stale e evidência de consumo. Provas compartilhadas podem cobrir várias skills; não é necessário um teste isolado por frase.
3. Acrescentar cenários que diferenciem Finance, Compras, Portfólio e Revisor, incluindo revisão em execução própria, e provar que seus objetos são usados por pessoas sem reconstrução no chat. Integrar as seis provas do adendo ao gate final, incluindo paridade UI/agente/MCP e recuperação real Atlas.
4. O fechamento deve falhar de modo explícito quando uma skill estiver apenas catalogada, quando um perfil não tiver contribuído em cenário pertinente ou quando a memória não consumir os componentes Atlas acordados.

**Dono sugerido:** S0/WP00, com WP12 e WP01; WP10, WP06, WP09 e WP14 fornecem os respectivos contratos e provas.

**Bloqueia prontidão para execução integral:** sim. **Confiança:** 99%.

### P-F02 — P1 — Confirmação por versão conflita com validade por escopo material

**Requisito.** R31, R35, sf2h-integral-20261112.SUC.08 e WP08.T03.INV.03: confirmação humana vale para referência/campos/período pertinentes; alteração irrelevante não deve reiniciar cobrança.

**Localização.**

- `modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP08.md:194, 203, 209, 228`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP08.json: WP08.T03.work; WP08.T03.DOD.02; WP08.T03.INV.03; WP08.T03.CHK.01`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json: C06.content`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP09.md:208 / WP09.T02.CHK.02`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/proof-map.json: WP08.T03.DOD.02, WP08.T03.INV.03, WP08.T03.CHK.01`

**Evidência.**

- O trabalho de WP08.T03 manda mostrar como vencida a confirmação cuja origem recebeu versão nova; DOD.02 diz que a projeção perde validade quando a versão correspondente muda.
- CHK.01 exige: confirmar versão 7, atualizar a origem para versão 8 e vencer a confirmação, sem condicionar o resultado aos campos ou período alterados.
- INV.03, na mesma task, exige que uma edição de fevereiro não invalide automaticamente a confirmação de janeiro sem dependência material. C06 resume confirmações por versão, sem resolver a distinção entre versão da entidade e validade do escopo confirmado.
- proof-map.json reproduz ambas as exigências; WP09.T02.CHK.02 transforma confirmação vencida em nova cobrança de revisão.

**Cenário que refuta.** Um responsável confirma os valores de janeiro na versão 7. Outro usuário corrige somente fevereiro, produzindo versão 8 do registro, sem alterar campo ou cálculo que sustente janeiro. O trabalho/CHK.01 manda vencer a confirmação e a rotina volta a cobrar janeiro; INV.03 manda conservá-la válida. Se o executor usar versões por período para evitar o problema, o contrato e o check precisam dizer isso; o checkpoint não fixa essa semântica.

**Impacto.** Dois executores podem implementar comportamentos opostos e justificar ambos com critérios locais. A opção por invalidação ampla recria cobranças e retrabalho justamente no fluxo que deve reutilizar a contribuição uma vez.

**Mudança verificável.**

1. Definir em C06 a diferença entre versão observada e condição de validade sobre campos/período/dependências materiais. Conservar autoria e versão originalmente confirmadas sem afirmar que a pessoa revisou alterações fora desse escopo.
2. Reescrever work, DoD e CHK.01 de WP08.T03 para vencer apenas quando o escopo confirmado foi materialmente alterado, removido, substituído ou ficou inacessível, conforme a política acordada.
3. Exigir duas contraprovas em E09 e na rotina de revisão: editar janeiro invalida a confirmação de janeiro; editar apenas fevereiro sem dependência mantém janeiro válido e não gera nova cobrança. Atualizar as cópias canônicas e proof-map.

**Dono sugerido:** WP08 com WP00 para C06; WP09 verifica o consumidor de cobrança.

**Bloqueia prontidão para execução integral:** sim. **Confiança:** 97%.

### P-F03 — P1 — Categoria de custo omitida não tem contrato de cobertura verificável

**Requisito.** sources/AI-PRODUCT-VISION.md, composição completa das alternativas; IA03/IA04; sf2h-integral-20261112.INV.09: informação desconhecida não equivale a custo zero ou benefício confirmado.

**Localização.**

- `modules/sucafina/Sucafinav1/docs/sf2h-plan/sources/AI-PRODUCT-VISION.md:40`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json: C09.content, C10.content, C14.content`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/campaign.json: numeric_oracles[AI-RENEWAL]`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP11.md:116, 145, 147 / WP11.T02`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP12.md:194 / WP12.T03.CHK.01`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP13.json: WP13.T02`

**Evidência.**

- A visão aceita exige que saída contratual, sobreposição, migração, impostos, treinamento e custos internos relevantes estejam incluídos, demonstravelmente inaplicáveis ou pendentes; um total incompleto não pode parecer proposta equivalente plenamente validada.
- C10 pede componentes, total, origem, lacunas e restrições, e WP11.T02 marca os componentes existentes como confirmado/estimado/hipotético/ausente. Não há inventário obrigatório de categorias/aplicabilidade que faça uma categoria omitida aparecer como lacuna.
- O oráculo AI-RENEWAL contém renovação 240 mil e três componentes 60/45/105 mil, com benefício 30 mil e teto 55 mil. Não declara as demais categorias incluídas, inaplicáveis ou pendentes.
- WP11.T02.CHK.03 cobre um custo de saída já conhecido como desconhecido, e WP12.T03.CHK.01 cobre operação paralela omitida. Essas contraprovas não exigem detectar uma categoria relevante inteiramente ausente do conjunto de componentes.

**Cenário que refuta.** Em variante sintética, os três componentes 60/45/105 mil estão confirmados e o custo de saída está explicitamente inaplicável. Migração, treinamento e impostos não possuem linha nem declaração de aplicabilidade. A soma 210 mil, a vantagem 30 mil e o limiar 55 mil passam nos oráculos numéricos; nenhuma regra tipada descrita exige uma pendência para as categorias omitidas. Uma confirmação posterior de treinamento de 40 mil elevaria o total a 250 mil e inverteria a comparação. O problema não é a soma: é não haver condição verificável que impeça apresentar a comparação como financeiramente completa antes de resolver essas omissões.

**Impacto.** A UI pode apresentar uma diferença matematicamente reconciliada, mas com cobertura econômica desconhecida. Isso reduz a crítica a encontrar os exemplos previstos e deixa o valor central da decisão vulnerável a omissões não representadas.

**Mudança verificável.**

1. Acrescentar ao contrato de alternativa uma avaliação explícita da cobertura de custos pertinente ao tipo de decisão: incluído com referência ao componente, inaplicável com justificativa/evidência ou pendente. Não criar valores fiscais, regras financeiras ou custos presumidos.
2. Vincular o estado de comparação completa/condicionada e a comunicação do benefício a essa cobertura, com o mesmo estado consumido por UI, BI, crítica e portfólio.
3. Completar o fixture AI-RENEWAL com declarações das categorias remanescentes e acrescentar um caso em que uma categoria não foi sequer cadastrada. O resultado deve permanecer condicionado até confirmação ou inaplicabilidade explícita; custo zero informado deve continuar distinguível de omissão.
4. Provar que a confirmação de um custo relevante posterior atualiza total/critério e reavalia a escolha preservando sua base original.

**Dono sugerido:** WP11 e WP00; WP12, WP13 e WP05 consomem a mesma condição de cobertura.

**Bloqueia prontidão para execução integral:** sim. **Confiança:** 88%.

### P-F04 — P2 — Dossiê ainda contém exclusão global antiga de extração documental

**Requisito.** Escopo integral de IA11/J11 e precedência explícita entre campanha e WPs; extração documental pertence a WP06.

**Localização.**

- `modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP09.md:279 / WP09.T04.work`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP09.json: WP09.T04.work[2]`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/campaign.json: work_packages[WP09].tasks[WP09.T04].work[2]`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP06.md:42, 330 / WP06.DOD.04 e WP06.T05.DOD.01`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/coverage.json: IA11, J11`

**Evidência.**

- WP09.T04 ainda afirma literalmente: Nova extração de documentos não faz parte desta campanha.
- WP06.DOD.04, WP06.T05 e IA11/J11 tornam extração de PDF digital, DOCX e texto parte obrigatória da mesma campanha.
- O restante de WP09.T04 restringe sua implementação a consumir evidências já disponibilizadas pelas portas. Essa divisão de responsabilidade é compatível com WP06; a exclusão global escrita não é.

**Cenário que refuta.** O builder do dossiê lê sua task e documenta que extração é fora da campanha; o builder de documentos entrega a extração obrigatória. O integrador precisa escolher uma interpretação apesar da regra de não resolver divergências silenciosamente. As cláusulas superiores deixam claro que a extração deve existir, por isso esta redação isolada não foi tratada como bloqueio autônomo.

**Impacto.** Instrução antiga enfraquece clareza de escopo e pode gerar documentação ou handoff incorretos no fluxo de compras.

**Mudança verificável.**

1. Trocar a exclusão global por fronteira local explícita: WP09 não implementa extração, que é fornecida por WP06 e pode ser consumida pelas portas acordadas.
2. Sincronizar a redação em Markdown, JSON do WP e campaign.json; indicar a fonte/contrato de evidência confirmado pertinente ao dossiê, sem duplicar parser ou ampliar escopo indevidamente.

**Dono sugerido:** WP09 e S0/WP00.

**Bloqueia prontidão para execução integral:** não. **Confiança:** 100%.

## Limites e independência

- Esta é uma revisão do plano congelado. Nenhuma implementação de produto, inferência, UI, Relay, MCP, Atlas ou CI foi executada; testes de produto não foram rodados localmente.
- O catálogo de 28 entradas foi conferido diretamente em src/nav.ts/index.ts da baseline por GitHub MCP. A paridade de todos os comandos/campos do código inteiro continua a depender do inventário e das provas explicitamente atribuídos a WP00.T01 e aos WPs de domínio; esta revisão não certifica toda a implementação legada.
- A viabilidade técnica do binding MCP/AgentV2/Atlas e o orçamento de execução pertencem às outras especialidades. O achado P-F01 é de rastreabilidade de produto/aceite; não presume indisponibilidade desses componentes.
- P-F03 trata da especificação verificável de cobertura econômica, não da correção dos totais fornecidos nem de um bug já observado. O plano contém salvaguardas gerais contra dados ausentes, mas não explicita como categorias inteiramente omitidas entram nessa condição.
- Não foram consultados pareceres históricos, arquivos verified-* ou resultados de outros revisores. A identidade da cópia congelada com o commit foi fornecida pela integradora após sua conferência dos blobs.

**implementation_test_status: NOT_RUN**

O JSON acompanhante contém a lista completa de caminhos examinados e os mesmos quatro achados estruturados. Não foram alterados arquivos do plano nem o GitHub.
