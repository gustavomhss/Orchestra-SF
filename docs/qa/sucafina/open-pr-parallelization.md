# Paralelização da campanha de consolidação

> **STATUS: plano atual.**  
> A antiga matriz por seis waves foi substituída pela topologia de quatro bundles. O detalhe normativo está em `consolidation/execution-plan.md` e `consolidation/runbook.md`.

## 1. Regra central

Leitura é paralela. Escrita no bundle é unitária. Merge é serial.

## 2. Capacidade por fase

| Fase | Miners read-only | Writers | CI triagers | Reviewers | Merges simultâneos |
|---|---:|---:|---:|---:|---:|
| Inventário | até 16 | 1 no ledger | 0–1 | 2 por família crítica | 0 |
| B0 | até 6 | 1 | 1 | 2 | 1 |
| B1 | até 8 | 1 | 1 | 2 | 1 |
| B2 | até 12 | 1 | 1–2 | 2–3 | 1 |
| B3 | até 8 | 1 | 1 | 2–3 | 1 |
| Final #237 | até 4 | 0 para feature | 1 | 3 | 1 |

Os números são tetos, não metas.

## 3. O que miners podem fazer

- capturar metadata;
- pin de heads;
- paginação de changed files;
- ancestralidade;
- blob e patch-id;
- classificação por path;
- preparar patch focal;
- cold review;
- baixar e agrupar logs.

## 4. O que miners não podem fazer

- push na branch do bundle;
- rebasear source branch;
- force-push;
- resolver conflito semântico;
- fechar PR;
- alterar guard;
- declarar CI verde;
- mergear.

## 5. Writer único

O integrador:

- recebe os records classificados;
- reimplementa o residual sobre a base atual;
- cria commits de checkpoint;
- mantém ownership;
- responde por lease;
- publica o head final.

## 6. Barreiras

- B1 aguarda B0 e inventário completo.
- B2 aguarda B1.
- B3 aguarda B2.
- #237 aguarda B3 e ledger terminal.
- Qualquer drift da base interrompe a fase.
- Mudança após review invalida a review.
- Mudança após CI final exige novo CI.

## 7. Paths compartilhados

Quando dois escopos tocam o mesmo arquivo:

1. identificar o owner semântico;
2. apenas o owner altera o arquivo;
3. o outro bundle registra dependência;
4. não duplicar fix;
5. se a fronteira não puder ser decidida, marcar `BLOCKED_SEMANTIC_CONFLICT`.

## 8. Merge

Nunca mais de um merge em `close-final-candidate` ao mesmo tempo. Depois de cada merge:

1. atualizar `BASE_EXPECTED`;
2. revalidar ledger afetado;
3. criar o próximo bundle do novo head;
4. não reaproveitar CI ou review do head anterior.
