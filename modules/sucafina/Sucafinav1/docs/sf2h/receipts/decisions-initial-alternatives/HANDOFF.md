# Missão 20 — handoff terminal

## Estado entregue

**Código publicado na branch `astra-wp11`, PR40. Recorte de implementação encerrado com consumidor explícito; jornada nominal BLOCKED / NOT_RUN.** Os testes próprios passaram no GitHub Actions. Os checks obrigatórios foram executados e continuam em FAILURE pelos diagnósticos herdados descritos abaixo. Não há aceite integral de WP11, execução financeira, provider/native ou AM.

- Missão: `11ae11f1f470a405be954f050ff0ba5d8a536e5b:modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-wave/decisions-initial-alternatives.json`.
- Planejamento imutável: `dbf9547211d9b0fade619790de7c19c0869b7c7d`; START, WORKFLOW, execution/COMMON, pack completo S4-A e anexos obrigatórios lidos. AGENTS aplicáveis e guardrail-usage foram observados. Pins de leitura estão em `INPUTS.json`.
- Lease deste recorte: `browser-decisions-continuation-20`; writer termina sem autoridade órfã ou execução delegada em andamento. Sessão14 integra; S0 mantém o dispatcher final e o aceite da campanha.
- Reconciliação inicial: o head observado `8645fadbce014ce870e3485ae1de6cf7d76bf1c3` estava vigente. O handoff predecessor `final-e2e/decisions/attempt-01/HANDOFF.md`, blob `6fbf52018824f3d95db9f727eb42096ae8d7a50a`, foi preservado.
- Operações remotas exclusivamente por GitHub MCP. Sem testes/servidores locais, merge de branches, push/force push, edição de engines, deploy ou reinício.

## Commits e fonte verificável

| Nome | Commit | Tree | Conteúdo |
| --- | --- | --- | --- |
| W | `0fb6101c2804e8d8e2fa352ca5d09b554a7fd435` | `fd1de72c787dd9d3d87db86110781d1f158547e5` | Implementação, testes próprios, extensão do E2E e recibos iniciais; 17 paths autorizados |
| W2 | `69624adad312ef27f83310896e7c0b6005eec624` | `c16708b9054b9e097f65827fc0ae921da72962c9` | Dois comentários explicando fallbacks seguros de storage; nenhuma mudança de comportamento |
| R | Commit que contém este handoff | Derivada de W2 | Apenas recibos finais; o SHA é registrado na PR e na entrega |

W tem como único pai o head inicial; W2 tem como único pai W. A publicação usa atualização não forçada com `expected_sha`. Não há incorporação de branch inteira. `PRODUCT.json` registra todos os 17 blobs de W e o blob substituto em W2.

Blobs atuais de produto/teste para consumo:

| Path | Blob |
| --- | --- |
| `modules/sucafina/Sucafinav1/product/ui/decision-edit.ts` | `27bb8adbf3ca2fefce4bc8c756de7f12ce990baa` |
| `modules/sucafina/Sucafinav1/product/ui/decision-alternatives.ts` | `a731b36427ffbdbc30d19b3b7785be16e5c9747d` |
| `modules/sucafina/Sucafinav1/test/product/decisions-initial-alternatives/forms.test.ts` | `aad4ce77254f195285e086371c06bae79744cbba` |
| `modules/sucafina/Sucafinav1/test/product/decisions-initial-alternatives/intention.test.ts` | `e1badb81f98aaa81d8e1caefa905eb97326ca758` |
| `packages/app-shell/e2e/sucafina/decisions.spec.ts` | `a2515c40a71728299b0e9303168b6d822f2ba338` |
| `packages/app-shell/e2e/sucafina/decisions-support/planner-sources.ts` | `72b6c14d762b17a9b70398bdcfd3b5c4ec877559` |
| `packages/app-shell/e2e/sucafina/decisions-support/initial-alternatives.ts` | `72471e276be8a95f499b4b4693c5a283772a2df3` |
| `packages/app-shell/e2e/sucafina/decisions-support/alternative-response.ts` | `7e7122698568a4ced5aed789a4d2ac743cd6db2c` |

Todos os demais arquivos desta entrega ficam em `docs/sf2h/receipts/decisions-initial-alternatives/`. Os três testes anteriores permanecem com corpos idênticos: o spec recebeu 10 linhas adicionadas e zero removidas. Os 83 critérios e seus campos/proof_bindings históricos foram preservados literalmente; os campos da missão20 são aditivos.

## Comportamento implementado

### Evidência autorizada e edição

A pessoa descobre versões Planner no leitor existente `bi-options`, inspeciona sua projeção pelo `bi-data` e anexa uma evidência visível ao rascunho. A referência completa vem da projeção autorizada e de seu drilldown; não existe campo para colar referência interna ou JSON. A gravação usa `decision-edit`.

