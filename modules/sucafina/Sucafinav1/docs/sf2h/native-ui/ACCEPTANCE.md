# Aceite e validação funcional/visual

**PLANNED / NOT_RUN.** Nenhum teste, servidor, build, geração, typecheck, guard, CI ou AM foi executado/disparado nesta sessão. Os grupos NUI abaixo organizam evidência da adaptação; não substituem os 1610 critérios canônicos nem criam um atalho para GLOBAL_RELEASE.

## 1. Grupos de aceite

| Grupo | Aceite observável | Evidência exigida |
| --- | --- | --- |
| **NUI01 Navegação nativa** | 15 chapters registrados no mesmo sidebar; grupos/ordem corretos; SF primeiro; Chat/Inbox como apoio; nenhum iframe/HTML embutido/segunda sidebar; active/breadcrumb/preload/back/reload corretos | Navegação real por cada destino autorizado, URLs e capturas; teste negativo de destino não permitido |
| **NUI02 Composição visual** | Hierarquia conforme UX-DESIGN, tokens/componentes reais, uma ação primária, densidade adequada, alinhamento, temas e nenhum clipping | Matriz visual de produção do mesmo candidato + review humano; screenshots não substituem função |
| **NUI03 Identidade e isolamento** | Microsoft/B2B existentes; cookie/mount/origin; servidor/projeto/instalação/principal corretos; troca/revogação sem vazamento | Dois atores e dois contextos, negativas em leitura/contagem/search/export/mutation; sessão/retorno/logout concorrente |
| **NUI04 Paridade de domínio** | 28 capacidades, todos os comandos/controles/formatos, IDs, locks/versões e persistência mantidos | Inventário CAP com ação/ator/expected/observed; leitura por segundo ator e após reabertura |
| **NUI05 Planner/financeiro** | Monthly grid, HR, FX, budget/actual/forecast, copy/official/lock e comparação sem cálculo paralelo | J02 com oráculos independentes; branco/zero/herdado/incompleto e mutações proibidas |
| **NUI06 Procurement** | Ciclo PR/sourcing/PO completo, holder/etapa/versão/valor, suppliers/settings/contratos e emissão interna | J04, aprovação compreensível, M31/MI07 originais mantidos e fechados por prova própria |
| **NUI07 Decisão/portfólio** | Intenção→alternativas→pergunta→escolha→mudanças→receipt; cenário/sensibilidade com cobertura | J09/J10, cinco nominais Decisions, positivo financeiro, P03 integral original sem relaxamento |
| **NUI08 Import/documentos** | Preview/impacto/Apply/receipt, cancel/roundtrip, mesma evidenceRef confirmada para cenário e sourcing | J03/J11, arquivos adversos, scanner/limites, base concorrente, atualização/revogação de fonte |
| **NUI09 Reuniões/relatórios** | Pauta/ordem/períodos, revisão estável, comparação compatível, export completo | J05, quatro jornadas Reports, 25 registros e notas longas, PPTX/DOCX extraídos e renderizados |
| **NUI10 Trabalho/colaboração** | Meu trabalho derivado, relações explícitas, perguntas, C06 material e Hot Topic único | J01/J06, perda de resposta/reenvio autorizado e ausência de duplicata ou posting financeiro |
| **NUI11 IA/rotinas/residentes** | Admissão real, modelos/sessões/recipes pinados, cancel/needs-input/stale, Schedule e retorno | J07/J13; AM01–AM06, 5 perfis/18skills/8packs/39ops e contribuições consumidas, sem mock como prova |
| **NUI12 BI/memória** | BI01–11 com dados/tabela equivalentes; materialidade/dedup/previsto×observado sem falsa causalidade | J12, oráculos de granularidade/ausência/cobertura, Atlas autorizado e revalidação |
| **NUI13 Migração/deep links** | Aliases de todas as entradas, filtros/scroll/selection, download/auth/asset intactos; rollback só de apresentação | Matriz legado→native, refresh/return/cross-owner; mesmos IDs/receipts antes/depois |
| **NUI14 Acessibilidade/i18n** | Teclado, foco, leitura de tabela/grid, zoom de 200%, 320/768/1440px, contraste, labels e traduções tipadas | Inspeção automática e manual apropriada; screenshots, percurso de foco, audit de texto/locale |
| **NUI15 Falha/retomada** | Loading/empty/partial/denied/unavailable/stale distintos; draft autorizado conservado; nenhum replay automático | Fault injection controlada, perda de resposta, troca de owner e revogação; estado+efeito persistido |
| **NUI16 Candidato e fechamento** | Evidências do mesmo C; suites/guards/geração/AMs/revisões; D somente envelope válido | SHAs/trees/requests/runs/artifacts e três FINAL independentes; C/G7 e D/G8, todos critérios obrigatórios |

