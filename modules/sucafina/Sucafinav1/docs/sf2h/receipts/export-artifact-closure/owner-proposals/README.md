# Missão66 — matriz canônica e proposta inerte de leitura real no Actions

## Estado e autoridade

Este diretório contém análise estática e uma proposta textual. Nenhum workflow, ref, arquivo do repositório, comentário, commit ou teste foi executado/alterado por este agente. A única gravação foi deste material temporário de análise.

O patch `test-ci-sf66-reader-proposal.patch` aplica-se ao blob `9f078f4e37b758691bcd073e5590f05d5444392a` de `.github/workflows/test-ci.yml`, observado em `7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85`. É proposta ao integrador60 para atribuição explícita ao dono de CI. Não pertence à lease66; a lease45 atual também não inclui esse arquivo e proíbe testes de produto na lane de compilação. Não aplicar nem publicar pela branch66.

A proposta reutiliza o protocolo `ci-run-*` e o pedido Bun validado existente. Não cria workflow/ref paralelo, não altera o validador, não modifica guards/allowlists, não reutiliza `astra-check-wp07`, não executa testes de Reports48 e não muda seu gerador.

## Formatos exigidos e produtores existentes

A base de aceitação é o plano `dbf9547211d9b0fade619790de7c19c0869b7c7d`; o pacote66 está em `173c3507e40579f1a1a2dfb068bda40084a678bc`. Prefixo dos paths abaixo: `modules/sucafina/Sucafinav1/`.

| Saída real | Produtor/caminho atual | Critérios canônicos e discriminação necessária |
| --- | --- | --- |
| DOCX e PPTX — revisão preservada e Generate Report legado | `product/reviews/render.ts`, `runtime/reports.ts#createReport`; download legado em `runtime/downloads.ts` | R28, WP07.T04, E08: 25 registros identificáveis, notas longas, >12 linhas, seleção/ordem/contagem, fontes/versões/período/moeda, figuras/tabela, ausência explícita, extração **e renderização** dos arquivos reais; preservado não acompanha alteração da fonte atual; revogação bloqueia bytes. |
| Planner XLSX | `runtime/workbooks.ts#exportPlanner`, nome `IT_Budget_Planner_<year>.xlsx`; kind `xlsx` | WP06.DOD.01/CMP.01/SUC.03; WP06.T01.CHK.05, T01.CMP.02; WP06.T04.CHK.01/INV.01/SUC.01. Sheets Info/OPEX/CAPEX/Headcount/Rate cards/FX rates, versão selecionada, valores/zero/ausência/IDs, roundtrip sem efeito adicional, exclusão de campos/resultados individuais/rate cards sem salary grant. |
| Roster XLSX | `runtime/workbooks.ts#exportMembers`, nome `headcount_export_<date>.xlsx`; kind `members` | WP06.T01.CMP.01/CMP.02 e baseline de All Members/Summary by Leader. Gate admin, data válida, registros e resumo coerentes, auditoria real; não inventar roundtrip de campos que o formato não suporta. |
| OPEX template XLSX | `runtime/downloads.ts#download('opex-template')`, nome `opex-template.xlsx` | Preservação da saída baseline sob WP06.DOD.01/CMP.01. Sheet OPEX, Owner/Annual/Jan–Dec, acesso admin. Template sem dados não prova export financeiro. |
| Procurement register CSV | `runtime/downloads.ts#download('register')`, nome `procurement-register.csv` | WP04.T05.CHK.04/CMP.01 e WP04.INV.03/CMP.03. Somente requests visíveis; identidades/campos de negócio; totals/FX/moedas/base/submissão conservados; restritos ausentes; escaping e fórmula CSV. |
| Suppliers CSV | `runtime/downloads.ts#download('suppliers')`, nome `suppliers.csv` | Mesmos invariantes de export Procurement e privacidade; colunas bancárias só para admin/supplier admin e chave disponível; identidades/estados/comercial/compliance e escaping. |
| PO HTML | `runtime/downloads.ts#download('po')`, nome sanitizado `<PO>.html` | WP04.T05.CHK.04/CMP.01 e WP04.INV.03. PO autorizada, linhas/total/termos/identidade, HTML escapado, moeda/FX/estado financeiro preservados; CSS e legibilidade só se provam lendo/renderizando o HTML real. |
| Dashboard JSON | `runtime/downloads.ts#download('json')` através de `runtime/application.ts#serveDownload`, nome `cio-dashboard.json` | WP06.T01.CHK.04, WP06.INV.03, WP06.T04.CHK.01/INV.01/SUC.01; C17 proíbe namespace privado em backup. Endpoint autentica admin e passa `publicSfData` antes de serializar; import preserva config confiável e referências privadas por identidade. |

