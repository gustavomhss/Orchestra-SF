# Campanha de consolidação do Orchestra-SF

**Status:** plano canônico de execução, documentação somente.  
**Branch de elaboração:** `gpt-consolidation-plan-hardening-20261117`.  
**Base de elaboração:** `close-final-candidate@9c2a43e2ed63254a94ae698cac52c476a3fb2653`.  
**Snapshot da fila:** 242 PRs abertos na consulta de 2026-11-17; o número é móvel e deve ser renovado no início da execução.  
**Produto-alvo:** uma única **Orchestra Sucafina Edition**, usando shell, navegação, temas e arquitetura visual do Orchestra.

## 1. Precedência documental

Para esta campanha, a ordem de autoridade é:

1. `execution-plan.md` — estratégia, escopo, ordem e gates.
2. `runbook.md` — procedimento operacional passo a passo.
3. `bundle-checklists.md` — checklist de entrada, execução e saída.
4. `ledger.schema.json` — contrato de cada registro do ledger.
5. `ledger.example.jsonl` — exemplos não canônicos.
6. `../single-edition-consolidation.md` — arquitetura do produto único.
7. `../t2-equivalence-map.md` e `../t8-auth-frontier.md` — restrições específicas de equivalência e autenticação.
8. `../open-pr-audit.md` — evidência histórica parcial dos primeiros 100 PRs auditados.

Os documentos abaixo são históricos e não devem mais dirigir a execução:

- `../open-pr-merge-plan.md`;
- `../open-pr-parallelization.md`;
- `../consolidation-board-2026-11-17.md`.

Eles permanecem no repositório apenas para preservar contexto e proveniência.

## 2. Resultado esperado

A campanha transforma a fila histórica em quatro unidades reais de integração e uma promoção:

| Ordem | Branch/PR | Responsabilidade |
|---:|---|---|
| A | inventário read-only | classificar todos os PRs abertos e congelar a topologia |
| B0 | `consolidate/00-baseline-green` | base, tipos, fixtures compartilhados, guards e CI |
| B1 | `consolidate/10-platform-runtime` | runtime, host, auth, origin, desktop e transportes |
| B2 | `consolidate/20-business-product` | domínios, documentos, drafts e jornadas de negócio |
| B3 | `consolidate/30-native-shell` | shell Orchestra, UX nativa, retarget e aposentadoria do legado |
| Final | PR `#237` | prova do merge ref, artefatos, UAT e promoção para `go-live-close` |

O alvo é **quatro PRs de integração**, não quatro commits gigantes. Cada bundle contém commits de checkpoint pequenos, revisáveis e reversíveis.

## 3. Regra operacional em uma frase

> Branch antiga é fonte read-only de evidência; somente residual comprovado é reimplementado em bundle novo criado do HEAD canônico.

Não se rebaseia a fila inteira. Não se mergeia PR histórico diretamente por conveniência. Não se aceita vermelho “compartilhado” depois de B0.

## 4. Restrições invioláveis

- Sem `bun test`, build ou typecheck local durante esta campanha; o oráculo é GitHub Actions.
- Runner de qualificação: Linux x64 conforme o workflow canônico.
- Sem skip, `xfail`, cast, `any`, ignore, timeout inflado, assert relaxado ou guard removido.
- Sem edição de receipts históricos, hashes assinados ou `research/**`.
- Sem CORS amplo, token no renderer, grant inventado ou sessão simulada.
- Sem deploy, VM, semeadura OPEX ou GO automático por causa destes documentos.
- Um único writer por bundle; leitura e mineração podem ser paralelas.
- Todo merge é serial e protegido por lease do SHA da base.
- Qualquer drift da base expira CI, review e mergeability do candidato.
- O PR `#237` é promoção; não recebe feature escondida.

## 5. Como começar

1. Ler `execution-plan.md` por inteiro.
2. Copiar os checklists de `bundle-checklists.md` para o PR de campanha.
3. Criar o ledger real conforme `ledger.schema.json`.
4. Executar a Fase A e B0 em paralelo controlado.
5. Não iniciar B1 até o inventário completo não possuir registros `UNREVIEWED` ou `UNKNOWN`.

## 6. O que este conjunto corrige

Este conjunto corrige os problemas encontrados na revisão adversarial:

- o inventário anterior cobria apenas uma parte da fila;
- o diff de merge-base era chamado incorretamente de “delta autoral”;
- o congelamento da base não tinha mecanismo de lease;
- B0 misturava reparo de baseline com features históricas;
- B1/B2/B3 não tinham ownership inequívoco de paths;
- quatro PRs podiam virar quatro big-bangs;
- a política de rerun integral era cara e pouco diagnóstica;
- o #237 era tratado como branch que precisava de “atualização de SHA”, apesar de seguir `close-final-candidate` automaticamente.
