# Missão53 — contrato do ciclo canônico

## Estado da entrega

Implementado em `astra-wp04` / PR23, commit de produto `179a766bb1e3b6b15523ba6c2be8553207d543fd`. Os comandos financeiros, políticas, alçadas, estágios e papéis não mudaram. Os arquivos `prepared.ts` e `prepared-review.ts` permanecem intactos.

O resultado entregue é uma adaptação somente de leitura para preparar **uma ação humana por vez** e conferir a revisão dentro da transação do executor existente. Ele não retorna `PreparedCommand`, não emite aprovação e não fabrica recibo C12. A composição HTTP compartilhada está entregue como patch inerte para o integrador.

## Entradas e saídas

Exports em `product/procurement/decision-preparation.ts`:

| API | Entrada | Saída e efeito |
| --- | --- | --- |
| `createProcurementApprovalLifecycle({host}).review` | Ref de fonte já emitida e `TrustedDomainContext` UI vivo, vinculado ao Request real | `PortResult<ProcurementApprovalReview>`; zero commits |
| `prepare` | `{review, action}`, mesma autoridade atual | `PortResult<ProcurementApprovalPlan>`; zero commits |
| `admission` | Plano integral e binding UI do POST real | Closure privada `current/finish`; zero commits e zero execução de comando |
| `current(snapshot, actor, command, environment)` | Snapshot da transação canônica e ator recém autenticado | `PortResult<true>`; predicado síncrono de uso único; não escreve nem abre transação |
| `finish()` | Retenção da chamada | Encerra a closure; chamada posterior é recusada |

A review leva fonte com instalação/projeto/encarnação/versão/digest, CAS físico da requisição, estágio, valor atual, moeda, valor/moeda submetidos, holder atual, ações elegíveis e digests de ator, registro completo e settings/roleMap. A revisão usa duas observações independentes, revalidação na saída e identidade exata do Request.

Os arrays e objetos aceitos são copiados antes do primeiro await. Objetos malformados, campos extras nos envelopes/actions/review, getters, ciclos e valores não finitos são recusados antes de hashing ou leitura de campos. O domínio conserva o julgamento final sobre o comando.

### Ações explícitas

| Ação | Pré-condição canônica | Command existente produzido |
| --- | --- | --- |
| `save-estimate` com amount140 | Draft ou PR rejeitada; creator/admin autorizado; valor diferente do persistido | `Requests/save`, `values:{pr:{estAmount:140}}` |
| `submit-current` com amount140 | Valor140 já persistido, campos PR válidos e papel permitido pelo domínio | `Requests/submit_pr`, `values:{}` |
| `approve-submitted` com amount140, holder e comment | PR pendente; snapshot submetido140, moeda congelada e holder exatos; regra canônica de autoaprovação | `Requests/approve`, `values:{comment}` |
| `reject-submitted` com amount140, holder e reason | Mesmas verificações da decisão e motivo não vazio | `Requests/reject`, `values:{reason}` |

Todos os Commands incluem o ID real, o CAS retido e `confirmed:false`, que corresponde ao decoder HTTP. Aprovar não carrega um novo valor em `values`. Submeter não carrega uma edição embutida. Uma ação já representada no estado atual não é emitida novamente como save de no-op.

Cada plano contém exatamente `requiresExplicitAction:true`, `approvalGranted:false`, `receipt:null`. Esses campos não são concessões de autorização.

### Bridge de escolha para edição de draft

`createProcurementScenarioDraftPreparation({host})`, em `scenario-preparation.ts`, recebe:

```ts
{
  operation: ScenarioOperation,
  choice: ChoiceRecord,
  review: ProcurementApprovalReview
}
```

O host deve fornecer a choice persistida e autorizada pelo C08, nunca aceitar um objeto do browser como comprovação de escolha gravada. O bridge confere presença exata da operação na escolha, source/digest, valor finito, moeda e período. Retorna somente o plano `save-estimate`; não aplica o save. A autorização da edição vem do ator e do domínio, não da choice.

