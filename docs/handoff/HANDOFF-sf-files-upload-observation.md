# HANDOFF — Files upload and Import observation

## SHA e estado

- Estado: **COMPLETE — recorte compartilhado qualificado em Actions; jornadas instaladas continuam separadas**.
- Branch: `sf-files-upload-observation`.
- Base congelada: `d4ded81224e05f2d3b9789b3eec40b9de8a32fa1` (`sf-join-four`, após #407).
- Código inicial: `a075b0bd6d199e63ab0ad1c3a229e1b89bebec55`.
- Código final desta entrega: `3041fcd305c9014c1558197c30863952a2abbdbe`.
- Tree do código: `746e1320a205bbfdf9103c1ce657f790c1da859a`.
- Este handoff acrescenta documentação; não qualifica UI55, Operations, baseline ou pacote.
- O integrador abriu o PR #431 e executou o gate único abaixo. Nenhum GO, deploy ou qualificação global foi emitido.

## Causa demonstrada

[Operations3, run 44662419134](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662419134), snapshot
`9ea42e72f6aebed5685cd5b2b48df993a1e8f33d`, parent
`69340e89c46825b6556d36e8d6a09dce2122c901`:

| Evidência terminal | Resultado |
| --- | --- |
| Typecheck dos E2E instalados | success |
| Qualificação ClamD real | success; marcador SF_REAL_CLAMD_INSTREAM_READY |
| OP-PROC-01 | pass; atravessou perfil, Requests, comparação J04 e drilldown C02 |
| OP-PROC-02 / OP-PROC-03 | timeout global de 60000 ms, sem stack interno no log |
| OP-IMPORT-01 | assert em operations-support/imports.ts:155:22: root esperado 1, recebido 0 |
| OP-DOC-01 | click em operations-support/documents.ts:97:109: botão Admit / scan / link permaneceu disabled |

O waitForResponse em `documents.ts:93:25` terminou depois de o clique não conseguir
enviar o comando; isso não demonstra falha de rede ou de scanner. No snapshot,
`shared/attachments/bound-assets.tsx:118–123` exige disponibilidade real de
`files.asset.upload`; `:143` recusa selecionar o arquivo quando esse requisito
não existe, e `:272` mantém o botão desabilitado. A composição não publicava
essa observação. `native-ui/live-context.ts:186` atribui a operações ausentes
`unavailable / operational-source-unavailable / operational:false`.

A mesma leitura mostrou ausência das seis observações exigidas pela UI55.
O mapeamento das rotas originais de Files já existia; presença de rota ou catálogo
não é usada como autorização nem como prova suficiente de disponibilidade.

Artefato original, somente metadados registrados:

- ID: `14596666417`; nome: `playwright-ubuntu-24.04-1`.
- Tamanho: `68608517` bytes.
- Digest informado pelo GitHub:
  `sha256:28ca71a87e76cb8fc85cb370d0da714b5d8e8503f574b396c192c7efa4cd5cd3`.
- Não houve extração desse artefato por esta implementação nem nova certificação criptográfica.

## O que mudou e por quê

### Anexos: autoridade original do domínio

`apps/cli/src/sucafina-product/native-ui/asset-health.ts` observa a Application
que a composição monta. Exige a mesma persistência de domínio e AssetPersistence,
os mesmos authenticate/environment da autoridade, o produtor original, os métodos
e a configuração estáveis. Re-admite o Request original, compara todo o stamp
e faz duas transações `commit:false` por superfície.

A observação verifica actor e roles atuais, páginas/domínios montados, interface
de blob storage, limite numérico para upload, nome do operador no diretório
original e material da chave de assinatura. Publica somente os IDs existentes:
`files.asset.link`, `files.asset.download`, `files.asset.upload`.

O predicado puro `canChangeAssetKind` foi extraído de `runtime/assets.ts` e é
reutilizado pelo produtor. As regras de registro, estágio, versão/CAS, MIME,
limite de bytes, scan efetivo e armazenamento permanecem no produtor original.
A disponibilidade é global por operação: ao menos uma superfície admissível
pode oferecer o mecanismo. Ela não autoriza um registro de outra superfície.

### Import: autoridade de produto e C08

`apps/cli/src/sucafina-product/native-ui/import-health.ts` observa os serviços
reais de Import e o importHttp pertencentes ao mesmo productHttp instalado.
O binding existente de `dashboard.dashboard-review` prova somente a identidade
desse router compartilhado; nenhum grant de Dashboard é emprestado a Import.

O observer admite `sf_import_preview` na autoridade original, verifica
Request/stamp/validate/revalidate, o descritor real `previewImport`, funções e
schemas estáveis, e a saúde C08 sob autorização real. Documentos em modo read
permitem observar targets/reference/detail; modo write é necessário para
admit/preview/apply; apply também exige receipts em modo write. As permissões
`imports.admit` e `imports.apply` vêm de `humanActions` original, lido antes
e depois. O fechamento confere novamente o contexto e a autoridade.

Os IDs são exatamente `files.import-targets`, `files.import-reference`,
`files.import-detail`, `files.import-admit`, `files.import-preview` e
`files.import-apply`. O observer não chama discover/prepareTarget/admit/
preview/detail/apply, não cria seleção, lease, arquivo, prévia, receipt ou mutação.

### Limite explícito do scanner

`AssetServices.scannerConfiguration` é metadata privada opcional da mesma
configuração usada pela função scan original. A composição local e o fixture
Operations fornecem a mesma referência de configuração. Campo ausente, nulo
ou inválido não permite observar upload/import-admit como disponíveis.

Configuração **não** prova ClamD vivo, nem arquivo limpo. `ready/operational`
neste contexto descreve o mecanismo configurado e autorizado para admitir a
tentativa; o scan de bytes continua obrigatório no produtor, com seu resultado
real. Os observers nunca chamam scan. A metadata não entra em API pública,
schema de UI, grant, digest de baseline ou recibo.

## Arquivos e composição

1. Novos `native-ui/asset-health.ts` e `native-ui/import-health.ts`.
2. `runtime/assets.ts`: predicado puro reutilizado e configuração privada opcional.
3. `local/entry.ts`: a mesma configuração de scanner e observação da Application montada.
4. `apps/cli/src/sucafina-product/host-context.ts`: observação dos serviços de Import existentes.
5. `packages/app-shell/e2e/sucafina/operations-support/installation.ts`: composição equivalente no host Actions real.
6. Dois testes em `test/native-ui-contract/{asset-health,import-health}.test.ts`.
7. Este handoff.

`runtime/application.ts`, grants, assertions de negócio, timeouts de specs,
`sf/ci/suites.json`, `freeze-v1.json`, Schema.Never e regras de bytes de reports
não foram alterados. Não houve porta 4110 nem restauração de console legado.

## Testes e revisão

Há oito casos de teste novos, usando a fixture financeira original, SQLite,
createSfProductAuthority, Application, createSfImportServices e createSfImportHttp
reais. As políticas restritas são configuradas na autoridade real; não há retorno
de admission/handler/health fabricado.

O positivo de anexos configura Procurement pelo próprio
`ProcurementModule.domain.execute` em Settings/reset e Settings/save, incluindo
`uploadCap = 16 * 1024 * 1024`, e afirma esse valor numérico. A observação não
pode se apoiar apenas no limite padrão de Dashboard sem registrar essa distinção.

Os testes preservam o snapshot de domínio/C08 e observam zero scan/dispatch.
Cobrem configuração ausente mesmo com callback presente, grants restritos,
ausência de namespace, origem/stamp/cancelamento inválidos, desmontagem,
outra persistência, revogação durante leitura/admission e troca de handler,
descritor/método, chave ou configuração. A indisponibilidade inicial do scanner
é um teste de configuração, sem alegar qualificação ClamD.

Revisão manual inicial do integrador confirmou o recorte do predicado e a
separação de configuração/scan. Ela motivou a configuração numérica de Procurement
e as cercas adicionais de identidade.

A revisão independente de Operations leu os oito paths e encontrou um bloqueio
no código anterior: import-health verificava requestFor antes de validate.
O contrato original ui-authority.ts:51 registra consumed:false; validate:58–64
consome a admissão; requestFor:70–72 só então disponibiliza o Request. O commit
`3041fcd305c9014c1558197c30863952a2abbdbe` valida primeiro e depois confere
Request idêntico e current() novamente. As assertions e a política não mudaram.
Essa revisão não encontrou outro bloqueio concreto por leitura. A revisão curta
independente de Reports cobriu ambos observers e o wiring, sem leitura dos testes
nessa rodada; também não adicionou outro bloqueio. Nenhuma dessas revisões é gate.
A leitura do delta final confirmou a ordem corrigida. O gate único foi executado pelo integrador sobre os bytes publicados.

Gate único executado, seguindo o mesmo timeout de unit já usado na qualificação de #407:

```json
{"package":"sucafina","runner":"bun","args":["./Sucafinav1/test/native-ui-contract/asset-health.test.ts","./Sucafinav1/test/native-ui-contract/import-health.test.ts","./Sucafinav1/test/assets.test.ts","--timeout","120000"]}
```

Nenhum teste ou typecheck local foi executado. O integrador leu os jobs e o log real:

- Run: [44666552454](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44666552454), conclusão **success**.
- Snapshot: `5038302de56e1dc4c4a255eace3ab5210d6ae535`, filho direto do source `6732ff508922b097e5c9c42b457e3dc8dc6c65ae`; somente .ci-run.json acrescentado.
- Test job `136057127618`: success; cleanup `136057491026`: success.
- **26 pass / 0 fail / 182 expect() calls**, 3 arquivos, 729 ms.
- Oito testes novos passaram contra SQLite/autoridade/serviços reais; 18 regressões originais de assets passaram.
- O controle Omni declarou corretamente não aplicável: zero spawn/delegação; não se atribui inferência ou scanner vivo a este gate.
- Artefato de contexto do runner: `14596919880`, `test-ci-guard-context-5038302de56e1dc4c4a255eace3ab5210d6ae535-1`; não é baseline nem execução do comando final de guards.

A qualificação COMPLETE é somente dos nove paths deste PR e da disponibilidade compartilhada. Não qualifica UI55 instalada, DOC com ClamD, Operations completo, guards, sf-ci, pacote ou GO.

## Aberto / unbound / como retomar

- OP-PROC-02 e OP-PROC-03: o leitor posterior do artefato original, run `44666025425` success, localizou o último clique completo em `operations-support/runtime.ts:175:18`. O await :176 é inferido da fonte, não evento do trace. A causa independente dos scores esparsos foi corrigida na branch `sf-sourcing-json`; sua qualificação permanece separada.
- UI55 Import: o helper antigo usa `[data-import-workbench]`, status direto,
  índice de opção e sequência de preview/recovery que divergem dos controles
  atuais. A migração ainda não foi publicada: precisa preservar seleção, digest, CAS, um Apply e receipt/recovery. Esta branch não modifica o helper nem declara o consumidor completo.
- DOC: a causa de observação ausente está corrigida em fonte; é necessário
  compor Operations com ClamD real para comprovar o fluxo.
- O novo hash de host-context aumenta o drift já conhecido de contract-freeze;
  o integrador fará reconciliação única com história genuína após os produtores
  finais. Esta branch não modifica pins nem baseline.
- O diff foi revisado independentemente e o gate correspondente concluiu success. O integrador pode integrar este recorte compartilhado; Operations/UI55 continuam sem qualificação global.
- Não repetir gate sem mudança causal. Manter no máximo dois gates simultâneos;
  sf-ci e pacote final pertencem ao integrador após os merges.

Retorno: código `3041fcd305c9014c1558197c30863952a2abbdbe` | gate `44666552454` success, 26/0/182 | PR #431 qualificado para integração | guards/sf-ci/pacote finais separados | unbound do consumidor: `operations-support/imports.ts:155:22`; DOC e Sourcing aguardam gates dos compostos corrigidos.
