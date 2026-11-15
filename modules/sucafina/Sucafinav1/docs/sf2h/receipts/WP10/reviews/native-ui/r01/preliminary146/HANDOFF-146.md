# PRE-R01 — Handoff preliminar funcional/UX (missão 146)

**Estado terminal:** PRELIMINARY_REVIEW_HANDOFF_ONLY. **Nenhuma aprovação final R01**, nenhuma promoção de prova ausente a PASS, Goal pausada. Modelo efetivo GPT-6; ator GitHub observado gustavomhss; sessão externa não exposta; epoch `pre-r01-e1-browser146`.

## Fence, fontes e alcance

- Branch exclusiva: `sf-review-functional`. Preflight HEAD `d8f14f81855858120f914af4f3934406bfdb74f1`; tree inicial `c792f5d0d3be378ca86aea09bcabdd8781734d8f`.
- Pacote integral 146: `81fbb8364ca474db8f718faad20c9235519e98fe`, blob `e5a7918d1de331142e1875c5ac876a5cc49641c6`; planejamento `dbf9547211d9b0fade619790de7c19c0869b7c7d`, UI normativa `cbac654784714f68779ae1434d30e6ea8970c4d1`.
- Integrador único 132/PR65; material inicial d8 foi superado por 5e, depois 04bf e finalmente `8094e599e3d18609e269548d24619a3246fbc735` (tree `b064e8c0ef63e9a3eb2bf6b699592fbdb184dee8`). Nenhum deles é aqui considerado C final congelado. A mudança 04bf→8094 trouxe somente Office/DOCX, sem alterar os seis caminhos dos achados de UI/host.
- Escopo inspecionado: montagem F02/A07/A12, code-paths de UI29/30/31, CAP06 e UI47, transporte/registry, PR100/97/98, PR159 e metadados dos incrementos de UI. Cobertura integral das 70 superfícies, 15 capítulos e testes em todas as vistas **não está demonstrada**.

## Artefatos append-only e pre/postimages

| Arquivo único no prefixo `preliminary146/` | Preimage | Postimage SHA-blob | Commit criado |
|---|---|---|---|
| `ACK.json` | ausente | `fec09da2fb131a59bd8feb8558741f056ada8429` | `1572125e4b460d93725f3292173dbbbb67522b99` |
| `FINDINGS-146.json` | ausente | `5342ec3da96c71375d59d0035779e82f11c2a970` | `ee6da6c361f21f67648c274fed15e8cf5eab4f34` |
| `COVERAGE-146.json`, `RECHECK-146.json`, `HANDOFF-146.md` | ausente | ver árvore/commit da PR de review | mesmo commit terminal deste handoff |

O registro `FINDINGS-146.json` fixa as evidências por **SHA, path, blob, linha, causalidade, gravidade, dono, correção e prova solicitada**. Os achados são independentes dos casos gerais já reportados em PR100, PR97 e PR98. Nenhuma execução foi simulada.

## Novos findings: nenhum confirmado fechado

| ID | Gravidade | Defeito estático | Owner de correção |
|---|---|---|---|
| PRE-R01-146-001 | P1 | UI30 Meu trabalho chama `projection.work-item` que não foi registrado no handler nativo | N11/PR158 + A12, compor por 132 |
| PRE-R01-146-002 | P1 | UI47 agenda chama `projection.review`; implementação A07 não integra lista de handlers da instalação | A07 + N28/PR152, compor por 132 |
| PRE-R01-146-003 | P1 | UI31 envia texto livre `q` em GET URL contra NAV-01 | N10/PR147 + A12, contrato mediado por 132 |
| PRE-R01-146-004 | P2 | CAP06 exibe CTA para estrutura desabilitada sem transição | N14/PR146, route builder 132 |
| PRE-R01-146-005 | P2 | UI29 Hoje mostra casos para retomar sem link/ação com `caseRef` | N10/PR147, route builder 132 |
| PRE-R01-146-006 | P2 | UI30 descarta fonte em desktop porque origin do renderer não é publicOrigin | N11/PR158, D01/132; revalidar após 001 |

## Recheck de correções realmente presentes

- **PR100/R1-91-001:** `product/ui/decision-create.ts` blob anterior `1c3bf8…` → atual `d1d12abb…`; chave retida antes de POST e reconciliação read-only; **correção de fonte presente; prova instalada NOT_RUN**.
- **PR100/R1-91-002 = PR97/F92-EGRESS-01:** `runtime/application.ts` `81f469…` → `a0deff8a3b272019f472aa2f93499d1940a78370`; re-autorização pós-geração, source digest e 403/409 antes dos bytes; **correção de fonte presente; prova de corrida NOT_RUN**.
- **PR97/F92-FIRSTSAVE-03:** `hot-topic-draft.ts` `a0c1d…` → `d880fe5a5f7fd3c9c4fa249dbc374620a39a43a7`; `lookupFirstSave` fonte presente; consumidor/exact-C/reload/revocation **NOT_RUN**.
- **PR97/F92-PURE-02:** `signal-registry.ts` `b6edcf…` e `outcome-selection.ts` `790e7c…` **continuam idênticos**, sem correção observada.
- **PR97/F92-C10-04:** `cost-coverage.ts` `bfcb6e…` continua idêntico; histórico de outros snapshots não é aceite do C final.
- PR98 runtime/MCP/Atlas/CI continuam sob seus donos; nenhum achado foi renumerado como nova descoberta nem considerado resolvido sem blob/prova exatos.

## Critérios, validade e gates

O registro de análise estática e deduplicação foi produzido. `R01-AC01`, `R01-AC02`, `R01-SCOPE` e os critérios canônicos WP10.T03 **não foram aprovados**. Estado: `NOT_RUN` para teste real, parser, validator, typecheck, geração SDK, CI, provas de navegabilidade, acessibilidade, 320/768/1024/1280/1440, zoom 200%, reflow 400%, idiomas/temas, desktop, auth/revocation, Q01/Q02, G7/G8. Zero alterações em produto ou testes; zero alterações no controlador, engines, Azure, deploy ou release. Não assumir PASS a partir de prova inexistente.

## Próxima ação exata para 132

1. Congelar e registrar delta do **HEAD material 132 corrente** e seus blobs; preservar HEADs/leases de autores e compor apenas correções reais. Encaminhar os seis IDs aos donos N10/N11/N14, A07/A12 e D01 indicados em `FINDINGS-146.json` e exigir pre/postimage e consumer ACK.
2. Conectar `projection.work-item` e `projection.review` aos produtores verdadeiros com autoridade original, sem stub; resolver contrato de busca sem texto livre em URL; ativar links autorizados de navegação e broker desktop com foco/owner. Revalidar source SHA pós-fix, não aceitar comentário como ACK.
3. Solicitar **149/PR107** para compilação/SDK e **150/PR106** para Q01/Q02 e CI cirúrgico a partir da closure de alterações, com negativos de acesso, perda de resposta, restauração, web/desktop, navegação, keyboard/a11y e reflow. Nenhuma execução local por 146.
4. Após integrar e corrigir, a 132/S0 deve fixar **novo C final/tree** e colecionar runs+artifacts completos, bem como testemunhos de R01/R02/R03 independentes sobre o **mesmo C**. Reabrir revisão final R01 apenas com proof; não reinterpretar este PRE-R01 como aprovação ou Goal retomada.

**Handoff terminal para 132**, com findings abertos. A revisão fica sem writer de produto/testes e não executará polling. A PR da revisão é documental e permanece aberta/draft até a 132 consumir seus registros.