## 2. Jornadas funcionais prioritárias

| Jornada | Exercício na UI nativa | Resultado obrigatório |
| --- | --- | --- |
| J01 | Meu trabalho → editar três valores/justificativa → voltar → confirmar outro recorte → segundo ator cria conflito | Filtro/scroll/draft mantidos; confirmação de janeiro não recobrada por fevereiro independente |
| J02 | Planner: budget 600000, actual 400000, forecast 190000; licença 72000 substituída por 84000 e78000 em cenários | Outlook602000/596000; delta 12000/6000 contra 590000; margens−2000/+4000; actual/oficial intactos |
| J03 | Import válido/inválido → prévia → cancelar → concorrência → reprévia → Apply → export/reimport | Cancelamento sem escrita; atomicidade; manifest/receipt e identidades corretos |
| J04 | PR32000USD; ofertas de 32400 USD/28000EUR×1.08/29000USD inelegível; papéis distintos | B30240USD, C excluída; scores 87.9333/85 conforme oráculo; holder/versão corretos; emissão interna |
| J05 | Pauta com competências distintas/25 projetos/notas longas → preservar → mudar fonte → apresentar → comparar/export | Revisão estável, todos registros uma vez, paginação legível e acesso atual nos downloads |
| J06 | Vincular contrato/pedido/linha distintos → pergunta → ação Hot Topic → perder resposta → retomar | Uma ação canônica; nomes homônimos não viram identidade; nenhum lançamento financeiro implícito |
| J07 | Executar rotinas com admissão real → cancel/failure/changed source → recorrência/pausa | Run/receita/entrada rastreáveis, output revalidado, sem aprovação/envio externo automático |
| J08 | Abrir28 capacidades/papéis; busca/filtros/back; 320/768/1440 e zoom de 200% | Paridade, contexto, componentes reais, sem restrito em DOM/rede/cache |
| J09 | Contrato→intenção→contradição→alternativa→resposta→escolha→propostas/recibos→nova cotação | Escolha preservada; reavaliação material e efeito por domínio corretos |
| J10 | Universo/compromissos→combinações/limites→escolha→handoff | Cobertura e condição não mascaradas; sem execução financeira duplicada; P03 completo |
| J11 | PDF digital/DOCX/texto autorizado→trecho/candidato→confirmar→cenário e sourcing | Mesma evidenceRef; conteúdo malicioso não vira instrução; fonte stale/revogada bloqueada |
| J12 | Caso semelhante→previsto/observado/cutoff→sinal irrelevante/material/duplicado | Base histórica preservada e sem causalidade inventada |
| J13 | Modelo/sessão/recipe reais→needs-input→nova versão/run→cancel/retomar | Sem bypass de admissão, SkillLoadReceipt e continuation verdadeiros, stale recusado |

Os dados acima vêm do [product-acceptance canônico](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/specs/product-acceptance.md). São expectativas futuras, não resultados desta sessão.

M31/MI07 e P03 não são substituídos pelo piloto. Para P03, 72 assertion lines e 180000 ms permanecem; os 24 expect calls agregados do run 58 não são cobertura parcial aprovada. Falhas históricas continuam nos receipts.

## 3. GitHub Actions: mecanismo real observado

Fontes lidas em C27:

