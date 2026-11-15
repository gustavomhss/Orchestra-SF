# N16 U28/U30/U31 — Critérios/evidência (autoria, não qualificação)

Source pin C60: `af479f68c22ef1d1e9ac100a81a820f8b0273338`. Head de produto `7ac5d020914ddeb73b6c3071f79b792490616ae9`. Lease `ux-native-n16-e1`.

| Critério | Evidência de produto | Estado de prova |
|---|---|---|
| U28-AC01 | UI69 filtra authMode local-operator por contexto+binding e GET projection.local-admin, limpa owner; backup/import mutável bloqueado | IMPLEMENTADO_READ; instalado NOT_RUN |
| U28-AC02 | SfStatePanel, abort/reload, auth denied/unavailable e geração stale | SOURCE_ONLY, NOT_RUN |
| U28-AC03 | CSS fluid, tabela acessível e scroll com foco | 320/768/1024/1280/1440 e 200/400 NOT_RUN |
| U30-AC01 | CAP13/CAP15 campos do A01, versão CAS e revisão S03. Nenhuma autoridade inferida de nome/email | SOURCE_ONLY; score de risco derivado ausente de A01 |
| U30-AC02 | owner-fenced reads, F01 drafts, denied/expired, filtros, unknown sem retry automático | SOURCE_ONLY, NOT_RUN |
| U30-AC03 | S01 SfDataTable, controles nativos e CSS de reflow | NOT_RUN |
| U31-AC01 | itperf items/subs: pesos, owners, score e status trimestral de fonte, 5 CRUD A01, revisão de pesos | SOURCE_ONLY; score global calculado ausente de DTO |
| U31-AC02 | version.itperf, F01 drafts, revisão e result unknown | SOURCE_ONLY, NOT_RUN |
| U31-AC03 | CSS responsivo, tabela navegável com foco | NOT_RUN |

## Bloqueadores explícitos

1. A01 (W14), F01/F02/F03, S01/S03 e I00 ainda não estão juntos nesta branch. 125 deve compor as dependências no mesmo C e registrar rotas/copy.
2. A01 `projection.local-admin` só expõe registros READ; sem export/import/restore autorais. Não simular POST. CAP13 DTO não retorna tier/score derivado; CAP16 DTO não retorna score global calculado. Qualificação integral desses cálculos depende de projeção/produtor canônico.
3. Respostas lost/4xx e CAS/revocation carecem de evidência hosted e auditoria 119; nenhuma confirmação positiva inventada.
4. Os três E2E são arquivos-fonte escritos **não executados**; hosts instalados privados necessários. 120 é executor exclusivo.
5. O PR contra sf2-stack inclui overlay anterior da campanha no diff; 125 faz cherry-pick/integração seletiva por blobs em SOURCE-POSTIMAGES, não merge cego.

**Resultado honesto:** ARTIFACT_READY somente para autoria. NOT_RUN: compiler, lint, E2E, host, screenshots/reflow, CI. Não é aprovação nem global release.
