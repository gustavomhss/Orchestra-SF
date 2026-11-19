# Handoff — lastmile-wp2-20261119

SHA: d8139cfcc8a0881ca3244ab8221a241293165a71 (último commit de código; este handoff será seu descendente)
Data: 2026-11-19T14:55:22.037Z
Estado: partial

## Feito

- Branch isolada a partir de `sf-join-four@f590e80e7b4b5d6ae17ca753b40583019b50a998`.
- `packages/app-shell/e2e/sucafina/dashboard-installed/support.ts`: navegação relativa para capítulos nativos (usa o baseURL :3000 do Playwright); seleção de tópico por `tr[data-sf-topic]`; criação por New topic → Review save → Confirm save; leitura do ID persistido após retorno à lista; abertura do editor nativo; criação OPEX por New line → Review changes → Save; abertura do mês por seleção da linha e `data-sf-month`.
- `packages/app-shell/e2e/sucafina/dashboard-installed/records-signals-history.spec.ts`: provas de identidade de tópicos usam o rowheader real do capítulo, preservando as mesmas identidades e textos esperados.
- `packages/app-shell/e2e/sucafina/dashboard-installed/confirmation-access.spec.ts`: campos OPEX usam os labels reais `budget`, `actual`, `forecast`; abertura do editor anual usa o controle nativo. URL de navegação separada da URL de produtor nos faults de rede e na negação. O header Origin acompanha a origem do produtor para não confundir recusa por origem incorreta com revogação.
- Operações e locators conferidos no código do capítulo, em `dashboard/hot-topics/{index,edit}.tsx`, `dashboard/opex/{surface,model}.tsx`, `shared/table/index.tsx`, dicionários U38/U39/common e `packages/schema/src/sucafina/operation-registry.ts`.
- Respostas do produtor continuam exigindo status HTTP e `ok` corretos em `command()`; os helpers não executam um POST substituto.
- Evidência de execução: gate `test-ci` run **44548107962**; resultado e SHA exatos em Gates.

## Pendente

Todos os números abaixo referem-se ao SHA de código indicado acima. São contratos `unbound`, não cobertura aprovada.

- `packages/app-shell/e2e/sucafina/wp03/installation-fixture.ts:14` e `:53`: fixture compartilhada ainda inicia CLI em localhost:4110 e entrega cookie desse host; não liga a instalação isolada ao capítulo :3000. Arquivo fora da posse WP2. As importações estão em `dashboard-installed/confirmation-access.spec.ts:2` e `dashboard-installed/records-signals-history.spec.ts:2`. Não foi inventado binding nem copiado grant.
- `packages/app-shell/e2e/sucafina/dashboard-installed/support.ts:117`, `:166`, `:173`: confirm nativo de browser, disclosure e formulário mensal retido ainda pertencem ao contrato antigo. O capítulo renderiza a tabela mensal (`dashboard/opex/surface.tsx:582`) e um único editor por ação (`:711`), não formulários persistentes por mês.
- `packages/app-shell/e2e/sucafina/dashboard-installed/confirmation-access.spec.ts:37`, `:59`, `:68`, `:83`, `:118`, `:153`: preview-change/apply-preview/read-preview e reconciliação de receipt legado. O review nativo é apresentação local (`dashboard/opex/surface.tsx:385`) e a confirmação chama o comando CAS real (`:478`), sem esse protocolo de preview remoto. Não trocar a prova de resposta perdida por uma simples visibilidade.
- `packages/app-shell/e2e/sucafina/dashboard-installed/confirmation-access.spec.ts:43`, `:46`, `:93`, `:99`, `:139`, `:147`: leitura mensal, descarte, purga e logout ainda esperam markup legado. Requer retarget das mesmas provas contra campos/tabela, draft registry e owner corrente.
- `packages/app-shell/e2e/sucafina/dashboard-installed/records-signals-history.spec.ts:27`: precondição legada de botão Sign out; o gate falhou aqui antes de criar tópicos. Deve provar owner/contexto nativo real em vez de confiar em controle do console.
- `packages/app-shell/e2e/sucafina/dashboard-installed/records-signals-history.spec.ts:36`, `:99`: workbench e histórico preservado ainda usam disclosure antigo. A UI de tópico declara ausência de histórico do registro em `dashboard/hot-topics/index.tsx:190`; não confundir isso com histórico de revisão preservada.
- `packages/app-shell/e2e/sucafina/dashboard-installed/records-signals-history.spec.ts:56`, `:59`, `:66`, `:80`, `:87`, `:160`: sequência restante de save conflitante, recomposição, descarte e retirada ainda dirige os controles antigos. A criação e abertura nativas já estão no helper; essas etapas ainda precisam dos mesmos oráculos de CAS e preservação do rascunho.
- `packages/app-shell/e2e/sucafina/dashboard-installed/records-signals-history.spec.ts:119`: criação de IT Risk não retargetada.
- `packages/app-shell/e2e/sucafina/dashboard-installed/records-signals-history.spec.ts:129`, `:137`, `:145`, `:147`, `:150`, `:153`, `:169`: sinais, priorização, links de aplicação e verificações `body[data-surface]` ainda legadas. O helper traduz execYear/executiveMonth para year/month, conforme o parser nativo; as expectativas downstream ainda precisam preservar essa seleção pelas rotas nativas.
- Commits `7e448802e5f89e8aed59ed77c3d2b61c00e66be5` e `d8139cfcc8a0881ca3244ab8221a241293165a71` foram feitos após a solicitação do gate: correções de separação da URL de origem e do header Origin. **NOT-VERIFIED pelo gate solicitado**. Nenhum resultado anterior é atribuído a esse head final.

