# Revisão independente final — união PR40, CAS e recibos

## Parecer e escopo

**Não encontrei novo bloqueador concreto no recorte estático final.** Os dois caminhos de corrida apontados pela revisão anterior e o residual de unicidade encontrado nesta revisão estão fechados no código examinado. O fechamento é **estático; execução Actions permanece pendente**. Este parecer não aprova o grupo inteiro, provas residentes, C/D ou aceite dos critérios.

Foram lidos somente os dois arquivos do delta e as dependências necessárias para seguir o C08, o leitor canônico de recibos, a correlação do resultado e o vínculo de revisão. Nenhum produto, teste, typecheck ou CI foi executado por este revisor. Nenhum arquivo de produto foi alterado por mim. O input PR40 é `be50d42d6a2c030d57d17038dec267ebd33ea78c`.

| Arquivo | Git blob final | SHA256 |
| --- | --- | --- |
| `product/decisions/apply.ts` | `964a53310c340f4496d7410d66f8b852270b75f1` | `debb437646fff9e9143b713b42e445f34754fe33df379fdd5f62b35e4a26a6da` |
| `test/product/wp11/execution-reconciliation.test.ts` | `b6499c30a3a2482cd96c72e3b4b6bf9b2a04c72e` | `eb621371e679b84989e8a7bbb23b4944e52bc5d3134dd65c272ac30cd4ebf449` |

Os caminhos acima são relativos a `modules/sucafina/Sucafinav1`. Este parecer foi fechado sobre blobs locais congelados antes da publicação. O coordenador deve associá-los ao commit/tree e ao snapshot de Actions exatos; não se inventa um SHA de publicação para o candidato local.

## Achados e resolução

### P1 — recibo alterado depois da última conferência

Na união intermediária `de2154ed486b526e7dd8844c915e62423af337d5`, a última autorização podia retirar ou trocar um recibo após a consulta canônica sem alterar a versão do namespace `cases`. A transação seguinte ainda podia registrar o resultado antigo.

No final, `apply.ts:131–135` conserva o CAS renovado após o domínio e compara o caso integral. Dentro do mesmo snapshot C08, verifica também o recibo e seu proof já autorizados. A callback não faz um novo `readReceipt` sob lock. A observação final em `139–141` cerca novamente os callbacks posteriores à gravação. Os modos de retirada/troca antes e depois da consulta são contraprovas autoradas; ainda precisam de Actions no novo pin.

### P1 — retorno antecipado de retry reconciliado

O ramo `apply.ts:53–57` agora faz `retainReceipt` depois das últimas callbacks de autoridade. A retenção lê o caso atual, confere seu digest integral e o binding de principal/policy/access revision, além do recibo/proof e do cancelamento. Os outros retornos de recibo já selecionado também usam essa retenção.

Os seis modos de falha de recibo reinjetam a mutação na última callback do retry reconciliado. Exigem recusa, caso preservado e recuperação sem novo dispatch. Isso cobre o caminho que a revisão anterior identificara antes do fence adicionado.

### P2 — unicidade da identidade do recibo

Esta revisão encontrou um residual no primeiro candidato final `4b92623ba4ca93b1fb9606acb1d68666f2c36e41`: a presença do recibo original e de seu proof não detectava um segundo ID com a mesma identidade de lookup. O leitor canônico recusaria essa ambiguidade.

O final `apply.ts:149–150` exige uma única ocorrência de `(surface, targetIncarnation, idempotencyKey, principalRef)`, a mesma tupla usada em `prepared-apply.ts:34–37`. Conserva a igualdade integral do recibo original, o digest do proof e o `receiptReviewBinding`. Os modos `receipt-collision` e `receipt-collision-late` preservam o original, inserem outro ID na mesma tupla e repetem a falha no retry. A recuperação remove apenas o registro injetado e exige que a execução do Planner continue ocorrendo uma única vez.

## Autoridade e persistência preservadas

`apply.readReceipt` continua sendo a fonte de autorização. A comparação do snapshot é somente uma cerca de consistência de um recibo que já foi autorizado; ela não transforma raw state em concessão humana, não classifica um efeito financeiro e não emite recibos.

A identidade e o binding de revisão permanecem associados ao comando, alvo/incarnação, idempotency key e principal. O C08 reautoriza a leitura/gravação no próprio provider. A transação usa a versão de armazenamento atual obtida depois do domínio, preserva edições paralelas versionadas no caso e confere que a mudança selecionada continua exata.

A reserva durável anterior ao dispatch permanece global ao caso/incarnação/change. Um replay da transação não pode marcar `createdHere` e enviar o comando novamente. Ausência de recibo depois dessa reserva continua sendo indeterminação conservadora, inclusive se houver queda entre reservar e despachar. Nenhuma simulação ou tentativa é apresentada como aplicação persistida.

## Limites da prova autorada

O teste final tem nove modos: os três anteriores (`normal`, `lost-response`, `revoked`) e seis falhas de recibo por retirada, troca ou colisão, antes/depois da conferência. Ele preserva assertions de efeito único, caso intacto antes da recuperação, edição paralela, conflito separado, fechamento/reabertura do store e igualdade do recibo recuperado. Não identifiquei afrouxamento de assertions ou timeout neste delta.

O C08, o store em disco, o prepared-apply/reader e os produtores Planner são implementações reais. **O contexto UI é uma fixture sintética**, assim como grants, decisões de autorização, reviewDigest e classificação do recibo. A injeção de falha é deliberada. Isso testa a fronteira de reconciliação; não prova a admissão humana instalada, a composição CLI de Procurement, SessionV2 ou uma sessão residente.

A execução exigida é `test/product/wp11/execution-reconciliation.test.ts` no candidato publicado pelo protocolo CI.md. O resultado deve permanecer separado deste parecer estático, e os gates do bundle continuam com S0.
