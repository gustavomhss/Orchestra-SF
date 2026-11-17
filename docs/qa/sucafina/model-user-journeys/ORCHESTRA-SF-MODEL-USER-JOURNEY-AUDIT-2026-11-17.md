# Orchestra-SF — auditoria das 185 skills como jornadas de usuário-modelo

> Documento de engenharia e QA. Este relatório não atribui `PASS` com base em CI, presença de rota ou narrativa de implementação.

## Identidade da auditoria

| Campo | Valor |
|---|---|
| Repositório | `gustavomhss/Orchestra-SF` |
| SHA auditado | `9fe7524c8549e3a247518cdc54b7ff27d0690919` |
| Data | `2026-11-17` |
| Escopo | 185 skills/stories: 70 primárias, 70 adversariais e 45 E2E multiator |
| Prioridade declarada | 127 P0 e 58 P1 |
| Método | Cada skill foi seguida como um modelo seguiria: entrada → controle visível → operação → persistência/recibo → releitura → contraprova |
| Regra de evidência | CI e testes são evidência auxiliar; não substituem a execução da jornada pelo produto real |

## Veredito executivo

As skills formam uma base forte para uma campanha de QA por agentes, mas **o produto atual não permite executar todas como estão escritas**. O inventário encontrou três classes diferentes de trabalho:

1. jornadas que já possuem caminho estático e devem ser executadas por agentes;
2. jornadas que param antes do runtime por ação, modelo, integração ou navegação ausente;
3. jornadas condicionadas a capability, tenant, VM, fault harness ou política externa.

| Classificação | Stories | Interpretação |
|---|---:|---|
| `STATIC_BLOCKER` | **34** | Seguindo a skill literalmente, o modelo chega a uma ação, estado ou efeito que não existe no produto atual. |
| `KNOWN_PRODUCT_DEFECT` | **8** | O caminho existe, mas há um defeito concreto identificado no código. |
| `STATIC_PARTIAL` | **28** | Uma parte material da jornada existe, porém ao menos uma etapa relevante não fecha. |
| `PATH_PRESENT_RUNTIME_REQUIRED` | **94** | Não foi encontrado blocker estático; a jornada ainda precisa de browser, dados, atores e política reais. |
| `BLOCKED_CAPABILITY` | **13** | A jornada depende de feature não instalada, não promovida ou condicionada a release. |
| `BLOCKED_ENVIRONMENT` | **8** | A conclusão depende de tenant, VM, browser, fault injection, DR ou política do owner. |

### Leitura correta dos números

- Os **34 blockers estáticos** não significam 34 falhas já reproduzidas em produção. Significam que o agente não consegue completar a skill no código atual porque uma etapa requerida não existe.
- As **94 jornadas com caminho presente** não são `PASS`. Elas são o primeiro lote executável e ainda podem falhar por autorização, dados, concorrência, integração ou comportamento do browser.
- Os **8 defeitos concretos** devem ser corrigidos ou explicitamente isolados antes de executar as journeys afetadas.
- Capability ausente deve produzir `BLOCKED_CAPABILITY`, nunca um `PASS` inventado nem um `FAIL` atribuído ao código legado.

## Metodologia

Para cada skill, a análise procurou responder:

1. A rota e a superfície existem e são alcançáveis a partir do contexto descrito?
2. O controle que o usuário precisa clicar ou preencher está presente?
3. O controle chama uma operação real e tipada, e não apenas muda estado visual?
4. A operação preserva owner tuple, principal, policy/access revision, CAS e idempotência?
5. O sucesso é comprovado por releitura, receipt ou projeção do produtor?
6. O caso negativo pode ser executado sem mockar autoridade, relaxar guard ou inferir ausência de commit?
7. A skill pede algo que pertence a outro capítulo sem instruir a navegação e o transporte das referências?

A auditoria foi intencionalmente fail-closed: na ausência de ação, contrato, producer ou ambiente verificável, a story não foi promovida a caminho executável.

## Gaps transversais de maior impacto

### 1. Entrada, trabalho e contexto — `UI29`, `UI30`, `UI67`

- `UI29` não projeta as prioridades, Hot Topics, riscos e forecast com autoria/deadline descritos pelas skills.
- `UI30` aceita cinco tipos de destino no schema, mas a navegação nativa só abre `thread`; `hot-topic`, `procurement-request`, `confirmation` e `signal` não fecham.
- quando existem múltiplas instalações, o shell entra em estado ambíguo, mas não oferece seletor explícito e reautorizado.

Código principal:

- `packages/app-shell/src/orchestra/chapters/sucafina/home/index.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/work/index.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/context/index.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/host/owner-runtime231.tsx`

### 2. Documentos — `UI58`, `UI59`, `UI60`

O fluxo esperado pelas skills é upload/classificação → extração → rejeição ou confirmação humana → uso da evidência no cenário. O código atual só permite descobrir/admitir documento existente, confirmar candidato e gerar preview de cenário.

