# G08 — executor privado, produto atual e obrigações preservadas

## Recorte desta adaptação

Este executor mantém os nove IDs/títulos originais de Teams e os quatro atores Microsoft originais. A adaptação anterior ao [produto 7a28c5](https://github.com/gustavomhss/Orchestra-SF/tree/7a28c5eefece4cae5de0e376ad3bafbe5290a928) acrescenta os dois cenários de rascunho, abre a administração pela UI montada e verifica que revogar/restaurar acesso preserva os documentos compartilhados de A e B.

Esta revisão completa o oráculo de `same-team-distinct-grants` com a projeção real de páginas/ACL do [produtor F02 0d4876dd](https://github.com/gustavomhss/Orchestra-SF/commit/0d4876dd457da3ddf7d8dc4b122215eb772a14dc). Há **nove cenários executáveis com os nove mapeamentos integrais de contrato**. Isso não declara nove obrigações aprovadas: todos os registros permanecem `NOT_RUN` até uma execução instalada válida. A comparação exige destinos canônicos realmente distintos entre dois atores do mesmo Team; principal, accessRevision e availability não substituem páginas/permissões. O produtor conserva availability e ações vazias quando não há binding real.

[obligations.json](./obligations.json) preserva ainda U15=6, U39=22, U40=22, F04=3 e as seis fases AZ02. Seus IDs, títulos, fontes, contagens e estados não foram requalificados por esta adaptação. Nenhuma nova lane, flag de aprovação, configuração, credencial ou autoridade é criada.

Fontes dos contratos usados:

- [Plano obrigatório 736a](https://github.com/gustavomhss/Orchestra-SF/blob/736a5087c223629be4d73c8a4535d615fcafd96a/docs/architecture/teams-profile-test-plan.json), G08-NATIVE-TEAMS, e [nove cenários originais](https://github.com/gustavomhss/Orchestra-SF/blob/aa928b6ae4a5944e5dad4b5bd206d5c123d2238e/packages/app-shell/e2e/sucafina/g08/teams-installed.spec.ts).
- [Shell/navegação 7a28](https://github.com/gustavomhss/Orchestra-SF/blob/7a28c5eefece4cae5de0e376ad3bafbe5290a928/packages/app-shell/src/pages/team-profile.tsx): seletor nativo, URLs fechadas, toggle administrativo, Chat e confirmação de descarte.
- [Workspace Chat 7a28](https://github.com/gustavomhss/Orchestra-SF/blob/7a28c5eefece4cae5de0e376ad3bafbe5290a928/packages/app-shell/src/pages/team-session.tsx) e [Client Sessions 7a28](https://github.com/gustavomhss/Orchestra-SF/blob/7a28c5eefece4cae5de0e376ad3bafbe5290a928/packages/client/src/sucafina/sessions.ts): composer nativo, lista/SSE, namespace completo e aposentadoria da sessão.
- [Administração 7a28](https://github.com/gustavomhss/Orchestra-SF/blob/7a28c5eefece4cae5de0e376ad3bafbe5290a928/packages/app-shell/src/components/team-profile-administration.tsx) e [HTTP privado 7a28](https://github.com/gustavomhss/Orchestra-SF/blob/7a28c5eefece4cae5de0e376ad3bafbe5290a928/modules/sucafina/Sucafinav1/runtime/team-profile-http.ts): catálogo administrativo e leitura de configuração por identidade atual.
- [F02/eligibilidade 0d4876dd](https://github.com/gustavomhss/Orchestra-SF/blob/0d4876dd457da3ddf7d8dc4b122215eb772a14dc/modules/sucafina/Sucafinav1/runtime/team-business.ts): projeção de páginas admitidas pela aplicação original com roles Microsoft e ACL da partição Team; principal autenticado em no-teams/revoked; administração não concede negócio. A mesma resposta associa destinos ao owner atual, sem promover availability ou ações sem binding.
- [Store 7a28](https://github.com/gustavomhss/Orchestra-SF/blob/7a28c5eefece4cae5de0e376ad3bafbe5290a928/modules/sucafina/Sucafinav1/runtime/team-profile-store.ts): revisão global opaca e documentos compartilhados persistidos. Não existe contrato cliente de +1/+2.

O SHA inspecionado é uma referência de implementação, não um ACK de candidato final. Os contratos precisam estar no C/T efetivamente instalado. O preflight recusa arquivos necessários ausentes antes de conectar o browser; presença de arquivo continua insuficiente para provar montagem ou autoridade.

## Nove obrigações e seus oráculos

| Obrigação original | Oráculo atual | Limite |
| --- | --- | --- |
| `same-team-distinct-grants` | Dois contexts/principals originais no mesmo Team; destinos canônicos realmente distintos; resposta F02 da UI igual ao GET independente por ator, antes e depois dos dois reloads, com owner preservado. | Diferença de identidade, revisão, availability ou ordem não é diferença de grants. Ambos vazios falham. |
| `aba-two-windows` | F02 da ação em A→B→A, URLs exatas, janela irmã em A após reload e igualdade do fingerprint original antes/depois. | Igualdade de projeções vazias não prova grants distintos. |
| `account-without-team` | F02 identifica o ator no-teams; Team explícito revoked sem owner/dados/Chat; rota original de negócio 403 sem body. |403 isolado não identifica o ator. |
| `foreign-deep-link-reload` | Link válido + reload; instalação estrangeira mantém URL, UI invalid, nenhum F02 Team e nenhum fallback. | A URL é intenção, nunca autoridade. |
| `admin-without-team` | Ator original sem Team abre o toggle real; GET da UI e reread independente do catálogo coincidem; controles prontos, sem dashboard/Chat; Team explícito permanece403. | Não monta a antiga rota administrativa nem substitui UI por API. |
| `narrow-keyboard-draft` | Web 390×844, Enter no botão real, URL completa, F02/lista/SSE originais, namespace canônico, composer editável vazio e zero POST. | O botão Novo dentro do workspace já pronto é local; não se inventa outro F02. |
| `draft-cancel-discard` | Cancelar conserva A e o texto; confirmar muda para B com composer pronto e vazio; voltar a A não ressuscita texto. F02/lista/SSE e namespace são reobservados. | O caso inteiro observa zero POST; não há criação de sessão nem prompt. |
| `real-revoke-restore` | Disable/enable únicos com CAS observado, catálogo relido, revogação/403 para ambos os atores, B intacto e admissão restaurada. Documentos de A/B devem permanecer iguais. | A revisão global avança e nunca é rebobinada para fingir restauração. |
| `logout-original-context` | POST original 204, mesmo contexto 401, outra janela 401 após reload, holder com owner e fingerprint preservados. | Não prova replay bruto, logout global Entra ou restart; esses pertencem a AZ02. |

O primeiro cenário compara exclusivamente `capabilityId/surface/page/canRead/allowedActionIds`, ordenando destinos e ações e recusando duplicatas. Após cada reload, o F02 originalmente consumido pela UI e a leitura independente precisam conservar o owner e a projeção daquele ator; as duas projeções ainda precisam diferir. As leituras não criam permissões e não alteram a configuração dos atores.

A UI pode representar Team explicitamente revogado como unavailable. O executor exige F02 revoked original, ausência de owner/destinations/availability e de controles de negócio, mais o403 original. Não inventa um alerta de uma UI histórica.

Os dois casos de rascunho registram as esperas da lista e do stream antes da ação. Conferem os peers HTTPS 443 reservados, status/cabeçalhos originais, selector fechado sem principal/grants e namespace retornado. O Client real valida a lista inteira e cada frame; o teste só aceita workspace pronto, stream aberto e composer editável. Não há `page.route`, resposta substituída, cookie copiado, `storageState` ou POST do executor para abrir o rascunho.

No caso de revogação, os documentos canônicos de A/B são lidos antes da mutação e novamente após restaurar acesso. A leitura final deve corresponder à revisão atual do catálogo; o conteúdo inteiro dos dois documentos deve ser igual. Se o disable tiver resultado incerto, uma leitura original distingue catálogo intacto do estado desabilitado esperado. Não há retry, token CAS coercionado ou restore para um estado não observado. Falha de restauração impede recibo.

## Recibos

- `sf-g08-executor-inventory-v4 / CURRENT_CONTRACT_INVENTORY_VERIFIED`: nove registros `LISTED_NOT_RUN`, `installed:false`.
- `sf-g08-current-installed-v4 / CURRENT_TEAMS_SUBSET_INSTALLED_VERIFIED`: somente após os nove resultados reais no host reservado e no mesmo tar G07, `installed:true`.
- Ambos mantêm `proofScope:"current-teams-subset"`, `g08Closed:false` e `productionCutover:false`.

O formato v4 diferencia o oráculo de destinos reais dos sete controles v2 e do inventário v3 com nove cenários e grants parciais. Recibos históricos continuam vinculados aos próprios SHAs e não são reescritos. Tanto o relatório antigo de sete casos quanto o relatório de nove com o título principal-only são recusados. Uma execução instalada válida pode produzir nove PASS de Teams; todos os grupos separados continuam NOT_RUN. `require-closed-gate` continua recusando o subconjunto com `G08_REQUIRED_OBLIGATIONS_NOT_PROVEN`.

## Limite operacional

Somente o job manual existente `installed-teams-current` conecta o browser. A implementação dos produtores de pacote/inventário é independente dos insumos LIVE abaixo; esta adaptação não atesta a presença nem a ausência deles em uma reserva futura.

São necessários C/T final confirmado pelas fontes de Migração e Release, recibo G07 original `PACKAGE_VERIFIED`, tar/manifest/factory imutáveis, instalação desses bytes e witness antes/depois. Reserva exclusiva QA exige responsável, VM ID, janela e referências de autorização dos atores, logout e disable/restore temporário de A. Runner label ou ambiente protegido não substituem reserva; metadados de autorização não são grants.

Os quatro BrowserContexts Microsoft originais devem corresponder a requester, holder, denied e dashboardAdmin distintos. Requester/holder precisam de A; requester também de B; denied e dashboardAdmin não têm Team; o administrador deve ter a autoridade administrativa real. Cada contexto é identificado pelo F02 atual, nunca por etiqueta manual. Requester e holder precisam ter projeções de páginas/permissões realmente diferentes em A, já estabelecidas pelos produtores e pela política existentes; o executor não atribui roles nem modifica ACL para fabricar essa diferença.

Para abrir os dois drafts, requester precisa da concessão privada real de leitura de sessões em A/B, dos documentos compartilhados já preparados pelo operador e da persistência/Core/controle privado já inicializados pela migração explícita. O executor não cria banco, ativa geração, provisiona configuração ou instala segredo. **Os dois casos sem POST não exigem chave pessoal ativa de provider e não qualificam dispatch ou conclusão de modelo.**

Root privado 0700 e arquivos 0600 devem pertencer ao runner, sem symlinks/hardlinks, fora do checkout. O plano continua `sf-g08-private-plan-v1` com os mesmos campos fechados:

```text
candidate: { sha: C completo, tree: T completo }
packageReceiptSha256: digest do recibo original G07
reservation: { reference, owner, startsAt, endsAt, vmId, environment: qa-isolated, exclusive: true }
approvals: { actorsReference, mutationReference, scope: qualification-only }
invocation: { id: nonce32hex, runId, runAttempt, workflowSha }
target/teamB/foreignInstallation: { serverKey, discoveryOrigin, shellOrigin, publicOrigin,
  installationId, tenantId, teamObjectId, projectId, hostId, mount, chapterHref }
actors: { requester, holder, denied, dashboardAdmin }
scratchRoot: diretório privado absoluto
```

A/B pertencem à mesma instalação/tenant/host, com IDs distintos. O target negativo muda apenas installationId. `chapterHref` admite somente `/`, `/orchestra/sf-home` ou `/orchestra/sf-home/context`, com os cinco campos `contractRevision/server/installationId/tenantId/teamObjectId` correspondentes ao target. A URL `/orchestra/sf-sessions/new` é derivada desses valores; não amplia a allowlist do plano.

A sequência continua `admit → host-before → Playwright → host-after → verify`. Não instala, reinicia, clona sessão nem fabrica consentimento. Cache/SW são contornados nas páginas próprias; respostas são vinculadas ao frame e aos IPs HTTPS da VM. Cleanup fecha as páginas criadas, desconecta o attach, exige os mesmos processos/bindings e conserva o avanço legítimo do CAS. O recibo público contém apenas C/T, digests, IDs estáveis, contagens e cobertura; corpos, URLs, CDP, cookies e erros brutos permanecem privados.

## Validação focal no workflow existente

Usar `mode=controls` em [g08-private-preflight.yml](../../../../../.github/workflows/g08-private-preflight.yml), sobre o commit integrado. Os comandos abaixo pertencem ao job Actions existente; não são execução local ou LIVE.

Na raiz:

```sh
node --test script/sf-ci/g08-private-evidence.test.mjs
python3 script/sf-ci/test_g08_installed_preflight.py
bash -n script/sf-ci/g08-private-run.sh
```

Em `packages/app-shell/e2e/sucafina/g08`:

```sh
bun typecheck
```

Em `packages/app-shell`, com as variáveis/nonce omni e o diretório privado de evidências preparados pelo mesmo workflow:

```sh
bun test --conditions=browser --preload ../../script/test-omni-control.ts --preload ./happydom.ts --reporter=junit --reporter-outfile "$SF_G08_TOOLING_EVIDENCE/landing-dom.junit.xml" ./e2e/sucafina/g08/landing-contract.test.ts
bunx --no-install playwright test --config e2e/sucafina/g08/playwright.config.ts --list
```

Novamente na raiz:

```sh
node script/sf-ci/g08-private-evidence.mjs verify-list "$SF_G08_TOOLING_EVIDENCE/list.json"
bun run check:guards --base origin/dev
```

Os controles Node recusam omissão/substituição das obrigações, relatório antigo, retry/skip/filtro e promoção indevida de grants ou grupos. O controle DOM renderiza a página/leitor reais com transporte controlado e verifica inclusive administração sem Team e refresh único. Os testes de produto Chat/composer continuam na suíte existente `test-browser/team-session-page.test.ts`; não são duplicados nem substituídos por este inventário.

Um `--list` verde só prova carregamento dos nove cenários. Somente relatório inteiro, workers 1/retries 0, nove resultados originais, exit 0, witnesses íntegros e cleanup completo podem produzir o recibo instalado v4. A execução instalada segue dependendo da reserva autorizada; nenhum comando instalado foi executado nesta adaptação.

## Obrigações fora deste recorte

U15/U39/U40, F04 e todas as fases AZ02 continuam obrigatórios e separados, conforme fontes e contagens de [obligations.json](./obligations.json). Esta escrita não altera sua matriz, seus produtores nem seu estado. O fechamento global também exige a diferença real de grants, o mesmo candidato/tar G07 e os demais papéis próprios do gate.

Ver [G08](../../../../../docs/qa/sucafina/go-live/g08-teams-qa.md) e [status global](../../../../../docs/qa/sucafina/go-live/status.json). Seus resultados históricos permanecem vinculados aos próprios SHAs e alcances. Este executor continua recusando declarar G08 fechado.
