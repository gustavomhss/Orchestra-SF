# Orchestra-SF · UAT 360° — CIO / Sucafina

**Versão:** v1 · **data do desenho:** 2026-11-16 (São Paulo) · **status:** `DESIGNED_NOT_EXECUTED` · **classificação:** documentos e dados exclusivamente sintéticos. **Não é prova de go-live.**

## Para quem foi escrito

O CIO global precisa confiar, em poucos minutos, que o orçamento apresentado é o orçamento certo, que atrasos de TI não desapareceram entre sistemas, que um fornecedor não foi escolhido por engano, que papéis foram respeitados e que um relatório preserva exatamente aquilo que foi visto na reunião. Um gestor regional precisa executar sua tarefa sem escalar permissões. Finance precisa comparar cenários sem mexer na versão oficial. Procurement precisa percorrer etapas sem confundir solicitação, sourcing, escolha, aprovação e emissão interna. Um auditor precisa conseguir voltar ao recibo da **mesma** aplicação, após timeout, troca de usuário ou reinício.

O cenário fictício `SF-LAB-2026` foi desenhado para essas pessoas. Ele evoca a complexidade de uma organização global de comércio e logística de café, mas **não representa a estrutura, os volumes, os dados, as regras nem os sistemas reais da Sucafina**. CTRM, SAP, Microsoft Fabric e ERP são *fronteiras de integração*; só se tornam funcionalidades depois de evidência de um conector instalado. O nome Sucafina não autoriza usar informação de clientes/colaboradores reais nos fixtures.

## Conteúdo entregue

| Arquivo | Como usar |
| --- | --- |
| `STORIES-70-SURFACES.md` | **140** histórias manuais específicas: happy/main e contraprova para cada CAP01–CAP28 e UI29–UI70 |
| `STORIES-END-TO-END.md` | **45** jornadas densas, multiator, com contexto, sequência temporal, oráculos e testes negativos |
| `MATRIX-70-SURFACES.csv` | Inventário rastreável 70/70, story principal e negativa, teste-fonte e status |
| `MATRIX-165-ROUTES.csv` | Todos os 165 padrões, incluindo static/dynamic, new/edit/detail/history e campos de evidência |
| `ROUTE-TEST-CASES.csv` e `.jsonl` | **825 verificações operacionais de rota**: acesso permitido, negado, parâmetro malformado, revogação e troca de instalação (5 × 165) |
| `OPERATIONS-306-CONTRACT-MAP.csv` (no branch GitHub) | **305 operações do catálogo congelado + 1 extensão do registro**, ligadas a superfícies/stories e status `NOT_RUN`; contém especificação planejada, não certificação de handlers |
| `stories_70x2.jsonl`, `stories_e2e.jsonl` | Mesmos casos em formato estruturado para TestRail/Xray/Zephyr/custom QA; nenhum PASS pré-carregado |
| `fixtures/SF-LAB-2026.json` | Dados geradores relacionados entre áreas, 25 projetos, fornecedores, FX, orçamento e 23 perfis fictícios Graph *somente para mock* |
| `fixtures/IMPORT-OPEX-VALID.xlsx` | XLSX de import, contrato testado de OPEX; exige destino e versão reais instalados |
| `fixtures/IMPORT-OPEX-ADVERSARIAL.xlsx` | Arquivo sintético adversarial com 10 linhas distintas, 1 repetida, 1 negativa |
| `ACTORS-AND-DATA.md` | Atores, limites e álgebra dos oráculos |
| `TEST-STRATEGY.md` | Critérios de cobertura estrutural + state, actor, failure injection, risco e pairwise |
| `EXECUTION-RUNBOOK.md` | Execução humana, ordem, coleta de evidências, diagnóstico sem falsa homologação |
| `EVIDENCE-RECORD.json` | Template pronto para replicar por tentativa, sem tokens/senhas |
| `GO-NOGO-GATE.md` | Aceite executivo, release e regras rigorosas de sign-off |
| `QA-TRACEABILITY.json` | Contagens e matriz de rastreabilidade geradas e validadas |
| `scripts/validate_qa_pack.py` | Triple check estático do próprio pacote; não executa o Orchestra |
| `research/` | Atlas e review adversarial preservados, inclusive arquivos ZIP binários originais e scripts de reprodução |

