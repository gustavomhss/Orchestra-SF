# Missão 96 · recuperação de criação sf_case_draft após reload

**Finding:** R1-91-001 · origem revisão independente PR #100 · **estado:** implementação-fonte publicada, **validação Actions pendente**, **composição HTTP/host52/71 NÃO adotada**, **GLOBAL_RELEASE=false**.

## Identidades e ownership

- Repositório: `gustavomhss/Orchestra-SF`; branch **existente** `creation-reload-fix`; C45 `5585e57f90d7b8d45e0577a8f0f4aa7884d3b58d`; plano imutável `dbf9547211d9b0fade619790de7c19c0869b7c7d`.
- Missão pinada: `96.json@f0d860691ea8d782a43905855d52699a39347dfe`; lease **creation-reload-browser96**; sessão conversacional nova identificada como **GPT-6**; não foi observada uma identidade de sessão Astra distinta.
- ACK96 antes de qualquer código: `b47af7b8f02b241133ec202de61977a359848945`. Commit de código W1: `f3f0c91ca28dc97f6cf80782924c91712798b26e`; W2: `22d0db3549081a740ee7edc40bcea617b8dcc690`. Os SHAs seguintes devem ser lidos da PR, sem inferir snapshots.
- 71 é a única integradora de `sf2-stack`; 45 mantém dispatcher, dedup e checks; 52 mantém interface/HTTP; 91 mantém review independente. A96 **não tomou** esses paths. HotTopic87 e application86 não foram alterados.

## Correção fonte e isolamento

O POST do formulário só pode começar se o navegador persistir **antes** do primeiro byte um identificador aleatório v4, sob uma chave `sf:case-create:pending:v1:<escopo-hash>:<uuid>` com valor literal `pending`. O escopo-hash é emitido após admissão host e calculado de `{installationId, projectId, principalRef, policyVersion}`. Não persistir objetivo, critérios, evidências, credenciais, Bearer, cookie, sessão, comando serializado nem ref do caso. Se storage/escopo faltar, o formulário falha **fechado** sem POST.

Em caso de commit C08 + ACK perdido, o reload reaproveita apenas a UUID antiga para um **GET de correlação**. O `case-port.ts` transforma a mesma UUID na identidade canônica do comando (`digestSfValue({operation:"sf_case_draft",key})`) e consulta o ledger C08 originalmente gravado para a combinação de principal, namespace `cases`, creationTarget e operação. Confere namespace, principal, incarnation do target e da store, recibo, participação, caso real e incarnation; reabre via `port.read` (autorização, sources e operações) e lê C08 uma segunda vez. Nenhum resultado é divulgado depois de troca de lease, autoridade ou evidência. `missing` não significa que o POST anterior não poderá terminar: **jamais** disparar retry automático com uma nova UUID ou corpo recriado.

Mesmo texto em duas decisões deliberadas recebe **dois IDs** e deve produzir dois casos distintos. Durante incerteza, campos ficam bloqueados e o retry manual do mesmo documento reutiliza **chave e corpo exatos**. Se pessoa quiser criar outra decisão, precisa optar explicitamente pela ação separada; o original não é apagado antes de uma reconciliação autoritativa. `X-SF-Creation-Scope` evita a reinterpretação de uma página antiga após troca de ator; a autenticação corrente, não esse hash, decide o acesso.

## Dependência NÃO composta — entrega patch completo aos owners52/71

`OWNER-52-71.patch` é um diff unificado real com **quatro preimages e quatro postimages exatas**, indexados em `OWNER-52-71.json`. O replay do patch sobre os quatro preimages foi verificado estaticamente **4/4 bytes iguais** aos postimages declarados. Nenhum dos quatro arquivos foi alterado na branch96:

1. `product/interface/http.ts`: registrar GET `?sf=workbench-create-recover`, validar apenas UUID no header, `X-SF-Creation-Scope`, `sf_case_read` admitido e consumido, egress com revisão viva; expor `committed/not-found` sem nunca POSTar. Bind do hash no HTML autorizado de Workbench. Proteger POST novo contra escopo trocado. Retornar 409 em `conflict/stale` e 400 em `needs-input`, preservando consumidores legados sem header.
2. `product/interface/contextual-decision.ts`: bind do mesmo escopo somente no formulário de contexto realmente emitido após autorização.
3. `product/contracts/host-context.ts`: superfície privada opcional `caseCreationRecovery`, nunca serializada para modelos.
4. `apps/cli/src/sucafina-product/host-context.ts`: compor o **produtor real** `business.cases.recoverCreation` no serviço host. Nada de callback permissivo nem segunda implementação de consulta.

