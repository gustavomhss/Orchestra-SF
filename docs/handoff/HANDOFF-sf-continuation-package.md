# Handoff — sf-continuation-package

SHA: 08003dd0e777315ce6a848f31144e63f37c0e76a (código e regressões; este documento é versionado depois)
Base: f7dd58e32bc834f1485df20b91adbf759b4c4ad0
Estado: partial — correções e regressões publicadas; Actions e qualificação da fábrica ainda pendentes.

## Feito

- Factory usa a origem de loopback explícita `http://localhost:4120` na configuração privada, no argumento do executável extraído, em todas as requisições e cabeçalhos Origin e no recibo. O checker independente exige a mesma origem. A configuração não depende mais do default 4110.
- Preservados os asserts originais de status, sessão/identidade, console autenticado 404, comando real, caso persistido, anti-forgery, bytes do Web, extração fora do checkout, arquivo comprimido e controles de adulteração. Nenhum timeout, hash ou baseline do produto foi alterado.
- O step UI de sf-ci emite `minimized=true` somente depois de o comando de testes retornar zero e `gate.mjs sanitize-playwright` concluir. O receipt original continua sendo exigido e continua falhando quando o baseline está pendente.
- Em falha desse mesmo step, e somente com a marca de minimização presente, o workflow retém apenas `sf-ci-evidence/<suite>/report.json` no artifact `sf-baseline-candidate-<suite>-<sha>-<attempt>`. O prefixo é distinto de `sf-evidence-*`, que o verificador consome como receipts qualificados.
- O upload normal de report + receipt em success permanece intacto. O novo artifact não contém o report bruto anterior à minimização, não publica receipt de sucesso e não muda a conclusão do job.
- `script/sf-ci/gate.test.mjs` agora extrai do workflow real a sequência desde a verificação do status original e a executa com bash, git e o CLI real de `gate.mjs`, em diretórios temporários. As quatro fixtures cobrem falha do teste original, JSON inválido, baseline pendente e baseline válido exclusivamente de teste. Conferem saída não zero, presença/ausência do output, remoção do conteúdo privado, conservação do inventário e presença/ausência do receipt conforme o caso.
- O teste também exige que o upload do candidato dependa da falha do mesmo step e da minimização, tenha prefixo distinto e publique um único `report.json`, sem logs brutos ou receipt. Não há mocks do sanitizador/receipt, execução de Chromium, serviço de upload ou dependência nova.
- As fixtures reutilizam o manifesto sintético já existente no teste. Os commits Git temporários produzem suas próprias identidades; nenhum receipt ou baseline de fixture é evidência do produto. O manifesto real `sf/ci/suites.json` não foi alterado.
- Lido AGENTS.md da raiz; os ancestrais específicos dos paths editados, inclusive `script/` e `script/sf-ci/`, não possuem AGENTS.md.
- Commits deste WP com `[skip ci]`; somente GitHub APIs, sem shell, testes locais, PR, merge ou dispatch por este WP.

## Arquivos e commits

- `apps/cli/test/factory-distribution-linux.test.ts` — origem/configuração explícita 4120 e uso consistente no teste real.
- `apps/cli/script/factory-receipt-check.ts` — exige origem 4120 no receipt.
- `.github/workflows/sf-ci.yml` — retém candidato UI já minimizado sem converter falha em sucesso.
- `script/sf-ci/gate.test.mjs` — contrato de retenção e quatro cenários reais de pós-processamento com fixtures isoladas.
- Este handoff.

Código inicial: `11a23d3cfe3c0edfaf1e92a05d21da43f0656d76`.
Regressões: `08003dd0e777315ce6a848f31144e63f37c0e76a`.
O segundo commit altera apenas `gate.test.mjs` (+133/-1; a linha substituída amplia o import de fs). Readback pela API confirmou identidade integral com o conteúdo preparado; blob `bbe2513a3ff8c9c099dbebfc98215c54030ccb87`.

## Verificação e limites

