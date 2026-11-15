# Missão 195 — U39/U40, Dashboard com admissão F04 verificada

**Estado: ARTIFACT_READY; INTEGRATED=false; QUALIFIED=false; GLOBAL_RELEASE=false.**
Fonte `source-closure-e1-browser195` na PR [#150](https://github.com/gustavomhss/Orchestra-SF/pull/150), branch existente `sf-ux-n13`.
Modelo efetivo GPT-6; identificador de sessão Astra não exposto. A conta GitHub usada no MCP não é identidade de sessão Microsoft/F04, nem autorização do produto.
Autoridade anterior 186 revogada **somente para futuras escritas**; histórico e `S0-FENCE.json` preservados.

## Origem e CAS

- HEAD inicial confirmado: `7534cb39a2024f5c4d258845a874e82156cb343d`; tree `2634231ceefa91d67fad202ff2c7a514a5332658`; S0-FENCE blob `159d298f54a71d8981c422053f3e8d2d31b31e30`.
- Commits de código CAS/expected-head, `force:false`: `87fb1a3be33b9afa91a6de3be9d4ea8fd5d1da19` (tree `451605661ed69fb37d2b8b01dc1eb9c11f9201ea`) e `5d8e2a00895abea3bbfb0ce97ea9c514f79bbd50` (tree `99c79ebdb0e60332147f0fbe7081ed86b8d70425`).
- Pacote de autoridade imutável: `e027e7ba4141d42075714939f8d9f686b1fec157:.../parallel-closure/195.json`, blob `147670b7a63461df6f09d9b6e6910e40541ca777`.
- Planejamento imutável `dbf9547211d9b0fade619790de7c19c0869b7c7d`; normativo UX `cbac654784714f68779ae1434d30e6ea8970c4d1`. U39 order `7c4fa620fbded6226a0bfc5e5aa16553d6d47ee6`; U40 order `8f9e0e021b1871054be0d371f0f717a5bbd42d36`. Catálogo `31dbec1726fd8147156b01dc545726650ffd49e1`, superfície `50e2993a881e207aa3b2a1cd250a7da84cea5855`, host signatures `e99e094fc3ad5e74832a55aa2639c6bdb27f5255`.
- Produtor A01 U39/U40 consumido somente por leitura: `dashboard/opex/model.ts` blob `a21b1fc6b3cdceec6e666d8d7d8fa760911f2668`; `dashboard/opex/surface.tsx` blob `ed94efe4d919eb80e4592057170d03c4b2348eb6`. Sem edição de UI, SDK, engine ou infraestrutura.
- Contrato F04 da 187: `96c01020db59d9b4f8d44300638418d67ee11fea`, HANDOFF blob `fb48f3d79a2644f91237685eccf29a5e703ac972`, ARTIFACT blob `eb5b45c1417c9a75d59dc926b5b5f5eab1eb53be`; código F04 final `2fb480328fc316259b7a22d58513f9a241058d8a`.

## Entregas — paths exatos e blobs (pre -> post)

| Owned path | Preimage | Postimage |
| --- | --- | --- |
| `packages/app-shell/e2e/sucafina/native/journeys/u39.spec.ts` | `11612644c0ab7f46dbe1ff1943ab37cda354161e` | `285db9bfdd046366f8fd814991f9f0724eff445f` |
| `packages/app-shell/e2e/sucafina/native/journeys/u40.spec.ts` | `3f0dffb03cf848f9d3007e4c0c9b8d0bc3715926` | `83ee904b4ecf79248410a7714bb63ed7baf4aaf5` |

Novos recibos sob `receipts/closure195/` têm preimage `null`; seus postblobs são os objetos da tree Git do commit documental, inclusive este documento. S0-FENCE mantém blob original intacto.

## Comportamento entregue

Ambos os specs conservam **três jornadas Playwright sem skip**: leitura A01 com filtro vazio versus `filtered-empty`, nomes/ref de fonte e IDs únicos; rascunho/review sem POST antes da confirmação, campo anual ausente distinto de zero numérico; cinco larguras 320/768/1024/1280/1440 e 200%/400% de reflow, incluindo acesso visível à busca e ação principal. Coleção de fonte vazia não pode ser sucesso vacuamente positivo: causa falha explícita.

Para cada capítulo `CAP04` / `CAP05` em `year=2026`: `nativeJourneyEntryHref` fixa URL original, `target.chapterHref` exige match exato; `observeNativeBinding` lê discovery/SfContext da sessão real. O `principalRef` atual escolhe `requester`, `holder` ou `dashboardAdmin` do manifesto (nunca `denied`); não concede autorização por nome. `requireNativeJourney({page,manifest,actor,capabilityId,intent,year:2026})` exige `intent:"edit"` para revisão mutável (`read` nas jornadas estritamente leitoras), verifica `canRead/canSave` e preserva `policyVersion/accessRevision`. `proveWeb` cruza principal, candidato e instalação. Releitura original de `/api/ui/context` exige Microsoft, ownership completo, `canRead`, `save`, `domain.page.CAPxx` e `domain.command.CAPxx.save` `ready+operational` no carimbo atual. Falhas determinísticas impedem PASS sem configuração real.

A captura de mutação usa somente `nativeDashboardCommandTarget(manifest,CAPxx)`: `POST {mount}/dashboard?page=OPEX%20Detail` ou `page=CAPEX%20Projects`. Não intercepta nem simula o backend. Nenhuma variável `SF_N13_AUTH_READY` ou `SF_N13_ADMIN_MUTATION` é empregada como permissão.

## Pedido concreto a 189 / PR #65

HEAD `sf2-stack` **apenas observado**, nunca bloqueio/lease: `4426445c05823ed4932b8a8e35391df024bf74f3`, tree `61b5cfc0df910105a67a344706795b4c3b7d30b7`. Seus preblobs observados nos dois specs **coincidem** com os preimages acima, e já possui F04 `fixture.ts=cc7818e623e61e4217dfb2ada18ca3e1fa5f7e12`, `fixture/journeys.ts=66e269a78af8262764228557e2eeccd29bca1a36`, `fixture/readiness.ts=3cbd63012f43c43bbbe3d2c66c03fd2ded6343f9`.

**Rechecar HEAD/preblobs vivos e aplicar apenas os dois postblobs** por CAS/expected-head, `force:false`, em mesmo candidato C. Não importar a branch inteira, refazer F04 nem alterar autorias de outros workers. Registrar ACK real do consumidor após aplicar no candidato, com HEAD/tree resultantes. Se preimages diferirem, classificar drift e reconciliar com 189, sem sobreescrita cega.

## Input externo exato e pedido a 191 / PR #106

Depois de 189 integrar, selecionar **somente**:
`packages/app-shell/e2e/sucafina/native/journeys/u39.spec.ts` e
`packages/app-shell/e2e/sucafina/native/journeys/u40.spec.ts`
no runner Playwright de produção **já existente**, pela autoridade única 191, deduplicada por C/tree/config/manifest/seleção. Não disparar suite geral nem correr em paralelo a outro dispatcher. Exigir manifesto F04 por seleção: `chapterHref` exato (`/orchestra/sf-dashboard/opex?year=2026`, `/orchestra/sf-dashboard/capex?year=2026`), `GITHUB_ACTIONS=true`, `SF_NATIVE_CANDIDATE_SHA=C`, `SF_NATIVE_INSTALLED_MANIFEST` privado 0600 na root 0700; servidor original aprovado via `serverKey`; instalação/projeto/host coerentes; BrowserContext autenticado realmente via Microsoft, sem exportar cookies/tokens; três principais distintos e, para mutação, requester/holder realmente admitido ao Dashboard **ou** quarta sessão `dashboardAdmin` genuína admitida a ambos CAP04/CAP05 com `save`. O browser da jornada precisa usar precisamente a sessão admitida, não apenas ter seu nome no manifesto.

A fixture precisa fornecer read real A01 e registros OPEX/CAPEX não vazios, `domain.page` e `domain.command.save` operacionais, owner/version/record IDs reais e mesmo `SfContext` até o review. Sem isso, registrar falha de precondição, jamais `PASS` por skip/empty selection/flag. 191 deve devolver C/tree, seletor efetivamente coletado, quantidade de casos, run/job IDs, resultado detalhado por U39/U40, evidências de principal e instalação, e blockers observados. 190/PR #107 coordena typecheck/guards de `packages/app-shell` sobre mesmo candidato; não é executor desta missão.

## Evidência e limites

**Não executados nesta sessão:** Playwright, seleção, testes, browser instalado, typecheck, guards, build, parsers, validadores, CI, Electron/D01, provas visuais e release. Nenhum run/job novo; nenhuma alegação de PASS. A leitura de fontes/HEAD e commit/CAS GitHub MCP não constitui prova funcional. `U39-AC01/02/03` e `U40-AC01/02/03` têm asserts atualizados/preservados, mas permanecem **NOT_QUALIFIED**, inclusive fluxos completos CRUD, negação/owner/stale, teclado/a11y/visual e desktop, até testes efetivos no C. F04 ainda é pré-condição instalada; locator visível não prova funcionalidade.

**Estado de consumo:** 189/PR65 `ACK_PENDING`; 191/PR106 `REQUESTED_NOT_DISPATCHED`; 190/PR107 informativo. Comentários em PR são notificações e não acordam sessões nem constituem ACK. Próximo passo executável: 189 consome dois blobs no C por CAS e fornece manifesto/ator realmente admitidos; 191 realiza seleção cirúrgica deduplicada no C e publica run/job/provas; 189 registra ACK e estado de qualificação. `GLOBAL_RELEASE=false`.