Não foi identificado export PDF nem export XLS no plano/rotas atuais consultados. PDF digital/DOCX/texto são entradas de extração WP06.T05/C14; XLS legado é formato de entrada. O produtor de planilha escreve XLSX. Os PDFs desta proposta são cópias produzidas por leitor para inspeção, não novos formatos de export do produto.

Essas correspondências são planejamento da prova, não resultados. Todos os resultados novos dependem dos arquivos emitidos no W exato e das observações da execução. A análise histórica dos quatro CSV/HTML arquivados sob `docs/sf2h/receipts/procurement-exports/attempt-01/files/` confirma os formatos, mas seu W original é `e1fe9561f199dc594a5fd559d06d450253e571bc` e não substitui prova atual66.

## WP07.T04 — IDs exatos

- Checks: `CHK.01`, `CHK.02`, `CHK.03`, `CHK.04`, `CHK.18`.
- DoD: `DOD.01`, `DOD.02`, `DOD.18`.
- Invariantes: `INV.01`, `INV.02`, `INV.18`.
- Qualidade: `QLT.01`, `QLT.02`, `QLT.18`.
- Completude: `CMP.01`, `CMP.02`, `CMP.03`, `CMP.18`.
- Sucesso: `SUC.01`, `SUC.02`, `SUC.18`.

Prefixo de cada ID: `WP07.T04.`. São 21 critérios. Todos estão ligados a E08 no ator S3; os 183 proof_bindings do ator trazem NOT_RUN, sem PASS herdado.

Além da prova de formato, a missão66 exige store/download/reopen preservando bytes/digest/escopo/nome; negativas ungranted/read-only quando aplicável/expired/revoked/path traversal/corrupt/tombstoned; idempotência sem duplicação, tamanho bounded e reads sem efeitos. Rotas de download legadas e artifactRefs persistidos devem ser discriminados; não prometer persistência que um endpoint legado não oferece.

## Obrigação contratual transversal

C05 preserva o snapshot; acesso atual continua revalidado. C06 separa a confirmação humana histórica da validade atual. C10 impede exportar conditioned/pending como complete, inclusive quando a soma numérica estiver certa; unknown não vira zero, cobertura/fontes/moeda/horizonte seguem o produtor. C16 requer o mesmo handler para UI/native/MCP com binding/skill efetivos e revalidação de egress. C17 exclui `__sfProductV1.atlas` de JSON/log/git/browser público e invalida cache/links/arquivos perante revogação/incarnation. Fixture e catálogo não provam execução nativa, paridade nem integração global.

## Contrato de saída proposto aos testes66

1. Executar apenas nomes explícitos de testes Bun sob `Sucafinav1/test/product/export-artifact-closure/*.test.ts`, package sucafina, directory modules/sucafina, runner bun, em `ci-run-linux-*`.
2. Gravar arquivos reais em `${RUNNER_TEMP}/sf66-export-artifacts`; testes distintos usam nomes únicos e manifests independentes `*.manifest.json`. Não gravar no diretório de testes. Para ambientes não CI, eventual fallback de caminho não autoriza executar testes locais.
3. Cada manifest deve ligar bytes, MIME, filename, SHA-256, entrypoint/actor opaco, snapshot/review/source version, formato, seleção e resultados ao teste. Não incluir credenciais ou dados reais privados.
4. A proposta lê todos os manifests JSON e todos os arquivos Office regulares, sem seguir symlinks. Faz roundtrip de leitura por LibreOffice para PDF, extrai texto e rasteriza todas as páginas em PNG. Conserva os originais e verifica digest após leitura.
5. `_inspection/manifest.json` registra SHA do snapshot CI, seus parents, blob do workflow, run/attempt, request, versões de LibreOffice/Poppler/fontes, hashes dos arquivos e resultados por leitor. Falha do leitor ou alteração do original causa saída1; upload roda mesmo com falha para diagnóstico.
6. Os manifests do teste continuam responsáveis pelos checks de CSV/JSON/HTML e fontes/versões. O patch não inventa um parser de produto nem fecha a prova visual de HTML. Também não prova fontes embarcadas: registra resolução efetiva de nomes de fontes no ambiente.
7. Renderização bem-sucedida permanece `visualInspection=PENDING` até alguém inspecionar os PNGs e reconciliar texto/contagens/ordem/conteúdo contra os manifests. Não converter exit0 em aprovação de layout.

O workflow só ativa os passos se **todos** os args forem nomes de testes da pasta66, sem flags adicionais. Essa restrição evita ampliar seleção; se houver necessidade de um flag já permitido pelo validator, o dono de CI deve adaptar a detecção explicitamente antes da execução.

## Interfaces existentes e limite real

