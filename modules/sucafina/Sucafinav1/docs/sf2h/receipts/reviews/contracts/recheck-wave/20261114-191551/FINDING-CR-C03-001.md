# CR-C03-001 — ACK por texto/autor permanece no caller WP10

## Identidade e origem

- Status: OPEN no SHA WP10 `d4fb072fa9bd32ebfef2b9cbc9b27b998d34f4e7`.
- Classificação: BUG de identidade do ACK, demonstrado por inspeção do predicado. Severidade: P2.
- Origem: problema de ACK já documentado na PR54; esta ocorrência fixa o caller diferente ainda presente em WP10. Não é um novo defeito atribuído ao produtor corrigido da PR41.
- Contratos: C03/C06/C08; CAMP.INV.05, CAMP.CMP.02 e WP10.QLT.40.
- Owner: WP01/UI e WP10/S0 para consumo na composição; Colaboração/WP08 fornece o recibo já publicado.
- Revisor: sessão independente S3-R3, sem autoria de produto. Prova dinâmica nesta revisão: NOT_RUN; nenhum teste ou CI disparado.

## Prova estática

No SHA fixado, `modules/sucafina/Sucafinav1/product/ui/work-collaboration.ts`, blob `99e0d4a9f8c265688e7488ece05ab30edf070658`, linhas165–172:

1. A tentativa pendente guarda chave, texto, IDs/incarnations conhecidos e corpo serializado.
2. O retorno de `collaboration-thread-reply` é tratado como uma conversa possivelmente mais nova.
3. O predicado seleciona mensagens novas com texto igual e autor coincidente; aceita quando há exatamente uma.
4. Em seguida apaga `replyRequest`, remove o estado dirty e reabre a conversa. Não compara um recibo que vincule a mutação à identidade retornada.

O produtor retido na mesma árvore, `product/collaboration/recipient-actions.ts`, blob `45f31b1f67e53f25e78ba6e26b334946889ef926`, linhas62–72, persiste Boolean `true` no C08 e devolve `input.read(id, context)`. Essa é uma projeção corrente; não é o resultado exato identificado da mutação.

Portanto a identidade nova e a unicidade do match não demonstram qual comando produziu a mensagem. Um retorno que contenha uma única mensagem adicional coincidente passa pelo predicado sem comprovar associação à idempotencyKey. A inferência não satisfaz o ACK exato exigido. A frequência operacional, uma exploração completa por API e um incidente real não foram demonstrados.

## Correções existentes em outras árvores

- PR54 `92243fc68ff81df7fc563ec081ac9db686a24dfa`: o caller é outro blob, `175ff36fe09405e0f31dd55207d751e3753f6ffb`. Linhas165–174 recusam uma projeção recipient marcada por `current` e mantêm a tentativa inconclusiva. Essa proteção não está no caller WP10 acima.
- PR41 `62e5629dbf31be2bb662dda152c96021f22b0ca5`: o produtor `recipient-actions.ts`, blob `22c6309c61b27b89914086a7602bf3bea61a988b`, já publica `mutationReceipt` com principal/chave/digests, sourceIncarnation e identidade id/incarnation/version da resposta, no mesmo commit protegido. Esse produtor também não está no WP10 examinado.
- A coleção dessas branches não é um candidato composto C. Os testes de PR54 usam seu produtor retido; não fecham o caller WP10 nem o ACK positivo do produtor novo.

## Ação executável e recheck

O owner deve consumir a closure de recibo já publicada, adaptar o caller ao resultado efetivamente instalado e preservar a recusa segura até existir uma associação exata. Não solicitar outra implementação paralela do produtor corrigido.

A prova pertinente deve atravessar o mesmo produtor/caller: mensagens de mesmo texto/autor, resposta perdida após commit, retry com mesma chave/corpo, intenção divergente, reload com intenção recuperada, IDs/incarnations/versões diferentes e revogação no egress. Não aceitar somente contagem/posição/texto/autor.

Este finding é publicado imediatamente no namespace de revisão autorizado. O parecer e handoff finais desta rodada acrescentarão os demais rechecks e limites, preservando este registro.
