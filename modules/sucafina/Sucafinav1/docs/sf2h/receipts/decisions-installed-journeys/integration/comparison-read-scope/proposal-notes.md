# Missão52 — proposta de ingressos canônicos de leitura para comparação e escolha

Estado: **proposta local, não aplicada, não executada, não qualificada**. Esta análise é estática. Nenhum teste, compilador, produto, dispatch, ref ou arquivo remoto foi alterado. O material abaixo não declara release da missão59 nem transfere o resultado de sua conformance para a jornada52.

## Material e precondição

Base material indicada pelo integrador: C28 `d088708276b48f896ad4e0ecd2a95cb73dc413b1`, tree `8b07ebf53f492a20ce3381a8b4ec50bd21ec1c6d`. O arquivo `decision-case-http.ts` é overlay P4 já proposto por52, ainda não incorporado à base; `portfolio-services.ts` conserva o blob de C27/C28. As duas preimages foram relidas por GitHub MCP em W06 `78f2362bd09fcbf606505d7833860f1af07b8e6f` e verificadas por hash de blob.

| Arquivo | Preimage | Postimage proposto |
|---|---|---|
| apps/cli/src/sucafina-product/decision-case-http.ts | 13188a92ace68e6730bd22f8ee87872af2c1dea1 | 1c0fabda68c92b3d7a14b569c2c3e960ff39476c |
| apps/cli/src/sucafina-product/portfolio-services.ts | 881ce4672d9d0e641d1cc849663c0980c118774d | 9d17760c418ee9b48b97443d90a994c31cc415f5 |

Pacote completo: `m52-work/p6-read-scope-material.json`, SHA256 `0c19eae3584e47f895aad62d332fa38112c50b1211c7a287c2994995fccd4570`. Patch completo incremental: `m52-work/p6-read-scope-complete.patch`, SHA256 `5a3d9a416edafc70d7e94ae71702d2a207fa2cff725816b3912ec653148d9c9c`.

A dependência avaliada é o produto59 W `26f7af7efcc143d558df51eeb35e4a7011f456fe`, com quatro postimages exatos:

- `runtime/contract.ts`: `8be1156b64e957eae4670f7ad1bb6cd51e61e649`.
- `runtime/local-store.ts`: `a36440a750d5671a34c3ab41b2af48093af9f7ee`.
- `product/integration/source-lifecycle.ts`: `0e812842ad0d534998c182100a8466548d70e915`.
- `product/portfolio/read-snapshot.ts`: `3cf82bd82b2716ee689b4c48bd9551540b058287`.

A59 publicou posteriormente resultados de conformance em `1b861df306260deed5e6af8a8e49e5da45c11b67`, sem alterar esses quatro blobs. No corte comunicado pela auditoria de composição, P03/gates/release permaneciam pendentes. O root determina o manifest admissível para eventual ensaio52 isolado; esta proposta não altera o estado da dependência ou do stack.

## Três limites de leitura

### 1. Comparação solicitada pela UI

O factory próprio `product/decisions/http.ts`, blob `a77da76589ece60a6925bdd20731efbc8f19b597`, conserva:

- Linhas173–176: contrato estreito de dependências.
- Linhas183–202: sinal/origin/método/content-type/tamanho/payload.
- Linhas203–206: admissão explícita da comparação.
- Linhas211–214: `withCase(...allowHistoricalRetry:false)`, chamada do comparador e `human.finish` no finally.

O adapter P4 `decision-case-http.ts`, preimage linhas50–68, já fornece `admitComparison` por `human.admit(request, "decisions.portfolio.read", payload)`. A proposta envolve apenas seu callback `portfolio.compare(request, call)` em `readPortfolioSnapshot(authority.host, call, request, work, refused)`.

Isso preserva o mesmo Request, contexto, payload completo e seleção de caso. A admissão e a leitura inicial de `withCase` precedem a raiz; a revalidação final de `withCase` e o finish permanecem depois. O comparador continua usando o escopo P5, o caso completo, resultados históricos, replay canônico, cobertura e regras. As leituras de métrica feitas dentro dessa comparação entram na mesma raiz por propagação assíncrona. As três comparações da UI são invocações separadas: nenhuma raiz ou resultado sobrevive para a próxima.

Listagem, edição e catálogo não recebem este wrapper.

### 2. Comparação reexecutada para registrar a escolha

O caminho instalado não chama o comparador de casos da UI:

1. `apps/cli/src/sucafina-product/portfolio-http.ts`, blob `8a15b3ac6c14a2cb4b5cfa9075ec75320884dd90`, linhas48–55: admissão `decisions.choose`, `withCase(...allowHistoricalRetry:true)`, depois `mutations.recordChoice`.
2. `portfolio-services.ts`, preimage linhas36–57: composição dos registries, preparação e injeção de `composed.mutationPlanner`/resolução de valores no produtor de mutações.
3. `product/decisions/mutations.ts`, blob `3f31dd52babca16249fb04fec29abbf74e7a5da4`, linhas180–189: autorização de mutação, replay, confirmação humana, caso e critérios; então `input.planner.compareScenarios`.
4. Mesmo arquivo linhas190–203: validação dos resultados e vínculo da alternativa após o comparador.
5. Linhas204–210: valores, snapshot de escolha e chamada a `saveCase`.
6. `saveCase` linhas254–279: revalidações, leitura de outbox e transação de commit; o callback com `verifyMutation` continua na linha264.