## Como ler o semáforo

`DESIGNED_NOT_EXECUTED` = existe roteiro, **não** houve execução; `NOT_RUN` = não executado na matriz; `BLOCKED_ENVIRONMENT` = falta infra/credencial/seed; `BLOCKED_CAPABILITY` = porta/producer não instalado; `FAILED_PRODUCT` = expectativa violada pela implementação; `PASSED_WITH_EVIDENCE` = teste executado com SHA, principal, versão, before/after, recibo (ou negação) e evidências; `NOT_APPLICABLE_APPROVED` só com justificativa assinada e requisito realmente fora do escopo. Para qualquer P0, `BLOCKED` não equivale a PASS.

### Três camadas que não devem ser fundidas

1. **Inventário original (histórico)**: 70 superfícies / 165 rotas / 15 capítulos / 305 operações no catálogo e 306 no registro; `close-final-candidate@42d344a0efc4d85187388f149c54acac2db171da`.
2. **Base de criação da campanha**: `close-final-candidate@a1e774ec9e1fc28c81e0b42a1889c0425060aed9`, com CI e release movendo-se em paralelo. A base de execução final precisa de pin próprio e reconciliado.
3. **Funcionalidades propostas em branches**: Supreme Admin `/sucafina/admin/access` do PR #270, demo Flamengo PR #268, tema white-label — **fora** do inventário congelado das 70; não alterar a contagem histórica para fazer crer que já foram promovidas.

## O que é cobertura, e o que não é

- 70/70 superfícies possuem roteiros P01 e N01; 165/165 rotas possuem linha no catálogo e cinco contraprovas roteáveis por linha (**825** casos adicionais).
- 8 jornadas J01–J08 são referenciadas; 45 cenários cross-domain exercitam hipóteses e falhas, incluindo admin condicional.
- O mapeamento dos 306 identificadores do snapshot histórico **não está automaticamente provado** por mapear telas: cada codec/producer precisa de comparação e de resultados no mesmo SHA. Não afirmar 306/306 E2E aprovados. A campanha da fonte mencionava 1.610 critérios: são rastreabilidade planejada, não 1.610 sucessos.
- “Todas as situações possíveis” não é um conjunto finito; a estratégia define partições, estados, fronteiras, riscos e combinações pairwise/3-way para reduzir omissões sem falsa promessa de exaustividade matemática.

## Referências e decisões

- Manifesto de superfícies: `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/surface-manifest.json`.
- Rotas reais: `packages/app-shell/src/orchestra/chapters/sucafina/route-registry.ts`.
- Registry de operações: `packages/schema/src/sucafina/operation-registry.ts`.
- Oráculos Given/When/Then J01–J08: `modules/sucafina/Sucafinav1/docs/product-campaign/wp00/oracles/journeys-j01-j08.json`.
- Admin: `sf/docs/ADMIN-SURFACE-DESIGN.md` no branch `sfa-admin-surface`; **draft, não prova Azure**.
- Demo: `sf/demo/flamengo/` no branch `sfa-demo-flamengo`; dry-run/seed propostas, **não prova live**.

**Regra de ouro para QA:** `Read → Prepare/Preview → Review → Confirm → Producer apply → Receipt → Authorized reread`. Uma seleção, prompt, export, snapshot, análise ou mensagem **não** autoriza transação de domínio por si só.


## Revisão fria V2 — maturidade e limites

