# WP12-STALE-HOST-01 — contexto terminal atual

**Proposta para WP10: NOT_APPLIED / NOT_RUN.** O patch não foi aplicado em nenhuma fonte ou branch do host. Ele é uma proposta de integração, não evidência de execução do host.

## Contrato WP12 consumível

`createSfAnalysisHost` aceita `withLifecycleContext` opcional. `runSfAnalysis` usa esse contexto somente para `fail`, `settle` e `markStale`. `readSfAnalysisRun` usa-o para obter metadata; um resultado ready ainda precisa entrar novamente em `withRunContext`, ler o conteúdo e executar as duas verificações estritas. Hosts que não implementam a opção preservam o comportamento anterior por fallback.

`readLifecycle` exige a mesma identidade do run, principal/policy/access atuais, encarnação do caso, versão atual não anterior e participação atual, com duas leituras C08 e autorização final. Não devolve contribution payload, capture privado ou ticket. Os terminais continuam passando pelo callback obrigatório `revalidateForCommit`, CAS de contributions/cases, target e autoridade C08. A opção não transforma metadata em permissão de fonte.

## Causa localizada e pin

O patch é contra `apps/cli/src/sucafina-product/host-context.ts` em [WP10 f3b9f512](https://github.com/gustavomhss/Orchestra-SF/blob/f3b9f512fbcae66bc369ff7dbbe6fa433ae4c9d0/apps/cli/src/sucafina-product/host-context.ts), blob `28046172e5a540c8418aff0b968b2e098888c432`. `withRunContext` entra em `business.withCase` com a versão original antes de chamar o callback. O produtor [business-services.ts](https://github.com/gustavomhss/Orchestra-SF/blob/f3b9f512fbcae66bc369ff7dbbe6fa433ae4c9d0/apps/cli/src/sucafina-product/business-services.ts), blob `dbddde16519d6fa4342d3e942c58f4533f011619`, exige versão exata e passa por `cases.read`. Isso impede o callback terminal quando o caso avançou ou suas fontes não podem ser projetadas.

O `analysis-stale-commit.ts` publicado, blob `f40a30aca8668f3ef7636ca8af4bf65d4e987217`, já fornece uma via estrita C17 para conteúdo histórico e cancelamento. Essa via é preservada. O patch acrescenta uma via privada somente para metadata, usando o `readLifecycle` próprio do WP12; um WeakMap limita o commit ao contexto recém-admitido e à cópia integral do run anterior. A comparação no lock conserva sessão, recibo, request, seleção e todos os campos, permitindo alterar apenas version/state/reason/updatedAt. Sem output, capture ou outputRef novo.

## Escopo exato do patch

O patch liga a opção ao host e finaliza `failed`, `unavailable`, `needs-input` ou `stale` já classificados pelo coordenador, sob autenticação atual. Nenhuma publicação, coleta, replay C17, cancelamento nativo, engine ou grant foi relaxado. `preserveStale` com conteúdo mantém o caminho estrito existente.

O owner ainda deve distinguir uma recusa do caso antigo de revogação real no produtor de contexto. Hoje `business.withCase` devolve `denied` também para versão antiga. O coordenador não pode reinterpretar qualquer `denied` como `stale`: a distinção exige reabrir metadata do caso com autoridade atual e confirmar a mesma encarnação/participação antes de produzir `stale`. Também permanece separada a retenção de AlternativeDraft ainda não publicada: não existe neste patch reader de captura histórica privada e nenhuma captura pode ser reconstruída de campos do modelo.

## Qualificação requerida no host

Testar o producer real com SQLite/C08 e autenticação reais: uma fonte torna-se indisponível após admissão; executar settlement e reabrir o storage; avançar a versão do caso e conservar a referência original; remover o participante/revogar o request e exigir recusa; trocar sessão/recibo/run/case e exigir recusa; publicar/cancelar em concorrência e não sobrescrever o vencedor. O callback terminal deve recusar qualquer payload ou captura e preservar o conteúdo já armazenado. Typecheck do package e guards devem qualificar os bytes aplicados. Não atribuir ao patch o PASS dos testes próprios do WP12.

Os hashes do patch e do resultado esperado encontram-se em `proposal.json`. Aplicar somente após reconciliar o head atual do owner; não transplantar um snapshot inteiro.