A proposta cria uma fachada somente para o planner injetado nesse produtor de mutações default. Ela altera apenas `compareScenarios` para entrar no helper e delegar à função original de `composed.mutationPlanner`. Não altera `registries.planner`, o planner usado pelo restante do produto, nem `simulateScenario` ou os demais métodos.

A raiz fecha antes de retornar a linha190 do produtor. O registro completo da escolha não fica sob uma raiz de leitura.

### 3. Valores exatos da escolha

`portfolio-preparation.ts`, blob `cd9b7e0ebd49db83ea8612d80fc636ed008b2c2c`, linhas67–94, contém um segundo produtor puro, chamado pela mutação na linha204:

- Confere payload/intenção humana, caso e versão.
- Para cada critério, resolve a regra; chama `registries.readMetric` nas linhas81 e86; relê a regra.
- Preserva checks de unidade, moeda, horizonte, finitude, baseline, igualdade de métrica e igualdade de regra.
- Relê o caso e reautoriza intenção/host antes do retorno.
- Retorna o array ordenado dentro de `PortResult`; não executa commit.

O wrapper cobre esse corpo original inteiro, usando `{caseRef, comparison}` como entrada protegida pelo helper. O resultado e o array são encaminhados como produzidos, sem transformação, clone, deduplicação ou cache. A raiz dessa fase é independente da raiz da comparação anterior e fecha antes de `createChoiceSnapshot`/`saveCase`.

Envolver apenas a comparação da UI não aceleraria automaticamente essas duas fases posteriores da escolha. Essa é a razão dos três ingressos explícitos.

## Preservação de custom preparation

O teste de branch original é preservado literalmente: se `input.preparation` for truthy, o produtor continua recebendo `registries.planner` e `preparation.resolveChoiceValues` sem wrappers novos. Se ausente, usa o planner e a resolução de valores de `composed`, agora com os dois limites de leitura descritos.

Os demais callbacks de preparação, confirmação, verificação, cobertura, questionamento, promoção, preparação de comandos, leitura histórica e criação de IDs mantêm suas expressões originais. Nenhuma função custom desconhecida é presumida pura.

## Por que o helper conserva SourcePersistence e CurrentChoice

A montagem real `local/entry.ts`, blob `0591ee43590b6db4f7b574b071eaada8346ccc1f`, linhas76–87, cria LocalStore, CurrentChoiceFence sobre o driver e SourcePersistence sobre a persistência cercada. O host recebe essa persistência composta.

A implementação59 de `readPortfolioSnapshot` não chama a primitive sozinha. Linhas49–60 mantêm `persistence.transaction("dashboard", callback, {signal})` dentro de `readSnapshotRoot` quando disponível; na ausência da capability executam a transação original. Assim:

- SourcePersistence59 linhas126–132 ainda exige identidades de fonte e cria seu guard da transação. O forwarding opcional nas linhas79–82 só fornece escopo.
- CurrentChoiceFence, blob `db487cd1b6263835302e9bcf80499d18531aa592`, linhas283–300, continua executando sua transação. Quando seu escopo já está ativo, mantém `track`, checks de escopo, `authorizeSnapshot` e `publication`; fora de escopo conserva sua delegação original. A proposta não cria nem substitui autoridade CurrentChoice.
- O helper59 linhas25–43 e51–68 mantém Request/sinal/contexto/payload, identidade de métodos, callback único, host revalidation e fence de saída.
- LocalStore59 linhas192–230 abre a raiz somente uma vez; lê SQL fresco nas três superfícies; rejeita poison/leitores não reunidos; fecha/limpa o escopo no finally.
- LocalStore59 linhas244–284 conserva leituras aninhadas com cópias independentes e contador; tentativa de commit ou escrita de blob envenena a raiz mesmo se o erro for capturado.

A proposta usa o helper importado; não acessa a primitive diretamente, não chama `work` como alternativa após recusa, não inspeciona snapshots para escolher outro caminho e não muda os arquivos CurrentChoice/SourcePersistence/runtime.

## Limites e riscos que permanecem

O helper só permite join de raiz que ele mesmo abriu, ainda ativa, com mesma persistência, Request e autoridade. Uma raiz externa arbitrária é recusada. Por isso não foi aplicado um wrapper global a `registries.planner`, `portfolio.compare`, `recordChoice`, `withCase` ou ao router inteiro: esses contratos têm outros consumidores e podem participar de fluxos de escrita ou de raízes diferentes. Não há fallback que contorne essa recusa.

As chamadas reais de leitura e seus guards permanecem. Dentro de cada raiz elas observam a base SQL canônica daquela raiz; as raízes de fases diferentes não compartilham dados capturados. Fontes remotas não adquirem por isso semântica de snapshot/autoridade. Uma tentativa inesperada de escrita dentro de qualquer um desses produtores continuará provocando recusa, não conversão silenciosa em sucesso.

A mudança não declara equivalência de elapsed time ou de todo o Forecast; não remove replays, coberturas, guards ou observações. O runtime59 pode reduzir trabalho de materialização dentro da raiz, mas a performance de cada jornada só poderá ser conhecida no candidato exato executado pelo root. Não aumentei deadline nem budget.

A análise não produziu diagnóstico TypeScript ou prova de conformidade executável. Foram feitas somente transformações literais das duas preimages e verificação estática de hashes/diff. O pacote é completo para revisão pelo proprietário; aplicação e qualificação permanecem decisões do root/integrador.

