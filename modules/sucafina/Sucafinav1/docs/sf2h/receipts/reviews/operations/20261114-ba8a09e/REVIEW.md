# Revisão independente complementar de Operações — PR #34

**Veredicto desta contribuição: REQUEST_CHANGES.** Quatro defeitos demonstrados por leitura estática — **um P1 e três P2** — e o refinamento da lacuna existente **E-OPS-02 / NEEDS_EVIDENCE**. Não há aceite integral de WP04, WP06 ou do candidato integrado. Os cenários novos não foram executados; a demonstração é a cadeia de código no SHA fixado, distinta dos resultados já observados no GitHub Actions.

## Identidade e escopo

| Referência | Valor |
|---|---|
| PR de produto | [#34 — astra-operations](https://github.com/gustavomhss/Orchestra-SF/pull/34) |
| SHA revisado | `ba8a09e371ce8d93eb917eabb102caaee5affaf4` |
| Tree revisada | `eb427121bcfd8c2511aac31d908f3c0d52c1915e` |
| Produto W5 preservado no pin | `c4a2f4ebeb88f5915e51569b921be06b3c37ddad` |
| Fonte normativa imutável | [sf2h-plan @ dbf9547211d9b0fade619790de7c19c0869b7c7d](https://github.com/gustavomhss/Orchestra-SF/tree/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan) |
| Handoffs/packs consultados | `a3d29d011ba3607a57914701300f09117a3e2de9` |
| Branch documental / destino | `review-operations → sf2-control` |
| Base documental inicial | `d3d411f7e2476a562a57aa7620823980eaf34e46` |
| Parent preservado desta contribuição | `6830fa159d30b60d001f91a47326ae88c6255282` |
| Data | 2026-11-14 |

O head de #34 foi reconferido e permaneceu igual ao SHA pedido. W5 → pin contém dois commits e **65 arquivos adicionados**, todos MD/JSON nos recibos WP04/WP06; nenhum arquivo preexistente de W5 mudou nesse compare. A preservação do produto torna explícito a que árvore pertencem as observações W5; não qualifica por si só o envelope global C/D. [Compare independente W5 → D2](https://github.com/gustavomhss/Orchestra-SF/compare/c4a2f4ebeb88f5915e51569b921be06b3c37ddad...ba8a09e371ce8d93eb917eabb102caaee5affaf4).

A escrita deste parecer é exclusivamente documental no diretório autorizado. A branch de controle não é um novo candidato de produto nem base de CI. Nenhuma PR existente foi fechada; nenhum produto, plano, segredo, branch alheia, política financeira ou engine foi alterado. Não houve testes locais, dispatch/retry de CI, merge, deploy ou mensagens a autores.

## Reconciliação da publicação concorrente

Antes da escrita, a branch documental avançou de `d3d411f7e2476a562a57aa7620823980eaf34e46` para `6830fa159d30b60d001f91a47326ae88c6255282` e a [PR #49](https://github.com/gustavomhss/Orchestra-SF/pull/49) já existia. Foram lidos e preservados os três arquivos anteriores. Esta contribuição acrescenta somente o subdiretório `20261114-ba8a09e/`; não fecha nem substitui a PR.

Os quatro findings OPS-REV-01–04 são adicionais aos achados do [parecer anterior](https://github.com/gustavomhss/Orchestra-SF/blob/6830fa159d30b60d001f91a47326ae88c6255282/modules/sucafina/Sucafinav1/docs/sf2h/receipts/reviews/operations/REVIEW.md). A lacuna de imports após restart já constava como **E-OPS-02**: seu ID foi reutilizado, com diagnóstico e vínculos mais precisos, sem contá-la como finding novo. D-OPS-01, I-OPS-02, E-OPS-01 e E-OPS-03 anteriores permanecem abertos em sua classificação original; não foram encerrados nem revalidados automaticamente.

A avaliação financeira agora inclui o contraexemplo OPS-REV-01, ausente da amostra anterior: H01 injeta sourcing e não percorre o produtor que cria a PO antecipada. Assim, o crédito daquele teste e a antiga declaração de ausência de P1 não constituem aceite da base monetária neste cenário. Os sete hashes de logs relatados pela publicação anterior não são apresentados como recalculados por esta contribuição.

## Método e classificação

A revisão foi dividida em três faixas independentes: WP04/consumidores, WP06/consumidores e auditoria de CI, com consolidação e corroboração dos caminhos críticos. Todas as consultas remotas ocorreram por GitHub MCP. Relatos de entrega serviram como índice de alegações; os findings se apoiam em código no pin e a auditoria consulta API, jobs, logs, commits e compares oficiais.

- **STATIC_DEFECT:** o caminho de código inspecionado, no cenário delimitado, contradiz a obrigação afetada. A falta de nova execução é explícita; não se afirma que o revisor observou a falha em runtime.
- **Inferência:** consequência plausível separada do fato diretamente demonstrado, como recobrança C06 ou canal de cardinalidade.
- **NEEDS_EVIDENCE:** o material auditado não executa suficientemente a fronteira exigida. Isso não autoriza inventar falha de produto.
- **Observação positiva de componente:** conserva SHA, snapshot, seleção e limites. Nenhum green parcial foi convertido em aprovação integral.

Os 402 paths da PR foram inventariados. A leitura de diffs e consumidores foi dirigida a autorização/revogação, continuidade de fonte, base financeira e políticas, importação/preview/Apply/recibo, documentos/dossiê e persistência/retry. Não se reivindica leitura linha a linha de todos os 402 arquivos nem revisão completa de cada runtime/teste.

## Cobertura normativa

Foram lidos AGENTS aplicáveis, COMMON, WP04 e WP06 completos, suas dez tasks, contratos pertinentes, handoffs e anexos obrigatórios. O pack WP04 exige `product-acceptance.md` e `resident-runtime.md`; WP06 também exige `atlas-packaging.md`. Os três anexos foram lidos no SHA normativo. START e WORKFLOW foram consultados. Leitura do anexo Atlas não concede prova de build/scanner/empacotamento.

| WP | Axiomas do WP | T01 | T02 | T03 | T04 | T05 | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| WP04 | 20 | 20 | 14 | 21 | 15 | 21 | **111** |
| WP06 | 27 | 16 | 28 | 24 | 18 | 27 | **140** |
| Total | | | | | | | **251** |

A comparação de IDs e textos entre os JSONs normativos e os mapas do autor encontrou **zero omissões, zero extras e zero diferenças literais**. [criteria.json](criteria.json) conserva cada ID/texto, o contexto integral das tasks, alegações de evidência do autor e disposição independente separada. Também conserva os 50 axiomas superiores extraídos de COMMON. Comparação de estrutura e texto não é teste de produto.

A disposição independente é: **7 critérios diretamente associados a defeitos estáticos**, **5 relacionados a findings**, **24 NEEDS_EVIDENCE** e **215 não integralmente adjudicados por esta revisão dirigida**. Nenhum dos 251 recebeu aceite integral. Os 24 incluem as 23 obrigações conhecidas — dez nativas/quatro humanas WP04 e sete históricas/duas AM WP06 — e a lacuna específica E-OPS-02. A associação de um finding a um critério amplo não declara violadas todas as suas cláusulas.

A cobertura histórica WP04 `97 PASS_SCOPED / 10 BLOCKED_NATIVE / 4 NOT_RUN_HUMAN` foi preservada como relato do autor. O mapa de entrada WP06 preserva `131 COMPONENT_EVIDENCED_ON_PR26_INPUT / 7 PARTIAL_HISTORICAL_CLAUSE / 2 PARTIAL_EXPLICIT_AM_CLAUSE`. As observações posteriores W5 permanecem nos vínculos de cada linha; nenhuma contagem é uma aceitação.

## Findings

| ID | Prioridade | Classificação | Resultado |
|---|---|---|---|
| OPS-REV-01 | P1 | STATIC_DEFECT | Proposta de PO mascara o snapshot da aprovação de sourcing |
| OPS-REV-02 | P2 | STATIC_DEFECT | C12 registra applied para uma substituição ignorada pelo domínio |
| OPS-REV-03 | P2 | STATIC_DEFECT | Limite documental antes de autorização e deduplicação oculta fontes autorizadas |
| OPS-REV-04 | P2 | STATIC_DEFECT | Interrupção entre blob e catálogo impede retry idêntico de admissão |
| E-OPS-02 | P2 | NEEDS_EVIDENCE | Recuperação do Apply após restart não é demonstrada pelo teste de reopen citado |

## OPS-REV-01 — P1 — Proposta de PO mascara o snapshot da aprovação de sourcing

**Classificação:** defeito demonstrado por leitura estática do caminho delimitado. **Execução discriminante pela revisão:** não realizada. **Owner:** WP04 / Operações; WP10 para composição e consumidores.

**Arquivo/linha principal:** [product/procurement/monetary.ts:18–42](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/procurement/monetary.ts#L18-L42).

**Proveniência no delta:** monetary.ts é novo na PR #34; defeito demonstrado na composição do helper com o produtor real no SHA fixado.

### Cenário reproduzível

- Pedido levado legalmente a sourcing; buyer autorizado; campos e proposta válidos; etapa de aprovação pendente.
- Moeda base USD; proposta EUR 100, qty=1, unitPrice=100; FX EUR=1.08.

1. Executar select_quote e submit_sourcing pelos comandos reais.
2. Observar src_pending, sourcing.approval.amount=108, fxSnapshot EUR=1.08 e approvalBaseCurrency=USD. O mesmo fluxo já criou po.lines, fxRate=null e approval=null.
3. Alterar legitimamente a taxa configurada EUR para 2, sem modificar o pedido ou snapshot submetido.
4. Ler C02 e os campos de confirmação C06; comparar com compareSourcing.

### Evidência e consequência

- monetary.ts escolhe order=true só porque existem po.lines; a PO ainda não submetida determina frozen=false.
- requestValue usa primeiro po.lines e FX atual: baseAmount=200 USD, fxSource=current e submittedAmount=null; monetaryState permanece pending-approval e moneyEvidence=confirmed.
- A comparação de sourcing continua em 108 USD pelo snapshot; o snapshot persistido de aprovação não foi alterado.

Valores incompatíveis entre detalhe/C02/C06 e comparação para a mesma decisão pendente. A dependência incorreta de FX corrente pode invalidar uma confirmação sem mudança da base submetida.

**Inferência delimitada:** A recobrança/reconfirmação por consumidores C06 é consequência possível do fingerprint errado; não foi executada pela revisão.

**Limites da conclusão:**

- Alteração de alçadas, scoring, valor de aprovação persistido ou pagamento real.
- Execução discriminante pelos revisores.

**Cadeia de código e consumidores reais:**

- [src/procurement-screen.ts:104–128](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/src/procurement-screen.ts#L104-L128)
- [modules/sucafina/porta/act.ts:300–318](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/porta/act.ts#L300-L318)
- [modules/sucafina/porta/act.ts:348–361](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/porta/act.ts#L348-L361)
- [runtime/procurement.ts:638–647](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/runtime/procurement.ts#L638-L647)
- [product/procurement/port.ts:101–145](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/procurement/port.ts#L101-L145)
- [product/procurement/port.ts:263–278](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/procurement/port.ts#L263-L278)
- [product/procurement/confirmation-fields.ts:25–36](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/procurement/confirmation-fields.ts#L25-L36)

### Critério afetado

- **WP04.T03.CHK.03** — Mudar a taxa configurada depois da submissão: a decisão pendente preserva o valor/câmbio congelado; remover FX de uma comparação sem snapshot produz indisponibilidade/pendência, nunca total zero.
- **WP04.T03.DOD.02** — Moeda, taxa/snapshot e estado monetário ficam definidos para cada valor exibido.
- **WP04.T03.SUC.02** — O mesmo valor de domínio aparece coerentemente no detalhe, resumo e C02 entregue a consumidores.

Critérios/contratos relacionados, sem presumir violação de todas as suas cláusulas: `WP04.INV.02`, `WP04.CMP.02`, `WP04.T03.CMP.01`, `WP04.T04.QLT.02`, `CAMP.INV.01`, `CAMP.INV.03`, `CAMP.QLT.04`, `CAMP.QLT.20`, `C02`, `C06`. Textos superiores e contratos pertinentes estão em [criteria.json](criteria.json), vinculados à fonte normativa imutável.

### Prova existente e seu limite

- [test/product/wp04/money.test.ts:19–23](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts#L19-L23): Sourcing congelado montado sem a PO que select_quote cria.
- [test/product/wp04/finance-material.test.ts:72–78](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/test/product/wp04/finance-material.test.ts#L72-L78): Também monta sourcing sem PO.
- [test/product/wp04/host-integration.test.ts:79–89](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/test/product/wp04/host-integration.test.ts#L79-L89): H01 injeta sourcing, sem percorrer select_quote → submit_sourcing.

### Correção e evidência esperadas

Escolher a base monetária pela etapa efetivamente em decisão, separando a proposta futura de PO da aprovação de sourcing. Preservar alçadas, scoring e snapshots existentes.

Percorrer os comandos reais que criam a PO; mudar FX após submit_sourcing; verificar C02, resumo, C06 e comparação com o mesmo registro e snapshot. Incluir FX ausente e moeda base alterada sem preencher ausência com zero.

---

## OPS-REV-02 — P2 — C12 registra applied para uma substituição ignorada pelo domínio

**Classificação:** defeito demonstrado por leitura estática do caminho delimitado. **Execução discriminante pela revisão:** não realizada. **Owner:** WP04 produtor; WP11/C12 e WP10 na revisão, Apply e recibo.

**Arquivo/linha principal:** [product/procurement/prepared.ts:39–77](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/procurement/prepared.ts#L39-L77).

**Proveniência no delta:** prepared.ts e scenario-preparation.ts preexistiam; não se atribui a origem do defeito à clonagem ou ao delta da PR #34.

### Cenário reproduzível

- Pedido canônico em po_draft, salvo legitimamente pelo mesmo buyer, com buyerId, linhas, endereços e demais normalizações estáveis; pr.estAmount=100.
- Escolha persistida/autorizada com replace para 150, moeda/período/fontes válidos; versão e autoridade permanecem vigentes.

1. Preparar a escolha C12 que pretende substituir o valor por 150.
2. Ler decision-review pelo endpoint Procurement autorizado e obter o reviewDigest retornado, ainda que fields=[].
3. Enviar explicitamente decision-apply com esse digest, por contexto humano autorizado e chave idempotente válida.
4. Comparar o PR persistido, evento Saved, CAS e recibo.

### Evidência e consequência

- scenario-preparation traduz a operação para save com values.pr.estAmount=150 sem limitar a etapa de PR.
- O domínio permite save de PO em po_draft mas só prEdit aplica values.pr; o valor fica 100. Mesmo assim produz ok, Saved e incremento de CAS.
- A preparação confere campos intocados e histórico, porém não exige que os campos solicitados tenham o valor pretendido.
- A revisão produz fields=[] e digest válido; Apply aceita commit:true/status applied e o HTTP expõe outcome=applied.

A escolha fica aplicada no caso/recibo sem realizar a substituição prometida; a trilha idempotente pode reconciliar a tentativa como concluída.

**Limites da conclusão:**

- Caminho normal pelo botão da UI: decision-apply.ts:58 bloqueia fields=[]. O finding é backend/HTTP autorizado.
- Elevação de autoridade ou edição proibida de PR: a política do domínio continua impedindo a edição.
- Regressão introduzida especificamente pelo clone ou execução pelos revisores.

**Cadeia de código e consumidores reais:**

- [product/procurement/scenario-preparation.ts:16–41](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/procurement/scenario-preparation.ts#L16-L41)
- [runtime/procurement.ts:484–525](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/runtime/procurement.ts#L484-L525)
- [runtime/procurement.ts:595–654](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/runtime/procurement.ts#L595-L654)
- [product/procurement/prepared-review.ts:26–36](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/procurement/prepared-review.ts#L26-L36)
- [product/decisions/prepared-review.ts:34–46](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/decisions/prepared-review.ts#L34-L46)
- [product/procurement/decision-http.ts:48–68](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/procurement/decision-http.ts#L48-L68)
- [product/decisions/prepared-apply.ts:94–107](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/decisions/prepared-apply.ts#L94-L107)
- [product/ui/decision-apply.ts:58–66](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/ui/decision-apply.ts#L58-L66)

### Critério afetado

- **WP04.QLT.10** — Interfaces são concretas, versões/digests são verificáveis e falhas possuem causa e estado explícitos.

Critérios/contratos relacionados, sem presumir violação de todas as suas cláusulas: `WP04.DOD.02`, `C03`, `C12`, `CAMP.QLT.03`, `sf2h-integral-20261112.QLT.07`, `CAMP.CMP.02`. Textos superiores e contratos pertinentes estão em [criteria.json](criteria.json), vinculados à fonte normativa imutável.

### Prova existente e seu limite

- [product/ui/decision-apply.ts:58–66](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/ui/decision-apply.ts#L58-L66): A barreira de UI não é uma validação do endpoint/serviço. Os caminhos positivos em draft não discriminam o comando ignorado em po_draft.

### Correção e evidência esperadas

Recusar preparo de alteração de PR na etapa incompatível e verificar a pós-condição da intenção executada. Se houver no-op legítimo, representá-lo explicitamente sem afirmar realizada a substituição por 150; não ampliar as permissões de PR.

Exercitar preparação/review/Apply reais em po_draft e em uma etapa editável, mantendo autoria, moeda, fontes e CAS válidos; provar recusa/estado fiel no primeiro e mutação exata no segundo.

---

## OPS-REV-03 — P2 — Limite documental antes de autorização e deduplicação oculta fontes autorizadas

**Classificação:** defeito demonstrado por leitura estática do caminho delimitado. **Execução discriminante pela revisão:** não realizada. **Owner:** WP06.T05 / documentos.

**Arquivo/linha principal:** [product/documents/capabilities.ts:155–192](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/documents/capabilities.ts#L155-L192).

**Proveniência no delta:** slice(0,100) e limitations pré-ACL aparecem como código preexistente no patch. Defeito presente na entrega; não atribuído como regressão introduzida pela PR #34.

### Cenário reproduzível

- Duas fontes A e B correntes e autorizadas; A foi admitida e extraída antes de B.
- A tem 100 campos válidos; B contém token exclusivo NEEDLE_B.

1. Admitir A e extrair 100 campos; o produtor persiste um sf-document-v1 por campo, além do índice.
2. Admitir B depois e buscar NEEDLE_B com limit=10, sem documentRefs ou com [A,B].
3. Repetir a análise com registros antigos/inacessíveis de A antes de B, mantendo o corpus autorizado de B.

### Evidência e consequência

- Object.values dos registros do namespace é filtrado por schema/ref, mas recebe slice(0,100) antes do filtro de instalação/projeto, reader/autorização e deduplicação.
- Os registros repetidos de A consomem o orçamento; B não é lido apesar de haver apenas dois documentos autorizados.
- Registros inacessíveis também consomem orçamento; document-scan-limited depende de records.length anterior à ACL.

Resultado incompleto por contar candidatos/registros em vez de fontes pesquisáveis. Revogação e estoque de outros escopos podem suprimir resultados legítimos e influenciar metadata.

**Inferência delimitada:** O limiar document-scan-limited pode funcionar como canal de observação de cardinalidade inacessível. Demonstrou-se a dependência estática, não exploração em execução.

**Limites da conclusão:**

- Vazamento de texto privado ou recuperação de conteúdo de documento revogado.
- Execução do cenário >100 pelos revisores.

**Cadeia de código e consumidores reais:**

- [product/documents/capabilities.ts:41–95](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/documents/capabilities.ts#L41-L95)
- [product/documents/schemas.ts:13](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/documents/schemas.ts#L13)
- [product/documents/index.ts:21–38](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/documents/index.ts#L21-L38)
- [product/host-binding/state-provider.ts:21–31](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts#L21-L31)
- [product/documents/host.ts:69](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/documents/host.ts#L69)
- [apps/cli/src/sucafina-product/document-services.ts:23–51](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/apps/cli/src/sucafina-product/document-services.ts#L23-L51)

### Critério afetado

- **WP06.T05.CMP.19** — Cobrir PDF digital, DOCX, texto, sem camada textual, fonte revogada, revisão trocada, busca lexical e digests diferentes.
- **WP06.T05.QLT.18** — Schema fechado, ausência/falha explícitas e provenance permitem comparar UI/native/MCP.

Critérios/contratos relacionados, sem presumir violação de todas as suas cláusulas: `CAMP.INV.04`, `CAMP.CMP.02`, `C17`. Textos superiores e contratos pertinentes estão em [criteria.json](criteria.json), vinculados à fonte normativa imutável.

### Prova existente e seu limite

- [test/product/wp06/documents/egress-fences.test.ts:115–132](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/test/product/wp06/documents/egress-fences.test.ts#L115-L132): T256/R18/F082 revalida duas fontes e o egress; não cobre prefixo de 100 candidatos ou registros inacessíveis.
- T259/R18/F079: Índice sem candidato não distingue cem registros de cem fontes.

### Correção e evidência esperadas

Autorizar fontes correntes e deduplicá-las antes de consumir o orçamento; calcular limites/metadata no conjunto autorizado. Preservar as revalidações de saída; adotar paginação autorizada se necessária.

Duas fontes, A com 100 campos e B com token único; busca deve alcançar B. Repetir com fontes revogadas e outro principal/escopo antes de B, verificando resultados e metadata.

---

## OPS-REV-04 — P2 — Interrupção entre blob e catálogo impede retry idêntico de admissão

**Classificação:** defeito demonstrado por leitura estática do caminho delimitado. **Execução discriminante pela revisão:** não realizada. **Owner:** WP06 / importação; WP10 para persistência e reconciliação.

**Arquivo/linha principal:** [product/imports/staged-files.ts:59–85](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/imports/staged-files.ts#L59-L85).

**Proveniência no delta:** staged-files.ts não aparece no delta enumerado da PR #34; defeito da composição entregue, sem atribuição de introdução ao delta.

### Cenário reproduzível

- Admissão autorizada com principal, alvo, bytes e chave idempotente estáveis; persistência durável.
- Falha/crash depois do commit do blob e antes da publicação do catálogo.

1. Permitir o commit do blob em staged-files.ts:70.
2. Interromper antes da transação de catálogo nas linhas 73–77.
3. Reconstruir o host com persistência reaberta e autenticação atual; repetir a mesma operação com os mesmos bytes/alvo/principal.

### Evidência e consequência

- O ID deriva de principalRef+operation. Sem catálogo, a recuperação das linhas 62–69 não se aplica.
- O blob já existente faz a transação da linha 70 retornar false; a linha 71 retorna file-admission-conflict antes de reconciliar identidade/bytes.
- Uma exceção do catálogo também gera saved=undefined; a limpeza da linha 85 depende de saved, podendo conservar o órfão e produzir o mesmo bloqueio.

O retry da operação interrompida não progride; requer nova intenção/chave para avançar e deixa blob órfão. A admissão falha antes do preview/Apply.

**Limites da conclusão:**

- Mutação parcial do domínio, duplicação financeira ou quebra da atomicidade do Apply.
- Execução de crash/fault injection pelos revisores.

**Cadeia de código e consumidores reais:**

- [apps/cli/src/sucafina-product/import-services.ts:76–81](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/apps/cli/src/sucafina-product/import-services.ts#L76-L81)
- [product/imports/host.ts:36–58](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/imports/host.ts#L36-L58)
- [product/imports/workbench-script.ts:102](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/imports/workbench-script.ts#L102)

### Critério afetado

- **WP06.QLT.03** — Falhas de formato, autoridade e revisão têm tratamento distinto, mantêm arquivo/opções/entrada local quando apropriado e não expõem dados restritos.

Critérios/contratos relacionados, sem presumir violação de todas as suas cláusulas: `CAMP.CMP.02`, `CAMP.QLT.03`. Textos superiores e contratos pertinentes estão em [criteria.json](criteria.json), vinculados à fonte normativa imutável.

### Prova existente e seu limite

- [test/product/wp06/imports/staged-files.test.ts:49–58](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/test/product/wp06/imports/staged-files.test.ts#L49-L58): T225/R18/F120 cobre admissão concluída, replay, bytes distintos e revogação; não interrompe entre os dois commits.

### Correção e evidência esperadas

Tornar a admissão atômica onde possível ou reconciliar um blob órfão idêntico após revalidar autoridade, alvo, formato e digest. Não apagar um blob cujo catálogo possa ter sido publicado em resultado incerto.

Injetar interrupção exatamente entre os commits e erro/resultado incerto de catálogo; reabrir SQLite e repetir a admissão. Verificar recuperação idempotente, recusa de bytes/alvo divergentes e revogação.

---

## E-OPS-02 — P2 — Recuperação do Apply após restart não é demonstrada pelo teste de reopen citado

**Classificação:** NEEDS_EVIDENCE; não é defeito demonstrado de produto. **Execução discriminante pela revisão:** não realizada. **Owner:** WP06 + WP10.

**Arquivo/linha principal:** [test/product/wp06/imports/end-to-end.test.ts:109–118](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/test/product/wp06/imports/end-to-end.test.ts#L109-L118).

**Proveniência no delta:** Refinamento do E-OPS-02 já publicado na PR #49 durante esta revisão. Acrescenta vínculo T224/R18/F105, sequência exata de assertions e critério/prova esperada; não cria outro finding de recovery.

### Cenário reproduzível

- O título do teste menciona atomic receipt and retry survive SQLite reopen; o corpo é a evidência avaliada.

1. Ler a ordem: Apply na linha 110; retry na linha 114; dispose na linha 116; reopen na linha 117.
2. Verificar o único assert após reopen na linha 118: audit.length.

### Evidência e consequência

- O teste exerce Apply e replay na composição original, depois a persistência da auditoria.
- A instância reaberta não reconstrói os serviços/host, recupera referência/recibo ou executa Apply com nova autoridade.

A observação não fecha recuperação autorizada após perda de resposta e reinício; o comportamento pode funcionar, mas continua sem execução suficiente nesta fronteira.

**Limites da conclusão:**

- Falha de recuperação do produto.
- Ausência de todas as outras provas possíveis do repositório: a conclusão é sobre a evidência citada e o material auditado.

**Cadeia de código e consumidores reais:**

- [test/product/wp06/imports/end-to-end.test.ts:23](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/test/product/wp06/imports/end-to-end.test.ts#L23)

### Critério afetado

- **WP06.T03.DOD.02** — Os resultados positivos e negativos possuem provas locais de estados e um roteiro executável contra a composição real do WP10.

Critérios/contratos relacionados, sem presumir violação de todas as suas cláusulas: `C03`, `C04`, `CAMP.CMP.02`. Textos superiores e contratos pertinentes estão em [criteria.json](criteria.json), vinculados à fonte normativa imutável.

### Prova existente e seu limite

- [Run 43554658437, job 132324664659](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43554658437/job/132324664659): Caso histórico encontrado nos logs oficiais; não executou retry depois de reabrir.

### Correção e evidência esperadas

Não é exigida alteração do produto sem contraprova. Completar a prova discriminante ou apresentar execução existente que cubra o caminho faltante.

Commit de Apply com resposta perdida; encerrar composição, reabrir SQLite e serviços reais, autenticar novamente, recuperar manifesto/referência/recibo e repetir a mesma intenção; conferir recibo completo, valores, revisões e auditoria sem duplicação. Incluir revogação antes da recuperação.

---

## CI: resultados reais e limites

Foram consultados **23 runs existentes**. Para os 14 principais abaixo, a auditoria verificou também o parent único do snapshot, `ahead_by=1` e o diff contendo somente o envelope CI. As seleções Bun43/Bun24 foram conferidas contra os arquivos reais observados; suas listas completas estão em [evidence.json](evidence.json). As observações permanecem nos SHAs originais.

| Run | Produto | Snapshot executado | Seleção | Resultado real |
|---|---|---|---|---|
| [43578845234](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43578845234) | W1 | `acd7f87c28c70a68bd75ab65bac6c05477f470fe` | Bun: 43 arquivos explícitos | **FAILURE** — 100 pass / 1 fail / 0 skip / 2052 asserts |
| [43580401528](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580401528) | W2 | `26726f85ce39819fcfa376daf1e6ebea203188b2` | Playwright: procurement.spec.ts, imports.spec.ts, documents.spec.ts | **SUCCESS** — 30 pass / 0 fail |
| [43580976466](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580976466) | W3 | `c2ad4cb308ffa6e4b8d1a0cf5ed031bf1a304a01` | Bun: wp06/native/import-analysis.test.ts | **SUCCESS** — 2 pass / 0 fail / 123 asserts |
| [43582205250](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582205250) | W4 | `6108eafea9a35ba15968271f0aed76b1498d5ac4` | Bun: 24 arquivos explícitos | **FAILURE** — 114 pass / 3 fail / 1445 asserts |
| [43582881446](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582881446) | W4 | `5a6d4ee27f2279b8d5e6e1c19c392d8b92a8f6d7` | Playwright: wp06/documents.spec.ts | **SUCCESS** — 8 pass / 0 fail |
| [43584394810](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584394810) | W5 | `70bfcae5a16f8a007ee95402976cd1534d4a2ca3` | Typecheck Sucafina; typecheck CLI; guards | **FAILURE** — Sucafina failure; CLI success; guards success |
| [43584405211](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584405211) | W5 | `9e1d872f453c218909d328b480ffaf8bed6f0c82` | Bun: wp01/browser-startup.test.ts; wp04/host-integration.test.ts; wp01/browser-lifecycle.test.ts | **FAILURE** — 8 pass / 3 fail / 190 asserts |
| [43586114915](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43586114915) | D1 | `09bd92ba86dca618c398c893303f29d0902dc98e` | Guards | **FAILURE** — Sucafina skipped; CLI skipped; guards failure |
| [43586639212](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43586639212) | D2 | `5f5eeacabc5af2f7ceda1c27cbae9f17d8df9f8b` | Guards; typecheckSha=W5 | **SUCCESS** — Sucafina skipped; CLI skipped; guards success |
| [43534137756](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756) | PR23_PRODUCT | `846cc5aa5c4e1413e741d4de06bd0f53238f34ed` | Bun: 53 arquivos explícitos | **SUCCESS** — 257 pass / 0 fail / 2763 asserts |
| [43534795463](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534795463) | PR23_PRODUCT | `23f527266a8bf0da2c015624d40db417e2d9bb80` | Playwright: procurement.spec.ts; sourcing-controller.spec.ts | **SUCCESS** — 10 pass / 0 fail |
| [43557187051](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43557187051) | PR26_W20 | `2fa1f2cf08fd575e162c252c87a07e9aed104822` | Bun: wp06/import-runtime.test.ts; wp06/imports/dashboard-runtime.test.ts; wp06/native/import-analysis.test.ts | **SUCCESS** — 6 pass / 0 fail / 224 asserts |
| [43556886355](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43556886355) | PR26_W20 | `449cfa1132f520dba09cb3a076ce5bbdd3d20294` | WP06 scoped-checks | **SUCCESS** — guards success |
| [43556882437](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43556882437) | PR26_W20 | `16533e5f9beb40ee3e4b70d61cf8fa758b46d670` | Playwright: wp06/imports.spec.ts; wp06/documents.spec.ts | **SUCCESS** — 22 pass / 0 fail |

### Os três resultados que determinam a leitura do pin

1. **Allcheck W5 — [43584394810](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584394810/job/132415678483):** CLI e guards passam; Sucafina falha com TS2741 em `test/product/wp14/source-access-atlas.test.ts:167:41`, pela ausência de `procurementEvidenceWrites`. Não há allcheck agregado verde.
2. **Host/browser W5 — [43584405211](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584405211/job/132415709827):** H01–H08 passam; startup, H09 e lifecycle falham. Total **8 pass / 3 fail / 190 assertions**. O driver chega a `chromium-launch`; após cerca de dez segundos aparece `Browser driver launch exceeded 9667 ms`. H09 encontra o pool indisponível e não chega à fixture/HTTP da jornada. O Omni positivo registra um spawn e zero delegações; não prova aquisição do browser ou encerramento físico. A causa raiz do stall permanece desconhecida.
3. **Guard documental D2 — [43586639212](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43586639212/job/132422467329):** **78 regras / 837 paths / 0 gates / 11 warnings / 0 erros**. Os dois typechecks estão **skipped**, por `mode: guards`; `typecheckSha` aponta W5. Esse green não resolve o erro Atlas.

O passo de instalar Chromium do workflow só é usado pelo runner Playwright e ficou skipped no run Bun. Essa observação não estabelece a causa do stall; o driver tem seu próprio caminho de lançamento.

### Histórico e reuso

A tabela histórica de WP06 tem **303 linhas**. Cada trio `path + status + nome do caso` foi confrontado com logs oficiais N16/R18/R19/U20: **303 correspondências, zero ausências; 301 pass e dois skip**. A origem das linhas é N16=4, R18=255, R19=38 e U20=6. Isso não equivale a um único run agregado nem a 301 passes novos em W5. [Ledger de casos](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP06/operations-20261114/operations-impact-81.normalized.json).

Os dois skips são os casos de diretório e banco pertencentes a outro UID, que exigem privilégios de fixture root. Continuam sem execução suficiente dessa condição.

Para N16/R18/R19, foram conferidos API, jobs, logs e seleção; **o produto/parent declarado no recibo não recebeu verificação independente do objeto Git/compare nesta auditoria**. Não se estende a esses três a verificação de ancestralidade realizada nos 14 snapshots principais. Essa limitação está marcada por campo em evidence.json.

O ledger W5 declara 80 arquivos com observações de componente reutilizáveis e um consumidor Atlas pendente, num corpus de 81 arquivos. A auditoria confirmou as observações nos logs; não promoveu a análise transitiva de reuso do autor a uma nova execução ou a aceite. [Closure W5](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP06/operations-20261114/operations-W5-publication-closure.json).

### Fixtures e persistência

- [Browser Imports](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/packages/app-shell/e2e/sucafina/wp06/imports.spec.ts#L14-L112) usa `page.route/route.fulfill` e arquivo de texto sintético. Seus passes cobrem renderer/interação; parsing real, commit atômico e ACL pertencem a provas separadas.
- [Browser Documents](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/packages/app-shell/e2e/sucafina/wp06/documents.spec.ts#L8-L55) também usa HTTP sintético e delimita a separação de parser/SQLite/ACL/BCS.
- [Native fixture](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/test/product/wp06/native/fixture.ts#L239-L274) usa `wp06-recorded-ingress/deterministic-public-events`. Exercita runtime com entrada gravada; não comprova inferência externa, scanner instalado ou GNATIVE.
- H06 cobre perda de resposta e limpeza do cache de revisão. Não comprova reinício físico de processo. E-OPS-02 delimita separadamente o teste de imports que reabre SQLite e só lê o tamanho da auditoria.
- Não foram baixados ZIPs de artifacts nem recalculados seus hashes. Digests de artifact reportados pelo serviço não são apresentados como calculados independentemente.

## Pendências conhecidas: diagnóstico adicional, sem novos findings redundantes

| Pendência já registrada | Diagnóstico que esta revisão acrescenta/preserva | Owner |
|---|---|---|
| OPS03 — Apply genérico | [Parser genérico](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/decisions/http.ts#L168) aceita três chaves; [UI](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/ui/decision-apply.ts#L66) envia a quarta, `reviewDigest`. O parser Procurement aceita quatro. H02–H08 não qualificam Dashboard/Planner; binding posterior fora do pin não foi aceito aqui. | Compose/Finance |
| OPS-CONSUMER-02 — Atlas | Erro exato de typecheck confirmado no log W5. O guard D2 não reexecutou typecheck. A composição futura precisa preservar os dois cenários do caller e a mesma capacidade da autoridade. | Compose/Atlas |
| OPS-NATIVE-UI-ACQUISITION | Interrupção localizada antes da jornada HTTP de H09; um spawn não prova aquisição ou close físico. Nenhuma causa raiz presumida. | Interface/runtime |
| Recuperação/lookup da UI | H06 é limpeza de cache. A intenção em [decision-apply.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/ui/decision-apply.ts#L19) vive em closure; o [handoff ui-recovery](https://github.com/gustavomhss/Orchestra-SF/blob/d3d411f7e2476a562a57aa7620823980eaf34e46/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/ui-split/ui-recovery.md) já contém a frente correspondente. Não foi criado um finding repetido. | Interface/composição |

Os dez critérios nativos/quatro humanos WP04 e os sete marcos históricos/duas cláusulas AM WP06 seguem preservados em criteria.json. Há ainda obrigações AM03/AM05 documentais e globais; execução parcial não satisfaz retroativamente marcos/leases. AM01–AM06, oito seleções finais, C/G7, D/G8 e as aprovações do candidato integrado continuam exigidos no escopo normativo.

## Disposição e recheck

**REQUEST_CHANGES** pelos quatro defeitos estáticos delimitados. **NEEDS_EVIDENCE** para a recuperação pós-restart e para as obrigações que permanecem abertas. Não foi demonstrada nesta amostra alteração das alçadas, aplicação financeira parcial de imports, confirmação documental automática ou ressurreição de conteúdo revogado; ausência de achado nesses pontos não é aprovação.

A evidência futura precisa identificar o novo SHA de produto, o delta, os produtores/consumidores afetados e os resultados discriminantes. Mudanças posteriores ao SHA revisado exigem recheck do delta. Corrigir um finding não encerra automaticamente as provas pendentes nem qualifica os outros consumidores. Este parecer não substitui as aprovações finais do candidato integrado.

## Arquivos deste parecer

- [findings.json](findings.json): cinco registros acionáveis, limites, owners, correções esperadas e evidência.
- [criteria.json](criteria.json): todos os 251 critérios literais, contexto das dez tasks, 50 axiomas superiores e classificação independente.
- [evidence.json](evidence.json): SHAs/trees, 23 runs, seleções, proveniência, observações, limites e pendências conhecidas.
- [HANDOFF.md](HANDOFF.md): estado final da revisão documental e condições de recheck.
