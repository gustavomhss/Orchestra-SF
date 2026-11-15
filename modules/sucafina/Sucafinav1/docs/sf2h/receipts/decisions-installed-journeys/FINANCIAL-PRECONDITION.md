# M52 — pré-condição da jornada financeira: Procurement sem configuração

## Estado e limite de evidência

**Jornada financeira obrigatória: FAIL antes da criação da PR.** O erro observado no baseline é anterior e independente dos dois bloqueios estáticos de composição e aprovação registrados em `FINANCIAL-CONTRACT.md`. Esses bloqueios posteriores continuam **NOT_REACHED**, sem skip, waiver ou transferência de PASS.

- Run executado pela raiz: https://github.com/gustavomhss/Orchestra-SF/actions/runs/43654219902 .
- Snapshot S publicado em `request.json` e no recibo da jornada: `fbc76905438455be37aeda813b380924d594de8f`. A raiz mantém a reconciliação S/W e composição C18 no recibo de execução.
- Fontes auditadas: C18 `ee1a3ea147ab7d7f4f6b231217e623456e294c84`; comparação C19 `5b11f1460fa44426626ea7674ccb8baf0a083e0a`. A comparação C18→C19 altera 32 paths, sendo somente dois de produção: `product/host-binding/atlas-memory.ts` e `business-context.ts`. Nenhum path da cadeia de configuração/queue abaixo mudou. Os blobs de `business-services.ts` e `queue-page.ts` também foram relidos individualmente em ambos os SHAs e são idênticos.
- Identidade exata: `CI-UI-DECISIONS — require a real Procurement proposal and approval before Apply and recover its unique receipt`, em `decisions.spec.ts:21`. É a jornada financeira lógica obrigatória, segunda na ordem do arquivo.
- Runtime: `status=failed`, duração 14623 ms, budget do teste 180000 ms, retry 0. A assertion de formulário tem budget 10000 ms e permanece intacta.
- Assertion falha: `procurement-source.ts:7`, `expect(page.locator('form[data-command="create"][data-page="Requests"]')).toHaveCount(1)`; recebido 0.
- DOM observado: `{"status":"unavailable","reason":"procurement-queue-unavailable"}`.
- Recibo próprio: `bodyCompleted:false`, `observations:[]`, `requests:[]`. Esse último vetor registra somente URLs com parâmetro `sf`; não representa um inventário de toda a rede.
- Não houve observação runtime de Settings/save, do banco SQLite nem do motivo interno mascarado. A cadeia causal abaixo é análise estática dos bytes executáveis e da construção da instalação nova. Ela demonstra uma falha determinística suficiente; não afirma que um trace instrumentado identificou o ramo interno.

Artefatos lidos, já baixados pela raiz:

`m52-audit/baseline-43654219902/extracted/test-ci-evidence/playwright-runtime.json`

`m52-audit/baseline-43654219902/extracted/packages/app-shell/e2e/test-results/sucafina-decisions-CI-UI-D-44857--recover-its-unique-receipt-chromium/error-context.md`

## Cadeia causal estática

1. `decisions-support/journey.ts:34–48` abre uma instalação isolada nova e adiciona somente o cookie real de operador; a jornada financeira começa em `createRequisition`, que abre Requests antes de qualquer preenchimento.
2. `wp03/installation-setup.ts:10–11` chama apenas `prepareLocalConfiguration` e `prepareOperatorAccess`. `local/enroll.ts:10–33` prepara identidade e o artefato de autenticação, sem criar configurações de Procurement.
3. `runtime/local-store.ts:85–90` materializa uma superfície ainda ausente como `{data:{},versions:{},sequences:{},audit:[],notices:[]}`.
4. `local/entry.ts:72` inicializa as identidades de fonte. `source-lifecycle.ts:113–120` cria `sfSources` e enumera fontes, sem adicionar `data.store.settings`.
5. `runtime/procurement.ts:142–149` lê `stored.settings` literalmente. `domain.view`, linhas 928–941, projeta `formSettings` a partir dessas configurações. Sem configuração gravada, `formSettings.currency` está ausente; não existe getter que aplique USD implicitamente.
6. `local/entry.ts:108–114` liga Requests/My approvals ao `productView` real. `runtime/application.ts:82–84` executa esse produtor antes da transação/renderização da página.
7. `business-services.ts:594–601` seleciona o período real da queue para a chamada autorizada. `contextFor`, linhas 95–108, lê a moeda canônica pela mesma `domain.view` em transação de Procurement. Moeda ausente resulta em `{status:"unavailable",reason:"procurement-context-unavailable"}`.
8. `product/procurement/sources.ts:182–183` propaga esse resultado antes de emitir a seleção. `queue-page.ts:49–50` o transforma no motivo público genérico `procurement-queue-unavailable`; a função `failure`, linha 28, usa HTTP 503 para esse status. O DOM confirma o corpo público; o status HTTP é inferido dessa função, não de uma captura de headers de navegação.

