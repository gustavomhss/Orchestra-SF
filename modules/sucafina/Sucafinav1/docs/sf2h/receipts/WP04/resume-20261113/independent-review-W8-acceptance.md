> **Validação final pelo integrador:** produto `dae18b4f43f0daecf46264e876810025684a919d`; Bun 257 pass, Playwright 10 pass, zero falhas/skips/retries, geração oficial e typecheck aprovados. Recibos e escopo em [ci-evidence.json](ci-evidence.json). O texto histórico abaixo conserva a atribuição e o estado da revisão em sua data; estes resultados hospedados não são atribuídos a execução pelo revisor. Permanecem 10 limites nativos e 4 observações humanas.

# WP04 — revisão independente da candidata de aceitação W8

Data: 2026-11-14. Revisor: `/root/wp04_final_review`; segunda leitura semântica de T02/T04/T05 por `/root/wp04_final_review/acceptance_coverage`.

## Resultado e alcance

**Nenhuma discrepância concreta de cobertura ou promoção indevida foi encontrada na candidata examinada.** Os 111 critérios preservam exatamente os IDs e os textos do pack canônico. A candidata mantém todos os critérios com `qualified: false`: 97 `CONDITIONAL`, 10 `BLOCKED_NATIVE` e quatro `NOT_RUN_HUMAN`.

O produto examinado é W8 `dae18b4f43f0daecf46264e876810025684a919d`, tree `ceb9615bb5bbd5f829d2e9569a2797e3124236a5`. Todos os 129 paths do inventário publicado têm bytes locais cujo Git blob coincide com o inventário. Os hashes dos arquivos referidos pelos três catálogos também coincidem com os arquivos atuais.

Esta é uma revisão estática da cobertura, dos bytes e das fronteiras de prova. Não executou produto, testes, navegador, typecheck ou gerador de recibos; não alterou produto ou testes; não utilizou git/gh nem realizou ações remotas. A comparação dos blobs usa o inventário GitHub compare materializado pelo integrador, sem nova consulta remota do revisor. Os arquivos de parecer foram escritos somente fora do repositório.

**Este parecer não substitui a auditoria do recibo gerado.** A reconciliação final de artefatos, log de upload, snapshots, árvores e documento de entrega continua separada. O integrador ainda deve fornecer o caminho de conclusão do gerador para essa última auditoria.

## Identidades e materiais examinados

| Material | SHA256 |
| --- | --- |
| `handoff/WP04.pack.json` | `ce48b184c65e19ead4fe62e82e0ab55a7385457d03fc4315723f18fa95bbb59e` |
| `review/final-acceptance-candidate.json` | `0bdd398b687f4749e76f6c29cbabad182e1be86ccd7ddd686c4be115858641c4` |
| `review/w8-modified-paths.json` | `22132ebcfab822c52f1937fb058123e4ce5660f964e9d453692b08908259020e` |
| `review/WP04-final-proof-boundaries.md` | `a28dba78ee10a21eb9b25523a14dafa8d0718e69c6f43bf47cb63b46e0f4037c` |
| `review/w8-bun-results.json` | `d924cfcf3751a9e27980d4949edd2c1010e905b54aebc0535d5f038ca2a1b1f6` |
| `review/w8-check-result.json` | `53f6c7ad9d1dbab52bd3e17dc34829eca6a219bb1f6ab830a32ee9010efc3066` |
| `review/w8-browser-observations.json` | `d1edc4136bd29cba48e4215fc00c9034fcbb2a0f5bde3016607d04724fe23b50` |

O inventário W8 declara base `6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0`, 11 commits e 129 arquivos, abaixo do limite declarado de 300 arquivos do compare utilizado. Para cada path foi calculado o objeto `blob <byte length>\0<bytes>`; nenhum dos 129 SHA1 calculados diverge do inventário. Essa igualdade verifica os paths inventariados; a igualdade integral das árvores de produto e snapshots é um gate adicional do gerador e do integrador.

O manifesto companheiro `WP04-w8-acceptance-review-hashes.json` registra os SHA256 atuais dos paths dos catálogos e do inventário. Verificação de hash não significa revisão semântica integral de cada arquivo. As leituras semânticas dirigidas estão descritas abaixo.

## Integridade da matriz e dos vínculos

| Escopo | Total | CONDITIONAL | BLOCKED_NATIVE | NOT_RUN_HUMAN |
| --- | ---: | ---: | ---: | ---: |
| WP04 | 20 | 18 | 1 | 1 |
| T01 | 20 | 17 | 3 | 0 |
| T02 | 14 | 14 | 0 | 0 |
| T03 | 21 | 17 | 3 | 1 |
| T04 | 15 | 13 | 0 | 2 |
| T05 | 21 | 18 | 3 | 0 |
| **Total** | **111** | **97** | **10** | **4** |

