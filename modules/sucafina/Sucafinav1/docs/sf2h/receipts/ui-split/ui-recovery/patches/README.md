# Propostas para os owners — NOT_APPLIED

Nenhum arquivo de host, contrato, produtor, componente, shell ou fixture compartilhada foi alterado por `ui-recovery`. Estes arquivos são propostas, sem crédito de integração, typecheck ou execução de produto.

## IR-EXT-FIRST-SAVE-LOOKUP

`first-save-outcome.NOT_APPLIED.patch` propõe uma porta de leitura do resultado do primeiro save, para compose-resume/WP10. A base é `e1a1888bd2117616d53c5af5f5014e81c4b4e530`; os três blobs continuam idênticos em `d86d119c15d1149fd6f463e07acce836b197eb4e`. `source-pins.json` fixa os blobs. `git apply --check` passou em uma cópia exata desses três arquivos; isso valida contexto do patch, não sua semântica. O patch não se aplica integralmente à base antiga de interface-resume: o owner deve usar sua composição publicada.

Contrato proposto:

- `POST ?sf=dashboard-hot-topic-draft-outcome`, corpo fechado `{ caseRef }`, com o `Idempotency-Key` original.
- Admissão humana real `decisions.edit`, preservando origem, sessão, instalação, projeto, principal e autorização atuais. O consumidor não recebe um lease serializável.
- Resolver a intenção no host por `ui.operationIdentity(context)`. No host publicado, `commandIdentity` usa `{ operation, key }`; a operação permanece `sf-human:decisions.edit`. Não copiar esse algoritmo para o browser. Caso o owner altere a identidade para depender do corpo, deverá publicar um token de correlação durável e atômico equivalente.
- Ler a transação original de preferences, vinculada a principal, caso, incarnation e operação; obter o `draftRef` do resultado persistido. Não selecionar por título, alvo, posição ou igualdade de texto.
- Revalidar caso, participação, fontes, versão ativa do rascunho, digests e autoridade antes da resposta. Retornar somente o ACK original `{ draftRef, version }` quando comprovado.
- Ausência de transação, alteração de fonte, troca de incarnation, rascunho já avançado, inconsistência ou corrida continuam `unavailable`/`denied`. Um lookup vazio não autoriza uma segunda criação.

O patch não amplia grants e exige a permissão atual `decisions.edit`. Recuperação somente com leitura, se necessária, exige contrato/grant próprio do owner. A UI entregue ainda não chama essa rota: ela não existe no produto testado e nenhum green é atribuído à proposta.

Reprodução publicada: o teste `UI recovery distinguishes a lost first save without draftRef and never guesses its identity after reload` executa o save real, perde a resposta depois do commit, prova que não havia `draftRef`, e cria uma segunda intenção independente com texto igual. Depois do reload, duas identidades reais existem; a UI mantém a tentativa pendente sem guardar texto privado nem reenviar o save.

Provas requeridas ao integrar: resposta perdida antes de `draftRef`; dois drafts de mesmo texto/alvo; alteração legítima do caso; troca de incarnation; chave de outro principal/caso; revogação entre leitura e egress; origem/cookie/grant recusados; resultado ausente ou inconsistente; zero novos drafts no lookup. Depois, conectar a UI à porta publicada e provar o mesmo consumidor em browser.

## SHARED-APPLY-LOOKUP

Estado: **NOT_APPLIED / DEPENDÊNCIA ABERTA**. O teste novo comprova purge após um apply já reconciliado e negação real; depois recebe uma nova participação como entrada administrativa controlada da fixture. A tentativa do próprio ator revogado de devolver seu acesso é recusada por C08. A reautorização HTTP posterior não ressuscita correlação do browser nem reaplica o domínio. Isso não prova a variante original em que o domínio confirmou antes da reconciliação do caso e a correlação foi purgada depois.

Delta solicitado ao owner de composição/C12:

1. Publicar descoberta autorizada de resultados pendentes/aplicados, com paginação ou busca por identidade estável do caso. A lista atual limitada a 50 casos não é um índice de outcomes. O browser purgado não tem a chave original e não deve recriá-la.
2. Publicar leitura explícita do outcome por `{ caseRef, choiceId, changeId }`, utilizando a identidade atual e a permissão de leitura do recibo. Essa porta não chama `executePrepared`, não admite uma nova intenção e não exige que o browser reconstrua `reviewDigest`.
3. Resolver exatamente uma escolha/alteração e um recibo autoritativo. Conferir principal autorizado, instalação/projeto, incarnation, `idempotencyKey` do comando de domínio, `commandDigest`, vínculo com o caso e igualdade com a prova durável. Duplicidade/inconsistência deve permanecer indisponível.
4. Usar a evidência histórica/continuidade já publicada por compose-resume para autorizar o resultado após avanço das fontes, sem contornar revogação ou tratar record ID como continuidade. O blob `f8914c141ba5c72439f5fdba50e9153c4cd477d4` traz essa evolução, mas não expõe a porta de outcome acima.
5. Para domínio confirmado e caso ainda não reconciliado, recuperar pelo recibo durável e reconciliar no caminho C12 existente, com as mesmas fences e zero repetição. Preservar integralmente `partial domain execution reconciles a durable receipt and never repeats it on retry`.
6. Só então integrar a apresentação de recibo na UI e provar commit → perda → revogação/purge → novo acesso → descoberta → recibo correto, incluindo caso fora da primeira página e colisão de identidade. A proposta de primeiro save não fecha este finding.

Não há implementação especulativa desse segundo contrato na UI nem endpoint substituto na fixture. O owner deve publicar API e provas antes do consumo. Os 153 critérios de WP01/WP02 e os gates globais continuam íntegros.