Faltam:

- cadastro/upload/classificação e vínculo a projeto;
- rejeição persistida do candidato com motivo/página;
- apply/link governado da evidência confirmada ao cenário.

Código principal:

- `packages/app-shell/src/orchestra/chapters/sucafina/documents/index.tsx`
- `packages/schema/src/sucafina/files.ts`

### 3. Decisões — `UI35`, `UI36`, `UI37`

- `UI35` lê e compara alternativas, mas não cria/edita A/B/C nem registra elegibilidade.
- `UI36` é explicitamente read-only e não registra premissas ou divergências.
- `UI37` cria pergunta e seleciona destinatário, mas o destinatário não possui editor para escrever uma resposta nova; a tela apenas prepara/confirma um `answerRef` já existente.

Código principal:

- `packages/app-shell/src/orchestra/chapters/sucafina/decisions/alternatives/index.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/decisions/assumptions/index.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/decisions/questions/index.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/decisions/questions/answer.tsx`

### 4. Agentes e rotinas — `UI65`, `UI70`

- `UI65` lê uma projeção resumida, mas não expõe execução real, output, verifier ou cancelamento.
- `UI70` declara ausência de execution/contribution proof e não permite comparar último run, contribution e decisão humana.

Código principal:

- `packages/app-shell/src/orchestra/chapters/sucafina/routines/runs/index.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/routines/residents/index.tsx`
- `apps/cli/src/sucafina-product/routine-services.ts`

### 5. Dashboard versus Planner — `CAP03`, `CAP04`, `CAP05`

As skills procuram `official`, `WHATIF`, lock e comparação de versões em dashboards de Budget/OPEX/CAPEX que trabalham com dados de Dashboard por ano/mês. A semântica de versão pertence a `CAP17–CAP23`.

A correção preferencial é ajustar as skills para navegar explicitamente Dashboard ↔ Planner/Versions e transportar o `versionRef`, sem inventar que a tela atual possui esse controle.

### 6. Contratos, attachments e exports — `CAP14`, `CAP25`, `UI68`

- `CAP14` edita contrato e exibe documentos read-only, mas não vincula documento, PR e sourcing pela UI.
- a seção de attachments de `CAP25` não possui fluxo de file input/admission/scan/link.
- `UI68` oferece exports genéricos, mas não seleciona um PO/receipt individual como as skills exigem.

### 7. Modelo Planner — `CAP19`, `CAP21`, `CAP22`

- `CAP19` não modela approval state ou investment window do projeto CAPEX.
- `CAP21` representa allocation apenas como `id/name/desc`; não possui percentuais, soma de 100% ou `contractRef`.
- `CAP22` persiste moeda/taxa/revisão, mas não sourceRef, provider ou observedAt para provenance temporal.

### 8. Cross-links executivos — `CAP01`, `CAP02`, `CAP09`, `CAP13`, `CAP15`

As skills esperam criar pauta, relacionar projeto/nota, encaminhar ação e navegar entre risco/stakeholder/Hot Topic. Parte desses capítulos usa texto ou navegação implícita onde deveria transportar refs canônicas e reautorizar o destino.

## Defeitos concretos identificados

### Import perde estado — `UI55/UI56`

`discover()` e `prepare()` mudam o estado para `loading`; `SfStatePanel` deixa de renderizar os filhos nesse estado, desmontando o formulário e perdendo `FileList`, datas e destino.

Código:

- `packages/app-shell/src/orchestra/chapters/sucafina/imports/index.tsx`
- `packages/app-shell/src/orchestra/chapters/sucafina/shared/states/index.tsx`

Correção: manter o formulário montado com estado `busy`, fence de geração e controles temporariamente desabilitados.

### Procurement vazio pode responder 503 — `CAP24–CAP26`

Sem settings persistido, a leitura fornece moeda vazia; a construção de contexto exige moeda e propaga `procurement-context-unavailable`. Uma instalação legitimamente vazia pode falhar em vez de retornar fila vazia.

Código:

- `modules/sucafina/Sucafinav1/runtime/procurement.ts`
- `apps/cli/src/sucafina-product/business-services.ts`

Correção: aplicar defaults somente quando settings estiver ausente, sem transformar erro real em fila vazia e sem escrever durante read.

## O que já possui caminho estático executável

Não foi encontrado blocker estático evidente nos seguintes conjuntos, embora todos ainda exijam runtime real:

- IT Operations e IT Security;
- Performance Contract;
- Planner Overview, Headcount e Versions;
- Procurement approvals e Settings;
- Decisions choice, apply, receipts e analyses;
- Portfolio scenarios, results e sensitivity;
- BI catalog/visual/source drilldown;
- Reviews agenda, preserved, compare e export;
- relations, threads e confirmations;
- similar cases;
- routine catalog/admission e schedules.

