# W05 / F04 — handoff para S0/C00 = integradora 114

**Estado verificável:** `BLOCKED_OWNER / PROPOSAL_READY_NOT_ARTIFACT_READY / NOT_INSTALLED / NOT_RUN`. A coorte autoriza iniciar preflight e publicar ACK, mas exige admissão **explícita por output** da lease `S0-C-e17-browser114` antes de escrever os paths de produto. A W05 pediu admissão no comentário PR65 #6896686058; **não há GO observado**. Nenhum teste local, Action, compiler, merge, epic, deploy ou Azure foi executado.

## Autoridade e preflight

- Branch precriada `sf-ux-w05`; base `f8e442616c96651f3b26013b34b8ce697860e3e2`, produto C58 `422f1ed7b549021d7c62c834c9d9041279112af4`.
- Canônico `dbf9547211d9b0fade619790de7c19c0869b7c7d`, norma `cbac654784714f68779ae1434d30e6ea8970c4d1`; pacote W05, COMMON e F04 lidos. Contratos fechados e source re-pin em `SOURCE-REPIN-W05.json`.
- Protocolo de execução do branch tem 2 linhas de nomes obsoletos; o blob normativo é `0151a8e6cbb0da2118e058142af801ba7cf72094`. O COMMON faz o roteamento vigente: 114 integração, 120 Actions, 119 compiler.
- Produtor Procurement no C58 usa visibilidade antes do CAS; P0 é `draft` com versão corrente `requests:<id>`; P1 é `pr_pending` com `prApproval.steps` e holder real, sem antecipar aprovação. O bootstrap e a autorização da UI nativa seguem exclusivamente os donos F01/F02/I00.

## Código de proposta congelado — não instalado

Materiais independentes, publicados **somente** sob `receipts/native-ui/W05/proposed/**`. Os imports se referem à **posição de destino**, não ao recibo; não devem ser compilados/consumidos in situ. Aplicar após GO com preimages exatas, e nunca considerar a presença desses arquivos como fixture executada:

| Recibo de staging | Destino exclusivo W05 após admissão | Finalidade |
| --- | --- | --- |
| `proposed/fixture.ts` | `packages/app-shell/e2e/sucafina/native/fixture.ts` | Playwright `nativeInstalledFixture`, fail closed sem manifesto/host real |
| `proposed/fixture/corpus.ts` | `packages/app-shell/e2e/sucafina/native/fixture/corpus.ts` | `nativeCorpus` WP00 e seed real `ProcurementModule.domain.execute`, **DOMAIN_FIXTURE_ONLY** |
| `proposed/fixture/scratch.ts` | `packages/app-shell/e2e/sucafina/native/fixture/scratch.ts` | Diretório 0700, SQLite local production adapter, enrollment legítimo e limpeza |
| `proposed/fixture/readiness.ts` | `packages/app-shell/e2e/sucafina/native/fixture/readiness.ts` | Verifica manifesto privado 0600, principal/owner/IDs e resposta real do host; não inventa session/grant |
| `proposed/fixture/response-faults.ts` | `packages/app-shell/e2e/sucafina/native/fixture/response-faults.ts` | Playwright entrega request ao produtor real, depois perde/segura resposta; nenhuma falha 403/receipt simulada |
| `proposed/fixture/selection.ts` | `packages/app-shell/e2e/sucafina/native/fixture/selection.ts` | Reconhecimento lexical de paths E2E, nunca uma seleção ou dispatch real |

**Limitação explícita:** o helper de domínio recebe `Actor` fornecido pelo host, mas não autentica sua proveniência. Assim, a negativa do domínio sob outro actor é no máximo `DOMAIN_FIXTURE_ONLY`; **não** atesta identidade/ACL/revogação instalada. Uma prova real exige chamadas HTTP/SDK com principals legitimamente admitidos, no mesmo store, e verificação de ausência de commit/recibo em caminho negado.

## Shared/host: patch depende da integradora 114

`packages/app-shell/e2e/playwright.production.config.ts` blob inicial `ae56b7fc9da248ee8e34d73d0eb13c8fe8e0c088` é **shared**. A W05 não alterou o arquivo. A 114 deve registrar o reconhecedor `nativeSpecSelected` e associar **somente** a seleção E2E nativa ao processo **real** de instalação (CLI original, host context/discovery e sessão corrente), sem novo `Bun.serve`, backend paralelo, webServer sintético ou segundo dispatcher. Não inserir comando de host antes da composição efetiva F01/F02 e do contrato de manifesto `sf2h.native-installed-manifest.v1`. O host deve criar um arquivo privado por execução com `candidateSha`, `target/wrongServer/wrongProject/wrongInstallation`, três principals `requester/holder/denied` reais e root 0700. Validar ausência de secrets/URLs de enrollment nos artifacts.

**Impedimento causal adicional:** `prepareOperatorAccess` usa a conta OS local corrente; um único local-operator não cria sozinho várias sessões autorizadas independentes na mesma instalação. É preciso fixture de identidade genuína e autorizada (ou outro mecanismo legítimo já suportado), sob owner 114, sem grants/actores forjados. A fixture WP04 existente usa wrapper sintético de viewer e serve HTML legado: não equivale ao Electron/chapters nativos instalados. A suite WP10 usa CLI real, mas até integrar F01/F02 não comprova UI nativa.

## Provas e seleção para a 120/119

A seleção **proposta, não despachada**, está em `CI-REQUEST-W05.json`. O recorte mínimo após integração e admissão: componente F01/F02/F03 (rotulado COMPONENT), fluxo P0 `U11.title-save` sob CAS real e P1 `U13.pr-approval` sob holder real, isolamento Q01, apresentação Q02, e falha de resposta após produtor; nenhum retry automático. Component mocks, snapshots e seed não entram como PASS instalado. Desktop segue gate **D01** independente: Electron empacotado, `oc://renderer`, Microsoft/partição real, broker/main/preload, callback e revogação; nenhum browser screenshot substitui.

Status atual: **0 testes W05 executados**, **0 specs W05 coletadas**, **0 runner instalado**, **0 evidência desktop**. Os resultados preexistentes da C58 são de outras seleções e incluem falhas; não reaproveitar como aprovação F04. Nenhum `GLOBAL_RELEASE`.

## Próximo owner handoff verificável

114: reconciliar ACK/branch e source-pin C58, publicar GO ou BLOCKED_OWNER causal da W05, providenciar multi-actor/auth real e montagem host + patch shared com pre/postimages; **somente após GO** transferir os seis leaves do staging para a allowlist e validar suas assinaturas. 120: deduplicar seleções cirúrgicas Actions depois da composição e registrar runs/artifacts reais. 119: compiler, guards e semântica do generated no mesmo candidato. Consumidores Q01/Q02/U10/U11/U13: publicar as journeys reais nas próprias allowlists. W05 não assume suas branches nem registros globais.

Este handoff é **proposta de implementação auditável**, não pedido de merge, qualificação instalada ou aprovação do epic.