### A instalação vazia não invalida a seleção por ausência de linhas

`source-inventory.ts:30–37` enumera sempre `procurement-request-selection/all`, mesmo sem requisições. `source-projection.ts:37–40` aceita `records:[]`. `port.ts:179–210` devolve projeções/aging vazios com stock sem valores e `queue-view.ts:33–57` aceita zero linhas. Portanto, fabricar uma linha ou fonte não resolve a pré-condição faltante. O problema identificado é ausência de moeda/configuração exigida pelo contexto, não ausência de registros.

## Ação pública disponível e por que não permite salvar somente a moeda

A configuração já é alcançável por GET de `/sucafina/procurement?page=Settings`; `queue-page.ts:27` e `local/entry.ts:109` interceptam somente Requests/My approvals. Não é necessário alterar a rota para expor Settings.

O formulário canônico é:

- `form[data-page="Settings"][data-command="save"]`, `data-record=""`, `data-version="0"` numa instalação nova;
- campo `Currency`, nome `currency`;
- botão `Save settings`;
- POST JSON na URL atual de Settings, com a sessão real, mesma origem e CAS corrente;
- a autorização requer o papel `admin` (`runtime/procurement.ts:679`), `canWrite`, presença no diretório e CAS de `settings`. O operador real tem `admin` e `canWrite:true` em `operator-identity.ts:113–118`, mas isso não lhe dá uma política de aprovação implicitamente.

O formulário inteiro é serializado. `screen-shell.ts:27–50` constrói arrays a partir dos nomes numéricos, números vazios como null e checkboxes como booleanos. Linhas 380–381 produzem o envelope; `id` é undefined para `data-record=""` e é omitido do JSON. As linhas 1177–1236 de `runtime/procurement.ts` incluem não apenas a moeda, mas também modo, alçadas, holders, câmbio e demais configurações.

**Payload previsto por inspeção estática**, se a única interação de campo fosse preencher Currency com USD e clicar Save settings, sem adicionar linhas de política. Não foi enviado nem observado em runtime:

```json
{
  "page": "Settings",
  "action": "save",
  "version": 0,
  "values": {
    "currency": "USD",
    "prApprovalMode": "first",
    "minQuotes": null,
    "techWeight": null,
    "commWeight": null,
    "blockSelfApproval": false,
    "requireActiveSupplier": false,
    "uploadCap": null,
    "reminderDays": null,
    "escalationDays": null,
    "levels": [
      {
        "_new": "true",
        "id": "levels-1",
        "name": "",
        "threshold": null,
        "holderId": ""
      }
    ],
    "fxRates": [
      {
        "_new": "true",
        "code": "",
        "rate": null
      }
    ],
    "fxUpdated": "",
    "criteria": [
      {
        "_new": "true",
        "name": "",
        "weight": null
      }
    ],
    "commCriteria": [
      {
        "_new": "true",
        "name": "",
        "weight": null,
        "auto": false
      }
    ],
    "paymentTerms": "",
    "categories": "",
    "incoterms": "",
    "billingAddress": "",
    "defaultDeliveryAddress": ""
  },
  "confirmed": false
}
```

