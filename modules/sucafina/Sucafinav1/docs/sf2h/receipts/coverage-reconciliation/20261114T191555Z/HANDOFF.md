# Reconciliação evidencial — 1.610 critérios

**Estado:** censo concluído, consumo por S0 pendente. Não há C aceito ou `GLOBAL_RELEASE` demonstrado neste corte. Esta entrega conserva **15 WPs, 74 tasks, 17 contratos e 1.610 critérios**, sem editar produto, plano ou checkpoint canônico.

## Fonte, corte e autoridade

- Missão/COMMON: `c708ec0609dbfc95b259707d8c38481617f74f11`.
- Planejamento: `dbf9547211d9b0fade619790de7c19c0869b7c7d`; SHA256 de campaign: `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`.
- Pai preservado de `intel-resume`: `c21a990c57b714cd60bb7f915beb6be51acbafdb`. Não existia PR dessa branch na consulta inicial.
- Corte inicial registrado em 2026-11-14 19:15:55 UTC; rechecagem de heads em 19:26:54 UTC. A publicação tardia WP10 `54317229…` foi inspecionada: adiciona 40 recibos, sem novo produto em relação a W30 `d4fb072…`. PR49/50/51 avançaram; as novas revisões são registradas, mas sua semântica não foi reavaliada neste censo.
- S0-A lido integralmente de forma distribuída, com os anexos obrigatórios e recibo por seção. Nenhum pack de outro ator foi carregado. O recorte de 7 skills/29 rotas no pack não reduz o catálogo normativo de **5 perfis/18 skills/8 packs/39 operações/6 AM**.

**Atenção ao envelope:** `intel-resume` já trazia commits de produto. O compare inicial com `sf2-control` divergia 60/21 e retornava 300 arquivos, limite da API; esse retorno não é inventário completo do diff. O novo commit adiciona somente os dois namespaces da missão. A PR é evidencial contra `sf2-control`: **S0 deve admitir os blobs evidenciais por commit/path/hash; não mergear a branch inteira em produto.** Nenhuma história foi reescrita para esconder o diff herdado.

## Como usar o censo

| Arquivo | Uso |
|---|---|
| `criteria/CAMP.json` e `criteria/WP00.json`–`WP14.json` | Cada ID/texto literal, ponteiro canônico, quatro eixos, código, consumidor, evidência e limites. Os 11 IDs `sf2h-integral-20261112.*` permanecem intactos junto dos 39 `CAMP.*`. |
| `tasks.json` / `contracts.json` | 74 tasks e 17 definições canônicas, com vínculos observados externos ao texto normativo. |
| `sources.json` / `source-integrity.json` | 700 fontes; 253 corpos conferidos contra Git blob. Entradas de árvore e identidades apenas citadas por recibo estão diferenciadas de corpos lidos. |
| `runs.json` / `heads.json` | W, S, seleções, runs, limites de reuso, heads consultados e deltas posteriores. |
| `anomalies.json` / `output-consumption.json` | Sobreposições, propostas não aplicadas, entregas não consumidas e 19 handoffs canônicos. |
| `remaining-work.json` | 74 linhas únicas por task, 15 agregados WP, owner, paths, dependências e próxima ação; ações compartilhadas têm owner e pool único. |
| `verification.json` / `files-manifest.json` | Resultado mecânico e hashes do envelope; não são prova funcional. |

`YES`, `PARTIAL`, `NO` e `UNKNOWN` são avaliações por eixo e por escopo textual. `NOT_ACCEPTED` não apaga código ou prova parcial existente. Nenhum status antigo `PLANNED`/`NOT_RUN`, total de PRs, testes ou tokens foi usado como progresso; não foi calculado percentual da campanha.

## Achados que mudam a próxima ação