## Ordem de correção recomendada

| Ordem | Prioridade | Workstream | Escopo | Resultado esperado |
|---:|---|---|---|---|
| 1 | P0 | Defeitos imediatos | `UI55/UI56`, `CAP24–CAP26` | Arquivo/datas/destino sobrevivem; instalação vazia retorna fila vazia legítima sem relaxar 401/403. |
| 2 | P0 | Entrada e navegação | `UI29`, `UI30`, `UI67` | O agente entra, troca owner e abre hot-topic/request/confirmation/signal por ref canônica. |
| 3 | P0 | Documentos | `UI58–UI60` | Upload → scan/classificação → reject/confirm → vínculo/aplicação governada. |
| 4 | P0 | Decisões | `UI35–UI37` | Autoria de A/B/C, premissas e resposta humana com CAS, source refs e receipts. |
| 5 | P0 | Agent UX | `UI65`, `UI70` | Execução real, output/verifier, cancel e contribution proof observáveis. |
| 6 | P0 | Skills financeiras | `CAP03–CAP05`, `CAP18`, `CAP23` | Nenhuma skill procura WHATIF/official numa superfície sem `planVersion`. |
| 7 | P0 | Contratos, attachments e exports | `CAP14`, `CAP25`, `UI68` | Document/PR/sourcing refs, upload seguro e export por PO/ref. |
| 8 | P1 | Cross-links executivos | `CAP01`, `CAP02`, `CAP09`, `CAP13`, `CAP15` | Pauta, riscos, stakeholders e handoffs deixam de depender de título/string. |
| 9 | P1 | Modelo Planner | `CAP19`, `CAP21`, `CAP22` | Approval/window, allocation percentages/contractRef e FX provenance persistidos. |
| 10 | P1 | Reports | `UI50`, `E2E-024` | Alinhar a skill ao prepare/download atual ou implementar lifecycle async real. |
| 11 | Execução | Campanha de agentes | 94 journeys com caminho presente | Cada skill termina `PASS`, `FAIL` ou `BLOCKED` com evidência ligada ao SHA. |
| 12 | QA Infra | Capabilities e harness | 13 capability-blocked, 8 environment-blocked | Features promovidas e fault/tenant/DR/performance harness provisionado. |

## Protocolo recomendado para os agentes

Cada agente deve receber uma única story e produzir um registro mínimo com:

- `story_id`, SHA exato, branch/build e timestamp;
- ator, principal, tenant lógico, instalação, projeto e competência;
- rota inicial e rota final;
- controles realmente usados;
- operações HTTP/native realmente chamadas;
- versões/CAS, idempotency keys e refs opacas sanitizadas;
- before/after lidos do produtor;
- receipt/run/attempt/manifest refs quando existirem;
- resultado literal: `PASS`, `FAIL`, `BLOCKED_CAPABILITY`, `BLOCKED_ENVIRONMENT` ou `NOT_RUN`;
- contraprova executada e prova de ausência de mutation quando aplicável.

Regras:

1. Rota existente não prova autorização.
2. Botão visível não prova operação.
3. HTTP 2xx não prova commit sem receipt ou releitura.
4. CI verde não prova que a journey foi executada.
5. `started`, `queued` ou `pending` não significam conclusão.
6. Capability ausente não pode ser substituída por mock ou claim de cobertura.
7. Perda de resposta não autoriza retry cego.
8. Atores, policy e owner tuple devem ser revalidados na operação e na releitura.

## Próxima campanha sugerida

Começar pelas **94 stories `PATH_PRESENT_RUNTIME_REQUIRED`**, em lotes pequenos e independentes. Não misturar correção de produto com julgamento da journey. Quando um agente encontrar um blocker novo, ele deve registrar a primeira quebra e parar sem inventar continuidade.

Depois dos P0 acima, reexecutar somente as stories afetadas por cada fix, mantendo o mesmo formato de evidência. As journeys `BLOCKED_CAPABILITY` devem permanecer bloqueadas até a feature existir no build auditado; as `BLOCKED_ENVIRONMENT` precisam de runbook e harness aprovados antes da execução.

## Limites e conclusão

Esta auditoria é uma análise de coerência entre skills e código no SHA indicado. Ela encontra blockers antes do QA real, mas não substitui execução em browser, tenant, VM e atores reais.

O resultado principal é operacional:

- existe um lote significativo já pronto para execução por agentes;
- existem blockers claros que devem virar workstreams de produto, não flakiness de teste;
- as skills precisam ser corrigidas quando pedem semântica de outro capítulo;
- nenhuma promoção deve considerar rota, CI ou fixture como substituto da jornada humana completa.

**Veredito:** executar o lote com caminho presente agora, corrigir os P0 em paralelo e manter capabilities/ambientes ausentes explicitamente bloqueados.
