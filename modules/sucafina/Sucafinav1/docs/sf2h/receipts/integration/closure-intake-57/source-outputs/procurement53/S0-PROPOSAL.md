# Proposta mínima para S0 — aprovação de substituição futura

**PROPOSED_ONLY. Não implementada e não autorizada pela missão53.**

## Decisão concreta solicitada

S0/WP00 e o owner canônico de Procurement precisam decidir se a obrigação M31 deve adquirir um contrato explícito de **aprovação de uma proposta de substituição ainda não aplicada**. Sem essa decisão, o requisito original continua OPEN. O ciclo editar/submeter/aprovar entregue pela53 é utilizável por si, mas não satisfaz o predicado de outro efeito após a aprovação.

Esta proposta não muda o plano pinado, os testes52/51, thresholds, papéis, estágios ou comandos existentes. Os nomes abaixo são candidatos para discussão, não endpoints disponíveis.

## Conflito exato

O domínio existente admite:

1. `Requests/save` em draft/PR rejeitada grava140.
2. `Requests/submit_pr` congela o140 já gravado.
3. `Requests/approve` aprova esse snapshot, pelo holder atual; aprovação final de PR leva a sourcing.
4. Em sourcing, `Requests/save` pode atender edições próprias desse estágio por buyer/admin, mas não aplica a substituição de `pr.estAmount`. O lifecycle e a preparação C12 recusam essa intenção financeira; o caso HTTP com Alice/requester recebe403. Não se declara que todo save em sourcing é proibido.

O nominal52 conserva PR100/v1 durante a escolha140. Depois exige preparação, pending140, approve140 e um Apply financeiro adicional, mantendo identidade/CAS da preparação. Não há ação humana explícita de save/submit entre preparação e a expectativa de pending140. Preparação não pode produzir esses efeitos escondidos. O nominal51 exige sucesso da preparação financeira150 antes da captura original; a recusa impede alcançar sua cauda histórica.

Aprovar o100 existente não autoriza140. Mover save para dentro do preview, marcar uma checkbox como aprovação, repetir save depois da submissão ou fabricar um receipt são incompatíveis com a autoridade vigente.

## Menor novo objeto a decidir

Uma proposta canônica durável, distinta do pedido e da escolha C08:

```ts
type ProposedPrAmendment = {
  schema: "proposed-pr-amendment-v1"
  proposalId: string
  proposalVersion: number
  request: {
    recordId: string
    incarnation: string
    expectedVersion: number
    beforeDigest: string
  }
  effect: {
    field: "pr.estAmount"
    before: number
    after: number
    currency: string
    period: { start: string; end: string }
  }
  provenance: {
    caseId: string
    caseIncarnation: string
    caseVersion: number
    choiceId: string
    operationDigest: string
  }
  submittedSnapshot: {
    proposalDigest: string
    financialPolicyDigest: string
    submittedBy: string
    submittedAt: string
  } | null
  approvals: readonly {
    proposalDigest: string
    proposalVersion: number
    holderId: string
    decision: "approved" | "rejected"
    by: string
    at: string
    comment: string
  }[]
  state: "draft" | "pending" | "approved" | "rejected" | "consumed" | "cancelled"
  consumption: {
    idempotencyKey: string
    commandDigest: string
    receiptId: string
    resultingRequestVersion: number
  } | null
}
```

Os estados acima pertenceriam **à proposta nova**; não são uma alteração implementada dos estágios atuais da PR. Campos de identidade/política vêm do host e do domínio. A choice fornece proveniência e intenção; não concede poder financeiro. O valor aprovado seria exatamente `effect.after` sob a política aplicável a esse valor, com moeda e bases congeladas.

## Operações mínimas e efeito de cada uma

| Operação candidata | Efeito persistido | Ato e autorização |
| --- | --- | --- |
| Propor substituição | Cria/revisa a proposta; não muda PR100 | Ação humana explícita, acesso ao pedido/caso e autorização canônica definida por S0 |
| Submeter proposta | Congela proposta140, fontes e política; escolhe os holders canônicos para140 | Ação explícita separada; não usa `submit_pr` para simular uma proposta diferente |
| Aprovar/rejeitar proposta | Registra decisão ligada ao digest140 e CAS da proposta | Holder atual, autoaprovação e política que S0 determinar; nenhum override de admin implícito |
| Consumir proposta aprovada | Aplica exatamente100→140 uma vez e grava receipt C12 no mesmo commit | Nova operação tipada expressamente autorizada por S0; não é um `Requests/save` clandestino após aprovação |
| Cancelar/ressubmeter | Invalida decisões anteriores; revisão exige novo digest/CAS | Ato explícito e política definida |