| Aresta / problema | Observação vinculada ao corte | Próxima ação e owner |
|---|---|---|
| Procurement money → export | `monetary.ts` da PR57 foi consumido na PR34. Run **43628901747**: 10 positivos, 2 falhas de export; PO futura recebe valor/câmbio de sourcing e linhas 40/60 viram 100/100. | Missão `procurement-exports`, **PR57**: reconciliar `downloads.ts` com patch publicado `d47538f…` e preimagem; preservar etapa/proveniência. Patch não aplicado não recebe crédito. |
| Apply / importação / documentos | PR34 ainda não consome os blobs corrigidos de PR60 (Apply), PR58 (admissão durável) e PR52 (busca documental/schema-intent). `ui-recovery` PR46 também diverge do consumidor PR43. | Owners WP04/WP06/WP01 e S0: intake seletivo por path/blob e fechamento de cada consumidor; não copiar snapshots inteiros. |
| ACK exato de destinatário | A proposta PR54 já foi aplicada ao produtor PR41 (`recipient-actions` `22c6309…`). PR29/44 e a UI PR47 ainda não demonstram esse consumo/reload. | Missão `ui-recipient-ack`, **PR47**: consumir `mutationReceipt` exato e intenção autorizada após reload; não reabrir diagnóstico de produtor Boolean-only. |
| FIN001–003 / `workSignals` | Falhas persistem em Finance42, mas PR29 já contém o verificador, a combinação correta da factory `state`, o prefixo de campanha e `workSignals`. PR44 conserva diferenças. | **S0/WP10**: resolver por árvore/blobs; não reaplicar remédio histórico nem atribuir os 115 TS/43 gates de Finance42 à PR29. |
| Forecast UI | **U30 43629303473**, W=`d4fb072…`, S=`84432d8…`: 3 positivos/1 falha; ready/output alcançados, cancel continua visível. Assertions posteriores não alcançadas. | Missão `forecast-cancel-visibility`, **PR45**. Causa CSS é hipótese; observar atributo/estilo/estado antes da correção. Fixture HTTP não prova Finance/modelo/nativo. |
| Finance / threshold | S5 **43630462257** está concluído com sucesso no seu W/S e seleção de dez arquivos; não contém a jornada 15.000/15.001. **X29 43628663680** terminou falho no deadline; redução 4→2 transações não provou ganho suficiente. | **WP13/WP10**, ação compartilhada contada uma vez: resolver a causa concreta, preservar escolha/oráculos, provar histórico/retry/reopen/revogação depois. PR56 continua proposta não aplicada. |
| Integridade de memória | A27 já passa do antigo timeout: Atlas recusa captura corrompida, mas `staleAccess.preflight` aceita. Negativos finais de revogação não foram alcançados. | Missão `memory-integrity-preflight`, **PR29**. Validar captura no reader/wrapper reais; preservar os positivos históricos e não trocar todos os retornos por denied. |
| Sobreposição WP12/WP14 | PR36/39 divergem em `analysis-port.ts`; PR36/38 divergem em oito arquivos de memória. `signal-registry.ts` faz IO/C08 dentro da camada declarada pura. | Owners WP12/WP14 e S0: decisão por arquivo/preimagem; transferência proposta não conta como implementada. |
| Provas nativas e aceite | Provas humanas W28 não executaram inferência nativa. Driver reopen não é restart de processo→recall→UI. CHECK30 **43629131094** falha com 13 diagnósticos externos/0 WP10. | **WP00.T04 / WP10.T02–T07 / revisores**: completar provas qualificantes no mesmo C; três revisões finais no mesmo C, depois D. |

Não há órfão **estrutural** nos 19 handoffs normativos: todos nomeiam tasks consumidoras válidas. Isso não demonstra consumo funcional. Entregas sem consumo comprovado permanecem `UNKNOWN_FULL_OUTPUT`; deltas efetivamente não consumidos estão destacados nas anomalias, com produtor e consumidor.

## Esforço restante e sequência de consumo

Faixa de planejamento: **aproximadamente 250–850 pessoa-hora**, confiança baixa. A soma aritmética dos 22 pools únicos é 262–768 h; os limites arredondados evitam apresentar essa soma como previsão precisa. As faixas por task são exposições não aditivas. Ações Finance compartilhadas preservam ID, owner e um único `accountable_pool`; seus consumidores não repetem a cobrança.

Premissas: código/harness existentes reutilizáveis, owners familiarizados e correções/intakes delimitados pelos achados. Ficam fora espera de CI/revisores, disponibilidade de host/modelo/scanner/acesso e defeitos novos. Não é prazo de calendário nem um limite máximo garantido. Dependências de consumidor/coordenação podem ter ciclos; não são um cronograma topológico.

1. S0 escolhe os blobs compatíveis para a composição comum e registra pre/post imagens, aproveitando correções já presentes.
2. Owners das missões abertas entregam ACK UI, export, integridade de memória e cancel visibility; produtores/consumidores fecham as arestas restantes sem repetir o diagnóstico já superado.
3. Após estabilizar o candidato, a autoridade de execução completa jornadas/AM/checks e obtém três pareceres independentes no mesmo C. Esta missão não agenda nem dispara essas execuções.
4. S0 arquiva em D somente a evidência admitida; este censo permanece como tentativa imutável e é sucedido por nova tentativa quando necessário.

## Verificação e limites

`canonical.py` e `verify_census.py` usam Python padrão, sem rede ou import de produto. Foram conferidos todos os IDs/textos canônicos, 1.560 ponteiros literais de matrizes WP, referências internas, 74 tasks sem cobrança duplicada, 17 contratos e os blobs indicados. Inspeção seletiva e recibos publicados não são auditoria semântica exaustiva: `UNKNOWN` continua explícito. Nenhum teste, typecheck, guard ou CI de produto foi executado/disparado por esta missão; nenhum produto, plano ou checkpoint foi editado.

**Terminal:** writer de reconciliação encerrável após publicação CAS e conferência da PR. Consumidor: S0, somente para intake evidencial e planejamento do candidato futuro. Não há aceite automático desta coleção multi-head.
