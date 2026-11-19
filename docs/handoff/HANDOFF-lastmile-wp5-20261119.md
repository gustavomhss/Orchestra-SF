# Handoff — lastmile-wp5-20261119

SHA: ebf070655efcbad1d81942372f59df2681676f51
Data: 2026-11-19T14:57:09Z
Estado: partial

O SHA acima identifica o último commit de código; o handoff é um commit documental posterior. Base confirmada: sf-join-four @ f590e80e7b4b5d6ae17ca753b40583019b50a998. WP5 não está concluído.

## Feito

- Retarget dos helpers de entrada, criação e detalhe em `packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts:16`, `:49`, `:85`: navegador em `:3000/orchestra/sf-procurement/requests`, criação em `/new`, detalhe com `encodeSfRouteRef`.
- Criação usa o formulário nativo em `article.sf-u11-detail`, label real `Cost center`, review `sf-change-review` e confirmação `Confirm action` antes de aguardar o POST. Confere status 200, `ok:true`, payload com título exato, identidade `data-sf-row`, célula correspondente, seleção `aria-selected`, artigo `data-sf-request-ref` e versão de fonte.
- Contratos conferidos em `requests/page.tsx:593`, `:628`, `:665`, `:725`, `:868`; `requests/copy.ts:21`, `:52`, `:77`; `route-registry.ts:420`, `:426`, `:864`, todos sob `packages/app-shell/src/orchestra/chapters/sucafina/`. Também lidos os helpers existentes `operations-support/procurement.ts` e `decisions-support/procurement-source.ts`.
- Revisão fria independente do diff pela API e dos controles nativos não encontrou defeito novo concreto nos seletores/payload alterados; confirmou a preservação das asserções e os dois bloqueios distintos de transporte/proveniência. Revisão estática não é resultado de runtime.
- Uma requisição de gate com os dois specs exatos foi publicada no commit `0492549194b84444bfa8b4ea5ac4ec83836f67a7`; run `44547738478`. Resultado nominal final registrado abaixo.

## Pendente

Nos itens abaixo, `wp04/` significa `packages/app-shell/e2e/sucafina/wp04/`; `src/` significa `packages/app-shell/src/`. Referências curtas `requests/` e `procurement/` ficam em `packages/app-shell/src/orchestra/chapters/sucafina/procurement/` e `packages/app-shell/src/orchestra/chapters/sucafina/`, respectivamente. Os números apontam ao SHA de código acima.

