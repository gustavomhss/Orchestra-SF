# R3 — Rechecagem independente de IA, Relay e integração no W2

**Veredito: changes-required.** O veto de publicação C11 está corrigido por inspeção. O W2 ainda mantém uma ordem de cleanup que espera a interrupção nativa antes de revogar recursos, um erro próprio de tipagem no novo resolver Planner calculation e dois gates próprios do sourceguard. C07 continua uma pendência externa obrigatória. Não existe resultado de unit W2 no fechamento deste parecer.

## Identidade, independência e lease

| Item | Evidência |
|---|---|
| Reviewer | `/root/review_runtime`, R3 independente, sem autoria de produto, testes ou workflows |
| Candidato W2 | `b7a6b5d4b66acf172762aba72f01e424bf9c0b90` |
| Tree | `4fba27f0de68963a0da60debb8ced17fe3abd1e8` |
| Pai | `a43883c930cf996472b27c524aadb4694c13b5a3` |
| Publicação | [PR29](https://github.com/gustavomhss/Orchestra-SF/pull/29), `astra-wp10` → `sf2-stack`; head W2 confirmado por MCP |
| Fonte exclusiva | `/workspace/scratch/cca507855f4a/analysis/frozen-W2/repo` |
| Manifesto | `analysis/frozen-W2/manifest.json`, SHA-256 `4a2e542c5ba300543a822f8ac45fd0d37e051339054b28ea84219493f9b29063` |
| Integridade | **841/841 hashes correspondem**, manifesto conferido; 105 foreign pins registrados |
| Limites | Builders CLOSED no início; nenhuma escrita de fonte ou remota, nenhum dispatch CI e nenhum teste/build/typecheck/browser local |

R3 não participou das correções de W nem W2. O rascunho de critérios, os informes dos builders e a análise C07 anterior foram tratados como insumos. As correções que o controlador informou ter feito depois desta revisão permanecem fora do lease. A matriz canônica continua com **7 tasks e 171 critérios**: 146 critérios de tasks e 25 axiomas/critérios de WP. Esta rechecagem não declara o conjunto integral satisfeito.

## Disposição dos achados

| Achado | Severidade/owner | Estado W2 |
|---|---|---|
| R3-C11-01 — veto pode devolver ready sem commit | P1 / WP10 | Corrigido na fonte; falta evidência hospedada do candidato aceito |
| R3-LIFE-01 — retenção na falha de admissão | P2 / WP10 | **Aberto**: caso abort/revoke foi corrigido, mas a ordem com autorização vigente ainda bloqueia revogação |
| R3-C07 — rotina sem admission/execution nativos | P1 / Native Task/Relay + WP09 | **Bloqueio externo obrigatório**; indisponibilidade agora está corretamente expressa |
| R3-BCS-TYPE-01 — novo calculation não tipa | P1 / WP10 | **Aberto**, confirmado no check W2 |
| R3-GUARD-01 — logs brutos versionados | P2 / WP10 | **Aberto**, dois gates no check W2 |

### R3-C11-01: correção de fonte reconhecida

Em `apps/cli/src/sucafina-product/analysis-native-inputs.ts:161–197`, cada veto marca `vetoed`. O guard final também marca esse estado se a captura deixou de ser atual. Depois de aguardar `state.transaction`, o wrapper retorna `denied/alternative-publication-vetoed` sempre que houve veto. Portanto, o valor interno `ready` que C08 preserva num preview deixa de escapar como sucesso.

C08 mantém a atomicidade: `product/host-binding/state-provider.ts:134–140` chama o guard final antes de incrementar versões e publicar o estado. O `finally` da composição elimina as permissões privadas do callback e seu guard. O traço estático que originou o finding W deixou de produzir `ok` sem commit.

A regressão em `test/product/wp10/analysis-composition/native-inputs.test.ts:196–250` usa run-store e C08 reais, conserva a autorização UI, revoga apenas o binding nativo depois do trabalho interno e exige `denied` mais snapshot anterior intacto. O controle positivo exige `ready`. Essa é a distinção necessária para reproduzir o defeito original; abortar somente o Request não bastava. **O teste foi lido, não executado no W2.**

Critérios: `WP10.T01.INV.02`, `INV.03`, `CHK.05`; `WP10.T06.CHK.04`, `QLT.60`.

### R3-LIFE-01: residual obrigatório na ordem de cleanup

O novo `try/finally` em `native-execution.ts:74–104` assume ownership de todo `prepare` bem-sucedido e cobre recusa/throw de attach e falha do anúncio. Isso corrige o abandono original quando abort/revoke torna `interrupt` imediatamente negado. `native-host.release` também passou a revogar recursos antes de interromper a Session.

Porém, o finalizador da admissão ainda remove `active` e **aguarda `host.interrupt` na linha 101 antes de chamar `host.release` na 103**. Em `native-host.ts:253–254`, o próprio `interrupt` aguarda `Session.interrupt` antes de `run.release`. O shutdown em `native-execution.ts:229–230` aguarda todos os interrupts antes de iniciar qualquer release. Cancelamento também aguarda essa operação; `releaseRun` pode aguardar `cancelDone`.

**Contraprova:** manter autorização válida, obter preparação real e provocar falha de attach/announcement; manter a interrupção nativa pendente. O finalizador deixa de possuir entrada em `active`, mas ainda retém binding, budget ticket e observação porque a revogação está depois da espera. No shutdown, a primeira barreira de interrupts posterga todos os releases. Isso impede garantir revogação imediata e cleanup limitado no tempo.

Os quatro modos attach/announce da nova regressão, `native-host-disposal.test.ts:143–203`, definem sempre `authorization.allowed=false` na linha 167. Assim, o interrupt é negado imediatamente, cobrindo corretamente o caso original, mas não a ordem com autoridade vigente. O finalizer global do host já revoga antes de esperar; isso não corrige os callers anteriores.

**Correção mínima:** após a autorização pertinente ao cancelamento, separar a revogação host-owned da espera nativa e revogar antes de qualquer `Session.interrupt` pendente. Preservar a interrupção real e as Sessions alheias. Rechecar attach/announce recusado e lançado, shutdown e cancelamento com autorização vigente, interrupção pendente e defeito. O controlador aceitou este finding; o código mutable posterior não foi examinado.

Critérios: `WP10.T06.CHK.04`, `CHK.06`, `QLT.01`, `CMP.01`, `INV.40`.

### R3-C07: seam público correto, execução ainda indisponível

`routine-publication.ts` W2 tem blob `3bc63f611beb36d535fd3ccedd9c5ae846ee4ca5`, idêntico ao publicado em `a43883c9`, conferido independentemente por MCP. A composição usa somente o port público instalado, exige identidade/epoch/provider e revoga wrappers retidos quando estes mudam. A importação privada de Maestro foi eliminada.

Em `host-context.ts:290–293`, nenhum provider `installed` ou port `native` é fornecido e os descritores C07 não são anunciados. Portanto, a ausência aparece como unavailable; não há catálogo ou execução fictícia. Os testes de rotina declaram explicitamente quando a admissão/execução é fixture e não constituem prova GNATIVE.

As APIs nativas foram conferidas novamente em W2: `task.ts`, blob `0e82455ca428e5b498551496bc65bdc0f6551df3`, mantém `requireParent` com assistant task part persistido e input exato; `task-governance.ts`, blob `12173c0769e62212a4a01003a0a253e7d1d1ba38`, não permite substituir checks Task nem publicar eventos Session pelos hooks. O bloqueio não deve ser contornado com Task/assistant part fabricado ou `Session.resume` solto.

O owner Native/Relay e WP09 ainda precisa publicar o adapter governado com binding de principal/project/case/input/plan/publication, revalidação, index/start e recibos terminal/artifact imutáveis; WP10 o consome. **C07 continua obrigatório.** O ajuste de disponibilidade não fecha 39 rotas, AM02/AM06 ou GNATIVE.

Critérios: `WP10.T01.CHK.03`, `DOD.01`; `WP10.T06.CHK.07`, `CHK.60`, `DOD.60`, `SUC.60`.

### R3-BCS-TYPE-01 e R3-GUARD-01: gates próprios abertos

O check hospedado de W2 registra `TS2339` em `planner-calculation-services.ts(116,162)`: verificar somente a presença de `context` não estreita sua união até um contexto com `sourceRefs`. A correção deve estreitar a projeção explicitamente, conservando recusa para tipos incompatíveis. Um cast que apenas oculta o erro não resolve o contrato. Critérios: `WP10.T04.DOD.01`, `DOD.10`, `CMP.10`; `WP10.T07.DOD.01`.

O sourceguard registra dois gates `agent-scratch` nos arquivos `hosted-round1/job-132293688965.log` e `hosted-round1/job-132293700346.log`, dentro de `docs/sf2h/receipts/WP10/2026-11-14-composition/`. O resultado foi 78 regras, 1093 paths alterados, 2 gates, 35 warnings e exit 1. Remover esses outputs brutos do produto, mantendo rastreabilidade aos runs e artefatos hospedados, é uma correção própria obrigatória. Não alterar guard/allowlist para ocultá-los. Critérios: `WP10.T04.CHK.03`, `DOD.01`, `DOD.40`, `CMP.01`.

## Outros pontos rechecados

**Identidade WP06.** `native-identity.ts:5–11` materializa `workspaceID` e `variant: default` antes de persistência/admission. Provider, model ID e variantes explícitas continuam exatos; `native-host.ts:113–155` mantém comparação estrita da Session criada e a validação das variantes alternativas no catálogo. O token gate compara as mesmas formas normalizadas. A fonte Core foi lida no próprio W2: `session/info.ts`, blob `84e5b70475bc6efb110b11d7a23d6ae6c3c5a207`, produz exatamente o default e workspace explícito. Os negativos de modelo/variant/directory diferentes permanecem. Nenhum novo defeito concreto foi identificado nessa normalização; sua qualificação hospedada ainda está pendente.

**Planner calculation/BCS.** O router agora conecta calculation e continuidade. O adapter usa request original vinculado ao resultado persistido, replay real limitado a refs record, captura por call e fences do snapshot. Verifica ref canônica inteira, engine, request/result digest, fontes, período e moeda; reconsulta resultado/binding e autoridade. `withCalculationCase` exige caso atual, incarnation/version, participação e principal/access/policy atuais, sem recursão pela projeção de casos. O resultado store verifica fontes e caso novamente. Não foi encontrado outro desvio concreto de auth/fences além do erro de tipagem aberto.

O teste de integração usa UI capability, BCS e Atlas real, tamper, revogação e mudança de fonte. Entretanto, coverage e ledger accepted são fixtures declaradas; reopen de store no mesmo teste não equivale por si a restart de processo nem AM05 integral. Nenhum resultado desse teste foi atribuído ao W2.

**C17/Atlas.** O check W2 executou com sucesso geração, `check:generated`, diff dos artefatos gerados, typecheck da boundary e `check:spawn-imports` raiz. Estes gates pertencem ao candidato correto e servem aos critérios estáticos pertinentes. Não foram convertidos em prova runtime/scanner, AST adversarial completo, AM05 ou aceite global. Arquivos Atlas não hidratados não foram declarados ausentes.

## Evidência hospedada e limites do veredito

O [run 43548947850 / job 132306683850](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43548947850/job/132306683850) foi lido via MCP; o job está `completed/failure`. O log `analysis/hosted/job-132306683850.log` identifica checkout e `PRODUCT_SHA` W2 nas linhas 277, 329–342 e 361.

| Gate W2 | Resultado |
|---|---|
| Envelope e SHA exatos | Sucesso |
| Typecheck Sucafina | Falha |
| Typecheck CLI | Falha, incluindo 1 diagnóstico próprio novo |
| Generate/check:generated/diff Atlas | Sucesso |
| Typecheck boundary Atlas | Sucesso |
| Guard subprocess imports | Sucesso; 4642 arquivos, 66 sites permitidos |
| Sourceguard de produto | Falha; 2 gates próprios |
| Unit W2 | Não havia execução no fechamento |

Há 33 diagnósticos TypeScript nesse log atual: um próprio novo e 32 classificados pelo controlador como foreign. Os 32 foram reobservados no W2, não transferidos do predecessor; a triagem detalhada de seus owners não foi encerrada por este parecer. O run `43548294775` pertence ao pai `a43883c9` e não foi usado para qualificar W2.

Os achados devem ser rechecados em **nova lease de SHA imutável**, com evidência hospedada pertinente. Epic, oito seleções finais e AM01–AM06 continuam reservados a S0 após o bundle integrado. Este parecer não declara native/global PASS, todas as 18 skills/39 rotas completas, C15/C16 integral, aceite de C ou entrega D.
