# OPS-NATIVE-UI-ACQUISITION

**Owner:** astra-interface para o driver/pool de browser; astra-compose para reconciliar o consumidor integrado. **Status:** bloqueio de aquisição reproduzido em Actions; H09 não qualificado. Este finding não solicita mudanças de timeout, remoção de assertions ou reexecução automática.

## Candidato e seleção

- PR do grupo: https://github.com/gustavomhss/Orchestra-SF/pull/34
- Produto W5: `c4a2f4ebeb88f5915e51569b921be06b3c37ddad`, tree `5cc00703f04845c62448a2a3239683d266d8d548`.
- Snapshot S: `9e1d872f453c218909d328b480ffaf8bed6f0c82`, tree `19c1fb2cc3c949ddb564fba885977a0799c95c2e`.
- S tem W5 como único pai. A comparação completa contém apenas `.ci-run.json` acrescentado; produto, testes, fixtures e configuração são idênticos.
- Request SHA256: `ca850c98b31f54c91dd4d93ff4a627af9918150885489b1eae3f1cdd5179842d`; Git blob `26184451c4ce2fe834a96f0127cf831f3bfb9fcd`.
- Run https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584405211 ; job de testes `132415709827`; cleanup de branch `132416458692`.
- Ordem declarada e efetivamente executada: `./Sucafinav1/test/product/wp01/browser-startup.test.ts` → `./Sucafinav1/test/product/wp04/host-integration.test.ts` → `./Sucafinav1/test/product/wp01/browser-lifecycle.test.ts`.
- Runner `bun`, package `sucafina`, directory `modules/sucafina`, env `ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER=1`; sem filtro, paralelismo, override de timeout ou seleção adicional.

## Resultado observado

O run terminou **FAILURE: 8 pass / 3 fail / 0 skip, 11 casos em 3 arquivos, 190 assertions, 74,70 s**. Todos os arquivos selecionados executaram; não houve bail ou seleção vazia.

Os oito casos próprios H01–H08 passaram. Isso inclui a comparação/revalidação do segundo caminho do dossiê e os casos H02/H03/H05 de aplicação, continuidade e conflito CAS que falharam em W4. Seus passes pertencem ao W5 e podem ser usados no escopo individual correspondente; o agregado continua falho.

As três falhas foram:

1. Startup owner: timeout durante a aquisição de Chromium.
2. H09: `launchWp01Browser` recusou o pool já falho, em 6,34 ms. Nenhuma fixture de host foi criada, nenhuma revisão ou aplicação HTTP foi feita e nenhum corpo de assertion da jornada de UI foi qualificado. O log `SF_PROCUREMENT_UI_PROOF` não existe.
3. Finalizer owner: não havia browser/lease adquirido para comprovar o lifecycle solicitado.

## Diagnóstico exato de aquisição

O driver usado é o blob publicado `76188b9f567861b30dba3b22afce66d60a2424c8`, de Interface `50906b86da953f9e6fb24f989c51db0fc69496c1`. Ele preserva as assertions e os deadlines anteriores, acrescentando somente diagnóstico `DEBUG=pw:browser` no processo Node.

| Fase | Tempo observado |
| --- | --- |
| Playwright importado | 329 ms |
| AppProcess spawn concluído; driver PID 4170 | 347 ms |
| Node importado | 585 ms |
| `chromium-launch` | 597 ms |
| `startup-cancelled`, aguardando `chromium-launch` | 10.000 ms |
| Falha reportada | 10.004 ms |

Mensagem: `Browser driver launch exceeded 9667 ms`. O stderr limitado permaneceu vazio nas duas linhas de falha, apesar do diagnóstico publicado. Não apareceu `chromium-launched`, `node-ready`, `browser-connected` ou prova final do driver.

O lifecycle reportou `launches=0`, `acquisitions=0`, `releases=0`, `pid=undefined`, `activeLease=false`, `contexts=0`, `disconnected=false`, `driverClosed=false`, `processExited=false`.

**Não houve observação de browser PID nem comprovação de saída física. Isso não demonstra ausência de processo Chromium.** O job de cleanup de branch terminou SUCCESS, mas essa conclusão é separada da prova física do browser.

## Omni e limites

O controle Omni foi **PASS**, nonce `e73271f7e6e425831126deb297111537`: um teste declarou spawn (`browser-startup`), um spawn Omni real, zero delegados. Isso comprova a criação do processo Node via AppProcess/Omni; não comprova aquisição ou encerramento do Chromium, execução de modelo ou gate nativo global.

## Evidência anterior do owner preservada

O run Interface https://github.com/gustavomhss/Orchestra-SF/actions/runs/43581816415 já apresentou o mesmo ponto de falha. Produto `a29565f763ddd90bc5bc3b8d298afb47ad84008d`, snapshot `4d58627f1bb996e422bbba2796050b4acaeb6144`, tree `a2db0fab2738bc8b029a77781d74b880d62d1a78`; S acrescentava somente `.ci-run.json`. A seleção de 25 arquivos terminou 13 pass / 23 fail / 36 observações, com aquisição expirada em `chromium-launch`, driver PID 4072, mensagem `Browser driver launch exceeded 9651 ms` e stderr vazio. `decision-mutations` falhou no beforeAll e seus corpos Apply não executaram.

O W5 não apagou esse resultado nem repetiu uma seleção equivalente: adicionou a composição própria de Procurement e consumiu o incremento diagnóstico publicado do driver. O resultado atual continua sem provar H09. Nenhuma causa raiz específica é inferida apenas do timeout.

## Próxima prova necessária

Interface/Compose devem reconciliar a aquisição e a observabilidade do driver sem enfraquecer os critérios. Depois de um delta material publicado e revisado, a seleção exata acima precisa provar startup, H09 com reviewDigest/receipt reais e finalizer físico; os oito casos de host já aprovados permanecem identificados no recibo. Se a solução permitir uma seleção menor válida pelo lifecycle owner, ela deve conservar as dependências reais e os guardas do protocolo, sem inventar sucesso por ausência de corpo executado.

Origens de auditoria locais: `audit-ci/operations-host-browser-43584405211.json`, `.log`, `audit-ci/owner-refresh/interface-43581816415.log` e o metadata deste finding. O recibo estruturado está publicado; os logs brutos são consultados no [run W5 43584405211](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584405211) e no [run owner 43581816415](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43581816415). O artifact-index registra seus hashes e referências. O trecho diagnóstico não é republicado como arquivo de trabalho. Não houve alteração de produto ou despacho de run por esta revisão.
