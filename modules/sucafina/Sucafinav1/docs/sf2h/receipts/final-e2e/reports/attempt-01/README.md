# CI-UI-REPORTS — tentativa 01

Estado: **IMPLEMENTED / BLOCKED_COMPOSITION / NOT_RUN**. O delta adiciona o spec nominal e helpers próprios. Não é aprovação da jornada nem fechamento de WP07.

## Escopo entregue

| Cenário | Asserções implementadas |
| --- | --- |
| RPT-01 | Workbench real → seleção/reordenação/preservação; fonte1320→1400; DOCX e PPTX reais; 25 identidades e notas longas; tuplas valor/período/fonte; reabertura; navegação para fonte corrente no mesmo ano. |
| RPT-02 | Resposta humana pela fronteira HTTP real, pin C05 emitido pelo servidor, projeção integral igual à revisão visível; confirmação da observação exata; reuso após reload sem novo write; edição nega selector/reuso antigos e retém histórico/timestamp. |
| RPT-03 | Remoção de um ref opaco autorizado, exatamente24 projetos remanescentes, origem JSON real intacta; atualização explícita cria nova referência e mantém revisão anterior. |
| RPT-04 | Logout real, contexto com credencial antiga, UI limpa e read/export/download/reuso negados; nova matrícula legítima recupera a mesma revisão/resposta e bytes com mesmo hash, sem reviver sessão antiga. |

As quatro declarações são testes executáveis selecionáveis por Playwright, sem skip/fixme/expected failure. A ausência dos mounts reais falha as asserções; não gera sucesso sintético. O carregamento/transpilação/execução ainda não foi demonstrado.

## Instalação e isolamento

A configuração existente `e2e/playwright.production.config.ts` é exigida. O helper inicia a CLI real (`apps/cli/src/index.ts serve --installation modules/sucafina/Sucafinav1/local/entry.ts`) com a instalação oficial em `http://localhost:4110/sucafina`. Usa AppProcess/ChildProcessSpawner, diretório e SQLite próprios, credenciais isoladas e enrollment real. Somente registros empresariais sintéticos iniciais são gravados antes do startup; C17, autorização, projeções, revisão, export e colaboração vêm dos produtores. Não há Bun.serve, HTML de reprodução, roteamento mockado, headers de ator, endpoint novo ou import de fixture WP07/WP08/UI Work.

O corpus segue a data UTC observada (projetos são observações do dia) dentro dos anos2024–2027 suportados pelo Dashboard. O ano fora dessa faixa falha explicitamente. Janeiro tem forecast110 e os12 meses totalizam1320; uma edição real para190 produz1400. A moeda do contrato é `unspecified`; o símbolo legado `$` não é interpretado como USD.

Os processos próprios são encerrados pelo escopo. Porta ocupada falha o bind; não se adota nem se encerra servidor alheio. Deadlines limitam startup/operações; nenhum sleep ou retry de mutação foi acrescentado. Um worker, retries0 e repeat1 são impostos pela seleção canônica; corpo de teste180s e setup180s incluem margem para inicialização/teardown.

## Seleção preparada

`ci-request.json` contém somente `e2e/sucafina/reports.spec.ts`, runner Playwright, package app, diretório packages/app-shell, config de produção e `ORCHESTRA_CHANNEL=prod`. Nenhum snapshotS ou refci-run foi criado. Após composição, validar no checkout completo e seguir CI.md: produtoW, request canônico como único delta emS, dedupe, max1flight, run/jobs/logs/artifacts e identidade de árvore. Não disparar epic/fullsuite nesta missão.

## Limites e próximos gates

`DEPENDENCIES.json` registra os mounts/adapters ausentes com caminhos, blobs, heads e owners. A confirmação testada é o endpoint humano real junto da reunião preservada; botão C05 e interlocutor distinto não recebem crédito. Logout comprova sessão revogada, não ACL seletiva/Talent. OOXML comprova conteúdo semântico, não renderização/clipping. Comentário C06 capturado v3→correntev4, seção mensal de operações, indicador de atualização, fechamento, native/MCP/AMs e revisão final deC continuam requeridos.

`CRITERIA.json` conserva os86 IDs e textos do pack, todos NOT_RUN, com distinção entre asserções implementadas, parciais e não alocadas. As provas históricas de PR27 permanecem válidas somente para seus SHAs/seleções; não são transferidas para este spec.

`bun typecheck` e `typecheck:e2e` atuais omitem este diretório; nenhuma configuração compartilhada foi alterada. Typecheck/guards deW também são NOT_RUN. A revisão desta tentativa foi estática e colaborativa, sem executar código de produto/parser/testes e sem substituir as revisões independentes do candidato final.

Consumidor: **S0 integração**; correções de Colaboração continuam com a sessão atual. Handoff e verificação da publicação serão anexados nesta tentativa, preservando todo o histórico.

