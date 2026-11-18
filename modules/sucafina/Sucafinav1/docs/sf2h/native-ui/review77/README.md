# Missão77 — parecer independente do plano da sidebar nativa

## Parecer: FIX-FIRST

A direção da [PR76 no SHA revisado](https://github.com/gustavomhss/Orchestra-SF/blob/2f143330a0a44d34eb764ebfb851804c504edb6d/modules/sucafina/Sucafinav1/docs/sf2h/native-ui/README.md) é compatível com o Orchestra: quinze destinos reais na mesma sidebar, junto de Chat/Inbox, páginas Solid, providers/componentes/tema/i18n existentes e domínios SF preservados. A revisão não recomenda outra arquitetura.

**Não recomendo despachar o plano completo como está.** Há oito lacunas obrigatórias de contrato, comportamento ou responsabilidade. Este diretório entrega a correção concreta de cada uma e uma primeira leva delimitada. Os pacotes podem ser autorizados por S0 após adoção do adendo; esta sessão continua exclusivamente documental.

Iframe, aplicação externa, HTML legado embutido/raspado, segunda sidebar e perda de comportamento não satisfazem integração nativa. Coexistência temporária do legado na migração não recebe crédito de native nem encerra capacidade.

**Atualização concorrente reconhecida:** antes da publicação, PR76 avançou a de7da068… e a stack a C35/e87e22d1…. A [triagem de drift](LATE-DRIFT.md) reconhece F05 tratado documentalmente e avanços parciais em outros contratos; não aprova o novo pacote de115documentos nem seu PDF. Este parecer continua ligado ao SHA exigido pela missão.

## Bases e alcance

| Fonte | Pin/estado |
| --- | --- |
| Pacote missão77 | sf2-control@1f01a01f51521ae39b7a4e730acefde3b9999891 |
| Plano revisado independentemente | PR76 / sf-sidebar-plan@2f143330a0a44d34eb764ebfb851804c504edb6d;14 arquivos,17 pranchas |
| Código inicialmente examinado | faa30fddb7e7b61696b66fd069f51cf18c51125f, terminal60 sobre C28 |
| Drift reconciliado durante a revisão | C31 com seams relidos; depois delta C31→C35/e87e22d163924635bf0b41785c9bc80bf780ac0a, tree be4dec9ee1960b572b6bfc4dee9e0a7d21b2c60c |
| Fonte canônica | dbf9547211d9b0fade619790de7c19c0869b7c7d; T0=2026-11-13T04:01:10Z |
| Autoridade vigente observada | ACK71, lease S0-C-e13-browser71;71 stack,45 checks,S0 epic/AM/final |
| Resultado de produto desta sessão | NOT_RUN; GLOBAL_RELEASE=false |

Foram lidos o pacote completo, AGENTS pertinentes, START/WORKFLOW/COMMON, actor pack S1-R1 e anexos aplicáveis. A revisão foi feita contra arquivos e contratos, sem histórico de conversa do autor do plano. Três frentes de apoio examinaram arquitetura, escopo/UX e API/isolamento; o coordenador consolidou as conclusões e leu as costuras decisivas.

O blob integral da campanha foi confrontado ao índice da PR76: **1.610 IDs únicos, zero ausentes/extras, zero divergências de canonicalPointer;15 WPs,74 tasks,17 contratos,13 jornadas**. Isso confirma a integridade nominal da rastreabilidade. Não confirma1.610 comportamentos nem substitui as ações/estados de cada família.

## Achados obrigatórios

Cada achado em [FINDINGS.json](FINDINGS.json) contém critério canônico, arquivo/linha/pin, cenário causal, correção, owner e rechecagem futura.

| ID | Lacuna material | Correção / fronteira de liberação |
| --- | --- | --- |
| R77-F01 | URL de A, seleção/menu/atalho de B podem divergir | Uma transição atômica para todos os caminhos; N0 cobre parser, comandos, ConnectionGate e seleção visual |
| R77-F02 | Mount/binding/porta nativeHttp são pressupostos, sem produtor público fechado | Discovery metadata com provider confiável e /context SF autenticado; dispatch após prepare, antes do roteador legado |
| R77-F03 | Primeiro admin e retorno de login nativo não têm ciclo completo | Reusar bootstrap só para mapa ausente; bridge opaca e allowlist, sem ampliar cookie/safeReturn ou reativar mapa vazio |
| R77-F04 | Verbos propostos não fecham com admissão; ação/CAS/receipt do piloto indefinidos | Preservar POST humano; fila/detalhe por produtor real; title-save canônico com CAS, fence de owner na mesma transação e resultado incerto sem receipt inventado |
| R77-F05 | Troca de rota/owner pode desmontar draft sem escolha | Guarda anterior à transição, Ficar/Revisar/Descartar, foco e precedência de revogação |
| R77-F06 | Salvar vista de sf-work e entrada preferida não cabem em personal-views | Extensão versionada/migração e reautorização; UI32/N3 aguardam ACK específico |
| R77-F07 | Grid nativo não fecha colagem multi-linha/mês e correção seletiva | Seleção retangular/TSV/locks/preview/CAS por linha e parcial, consumindo monthly-host; bloqueia N4, não o piloto |
| R77-F08 | Tripla FINAL troca o escopo independente de IA por outra divisão | Preservar R1 produto/UX;R2 finanças/permissões/persistência;R3 IA/MCP/Atlas/Relay/documentos/WP14/skills |

Não se trata de afirmar que esses defeitos já foram reproduzidos numa implementação nativa. São lacunas demonstráveis entre promessas do plano, interfaces existentes e obrigações canônicas. O plano já reconhece vários riscos; o parecer fecha as decisões que ainda seriam delegadas ambiguamente.

## Primeira leva entregue

[CONTRACT-FREEZE.md](CONTRACT-FREEZE.md) fixa rotas, discovery, contexto, draft, login/retorno, DTOs, operação, erros e migração. [DISPATCH.md](DISPATCH.md) contém arquivos exclusivos, patches centrais, exports, dependências, critérios, limites e handoff de cada pacote.

| Pacote | Entrega concreta |
| --- | --- |
|77A / N0 | Navegação e owner atômicos; registries, i18n/plural, montagem e geração central |
|77B / N1 | Contratos e API autenticada mínima, discovery/return bridge, fila/detalhe e client tipado |
|77C / N2 | PageFrame, QueryState, RecordTable, ObjectDetail, ChangeReview e contrato de saída |
|77D / N5 | Procurement: fila real → detalhe → revisar alteração → salvar título de PR existente |
|77E / N10+45 | Roteiro/qualificação futura no candidato composto, dois atores/contextos e negativos discriminantes |

A ação escolhida é **editar pr.title em requisição draft/pr_rejected**, por POST real ao endpoint /procurement existente. Ela prova uma mutação de domínio, com CAS, persistência e retorno. **Não é aprovação financeira nem fecha PR/sourcing/PO, M31 ou MI07.** O runtime atual não dá receipt C12 a esse save; perda de resposta não autoriza replay automático.

A capacidade é um integrador e até três autores. Não fazer o piloto esperar MonthlyGrid, Charts e RunState completos: eles permanecem obrigatórios com os consumidores próprios. Autoria independente pode avançar depois da autorização; composição de autenticação e prova live aguardam releases/ACK72/73/74. Geração/freshness precisa incluir os novos outputs Promise/Effect; não há edição manual de generated.

## UX e escopo completo

[BOARD-COVERAGE.md](BOARD-COVERAGE.md) audita as17pranchas, os estados ilustrados e as variantes que precisam se ligar a contrato/owner/critério. [TASK-COVERAGE.json](TASK-COVERAGE.json) conserva o ledger das74tasks e as dependências de todas as famílias.

Os boards têm hierarquia coerente e preservam o shell. Não provam, por si,320 px, zoom200%, teclado/foco, os sete temas ou todas as variantes de papel. Títulos/tabs de Pessoas/Operações/Planner não substituem seus formulários e comandos. As obrigações de views, bulk mensal, decisão/receipt, export completo, documentos, residentes e memória continuam explícitas.

## Drift e gates preservados

Durante a revisão,71 integrou runtime59 (C29), Operations63 (C30) e native64 (C31). O delta foi lido e reconciliado: o código do shell e os produtores determinantes dos oito achados não foram substituídos. host-context recebeu composição native64; a criação da identity e o seam de Procurement continuam válidos. O readonly root de59 é capacidade interna e não autorização de dump/cache/otimização opaca.

C31 está **MATERIAL_COMPOSED_NATIVE_ACTIVATION_HELD**. C29/C30 não têm validação composta nesta sessão. P03, M31/MI07, Reports/quatro jornadas/86 critérios, scanner real, autenticação/privacy/body admission e Native/Relay/Schedule mantêm seus gates. Não se transfere PASS da fonte para o candidato integrado;8 seleções/AM01–06/três FINAL/C-G7/D-G8 continuam com45/S0.

A reconciliação final por delta chegou a C35, conforme LATE-DRIFT; o parecer não congela a integração concorrente. Antes do futuro despacho,71 reconcilia qualquer avanço posterior e as preimages. A branch desta revisão continua derivada de faa30fdd; não faz merge/rebase de produto.

## Entrega e próximo ato de S0

O [HANDOFF77.json](HANDOFF77.json) solicita consumer ACK de71 e decisão de S0 sobre adoção dos oito ajustes e liberação da fundação/piloto. Não há escolha de produto genuinamente bloqueante deixada ao usuário: a primeira leva foi especificada. Preferências futuras e suporte Desktop/cross-origin têm owners/gates próprios, sem reduzir o escopo final.

**Limite cumprido:** somente arquivos em review77; plano original e produto intactos. Zero testes, typechecks, guards, builds, servidores de produto, geração, workflows, AM, merges, deploys, Azure ou mensagens externas. Renderização do PDF e contagem documental não são execução do produto.

Evidências, pins, manifestos de leitura e limites estão em [EVIDENCE.json](EVIDENCE.json). SHA/tree finais e diff completo são registrados externamente na PR desta entrega, evitando autorreferência circular no commit.
