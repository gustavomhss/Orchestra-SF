# Handoff — finish-reviewtests-20261119

SHA: fd505266c992cbc0864bdbade02917ec0f3b553d (código); base ab9c515abee460c294bd061c99f41dbd0064fdf6.
Data: 2026-11-19
Estado: partial

## Feito
- review-port.test.ts e projection-access.test.ts retêm o mesmo Request admitido durante cada fixture/jornada. A produção compara a identidade por referência antes e depois de awaits; criar um Request em cada callback invalidava a leitura protegida.
- domain-outcome.test.ts usa o mesmo Request autenticado da fixture para o produtor real do Planner, case port e registro C08. Os Requests próprios das provas de corrida continuam distintos.
- Nenhuma regra do produtor nem asserção removida. Download autenticado continua com authority.requestFor(context); negativa sem Request permanece sem Request.

## Pendente
- modules/sucafina/Sucafinav1/test/product/wp07/review-port.test.ts:80 — aguarda gate após corrigir identidade; run anterior negava preservação.
- modules/sucafina/Sucafinav1/test/product/wp07/projection-access.test.ts:47 — aguarda gate de releitura/revogação.
- modules/sucafina/Sucafinav1/test/product/wp14/domain-outcome.test.ts:66 — aguarda gate de seleção original C08.
- comment-continuity.test.ts:100 e review-thread-context.test.ts:151 são tratados em outra fatia, sem sobrepor.

## Decisões e justificativas
- Request original por fixture, sem cache de autorização entre chamadas, bypass de source fence, timeout maior ou alteração de baseline.
- Asserções removidas: nenhuma.

## Como retomar
Executar test-ci com runner bun, package sucafina e os três specs alterados. Registrar o run e só então integrar.

## Comandos e resultados
- Auditoria anterior 44581783913, snapshot 64dccec8da78d769d15e955aeb5981104da6e2ec: FAILURE; 21 pass, 7 fail, 297 expectativas em seis specs. Não qualifica esta correção.
- Gate desta correção: pendente.

### Diagnóstico do primeiro gate
- Run44584118437 / snapshot127c5350adf27a7a1332c4f152a9bb52f40f61c4: FAILURE, 20 pass / 3 fail / 354 expectativas. domain-outcome e projection-access passaram. Restaram três provas em review-port que usavam o mesmo callback para admissão da sessão e revogação de fontes; o fallback revalidate(binding,[]) produzia binding-unavailable e um lote vazio legítimo.
- A fixture agora declara revalidateReadAccess separadamente. Fontes/seções/comentários continuam sujeitos a seus controles originais; nenhuma asserção existente removida. Foi acrescentada prova explícita de revogação do binding com reason binding-unavailable e recuperação autorizada, além das negativas de fonte já existentes.
