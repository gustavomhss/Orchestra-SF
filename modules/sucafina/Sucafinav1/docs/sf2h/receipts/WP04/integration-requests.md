# WP04 — deltas reservados aos proprietários de integração

Status de aceitação integrada: **BLOCKED**. A PR de WP04 permanece draft. Estes pedidos fazem parte do handoff executado; não são alterações aplicadas fora do ownership. O commit de planejamento é `dbf9547211d9b0fade619790de7c19c0869b7c7d`; o seed de WP04 é `d183840f71eaa07244d984f314facfb76ef25799` e a base da PR é `sf2-stack`.

## INT-01 — WP10: projector canônico em todas as mutações

Path: `modules/sucafina/Sucafinav1/product/integration/procurement-projections.ts`.

O seed (blob `08fdfb878f6f9282f70ec71b3e66122f1b95f6f5`) não reconhece `procurement-confirmation-v1` nem a lista de campos com `approvalStage`. WP10 observado em `dc6bf9e4e8f3d2fa01d01c76d5575892a8ced82f` possui blob `fbb8aacabf59b7247037fb5eca709b520d509ea6` com suporte parcial atualizado. WP04 exporta agora uma única implementação canônica.

Delta exato proposto: importar `projectProcurementScope` de `../procurement/source-projection.ts` e exportar `const projectSfProcurementScope = projectProcurementScope`. Os patches `WP10-delegate-from-seed.patch` e `WP10-delegate-from-current.patch` preservam o nome público. Integrar o produtor WP04 antes da delegação. A composição deve continuar usando `createSfSourcePersistence({projectScope})` no commit durável para detectar A→B→A e delete/recreate.

Prova exigida ao integrar: emitir request/C06 pela aplicação comum, alterar material e reverter, reiniciar persistência e verificar invalidação/encarnação sem trocar driver ou autorizar por seletor.

## INT-02 — WP00: schema de CommercialComparison

Paths sob `modules/sucafina/Sucafinav1/product/contracts/`: `outputs.ts`, `output-schemas.ts`; gerador canônico no mesmo produtor. Pin observado WP00: `72342f0efbbe099231aa2e30a964769b14e4fbb2`.

| Artefato observado | Blob |
| --- | --- |
| `outputs.ts` | `4db2e631bd83ccda67442824557881c2ed990c92` |
| `output-schemas.ts` | `0d9fc51d26a0ca726d32e74605b555f871d99af6` |
| `generate-output-schemas.ts` | `eef174095e02eb4448a6c53d6119ce7a8fda4a9d` |

Delta necessário: integrar o contrato proprietário com `components`/`money` nas propostas e `weights`/`selection` na raiz, regenerando oficialmente o schema fechado. O seed recusa esses campos reais. Não remover dados do produtor, relaxar `additionalProperties:false`, usar um decoder substituto ou converter o teste de sucesso em expectativa de recusa.

Prova exigida: `sf_sourcing_compare` real atravessa `dispatchSfCapability` e `decodeSfOperationOutput` com a fixture A/B/C e autoridade atual, preservando componentes, FX, seleção e recibo do handler.

## INT-03 — WP10: verificador de sourcing com critérios configurados

Path: `apps/cli/src/sucafina-product/analysis-verifier-procurement.ts`; blob observado `55d474261b8f74b42af2e6a2b8400b1b9adc60aa` em `sf2-host-ready` e `sf2-compose`.

O verificador recusa quando `value.weightsAndEligibility.length || actual.value.weights.technicalCriteria.length || actual.value.weights.commercialCriteria.length`. Assim recusa o caso real com critérios configurados. Delta de proprietário: comparar critérios, pesos, elegibilidade e proveniência aos inputs tipados, mantendo a verificação de evidência, em vez de exigir arrays vazios. A decomposição do produtor não deve ser removida para satisfazer o consumidor.

Prova exigida: carga real de skill e Session, corpus A/B/C completo com critérios, conferência de consumo/recibos e negativos de adulteração/revogação. Não basta catálogo, chamada direta de helper ou resposta denied.

## INT-04 — WP10 com WP08/WP09/WP11: montagem do host

Path: `apps/cli/src/sucafina-product/business-services.ts`. WP10 observado: blob `c4f4811234948daa04394e2dc82b58fd86622b16`; `sf2-compose` em `22756b300939c50ca93403b48c6244dd7c179977`: blob `54cb9612b58e6c3bd1e665d0a0093011ea1aa2d5`.

A composição observada monta collection/individual/contract/port/capabilities/sourcingEvidence, mas não C06, C12 ou preparação de dossiê. Delta necessário:

