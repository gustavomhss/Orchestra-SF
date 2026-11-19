# Handoff — finish-choiceretry-20261119

SHA: 175d8d2f5f407fe1dddcffcae80614a3b367bf19 (código; documento em commit posterior)
Data: 2026-11-19
Estado: partial

## Feito

- Correção175d8d2f: aplica maxRequestBytes apenas quando o registry original declara o limite; exporta o schema da intenção pelo subpath público já existente de transport. A inspeção não altera policy/schema nem ganha novo grant.

- Branch isolada de Assembly33 corrigida 57070fcc1968090b6df188b8ea759ed5f72eefe5. Nenhum merge da integração; não inclui o diagnóstico temporário bcc.
- F02 ganhou somente inspectRecordedChoice, uma inspeção read-only específica para decisions.decision-choose após reload. Recebe o corpo/chave e owner como dados não confiáveis, valida schema fechado original e exige igualdade com o stamp autenticado do transporte atual.
- A inspeção chama projection.case pelo F02 original. O GET precisa retornar HTTP200/status ok e o mesmo stamp. A projeção precisa ter o mesmo case/incarnation, uma única escolha com alternative/version/criteria/reason/principal e as duas referências de comparação exatas, além de um único evento choice-recorded em caseVersion original+1, com o mesmo principal, razão e instante.
- Nenhum POST ocorre na inspeção. O resultado ready conserva apenas um marcador efêmero observado, corpo/key/digest/owner no transporte atual; confirmed permanece false. Um clique humano posterior deve usar retry:same-intent. A lista de operações permitidas para esse retry permanece intacta.
- O transporte recusa mudança de corpo/key, envio ordinário com a intenção observada, concorrência durante a inspeção e transporte/owner/geração diferentes. Um epoch adicional invalida a leitura se houver revogação e reautenticação, mesmo com o mesmo stamp.
- 5 testes de fronteira adicionados em packages/client/test/sucafina/recorded-choice-retry.test.ts: inspeção sem POST, replay explícito e negativas, escolha/evento ausente ou ambíguo, owner/excesso/abort/new transport, concorrência/geração e limpeza após revogação. São fixtures sintéticas de codec/IPC, não recibos ou prova de C08.

## Pendente

- packages/client/src/sucafina/transport.ts:528 — novo método e retenção observada receberam revisão do integrador e passaram o gate de client 44627326343. Ainda falta typecheck do aplicativo e prova nativa com C08 instalado.
- packages/app-shell/src/orchestra/chapters/sucafina/decisions/choice/record.tsx:193 (branch finish-choice, código c8a941331e8a4748f1f037d7b34804f504d727eb) — caller ainda retém somente memória; falta guardar a intenção antes do primeiro POST, reler e inspecionar dados não confiáveis após reload e só então oferecer o clique explícito.
- packages/app-shell/e2e/sucafina/decisions-support/choice-history.ts:43–79 — portar controles nativos preservando perda de resposta, reload, mesmo corpo/key, dois POSTs e uma escolha; nenhuma asserção foi removida.
- Caso sem escolha/evento original correspondente permanece inconclusivo. Este delta não autoriza nova criação, não resolve uma perda anterior ao commit e não renova CAS/observação.
- A disponibilidade UI38 está em commit separado 07862279c8de45199ab20f0295a257e84a5e9805 e ainda precisa composição por hunk e qualificação.

## Decisões e justificativas

- A projeção não expõe a chave privada da transação record-choice. Não se afirma que o GET valida essa chave; ele valida a escolha já existente. O produtor compara o digest completo e a chave original no C08, reautoriza e só então devolve o receipt canônico.
- Fonte: modules/sucafina/Sucafinav1/product/decisions/mutations.ts:180–210 exige autoridade humana, consulta replay antes de gerar nova escolha e publica o evento com versão+1. :229–251 lê a transação privada por principal/namespace/case/operação, exige incarnation/digest atuais e devolve o receipt original sem salvar outra escolha. :263 mantém a mesma identidade/digest transacional.
- packages/schema/src/sucafina/decisions/source-contracts.ts:357–415 publica case/choices/ledger completos. Não confundir case.receipts com a transação privada record-choice.
- O consumidor original modules/sucafina/Sucafinav1/product/ui/decision-choice.ts:9–25 e :292–324 retém corpo/key em sessionStorage antes do POST e permite reconciliação humana após reload. O novo transporte não lê sessionStorage nem restaura grants, leases ou receipts.
- Nenhuma asserção foi removida, pulada ou teve timeout aumentado. Nenhum dado de domínio, digest, coverage, choice ou receipt foi criado em fixture de produção.
- runtime/application.ts e baseline305 permanecem sem edição. Não houve sf-ci, merge ou declaração de GO.

## Como retomar

1. Continuar do código175d8d2f sobre a base57070fcc; a revisão do integrador não encontrou defeito bloqueante no recorte.
2. Gate de client 44627326343 concluído SUCCESS:22pass/0fail/403expect,288ms. Preservar essa qualificação limitada a codec/IPC.
3. Ligar somente a folha UI38 ao método opcional, mantendo estado bloqueado quando a inspeção não comprovar a escolha original.
4. Portar choice-history e executar o spec estreito real. O gate sintético não prova o efeito único C08; essa prova depende do produtor e do teste instalado.

## Comandos e resultados

- Nenhum shell, filesystem ou teste local utilizado.
- [44626583090](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44626583090) FAILURE, job135921910068, cleanup135923237473 SUCCESS:18 pass/4 fail/353expect,5.37s. Os17 testes antigos de human-retry passaram. A inspeção nova retornou antes de GET porque exigia maxRequestBytes presente; registry decision-choose:58 não declara esse campo. O teste de concorrência atingiu seu timeout original5000ms por não chegar ao GET. Correção segue exatamente a regra existente: verificar o limite somente quando publicado. Sem aumentar timeout ou retirar assert.
- [44627326343](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44627326343) SUCCESS, test135924505197, cleanup135925839162 SUCCESS;22pass/0fail/403expect,288ms. Código175d8d2f5f407fe1dddcffcae80614a3b367bf19, snapshotf3adde429514845341a0a6105388f9f4f334dcbf. Requisição:{"package":"client","runner":"bun","args":["test/sucafina/human-retry.test.ts","test/sucafina/recorded-choice-retry.test.ts"]}. Os três typechecks e o navegador não fazem parte deste gate.
- Prova independente de binding compare: run44620658522 SUCCESS 3 pass/0 fail/14 expect, código5da8d863a1f865b1c44bbc5cd782b996c3d7bf5f. Não cobre este delta.
- Operations7 run44624816144 FAILURE antes do navegador por dois TS2367 nos callbacks de saúde. Corrigidos pelo integrador em 57070fcc com Object.is original; Operations8 run44625548030 terminou FAILURE1pass/4fail, com três types e ClamD passados; são causas independentes em investigação. Não são gates de UI38.
