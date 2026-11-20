# HANDOFF — sf-ops-transport

## SHA e estado

- Estado: **PARTIAL — correção concreta pronta, gate Actions pendente**.
- Branch isolada: `sf-ops-transport`.
- SHA de código: `d8c62c802bc420d0e01ed23938070f7f4c8b68de`.
- Árvore de código: `956a7e48e3cd95615d8170a764cb39f967f913f5`.
- Base exata: `fba289d484d0c0ff2463cbc26ab587777516a8db`.
- Fonte Operations: `sf-ops-composed@fc100c76312177213a58a6b73020e587faa52b07`.
- A base contém a UI da Sessão 1 até `f1e8aa1c8b622cb99e6ee5e49bb049fe77264de4`, ingress Reports/Decisions permitido em 4174 e configuração Playwright unificada.
- O commit documental posterior referencia o SHA de código acima. Nenhum teste local, gate, PR ou merge foi executado nesta branch por este trabalho.

## Evidência que motivou o fix

Run Actions [44652946889](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44652946889), attempt 1, snapshot `4617bed5afbfcf4bb0e7e81a2da5a4e025af73cc`, terminou **failure**. Job de testes `136012078239`: failure; cleanup `136017540909`: success. Typecheck E2E e qualificação ClamD passaram.

Os cinco testes Operations atingiram o limite original de 60000 ms. A primeira localização registrada é `packages/app-shell/e2e/sucafina/operations.spec.ts:13:3` (OP-PROC-01); as demais são 18:3, 23:3, 28:3 e 33:3. O log também registra erro secundário de protocolo Playwright, `Object with guid response@… was not bound in the connection`. Não há stack interno nem primeira asserção identificável nesse log: a causa interna dos cinco timeouts continua **unbound**.

Às 01:28:13Z o host registrou `[Bun.serve]: request timed out after 10 seconds`, antes do primeiro timeout do teste. No código congelado:

- `packages/app-shell/e2e/sucafina/wp04/host.ts:66–74` inicia `Bun.serve` sem `idleTimeout`.
- `packages/server/src/handlers/event.ts:68–70` emite o heartbeat SSE real a cada 15 segundos.
- `apps/cli/src/commands/handlers/serve.ts:165–172` serve a composição de produção por `node:http` + `NodeHttpServer`.

O limite ocioso de 10 segundos do transporte WP04 é incompatível com o intervalo de 15 segundos desse stream. Isso é uma diferença concreta a corrigir; ainda não prova que ela seja a única causa dos cinco timeouts.

Artefato de diagnóstico original: `playwright-ubuntu-24.04-1`, id `14591644007`, 2073924 bytes. Digest **do ZIP do artefato**, não de pacote de distribuição: `sha256:2286385ed67a1964407a9ba56b5e822fddbedd40679d8224c60c0ad3381be7d7`. Os traces permanecem privados no artefato; este handoff não inclui corpos, credenciais ou URLs assinadas.

## O que mudou

1. Foram portados os **19 paths de código** de Operations existentes no diff `f732f10592fe00b04ddd8490fd3d0cade5d357d0...fc100c76312177213a58a6b73020e587faa52b07`, com a reconciliação abaixo. Os três documentos antigos dessa composição não foram recopiados como se comprovassem esta nova revisão.
2. Em Requests/forms, somente a conversão numérica de `estAmount` e `estAnnual` foi aplicada sobre a versão f1. Permanecem `onEdit(value, field)`, mensagens por campo, IDs e atributos ARIA da Sessão 1.
3. Em Requests/page, `structuredClone(unwrap(...))` materializa os valores revisados usados tanto no digest como no codec de envio. O fence após o digest compara também o review corrente à cópia materializada. Permanecem os controllers originais, owner/epoch/sourceRevision, CAS, revisão explícita de conflito, rejeição 409/422, operações pendentes exatas e preservação de edições feitas durante o save.
4. Suppliers e Sourcing não conflitam com os commits f732→f1 da base; seus blobs Operations foram preservados integralmente. Requests/model conserva a omissão de propriedades opcionais indefinidas.
5. Em WP04/host, `idleTimeout: 0` remove o corte ocioso incompatível com o SSE nativo. O listener continua em 4174, com a mesma composição, autenticação, origem e lifecycle.
6. No bootstrap Operations, cinco `test.step` com labels estáticos identificam enrollment, discovery, admissão do contexto, seleção do perfil e readiness de Requests. Os labels não contêm conta, caminho privado, URL, token ou payload. Todas as asserções, requisições, limites e ordem de ações permanecem.
7. Nenhum fixture Reports de `7554bb4a476d2e693348462c0fed216ebec4200c` foi copiado. Configuração unificada, ingresso Reports/Decisions, contrato de exports, suites e baselines permanecem os da base.

## Dependência de #393 — não é autorização de merge

A composição de teste contém exatamente os dois blobs de `merge-filecodecs`:

| Path | Blob |
| --- | --- |
| `packages/client/src/sucafina/bindings.ts` | `dcf4229af5745da305906a2c1f7ce42427fd62bd` |
| `packages/client/test/sucafina/files-transport226/source-codecs.test.ts` | `072a58358f4057526a932d0a22981194e7786612` |

