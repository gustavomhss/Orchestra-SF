# Revisão adversarial — PR #240

**Escopo e proveniência.** Revisão do diff do PR #240 (`close-tests-fixes` → `close-final-candidate`, 11 arquivos) e dos trechos de origem na head `close-tests-fixes`. **UNVERIFIED:** execução de typecheck, testes, CI, funcionamento em VM Azure/Web/Microsoft auth e compatibilidade integral com consumidores não percorridos. A descrição do PR declara que nenhum teste/build foi executado; o diff não contém arquivos do cliente web ou schemas de produção.

## O que muda (≤5 pontos)
- Redireciona tipos Playwright do driver desktop a um reexport tipado no workspace E2E (`apps/desktop/test/sucafina-bootstrap213/d01-packaged-driver.ts:7`; `packages/app-shell/e2e/sucafina/native/integrated-proofs/d01/playwright-types.ts:1-2`).
- Troca restrições genéricas dos decoders dos testes de memória, operações e reviews por `Schema.Schema<A>` com cast `Schema.Decoder<A>` (`memory.test.ts:14-17`; `operations.test.ts:37-39`; `reviews.test.ts:21-23`, todos sob `modules/sucafina/Sucafinav1/test/native-ui-contract/`).
- Preserva IDs de eventos de commit via guarda explícita e adapta um ID nominal de fase (`modules/sucafina/Sucafinav1/test/product/integrated-proofs/am05/sequence-integrity216.test.ts:114-119`; `modules/sucafina/Sucafinav1/test/product/native-phase-bridge/native-fixture.ts:132-134`).
- Amplia tipos auxiliares de seleção E2E, mas mantém specs U39/U40 restritos à entrada (`packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts:15-24,224-231`).
- Extrai guard JSON e lança asserts de união artificial CAP04/CAP05 nos testes E2E (`packages/app-shell/e2e/sucafina/native/integrated-proofs/d01/packaged-electron.spec.ts:27-30,162-170`; `packages/app-shell/e2e/sucafina/native/journeys/u39.spec.ts:12`; `u40.spec.ts:12`).

## Auditoria arquivo a arquivo

| Arquivo tocado (paths relativos ao repo) | Veredicto | Evidência / ressalva |
| --- | --- | --- |
| `apps/desktop/test/sucafina-bootstrap213/d01-packaged-driver.ts` | **Correção real provável** | L7: import type muda para bridge E2E; não altera chamadas nem asserts. Resolução do módulo em todos os tsconfigs: **UNVERIFIED**. |
| `modules/sucafina/Sucafinav1/test/native-ui-contract/memory.test.ts` | **Correção parcial, type assertion não comprovada** | L14-17: `Schema.Schema<A>` é convertido por cast em `Schema.Decoder<A>`, descartando a prova estática da restrição original sem serviços; L22-48,114,139: `as const` fixa literals; L97-105,110-125,140-145: asserts positivos/negativos permanecem no arquivo. Não é `as any` nem bypass do decoder em runtime, mas a justificativa "service-free" não é provada pela assinatura. |
| `modules/sucafina/Sucafinav1/test/native-ui-contract/operations.test.ts` | **Correção parcial, mesma objeção** | L37-39: cast tipado de `Schema.Schema<A>` para `Schema.Decoder<A>`; `onExcessProperty: "error"` é preservado. Nenhum `.skip` no hunk modificado. |
| `modules/sucafina/Sucafinav1/test/native-ui-contract/reviews.test.ts` | **Correção parcial, mesma objeção** | L21-23: mesmo cast; `decodeUnknownOption` permanece. Ausência de alterações em outros asserts segundo diff; comportamento completo: **UNVERIFIED**. |
| `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am05/sequence-integrity216.test.ts` | **Correção real, mais estrita** | L114-119: IDs devem existir ou há `throw`; comparação de sequência conserva ambas as posições. |
| `modules/sucafina/Sucafinav1/test/product/native-phase-bridge/native-fixture.ts` | **Correção real provável** | L88-90 cria/publica o mesmo `plan.id`; L132-134 converte esse ID ao tipo branded para o binding. Validade semântica do brand em outros consumidores: **UNVERIFIED**. |
| `packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts` | **Alargamento de tipagem, não de gate runtime observado** | L15-24 adiciona casos na união mas `specs.U39/U40.cases` continuam `["entry"]`; L224-231 rejeita seleção que não corresponda exatamente aos casos declarados. L217-220 aceita `NativeActor` para staleEditor, porém L279-290 exige segundo contexto, exclui requester/denied, e consulta autorização real. Contrato dos consumidores: **UNVERIFIED**. |
| `packages/app-shell/e2e/sucafina/native/integrated-proofs/d01/packaged-electron.spec.ts` | **Correção real** | L27-30 cria predicado não-null, object, não-array; L162-170 protege `body`, `value`, `stamp` antes de comparar principal/política/revisão. Mesmas verificações que o trecho removido. |
| `packages/app-shell/e2e/sucafina/native/integrated-proofs/d01/playwright-types.ts` | **Correção real provável** | L1-2: reexport exclusivo de types, sem comportamento runtime; resolução de dependência: **UNVERIFIED**. |
| `packages/app-shell/e2e/sucafina/native/journeys/u39.spec.ts` | **Amolecimento do sinal de tipo (não runtime)** | L12 faz literal CAP04 parecer union CAP04/CAP05; L25-59 e L665-670 ainda verificam admissão/seleção. Comparações de ramo oposto passam pelo typecheck sem demonstrar possibilidade real. |
| `packages/app-shell/e2e/sucafina/native/journeys/u40.spec.ts` | **Amolecimento do sinal de tipo (não runtime)** | L12 faz literal CAP05 parecer union CAP04/CAP05; L25-59 e L665-670 ainda verificam admissão/seleção. Mesmo problema de tipo artificial. |

