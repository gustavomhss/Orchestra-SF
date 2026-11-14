# WP02 — retirada somente de escrita: contraprova W9 e seam de continuidade

## Evidência observada

No W9 `01633144c83fb1080e6d985ef226b8db2aa131cb` / tree `63f3a45a86dd33679a44cf113f8a620a2052bf4e`, snapshot `7f9657d7217ba5ceccdbf09b9ed5ec0cf866169c`, [run43586466170](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43586466170), job132421925833, o teste real `Dashboard contextual draft retains edits when current write authority is withdrawn` falhou aguardando a mensagem de retenção autorizada. O browser independente iniciou normalmente e encerrou com exit0; o corpo foi executado. Não foi falha de aquisição do pool.

A assertion de preservar `Unsaved operator wording`, dirty=true e proibir gravações permanece integral em host-workbench.test.ts. O timeout ocorreu antes dessas assertions posteriores; elas não recebem crédito PASS.

## Cadeia estática que explica a fronteira

A fixture real muda apenas actor.canWrite, mantendo sessão/operador e os dados canônicos. O escopo C17 inclui essa permissão e produz outra identidade de referência. O consumidor relê a descoberta autorizada após o denied. Para um draft novo, somente conserva conteúdo quando incarnation/refId/refDigest da origem coincidem exatamente. Se não houver essa prova, dispara sf-access-revoked/draft-source-unconfirmed e limpa os dados locais.

A leitura do código sustenta essa causa; o log W9 não capturou um evento detalhado com o ref antigo/novo, portanto não é apresentado como tracing executado de cada etapa. O finding F04 em drafts-and-source-continuity.md preserva o diagnóstico original e o contrato proposto.

## Correção pertence ao host

A UI não deve aceitar recordId, título, posição na lista ou igualdade textual como continuidade. O owner pode publicar um reauthorizer privado que recebe a referência original, resolve sua captura autorizada persistida, prova a mesma identidade física sem tombstone/replacement, exige o mesmo principal e leitura atual, e retorna uma referência atual mais a projeção atualmente autorizada. Ausência dessa prova continua saneando os dados.

Retirar escrita precisa conservar edição local somente após esse reader demonstrar leitura/identidade correntes; o botão de escrita permanece desabilitado. Troca de principal, ACL que retira leitura e delete/recreate continuam limpando o conteúdo. Não gerar nova intenção nem alterar o body/key de um resultado incerto.

## Estado

**Bloqueio observado do cenário positivo; producer/host seam pendente.** Não alterar a assertion para aceitar purge, não repetir o mesmo run sem input material e não declarar WP02 concluído. O histórico genérico publicado em Compose para a mesma accessRevision não comprova continuidade entre revisões de acesso.
