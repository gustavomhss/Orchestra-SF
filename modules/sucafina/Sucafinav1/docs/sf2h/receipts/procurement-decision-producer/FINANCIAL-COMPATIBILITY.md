# Missão37 — auditoria da compatibilidade financeira

Estado: NO_COMPATIBLE_CANONICAL_COMMAND_FOR_CURRENT_PR_REPLACEMENT. A auditoria inicial foi estática e somente leitura. As provas posteriores pelos comandos reais foram executadas exclusivamente em GitHub Actions: quatro cenários financeiros passaram no run43647866067, com inputs byte-idênticos na fonte final W3. CI.json conserva resultados, W/S e a falha agregada desse primeiro run. Nenhum teste, servidor ou comando de domínio foi executado localmente.

## Inputs examinados

- Planejamento `dbf9547211d9b0fade619790de7c19c0869b7c7d`: START, WORKFLOW, COMMON; seções integrais work_packages (WP04 e T01–T05) e contracts (C01–C17) do pack S2-A; product-acceptance completo e trechos pertinentes de resident-runtime.
- Missão37 e FINDINGS de Decisions31, disponíveis nos inputs do root.
- Fonte PR23 `ce0ee1553d50408c433aa41255601018ba6e02f3`: scenario-preparation.ts e prepared.ts.
- Composição C9 `c1bd1c91b0e0d32db3074408e815e36107384073`: runtime/procurement.ts; src/procurement.ts, src/requests.ts, src/form.ts, src/procurement-screen.ts; porta/act.ts; prepared.ts, prepared-review.ts, scenario-preparation.ts, decision-preparation.ts, decision-host.ts e c12.ts.
- C12 source `8b7497a271c5afbd8604927f75b2a86a4f960bae`: prepared.ts e scenario-preparation.ts idênticos a C9 pelos blobs.

## Objetos Git determinantes

| Arquivo (sob modules/sucafina/Sucafinav1, salvo indicação) | Blob C9 |
| --- | --- |
| runtime/procurement.ts | 20a3ec5a30ac0fce6b35f05750d1b3dced11c45b |
| src/procurement.ts | eb486f52910425e9ca06d1f11ce18c90528ff36c |
| ../porta/act.ts | fe257cef702f6459d510d823d18377da34888dbf |
| product/procurement/scenario-preparation.ts | bdea5d497b4e8fa7e540cfb44d427cd3696678db |
| product/procurement/prepared.ts | e613a1bf32fe1ee75574139cf699c34843cf25d1 |
| product/procurement/prepared-review.ts | c8d476a1be6d2b839a087b2bc248293014599791 |
| product/procurement/c12.ts | 84f27e1312d3c58f3ba1ea5ae78fe5a936e3adc7 |

A PR23 inicial ainda traz prepared.ts `9c1b657dc4d6d5ba139c4f9fe854c1c8960cc95b` e scenario-preparation.ts `8c83680aaffa06c7b265f17e612118b1e008615a`, anteriores à proteção OPS-REV-02. O delta desta missão precisa conservar as proteções da composição, sem sobrescrever C12/session32.

## Contradição exata

A operação existente é `ScenarioOperation.kind=replace`, com targetRef do pedido, amount/currency/period. `createProcurementScenarioPreparation` a traduz exclusivamente em:

```ts
{ page: "Requests", action: "save", id: target.id,
  version: currentRequestCASVersion,
  values: { pr: { estAmount: operation.amount } } }
```

1. `runtime/procurement.ts#execute` calcula `prEdit` somente para `draft|pr_rejected` e criador/admin. Somente quando `prEdit && action in [save,submit_pr]` aplica `values.pr` ao PR.
2. `porta/act.ts#inDe` admite `approve` somente em `pr_pending|src_pending|po_pending`; em draft/rejected retorna `not_a_transition`.
3. `src/procurement.ts#submitPR` valida PR/CAS, e `porta/act.ts#submitPr` congela o valor corrente do PR em `prApproval.amount`, cria steps da matriz existente e altera para `pr_pending`.
4. `src/procurement.ts#approve` passa apenas o registro corrente, ator, comentário e CAS ao act; não recebe uma proposta de amount nem aprova um valor que ainda não foi escrito/submetido.
5. `porta/act.ts#approve` marca o primeiro step pendente. A aprovação intermediária conserva `pr_pending`; a última altera para `sourcing`. Nenhum resultado de aprovação permite edição de PR.
6. Em sourcing um save da tela Requests pode retornar sucesso para o estágio sourcing ignorando PR.estAmount. OPS-REV-02 impede explorar esse comportamento: `procurementPreparationIssue` recusa estágio não editável e no-op; `prepareProcurementMutation` verifica fisicamente cada campo solicitado após execute.
7. Salvar/submeter o novo valor antes da aprovação permite aprovar exatamente esse valor, mas depois já não há substituição pendente: novo save é no-op ou fora do estágio. Ele não pode gerar um segundo efeito/recibo apresentado como aplicação do valor proposto.
8. `issue` existe após `po_approved`, mas registra emissão interna da PO e não substitui PR.estAmount. Usá-lo como implementação da mesma operação alteraria a semântica escolhida e o contrato; não é alternativa transparente.