Dois efeitos da própria UI são relevantes: o select `prApprovalMode` oferece `first` como primeira opção e não inclui opção vazia (`runtime/procurement.ts:1022,1026–1035`); `blockSelfApproval` ausente aparece desmarcado e serializa false (linhas 1066–1093 e serializer citado). Logo, nem o corpo tentado seria exclusivamente `currency`.

No servidor, `inputs/structuredInput`, linhas 326–405, remove as linhas novas inteiramente vazias. A linha de matriz tem apenas o id de UI e campos vazios; `populatedFormValue`, linhas 408–415, ignora id e metadados. Os arrays `levels` e `fxRates` resultam vazios.

`settings()`, linhas 705–723, exige simultaneamente:

- `levels` como array e com pelo menos uma linha;
- id e nome não vazios, threshold numérico finito e holderId null/string em cada linha;
- `fxRates` como array, validando cada par fornecido;
- moeda não vazia;
- `prApprovalMode` igual a first ou matrix;
- `blockSelfApproval` booleano.

Sem criar pelo menos uma linha de política/alçada, a ação recebe `{ok:false,status:422,errors:["Invalid matrix or currencies"]}`. `runtime/application.ts:347–350` só comita `result.ok`; nesse resultado a configuração e CAS permanecem sem gravação. Portanto não existe, na UI atual, um caminho autorizado de **preencher somente USD → persistir moeda → reler Requests**. Adicionar threshold, modo ou holder para satisfazer o validador criaria uma política que M52 não pode escolher.

O botão separado `Reset settings`, linhas 1238–1239, chama `Settings/reset`. `settings()`, linhas 683–685, passa a `initialProcurementSettings()`, que inclui USD, thresholds 0/30000, holders null, modo first, self approval false e câmbio (`src/initial-settings.ts:1–24`). Esse reset altera configuração/política; não é uma correção de cookie nem uma preparação neutra. Mesmo esses defaults não atribuem um holder de aprovação.

## Entrega para 53, S0/WP00 e A47

A jornada original, os cinco testes, suas identidades, assertions e budgets devem permanecer intactos. Nenhum setup financeiro, seed, mutação direta, reset, default runtime, bypass da queue, relaxamento de CAS ou grant foi aplicado. Não há patch funcional completo de M52 que possa resolver essa pré-condição sem escolher semântica de configuração/política fora da sua autoridade.

Decisão necessária ao proprietário: definir o estado inicial autorizado e como o usuário chega a uma configuração persistida. Se desejado um bootstrap de moeda separado da aprovação, Procurement/S0 devem especificar e autorizar o estado parcial válido e a transição pública; não basta retirar a validação de matriz. A47 é a única integradora. A missão53 foi publicada como PREPARED_NOT_STARTED no controle `dc7851be1714471543466f23bad47584bb97b389`; a publicação por si só não comprova início nem liberação. Seu escopo de adapter compatível com editar/submeter/aprovar não autoriza M52 a criar alçadas, holders ou outra política.

Critérios de resolução:

1. Produzir uma pré-condição revisável que conserve a ausência de política como ausência e não a traduza em USD/default/grant automático.
2. Executar a preparação permitida pela UI real, sob os papéis, sessão, CAS e histórico canônicos, registrando qualquer escolha administrativa explicitamente autorizada.
3. Relê-la pela UI e abrir Requests; a queue vazia deve ser observável e o formulário nominal deve ser alcançável sem chamada direta de mutação.
4. Reexecutar o mesmo quinto teste obrigatório pelo dispatcher existente e deduplicado, sem alterar assertions/budget. Corrigir apenas esta pré-condição não resolve os bloqueios estáticos posteriores de cenário composto e aprovação antes da mesma substituição.

Proposta diagnóstica opcional, sem alegação de correção funcional: preservar uma razão interna específica para moeda ausente somente após confirmar o ator, e apresentar instrução/link para Settings na resposta de queue indisponível. Manter status de falha, controles de autoridade e ausência de projeção; não retornar uma fila “observada” fictícia. Settings já é acessível, e essa mensagem não faria a assertion atual passar. Por orientação da raiz, não foi gasto trabalho em um patch cosmético nem editado código remoto.