1. Instanciar `createProcurementConfirmationObserver`; rotear `sf-procurement-c06:` antes de full-record/collection, preservando fields/period/encarnação. Conectar observe/fence/verifyManifest/fenceManifest em `product/collaboration/host.ts`.
2. Instanciar `createProcurementC12Bridge` de `product/procurement/c12.ts`; conectar prepareScenario/reviewDomain/resolveMutation/receiptVersion a WP11. Carregar escolha/comando em armazenamento privado autorizado; confirmação humana, transação atômica e recibos continuam em WP11.
3. Instanciar `createProcurementDecisionPreparation`; conectar `prepareProcurement` e revalidação ao `product/routines/dossier.ts` de WP09. Retorno é rascunho read-only, sem emissão de PO ou mensagem externa.
4. Integrar as implementações proprietárias ausentes `product/routines/factory.ts` e `product/routines/dossier.ts`, importadas por contratos/testes do seed. Não criar substitutos de demonstração em WP04.

Pins consumidores observados: WP08 `13285296acd05f777e31fc7867da1e3055e1e4af`; WP09 `b58601f92f3bc8742e5a7c72a34d5ddf1fd87fe8`; WP11 `ba2822bb06a8ad741ecbcf0d47654d1a86a3a95b`.

Prova exigida: consumidor composto real, persistência/reload, mudança entre preparação e consumo, autoridade revogada e isolamento entre atores. Nenhum destes pins é descrito como integrado pela PR própria.

## INT-05 — WP01: erros locais, versão de conflito e foco

Paths: `modules/sucafina/Sucafinav1/src/screen-shell.ts` e `modules/sucafina/Sucafinav1/runtime/contract.ts`.

O shell preserva inputs sujos e mostra stored/attempt no 409, mas não consome `fieldErrors` dinamicamente nem implementa o fluxo explícito de revisão/foco. `conflict()` retorna stored/by sem a revisão CAS corrente. O renderer próprio já associa erros iniciais ao campo, escapa texto e mantém valores condicionais.

Delta concreto para WP01:

- Acrescentar `currentVersion?: number` ao ramo de erro de `Result` e retornar `currentVersion: current?.version ?? 0` em `conflict()` junto de stored/by.
- Passar o formulário remetente de `send` para `showResult`; ao receber fieldErrors, localizar o controle por nome dentro desse formulário, apresentar `message` via `textContent`, associar `aria-invalid`/`aria-describedby` e focar o primeiro controle válido. Não usar HTML fornecido pelo servidor, selector interpolado com campo arbitrário ou apagar inputs.
- Para 409, apresentar valor atual, tentativa e revisão corrente; manter comentário e demais inputs. Só uma ação humana explícita de revisão pode atualizar a versão usada numa nova tentativa; não reaplicar automaticamente approve/reject/save.
- Preservar a proteção existente de `applyRefresh` contra formulário dirty/focado e confirmar retorno de foco/contexto no fluxo aprovado por WP01.

Prova exigida: dois atores na mesma versão, segundo save e decisão recusados, inputs/comentário preservados, foco utilizável, revisão explícita sem replay e sem falsa confirmação de salvamento. Também verificar erro 422 em campo repetido correto e navegação por teclado.

## INT-06 — WP14/WP10: seam do resolver na memória de decisão

Paths: `product/decision-memory/source-access.ts`, `apps/cli/src/sucafina-product/business-services.ts` e teste proprietário `test/product/wp14/source-access-procurement.test.ts`.

O consumer tipa `resolve` como o objeto `ReturnType<typeof createProcurementSourceResolver>`, mas o chama como função. O host já passa a função; o seed WP04 já retornava o objeto. Delta exato em `WP14-WP10-procurement-resolver-seam.patch`: tipar como `ReturnType<typeof createProcurementSourceResolver>["resolve"]` e anotar `procurementHost: ProcurementSourceHost` para contextualizar snapshot/evidence. O tipo derivado em business-context acompanha automaticamente.

Migrar a fixture antiga para o lifecycle real com projectScope/scopedSources, `issue()`, `resolver.resolve` e `resolver.isCurrent`. Os imports antigos `procurementSourceSelector`/`isCurrentProcurementSource` já não existem no seed; não reintroduzir seletor forjado como autoridade.

## Gate de tipos e aceitação final

`typecheck-triage.json` e `typecheck-triage.md` registram as causas do primeiro run e o fato de os paths estrangeiros não terem sido alterados. A atribuição ao seed é análise estática, não um typecheck histórico executado no seed. O resultado final observado está em `ci-evidence.json`.

O handoff exige registrar gaps e manter draft quando o fechamento depende desses paths. Testes próprios verdes não tornam typecheck do package verde, não instalam o host e não substituem as oito seleções globais, C/G7, D/G8 ou AM01–AM06. Nenhum merge, deploy ou mensagem externa foi realizado.