A preparação C12 anterior continua recusando a substituição financeira sem contrato de aprovação. O bridge novo não é um alias para esse efeito.

## Ordem obrigatória do ciclo suportado

1. Ler uma fonte atual já emitida e mostrar o estado persistido100.
2. Preparar a edição140 sem efeito. A pessoa confirma especificamente **gravar a estimativa140 no draft**.
3. Executar o Command existente com autenticação atual e CAS. O estado passa a draft140, versão seguinte, uma auditoria.
4. Ler explicitamente a nova fonte/review. Não atualizar silenciosamente o CAS do comando anterior.
5. A pessoa confirma **submeter o valor já gravado140**. O comando vazio de alteração congela140 e a política determina os holders.
6. O holder lê sua própria fonte/review. A pessoa confirma **aprovar o snapshot submetido140**.
7. Executar `approve` com o CAS desse snapshot; uma aprovação final de PR leva a sourcing. Um holder intermediário continua sujeito às etapas canônicas existentes.
8. Nenhum save financeiro adicional é gerado depois da aprovação.

Rejeição permite revisão e nova submissão pelas regras existentes. O comando ou a review da submissão100 não serve para a revisão140. Fontes antigas permanecem antigas; nenhuma leitura as atualiza por efeito colateral.

## Composição atômica e transporte

O plano é material de revisão. Um POST ordinário com somente `Command` conserva o comportamento canônico anterior e seu CAS, mas não transporta todos os digests da review.

O patch em `shared/admission/` adiciona ao Application existente um hook de admissão. O header `x-sf-command-review` seleciona esse transporte e leva intenção não confiável; o body continua Command canônico. A factory prepara fora da transação. O predicado roda dentro dela, após autenticação atual e imediatamente antes do único executor existente, sem await entre ambos para as quatro ações.

O marker sem hook, sem contexto existente ou com payload incompatível não cai no caminho ordinário. Snapshot/ator/comando recebidos pelo hook são clones; ele não substitui o comando. O wrapper verifica que o binding pertence ao Request HTTP exato antes/depois da admissão e no predicado. O finally cobre falhas síncronas e assíncronas do adapter.

A implantação desse patch e do provedor de contexto pertence ao integrador com autoridade atual. O exemplo completo depende do provedor UI existente e recusa a ausência dele. Não adiciona operação privada, grant, listener, controller ou credencial.

A revogação externa de lease é coberta pelas capacidades existentes do host: autenticação atual, revalidação antes da admissão e invalidação do Request retido. Não se promete uma garantia nova entre serviços.

## Idempotência, resposta perdida e recibos

O efeito canônico é protegido pelo CAS: após um commit, repetir o mesmo comando/versão recebe409 e não cria novo efeito, auditoria ou notice. Isso foi verificado inclusive após reabrir SQLite.

Uma resposta HTTP de sucesso é reportada somente depois do commit. O predicado permitido, a auditoria e a coincidência de valores no estado não são recibos C12. Sem um recibo autoritativo da operação, uma resposta perdida permanece indeterminada; não subir a versão nem reenviar com uma chave nova para supostamente recuperar o efeito.

C12 exige chave/digest e recibo no mesmo commit do domínio, com recuperação do recibo autorizado. Esse contrato distinto permanece aberto para a substituição financeira pós-aprovação.

## Limite da prova

O Actions executou o produto desta branch com SQLite, domínio, C08 e HTTP reais. A transação de admissão usa um wrapper de Domain exclusivamente no harness para chamar o predicado antes do executor original. **Isso prova o core e a composição do harness; não prova ativação do patch compartilhado.**

Os cinco nominais52, a jornada MI07/Memory51, PR→PO completo, UI instalada e os gates globais permanecem separados. Consulte `CI-RESULTS.json`, `EFFECTS-MATRIX.md`, `CONSUMERS.md` e `S0-PROPOSAL.md`.
