# Preparação executável das provas nativas AM01–AM06

Estado da entrega: **PREPARED_NOT_RUN / NEEDS_HOST**. Este diretório prepara entradas, verifica pré-requisitos, vincula uma chamada ao host instalado e valida a completude de capturas. Nenhum comando da CLI declara aceite AM, concede autoridade, escolhe um provider substituto ou dispara a suíte epic. A execução final exige o mesmo candidato **C aceito por S0** e instalado no host.

## Fontes e escopo

| Fonte | Pin imutável |
| --- | --- |
| Missão, COMMON e definições publicadas | `c708ec0609dbfc95b259707d8c38481617f74f11` |
| Pack completo S0-B | `dbf9547211d9b0fade619790de7c19c0869b7c7d` |
| Baseline de código dos contratos de aceite | `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf` |
| PR20 reconciliada antes desta preparação | `0a5ce33012d008af1f56d11596a1f1f4eaba5b9d` |
| WP10, pin da missão | `90f2c4f81f74edc26a1783bfda7891638b429fa6` |
| WP10, head também inspecionada | `54317229d7f8fcb7e92921c2f4a8dc6f9310270b` |
| WP12, harness e seletores | `ba27411a7cda9301aa162680a94153a5e643be4d` |
| WP14, Atlas/scanner/retomada | `f8031d7c54ec2fa06359156dc0b6462c3a248633` |

`pinned-am-proofs.json` conserva os bytes da fonte publicada. `coverage.json` conserva as **duas camadas** de definições: seis provas de execução e seis de aceite residente. Não indexar essas 12 entradas somente por ID AM: isso descartaria uma camada. Perfis, skills, packs, rotas, positivos, negativos, consumidores, política de bundle, aliases, UI residente, interfaces, gates e regras de contexto estão preservados. `campaign_evidence` conserva também o envelope original de evidência do S0-B, incluindo seus 48 campos e a regra de não aplicabilidade justificada.

Todos os arquivos novos pertencem aos três namespaces da missão. Hosts, runtime, fontes de sessões, engines, configuração de CI e branch de integração não são alterados. Os paths históricos de recibos dentro das definições são referências de contrato; eles não autorizam escrever fora de `docs/sf2h/receipts/native-acceptance/`.

## Conteúdo utilizável

| Arquivo | Função |
| --- | --- |
| `cli.ts` | `prepare`, `preflight`, `capture-template`, `validate-capture`, `ci-request` |
| `plan.ts` / `schema.ts` | Conferência das duas camadas, cardinalidades, grants declarados e 278 checks canônicos |
| `installed-host.ts` | Adaptador dos serviços instalados, Request autenticado original, coleta e leitores existentes |
| `execution.ts` | Gate commit/tree/C aceito e uma chamada HTTP finita, sem retry automático |
| `capture.ts` / `artifacts.ts` | Completude e vínculos de captura, integridade SHA256, escrita append-only |
| `parity-capture.schema.json` | Shape exato da observação de paridade e mapeamento dos campos ao recibo real |
| `request-inputs.json` | 18 fluxos de skill, 39 entradas de operação, 278 hooks, recursos e campos de recibo |
| `host-requirements.json` | Operação/recurso/owner/evidência para cada capacidade e roteiros AM04/05/06 |
| `reuse-map.json` | 29 fontes existentes, SHA/blob, exports, limites e quatro artefatos Atlas |
| `ci-request.json` | Seleção cirúrgica para o protocolo canônico de CI |
| `test/product/native-acceptance/preparation.test.ts` | Testes de preparação para GitHub Actions; não constituem provas nativas |

O relatório de publicação e as tentativas reais de preparação ficam em `modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-acceptance/`.

## Executar a preparação

Os utilitários independentes foram executados com Node `v24.22.1`. Eles não importam o adaptador instalado em runtime, não iniciam provider e não executam testes de produto. Execute a partir do checkout que será inspecionado:

```bash
node --experimental-strip-types script/sf2h/native-acceptance/cli.ts prepare --root .
node --experimental-strip-types script/sf2h/native-acceptance/cli.ts preflight --root .
node --experimental-strip-types script/sf2h/native-acceptance/cli.ts ci-request --root .
```

`--write` em `prepare`, `preflight` ou `ci-request` acrescenta uma nova pasta de tentativa no namespace de recibos. Não sobrescreve tentativas. `--source-head` aceita um SHA completo e registra a origem declarada pelo operador; não transforma um diretório parcial em checkout completo. O preflight verifica os bytes e blobs dos arquivos que efetivamente encontra.

Quando S0 selecionar um candidato único, `--candidate` aceita seu SHA completo. Isso vincula o plano ao candidato, sem declarar que ele foi aceito:

```bash
node --experimental-strip-types script/sf2h/native-acceptance/cli.ts capture-template --root . --candidate "$SF_PROOF_C_SHA"
node --experimental-strip-types script/sf2h/native-acceptance/cli.ts validate-capture --root . --candidate "$SF_PROOF_C_SHA" --capture "$SF_PROOF_CAPTURE" --evidence-root "$SF_PROOF_ARCHIVE"
```

As três variáveis acima devem apontar para o C e o arquivo/arquivo de evidências reais do owner. O template contém `NOT_RUN`, campos nulos e coleções vazias. Ele não é um recibo. A CLI recusa `--write` para template/captura bruta: credenciais, conteúdo protegido, cookies, Requests e bindings não pertencem aos recibos publicados.

| Saída | Significado |
| --- | --- |
| `PREPARED_NOT_RUN` | Plano íntegro; nenhuma prova executada |
| `NEEDS_HOST` | Uma ou mais capacidades reais não foram observadas |
| `NEEDS_INTEGRATION` | Fontes ausentes ou diferentes das fontes inspecionadas exigem reconciliação |
| `READY_FOR_PREPROOF` | Pré-requisitos observados; não concede aceite final |
| `REQUEST_VALIDATED_NOT_DISPATCHED` | Validadores canônicos aceitaram a seleção de CI; não há run |
| `INCOMPLETE` | Captura incompleta, inconsistente ou evidência inválida |
| `CAPTURE_COMPLETE_PENDING_INDEPENDENT_REVIEW` | Completude estrutural atendida; autenticidade/resultado ainda exigem revisão |

Exit `0` significa preparação/formato válido. Exit `2` significa capacidade ausente, integração pendente, entrada inválida ou captura incompleta. **Nenhum desses exits significa AM PASS.**

## Vincular ao host existente

O owner da instalação fornece em memória `services: () => runtime.services()` e, para o caminho HTTP, `transport.makeRequest` e `transport.send`. São referências à instalação já autenticada. `makeRequest` entrega o Request autorizado original; `send` o passa ao handler completo da aplicação, incluindo as rotas de leitura/output. Não basta chamar isoladamente `productHttp` se a leitura depende do fallback WP01.

O adaptador é importado no ambiente Bun da aplicação existente, onde o helper canônico do produto já funciona. Não criar um segundo runtime para tornar esse import executável. O código reutiliza `digestSfValue`, `SfHostServices`, as autoridades UI/humanas, os leitores de análises e `sessions.collect` do produto.

Fluxo do owner:

1. Resolver `shared.host-placement` e os demais requisitos relevantes com observação real. `preflight({ ..., probe })` aceita um callback de descoberta em memória. JSON salvo ou uma flag `AVAILABLE` não produz Request, serviço, binding ou modelo.
2. Usar `adapter.discover()` para observar `selected`, modelos e serviços disponíveis. Essa descoberta não demonstra execução de skill.
3. Resolver a entrada correspondente em `request-inputs.json`. Cada recurso inclui o vínculo com os IDs de preflight; cada hook inclui `check_id` e o ponteiro para o texto original do critério.
4. Construir uma única descrição com `buildWorkbenchAnalysisRequest` e chamar `executePreparedAnalysisRequest` com commit/tree instalados e modo explícito. Antes de qualquer outra mutação in-process, o owner também deve aplicar `requireExecutionGate`.
5. Coletar recibos/eventos pelo observador privado real e os leitores existentes. `collectSession` exige o binding original do registry. JSON não pode restaurar esse binding.
6. Observar a ação do consumidor no produto após reload e arquivar a evidência autorizada com hash.

O modo `preproof` exige que o commit instalado corresponda ao candidato do plano, mas não é aceite final. O modo `final` exige adicionalmente um `CandidateVerifier` de S0 que resolva o registro real de aceite e confira o mesmo commit/tree. Não existe `--accepted`, `--final`, dispatch epic ou verifier permissivo fornecido por este pacote.

O adaptador usa `ui.admit → dispatch → ui.revalidate → finish`, ou `human.admit → analyses.* → human.authorize → finish`. A autoridade real é revalidada depois dos awaits. A instância do serviço também deve permanecer a mesma. `prepare`, `start` e dispatch consomem sua tentativa mesmo se houver erro; não existe retry automático.

### Fluxo das 18 skills

O endpoint existente é:

```text
POST {origin}{mount}/{dashboard|planner|procurement}?sf=workbench-analysis
```

O Request usa o Origin real, `Content-Type: application/json`, corpo UTF-8 de até 65536 bytes e `Idempotency-Key` do owner com 8–128 caracteres `[A-Za-z0-9._:-]`. Credenciais ficam no mecanismo já instalado.