O editor valida identidade/encarnação, emissão da referência, digest, autoridade corrente, horizonte e moeda. Conserva as referências atuais e as novas adições; revalida as novas fontes antes de salvar. A implementação incorpora a semântica de conflito já consumida de PR43: identidade/reordenação de critérios, confirmação de mudanças estruturais, texto de critérios removidos conservado, comparação atual/rascunho, adoção explícita e nova leitura antes de gravar. CAS não é silenciosamente rebaseado.

### Primeiras alternativas e cobertura

O novo módulo consome `decision-controls` para escolher versões Planner já anexadas e correntes. Funciona também quando ainda não existe uma base de cobertura. Mostra as nove categorias canônicas de renovação/transição e as adicionais suportadas, exige motivo explícito para pendência e usa a operação existente `decision-coverage`. A versão esperada zero só é usada após observar ausência real de classificação.

As duas alternativas conservam a mesma base de cobertura, seu ID/versão/conteúdo e referências. O recibo canônico de cobertura é retido, inclusive antes da primeira promoção e após reload da aba. Fontes com classificação existente sem recibo retido ficam bloqueadas quando não há leitura canônica; nenhuma referência é reconstruída por concatenação.

Cada criação exige ação humana, título válido e uma versão real do Planner. `decision-promote` recebe cenário com operações e assumptions vazias; os valores financeiros continuam nos produtores de domínio. O módulo verifica identidade, encarnação, incremento de versão e recibo retornado. Não cria fórmula financeira nem transforma a criação/seleção de alternativa em aprovação financeira.

### Resultado incerto, CAS e acesso

A intenção retida contém ação, chave, corpo JSON exato, alvo e versão. Seu escopo inclui instalação, projeto, principal, caso e encarnação. Ela é persistida antes do POST, com orçamento de 262144 bytes UTF-8; a UI marca confirmação incerta antes de aguardar a resposta. Timeout/transporte não gera retry automático.

O retry explícito reutiliza os mesmos bytes e a mesma chave, sem permitir nova intenção concorrente nos formulários Edit/Alternatives. Uma rejeição definitiva da primeira tentativa pode permitir correção; uma intenção que já ficou incerta permanece preservada. Conflito de edição exige comparação e adoção explícita. Revogação remove o conteúdo protegido e os buffers próprios e impede novas gravações.

Há uma limitação real do produtor de cobertura: ele não aceita replay de CAS histórico. A resposta específica `403 / case-selection-unavailable` após avanço concorrente é distinguida de revogação somente mediante nova leitura autorizada e vinculada à fonte. Conflito confirmado conserva a intenção; verificação inconclusiva coloca a intenção em quarentena e oferece somente rechecagem GET. A UI nunca resolve esse caso trocando chave, versão ou payload.

## E2E nominal preparado e limite de prova

O quarto teste usa a instalação real e a UI Planner para criar/copiar versões, editar OPEX, descobrir/inspecionar/anexar fontes, salvar o caso, registrar cobertura pendente e criar duas alternativas. Os identificadores vêm do DOM/retornos reais. Nenhum seed, POST direto do teste, aplicação substituta ou referência interna colada prepara a jornada.

O helper de perda de resposta intercepta a resposta original da segunda promoção no estágio Response do CDP, após o handler real. O retry ocorre pelo botão da UI. As assertions exigem igualdade da chave/corpo completos, mesma identidade e exatamente duas alternativas ao final. O teste reabre o caso e consome as alternativas pelos controles existentes de comparação e catálogo de portfólio.

O exemplo verifica 100/200 USD mensais e 1200/2400 USD anuais, horizonte 2027. A diferença conhecida de 1200 continua condicionada; total/diferença completos ausentes e regras de critérios desconhecidas permanecem ausentes/desconhecidos. Isso não substitui os oracles numéricos canônicos do pack. Reload não prova reinício do provider. Catálogo não prova execução de portfólio. A perda de resposta de promoção não é C12/AM04.

**Esse E2E não foi executado.** A montagem real publicada ainda não contém o módulo, seu mount ou os novos testes. O envelope cirúrgico está em `nominal-request-not-dispatched.json`, seleciona somente `e2e/sucafina/decisions.spec.ts` com os quatro testes e permanece não despachado. Não foi repetido o bootstrap histórico da árvore antiga.

## Provas de Actions

| Seleção | Fonte | Resultado observado |
| --- | --- | --- |
| Unit: dois arquivos próprios | W; snapshot S `11a8f1a7e9168b7c127e22c24510298f9bd2c9bb` | **11 pass, 0 fail, 56 expect calls** |
| Checks tentativa1 | W | **FAILURE**: 130 diagnósticos TypeScript, 43 GATE, 19 WARN, 0 ERROR do guard runner |
| Checks tentativa2 | W2 | **FAILURE**: 130 diagnósticos TypeScript, 43 GATE, 17 WARN, 0 ERROR do guard runner |
| E2E Decisions | Consumidor real ainda incompleto | **BLOCKED_NOT_RUN** |
| Typecheck app/E2E | Lane não coberta pelo workflow WP11 existente | **NOT_RUN**, pendente de consumidor autorizado |

