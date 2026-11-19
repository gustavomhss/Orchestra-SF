# Handoff — sfa-factory-package

SHA: 4372b98d8e4db09a56f8ad589fb298c8779c84bf
Data: 2026-11-19
Estado: complete

Escopo deste estado: qualificação do pacote WP6 no SHA indicado. Os E2E e o go-live permanecem parciais no handoff consolidado.
Documento posterior mantido na branch lastmile-final-20261119 para não mover o SHA congelado de sfa-factory-package nem acionar outra campanha.
Template: docs/handoff/HANDOFF-TEMPLATE.md de sf-handoff-brief, blob 725697cdae3a42133df81a42637ff70214a78cb3.

## Feito

- sfa-factory-package foi apontada por update_ref com expected_sha para 4372b98d8e4db09a56f8ad589fb298c8779c84bf, mesmo SHA de sf-join-four.
- Head anterior 591424661cf43baedf798b470a112d32b9b0c514 foi preservado em lastmile-package-backup; sua história não foi descartada.
- Run principal de push [44551853461](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44551853461), attempt 1, job 135657398119: success.
- Compilação, empacotamento, extração fora do checkout, qualificação de lifecycle, auditoria independente e upload concluíram com success.
- Marcadores SF_FACTORY_PACKAGE_QUALIFIED e SF_FACTORY_RECEIPT_VERIFIED lidos dos logs reais; identidade de source/checkout/expected/workflow SHA e digests concordantes.
- Artefato [14543542729](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44551853461/artifacts/14543542729): sf-factory-package-44551853461-1-4372b98d8e4db09a56f8ad589fb298c8779c84bf. Contém o TAR e os receipts gerados em distribution-logs/44551853461-1/.

## Pendente

- Nenhum unbound da execução WP6 observada. A qualificação do pacote não equivale a sucesso dos E2E.
- packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:105 continua com TS2367 no SHA congelado. Patch de uma linha preparado na PR356, código8375685071b5b2603fa0391e4c4b5ec862330d5c, não integrado e NOT-VERIFIED.
- Demais unbound dos WPs1–5 e do SHA exato de sf-ci constam em docs/handoff/HANDOFF-lastmile-final-20261119.md, nesta branch documental.

## Decisões e justificativas

- Asserções removidas: nenhuma neste WP; nenhum código, teste ou workflow alterado para empacotar.
- Digest de pacote é archiveSha256 do TAR real; digest do ZIP da API de artifacts identifica outro objeto.
- O push também sincronizou a PR preexistente257 e iniciou um run secundário de pacote e um único sf-ci automático. Não foram feitos dispatch manual, rerun ou cancelamento.
- O run de push é a evidência principal porque sourceSHA, checkoutSHA, expectedSourceSHA e workflowSHA são todos 4372b98d8e4db09a56f8ad589fb298c8779c84bf. O run de PR tem workflowSHA sintético aece7640562fe9830c54ee4e73836e830cc48e0c e outro TAR.
- Nenhum digest foi inferido, calculado localmente ou reaproveitado do pacote antigo. Nenhum GO declarado.

## Como retomar

1. Baixar o artifact14543542729 do run44551853461; usar o TAR e o receipt desse mesmo run.
2. Conferir source/checkout/expected/workflow SHA e run/attempt antes de usar o pacote. O archiveSha256 esperado do TAR é ec193665f86d85e8cf0a49383b620874591f40791589cddcdaf6dcbe188339ec.
3. Se o candidato mudar, produzir e qualificar novo pacote na próxima campanha; não atribuir este receipt ao novo SHA.
4. Antes de um novo push em sfa-factory-package, considerar que a PR257 aberta dispara sf-ci automaticamente sobre merge sintético. O limite de um sf-ci e a exigência de SHA exato precisam ser tratados explicitamente na retomada.
5. Manter PR237 draft e as quatro branches proibidas sem push.

## Comandos e resultados

- Push sfa-factory-package: success; SHA 4372b98d8e4db09a56f8ad589fb298c8779c84bf.
- sf-factory-package / run44551853461 / job135657398119 / attempt1: success, incluindo auditoria independente e upload.
- Resultado de SF_FACTORY_RECEIPT_VERIFIED:
```json
{
  "sourceSHA": "4372b98d8e4db09a56f8ad589fb298c8779c84bf",
  "checkoutSHA": "4372b98d8e4db09a56f8ad589fb298c8779c84bf",
  "workflowSHA": "4372b98d8e4db09a56f8ad589fb298c8779c84bf",
  "runID": "44551853461",
  "runAttempt": "1",
  "archiveSha256": "ec193665f86d85e8cf0a49383b620874591f40791589cddcdaf6dcbe188339ec",
  "manifestSha256": "ce2e4461b6fee4f8fadc61cda109664616d178667959206af72c8ea5bdb00011",
  "fileCount": 1413,
  "webFileCount": 1310,
  "webSourceMaps": 0
}
```
- TAR: orchestra-sf-factory-linux-x64-baseline.tar.gz.
- archiveSha256: ec193665f86d85e8cf0a49383b620874591f40791589cddcdaf6dcbe188339ec.
- manifestSha256: ce2e4461b6fee4f8fadc61cda109664616d178667959206af72c8ea5bdb00011.
- bundleSha256: b5bcf386c5f4d27bab70b2f2ab4cfb660a1cf0c32b9bcb0e80e04f2171d55a5a.
- Artifact ZIP ID14543542729: 91517380 bytes; digest sha256:1972878fd7337f248f7880392129c82ee036ac0c5f87f7888d0c8dbf574e992b. Esse digest não substitui o archiveSha256.
- Run secundário PR [44551871303](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44551871303), job135657461315: success. Artifact14543537787; TAR sha256:2118ba58c6dbefd4381322878676a4c7f31908eb19262a398a9c11c4d8f140c8. Não intercambiar o TAR/receipt desse run com os do push.
- Sem shell, sem execução local, sem promoção de release.