- `test-ci.yml`: aceita pedido cirúrgico e executa Bun; hoje não arquiva artefatos genéricos de Bun. Seu upload Lean é específico e não deve ser apropriado; Playwright tem path/config allowlist próprios.
- `astra-wp07-check.yml@astra-check-wp07`: gera e arquiva quatro DOCX/PPTX de Reports48; o manifest registra visualInspection pending. Ref e helpers pertencem a48; nenhum renderer foi observado.
- `astra-compose-check.yml@astra-compose:d317873c18bf224c4c1f4d3425179d12ad53e81b`: checks de compiler/generation/guards em ref fixa45; não tem reader/export. `sf2-scoped-check.yml` autorizado em tese pelo pacote45 ainda não estava implementado na leitura.
- `astra-operations-check.yml`: branches dinâmicas específicas de Operations, ancestralidade e envelope restritos, só typecheck/guards; não serve como lane66 genérica.

O pacote45 precisa fornecer uma interface autorizada e fixa para `bun typecheck` em modules/sucafina e `bun run check:guards --base origin/dev` na raiz, com W/dev/config/run/jobs reais. Não enviar testes de produto pela lane compiler. A extensão textual deste diretório é encaminhada a60 para dono/lease de test-ci, separada do pedido de compiler45.

## Pedido e dedup concretos

Antes de disparar: congelar W, ler source/target/live authority, listar runs e requests ativos, comparar W + request normalizado + workflow blob + seleção/ambiente/host. Reanexar run idêntico se existir; não reaproveitar ref fixa de outro produtor.

O snapshot S deve ter parent W e alteração exclusiva `.ci-run.json`; o pedido usa apenas testes existentes selecionados da pasta66. Criar commit/tree/ref só por GitHub MCP/CAS e a branch efêmera `ci-run-linux-...` única. Ler Actions run/jobs/logs e a linha única de controle Omni associada ao nonce. Não interpretar saída não executada como PASS.

Após upload, usar `github_fetch_workflow_run_artifacts` e `github_download_workflow_artifact(artifact_id, repo_full_name)`; esta última API retorna ZIP reutilizável. Ler os arquivos e PNGs daquela execução, conferindo o vínculo W/S/run/attempt/digests. Não usar credenciais, curl/gh ou download externo paralelo.

Nenhum novo run ou pedido foi disparado por este agente. A observação histórica de runs não substitui nova dedup imediatamente antes do despacho.

## Cobertura de leitura semântica do agente criteria_ci

Foram lidos integralmente os blocos S3: provenance/job/actor/session/assignment; branch_provenance; write_authority; allocation; physical_slot; incoming_outgoing_handoffs; task_output_dependencies; consumer_edges; coverage; dependency_context; execution_proofs; review_assignment/review_sources_read_only; resident completo (5 profiles, 11 skills selecionadas, 8 packs, 32 routes, 6 integrated proofs e políticas); reference_context_rule; resident_handoff_interfaces; resident_gate_requirements; resident_ui; numeric_oracles; metadata mandatory_appendices/code_sources/selection pointers; source_receipt_index/workflow/coverage_source/criterion_ids/completion. Leitura adicional completa de C04/C06/C07/C09–C17 e dos183 proof_bindings concluída.

O root assumiu a leitura integral START/WORKFLOW/COMMON, work_packages WP07 e axiomas, C01/C02/C03/C05/C08, evidence, handoffs/consumer edges/product-acceptance e depois WP00/WP12. Este agente não reivindica leitura completa dos corpos WP00/WP12, dos contratos atribuídos ao root ou de cada arquivo referido por pointer. A união registrada pelo root deve ser usada no ACK.

Fontes complementares efetivamente consultadas: WP06/WP04/WP02/WP03 e coverage do plano, downloads.ts completo, application.ts/serveDownload e referências de UI, trechos dos dois exports em workbooks.ts, dashboard-import.ts, dashboard-backup.ts, public-state.ts, receipt SOURCE-REVIEW/manifest procurement e seus quatro arquivos CSV/HTML, workflows e validator acima. Arquivos longos foram lidos por seleções; não reivindicar leitura integral de todos eles.

## Pontos a registrar sem ampliar lease66

`runtime/application.ts#serveDownload` reautentica na transação antes de gerar e clona `publicSfData`; após geração só há checagem de abort, não segunda ACL. Trata-se de observação estática em path fora de66: qualquer reprodução de revogação concorrente nessa rota deve gerar handoff ao dono em vez de editar o arquivo por66.

A proteção de JSON deve ser testada pelo endpoint real: `download('json')` isolado serializa o snapshot recebido; `serveDownload` remove o namespace privado antes da chamada. Confundir essas fronteiras produziria achado incorreto.

As versões de templates e a perda suportada do roundtrip dependem da família real. XLSX pode carregar valores calculados/fórmulas; a ausência de flags bm que o formato não representa segue normalização original WP06.T04.CHK.01, sem exigir igualdade bit a bit falsa.