## Fontes e blobs C18

Todos os arquivos foram lidos via GitHub MCP. A tabela fixa linhas auditadas no SHA C18, não linhas de um patch futuro.

| Path | Git blob | Linhas |
| --- | --- | --- |
| `packages/app-shell/e2e/sucafina/decisions-support/procurement-source.ts` | `7a7553b89af8f90592603f7d454ba164cbb81afd` | 4–16 |
| `packages/app-shell/e2e/sucafina/decisions-support/journey.ts` | `171cd775bfb5d3f6f68b3a72e3e1ceb9e45ba3e4` | 30–59 |
| `packages/app-shell/e2e/sucafina/wp03/installation-setup.ts` | `58f40c0f9908ad5cc8c1eebb74f4fd7a1e05283e` | 1–11 |
| `packages/app-shell/e2e/sucafina/wp03/installation-fixture.ts` | `8c015003e850561c5ee7fb430203fed4b06feaaf` | 17–49 |
| `modules/sucafina/Sucafinav1/local/enroll.ts` | `6c1728044af046bf2472144f4d8ecfef58ce982c` | 10–33 |
| `modules/sucafina/Sucafinav1/local/entry.ts` | `26a330c62a0e5e9f3e2ea79be0b6854e7dca7363` | 42–98, 103–115 |
| `modules/sucafina/Sucafinav1/runtime/local-store.ts` | `e9da289bdce680f2429904c1e83dec60c39aa2a8` | 85–90 |
| `modules/sucafina/Sucafinav1/runtime/procurement.ts` | `20a3ec5a30ac0fce6b35f05750d1b3dced11c45b` | 139–159, 326–405, 678–746, 875–947, 1008–1113, 1177–1240 |
| `apps/cli/src/sucafina-product/business-services.ts` | `6bb862ce96d3ca2b6478e5f00c257e0b38c1bfee` | 94–113, 594–601 |
| `modules/sucafina/Sucafinav1/product/procurement/queue-page.ts` | `91784d3ea3358565e19b62922c8867f134af9ac4` | 24–57 |
| `modules/sucafina/Sucafinav1/product/procurement/sources.ts` | `615b908d59fb95cb16ce8359c83e0c7aaa8a7a5e` | 179–219 |
| `modules/sucafina/Sucafinav1/product/procurement/port.ts` | `4f94c3355074db43dcc4acaab09e14be9150767c` | 179–210 |
| `modules/sucafina/Sucafinav1/product/procurement/queue-view.ts` | `a03998f3b87df91c6c84b198f2b51aa9c391bcd2` | 33–57 |
| `modules/sucafina/Sucafinav1/product/procurement/source-projection.ts` | `ab9814817d11c0b477636ee54d1b2763d365f405` | 37–40 |
| `modules/sucafina/Sucafinav1/product/integration/source-inventory.ts` | `ddc5323d714c58de2d5b47eed2563176099f15b5` | 30–37 |
| `modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts` | `d43a630254142bc5e5fb3589d1120a328abf2d1c` | 113–120 |
| `modules/sucafina/Sucafinav1/src/initial-settings.ts` | `7682bb517a77ef812dbd4626790f1453cc5c0100` | 1–24 |
| `modules/sucafina/Sucafinav1/runtime/ui.ts` | `2d59a6d4a5cb4b87590c326ada84347aa85c094e` | 24–47 |
| `modules/sucafina/Sucafinav1/src/screen-shell.ts` | `c57e1f01044d12bf5c86bb5d7d68408950a83fc1` | 27–50, 353–386 |
| `modules/sucafina/Sucafinav1/runtime/application.ts` | `4edac56f32a082a0944a88fe5f231bc5aa739690` | 82–84, 105–128, 304–350, 456–507 |
| `modules/sucafina/Sucafinav1/runtime/operator-identity.ts` | `4845de24285df2459991da7d9895aad95eb93b19` | 112–118 |

Esta análise não despachou testes, não executou produto local e não escreveu no GitHub. O processamento local limitou-se à leitura de artefatos já obtidos pela raiz e à redação deste handoff.