## Decisões e justificativas

- Asserções removidas: **nenhuma**. Mudanças de role/locator continuam exigindo o texto, identidade persistida e confirmação do produtor. Não há skip, aumento de timeout, fonte/receipt sintético ou retorno antecipado para declarar sucesso.
- Os contratos ainda não portados foram mantidos para falhar e estão individualizados acima. Não foi recriado console, alterado runtime/application.ts, catálogo de suites, release target ou workflow.
- O parâmetro de origem legado de `dashboardUrl` permanece apenas para compatibilidade dos chamadores; a navegação retorna caminho relativo do capítulo. A autorização do produtor não é inferida dessa URL.
- Não migrei estes specs para F04 Microsoft/CDP: `native/fixture.ts` exige navegador autenticado do host, que não está demonstrado por este gate Linux. Trocar fixtures silenciosamente não resolveria a prova.
- O request do briefing foi adaptado à validação real: alias `app` (não `app-shell`), config de produção explícita, prefixo `ci-run-linux-`. A branch CI nasceu já contendo o request, evitando run vazio na criação.
- Uma única verificação WP2 foi solicitada. As correções posteriores de URL/origem estão declaradas sem prova de execução, respeitando o limite de uma verificação.

## Como retomar

1. Partir de `lastmile-wp2-20261119@d8139cfcc8a0881ca3244ab8221a241293165a71`.
2. Ligar a fixture real ao host nativo :3000, com owner/cookie e origem válidos, sem usar o console :4110 como browser e sem fabricar grant.
3. Retargetar os grupos `unbound` acima em fatias separadas: review/CAS mensal e outcome recovery; histórico/revisão preservada; risco/sinais/navegação. Conferir controles e dados do produtor antes de substituir cada oráculo.
4. Solicitar novamente os dois specs estreitos somente sobre o próximo SHA que contenha essas correções; o run anterior não certifica o head final deste WP.
5. Integrador decide a sequência em `sf-join-four`; WP2 não executou merge, pacote, sf-ci ou GO.

## Comandos e resultados

- `bun typecheck` (app-shell): **não rodado**; sem shell, test-ci selecionado executa Playwright.
- `bun run check:guards --base origin/dev`: **não rodado neste WP**; fechamento centralizado.
- Gate remoto equivalente: `.ci-run.json` no commit `427912fa8c89c2c2062fa5cf53809eafa238124d`, parent de código `2e947689575b64cea7e51f42f3140c70dd386373`:

```json
{"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/dashboard-installed/records-signals-history.spec.ts","e2e/sucafina/dashboard-installed/confirmation-access.spec.ts"]}
```

## Gates

- `ci-run-linux-wp2-20261119`: [test-ci run 44548107962](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44548107962), job `135644094257`: **failure** (completed). Dois specs executados, dois falharam. `confirmation-access.spec.ts:10` excedeu os 180000 ms existentes no primeiro passo de criação; o log não identifica um locator único para essa falha. `records-signals-history.spec.ts:27` falhou aguardando o botão legado Sign out (elemento ausente). `Read request`, build/Vite preview :3000 e upload de evidências concluíram; cleanup removeu a branch CI. [Artefato Playwright 14541789452](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44548107962/artifacts/14541789452). Os ZIPs não foram extraídos neste trabalho sem shell; diagnóstico acima vem dos logs oficiais do job.
- `sf-ci`: **não rodado**; reservado ao fechamento único do integrador.