**Sem adoção desse patch, o Workbench novo falha fechado para criação e a recuperação GET não existe.** A96 não reivindica que a capacidade esteja instalada. Owner deve verificar preimages contra HEAD vigente, resolver conflito com escrita posterior, incorporar patch mínimo por CAS e devolver commit/teste à71. Não há transferência de autoridade pelo silêncio.

## Testes fonte adicionados · execução factual

- `test/product/creation-reload-fix/creation-correlation.test.ts`: C08/SQLite reais; perda de ACK simulada, GET com chave original após reload, reabertura do storage, mesmo recibo e única escrita; retry exato; corpo alterado em mesma chave conflita; dois textos iguais com chaves diferentes; negação de outro ator, revogação, expiração e replacement da incarnation.
- `test/product/creation-reload-fix/creation-browser.test.ts`: navegador real + C08/SQLite, host/UI authority real, ACK suprimido após commit, scope browser, reload e restart, outra criação deliberada, alteração conflitada, troca de ator no mesmo contexto e ausência de credenciais em storage. **A rota GET do fixture é um adaptador de prova de componente, não o HTTP instalado do owner52**; o positivo instalado depende da composição acima.
- **Nenhuma execução foi disparada nesta sessão.** Status de unit/browser/HTTP instalado/typecheck/guards = `NOT_RUN`; assertions do código não contam como PASS. W1/W2 são commits de origem; S, run ID, job ID e reports físicos ficam **NULL até dispatcher45**. Não transferir resultados do WP01/PR43 ou do HotTopic87.

## Solicitações de fechamento

- **52/71:** adotar patch4/4, adicionar negativo instalado para ator/escopo trocado e GET com preflight/response perdido, rodar o candidato composto, devolver SHA exato da composição à71.
- **45:** deduplicar por árvore + seleção + config; usar `CI-REQUEST-45.json`, a interface existente `test:ci` do Actions, sem testes locais nem epic. Rodar ainda checks cirúrgicos/typecheck+guards somente dentro da autoridade do dispatcher; devolver W/S/run/job e resultado físico.
- **91:** realizar recheck **independente e posterior** exclusivamente do finding `R1-91-001` sobre commit composto e logs efetivos; separar fonte corrigida de instalação e negar aprovação até ter prova própria.
- **71/S0:** preservar os 15 WPs, 74 tasks, 17 contratos e 1610 critérios imutáveis; manter GLOBAL_RELEASE falso e todos os HOLDs externos.

Não houve merge em dev, force, deploy, alteração Azure, engine, workflow, credenciais, restart, testes locais ou nova PR para HotTopic.

## Reconciliação da autoridade de integração posterior a C45

Na leitura adicional da PR65, o histórico de autoridade informou **71 encerrada** em `modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/release-wave-71/AUTHORITY.json`, e **100 ativo** sob lease `S0-C-e14-browser100` em `modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/continuation-100/ACK100.json`. O ACK100 identificava missão96 como ACK-only, anterior aos commits-fonte desta entrega.

O branch `sf2-stack` avançou além de C45; o HEAD observado na reconciliação foi `38124138d21289a3bd20c86cd8d4e9c78c157417` (o próprio writer100 pode avançar depois). Das quatro dependências externas, `apps/cli/src/sucafina-product/host-context.ts` mudou por trabalho legítimo de integração100, enquanto as outras três permaneciam com preimages C45. Portanto o patch C45 `OWNER-52-71.patch` permanece somente como registro histórico. **Preferir `OWNER-52-100-CURRENT.patch` e seu manifesto exato, sem sobrescrever código novo do host.** O patch V2 foi reconstruído sobre preimage do host `f03ab621e96cfda23456be73bba2d24f24754d36`, preservando linhas e estrutura nativas atuais, e sua aplicação estática 4/4 foi validada contra postimages GitHub. Essa validação não é execução compilada.

**Destino de handoff ativo: integrador100 + owner52 + dispatcher45, com comentário documental também na PR65/71 e recheck independente91**. Não dirigir write ao lease71 já encerrado nem transferir autoridade por silêncio; revalidar live HEAD antes de aplicar. Não usar este ACK como autorização de merge, teste pesado ou release.

## Correção de seleção CI — condição de admissão física WP01

O arquivo `wp01/browser-fixture.ts` exige **seleção Linux nominal**: `browser-startup.test.ts` primeiro, `browser-lifecycle.test.ts` último, e pelo menos um consumidor de lease no meio. A seleção inicial de apenas dois arquivos novos **não seria admitida** pelo guard. `CI-REQUEST-45.json` foi corrigido para a seleção ordenada de quatro arquivos: startup WP01 → regressão SQLite96 → browser96 → finalizer WP01. Há **dois testes novos**, mais dois controles originais de ciclo de vida, sem descoberta, parallel flags, browser alternativo ou modificação do timeout original. A evidência física e Omni seguem obrigatórias; até o dispatcher45 executar esse contrato, **NOT_RUN**.