Os 111 IDs são únicos e a relação ID→texto é idêntica à combinação dos axiomas gerais e dos checks/axiomas das cinco tarefas em `canonical_work_package`. Não há critério qualificado, referência inexistente de implementação/consumidor/teste ou critério `CONDITIONAL` sem testes mapeados.

Os catálogos contêm 126 implementações, 69 consumidores e 127 testes. Todos os paths existem; todos os `source_sha256` correspondem aos bytes atuais. Os hashes das oito entradas de origem da candidata também coincidem. Isso evita qualificar uma avaliação antiga por simples reaproveitamento de nomes.

A candidata conserva `status: PENDING_CI_AND_RECEIPT_RECONCILIATION`, `candidate_product_sha: null`, `snapshot_sha: null`, `ci_result: PENDING` e recibos vazios. Essa situação é coerente com seu papel de entrada do gerador. O novo resultado hospedado não altera esses campos por si só.

## Cobertura semântica dirigida

| Recorte | Conferência e consequência |
| --- | --- |
| WP04 e T01: filas, autoridade, estado e idade | As razões distinguem a versão da fonte C02 da revisão CAS do comando. Os testes de `queue-lifecycle`, `queue-view`, `capabilities`, `projection` e host sustentam seleção autorizada, estoque/aging, idade sem fallback inventado, holder desconhecido, revogação e releitura do destino. A montagem de Requests/My approvals usa o seam real C02. O teste do adapter de BI usa o consumidor de produção, sem afirmar que executou a página completa de BI. |
| T02: pedido guiado e preservação | A segunda leitura conferiu `procurement-runtime`, `ui-guidance`, `host-integration` e o browser. Há casos de roundtrip dos campos, snapshots preservados e recusa atômica de cancel/delete após `po_issued`. Os testes de renderer→save tratam metadados omitidos, saves consecutivos, reorder, remove, `_new`, referências ambíguas e precedência de CAS/autorização. |
| T03: valores e comparação | `money`, `finance-material`, `comparison-review`, `projection` e `finance-sourcing-integration` confrontam o motor existente: A/B/C, notas humanas, peso/preço, ranking suspenso quando incompleto, FX submetido, ausência de moeda/rate, zero explícito, ambiguidades e discrepância de total. O PO EUR 28.000 mantém USD 30.240 sob FX 1,08 apesar de rate posterior 2; totais approved e issued ficam separados e o não conversível permanece indisponível. A projeção conserva original, base, FX e estado. |
| T04: aprovação e dossier | A segunda leitura conferiu comandos, resumo, recusas, CAS e o consumidor `procurementDossier.prepare`. O caso H01 preserva o snapshot integral e produz resultado determinístico repetido. Isso sustenta a fronteira de leitura do dossier; não inventa observação humana nem execução de uma ocorrência Relay. |
| T05: fornecedores e contratos | A segunda leitura conferiu buyer/supplier-admin/viewer, ciclo pending→active→blocked→inactive, revalidação bancária, busca/filtro, campos de contrato, máscara e bytes reais dos exports. Casos de producer/download são reconhecidos como tais, sem serem rebatizados de jornada HTTP autenticada de download. |
| Interfaces residentes e preparadas | A candidata distingue dispatcher real, contratos de output, concessão de uso, negativos direct/unavailable/stale/revoked e efeitos duráveis da prova nativa ausente. O C12 revisado continua sendo save dos campos permitidos de PR. Escolha de teste persistida não é apresentada como saída de modelo ou decisão humana real. |

Foram lidas as razões e referências dos 111 critérios. A leitura de código foi dirigida aos argumentos acima, inclusive aos contraexemplos que haviam originado correções, e não é uma nova revisão integral de toda a base.

A condição global `W7_EXPORT_MONEY_FINAL_BYTES` continua explícita para `WP04.INV.03` e `WP04.T03.INV.02`. Os quatro testes referidos constam entre os testes Bun aprovados W8 e os paths financeiros correspondem aos bytes publicados. A promoção final deve vincular esses bytes e esse run atual; o resultado W6 não serve como prova da correção posterior.

## Execução hospedada observada nesta revisão

### Bun e checks

O resultado Bun materializado refere o run `43534137756`, produto W8 e snapshot `846cc5aa5c4e1413e741d4de06bd0f53238f34ed`: **257 pass, zero fail/skip/todo, 53 arquivos, 2.763 expect calls**, duração declarada de 221,91 s. O SHA256 do log lido coincide com `log_sha256` no resultado. Todos os **119 pares exatos path/nome** de testes Bun mapeados pela candidata constam como `pass` nesse resultado.