- **unbound — autenticação/transporte nativo** — `wp04/procurement.spec.ts:21`, `:25`, `:27`; `wp04/host.ts:29`, `:37`, `:120`, `:130`. A fixture autentica atores nos mounts `/wp04/{first,second,viewer}` em `:4174`; o frontend é servido em `:3000`. O host despacha apenas esses mounts e o Vite não define proxy. O transporte/instalação do capítulo para cada ator ainda precisa ser vinculado e demonstrado. Mudar apenas a URL do browser não estabelece essa ligação. No run 44547738478, o GET nativo respondeu 200, mas os oito cenários não encontraram o heading Requests em :27. Isso é consistente com a ligação não demonstrada; o log sozinho não determina a causa final do frontend. Os novos helpers de criação/detalhe não foram alcançados. Não foram copiados cookies nem forjados grants.
- **unbound — proveniência C02 na entrada Requests** — `wp04/procurement.spec.ts:30`. As asserções de `sourceRef/sourceDigest/sourceVersion` permanecem. A tabela Requests renderiza identidade/título/status/requester (`src/orchestra/chapters/sucafina/procurement/requests/page.tsx:593`); anchors de proveniência existem em `src/orchestra/chapters/sucafina/procurement/queues/panel.tsx:148`, mas não foi estabelecida uma rota nativa que os exponha para esse cenário. Não substituí por mera visibilidade.
- **unbound — comandos de estágio/formulários antigos** — `wp04/procurement.spec.ts:125`, `:140`, `:181`, `:182`. O helper `requestAction` ainda exige `form[data-command]` e `data-version`. O capítulo usa `section[data-stage="pr"]`, review e versão de fonte do artigo. Não foi inventado contrato para os cenários abaixo.
- **unbound — submissão teclado/422 com edição acoplada de título** — `wp04/procurement.spec.ts:137`–`:170`. O título existente pertence ao editor W19 separado (`src/orchestra/chapters/sucafina/procurement/requests/title.tsx:303`), não ao draft PR (`requests/forms.tsx:46`). O teste antigo exige enviar título não salvo junto com PR e focar erros DOM específicos; essas asserções não foram apagadas nem convertidas em status vazio.
- **unbound — revisão explícita de conflito CAS** — `wp04/procurement.spec.ts:173`–`:237` (`:202`, `:209`, `:217`). O fluxo antigo depende de região `Review conflicting changes`, `#notice` e três forms de save. O capítulo preserva draft em `data-draft-conflict="pr"` e só expõe descarte (`requests/page.tsx:718`); não oferece o mesmo controle de escolher versão/reter entradas.
- **unbound — aprovação obsoleta após cancelamento** — `wp04/procurement.spec.ts:241`–`:284`. Continua usando aprovação/cancelamento embutidos em forms de details. Aprovação nativa tem rota separada e `section.sf-u13-remaining-detail` (contrato existente em `decisions-support/procurement-source.ts:54`). Sem adaptação completa da jornada de comentário/CAS.
- **unbound — edição durante resposta tardia** — `wp04/procurement.spec.ts:288`–`:319`. Mantidos os controles/asserções antigos de save, `#notice` e `data-dirty`; o capítulo desabilita o editor durante envio/review (`requests/page.tsx:734`). Não converti o teste em um POST sintético.
- **unbound — recorrência → sourcing → PO** — `wp04/procurement.spec.ts:324`–`:437`, especialmente `:328`, `:329`, `:347`, `:366`. Restam details/summary, formulários por estágio e campos `name` antigos. Requisição/PO têm controles reais em `requests/forms.tsx`; sourcing/comparação vivem em `procurement/sourcing/index.tsx`. A preservação de valores/FX/origens continua exigida; nada foi removido.
- **unbound — comparação, snapshot FX e filtros de fila** — `wp04/procurement.spec.ts:440`–`:505`, especialmente `:445`, `:460`, `:473`. O capítulo sourcing renderiza as colunas do produtor (`procurement/sourcing/index.tsx:716`) com estrutura diferente; settings e filtros ainda dirigem o console descomissionado. Sem substituição por cálculo no teste/componente.
- **unbound — supplier banking/revalidação/privacidade** — `wp04/procurement.spec.ts:508`–`:571`, especialmente `:512`, `:513`, `:541`, `:543`; download em `:111`. Ainda usa URLs e details/forms antigos. Os controles nativos equivalentes não foram vinculados nesta fatia; as asserções de redaction, 403, revisão e fonte permanecem.
- **unbound — settings/reset e preservação de snapshots** — `wp04/procurement.spec.ts:574`–`:620`, especialmente `:579`, `:580`, `:599`, `:605`, `:619`. Ainda usa console, `#notice` e disclosure details/summary. Não executei reset por API como substituto de interação.
- **unbound — sourcing controller do shell legado** — `wp04/sourcing-controller.spec.ts:5`, `:31`, `:32`, `:71`, `:85`. Arquivo preservado sem alteração: importa `screen-shell`, monta HTML legado, observa `#content`, chama `sucafinaRefresh` e serve endpoint isolado. É uma prova de fronteira do controller legado, não jornada do capítulo. `procurement/sourcing/index.tsx` não contém binding desse controller de análise. Trocar `#content` por outro seletor manteria a prova no shell errado.

## Decisões e justificativas

