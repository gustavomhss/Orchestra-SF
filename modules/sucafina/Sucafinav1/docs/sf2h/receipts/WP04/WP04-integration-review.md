# WP04 — revisão independente das integrações

## Fontes observadas

Leituras por GitHub MCP; nenhum teste local, escrita remota, merge ou modificação de arquivo alheio.

| Fonte | HEAD |
| --- | --- |
| WP04 seed / branch astra-wp04 | d183840f71eaa07244d984f314facfb76ef25799 |
| sf2-stack | 6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0 |
| WP00 astra-wp00 | 72342f0efbbe099231aa2e30a964769b14e4fbb2 |
| WP10 sf2-host-ready | dc6bf9e4e8f3d2fa01d01c76d5575892a8ced82f |
| WP08 sf2-collab-ready | 13285296acd05f777e31fc7867da1e3055e1e4af |
| WP09 sf2-relay-ready | b58601f92f3bc8742e5a7c72a34d5ddf1fd87fe8 |
| WP11 sf2-decisions-ready | ba2822bb06a8ad741ecbcf0d47654d1a86a3a95b |
| sf2-compose | 22756b300939c50ca93403b48c6244dd7c179977 |

Os 111 critérios próprios de WP04 foram lidos integralmente. Anexos obrigatórios lidos no planejamento dbf9547211d9b0fade619790de7c19c0869b7c7d: specs/product-acceptance.md, specs/resident-runtime.md. As fontes não provam execução residente.

## Bloqueios de integração demonstráveis por leitura

### INT-01 — projeção de fontes do seed incompatível com seus próprios produtores

Path WP10: modules/sucafina/Sucafinav1/product/integration/procurement-projections.ts.

- Blob seed: 08fdfb878f6f9282f70ec71b3e66122f1b95f6f5.
- Blob WP10 corrente: fbb8aacabf59b7247037fb5eca709b520d509ea6.
- Seed não reconhece selector.kind procurement-confirmation-v1.
- Seed exige lista de campos que não contém approvalStage, mas sources.ts de WP04 já o emite.
- Fonte corrente contém ambos: projeção de confirmação delegada ao produtor de campos WP04, e compatibilidade com as duas listas de campos de registro.
- Consequência: emitir referência de pedido/confirmar matéria com o projector seed falha antes da lógica assertada nos testes existentes.

Se WP04 passar a possuir a função canônica projectProcurementScope, o delta revisável para S0 é substituir o corpo de integração por import + export const para a mesma função. Foram preparados:
- WP10-delegate-from-seed.patch: base blob seed.
- WP10-delegate-from-current.patch: base blob WP10 corrente.

Nenhum patch foi aplicado ao path alheio. Ambos dependem de integrar o novo módulo de WP04 primeiro. Essa delegação conserva a referência pública projectSfProcurementScope, sem duplicar cálculo. createSfSourcePersistence já possui projectScope e recalcula scopes em toda mutação durável; o consumidor de produção precisa usar o mesmo projector para preservar detecção A→B→A.

### INT-02 — schema fechado antigo recusa CommercialComparison atual

Paths WP00: product/contracts/outputs.ts e product/contracts/output-schemas.ts sob modules/sucafina/Sucafinav1/.

WP00 corrente 72342f0efbbe099231aa2e30a964769b14e4fbb2:
- outputs.ts blob 4db2e631bd83ccda67442824557881c2ed990c92.
- output-schemas.ts blob 0d9fc51d26a0ca726d32e74605b555f871d99af6.
- generate-output-schemas.ts blob eef174095e02eb4448a6c53d6119ce7a8fda4a9d.

CommercialComparison no seed não possui components/money nas propostas nem weights/selection na raiz. O port WP04 já emite os quatro campos. Os schemas são additionalProperties:false e decodeSfOperationOutput recusa campos extras. O current WP00 acrescenta os campos opcionais e regenera os schemas. Não cabe a WP04 relaxar o decoder, apagar a decomposição ou editar artefato gerado manualmente. S0/WP00 integra o contrato e roda o gerador canônico. A prova cirúrgica sem esse contrato não qualifica sf_sourcing_compare pela capability.

### INT-03 — consumidor residente rejeita critérios configurados

Path WP10: apps/cli/src/sucafina-product/analysis-verifier-procurement.ts, blob 55d474261b8f74b42af2e6a2b8400b1b9adc60aa em sf2-host-ready e sf2-compose observados.

createSfSourcingVerifier nega quando:
value.weightsAndEligibility.length || actual.value.weights.technicalCriteria.length || actual.value.weights.commercialCriteria.length

Assim o verificador atual não aceita a saída real de sourcing com critérios configurados (obrigatórios para comparação útil). Remover critérios do produtor para satisfazer isso violaria WP04. WP10 precisa comparar a proveniência e os critérios reais aos inputs tipados e testar o caminho autorizado. Catálogo ou resposta denied não fecha WP04.SUC.10/T03.CHK.18.

### INT-04 — montagem de C06/C12/dossiê continua incompleta no host inspecionado

Em apps/cli/src/sucafina-product/business-services.ts:
- blob corrente WP10 c4f4811234948daa04394e2dc82b58fd86622b16.
- blob sf2-compose 54cb9612b58e6c3bd1e665d0a0093011ea1aa2d5.

O host monta collection/individual/contract/port/capabilities/sourcingEvidence. A resolução de procurement encaminha collection -> individual. O arquivo não instancia createProcurementConfirmationObserver, createProcurementC12Bridge ou createProcurementDecisionPreparation, nem roteia sf-procurement-c06:.

