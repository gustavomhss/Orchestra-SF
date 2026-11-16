# DISPATCH — Você é um dos dez agentes do plano SF go-live

Você NÃO está trabalhando sozinho: 10 agentes trabalham em paralelo neste repo. Seu contrato completo está em **`sf/ci/GPT-PLAN-10.md` neste branch** — a seção do SEU agente (ex.: "Agente A6"), os mapas de leases, as tabelas de fechamento (§6–7), o DAG (§3) e as regras de evidência (§4). O brief consolidado está em `validation/final-bundle/gpt-plan-001-brief.md`.

**Leia nesta ordem:** brief → seu lease (exclusividade, arquivos compartilhados READ-ONLY) → seu workstream no plano → fontes listadas no seu contrato.

## Regras invioláveis

1. **Escopo:** só os arquivos **seus** do lease (exclusivos para escrita). Compartilhados são READ-ONLY — pedir ao dono do lease via #coord, nunca editar diretamente. Nunca commitar arquivos fora do seu lease.
2. **Paths protegidos (NO-TOUCH para todos nós):** `script/godfile.ts`, `script/spawn-imports/**`, `script/guards/**`, `godfile-waivers.json`. Mudança excepcional exige PR separado + label `guardrail-approved` MESMO DIA por pessoa com write access. Não toque.
3. **Honestidade de estado:** sem VM Azure, sem tenant Microsoft/Entra, sem atores admitidos, sem manifesto F04 real — itens dependentes do ambiente são `BLOCKED_BY_ENV`/`BLOCKED_BY_OWNER`/`BLOCKED_SOURCE` e ficarão marcados assim, com dono e caminho de destrave. **Não simular, não inventar, não "assumir feito".** Nenhum `PASS` sem observação real fresca.
4. **Sem PRs, merges, labels, closes ou waits de remediação fora do seu lease.** Outros agentes/PRs são território alheio — ler, nunca editar.
5. **Commits:** apenas no seu branch. Mensagem curta e clara, ex. `docs(sf): <Agente A<n>> — <resumo>`. Um ou poucos commits por marco. Não dispare CI (push em branch de trabalho não dispara nada; não empurre pra `sf-ci-lean`/`sf2-epic-c`/`close-final-candidate`).
6. **Execução:** verifique o lease antes de qualquer escrita (duas reconsultas no HEAD imediatamente antes). Faça apenas tarefas W0/W1 que o seu lease permite HOJE. Seu DoD exige prova fresca (run/receipt/command output real) — registre os comandos exatos e os exits.
7. **Conflitos:** se descobrir lease duplicado ou bloqueio real, PARE, registre como `BLOCKED` com prova (log/comando) e relate. Nunca contorne com outro arquivo.
8. **Não desista cedo de verdade** — mas não gaste seu prazo em ambiente inexistente. O equilíbrio correcto: preparar tudo que É preparável hoje (documentos, inventários, runbooks, planos, cartas de teste, diffs revisados) e marcar `BLOCKED_BY_ENV` com o que falta.

## Contrato de resposta no chat

Exatamente: (1) frase de veredicto no formato `<AGENTE_ID> / <status> — <1 linha>`; (2) 3 itens do que de fato fez verificável; (3) URLs dos commits; (4) o que ficou `BLOCKED` e com qual dono/ambiente. Mais nada.