- Nenhuma execução de Actions iniciada por este WP. Revisão de diff/readback não é prova de execução.
- Gate estreito existente proposto ao integrador: `{"package":"script","runner":"bun","args":["../../script/sf-ci/gate.test.mjs"]}`. Resolve o pacote Script em `packages/script` e agora inclui os novos cenários, além dos contratos anteriores de seleção, minimização e recusa de baseline/receipts inválidos.
- O snapshot que dispara Actions deve ter mensagem sem `[skip ci]`; esse marcador foi usado nos commits de preparação para não disparar CI incidental.
- O gate estreito não prova o processo compilado, um parser completo de YAML nem o serviço real de upload do artifact GitHub. A prova completa da porta/origem permanece no workflow `sf-factory-package`.
- O futuro sf-ci completo deve confirmar que Reports/Decisions com testes verdes e baseline pendente produzem candidato minimizado e continuam vermelhos. Se os testes falharem antes da minimização, o artifact de candidato não deve existir.
- O workflow factory vigente não possui dispatch. Um ci-run comum não fornece a identidade `SF_FACTORY_*` exigida e a whitelist do runner não permite injetá-la. Não contornar esse contrato.
- O integrador avalia acrescentar somente PRs de `sf-continuation-package` para `sf-join-four` ao gate factory, preservando os triggers atuais. Este WP não alterou `.github/workflows/sf-factory-package.yml` e não moveu `sfa-factory-package` antes do freeze.
- Sem alteração em seleção de testes, gates, application.ts ou codec de reviews. Sem GO, deploy ou `SF_ORCHESTRA_WEB_PACKAGE_VERIFIED`.

## Guards antes do sf-ci — opção existente

O wrapper `modules/sucafina/Sucafinav1/test/product/ui-split/ui-work/guards.test.ts` busca origin/dev e executa o comando canônico, imprimindo seu diagnóstico. Para obter histórico completo pelo runner existente, usar o pacote Script, cujo workflow faz unshallow, e manter o controle Omni pelo preload explícito:

```json
{"package":"script","runner":"bun","args":["--timeout","120000","--preload","../../script/test-omni-control.ts","../../modules/sucafina/Sucafinav1/test/product/ui-split/ui-work/guards.test.ts"],"env":{"ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER":"1"}}
```

O resultado esperado por esta sessão é zero errors e dois GATE protected-paths herdados, a confirmar em logs reais. Os GATE produzem exit 1 e a asserção inalterada do wrapper falha em `guards.test.ts:23`; registrar esse resultado, sem `--warn`, label ou enfraquecimento. O checkout raso normal não basta: o fallback de merge-base pode comparar contra o tip de dev. Registrar SHA congelado e SHA do snapshot com request separadamente.

## Baseline e pacote

- `PENDING_REAL_COMPLETE_RUN` permanece intacto. O artifact novo é insumo para revisão independente futura, não baseline aceito.
- O SHA-256 final será o `archiveSha256` dos bytes reais de `orchestra-sf-factory-linux-x64-baseline.tar.gz`, confirmado em `SF_FACTORY_PACKAGE_QUALIFIED`, `SF_FACTORY_RECEIPT_VERIFIED` e no recibo. O digest ZIP do artifact GitHub não o substitui.
- Run id: NOT_RUN. Artifact: NOT_PRODUCED. Package sha256: NOT_PRODUCED.

## Como retomar

1. Integrador revisa o diff e executa o gate estreito com snapshot `ci-run-linux-*` somente quando houver slot; máximo dois gates simultâneos.
2. Registrar run, jobs, SHA do snapshot e resultado real neste handoff. Em falha, corrigir a causa; não repetir gate idêntico sem mudança.
3. Qualificar o pacote pelo workflow factory legítimo, respeitando a integração e os triggers definidos pelo integrador; não antecipar o push em sfa antes do freeze.
4. Integrar os deltas qualificados no candidato, preservando alterações concorrentes do workflow. Rodar os guards e executar o único sf-ci final com todos os merges já feitos.
5. Antes do push final em sfa, resolver o PR draft #257 atualmente baseado em close-final-candidate para evitar uma sf-ci incidental por synchronize; preservar draft e verificar o estado real após qualquer retarget.
6. Congelar e executar a fábrica pelo mecanismo autorizado. Confirmar que origem 4120, SHA do source/checkout, run/attempt e archiveSha256 são coerentes no receipt real.
7. Não declarar complete antes de registrar a qualificação correspondente. Não fabricar hashes, check, receipt ou aceite.


## Gate integral antes da integração

A qualificação do reparo será executada pelo workflow original `sf-factory-package` no head real deste PR para `sf-join-four`. O novo braço é restrito a `head_ref == sf-continuation-package` no próprio repositório; PRs para `close-final-candidate` e o push final em `sfa-factory-package` preservam seus gatilhos originais. Checkout, identidade do evento, testes, receipt e artefato são os mesmos. A branch do pacote final não foi movida.

Gate unitário da retenção: snapshot `e8927363e763c8defe57599abf826589143b356b`, parent `143cbb9227c2a33251ec55a95a2b6432effbbb43`, branch `ci-run-linux-sfc-evidence`; resultado ainda pendente. O novo workflow de factory não dispara `sf-ci`, pois o PR tem base `sf-join-four`.
