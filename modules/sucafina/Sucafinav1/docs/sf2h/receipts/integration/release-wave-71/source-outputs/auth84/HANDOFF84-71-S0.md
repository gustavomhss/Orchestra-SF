# Handoff 84 → 71 / S0 — bloqueios e rechecagem exata

**Estado:** FIX-FIRST. Enviar ACK84 e `FINDINGS84.json` para 71 (única integradora de target) e S0. Não inferir que PR documental = integração/prova. Observação C37 em `bc5eb1e0cead17254a95770e437f6fda826a66fc`, tree `94be5190a25b973af4ca647db5149e2ecec6df37`, não é C final aceito.

## Prioridade 1 — compor sem sobrescrever autoridade alheia

1. **85 → 71: autenticação**. Pegar fonte W72 `22b4e97cfbb22703eeedb34af3b33ba74d323806`, terminal `2690de74b0581130ae92e1129d986d31d1663fe8` e os cinco blobs fixados no índice, **reconciliando a raiz readonly59**. Não substituir `local-store.ts` da composição por inteiro; preparar patches completos e conferir pre/post de cada hunk/consumer, `local-contract.ts`, `local/entry.ts`, schema e start/dispose. A missão85 (`auth-readonly-composition.json`, pacote no commit `606c253...`) está apenas `PREPARED_NOT_STARTED` na amostra observada; exigir W/S/run efetivos se avançar. 85 é owner de correções auth; 84 só rechecagem documental.
2. **74 → 71: HTTP**. Integrar os três blobs W74 (`installation.ts`, `runtime/request-body.ts`, `product/interface/http.ts`) com os patches de dependência/mapa completos do terminal74. Não eliminar o budget65536 nem ampliar indiscriminadamente para25MiB; preservar controles de Host, origem, proxy, conexão/abort e scanner. Somente 74 é writer do transporte, e 71 escreve stack.
3. **73/86 → 71: privacidade**. Os dois blobs da 73 já coincidem em C37. Congelar equivalência nos commits seguintes; 86 é writer de application egress/privacy, se tocar nesse caminho, invalidar a revisão da fronteira modificada e exigir novo delta. Não retroceder visibilidade antes de conflict nem CAS de ator visível.
4. **45/S0**. Manter o CI/guards com owner45; obter o C exato, test/fixture manifests, comandos e jobs pelo mesmo SHA; S0 administra a aprovação, não a presume.

## Rechecagem imprescindível do C resultante (sem dispatch por 84)

| Critério | Controles mínimos no C exato | Observável obrigatório |
|---|---|---|
| AUTH-01 | 16+ logouts de handles nunca emitidos (sem carga destrutiva); abandoned challenges/expired sessions, batch GC, cap em 2 stores/restart; callback `take→pending→exchange→issue` concorrente com logout; Graph/refresh, readonly59 root e falha de COMMIT/retry | Zero marcação de desconhecido, fence até inadmissibilidade, quotas respeitadas, um efeito por sessão, nenhuma escrita de auth dentro de root de negócio; provas W/S/run/job |
| ISO-01 | Requests invisível vs ausente, actor requester-only e B creator, `save/approve/reject` e demais ações, versões igual/divergente/futura; upload quote/PO; actor visível com conflito409, holder/dual-role/self-approval | Igual status/corpo/headers públicos entre oculto/ausente; nenhuma linha audit/SQLite/asset/signal alterada em recusas; CAS e aprovações autorizadas preservados |
| HTTP-01 | Listener real: chunked/no CL/CL falso, 65536 e 65537, multibyte/UTF-8 inválido, EOF pendente, abort/desconexão, reader/sockets, autenticação/proxy e aplicação/Workbench; upload binário e contrato25MiB sob política explícita | Limite aplicado antes de acumular e antes de dispatch; 413 sem EOF, 400 privado, sem double-consume/efeitos; uploads autorizados não cortados nem ilimitados |
| Interação | 72+59+73+74 combinados com origin/tenant realista, independência de escritor, 86 eguards45, provas da85 quando entregues | Um único C congelado/árvore e mapas; casos cruzados e regressões observados no C e não herdados dos snapshots de fonte |

**Holds explícitos:** `M70-AUTH-01@C37=OPEN`, `M70-ISO-01@C37=FIXED_STATIC/MISSING_PROOF_C`, `M70-HTTP-01@C37=OPEN`; `H74-45`, `H74-MAP`, `H74-25MIB`, `H74-PROCUREMENT`, `H74-COMPOSED`; `85↔71 readonly59`; 45 checks; candidato final e três revisões finais. R1 fonte72 138pass/2skip, R1 fonte73 29pass e R5/R6 fonte74 3+15pass **não** satisfazem automaticamente os holds de C.

**Sinal de conclusão:** novo SHA/tree C aceito por71/S0; manifesto com pre/post e paths; evidências GitHub Actions do próprio C e clean independent recheck após últimas mudanças; depois oito seleções/AM/3 final reviews/G7/G8 e envelope C→D. Se algo falhar, devolver ao **writer de origem**, sem 84 editar produto ou criar CI.

**Autoridade:** 84 encerra revisão **source-scoped + comparação de C37**; nenhum lançamento/teste/merge/deploy/alteração do produto. Preservar review70 e todo histórico. Referenciar este handoff pelo commit documental publicado e pelo PR da missão84.