- [test-ci.yml](https://github.com/gustavomhss/Orchestra-SF/blob/b10c424a6b318879fc30f11d03ba1cfeffda7d1a/.github/workflows/test-ci.yml), blob `9f078f4e37b758691bcd073e5590f05d5444392a`.
- [request validator](https://github.com/gustavomhss/Orchestra-SF/blob/b10c424a6b318879fc30f11d03ba1cfeffda7d1a/script/test-ci-request.ts), blob `5007e48270b80c83eb719d35cec9e6343206a195`.
- [produção Playwright](https://github.com/gustavomhss/Orchestra-SF/blob/b10c424a6b318879fc30f11d03ba1cfeffda7d1a/packages/app-shell/e2e/playwright.production.config.ts), blob `ae56b7fc9da248ee8e34d73d0eb13c8fe8e0c088`.
- [receitas canônicas](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/ci-recipes.json).

O fluxo vigente recebe snapshot **S** descendente do candidato **C** com `.ci-run.json`; a branch `ci-run-linux-<id>` dispara a execução. O workflow valida seleção e gera `playwright-selection.json`, `playwright-runtime.json` e relatório; faz upload de `test-ci-evidence`, `e2e/test-results` e `e2e/playwright-report` com retenção de 7 dias. Esse upload já permite anexar capturas nativas sem inventar um workflow novo.

A configuração de produção compila/serve o app no runner e tem fixture especial WP04. **Ela não monta automaticamente a futura sub-API nativa.** N0/N10 precisam adicionar uma fixture instalada real ao harness autorizado, com mount/origin/contexto e persistência correta. Só criar um spec novo não estabelece essa disponibilidade. Essa alteração é implementação futura e passa pelos donos/configuração existentes.

### Seleções mínimas herdadas — todas retidas

| Recipe | Request vigente / escopo |
| --- | --- |
| CI-SF | package=sucafina, runner=bun, args=[]; suite completa do módulo |
| CI-CLI | package=cli, runner=bun, args=[]; composition root |
| CI-APP-SRC | package=app, runner=bun, args=[]; raiz src sob condição Solid |
| CI-APP-BROWSER | package=app, runner=bun, args=[test-browser]; seleção distinta, não coberta pela anterior |
| CI-ATLAS-BUSINESS | package=atlas-boundary, runner=bun, args=[--timeout, 30000]; suite boundary inteira |
| CI-UI-OPERATIONS | package=app, runner=playwright, config=e2e/playwright.production.config.ts, args=[e2e/sucafina/operations.spec.ts] |
| CI-UI-DECISIONS | Mesmo runner/config, args=[e2e/sucafina/decisions.spec.ts] |
| CI-UI-REPORTS | Mesmo runner/config, args=[e2e/sucafina/reports.spec.ts] |

Essas oito são o mínimo da footprint canônica, não a suite global inteira do Orchestra. Preservar todas as suites adicionais herdadas e novos pacotes afetados de Schema/Protocol/Client/UI conforme gates reais. Full suite uma vez por epic conforme política do repositório; ampliação/repetição somente por mudança material ou gate obrigatório.

### Seleções incrementais nativas propostas

Após os arquivos existirem, publicar requests exatos, um por seleção pertinente:

- `e2e/sucafina/native/navigation.spec.ts`:15 destinations, owner, back/reload e aliases.
- `e2e/sucafina/native/isolation.spec.ts`: principal/papel/servidor/projeto/instalação, atraso de resposta, logout/revogação/download.
- `e2e/sucafina/native/visual.spec.ts`: capturas determinísticas e estados de componentes reais.
- `e2e/sucafina/native/accessibility.spec.ts`: teclado, grid, foco, zoom/reflow e nomes acessíveis.
- `test-browser/sucafina-native/`: bindings e recursos do client no browser; não substitui o E2E instalado.
- Testes de schema/protocol/client/adapter para optional/IDs, envelope fechado, erro tipado e impossibilidade de importar Core/Server no browser.

Não despachar paths inexistentes nem usar uma config que ignore os specs. Validador/selection.json devem mostrar arquivos e casos reais. Preservar um worker Playwright por job conforme receitas vigentes e capacidade real dos runners.

## 4. Matriz visual revisável

Usar corpus sintético determinístico **na aplicação real** para capturas, com identidades/permissões controladas no harness. Fixtures de dados são aceitáveis para estética; não substituem a prova de domínio/admissão.

| Cobertura | Capturas necessárias |
| --- | --- |
| 15 chapters | Estado principal de cada área em Light e Dark, 1440px, mesma fonte e versão de produto |
| Planner/Procurement/Decisões | Normal/denso, conteúdo extenso, valores ausentes/parciais, conflito e review; desktop e tablet |
| Reuniões/Documentos/Importações | 25 registros/notas longas, documento sem texto, preview stale, scanner indisponível e export paginado |
| Mobile/zoom | Hoje, lista/detalhe, aprovação, editor mensal e comparação em 320px e768px; zoom de 200% |
| Temas adicionais | Componentes representativos com texto/estado/foco em Graphite/Gruvbox/GitHub/Nord/AMOLED |
| Locales | en e pt-BR completos, frases longas e locale de direção/formato representativo da cobertura suportada; placeholders sem quebra |
| Falha/segurança | Empty real vs filtro vazio, unavailable vs denied, loading, pending receipt, session expired, contexto trocado |
| Export | PPTX/DOCX renderizados pelo pipeline existente, comparação de conteúdo/ordem e imagens, não apenas XML |

A primeira baseline visual é aprovada por revisão humana, confrontada às pranchas. Depois comparar screenshots no mesmo ambiente/viewport/font/tema/seed. Diferença visual exige interpretação: máscara só para dado variável inevitável, nunca para esconder valor, status, erro, clipping ou foco. Não definir tolerância ampla para “passar”; calibrar ruído do renderer e revisar diferenças materiais.

Revisão estética verifica ritmo/escala, alinhamento de números, contraste, densidade e foco da ação; revisão funcional verifica efeitos. CI pode detectar regressão, mas não decide sozinho se o produto está bonito ou fácil.

## 5. Forma de escrever as verificações

Seguir o AGENTS de e2e e a documentação primária de [boas práticas](https://playwright.dev/docs/best-practices), [auto-wait](https://playwright.dev/docs/actionability), [assertions](https://playwright.dev/docs/test-assertions), [locators](https://playwright.dev/docs/locators), [network](https://playwright.dev/docs/network) e [isolamento](https://playwright.dev/docs/browser-contexts).

Provar comportamento visível com locators de role/label/contrato explícito, dados isolados por contexto e assertions de estado exigido antes da próxima ação. Nada de sleeps/waitForTimeout, `.first()` para esconder ambiguidade, retries de mutação ou “visible” como única prova de prontidão.

Reads/estado podem usar auto-wait; uma ação que muda dados é executada uma vez e verificada no produtor/receipt. Fault injection de transporte não pode substituir a lógica financeira/ACL por mock no fluxo de aceite. Autenticação Microsoft simulada em testes determinísticos cobre contrato específico, não substitui Microsoft live/AM no ambiente autorizado.

## 6. Artefatos, revisão e retenção

Cada seleção precisa registrar C/tree, S/parent, request normalizado/hash, workflow/config/runner/runtime, arquivos e casos coletados, pass/fail/skip/filtered, run/job/attempt, artefato/digest e limites. Copiar a evidência autorizada para os paths de receipts antes de expirar a retenção; não vazar cookies/tokens/dados reais em screenshots, traces ou logs.

As [filas finais57](https://github.com/gustavomhss/Orchestra-SF/blob/d6d9816bb09f7595330862616305e0791e23e61e/modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/closure-intake-57/gate-queue-final.json) e seus 15 comandos do responsável 45 continuam vigentes. Geração de client e de paletas, typechecks do grafo/app/E2E, Atlas generated, spawn-imports, guards e preflights são gates separados; confirmar executor autorizado em vez de chamar um suite full para imitar compiler-only.

Três revisões FINAL independentes examinam o mesmo candidato corrigido: arquitetura/autorização, paridade/números e UX/acessibilidade. Nenhuma revisão desta proposta vale como FINAL de implementação.

C/G7 exige o conjunto cumulativo e nenhum obrigatório aberto. D/G8 só arquiva evidência admitida com envelope/ancestralidade/diffs/hashes/guard próprios; não transfere execução de C a D. Somente S0/autoridade final pode declarar aceite conforme canônico.

## 7. Aceite desta PR de planejamento

A revisão desta PR deve conseguir localizar cada capacidade, compreender uma tela em cada família, identificar dono e path de cada pacote, verificar os pins/limites dos handoffs, ler o seam proposto e rastrear os 1610 IDs.

Esta PR pode ser aprovada como plano com testes **NOT_RUN** porque não implementa produto. Sua aprovação não é aprovação funcional/visual da futura aplicação.
