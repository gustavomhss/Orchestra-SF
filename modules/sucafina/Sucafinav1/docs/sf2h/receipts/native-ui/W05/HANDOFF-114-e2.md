# W05 / F04 — sucessão e2, handoff executável para 114

**Estado: ARTIFACT_READY (somente autoria) · BLOCKED_INTEGRATION · NOT_RUN · NOT_QUALIFIED.** 114 continua integradora única / PR65; 120 Actions / PR106; 119 compiler/guards / PR107. Este documento substitui o handoff e1 como estado atual; conserva o anterior para auditoria.

## Fencing e entrega

- ACK e2 real: commit `c22b3e2bb3b13773c9645526f978641c9c26da68`, GitHub actor `gustavomhss`, GPT-6, session ID não exposto; lease `ux-native-w05-e2`. HEAD original exato `a55c868cb3fce003ed7ea285c58a6712d3cd7301`; e1 revogado para novos aceites.
- Código materializado e corrigido, commit `664ce4330211a2dcd6d59e5884df0b305a8524d5`, árvore `dceffb1a30d7808b1f8c812eb465061adfe0b800` na branch existente `sf-ux-w05` / PR120 contra `sf2-stack`; **nenhuma alteração em paths compartilhados**.
- Os seis leaves eram inexistentes na allowlist antes da e2; agora estão em `packages/app-shell/e2e/sucafina/native/fixture.ts` e `fixture/{corpus,scratch,readiness,response-faults,selection}.ts`. Também foi criado `packages/app-shell/test-browser/sucafina-native/fixture/selection.test.ts`. Blobs exatos e antigos staged em `ARTIFACT-W05-e2.json`. Não consumir a branch UX inteira (contém coorte de planejamento não integrada).

## Comportamento efetivo

- `nativeInstalledFixture` é Playwright, **falha fechado** sem manifesto privado emitido por host autorizado. `readNativeManifest` exige Actions, `SF_NATIVE_INSTALLED_MANIFEST` 0600/UID, scratch 0700/UID, shape exato, três principais distintos, fronteiras de servidor/projeto/instalação, SHA do manifesto igual a `SF_NATIVE_CANDIDATE_SHA`. Cada target separa **`discoveryOrigin`** (API Orchestra sob serverKey), **`shellOrigin`** (navegação nativa do app) e **`publicOrigin`** (API host Sucafina). NUNCA rotear discovery pelo origin do host. O cliente/SDK real da 114 deve resolver serverKey para conexão autorizada, não aceitar origem de formulário.
- `proveNativeWebReadiness` consulta discovery e `{mount}/api/ui/context` reais (sem redirects/retries), verifica IDs/host/auth/contract/policy/access e principal admitido. Locator visível **não é prova por si só** de chapter nativo; a observação rotula `nativeChapterRendered: NOT_PROVEN_BY_LOCATOR_ALONE`, P0/P1 `NOT_PROVEN` e desktop `NOT_PROVEN_REQUIRES_D01`. Não usa HTML WP04 nem webServer paralelo.
- `createNativeScratch` cria diretório único 0700, configuração/chaves produtoras reais, SQLite local durável, inscrição legítima de **um** operator OS e descarte; isto NÃO fabrica contas Entra ou três principals. `sourceNativeVolume` reutiliza corpus WP00 e confere 1000/200/100, valores financeiros sintéticos e oráculos 590000/602000/596000, sem fórmulas de negócio paralelas. O primeiro PO de volume vale **1**, não 32000: os 32000 USD são o PR do piloto WP00.
- `seedNativeProcurementCorpus` usa `ProcurementModule.domain.execute` em transação do storage real, settings CAS, cria P0 draft e P1 `pr_pending` através de `submit_pr`, confirma holder/version e negativa **domínio-only** de approver não-holder em transação sem commit. Os `Actor` argumentos não são prova de autenticação; **`DOMAIN_FIXTURE_NOT_INSTALLED`** deve sobreviver a qualquer relatório. P0 não aprova, P1 não finge approval/receipt.
- `armLostResponse` e `armHeldResponse` usam `route.fetch` do produtor real; uma resposta perdida não comprova sucesso/commit e não autoriza retry de mutação. Observações exigem status real; revogação é callback do produtor a revalidar por refetch e UI. Se não houver resposta real, falham.
- `nativeSpecSelected` reconhece specs nativas exatas, inclusive caminhos relativos/Windows/regex CLI; nunca conta `--list` como execução, nem specs de fixture/WP04. Um teste puro foi escrito e está **NOT_RUN**.

## Host / shared: entrega para 114, NÃO aplicada

Preimage imutável `packages/app-shell/e2e/playwright.production.config.ts` = `ae56b7fc9da248ee8e34d73d0eb13c8fe8e0c088`. **Arquivo inteiro proposto**, em `modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/W05/proposed/shared/playwright.production.config.ts` (blob `e2b615a50c3907bbe21fd6158be47fcebf477679`), adiciona reconhecedor e fail-closed por manifesto/SHA somente na seleção nativa. Antes de aplicar, 114 deve reconciliar preimage com HEAD e composer real, sem descartar edições de outros owners. **O patch não inicia host nem autentica usuários:** 114 precisa compor CLI/SDK/provisionamento real F01/F02, instalar manifest privado por execução, iniciar a instalação autorizada na seleção real e vincular `shellOrigin`, `discoveryOrigin`, `publicOrigin` a conexões aprovadas. Sem isso não coletar/qualificar nativas. Não usar WP04/snapshot, Bun.serve novo ou backend concorrente.

Bloqueio real: `prepareOperatorAccess` vincula o UID corrente; um local-operator não providencia requester/holder/denied verdadeiros independentes no mesmo store. I00 deve prover sessões genuínas Microsoft/B2B (ou mecanismo autorizado existente), provar negativo 403/404 via HTTP e verificar ausência de side effect/receipt; não usar `Actor` sintético para obter PASS instalado. D01 exige Electron empacotado, broker/partition/callback próprios.

## Testes, critérios, integração

- **W05 executou 0 testes, 0 coleta, 0 typechecks, 0 guards, 0 builds, 0 browsers, 0 desktop.** Código não declarado compilado ou green. `F04-AC01` pendente seleção nativa coletada + host real; `F04-AC02` corpus/isolamento escrito, execução pendente; `F04-AC03` desktop pendente D01.
- Para 120: `CI-REQUEST-W05-e2.json` define teste puro `selection.test.ts`, depois seleções hospedadas Q01/Q02/U10/U11/U13 do mesmo C, dedup por C/tree/selection/config/runtime, evidência negative ACL/owner transition/response loss, sem full epic precoce.
- Para 119: `bun typecheck` em `packages/app-shell` e guards no candidato composto, geração client somente se 114 integrar mudança pública Protocol/HttpApi, nunca generated à mão.
- Dependências de integração: F01/F02 e composição shared da 114. Qualificação: host instalado autenticado + F03/A03/S01/S03, U10.queue/U11.title-save/U13.pr-approval/Q01/Q02 e desktop D01; M31/MI07 e gates canônicos permanecem. Nenhum GLOBAL_RELEASE.

**Handoff/lease e2:** ARTIFACT_READY e autoria exclusiva transferida para consumo de 114, sem fechar prova nem declarar integração. Consumidor deve registrar ACK com blobs/prepost e C real. Qualquer correção futura exige nova lease do owner; sem reset, force, merge de envelope, deploy, Azure ou Goal.