O resultado de checks `43534115446` declara `success`, geração e typecheck aprovados, **zero gate/error e 11 warnings**. O schema oficial está registrado com SHA256 `33fd0a159ef9258e02c4777a3fb4d88b27a86930122e1e563d88ec3d1362d806`. Não se converteu warning em ausência de warning. A qualificação do ZIP/log/checkout dos checks continua a cargo da cadeia final de recibos.

O controle omni no log Bun diz explicitamente que essa seleção não executou nem delegou um spawn omni; não há prova omni neste resultado.

### Browser recebido durante o fechamento

O integrador comunicou conclusão `success` do run `43534795463`, job `132261059694`, snapshot `23f527266a8bf0da2c015624d40db417e2d9bb80`. O revisor calculou localmente o SHA256 do ZIP `review/wp04-w8-browser.zip`: **`379a94caec10edce2da7afb7f5d0e376eaefbb05f92db93c7cf535962b0c6d84`**, 1.850.222 bytes.

Os três arquivos extraídos abaixo são byte a byte idênticos aos membros de mesmo nome no ZIP:

| Membro | SHA256 |
| --- | --- |
| `test-ci-evidence/playwright-runtime.json` | `fddd3f2b58bbb7f61d0517427a9fc3c922cab8888a33b673574bed31217a7500` |
| `test-ci-evidence/playwright-selection.json` | `838c2b85aa81baf9d7694805d42b5800f866716ae9b10e31b029cb0e9a7f5703` |
| `test-ci-evidence/request.json` | `8e8104b51f16f0f0732a0fe9c9657a6ed659bab2c6b7486f677ad0fe56e7c5b7` |

O runtime report contém **10 testes com um único resultado `passed` e `retry: 0`**, sem erro global, unexpected, flaky ou skipped. Os nomes/paths listados e executados são iguais. Os oito testes Playwright mapeados estão presentes com seus nomes exatos em `procurement.spec.ts`; os dois restantes são os testes isolados de `sourcing-controller.spec.ts`. O request arquivado declara o snapshot acima.

O arquivo de seleção é saída de listagem; seus dez itens marcados skipped não são dez skips de execução. O runtime report é a fonte da conclusão de execução. Os dois controllers não são usados como substitutos dos oito cenários de host. Esta revisão não acrescenta inspeção visual própria das screenshots; o registro visual do root/UI permanece separado.

## Bloqueios preservados e proibições de extrapolação

Permanecem `BLOCKED_NATIVE`: `WP04.DOD.10`; `WP04.T01.CHK.18`, `DOD.18`, `SUC.18`; `WP04.T03.CHK.18`, `DOD.18`, `SUC.18`; `WP04.T05.CHK.18`, `DOD.18`, `SUC.18`, com cada sufixo sob o prefixo da tarefa respectiva. São dez IDs. A próxima prova exige a composição nativa autorizada, identidade e perfil atuais, `SkillLoadReceipt` real, export/handler e comparação UI/native/MCP com autoridade/material/versão correlacionados.

Permanecem `NOT_RUN_HUMAN`: `WP04.SUC.01`, `WP04.T03.SUC.01`, `WP04.T04.CHK.01` e `WP04.T04.SUC.01`. Screenshots, velocidade da automação, fixtures de aprovação e assertions não medem compreensão de uma pessoa em 30 segundos. O material browser declara `humanTimingMeasured: false` e `native_qualification: false`.

São preservados os limites de `WP04-final-proof-boundaries.md`: nenhuma qualificação GNATIVE, aceitação integral, READY_FOR_REVIEW integral ou GLOBAL_RELEASE; as campanhas C/G7, D/G8, AM01–AM06 e seleções finais do integrador continuam separadas. A aplicação usa o motor financeiro e a política do domínio existentes; a revisão não identifica um novo cálculo/alçada autorizado pela apresentação ou pela correção de ausência monetária.

## Disposição dos achados

- **Achados novos de cobertura/overclaim nesta candidata:** nenhum concreto no recorte descrito.
- **FR-01, FR-02 e FR-03:** conservam o fechamento estático já documentado nos pareceres W6; não são reabertos por esta reconciliação. O browser W8 agora fornece resultados aprovados para os dois controllers associados ao guard de FR-02, sem transformá-los em prova nativa.
- **RFGEN-01:** o fechamento estático do gerador permanece no parecer `WP04-delivery-builder-review.md`, relativo ao hash ali registrado. Esta revisão não executou o gerador nem substitui a conferência do resultado que ele produzir.
- **Pendência de entrega:** receber o caminho final, conferir que a promoção qualifica apenas os 97 critérios automáticos com os recibos corretos e que mantém os dez nativos e quatro humanos bloqueados, além da cadeia de igualdade e dos limites de publicação. Não há autorização neste parecer para publicar relatório bruto, cookies, URLs assinadas ou attachments integrais como documentação.