Portanto o conjunto de estados em que a mutação proposta produz efeito real é disjunto do conjunto de estados em que há aprovação formal concluída aplicável a ela.

## Políticas preservadas

- Holder corrente, admin sem override e blockSelfApproval continuam em `porta/act.ts#admit`.
- Aprovação não é concedida por perfil, escolha, checkbox, revisor, comentário ou valor igual em approval antigo.
- `C12` separa escolha de gestão de aprovação PR/sourcing/PO, mantém CAS e recibo atômico por domínio; recuperação repete o recibo autorizado, não o efeito.
- A versão física `snapshot.versions["requests:<id>"]` é diferente da versão do escopo de evidência. Um inteiro coincidente não prova a mesma aprovação.
- `prApproval` contém amount/fxRate/steps, não um novo comando de aprovação detached para propostas externas. Proveniência exige o snapshot e a cadeia real de submissão/decisão; importar ou forjar esse objeto não constitui aprovação.

## Resultado implementável nesta autoridade

O produtor anterior à escolha pode e deve ser concluído independentemente, com operação explícita, fontes atuais, cálculo canônico sem execute/prepared, C10, identidade e persistência/replay. A interface precisa declarar que sua prévia não é aprovação. A preparação financeira dessa substituição deve falhar explicitamente sem comando compatível, mantendo os caminhos/regras existentes e sem criar outro Apply.

Isso não fecha M31-FINANCIAL-APPROVAL; registrar BLOCKED_POLICY_CONTRACT e o critério positivo como NOT_SATISFIED, não como PASS obtido por recusa universal.

## Decisão mínima necessária (owner S0/WP00 + Procurement/C12)

Definir qual efeito de negócio o contrato pretende preparar:

- Se a intenção é alterar um rascunho de PR, o ciclo canônico é edit/save → submit_pr → aprovação formal. Exigir aprovação concluída antes desse próprio save é incompatível com o ciclo. Mudar essa ordem de aceite requer decisão explícita; esta missão não a muda.
- Se o efeito desejado após aprovação é a emissão interna de uma PO, declarar outra operação tipada e seus inputs/condições de PO, mantendo as aprovações existentes; proprietário do contrato/C12 precisa autorizar e compor esse efeito. Não chamar emissão de substituição de PR.
- Uma aprovação detached de proposta ainda não gravada exigiria novo comando/contrato de domínio e política explícitos, fora da autoridade desta missão.

A decisão mínima é sobre o efeito e a ordem de aplicação/aprovação. Não é reduzir alçada, introduzir papel ou liberar novo estágio de save.

## Casos de auditoria e limites de prova

A lista abaixo preserva os casos levantados na auditoria; ela não declara que cada subcaso recebeu execução nova nesta missão. O mapeamento executado está em CI.json e CRITERIA.json. As provas demonstram aprovação canônica do valor/versão submetidos e recusas relevantes, sem conceder PASS ao Apply financeiro incompatível.

1. Pelo domínio real, PR draft com amount A: Approve recusado, sem snapshot/versão/histórico novo.
2. Submit_pr com amount B grava B e congela prApproval.amount=B; holder legítimo aprova somente com CAS exato. CAS antigo deve conflitar sem step/histórico novo.
3. Holder alheio/admin override e self-approval quando bloqueada recusados pelo act real.
4. Após aprovação final do valor B, cenário que pretende save de B recusado por estágio/no-op; cenário com C recusado por estágio. Nenhuma aprovação de A serve para alegar aprovação de B.
5. Aprovação parcial seguida de rejeição: pr_rejected pode ser editado, mas não tem aprovação financeira concluída para proposta nova. Não promover step histórico approved a autorização atual.
6. OPS-REV-02: sourcing save com PR payload pode ser ignored pelo domínio; preparation deve recusar. Mesmo valor em draft deve ser no-op, nunca efeito aplicado.
7. Retarget, encarnação substituída, outro principal, revisão de acesso/política e fonte alterada devem falhar antes de mutação. C12 existente cobre seu próprio receipt/recovery; não reimplementar.
8. Produtor read-only: quantidade/currency/horizon/source/C10 corretos, custeio ausente preserva null e pendência; exact hypothetical amount quantificado não transforma cobertura em complete. Prévia não chama prepared/executor e não escreve domínio.
9. Identidade persistida/replay conserva operation/result/source/actor/case; alteração de approval/source/target requer nova leitura e nunca usa receipt antigo como aprovação.
10. Um efeito/recibo positivo de C12 financeiro desta substituição está impossível sob a combinação atual de contrato e política. Não fabricar um teste positivo que muda a regra; preservar provas positivas do C12 genérico sem apresentá-las como satisfação desse critério.