`choices → prepare → start → read/output` reutiliza os schemas publicados. `start.input.skillInput` deve ser exatamente o valor devolvido por `prepare`; versões, caso, escopo, manifest e modelo vêm da seleção real. `sf-revisar-evidencias` conserva o `authorAnalysis` real (`runRef` e digest), e o handler existente determina a execução independente. Não invocar `analyses.start` diretamente para contornar esse caminho.

O endpoint `choices` inspecionado oferece somente `sf_maestro/sf-enquadrar-decisao` e `sf_finance/sf-explicar-forecast`. As outras 16 duplas precisam de uma oferta existente no produto ou observação real de `SfHostServices.selected`. A presença de 18 descritores no planejamento não autoriza fabricá-los no runtime.

O HTTP público devolve projeções e HTML. `readOutput` in-process, eventos do host, recibos de carga e traces privados precisam demonstrar a contribuição tipada, o modelo efetivo, o provider turn e o consumo da mesma saída persistida. Os dois reviewers usam runs e Sessions distintos do autor, sem histórico de análise compartilhado.

| Perfil | Nome | Witnesses primários AM01 |
| --- | --- | ---: |
| `sf_maestro` | Maestro SF | 4 |
| `sf_finance` | Finance | 4 |
| `sf_procurement` | Compras e Contratos | 4 |
| `sf_portfolio` | Portfólio e Entrega | 4 |
| `sf_reviewer` | Revisor de Decisões | 2 |
| Total | 5 perfis | 18 |

As allowlists integrais incluem skills compartilhadas e permanecem em `coverage.json`; sua soma não representa skills distintas.

### Paridade das 39 operações

Usar o perfil/skill definido na própria rota AM02; ele pode diferir do witness primário AM01. O caminho nativo é o `Tool.dynamic.execute(payload, real Tool.Context)` registrado pela contribuição existente. O caminho MCP é `bridge.call(realContext, operation, payload)`, com initialize/listTools/callTool da bridge privada existente. Não há endpoint MCP público novo.

Cada chamada recebe lease próprio e revalida C16/SkillLoadReceipt/autoridade. Comparar recibos canônicos, entrada, resultado, identidade do handler e revisão de acesso. Operações de leitura podem não produzir `outputRef`; preservar essa ausência. A base/caso é uma observação explícita da seleção/binding real com evidência, não um campo inventado no recibo universal.

Uma chamada a `adapter.dispatch` prova a passagem pela porta UI, mas não demonstra uma ação realizada na interface. Para `uiExposure: exposed`, registrar a ação real e sua evidência. Exige-se pelo menos uma ação de UI por pack e correspondência para cada operação exposta; as internas mantêm consumidor observado. A chamada direta não concedida deve negar sem efeito e sem dados restritos.

| Pack | Operações |
| --- | ---: |
| Performance | 4 |
| Planning | 5 |
| Procurement | 4 |
| Decisions | 5 |
| Collaboration | 5 |
| Documents & Reports | 5 |
| Knowledge / Atlas SF | 5 |
| Routines | 6 |
| Total | 39 |

### AM03–AM06 e controles do owner

| Prova | Checks canônicos | Entrada e evidência que precisam ser reais |
| --- | ---: | --- |
| AM01 | 129 | 5 perfis, 18 cargas/execuções/consumos, falhas discriminantes e reviewers independentes |
| AM02 | 98 | 8 packs, 39 operações, UI/native/MCP, negativos diretos e consumidores |
| AM03 | 12 | Atores autorizados distintos, revogação/ACL, cancelamento, provider e geração reais |
| AM04 | 8 | Escolha preservada, Apply, ledger/idempotência, conflito/parcial e perda após commit |
| AM05 | 19 | Atlas/scanner real, isolamento, commit, restart em processo distinto e quatro artefatos |
| AM06 | 12 | Admissão C07, Relay/Schedule, run/version, retry controlado e retorno ao produto |

Os 278 checks são observações; não exigem 278 execuções. Hooks podem compartilhar uma execução/evidência quando preservam todos os discriminantes e consumidores.

`host-requirements.json.native_request_plans` mantém 7 passos AM04, 13 AM05 e 10 AM06. O owner executa esses passos por controles existentes; o pacote não implementa novos failpoints, engines ou supervisores:

- **AM04:** a perda deve acontecer depois do commit de domínio e antes da reconciliação do caso. Descartar uma resposta HTTP depois de todo o fluxo não reproduz essa condição. Replay de idempotência é uma ação deliberada do roteiro pelo produto e owner autorizados; não contornar a proteção de retry do adaptador criando outra instância.
- **AM05:** scanner exige path, versão e digest do binário real; clean, canary/hit, timeout e ausência precisam ter os efeitos esperados. Restart usa processo isolado do owner, commit anterior observado e recuperação no processo seguinte. Não reiniciar desktop/server ativos. Capturar `business-memory-ports.js`, `business-memory-ports.d.ts`, `native-memory.js`, `native-memory.d.ts`, AST do bundle, aresta externa exata e execução real de `bun run check:spawn-imports` com guard/allowlist intactos.
- **AM06:** a composição `createSfRoutineServices` inspecionada na PR29 não expõe `.native`. Publication/readers não substituem `SfRoutineNativePort`. Registrar o requisito WP10.T01/WP09.T07; ele também bloqueia as seis rotas Routines da AM02. Após integração real, observar admissão, run/version/checks, falhas/retorno, recorrência e deduplicação pelo produto existente.

## Reuso e fronteira de fixtures

O mapa de reuso aponta funções e blobs concretos WP10/WP12/WP14. O adaptador usa os contratos e serviços de produção existentes; o validador de CI importa os validadores canônicos do próprio checkout.

O WP12 `executeWp12NativeMission(context, incoming)` é referência reutilizável quando o owner já dispõe de contexto instalado real. Seu arquivo também importa `bun:test`: não importá-lo para iniciar um runner de produto paralelo. `withWp12NativeMissionHost` fabrica principal/grants/temp host e não pode estabelecer identidade nativa nesta missão. O helper after-reload declara identidade sintética; não relabelar sua saída.

O WP14 inclui cenários Atlas/scanner/restart úteis como contratos e testes de componente, mas o recibo de restart declara `nativeSessionWitness: false`. Manter essa classificação. A existência de código, uma fixture verde ou um transcript não é a prova nativa exigida.

Corpus de negócio sintético, quando autorizado e declarado, é diferente de provider/principal/grant sintético. `fixtureOrRealSource` exige execução `installed-host`, autoridade `existing-authenticated-request`, origem verificável e declaração de dados reais ou corpus de negócio sintético. Essa declaração ainda exige evidência e revisão; ela não autentica funções arbitrárias fornecidas ao adaptador.

## Captura e revisão

`capture-template` lista todos os campos específicos e os 278 checks. O owner acrescenta:

- Seis `proofReceipts`, preservando a união dos campos publicados nas duas camadas.
- 18 `skillExecutions`, com recibo de carga, fonte/message, modelo/contexto/acesso, output persistido e consumidores após reload.
- 39 `operationParity`, com recibos originais, contexto observado, UI real quando exposta, bridge privada e negativo sem concessão.
- Duas `independentReviews`, vinculadas aos runs/Sessions/digests realmente capturados.
- `campaignEvidence`, com `proofId` AM01–AM06 e os 48 campos do envelope do S0-B. O template começa `NOT_RUN`; apenas observação integrada concluída pode receber o status de evidência `PASS`, sem conceder aceite AM. Campo não aplicável usa `{ "notApplicable": true, "reason": "motivo específico" }`; ausência de dado aplicável bloqueia completude.
- `checkResults`, usando `owner_hooks[].check_id`, texto `expected` intacto, resultado discriminante e `evidenceRefs`.

`evidenceRefs` são paths relativos contidos no arquivo de evidências e hashes SHA256. A verificação de hash comprova integridade dos bytes, não autoria ou verdade. Evidência sem ACL/autorização adequada não deve ser publicada. Preservar apenas metadados revisados no namespace próprio; as referências históricas de recibos não ampliam write authority.

Mesmo uma captura completa retorna `nativeAccepted: false`. O aceite exige revisão independente dos resultados e gates da campanha no mesmo C. A revisão estática desta preparação não equivale a uma das três aprovações finais.

## CI, typecheck e limites desta entrega

O `AGENTS.md` exige testes de produto somente em GitHub Actions. A seleção preparada usa `sucafina`, o arquivo específico de teste e `ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER=strict`. `ci-request` importa `validateRequest`, `locateTestPackage` e `omniControlScope` reais e verifica a existência dos arquivos; não há validador substituto.

O protocolo canônico `test:ci` cria um snapshot em `ci-run-*`. A instrução desta missão proíbe outra branch/PR. Portanto a request foi validada, **sem dispatch**; nenhum workflow ou filtro foi alterado para contornar essa restrição. Se a restrição permanecer, o owner deve manter CI `NOT_RUN`. Não executar testes localmente como alternativa.

Nesta sessão não há Bun instalado, nem checkout Git completo para guards contra `origin/dev`. Package typecheck e guards permanecem `NOT_RUN`. A análise sintática por Node, igualdade de dados, hashes, preflight e validação da request são verificações de preparação e não substituem esses gates. Os recibos de tentativa e o handoff registram exatamente o que foi observado.