### Unit

[Run43638150264](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43638150264), job `132579438109`, Bun1.3.14. S tem tree `4b3d9328a79e3c6bb7ff20b9d9b29553fe68de44`; W→S altera somente `.ci-run.json`. O request exato tem blob `0f92f9b5f2e7cf128c7e1bf2ee09c38b4ea51cf2` e SHA256 `d23fef67bd68d842eede8f3605dca0f10c223003c7195bf69d0b440a1aedbcf3`. Validação do request e seleção foram conferidas. A limpeza da branch temporária concluiu.

As provas cobrem imutabilidade/serialização da intenção, null/zero/ausência/unidades, limite UTF-8, scoping de autoridade/identidade, inventário, escaping e parse dos inicializadores JS efetivamente emitidos. Parse por Bun.Transpiler não é interação de navegador. O positive control Omni foi explicitamente não aplicável ao recorte; nenhum spawn foi declarado ou aceito. `unit-observed.json` contém os resultados exatos.

W2 altera apenas dois comentários dentro do script. A comparação do conteúdo, removendo somente esses comentários, é idêntica a W. A execução unit permanece vinculada a W e não é apresentada como uma execução literal em W2. Não foi repetida sem motivo.

### Typecheck e guards

[Run43638419373](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43638419373) e [run43638810623](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43638810623) usaram o workflow existente `astra-wp11-check.yml`, blob `3b361b6b22c7c5628d6b149321f73934ea5f9a84`. Executaram `bun typecheck` em `modules/sucafina` e `bun run check:guards --base origin/dev` na raiz. Não houve alteração de configuração.

Os 130 diagnósticos de W2 têm os mesmos sites e mensagens completas que W. Frente ao baseline histórico do run43632969810, são os mesmos 130 sites/códigos: 128 mensagens completas iguais e duas representações diferentes de tipos anônimos nos mesmos sites TS2345, em fontes com blobs inalterados. Nenhum site TypeScript novo aparece nos arquivos da missão20.

Os guards examinaram 78 regras/1044 paths. Os 43 gates são os mesmos `agent-scratch` sobre recibos históricos `.log`; esses arquivos não foram apagados nem ignorados. As 16 warnings herdadas persistem. W havia introduzido duas warnings de catch vazio e uma de timeout; os dois catches agora documentam o fallback de storage e as respectivas warnings desapareceram. Permanece uma warning própria em `decisions.spec.ts:11`: orçamento de 180000ms, igual ao dos testes anteriores, não sleep nem retry automático. O aviso é registrado, sem mudar fixtures ou limites apenas para escondê-lo.

O artefato final é `14131153108`, 8506 bytes, SHA256 `ad6421e11afad13a8ad8273ff88afaaca6fd449cc240913106eca150a96d08dc`; job `132581485723`. Upload concluído de três arquivos. Os recibos `checks-attempt-01.json` e `checks-attempt-02.json` registram as comparações e os pins completos. As falhas herdadas continuam bloqueios; não são convertidas em PASS.

Houve uma seleção unit e duas execuções de checks, uma por vez, deduplicadas. A segunda foi motivada exclusivamente pela correção das duas warnings próprias. Não há request de E2E despachado ou execução desta missão aguardando resultado.

## Consumidor real e patch para sessão14

A reconciliação mais recente está em `CONSUMER.json`: `sf2-stack@d81dc320a82044009dd4c39f2e5d062ad46719a9`, tree `72d2a3c443233017dec3820d1a6987c4934e39f6`, observado em 2026-11-14T20:48:20Z. O histórico dos avanços foi preservado. O novo intake C12/Finance foi examinado; ele não contém a missão20 e não altera as assinaturas/DTOs de promote, coverage ou controls consumidas aqui. Deve ser preservado, inclusive o Apply atual `a182c632c1714e3c48e6be07142adc7ed87d8f13`. O Apply anterior `2e6c081ad2a5282654707f7fc7278183e7dfb20d` consta nos recibos iniciais como proveniência histórica; não é instrução de rollback.

O HTTP continua no blob `81b7cd4ef5a73670642df42a2f891b9d95420dac`; Alternatives está ausente. Edit e spec continuam nos blobs anteriores. Isso bloqueia a jornada real. Não foi criada composição privada para transformar ausência de montagem em prova.

### Mount obrigatório

`integration/http-mount.patch` contém apenas três inserções precisas: import, formulário após Edit e inicializador após Edit. `integration/http-mount.json` registra os anchors exatos e exige uma ocorrência de cada um.

