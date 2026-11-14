# Parecer independente — Operações / PR #34

**Revisor:** Astra, sem autoria ou permissão de alteração do produto.  
**Data:** 2026-11-14 UTC.  
**Estado da revisão:** concluída com achados e limites de evidência.  
**Decisão:** **aceite integral não concedido** para WP04, WP06 ou candidato composto.

A entrega preserva provas reais de componentes, e os principais runs consultados correspondem aos produtos e snapshots declarados. Há um defeito de integração documental confirmado pela cadeia estática de produção e uma inferência específica de impasse na recuperação C12, apoiada em um cenário de produtor já executado. Os resultados parciais, inclusive H01–H08, permanecem parciais. Não foi encontrado desvio de integridade nos sete logs cujo tamanho e SHA-256 foram conferidos.

## 1. Identidade fixa e autoridade da revisão

| Objeto | Identidade |
|---|---|
| [PR revisada #34](https://github.com/gustavomhss/Orchestra-SF/pull/34) | `astra-operations` → `sf2-stack` |
| **Head exato revisado** | **`ba8a09e371ce8d93eb917eabb102caaee5affaf4`** |
| **Tree exata revisada** | **`eb427121bcfd8c2511aac31d908f3c0d52c1915e`** |
| Produto W5, anterior aos recibos D2 | `c4a2f4ebeb88f5915e51569b921be06b3c37ddad`; tree `5cc00703f04845c62448a2a3239683d266d8d548` |
| Base de comparação da #34 | `6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0`; 402 caminhos no inventário da PR |
| [Incremento recuperado #23](https://github.com/gustavomhss/Orchestra-SF/pull/23) | `91e1f60bc6f7e85517e2b4f963eec5ac7da13e62`; produto testado `dae18b4f43f0daecf46264e876810025684a919d` |
| [Incremento recuperado #26](https://github.com/gustavomhss/Orchestra-SF/pull/26) | `e7fd8ff797441681f360e7775155a8cc2830280c` |
| [Plano normativo imutável](https://github.com/gustavomhss/Orchestra-SF/tree/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan) | `dbf9547211d9b0fade619790de7c19c0869b7c7d` |
| Publicação deste parecer | `review-operations` → `sf2-control`, a partir de `d3d411f7e2476a562a57aa7620823980eaf34e46` |

O head da #34 foi fixado antes da análise e reconferido antes da publicação. #23 e #26 continuam nos pins recuperados acima. Referências a outros candidatos são identificadas separadamente; não transferi seus resultados para a #34.

Li [AGENTS](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/AGENTS.md), START, WORKFLOW, COMMON, handoffs e packs integrais de WP04/WP06 no commit de handoff `a3d29d011ba3607a57914701300f09117a3e2de9`, critérios e anexos pertinentes no plano fixo, inventário/diffs e os caminhos de produção, consumidores, testes e recibos indicados neste parecer. O AGENTS aplicável tem blob `643ec9f8f960895b2e3294f7f2cc25db6f8488e4`; não há outro AGENTS nas subárvores de produto/runtime/testes/docs inspecionadas.

A comparação independente de IDs e textos com o campaign canônico encontrou **111/111 critérios WP04 e 140/140 WP06 idênticos**, sem ausências, extras, duplicatas ou mudança de literal nos mapas da entrega. Isso verifica a integridade do inventário. **Não significa 251 critérios aceitos.** Os mapas completos permanecem em [WP04](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP04/operations-20261114/operations-criteria-111.normalized.json) e [WP06](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP06/operations-20261114/operations-criteria-140-W5.json); este parecer acrescenta a avaliação independente de comportamento e das fronteiras de prova.

Todas as operações remotas desta revisão usaram GitHub MCP. Não executei testes locais, disparei CI, alterei produto, branches dos autores, políticas ou plano; não executei epic ou merge. As instruções históricas de implementação nos handoffs não ampliam a autorização desta revisão.

## 2. Classes de conclusão

- **D — defeito demonstrado por composição estática:** cadeia causal confirmada no código real, com cenário reproduzível; não é alegada uma execução nova.
- **I — inferência:** consequência do consumidor deduzida do código, separada do que o run existente efetivamente demonstrou.
- **E — ausência de evidência:** comportamento necessário não demonstrado no corpus e caminhos adjacentes inspecionados; não é automaticamente defeito do produto.

P2 significa correção funcional necessária antes de qualificar integralmente o fluxo afetado. Não foi identificado neste escopo um novo bypass de autorização, duplicação de efeito financeiro ou corrupção de dados que justificasse P0/P1.

## 3. D-OPS-01 — P2 — Repetir extração pela UI cria outro schema e recusa o candidato existente

**Classe:** defeito confirmado pela composição estática de produção.  
**Owner:** **Operações / WP06.T05**, responsável pelo workbench documental, produtor de schemas e HTTP documental conforme o handoff.  
**Local primário:** [product/documents/workbench.ts:23,33](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/documents/workbench.ts#L23-L33).

### Cenário reproduzível

1. Com um comprador autorizado, admitir um documento texto com `Price: 42`.
2. Em Documents, informar campo `Price`, tipo `number`, unidade `USD` e extrair. A primeira submissão cria schema e candidato.
3. Repetir a mesma submissão, sem mudar documento, versão, campos, unidade ou acesso.
4. O form cria outro schema. A extração reencontra o mesmo ID de candidato, mas o vínculo de schema diverge; o host recusa a extração. Na composição HTTP, o conflito se torna **503**, com mensagem genérica de indisponibilidade.

### Causa verificável

| Código no SHA revisado | Efeito |
|---|---|
| [workbench.ts:23,33](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/documents/workbench.ts#L23-L33) | Cada POST recebe nova chave aleatória. Cada submit chama `document-schema` sem `id`, seguido de `document-extract` com o novo ref. Não consulta/reutiliza `document-schemas`. |
| [host-context.ts:94–99](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/apps/cli/src/sucafina-product/host-context.ts#L94-L99) e [document-services.ts:22](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/apps/cli/src/sucafina-product/document-services.ts#L22) | A composição real deriva a identidade da operação de `operation + Idempotency-Key` e a fornece ao produtor. Não há deduplicação por conteúdo nesse seam. |
| [schemas.ts:50–68](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/documents/schemas.ts#L50-L68) | Sem ID explícito, o ID depende de principal/operação. A igualdade dos campos só reutiliza um schema se aquele ID já existir. Duas operações idênticas criam IDs distintos. |
| [capabilities.ts:63–79](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/documents/capabilities.ts#L63-L79) | O ID do candidato usa documento/incarnação/revisão/hash/campo/offsets, sem o schema; a segunda extração encontra o candidato anterior. |
| [capabilities.ts:109–114](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/documents/capabilities.ts#L109-L114) | `sameExtraction` exige igualdade de `schemaRef/schemaVersion`; o novo schema causa `candidate-schema-conflict`. |
| [document-services.ts:37](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/apps/cli/src/sucafina-product/document-services.ts#L37) e [document-http.ts:101](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/interface/document-http.ts#L101) | `conflict` é convertido em `failed`, mapeado para HTTP 503. |

**Consequência:** a repetição pelo próprio consumidor não alcança o reuso já implementado na API inferior e acumula schemas adicionais sem candidato correspondente à nova tentativa. Uma resposta perdida após a primeira extração pode levar ao mesmo caminho ao reenviar o formulário. O candidato anterior permanece; não se demonstrou perda da confirmação, vazamento de acesso ou corrupção.

**Critérios afetados:** `WP06.SUC.10` (consumidor integrado com saída real), `WP06.QLT.10` (causa/estado explícitos), `WP06.DOD.04`/`WP06.CMP.04` e `WP06.T05.DOD.01`, sob C14. A primeira extração continua funcional; isso não autoriza aceitar integralmente a integração.

**Por que os PASS não fecham o caso:** [extraction-reuse.test.ts:29–46](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/test/product/wp06/documents/extraction-reuse.test.ts#L29-L46) registra um único schema e conserva o mesmo `fieldSchemaRef` nas repetições, inclusive depois da confirmação. Já [documents.spec.ts:8–16,50–51](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/packages/app-shell/e2e/sucafina/wp06/documents.spec.ts#L8-L51) usa renderer real com HTTP interceptado e devolve schema constante. As provas são válidas nessas fronteiras, mas não exercitam dois submits completos contra o produtor real de schemas.

**Correção esperada:** reutilizar um schema equivalente, vigente e autorizado para a mesma identidade documental/definição, e preservar a identidade da mesma intenção ao recuperar resposta perdida. Pode ser resolvido no consumidor ou no produtor dentro do ownership WP06. Manter os conflitos para mudança real de tipo/unidade/versão e a proteção de candidatos confirmados; remover indiscriminadamente a comparação de schema destruiria uma garantia útil.

**Prova a exigir do owner:** duas submissões completas `schema → extract` com serviços reais e chaves como as da UI; repetir após confirmação e após perda de resposta pós-commit. Verificar candidato/ref/estado preservados, ausência de registros adicionais desnecessários e recusa para mudança semântica, revogação e fonte substituída. Nenhum novo run foi iniciado nesta revisão.

## 4. I-OPS-02 — P2 — Conflito C12 pós-commit não progride pelo retry oferecido ao usuário

**Classe:** inferência de recuperação do consumidor, apoiada em contraprova executada do produtor.  
**Owner primário:** **Interface/WP01**, coordenando o caminho de recuperação com **Operações/WP04** (host Procurement) e **WP11** (execução/recibos compartilhados).  
**Locais:** [decision-apply.ts:31–34,64–77](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/ui/decision-apply.ts#L31-L77); [decision-host.ts:86–94](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/procurement/decision-host.ts#L86-L94); [decisions/apply.ts:29–38](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/decisions/apply.ts#L29-L38).

### Parte observada no run existente

H05, [host-integration.test.ts:316–349](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/test/product/wp04/host-integration.test.ts#L316-L349), passou no [run 43584405211](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584405211). O teste intercala uma edição autorizada do caso **depois do commit de domínio/recibo e antes da reconciliação central**. As assertions mostram:

- A Request passa de `estAmount=100` para `150`, com uma entrada de histórico e um recibo durável.
- O caso conserva a edição concorrente, a mudança preparada fica `planned` e `case.receipts` permanece vazio.
- A resposta é `409 / case-changed-after-application`.
- Reenviar a intenção original produz outro 409, sem segundo efeito.

A recusa protege a edição concorrente e a idempotência. Não é um pedido para transformar esse conflito em sucesso fictício.

### Inferência do consumidor

A UI congela `caseRef.version`, `reviewDigest`, body e key em `intention` na linha 66. Depois de 409, preserva a intenção e oferece apenas “Retry same application”; review/confirm ficam desabilitados. O host recusa a versão antiga sem `change.receipt` em `readChange`, **antes** de consultar o recibo durável. O executor genérico contém o mesmo bloqueio antes de `readReceipt`.

Assim, no cenário H05, a única tentativa oferecida por esse componente volta ao mesmo 409. Recarregar a página descarta a intenção/digest mantidos só em memória. Uma revisão nova não resolve automaticamente: [prepared-review.ts:16–18](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/procurement/prepared-review.ts#L16-L18) exige fonte corrente, e [sources.ts:104–109](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/procurement/sources.ts#L104-L109) rejeita a versão antiga já alterada pelo efeito financeiro.

**Cenário a reproduzir no consumidor real:** review → Apply; intercalar a edição autorizada H05; observar 409; clicar no retry oferecido; tentar reabrir a operação e reconciliar o recibo original. A parte browser desse cenário **não foi executada** nos runs auditados.

**Consequência inferida:** o usuário pode permanecer com uma operação financeiramente aplicada cujo caso ainda aparece planejado, sem passo de recuperação que esse consumidor consiga completar. Não se demonstrou reaplicação financeira. Também **não afirmo que a recuperação pela API seja impossível**: um chamador que retenha o digest original e apresente uma nova intenção autorizada com a versão corrente do caso pode alcançar o ramo de recibo existente; essa variante não foi demonstrada e a UI examinada não a constrói.

**Critérios afetados:** C03/C12, especialmente interrupção entre commit de domínio e atualização do caso com reconciliação autorizada; `CAMP.CMP.02` (concorrência, reenvio e retomada), `CAMP.QLT.03` (próximo passo útil em conflito) e `WP04.SUC.10`.

**Correção esperada:** oferecer recuperação explícita do recibo original, com correlação durável da intenção e acesso corrente, preservando command/digest/principal/target/incarnation e a edição concorrente do caso. Separar reconciliação de recibo já aplicado de nova mutação. Não afrouxar o CAS, a confirmação, as verificações de fonte ou a recusa por revogação.

**Prova necessária:** estender o cenário H05 pelo consumidor real até reload/reabertura e reconciliação, com um efeito, um recibo e preservação da edição concorrente; acrescentar digest alterado, revogação e substituição física do alvo. H06 cobre outro caso: perda de resposta/cache sem avanço concorrente da versão.

**Informação nova frente às pendências existentes:** este achado identifica a combinação específica **H05 + intenção imutável da UI + gate anterior ao lookup do recibo** no pin Operations. O [finding Dashboard reload W10](https://github.com/gustavomhss/Orchestra-SF/blob/a9dfea8907151bbe6a6815d5ff78264c1498026a/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP02/astra-interface/findings/c12-reload-w10.md) trata outro candidato/composição. O [comentário Compose W10](https://github.com/gustavomhss/Orchestra-SF/pull/34#issuecomment-6877409496) trata um 200 inesperado noutro SHA. Nenhum foi reapresentado como novo defeito deste pin.

## 5. Comportamentos examinados e crédito de prova

| Área | O que a implementação/prova sustenta | Limite da conclusão |
|---|---|---|
| Autorização e revogação | Contextos humanos/UI e grants atuais são revalidados; H03/H04/H07/H08 recusam ator/origem/intenção/proof/fonte inadequados e substituição física. | Não é autorização baseada apenas no nome do agente. Não foi encontrado novo bypass nos percursos examinados; isso não certifica consumidores ausentes. |
| Confirmação financeira C06 | H01 usa a composição real; leitura de fingerprints, projeções monetárias e testes WP04 distinguem mudanças materiais, valores desconhecidos e snapshots de etapa. | Não inventa FX, orçamento ou aprovação. Provas humanas de tempo/compreensão continuam pendentes. |
| Source continuity | H02/H03 e os resolvers vinculam a evidência à encarnação/projeção e reemitem sob o ator atual; alvo recriado não revive fatos/recibos antigos. | Histórico autorizado não transforma conteúdo antigo em fonte atual. Novos consumidores precisam preservar a mesma cadeia. |
| Importação C04 | Hosts/adapters reais usam comandos de domínio, preview/impacto, confirmação e transação; testes de rejeição atômica e replay cobrem os casos selecionados. | Não existe promessa de atomicidade global entre domínios. Durabilidade de primitivas não prova o recovery completo após reconstrução do host. |
| Documentos C14 | Bytes autorizados, revision/incarnation/hash, extração candidata, confirmação humana e preservação de evidência estão implementados. | D-OPS-01 quebra a repetição pelo form; reuso direto de um schema não o cobre. |
| Dossiê WP06→WP09 | [dossier-runtime.test.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/test/product/wp06/documents/dossier-runtime.test.ts) e [routines/dossier.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/routines/dossier.ts) usam o produtor real: PDF/DOCX/texto candidatos não viram fatos; confirmação, fonte alterada e revogação mudam a disponibilidade. H01 verifica a composição Procurement/C06/WP09. | Não equivale a aceite do consumidor Atlas nem a toda jornada residente. |
| Persistência/recuperação | SQLite real em H01–H08; recibo/mutação atômicos; replay no runtime vivo; reabertura de auditoria, fontes, blobs e leitura de receipt genérico em C08. | E-OPS-01/02 delimitam os fluxos completos ainda não demonstrados. |

As fixtures H01–H08 importam `createSfBusinessServices`, `createApplication`, `openLocalStore` e `createSfProductAuthority` reais. O [adapter de H05/H06:616–654](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/test/product/wp04/host-integration.test.ts#L616-L654) intercala transações reais; não fornece um resultado inventado ao consumidor. A criação anterior da escolha Procurement é semeada pela fixture, portanto não comprova o produtor público de Choice.

## 6. Proveniência e resultados dos runs

A comparação W5→D2 tem dois commits e 65 arquivos, todos de recibos WP04/WP06. Produto, testes, fixtures, configuração e workflows não mudam nesse intervalo. Produto WP04→head recuperado #23 tem um commit e 31 arquivos de recibos. W4→W5 tem oito arquivos de código/fixture/teste entre 36 caminhos; os oito blobs declarados foram conferidos no head D2. Para cada um dos onze runs principais abaixo, W→S acrescenta um único request CI, sem mudar o produto testado.

| Run | Produto | Resultado efetivamente observado |
|---|---|---|
| [43584394810](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584394810) | W5 | **FAIL**: typecheck Sucafina, TS2741 em Atlas por `procurementEvidenceWrites`; CLI e guards PASS. |
| [43584405211](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584405211) | W5 | **8 PASS / 3 FAIL / 190 assertions**; H01–H08 passam; startup/H09/lifecycle falham. |
| [43586639212](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43586639212) | D2 | Guard documental **PASS**; os dois typechecks foram **skipped** por contrato de modo guards. |
| [43580976466](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580976466) | W3 | Import analysis nativo: 2 PASS, 123 assertions. |
| [43580401528](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580401528) | W2 | 30 casos browser PASS: 8 Procurement, 14 imports, 8 documents. |
| [43582881446](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582881446) | W4 | 8 casos documents browser PASS. |
| [43534137756](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756) | WP04 `dae18b4…` | 257 PASS, 2.763 assertions, 53 arquivos. |
| [43534795463](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534795463) | Mesmo WP04 | 10 casos browser PASS. |
| [43557187051](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43557187051) | WP06 W20 | U20 realmente **SUCCESS**: 6 PASS, 224 assertions, 3 arquivos. |
| [43556886355](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43556886355) | WP06 W20 | Typechecks Sucafina/CLI e guards PASS. |
| [43556882437](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43556882437) | WP06 W20 | 22 casos browser PASS. |

Os treze runs registrados em [EVIDENCE.json](EVIDENCE.json) incluem também as falhas históricas preservadas: W1 [43578845234](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43578845234), 100 PASS/1 FAIL por timeout de import-analysis, e W4 [43582205250](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582205250), 114 PASS/3 FAIL em H02/H03/H05. Seus resultados não foram apagados nem apresentados como passes.

EVIDENCE.json fixa W, S, jobs, URLs, conclusões e limites; registra sete pares tamanho UTF-8/SHA-256 recalculados dos logs obtidos pelo GitHub MCP, todos iguais ao [artifact-index](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP04/operations-20261114/artifact-index.json). A auditoria de hash cobre esses logs decodificados. Não foi uma auditoria byte a byte de todos os ZIP/PNG.

### Fronteiras que impedem promover componente a aceite

- **H09 não executou a jornada.** No W5, a aquisição Chromium falhou; H09 falhou em 6,34 ms antes das chamadas da jornada. O próprio teste registra `processRestarted:false`, `humanTimingMeasured:false` e `nativeModelSession:false`. Omni 1 spawn/0 delegações não converte esse resultado em PASS de UI/lifecycle.
- **Browser WP06:** [imports.spec.ts:4–18](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/packages/app-shell/e2e/sucafina/wp06/imports.spec.ts#L4-L18) e [documents.spec.ts:8–21](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/packages/app-shell/e2e/sucafina/wp06/documents.spec.ts#L8-L21) executam renderer/scripts reais com `page.route`. Não provam parsing de workbook, transação SQLite, ACL de servidor ou scanner. Os bytes de upload de imports nessa seleção são sintéticos.
- **Sessão/MCP:** [native/fixture.ts:53–55](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/test/product/wp06/native/fixture.ts#L53-L55) usa Session/Agent/SkillLoadReceipt/MCP reais com entrada de provider gravada via publisher. Isso dá crédito ao encadeamento exercitado, sem qualificar inferência externa, scanner instalado ou GNATIVE completo.
- **Outros candidatos:** o FAIL de Compose W10 [43592994998](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43592994998), W `00304ac25cc82ffd87ebd3096bd2f5cfec5222e1`, e o FAIL Interface [43592240575](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43592240575) pertencem a SHAs diferentes. O H05 200/409 de Compose não foi atribuído à #34, onde H05 passa; tampouco os passes parciais desses candidatos foram usados como aceite Operations.

## 7. Ausências de evidência delimitadas

### E-OPS-01 — C12 após reinício completo e recuperação pela UI

**Owner:** Interface/WP01, Operações/WP04, seams WP10/WP11. **Não é novo defeito de persistência.**

[H06:353–383](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/test/product/wp04/host-integration.test.ts#L353-L383) chama `procurementDecisions.dispose()` para limpar reviews, perde a resposta depois do commit e repete com payload/digest preservados **na mesma fixture/processo**. Demonstra recuperação de cache/recibo nessas condições. Não reconstrói o processo/autoridade/host, e H09 não completou a UI.

**Falta demonstrar:** após perda de resposta, reabrir a mesma instalação, reconstruir os serviços, recuperar a intenção original sob autorização corrente e reconciliar o recibo sem segunda mutação. Para I-OPS-02, incluir também o avanço concorrente da versão do caso. Preservar negativos de revogação e substituição do alvo.

### E-OPS-02 — Import Apply/retry após reconstrução do runtime

**Owner:** Operações/WP06, com persistência/autoridade WP10. **Não é corrupção demonstrada.**

Em [imports/end-to-end.test.ts:108–118](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/test/product/wp06/imports/end-to-end.test.ts#L108-L118), Apply, retry e igualdade do resultado ocorrem antes de `driver.dispose()`. Após reabrir SQLite, a assertion verifica apenas `audit.length`. A leitura de preview da linha 90 também ocorre antes do fechamento.

A busca dirigida fora de WP06 encontrou [WP10 cross-surface.test.ts:10–36](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/test/product/wp10/integration/cross-surface.test.ts#L10-L36): ele reconstrói o state provider e lê o receipt após reopen, o que sustenta durabilidade. Entretanto, usa callback genérico que incrementa `snapshot.data.imports`; não contém ImportManifest real, e o retry também é anterior ao fechamento. Provas de source lifecycle, blob generations, local store/backups e host adjacentes não demonstraram o fluxo completo procurado.

**Falta demonstrar no material inspecionado:** reconstruir import host/authority/services sobre o mesmo banco; recuperar o manifesto e o recibo reais; autenticar sessão atual e repetir Apply com a mesma intenção/chave; conferir resultado/recibo idênticos e nenhuma nova mutação/auditoria. Incluir revogação e fonte/encarnação substituída. O título “survive SQLite reopen” não amplia as assertions efetivamente executadas.

### E-OPS-03 — Ownership do diretório/banco por UID de sistema

**Owner:** WP10. **Ausência de execução, sem finding de bypass.**

Os dois skips dos runs [43554658437](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43554658437) e [43555674548](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43555674548) são precisamente os casos de **diretório e banco pertencentes a outro UID**. [local-store.test.ts:574–585](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/test/local-store.test.ts#L574-L585) condiciona-os a privilégios root e usa UID 65534.

Falta execução que demonstre a recusa de diretório de instalação ou `installation.sqlite` de UID estranho. Testes de autorização lógica não substituem essa condição do sistema operacional. Não é pedido para ampliar permissões ou rodar uma suíte nesta revisão.

## 8. Pendências conhecidas preservadas, sem novos IDs duplicados

| Pendência existente | Encaminhamento |
|---|---|
| `OPS-CONSUMER-02` / Atlas | O caller ainda causa TS2741 no W5. Preservar os dois cenários, inclusive Documents→BCS→Atlas; integrar pelo owner e obter prova do consumidor corrigido. |
| `OPS-NATIVE-UI-ACQUISITION` | Adquirir e encerrar fisicamente Chromium antes de qualificar H09. E-OPS-01 acrescenta a fronteira de restart, sem rebatizar a falha já registrada. |
| `OPS03` / HTTP genérico Dashboard/Planner | O parser isolado recusa o quarto campo `reviewDigest`; a prova Procurement não qualifica esses consumidores. |
| WP04 humano | `WP04.SUC.01`, `WP04.T03.SUC.01`, `WP04.T04.CHK.01`, `WP04.T04.SUC.01` continuam não observados; screenshots automatizados não medem aceitação/tempo humano. |
| WP06 AM02/AM06 e demais vínculos AM/GNATIVE | Preservar as marcações por critério. Provider gravado não prova instalação, inferência externa ou scanner. |
| Produtor público Procurement Choice | [Finding WP12 já publicado](https://github.com/gustavomhss/Orchestra-SF/pull/34#issuecomment-6880699969). A escolha semeada não substitui Alternative/ScenarioResult/ChoiceRecord públicos. |
| Existing-receipt proof / Dashboard reload | [Finding Interface já publicado](https://github.com/gustavomhss/Orchestra-SF/pull/34#issuecomment-6876360445). Não substituir a proteção mais forte por blob antigo nem importar a composição inteira sem reconciliação do owner. |

As cinco primeiras pendências estão explicitadas na [entrega Operations](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP04/operations-20261114/OPERATIONS-DELIVERY.md). Não foram tratadas como ocultação nem reemitidas como achados novos. I-OPS-02 acrescenta um cenário e uma causa no consumidor; E-OPS-02/03 tornam precisos comportamentos antes descritos apenas como recovery/lifecycle/skips.

## 9. Encaminhamento e condição de encerramento

1. WP06 corrige D-OPS-01 e entrega prova do submit completo com o produtor de schemas real.
2. Interface/WP01 e WP04/WP11 confirmam e fecham I-OPS-02 por recuperação autorizada do recibo, mantendo o conflito seguro e a edição concorrente.
3. Owners preenchem E-OPS-01/02/03 e as pendências existentes com evidência pertinente ao candidato efetivamente composto; uma nova prova precisa declarar produto/snapshot e os blobs consumidos.
4. S0 reconcilia os resultados no candidato final, sem inferir aceite integral a partir deste parecer documental.

Este parecer conclui a revisão solicitada; não declara produto READY, aceite humano, GNATIVE, GLOBAL_RELEASE ou autorização de merge. [HANDOFF.md](HANDOFF.md) resume os owners e próximos passos; [EVIDENCE.json](EVIDENCE.json) permite conferir os pins e a proveniência.