Consumidores existentes para ligar:
- WP08 product/collaboration/host.ts: confirmationSource tem observe/fence/verifyManifest/fenceManifest.
- WP09 product/routines/dossier.ts: prepareProcurement recebe {request:DomainProjection,comparison:CommercialComparison|null,limitations}; revalidateProcurement é exigido no retorno.
- WP11 product/decisions/prepared-change.ts: prepareDomainChange aceita PreparedCommand/ScenarioResult legítimos. createProcurementC12Bridge exporta prepareScenario/reviewDomain/resolveMutation/receiptVersion; humano/CAS/receipt atômico continuam no proprietário.

Não converter referências C06 em full-record refs para contornar o roteamento. O consumer precisa preservar o escopo material e encarnação.

## Fronteira nativa examinada

dispatchSfCapability atual seleciona descritor único, valida entrada, clona payload, consome concessão por validateDomainContext, confere grants, revalida antes/depois e compara recibo canônico. sf-mcp-bridge usa pares InMemoryTransport privados, recusa homônimo de provider, confirma lease e digest, chama o dispatcher e fecha o transporte. execution-context valida binding/skillReceipts/grants e finaliza leases.

Isso é implementação lida, não prova SessionV2. Um teste com admissions/receipts sintéticos pode demonstrar paridade dos adapters e isolamento de casos sintéticos, mas não substitui carga real de skill, execução de modelo, autoridade instalada e consumo persistido após reload exigidos por C15/C16.

## CI cirúrgico

Request canônico:
{ package: "sucafina", directory: "modules/sucafina", runner: "bun", args: [nomes explícitos relativos ao package], env: {} }

A seleção inicial tem dez testes WP04. Acrescentar testes de código alterado, runtime, parity-procurement, porta e consumidores reais pertinentes. Não trocar testes de sucesso em expectativas de falha para esconder dependências.

- Resolver de package: locateTestPackage -> script/module-registry.json e script/test-ci-package.ts.
- Nomes explícitos resultam omniControlScope declared.
- W=commit de produto; S=filho W com diferença somente .ci-run.json.
- Branch diretamente em S, prefixo ci-run-linux-astra-wp04.
- Comparar head_sha, conclusão e logs; observar omni positive control pass/not applicable.
- O workflow Bun seed salva test-ci-evidence/request.json no runner mas só o passo Playwright publica esse diretório. Não alegar artifact Bun inexistente.
- check workflow autorizado apenas branch astra-check-wp04, contents:read, SHA W explícito, setup-bun existente, bun typecheck no package, bun run check:guards --base origin/dev com dev realmente fetchado.
- Pins observados: checkout 34e114876b0b11c390a56381ad16ebd13914f8d5; setup-node 49933ea5288caeca8642d1e84afbd3f7d6820020; upload-artifact ea165f8d65b6e75b540449e92b4886f43607fa02.

## Estado desta revisão

Análise de contratos concluída. Cold review estático dos deltas contra os conteúdos seed-download.json/dependencies-download.json/remaining-download.json realizado em 2026-11-13, ainda sem execução de teste ou run de CI observado por este revisor. Não há declaração READY/GNATIVE/global. Os patches de S0 são propostas revisáveis, sem autorização transferida para paths alheios.

## Cold review dos produtores próprios

- O projector canônico local agora reconhece registro, seleção e C06, exige period normalizado e ISO currency no registro/C06, e conserva o mesmo papel/scope/digest usado no lifecycle real. As fixtures injetam a função pelo seam existente projectScope; não substituem o driver durável.
- Resolução individual autentica o Request com roleMap corrente e refaz autorização/material antes do retorno. A identidade persiste por scope e encarnação física. Não foi identificado bypass demonstrável de ator ou ABA no diff próprio revisado.
- issueForActor não transfere authority do ator anterior; emite scope sob o ator atual e exige a mesma encarnação física. prepareReissueScope conserva versões exatas do original e atual e só oferece fence dentro da transação compartilhada.
- collection-member refaz a leitura da seleção original depois de emitir a referência individual; isso impede converter um membro já substituído para trabalho durável.
- prepared.ts agora clona os resultados públicos, mantendo o command/target/evidence privados da execução sem alias. scenario-preparation e prepared-review também capturam os inputs antes dos awaits.
- Form guidance mapeia os erros de score ausente por critério e preserva os validadores atuais. Normalização domain.load converte supplier IDs para string, portanto o lookup estrito de payment terms usa a identidade canônica do produtor.
- Novo teste UI chama o dispatcher compartilhado e prova recibo UI real para a fixture. Isso não constitui recibo nativo SessionV2.

### CR-01 — paridade de FX em dados importados (corrigido e revisado; CI pendente)

Leitura do snapshot intermediário encontrou `requestValue` aceitando `po.fxRate: "1.08"` e entradas de sourcing.fxSnapshot por coerção `> 0` e multiplicação, enquanto procurementMonetaryFacts exige typeof number. Para PO EUR 100 submetido em USD, o primeiro pode exibir 108 e o segundo retornar baseAmount null. Finance confirmou a divergência e encaminhou patch. Não executado localmente. Recomendação: checks estritos de número finito nas duas fronteiras e contraprova de dado malformado. Esta observação é requisito de consistência, não evidência de exposição de autoridade. A hipótese secundária de live settings foi descartada: finite() em runtime/contract.ts já exige typeof number e rejeita a string.

Root aplicou o fix: tipo number + Number.isFinite + >0 no ramo PO explícito e nos dois ramos de toBase. Revisão do conteúdo confirma que string, NaN e infinito não entram por coerção; testes ui-guidance acrescentam frozen PO string, sourcing snapshot string e live rate string. Revisado estaticamente; precisa estar no W final e na rodada final hospedada. Não há outros findings bloqueantes próprios demonstrados no diff revisto. INT-01 a INT-04 continuam dependências de integração separadas.