O gate fonte `44632446497` é uma evidência histórica de outro SHA. Ele não cria checks no head do PR #393. Esta branch **não pode ser usada para integrar #393 indiretamente** enquanto sua condição explícita de checks success não estiver satisfeita. Nenhum status ou check foi fabricado.

## Readback e inventário

Leitura de retorno no GitHub confirmou:

- diff base→SHA de código com exatamente 20 paths: os 19 Operations mais WP04/host;
- 16 blobs portados idênticos aos de fc100;
- 4 arquivos reconciliados lidos de volta com conteúdo exato;
- parent/merge-base fba289d e apenas um commit de código;
- asserções do bootstrap inalteradas por comparação textual; isso não substitui execução ou typecheck.

| Path | Blob no SHA de código |
| --- | --- |
| `apps/cli/src/sucafina-product/native-ui/procurement.ts` | `f7f9c9bbab4a1011b18a93fef5e9000270f6d3b7` |
| `packages/app-shell/e2e/sucafina/operations-support/documents.ts` | `40ecc44afc88201345dfbb342b1fc61ef9cb7b6c` |
| `packages/app-shell/e2e/sucafina/operations-support/imports.ts` | `9f50ba7e0386d10acd37d8ac7bf703b333be47ba` |
| `packages/app-shell/e2e/sucafina/operations-support/procurement-comparison.ts` | `fd6e1237736ce05dc2e70740d61b96dbad262998` |
| `packages/app-shell/e2e/sucafina/operations-support/procurement-refusal.ts` | `56cd9d2fde5d234b00879434b668051b7f586169` |
| `packages/app-shell/e2e/sucafina/operations-support/procurement-snapshot.ts` | `1ffe483fc7ba069f919f8cc278267feb5db99e72` |
| `packages/app-shell/e2e/sucafina/operations-support/procurement.ts` | `92a104398875e82a09a46b1e86016cbd783f6939` |
| `packages/app-shell/e2e/sucafina/operations-support/runtime.ts` | `aca4d41ece3c6c03b971c4cbf1b88a88a2f8f764` |
| `packages/app-shell/e2e/sucafina/wp04/host.ts` | `3587d5b44c4e94d2243de1b6e2fa0121468d60a4` |
| `packages/app-shell/src/i18n/orchestra-chapters/sf-u14.ts` | `1b5575458e1a521a3114a4b5dcfa0fff580e42e7` |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/forms.tsx` | `e2d01c285bd60ac4a654007aec044bc0dabf54bc` |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/model.ts` | `5907aee669ae44367cc61aa028ca135610e20dd3` |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/page.tsx` | `550574f4f4ff5e9aac9e75d93c7524e4709cb610` |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/sourcing/index.tsx` | `480ab4022424ccbf7c1924890ce5218ba040d2fe` |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/sourcing/model.ts` | `2007f544e5f77e5ccf6439589808a7b1a1bacce2` |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/suppliers/index.tsx` | `b92d3b324e282a9511c349f79ae4f701cd1e8b2c` |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/suppliers/model.ts` | `6536b7cf8bcb72b09a87a922f0168d38a9098017` |
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/attachments/bound-assets.tsx` | `fcd382816615d1aeaf67585805903863fadb7e58` |
| `packages/client/src/sucafina/bindings.ts` | `dcf4229af5745da305906a2c1f7ce42427fd62bd` |
| `packages/client/test/sucafina/files-transport226/source-codecs.test.ts` | `072a58358f4057526a932d0a22981194e7786612` |

## Qualificação e integração

- Novo gate Operations: **não executado**; continua pendente.
- Guards deste SHA: **não executados**.
- `sf-ci`: **não executado** por este trabalho; continua reservado para a única corrida final após todas as integrações.
- Baseline/artefato de corrida completa: nenhum novo neste trabalho.
- Pacote e SHA256 de arquivo de distribuição: nenhum novo neste trabalho.
- Ordem de merges: nenhuma; esta branch é apenas uma composição isolada para qualificação.
- Nenhuma condição de COMPLETE, GO, deploy ou pacote verificado é afirmada.

## Como retomar

1. Confirmar o HEAD documental e usar o SHA de código acima para revisão do diff. Não sobrescrever as melhorias posteriores de Requests/CAS nem a configuração unificada da base.
2. O integrador pode preparar um snapshot novo do gate existente de `operations.spec.ts` contendo esta correção concreta, sem `[skip ci]` no commit do snapshot e respeitando o limite global de dois gates. Não repetir o snapshot 4617 sem mudança.
3. Ler o resultado real, começando pelas novas etapas do bootstrap. Um timeout após o fix deve ser registrado com sua etapa e stack efetivamente produzidos, sem concluir que o erro de GUID seja a causa.
4. Manter #393 aberto até cumprir sua condição própria. Um gate verde desta composição não autoriza merge indireto dos seus blobs.
5. Somente após sucesso real e handoff correspondente considerar a integração elegível na ordem da Sessão 5; os demais gates, guards, corrida completa e pacote permanecem sob coordenação do integrador.
