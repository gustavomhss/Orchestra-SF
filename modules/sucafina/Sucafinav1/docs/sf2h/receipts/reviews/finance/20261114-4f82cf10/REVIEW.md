# Revisão independente de Financeiro — PR #42

**Verdict: REQUEST_CHANGES. A integração Financeira não está qualificada no SHA fixado.** Esta revisão está concluída como trabalho documental; não concede aceitação global da frente, dos WPs ou do bundle.

Há **quatro BUGs concretos** entre produtores e consumidores e **uma pendência NEEDS_EVIDENCE** para a jornada que preserva a escolha humana e alcança o limiar financeiro real. Três BUGs têm encadeamento determinístico por inspeção estática; o quarto combina uma contraprova executada em snapshot anterior com os mesmos blobs relevantes no pin. Ausência de novo erro aritmético demonstrado não é certificação das fórmulas ou da jornada completa.

## 1. Corte imutável e autoridade da revisão

| Campo | Valor |
| --- | --- |
| Repositório / alvo | [gustavomhss/Orchestra-SF — PR #42](https://github.com/gustavomhss/Orchestra-SF/pull/42), `finance-resume` |
| **SHA exclusivamente revisado** | [`4f82cf10ae6766c56e9bf1862fc5198a5246cb5c`](https://github.com/gustavomhss/Orchestra-SF/commit/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c) |
| Árvore do produto revisado | `67af8927297fa12ca7d84077e0450833a9738c52` |
| Pai do produto, R4 | `229d66fa59ceebbc4b3683565670698f2cf3aa65` |
| Norma imutável | [`dbf9547211d9b0fade619790de7c19c0869b7c7d`](https://github.com/gustavomhss/Orchestra-SF/tree/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan) |
| Base Finance anterior preservada | #35 / `ec052c2c3bef96f492512f3d5f663919580f25c8` |
| Publicação documental autorizada | `review-finance` → `sf2-control` |
| Branch documental/base observadas antes da publicação | ambas em `d3d411f7e2476a562a57aa7620823980eaf34e46` |
| Única área de escrita | `modules/sucafina/Sucafinav1/docs/sf2h/receipts/reviews/finance/` |

A revisão usou somente **GitHub MCP** para remoto, leitura de fontes/commits/Actions e processamento em memória dos retornos. Não houve autoria de produto, correção de fontes, teste local, novo CI, navegador, merge, deploy ou mensagem aos autores. Os recibos anteriores permanecem intactos; os findings não atribuem a Finance autoria de defeitos herdados ou de composição externa.

**Delta observado durante a revisão:** a PR avançou para [`3ea9dc2efe0de8d283f9625774697e431f55a0d7`](https://github.com/gustavomhss/Orchestra-SF/commit/3ea9dc2efe0de8d283f9625774697e431f55a0d7), um commit à frente do pin. O compare contém **29 documentos adicionados**, inclusive handoff/evidências finais, sem mudança de produto/teste nesse delta observado. A existência e a lista constam de [provenance.json](provenance.json). O conteúdo novo e qualquer versão posterior **não recebem automaticamente este parecer**. Um recheck será específico.

## 2. Cobertura e método

Foram lidos AGENTS aplicáveis, COMMON e **WP03/WP05/WP11/WP13 completos**, seus contratos, critérios, oráculos e anexos pertinentes. São **18 tasks e 371 entradas normativas: 284 axiomas e 87 checks**. Esses números medem o inventário lido, não testes executados ou critérios aprovados. [coverage.json](coverage.json) enumera os IDs sem alterar o estado normativo.

A análise técnica concentrou-se nos caminhos produtor→consumidor solicitados: normalização e cálculo canônicos, moeda/FX, ausência/zero/inherited, inventário e subtotal conhecido, N/A sustentado, identidade compartilhada sem dupla soma, cenários/limiar, caso e escolha versionados, grants humanos, preparação, reserva, recibos e retry, persistência/ancestry/C17, BI e navegação autorizada.

A leitura cruzou o handoff presente no pin, intake, reconciliações R2/R3/R4/R5, recibos anteriores e fontes efetivas. Compare amplo que devolve no máximo 300 arquivos não foi usado como inventário exaustivo: a reconciliação própria usa diretórios completos e árvores Git não truncadas. A lista paginada da PR observada enquanto seu head era o pin continha 1.024 caminhos. Não alegamos inspeção linha a linha dos 1.024 arquivos.

Os patches materiais de Planner, case-port e campanha foram conferidos junto às fontes. Alguns patches da API vieram nulos; nesses casos a revisão usou as fontes e SHAs de blobs, sem fingir leitura de um diff ausente. O patch do próprio commit fixado foi lido integralmente: só bootstrap de fixture BI, expectativa de envelope do handoff e dois recibos.

## 3. Findings

| ID | Classificação | Severidade | Efeito principal | Owner |
| --- | --- | --- | --- | --- |
| FIN-IND-001 | BUG | P1 | Caso válido fica indisponível porque o caller C09 omite o verificador obrigatório | WP10 / composição; WP11 adjacente |
| FIN-IND-002 | BUG | P1 | Resolver instalado de case-event C17 recebe interface antiga e retorna unavailable | WP10.T07 / integração WP11–WP14 |
| FIN-IND-003 | BUG | P1 | Campanha é gravada sem o grant privado que deveria proteger suas chaves | WP10.T01 / S0; WP13 consumidor |
| FIN-IND-004 | BUG | P2 | Submit do Workbench falha antes dos POSTs de análise financeira | WP01 / S1-A; WP10 integração |
| FIN-IND-005 | NEEDS_EVIDENCE | P1 | Jornada da mesma escolha até 15.000/15.001 termina no deadline antes das assertions finais | WP13 + WP11; WP03/WP10/S0 |

**Critério de classificação:** BUG exige defeito concreto de código ou contraprova executada; o resultado em runtime é explicitamente marcado quando apenas inferido. INFERENCE seria uma hipótese que ainda depende de cenário alcançável não demonstrado; nenhuma foi promovida a finding autônomo. NEEDS_EVIDENCE identifica ausência de prova suficiente e não acusa cálculo errado por timeout. Os registros estruturados completos estão em [findings.json](findings.json).

### FIN-IND-001 — Composição C09 omite verifyScenarioOperations e recusa a leitura de caso válido

**BUG · P1 · OPEN. Owner: WP10 / composição CLI; WP11 fornece a porta; S0 integra.**

**Arquivo/linha no pin:**

- [`apps/cli/src/sucafina-product/business-services.ts:102–120`](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/apps/cli/src/sucafina-product/business-services.ts#L102-L120)
- [`modules/sucafina/Sucafinav1/product/decisions/case-port.ts:14–21`](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/modules/sucafina/Sucafinav1/product/decisions/case-port.ts#L14-L21)
- [`modules/sucafina/Sucafinav1/product/decisions/case-port.ts:76–105`](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/modules/sucafina/Sucafinav1/product/decisions/case-port.ts#L76-L105)
- [`apps/cli/src/sucafina-product/business-services.ts:243–261`](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/apps/cli/src/sucafina-product/business-services.ts#L243-L261)

**Entrada/cenário.** Caso persistido válido, ator participante autorizado e Request vigente, sem alternativas nem referências externas pendentes. A composição real instancia a porta exatamente como no pin.

**Resultado observado.** O caller omite o callback obrigatório. O check exato registra TS2741 no caller. A porta chama input.verifyScenarioOperations nas linhas 85–86 dentro do try.

**Consequência inferida a partir do código/evidência.** Se carregada apesar do typecheck, a chamada a undefined lança; o catch converte em unavailable/case-state-unavailable. Nenhuma execução nova foi realizada.

**Esperado pelo critério.** A composição fornece o verificador do produtor e permite retomar o caso com autorização, operações e versão atuais; fonte inválida continua recusada. Critérios: `WP11.T01.CHK.01`, `WP11.T01.CHK.18`, `WP11.T01.DOD.01`, `C09`, `CAMP.CMP.04`.

**Consequência para o consumidor.** resolveCase/withCase dependem da mesma porta: o caso autorizado fica indisponível e a preparação de forecast não alcança o produtor.

**Informação adicional ao registro anterior.** Diagnóstico externo de campo obrigatório ausente já registrado. Cenário mínimo discriminante, caller→callee→catch e consumidores atingidos demonstram indisponibilidade funcional, além da lista de TS. [Recibo anterior no pin](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP11/finance-resume-20261114/external-typecheck-R2.json).

**Limites da afirmação.** Não atribuímos nova regressão financeira nem observação de runtime instalado. Runs vinculados: [43620788510](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620788510).

**Recheck dirigido, fora desta revisão.** No novo SHA explicitamente indicado, provar leitura real de caso pela composição CLI e preparo de forecast, com positivos autorizados e negativos de operação/fonte/revogação. Revisão atual não implementa nem executa esse recheck.

### FIN-IND-002 — Resolver case-event C17 é montado com assinatura antiga e retorna unavailable

**BUG · P1 · OPEN. Owner: WP10.T07 / createSfAtlasBusiness; integração WP11–WP14; S0.**

**Arquivo/linha no pin:**

- [`modules/sucafina/Sucafinav1/product/host-binding/business-context.ts:170–173`](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/modules/sucafina/Sucafinav1/product/host-binding/business-context.ts#L170-L173)
- [`modules/sucafina/Sucafinav1/product/host-binding/business-context.ts:201–218`](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/modules/sucafina/Sucafinav1/product/host-binding/business-context.ts#L201-L218)
- [`modules/sucafina/Sucafinav1/product/decision-memory/source-access.ts:174–202`](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/modules/sucafina/Sucafinav1/product/decision-memory/source-access.ts#L174-L202)
- [`apps/cli/src/sucafina-product/business-services.ts:187–190`](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/apps/cli/src/sucafina-product/business-services.ts#L187-L190)

**Entrada/cenário.** BusinessEvidenceRef case-event válido, installation/project/digest corretos, Request vigente e evento presente no ledger canônico C09. A porta cases do factory superior pode estar funcional.

**Resultado observado.** createSfAtlasBusiness fornece host/state/authorizeCase/authorizeEvidence; o factory atual exige host/cases. O check exato registra TS2353 no argumento state.

**Consequência inferida a partir do código/evidência.** No ramo válido, input.cases.read encontra cases ausente e o catch termina em state:unavailable. A mesma instância é instalada no router e na prova de continuidade.

**Esperado pelo critério.** Resolver o evento oficial por DecisionCasePort, com autorização atual, identidade, versão, digest e dependências; ledger oficial e Atlas derivado preservam sua relação. Critérios: `C17`, `C09`, `CAMP.INV.04`, `CAMP.INV.06`, `CAMP.CMP.04`.

**Consequência para o consumidor.** Contexto/recall que exige resolução ou continuidade desse evento legítimo fica indisponível na composição. É independente de FIN-IND-001.

**Informação adicional ao registro anterior.** Incompatibilidade de argumento state já registrada em diagnósticos externos. Ligação exata com o resolver instalado e seu resultado unavailable; o green de calculation-persistence não atravessa esse caminho. [Recibo anterior no pin](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP11/finance-resume-20261114/external-typecheck-R2.json).

**Limites da afirmação.** Não afirmamos que toda modalidade de emitFromLedger falhe por este ponto; o writer tem sua própria leitura de cases. Nenhum runtime foi executado. Runs vinculados: [43620788510](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620788510).

**Recheck dirigido, fora desta revisão.** Em SHA posterior específico, evento aceito C09→resolver real→contexto/continuidade C17, com avanço de caso, fonte alterada, revogação e replay. Não usar BCS substituído para fechar a composição.

### FIN-IND-003 — Provider C08 permite gravar campanha sem o grant privado exigido pelo consumidor

**BUG · P1 · OPEN. Owner: WP10.T01 / provider C08 e S0; WP13 é consumidor afetado.**

**Arquivo/linha no pin:**

- [`modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts:81–95`](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts#L81-L95)
- [`modules/sucafina/Sucafinav1/product/portfolio/campaign.ts:273–298`](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/modules/sucafina/Sucafinav1/product/portfolio/campaign.ts#L273-L298)
- [`modules/sucafina/Sucafinav1/test/product/wp13/campaign.test.ts:41–78`](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/modules/sucafina/Sucafinav1/test/product/wp13/campaign.test.ts#L41-L78)
- [`modules/sucafina/Sucafinav1/test/product/wp13/campaign.test.ts:172–176`](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/modules/sucafina/Sucafinav1/test/product/wp13/campaign.test.ts#L172-L176)

**Entrada/cenário.** createPortfolioCampaign + createSfProductState + openLocalStore reais. omitWriteAuthority:true retira proposalCoverageWrites do provider, preservando autorização ordinária de preferences e a coleção privada do consumidor.

**Resultado observado.** Run 43619812123, job 132522704978: teste campaign metadata needs the host's private writer grant esperava unavailable/campaign-locked-proof-unavailable; recebeu ok com campanha v1. save passa por commit e readOriginal. A assertion posterior de campaign-not-created não foi alcançada.

**Consequência inferida a partir do código/evidência.** O provider filtra somente sf:proposal-coverage: e sf:criterion-rule:, enquanto o consumidor escreve sf:portfolio:campaign:. Assim a ausência do grant não bloqueia essas alterações.

**Esperado pelo critério.** Sem a capability privada reconhecida pelo provider, a gravação canônica da campanha deve ser recusada e a campanha deve permanecer inexistente. Critérios: `C08`, `CAMP.INV.02`, `WP13.INV.10`, `WP13.T01.DOD.01`.

**Consequência para o consumidor.** Autorização ordinária de preferences basta para persistir metadados canônicos de campanha; a proteção privada anunciada pelo consumidor não é aplicada pelo provider às chaves escritas.

**Informação adicional ao registro anterior.** Delta de provider private writer grant/sourceFence/checkNamespaces não consumido já declarado. Contraprova executada aceita e persiste, em vez de falhar fechada; filtro exato de prefixos explica o resultado, com três blobs inalterados até o pin. [Recibo anterior no pin](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP13/finance-resume-20261114/campaign-delta-R3.json).

**Limites da afirmação.** Não afirmamos exploração pela instalação completa nem autenticação empresarial qualificada; autorização, casos e fontes do harness são controlados. Não atribuímos o run inteiro de R4 ao pin. Runs vinculados: [43619812123](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43619812123).

**Recheck dirigido, fora desta revisão.** Em SHA posterior específico, provar recusa sem grant, positivo somente com a capability correta, persistência/reabertura e composição real; preservar os negativos existentes. Revisão não prescreve nem aplica patch.

### FIN-IND-004 — Formulário Workbench interrompe Start analysis antes de chamar o produtor financeiro

**BUG · P2 · OPEN. Owner: WP01 / S1-A; WP10 comprova a composição.**

**Arquivo/linha no pin:**

- [`modules/sucafina/Sucafinav1/product/ui/forecast-analysis.ts:20`](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/modules/sucafina/Sucafinav1/product/ui/forecast-analysis.ts#L20)
- [`modules/sucafina/Sucafinav1/product/ui/forecast-analysis.ts:80`](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/modules/sucafina/Sucafinav1/product/ui/forecast-analysis.ts#L80)
- [`modules/sucafina/Sucafinav1/product/ui/forecast-analysis.ts:103–112`](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/modules/sucafina/Sucafinav1/product/ui/forecast-analysis.ts#L103-L112)
- [`modules/sucafina/Sucafinav1/product/interface/http.ts:160–164`](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/modules/sucafina/Sucafinav1/product/interface/http.ts#L160-L164)
- [`apps/cli/src/sucafina-product/host-context.ts:570`](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/apps/cli/src/sucafina-product/host-context.ts#L570)
- [`apps/cli/src/sucafina-product/business-services.ts:243–261`](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/apps/cli/src/sucafina-product/business-services.ts#L243-L261)

**Entrada/cenário.** Página de caso autorizado que satisfaz as pré-condições do formulário: runtime.analyses e forecastInputs, skill sf-explicar-forecast, modelo e duas referências Planner distintas. Submissão válida por botão ou teclado.

**Resultado observado.** Markup: <button>Start analysis</button> sem atributo type; cancel é type=button. Script procura button[type=submit]. Listener cancela envio e usa button.disabled antes do try.

**Consequência inferida a partir do código/evidência.** O seletor por atributo não corresponde ao tipo implícito. button é null e a atribuição lança TypeError antes de POST workbench-forecast/workbench-analysis, sem entrar no tratamento do try.

**Esperado pelo critério.** A ação válida inicia o preparo autorizado e a execução assíncrona da análise financeira, permitindo consumo persistido posterior. Critérios: `WP01.T05.DOD.01`, `WP01.T05.DOD.30`, `WP01.T05.CHK.30`, `WP05.T01`, `CAMP.DOD.02`, `CAMP.CMP.04`.

**Consequência para o consumidor.** A entrada real da análise financeira fica inutilizável pelo formulário, embora o produtor forecastInputs esteja publicado.

**Informação adicional ao registro anterior.** Defeito herdado: forecast-analysis.ts é idêntico em ec052c2c3bef96f492512f3d5f663919580f25c8 e no pin. Causa funcional concreta na entrada real; não repete a lacuna genérica de prova UI/BI nem atribui introdução aos deltas resume.

**Limites da afirmação.** Não executamos navegador. Este ponto é independente, mas na composição atual a indisponibilidade de caso de FIN-IND-001 pode impedir chegar às suas pré-condições. Endpoints diretos e cálculo não são declarados defeituosos por este finding. test/product/wp01/workbench-analysis.test.ts:56–74 faz POST direto, ramo start opcional e caso inexistente; não executa o submit/DOM. Testes browser lidos de outros fluxos não cobrem esta ação.

**Recheck dirigido, fora desta revisão.** No SHA corrigido pelo owner, observar a submissão no Workbench real até preparo/run e resultado consumível, além de caso inválido e falha apresentada. Não substituir pelo POST direto.

### FIN-IND-005 — Jornada do mesmo caso/escolha até a fronteira 15000/15001 não concluiu a prova

**NEEDS_EVIDENCE · P1 · OPEN. Owner: WP13 + WP11; WP03 fornece prova canônica; WP10/S0 compõem e qualificam.**

**Arquivo/linha no pin:**

- [`modules/sucafina/Sucafinav1/test/product/wp13/coverage-sensitivity-integration.test.ts:124–188`](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/modules/sucafina/Sucafinav1/test/product/wp13/coverage-sensitivity-integration.test.ts#L124-L188)
- [`modules/sucafina/Sucafinav1/test/product/wp13/coverage-sensitivity-integration.test.ts:169–186`](https://github.com/gustavomhss/Orchestra-SF/blob/4f82cf10ae6766c56e9bf1862fc5198a5246cb5c/modules/sucafina/Sucafinav1/test/product/wp13/coverage-sensitivity-integration.test.ts#L169-L186)

**Entrada/cenário.** AI-RENEWAL-OMITTED-CATEGORY: renovação USD240000, custo conhecido USD210000 e mínimo USD20000; escolher com treinamento omitido, confirmar training=40000 no mesmo caso e preservar a escolha histórica enquanto a análise atual passa a total250000, diferença−10000 e teto15000.

**Resultado observado.** Run 43620619049, snapshot c7a0956f850525a03ccd28b26cb8d90808f4d83f, parent R4: 0 pass / 1 fail / 10 expects. A execução não conclui createRenewalChoiceHistory; o último checkpoint observado é transition-confirmed:complete. O erro WP11_FIXTURE_DEADLINE_EXCEEDED registra 180000 ms antes das assertions de teto 15000 e preservação da escolha. R4→pin altera somente dois outros arquivos de teste e dois recibos.

**Consequência inferida a partir do código/evidência.** A seleção não fornece a evidência requerida para essa jornada no pin. A invariância dos arquivos relevantes conserva a lacuna, sem afirmar nova execução no pin.

**Esperado pelo critério.** Evidência concluída liga o mesmo caso, encarnação e escolha às versões antigas/novas: omissão permanece pending; confirmação gera250000/−10000;15000 atende mínimo20000 e15001 falha, com histórico e reavaliação atuais preservados. Critérios: `WP11.T02.CHK.21`, `WP11.T03.CHK.20`, `WP13.T02.CHK.20`, `WP13.T03.CHK.20`, `C10`, `CAMP.QLT.06`, `CAMP.CMP.04`.

**Consequência para o consumidor.** Não é possível qualificar a decisão financeira integrada ou sua retomada apenas com os verdes parciais disponíveis.

**Informação adicional ao registro anterior.** Timeouts e limitações de jornada já existiam; não são recontados como novos BUGs. Seleção exata pós-reconciliação R4, fase precisa do deadline, parent/tree e diferença até o pin conferidos independentemente; as assertions finais não foram alcançadas.

**Limites da afirmação.** Timeout não demonstra fórmula errada, nem permite concluir que a jornada sempre falhará. Greens de handoff/BI e solver isolado não fecham o critério integrado. Runs vinculados: [43620619049](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620619049), [43619812123](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43619812123), [43615428441](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43615428441).

**Recheck dirigido, fora desta revisão.** Recheck dirigido em novo SHA declarado deve demonstrar a jornada completa e, separadamente, persistência/reabertura real e replay autorizado. Não qualificar aumento de timeout, skip ou reconstrução de serviços no mesmo store como equivalentes.


## 4. Deltas realmente consumidos

### 4.1 Ancestralidade

Todos os quatro commits de origem são ancestrais do pin; cada compare tem behind=0 e merge-base igual à origem. Isso prova linhagem, não identidade de conteúdo ou integração.

| Origem | Commit | Ahead / behind do pin | Resultado |
| --- | --- | --- | --- |
| WP03 / #22 | [`90c467cea436daa24987ad68a588a7d80f91064e`](https://github.com/gustavomhss/Orchestra-SF/commit/90c467cea436daa24987ad68a588a7d80f91064e) | 101 / 0 | Sim; merge-base igual à origem |
| WP05 / #24 | [`0881fee21f07bf8a9a1153d7d55727837cdf497a`](https://github.com/gustavomhss/Orchestra-SF/commit/0881fee21f07bf8a9a1153d7d55727837cdf497a) | 100 / 0 | Sim; merge-base igual à origem |
| WP11 / #40 | [`e8949be0e31952d5be4987c099003cd0b46e2add`](https://github.com/gustavomhss/Orchestra-SF/commit/e8949be0e31952d5be4987c099003cd0b46e2add) | 95 / 0 | Sim; merge-base igual à origem |
| WP13 / #37 | [`7defe5c9930774c6aa5a15a5f677b4406d08683c`](https://github.com/gustavomhss/Orchestra-SF/commit/7defe5c9930774c6aa5a15a5f677b4406d08683c) | 94 / 0 | Sim; merge-base igual à origem |

### 4.2 Presença de blobs nos diretórios próprios

Comparação dos arquivos diretos de produto/teste das origens com o pin. Nenhum arquivo original desapareceu nesse recorte. “Modificado” não significa equivalência semântica; “novo” é relativo àquela origem, podendo já existir em #35. A última coluna compara separadamente o pin com #35.

| WP | Diretório | Arquivos na origem | Exatos no pin | Modificados | Novos versus origem | Alterados/adicionados versus #35 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| WP03 | `product/planner` | 46 | 32 | 14 | 2 | 2 |
| WP03 | `test/product/wp03` | 29 | 22 | 7 | 11 | 4 |
| WP05 | `product/analytics` | 25 | 15 | 10 | 2 | 2 |
| WP05 | `test/product/wp05` | 37 | 29 | 8 | 5 | 0 |
| WP11 | `product/decisions` | 56 | 45 | 11 | 0 | 8 |
| WP11 | `test/product/wp11` | 49 | 30 | 19 | 6 | 16 |
| WP13 | `product/portfolio` | 30 | 25 | 5 | 1 | 25 |
| WP13 | `test/product/wp13` | 32 | 24 | 8 | 1 | 30 |

O manifesto [provenance.json](provenance.json) contém **332 paths** com blob da origem, blob de #35 e blob do pin. São 304 arquivos das origens, com 222 blobs idênticos e 82 modificados, mais 28 novos no recorte. Não se estende essa contagem a contratos, runtime, UI ou outros diretórios.

Os deltas materiais do resume estão presentes:

- **WP03:** `plannerHeadcountInputs` exporta a normalização usada pelo domínio para qualificar HR; `port.ts` a consome. `scenario-bi.ts` acrescenta BI09/10 a partir dos pares persistidos, conservando C10 e releitura de fontes. R5 inicializa Dashboard/Procurement no fixture antes do estado C08.
- **WP05:** `factory.ts` admite `projectedScenario`; `waterfall.ts` conserva a indicação de subtotal conhecido quando condicionado. Os testes WP05 não mudam em relação a #35.
- **WP11:** o delta final de #40 da porta de caso foi reconciliado com fences de Request/lease. Três testes (`case-read-fence`, `case-egress-fence`, `criterion-rules`) são blobs exatos da origem; outros são reconciliados, não substituídos cegamente. R4 acrescenta projeção histórica controlada ao teste de escolha/aplicação.
- **WP13:** o núcleo W20 de #37 foi consumido; 49 de seus 62 blobs produto/teste permanecem exatos e 13 mudam. Há dois arquivos novos: `read-snapshot.ts` e `campaign-request.test.ts`. Prova/history/reconciliation e Request da campanha foram reconciliados; reserva anterior ao dispatch orienta as expectativas de handoff.

**Fronteiras externas não consumidas:** no pin não existem `apps/cli/src/sucafina-product/{bi-services,portfolio-services,planner-calculation-services,planner-calculation-history}.ts`. Recibos de composição externa que mencionam esses arquivos não os fazem existir no candidato. A composição disponível continua contendo FIN-IND-001/002; o delta de proteção da campanha do provider WP10 continua ausente. `forecastInputs`, por outro lado, está efetivamente montado: FIN-IND-004 alcança uma entrada real, quando suas pré-condições de página são satisfeitas.

## 5. Auditoria das evidências existentes

Foram conferidos **12 runs de produto** e o **check diretamente no SHA fixado**: metadata, commits/parents/trees, request normalizado `.ci-run.json`, comparação parent→snapshot, seleção e logs completos. Os 12 snapshots têm um único parent de produto e apenas `.ci-run.json` adicionado. [evidence.json](evidence.json) preserva SHA completo, árvore, job, argumentos, casos reportados e limites de cada run.

### 5.1 Check do SHA exato

[Run 43620788510 / job 132525772062](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620788510/job/132525772062), head `4f82cf10ae6766c56e9bf1862fc5198a5246cb5c`, **failure**:

- Typecheck: exit 2, **115 diagnósticos**; zero no recorte próprio Planner/Analytics/Decisions/Portfolio, testes WP03/05/11/13 e runtime/planner. Isso **não é PASS do pacote**: os consumers defeituosos produzem erros reais, inclusive os dois primeiros findings.
- Guards: exit 1, **78 regras**, 1.471 paths, **43 gates e 15 warnings**, zero erro de engine. Mantidos como falha existente, sem findings cosméticos repetidos.
- O check não executa testes de produto. Os logs foram lidos; ZIPs de artefatos não foram baixados/re-hasheados nesta revisão.

### 5.2 Runs e alcance

“Pass/fail” é por run, sem soma entre versões ou seleções sobrepostas. Parent e snapshot abreviados nesta tabela têm SHA e árvore completos em evidence.json.

| Run/job | Parent produto | Snapshot | Pass / fail | Expects | Seleção e limite |
| --- | --- | --- | ---: | ---: | --- |
| [43615424219](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43615424219/job/132509297971) | `3c20b46b` | `1ee66735` | 8 / 1 | 254 | Rate identity + HR port + scenario qualification. R1:fixture de igualdade de snapshot falha. R2 posterior tem run distinto verde; preservado o resultado histórico. |
| [43615428441](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43615428441/job/132509311266) | `3c20b46b` | `4c84847a` | 6 / 4 | 147 | Sensibilidade/read scope + coverage-sensitivity. R1:3 timeouts de persistência/replay omitido/bundled/confirmed (300000ms) e1 deadline humano (180000ms);6 negativos/escopo verdes não fecham a jornada. Não atribuído ao pin. |
| [43616600555](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43616600555/job/132512903901) | `88b9b6bf` | `4d9eded5` | 2 / 0 | 64 | Rate identity: normalização canônica numérica, missing versus zero e revogação final. Seleção de um arquivo, snapshot R2; não prova todas as páginas Planner/HR. |
| [43616603779](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43616603779/job/132512914754) | `88b9b6bf` | `e3c10700` | 32 / 0 | 393 | 8 arquivos WP11: current choice, read/egress/lease fences, case operation/port, criterion rules, renewal revision. Snapshot R2; não fecha a composição CLI defeituosa nem a versão posterior integral. |
| [43618462688](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43618462688/job/132518604113) | `9de58454` | `f74733ed` | 19 / 0 | 487 | 8 arquivos WP11 de histórico, indeterminado, Hot Topic, replay/lease/egress, resultados, cobertura/caso e prepared execution. Snapshot filho de R3. Algumas fixtures mudam depois; somente evidencia a seleção/versão descrita. |
| [43619812123](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43619812123/job/132522704978) | `229d66fa` | `07f905d3` | 56 / 3 | 582 | 11 arquivos WP13: histórico, reconciliação/preço, source-scenario, handoffs, campanha, stores/candidatos. Falhas: jornada source-scenario timeout; envelope de reserva10→11 (corrigido R5); private writer grant aceita campanha (FIN-IND-003, blobs inalterados). Não promover56 positivos a aceite do conjunto. |
| [43619817826](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43619817826/job/132522722250) | `229d66fa` | `f004a08d` | 2 / 4 | 23 | 3 arquivos: scenario-bi, scenario-bi-complete, factory-selection. 4 setup failures SF_SOURCE_IDENTITIES_UNAVAILABLE. 2 positivos de N/A/shared completo e factory são delimitados; run inteiro vermelho. Bootstrap R5 corrige setup e run43620858830 cobre quatro casos. |
| [43619824316](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43619824316/job/132522741789) | `229d66fa` | `711f156d` | 1 / 0 | 71 | Escolha→preparação/revisão→grant separado de apply→comando Planner e recibo. Adição R4 usa reader histórico controlado de refs exatas; não autentica histórico instalado, novo C17 ou restart do provider. |
| [43620049903](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620049903/job/132523487634) | `229d66fa` | `47f13c88` | 1 / 0 | 20 | Persistência SQLite de requests/resultados C08 e replay Planner com ancestralidade de dois níveis. BCS substituído; autorizações/verifySnapshot permissivos; recall vazio e emitFromLedger rejeitado por fixture. Não atravessa case-event/Atlas instalado. |
| [43620619049](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620619049/job/132525249982) | `229d66fa` | `c7a0956f` | 0 / 1 | 10 | Exatamente a jornada nomeada de escolha humana no mesmo caso e limiar15000. Deadline na preparação transition-confirmed:complete antes das assertions de escolha/15000. R4, não execução no pin. |
| [43620858830](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620858830/job/132525991986) | `4f82cf10` | `a646c300` | 4 / 0 | 77 | Pares de cenário→BI09/10: condicionado, sentido, ausência/zero/FX, adiamento e revogação/final lease. Produtores reais em fixture; sem entrypoint bi-services no pin, sem UI/native/MCP instalados. |
| [43621178540](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43621178540/job/132526990338) | `4f82cf10` | `4d998e9e` | 2 / 0 | 133 | Escolha C08 e dois efeitos de domínio com recibos; falha Procurement depois da reserva não autoriza redispatch. Seleção cirúrgica de handoff; não prova cobertura/sensibilidade, UI instalada ou Atlas. |

Os **seis testes verdes diretamente ligados ao pin** são quatro de cenário/BI no filho `a646c300…` e dois de handoff no filho `4d998e9e…`. Isso qualifica suas seleções. Não há uma execução verde, no pin, de toda a frente ou da jornada completa até 15.000.

Os dois failures R4 corrigidos por R5 têm causa/delta discriminados: bootstrap das identidades de fonte e aggregateRevision do envelope após a reserva. A correção de envelope conserva a versão da namespace receipts e as comparações integrais; o parent→pin não altera código de produto. Isso não corrige FIN-IND-003 nem resolve o deadline de FIN-IND-005.

### 5.3 Fronteiras das fixtures

- **C17 / calculation-persistence:** SQLite e reabertura, requests/resultados C08, replay Planner e ancestry de dois níveis são reais. Porém BCS e callbacks de autorização/verifySnapshot são fornecidos pelo teste; `recall` retorna vazio, `emitFromLedger` rejeita e o ledger semeado está vazio. O verde não atravessa o resolver instalado defeituoso, evento aceito C09, publicação/recall Atlas ou scanner/bundle.
- **Histórico de escolha após apply:** o teste usa escolha, grant separado, comando e recibo reais. A adição R4 aceita referências históricas exatas por reader controlado; isso comprova metadata/joins nessa projeção, sem autenticação histórica instalada ou novo replay C17.
- **Campanha sem grant:** provider, LocalStore e persistência são reais na fronteira que falha. Auth/casos/candidatos/fontes são controlados; não se afirma exploração pelo produto instalado.
- **Sensibilidade:** reconstrução de serviços sobre o mesmo LocalStore vivo não prova processo novo ou cold restart. A seleção da escolha humana termina no fixture antes de chegar às assertions finais.
- **Workbench:** POST direto não executa o listener DOM que contém FIN-IND-004. Setup/upload browser skipped e Omni “not applicable” não constituem testemunho da jornada instalada.

## 6. Matriz de cobertura por task

Todas as tasks tiveram norma lida. A tabela distingue o caminho inspecionado e o que continua fora do que foi demonstrado; nenhuma linha é aceite da task.

| Task | Leitura técnica | Resultado / limite |
| --- | --- | --- |
| WP03.T01 | Produtor canônico runtime/planner→planner-accounts→port; comparação, cenário, moeda, ausência/zero/inherited e C08. | Sem novo finding concreto; Sem nova execução; não qualifica UI/native/MCP instalados. |
| WP03.T02 | Norma completa; semântica de edição mensal/CAS/locks e boundaries lidas nos produtores/diffs pertinentes. | Sem novo finding concreto; Não reexecutadas todas as páginas OPEX/CAPEX, teclas/preview/importação/conflitos. PLANNER-UI-LIMIT-01 permanece. |
| WP03.T03 | Normalização canônica HR, identidade numérica de rate, taxa ausente versus zero, meses independentes e redaction. | Sem novo finding concreto; R1 falhou; R2 tem seleção corrigida. Não extrapolar para toda página HR instalada. |
| WP03.T04 | Contratos e oráculos FX01–03, unidade/currency, ausência de cotação e escopo de versão. | Sem novo finding concreto; Não reconstruídas todas as jornadas de CRUD FX/catálogos ou annual/spread/reset. |
| WP03.T05 | Overview, sinais/versões, base590000→602000/596000, fontes e reader atual da comparação. | FIN-IND-004; Finding na entrada consumidora; equivalência numérica não prova a UI instalada. |
| WP05.T01 | Waterfall/BI financeiro, projeção canônica, fonte exata e seleção protegida. | FIN-IND-004; BI-LIMIT-01/02 e entrada instalada não qualificados; consumer bi-services ausente no pin. |
| WP05.T02 | Norma completa; estados/autoridade/projeção e regra FTE versus custo lidos nas fronteiras compartilhadas. | Sem novo finding concreto; Sem prova em execução de todos os gráficos de contribuição e FTE. |
| WP05.T03 | Norma completa e fronteiras de autorização/factory; Procurement aging/stock não foi o foco da auditoria de execução. | Sem novo finding concreto; Nenhum PASS atribuído a todos os gráficos ou ao drilldown instalado de Procurement. |
| WP05.T04 | Norma completa; catálogo, seleção/factory, capabilities e navegação por referências. | Sem novo finding concreto; Factory test usa fontes controladas. Tickets/agenda e destinos/foco não foram todos exercitados. |
| WP05.T05 | BI09/10, C10 completo/condicionado, zero/null/FX, N/A e shared sem dupla soma, escopo/revogação. | FIN-IND-005; Novo produtor e factory estão presentes; consumidor externo/limiar integrado não estão qualificados. |
| WP11.T01 | Caso durável, porta, Request/lease, segunda leitura final, histórico e callers CLI. | FIN-IND-001, FIN-IND-002; Wiring concreto impede qualificar retomada C09/C17. |
| WP11.T02 | Alternativas, cobertura, result/request stores, ancestry/replay e escolha ligada às versões. | FIN-IND-002, FIN-IND-005; C17 de cálculo usa BCS substituído; não é ledger→Atlas instalado; fronteira15000 não concluiu. |
| WP11.T03 | Escolha, grants humanos separados, preparação/revisão, payload/caso/versão e preservação da escolha. | FIN-IND-001, FIN-IND-005; Reader histórico R4 controlado; não é autorização histórica instalada nem journey15000 concluída. |
| WP11.T04 | Reserva pré-dispatch, mutação+recibo no domínio, parcial/indeterminado, rollback local, retry e recuperação. | Sem novo finding concreto; Evidência delimita domínios/fixtures selecionados; sem promessa de transação global ou UI instalada. |
| WP13.T01 | Campanha/candidatos, commitments, CAS, Request e fronteira de escrita com C08. | FIN-IND-003; Composição completa createPortfolioProduct não montada; grant falha na fronteira real do provider em harness controlado. |
| WP13.T02 | Combinações, conflito de componentes, limites da exploração, cobertura por candidato, adapter real e fontes. | FIN-IND-005; Sem novo contraexemplo numérico demonstrado; não qualifica inversão completa no mesmo caso. |
| WP13.T03 | Sensibilidade, unidades, solver/prova de fronteira, known-components e55000/15000; sem ótimo/corte fictício. | FIN-IND-005; Timeouts mantidos. Reconstruir serviços sobre LocalStore vivo não prova cold restart. |
| WP13.T04 | Handoff para WP11, escolha e efeitos correlacionados, dois domínios, reserva, recibos e no redispatch. | Sem novo finding concreto; 2 positivos pinados cobrem esta seleção; não substituem sensibilidade/campanha/Atlas. |

## 7. Bloqueios preservados e hipóteses não promovidas

`FIN-R2-REV-01` permanece **OPEN_SHARED_CONTRACT_INTERPRETATION**, com WP10/S0, sobre COMMON.INV.11 e composição C08/C17 de `readPortfolioSnapshot`. Não foi reinterpretado nem reaberto com ID novo.

`BI-LIMIT-01`, `BI-LIMIT-02` e `PLANNER-UI-LIMIT-01` permanecem limites existentes. A falta genérica do provider WP13 também não gera um finding separado; FIN-IND-003 acrescenta o comportamento permissivo concreto da ausência de grant. `sourceFence`/`checkNamespaces` ignorados pelo provider não foram convertidos automaticamente em alegação de corrida: o comportamento do lock do LocalStore precisa integrar qualquer prova desse tipo.

Não foram elevados a findings: comparação potencial de `comparisonRef` entre preview/promote dependente de provider não montado; falso ciclo `activeEvents`; corrida histórica sem cenário alcançável; resultado arbitrário sem demonstração de emissão pelo produtor canônico. Evitou-se usar uma hipótese como BUG.

## 8. Handoff da revisão

A revisão documental está concluída. O próximo trabalho pertence aos owners dos pontos de composição e ao integrador S0. Cada recheck deverá declarar novo SHA/tree e comprovar o caso discriminante do finding correspondente; evidência nova não reescreve este corte.

Para a frente Financeira, continuam necessários: callers reais C09/C17 funcionais e autorizados; grant de campanha aplicado pelo provider; submissão real de forecast; a jornada da mesma escolha com treinamento confirmado e fronteira 15.000/15.001; e prova instalada de consumo BI/histórico/persistência onde os recibos atuais são controlados. A aceitação global permanece fora deste parecer.

**Arquivos deste recibo:** [findings.json](findings.json), [evidence.json](evidence.json), [provenance.json](provenance.json), [coverage.json](coverage.json). Nenhum arquivo de produto ou recibo anterior é modificado.