## Achados por severidade

**BLOCKER:** Nenhum bypass runtime, assert removido, `.skip` adicionado ou gate de CI silenciado foi identificado no diff de 11 arquivos. A execução dos gates continua **UNVERIFIED**; não confundir ausência de bypass no diff com validação verde.

**MAJOR — afirmações de tipos não justificadas:** `u39.spec.ts:12` e `u40.spec.ts:12` usam `as "CAP04" | "CAP05"` apesar de cada módulo conhecer seu literal. Isso não muda valor runtime nem permissão, mas mascara controle de fluxo impossível para satisfazer o compilador. Antes de merge, preferir compartilhamento de lógica com parâmetro realmente union ou especializar branches sem alegar valores impossíveis.

**MAJOR — contrato decoder perdeu garantia estática:** `modules/sucafina/Sucafinav1/test/native-ui-contract/memory.test.ts:14-17`, `operations.test.ts:37-39` e `reviews.test.ts:21-23` adotam conversão direta para `Schema.Decoder<A>`. Embora mantenha decodificação runtime, a assinatura não prova ausência de requisitos de Context/serviços; justificar com as definições exatas dos schemas ou restringir o helper ao decoder efetivamente sem requisitos. **UNVERIFIED:** as assinaturas exatas da biblioteca Effect e todos os tipos inferidos nos consumidores.

**MINOR — cobertura aparente maior que a provisionada:** `packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts:15-24` declara novos casos sem provisioná-los em U39/U40; L224-231 ainda exige somente `entry`. Não tratar a união ampliada como prova E2E para `empty/source/readonly/revoked/late`. `u39.spec.ts:665-670` exige seleção real; cenários sem seleção falham explicitamente.

**MINOR — status de CI:** declaração do PR #240 de que não executou testes/typecheck; **UNVERIFIED** green status para os 11 arquivos e para os consumidores de `packages/client`, `packages/schema`, app-shell e workspace Sucafinav1. O diff analisado não altera contrato de produção, mas isso não comprova integridade do release Azure VM + Web.

## Veredicto

**CHANGES REQUIRED; não merge as-is.** (X) Eliminar casts de união artificial em `u39.spec.ts:12` e `u40.spec.ts:12` sem perder branches aplicáveis; (Y) estabelecer uma assinatura segura para os helpers decoder em `memory.test.ts:14-17`, `operations.test.ts:37-39`, `reviews.test.ts:21-23`, ou documentar/verificar por tipos seus requisitos reais; (Z) executar os gates de typecheck e suites pertinentes, incluindo consumidores Web/Azure, antes de aceitar. Não há evidência neste diff de skip, substituição de asserções por tolerância a `undefined` ou alteração dos gates; a confiança final depende da validação marcada **UNVERIFIED**.