- Asserções removidas sem equivalente: **nenhuma**. O ID antes lido de um link é agora lido de `data-sf-row` e conferido por regex/célula; `details[open]` foi substituído por linha selecionada + artigo exato + identidade e versão. O mesmo fato de seleção/identidade continua coberto.
- Assertions de CAS, HTTP 422, retenção de draft/comentário, FX, scores, privacidade e reset foram mantidas mesmo onde ainda falharão por controles unbound. Nenhum skip, timeout ampliado, baseline, digest ou recibo foi criado.
- Não adaptei o teste de controller legado com markup disfarçado de capítulo; não alterei o produtor nem `runtime/application.ts`.
- Os helpers usam URLs absolutas do frontend :3000 também para páginas criadas via `browser.newContext()`, que não herdam automaticamente a baseURL do contexto de teste. A origem continua derivada do host local da fixture.
- `test-ci` exige branch `ci-run-linux-*`, alias `package:"app"` e `config:"e2e/playwright.production.config.ts"`. O JSON abreviado no briefing (`package:"app-shell"`, sem config) não é admissível pelo validator atual.
- Criação da branch de teste no SHA de código disparou automaticamente um run anterior sem config. Ele falhou antes dos testes; foi registrado, não omitido nem apresentado como gate. Próxima execução deve criar primeiro o commit da configuração via Git data API e só então publicar a ref `ci-run-linux-*`, evitando esse run vazio.

## Como retomar

1. Partir de `lastmile-wp5-20261119` e do código `ebf070655efcbad1d81942372f59df2681676f51`; a branch integra somente este WP. Ler o resultado do run `44547738478` e suas etapas antes de qualquer rerun.
2. Vincular a fixture autenticada por ator ao transporte nativo :3000 sem recriar console ou alterar grants. Isso exige uma fatia própria fora dos dois specs do WP5; verificar o binding existente em `operations-support/installation.ts` e no bootstrap nativo.
3. Resolver primeiro proveniência C02 e escolher quais contratos de UX ausentes devem existir no capítulo. Então retargetar cada cenário à rota real sem apagar o resultado original que deve provar.
4. `sourcing-controller.spec.ts` precisa de decisão explícita: continuar como teste de fronteira legado separado ou receber um equivalente nativo de análise. Não há seletor mágico que realize essa migração.
5. Quando houver mudança concreta, executar uma requisição change-scoped com o mesmo par de specs e o JSON abaixo. Toda execução é Actions, sem shell local. Não mergear em integração como concluído enquanto esses itens estiverem unbound.

## Comandos e resultados

- `bun typecheck` (app-shell): **não rodado nesta fatia**; o workflow change-scoped não executa um typecheck separado. O estado anterior do briefing não valida este diff.
- `bun run check:guards --base origin/dev`: **não rodado nesta fatia**; deixado ao fechamento WP7. Nenhum estado anterior foi reemitido como prova atual.
- Requisição remota equivalente a `test:ci`:

```json
{"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/wp04/procurement.spec.ts","e2e/sucafina/wp04/sourcing-controller.spec.ts"]}
```

- **Gate WP5**: [test-ci run 44547738478](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44547738478), commit de execução `0492549194b84444bfa8b4ea5ac4ec83836f67a7`, pai/código `ebf070655efcbad1d81942372f59df2681676f51`: **failure** (attempt 1; concluído 2026-11-19T14:57:09Z). Job `135642772584` falhou em `Run tests`: **8 failed / 2 passed (2.3m)**. Os oito cenários de `procurement.spec.ts` falharam em `:27`, aguardando o heading `Requests` depois do GET nativo retornar 200; nenhum chegou à asserção de proveniência C02 nem aos novos controles de criação/detalhe. Os dois testes aprovados são do controller isolado legado e **não comprovam o capítulo nativo**. Cleanup `135648292651`: success.
- Evidência do gate: [playwright-ubuntu-24.04-1, artifact 14542800240](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44547738478/artifacts/14542800240), 13.483.476 bytes, digest informado pelo GitHub `sha256:28be32f0ca920268ee04a5a3a056e7b00434418f0800487411ae027c2e4b066e`. Contém report, screenshots, vídeos e traces; logs lidos via API. Esse é o digest do ZIP de evidência E2E, não de pacote de release..
- **Bootstrap sem configuração**: [test-ci run 44547735238](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44547735238) **failure**, job `135642761587`, etapa `Read request`: `ENOENT: no such file or directory, open '.ci-run.json'`. Os testes não rodaram nesse run; cleanup concluiu.
- `sf-ci`: **não rodado**; reservado ao fechamento. Pacote/deploy/GO: não executados nem declarados.