Após peer review independente, **este pacote NÃO é declarado state of the art**. Ver `quality-v2/COLD-REVIEW.md` para 13 achados classificados e o significado restrito da cobertura 70/165/306. Foram corrigidos o protagonista gramatical nas 45 E2E, uma inversão de título em SF-E2E-006 e a contagem de condições de release (34 baseline + 11 condicionais).

`quality-v2/STEP-LEVEL-DOSSIERS.md` adiciona **8 dossiês exemplares** com ação, esperado e testemunho por etapa; `quality-v2/TRANSITION-COVERAGE-PLAN.csv` é **modelo hipotético não certificado** de transições críticas. Uma vez fechado o seed pelo produtor e a matriz semântica, reescrever cada caso genérico com essa qualidade. Rodar `python scripts/audit_uat_quality_v2.py` para validar a documentação; isso **não** testa o Orchestra-SF.

## V3 Lean — piloto de prova por resultado (sem bloat)

A nova camada em [quality-v3/README.md](quality-v3/README.md) **reutiliza** este atlas, os dossiês QA2-001/002/003, os testes Bun/Playwright e o template `EVIDENCE-RECORD.json`. São **três casos prioritários, 21 provas identificadas e um verificador read-only em Node**, não outro runner, seed ou lista inflada de histórias. Estado: `NOT_RUN` até execução real; nenhum PASS hospedado ou GO-LIVE implícito.

## Operação por LLM: o agente executa como usuário (não como API runner)

**Esta é a função das skills.** As stories acima são os *casos de negócio*. Os agentes devem conduzi-los na interface, com sessões reais e independentes de cada ator; os scripts de V3 são apenas verificadores de evidência, não o executor.

Skills descobertas nativamente pelo Orchestra (não exigem plugin, MCP ou runner novos):

| Skill | Papel |
| --- | --- |
| [`sf-user-journey-qa`](../../../../.orchestra/skills/sf-user-journey-qa/SKILL.md) | Protocolo geral `look → act → observe → prove`, autenticação, controle de sessão, classificações e evidência |
| [`sf-finance-user-qa`](../../../../.orchestra/skills/sf-finance-user-qa/SKILL.md) | QA2-001 · Finance/CIO → cenário de forecast |
| [`sf-procurement-user-qa`](../../../../.orchestra/skills/sf-procurement-user-qa/SKILL.md) | QA2-002 · Requester/Buyer/Approver/CIO → compra e aprovação |
| [`sf-import-user-qa`](../../../../.orchestra/skills/sf-import-user-qa/SKILL.md) | QA2-003 · Finance/Auditor → importação, preview e recuperação |

**Pedido de execução ao agente (modelo):**

> Carregue `sf-user-journey-qa` e `sf-procurement-user-qa`. Execute QA2-002 como usuário no **ambiente QA isolado**, no SHA C realmente instalado. Use os perfis autenticados de Caio, Gabriel, Pedro, Sofie e CIO nas interfaces que o produto oferece. Observe cada tela antes de agir; não invoque APIs de mutação para substituir cliques. Capture provas privadas por passo e retorne `PASSED_WITH_EVIDENCE`, `FAILED_PRODUCT` ou `BLOCKED_*` com o motivo. Sem credenciais/browser/fixture real, não invente execução.

**Controlador de interface:** aproveitar `dock-<site>_{look,find,act,wait,navigate}` quando o site estiver aberto no MCP Dock (`docs/guides/mcp-dock-servers.md`), ou o Playwright já presente no app-shell para a UI nativa. A escolha não altera o princípio: **interagir pela interface real**. O navegador não é concedido pela skill: o agente só usa ferramentas previamente disponíveis e autorizadas. Contas/segredos privados não entram neste repositório. Recibos e logs observados ficam num diretório privado de evidência.

A execução automática dos **185 casos** não é declarada pronta: os **3 primeiros pilotos** precisam executar de ponta a ponta com perfis reais no tenant QA. Ampliar para outras stories significa reutilizar a skill-base + o catálogo existente, sem criar 185 skills.