- Preimage HTTP: `81b7cd4ef5a73670642df42a2f891b9d95420dac`.
- Patch SHA256: `5a78be112c6951cf3926a32862d3c55331e0bfcb75245a505651923604467f6b`.
- Blob resultante: `406187a4fe4e6f59a2cca5dc84c83758a063cd3a`.

A sessão14 deve consumir os blobs de produto/testes atuais, reconciliar qualquer delta posterior e aplicar somente essas inserções no HTTP corrente, preservando Apply/Choice/Work/Sourcing/Analysis, CSP e autorização. O arquivo compartilhado não foi editado por esta missão.

### Leitura canônica opcional

`integration/coverage-read.patch` é uma proposta separada para o produtor, não código aplicado. Acrescenta uma leitura opcional `forecast.coverage` usando o resolvedor canônico existente, no mesmo port autorizado; não introduz endpoint, mutação ou cálculo.

- Preimage `apps/cli/src/sucafina-product/decision-controls.ts`: `77563520dbfa9cab5876c0312eba294cb579e11d`.
- Patch SHA256: `0a7fdb20441a98a5d5564c74dedc038afad6f8033193d0b5d30572fc36237689`.
- Blob resultante proposto: `5a348c62d4e247db0f7ecaddaedc041177604d15`.

A jornada nova pode usar o recibo retornado e retido da classificação. Reabrir classificação preexistente sem recibo exige esse leitor ou outro produtor autorizado equivalente; a UI bloqueia até lá. Esta proposta foi inspecionada estaticamente e ainda precisa de composição/typecheck pelo owner. Ela não resolve o replay de coverage com CAS histórico.

### Reuso da correção PR29

A correção publicada `6cf5d78ba412f97aa4dd8648bfec340a27060d3b` foi rastreada pelo input `a00ba2a55190e9ee1fe52fa3030a9cc297b2825a` e pelo head observado PR29 `ab511e9ab2dcb0f64b34bea944533cdbf7ed98e7`. O consumidor já contém os produtores compatíveis do incremento02. Não se atribui ao consumidor atual o erro histórico `Profile policy mismatch: sf_portfolio`.

Profile `744918076fa510339a3216487da8f59b06fe45e8`, manifesto `453c6f3a5b48c081223909af8293f854ad31d7c8` e sourceDigest `249ec91f7d1a76fef83c4408795b66953589d3b3f45e91c64ca691c60c8c2b83` permanecem sem relaxamento. A proveniência dos demais produtores e intake aceito está em `INPUTS.json` e `CONSUMER.json`. Nenhuma correção concorrente de bootstrap foi criada.

## Critérios e pendências com dono

`criteria.json` mantém os 83 critérios. A missão20 liga assertions estáticas de fragmentos a 23 critérios; os outros 60 permanecem fora deste fragmento. **Zero critérios receberam aceite de execução desta missão.** O texto literal restante, proof_bindings, dependências e histórico continuam presentes.

| Item | Consumidor | Condição para fechamento |
| --- | --- | --- |
| D-INITIAL-ALTERNATIVES-ASSEMBLY | Sessão14 | Consumir os blobs exatos atuais e mount HTTP mínimo, preservando o Apply corrente |
| D-REGISTERED-COVERAGE-READ | Sessão14 / produtor Decisions | Compor leitor canônico se necessário para cobertura preexistente sem recibo retido |
| D-COVERAGE-RETRY-AFTER-CAS | Produtor Decisions com autoridade de host | Resolver separadamente a limitação de replay histórico; até lá manter intenção congelada/conflito/quarentena |
| D-CONSUMER-CAS-REGRESSION | Sessão14 | Validar a combinação do editor com o teste existente `wp01/decision-conflict-recovery.test.ts` do consumidor, sem mudança de fixture |
| D-APP-E2E-TYPECHECK | Owner autorizado de checks | Executar typecheck adequado ao app/E2E numa lane autorizada; o workflow existente usado aqui não o cobre |
| D-NOMINAL-DECISIONS | Sessão14 / S0 dispatcher | Após composição publicada, executar a única seleção nominal preparada e inspecionar UI, persistência, retry e catálogo reais |
| Typecheck/guards herdados | Owners dos paths indicados nos recibos | Resolver os 130 diagnósticos e 43 gates sem apagar evidência histórica ou alterar política para esconder falhas |
| Aceite WP11/provider/native/AM | S0 e consumidores definidos pelo pack | Executar provas próprias restantes; nenhuma equivalência ou dispensa concedida por esta entrega |

Este é o handoff terminal do writer da missão20: código e patch consumíveis entregues, validação cirúrgica observada e bloqueios atribuídos. A missão de produto permanece sem aceite da jornada enquanto a montagem e sua execução real não ocorrerem.