O estágio legal da PR no momento da aplicação, o tratamento de uma PR já submetida/aprovada e a validade de aprovações posteriores são decisões obrigatórias de S0. **Esta proposta não preenche essas decisões por suposição.** Não basta acrescentar um flag `approved:true` ao Command existente.

## Consumo atômico proposto

Na única transação do domínio:

1. Autenticar o Request atual com roleMap e acesso atuais.
2. Buscar a proposta pelo ID e validar instalação/projeto/ator/permissão.
3. Consultar o registro de idempotência. Mesmo key+digest com receipt atual autorizado retorna o receipt sem mutação; key reutilizada com outro conteúdo é conflito.
4. Conferir encarnação e CAS do pedido, beforeDigest/valor100, CAS/digest da proposta, moeda/período, política e aprovação de140 por todos os holders exigidos.
5. Se qualquer precondição divergir, recusar sem efeito. Não atualizar expectedVersion automaticamente nem usar aprovação de outra revisão.
6. Aplicar somente o delta autorizado140 no estágio que S0 admitir.
7. Gravar conjuntamente alteração, nova versão/auditoria/notices canônicos, consumo da proposta e receipt com digest/key/targetIncarnation/resultingVersion.
8. Só após commit reportar applied. Reconciliar o caso C08 depois; falha nessa reconciliação não repete o efeito financeiro.

Sem commit durável, não há sucesso. Erro/abort/rollback não consome a proposta. Mesmo ID reimportado com nova encarnação nunca reaproveita aprovação. Resposta perdida depois do commit recupera o receipt autoritativo; igualdade de estado ou log de auditoria não substitui esse receipt.

## Delta de implementação que depende da decisão

| Owner | Delta mínimo autorizado somente após S0 |
| --- | --- |
| S0/WP00 | Definir contrato de proposta, autoridade, estágios admitidos e relação C12; versionar a aceitação sem ocultar o requisito original |
| Procurement/WP04 | Armazenamento canônico da proposta; validações, transições e operação tipada de consumo; reaproveitar política existente sem copiar um segundo motor |
| WP10 | Adapter C12 co-commit de receipt/idempotência, provenance/C17 e recuperação do caso |
| Integrador atual | Composição existente de UI/HTTP/host e ciclo de retenção; nenhuma identidade forjada |
| Consumer52 | Expor atos humanos de proposta/submissão/aprovação/aplicação e provar o efeito original sob o contrato ratificado |
| Consumer51 | Capturar o original real e executar a cauda histórica inteira, com as mesmas obrigações de conteúdo, ACL, continuidade e replay |

Não se propõe alteração de alçadas numéricas nem papéis. Mesmo com essa intenção, a extensão daquilo que um holder pode aprovar é um novo contrato de autorização e precisa da decisão explícita de S0.

## Critérios de aceite da eventual extensão

- PR100 permanece100 durante preview, escolha e revisão da proposta140.
- Nenhuma ação financeira decorre de checkbox ou escolha isolada.
- O holder vê140, sua moeda e o delta100→140; a aprovação registra exatamente esse digest.
- Aprovar100 não permite aplicar140; editar140 para150 invalida aprovação anterior.
- Todos os efeitos são explícitos e passam pelo domínio; nenhum save oculto em preparação.
- Uma aplicação financeira100→140, uma auditoria/versão e um receipt co-commit; retry e SQLite restart não duplicam.
- CAS stale, holder alheio, admin sem override, autoaprovação bloqueada, revogação, troca de fonte/encarnação e política alterada recusam.
- Falha antes do commit deixa zero efeito; falha depois do commit e antes do caso recupera o receipt, preservando comando/key/digest.
- Nominais52 e MI07 são executados integralmente no candidato composto, com evidência de W/S e testes reais; verdes do ciclo53 não são transplantados.

O helper atual52 que espera pending140 imediatamente após preparar também precisa de uma decisão de fluxo: ele não contém os atos humanos necessários. Qualquer adaptação aprovada deve conservar o objetivo e as provas positivas do efeito; não trocar a assertion por uma recusa para produzir verde. Nenhuma edição desse helper foi feita pela53.

**Decisão pendente:** ratificar esse contrato mínimo e os estágios/autoridades aplicáveis, ou manter M31/MI07 abertos. Não há uma aprovação implícita pela publicação desta proposta.
