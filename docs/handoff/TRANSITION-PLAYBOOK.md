# Playbook — como passar o trabalho de uma sessão CLI para um modelo só-GitHub

Este documento descreve a transição feita na campanha do Orchestra-SF: sair de uma sessão com shell (agente local, com acesso à máquina, worktrees e testes locais) e continuar o mesmo trabalho num modelo flagship que só tem GitHub MCP — sem terminal, sem acesso ao Mac, sem `bun install`.

Serve para qualquer sessão que precise repetir esse movimento.

---

## 1. Quando fazer a transição

Faça quando pelo menos uma destas condições aparecer:

- o modelo local perdeu capacidade (créditos esgotados, provider bloqueado, rate limit);
- o trabalho restante é longo e paralelizável, e o modelo de destino é melhor em horizonte longo;
- você quer o trabalho continuando enquanto a sessão local morre ou troca de contexto.

Não faça no meio de uma escrita: primeiro feche o estado (commit/push), depois transfira.

---

## 2. O que o modelo de destino consegue e não consegue

| Capacidade | Só-GitHub |
|---|---|
| Ler/escrever arquivos | Sim, via API de contents |
| Criar branches, commits, PRs | Sim |
| Rodar shell, `bun install`, `bun typecheck` | **Não** |
| Rodar `bun run test:ci` (wrapper local) | **Não** |
| Disparar workflows, ler logs e artefatos | **Sim** |
| Acessar `/tmp`, worktrees locais, VM, Azure | **Não** |

Consequência: toda instrução que dependa da máquina local é ruído. Verificação tem de ser redesenhada para Actions.

### Mecanismos reais de verificação remota (Orchestra-SF)

- **Change-scoped**: workflow `test-ci` roda em push de branch `ci-run-*` e lê `.ci-run.json` na raiz:
  ```json
  { "package": "app-shell", "runner": "playwright", "args": ["e2e/sucafina/operations.spec.ts"] }
  ```
  Criar `ci-run-<nome>` no SHA do WP, commitar o JSON, o workflow roda e apaga a branch.
- **Completo**: `sf-ci` (workflow id `420530405`), `workflow_dispatch` com `--ref <branch>`. Só no fim.
- **Pacote**: `sf-factory-package` roda em push da branch `sfa-factory-package`.

---

## 3. O que capturar antes de transferir

Um briefing só é bom se o destinatário não precisar perguntar nada. Capture, nesta ordem:

1. **Estado exato**: repo, branch de integração, SHA tip, e o que está mergeado. Confirme o SHA no repositório antes de escrever (`git rev-parse origin/<branch>`).
2. **O que já está pronto**, agrupado por capacidade (não por commit), com o que cada peça resolve.
3. **O que falta**, em work packages com `file:line` — não com descrição vaga. Cada WP deve ter: arquivos, o que está errado, o contrato real a usar, e o critério de aceite.
4. **Fatos do produto** que não podem ser inventados (operações mortas por desenho, formato de input de um comando, campos de projeção, rotas reais de download).
5. **Regras com motivo**: só as que são verdade de produto, decisão do dono ou exigência de gate. Cada regra em uma linha, com o porquê.
6. **Recusas corretas**: lista do que parece bug mas é fence — para o modelo não "consertar".
7. **Commits rejeitados**: e por quê, para não repetirem o erro.
8. **Mecânica de verificação** do destino, com comandos/ids exatos.
9. **Contrato de handoff** (seção 6).
10. **Formato de retorno** esperado.

Antes de publicar, valide no repo: números (contagem de resíduos), caminhos de arquivo, ids de workflow, nomes de operação. Briefing com número errado destrói a confiança do destinatário.

---

## 4. Como escrever (KISS)

- **Sem restrição inventada.** Se não é verdade de produto, decisão do dono ou gate, não vire regra. Modelo flagship não precisa de coleira; precisa de fatos e critério.
- **Sem complexidade cerimonial.** Nada de "nunca faça X sem antes Y" que você mesmo não cumpriu.
- **Curto por seção, denso por linha.** Um WP cabe em 3–6 linhas com `file:line`.
- **Diga o que fazer, não o que evitar** — exceto onde evitar é a regra.
- **Uma página de produto**, não um tratado: camadas, comandos, fluxo review/CAS, rotas, e2e.
- **Modo de trabalho explícito**: menor mudança que passa, uma verificação por WP, sem refactor adjacente, sem especulação, e "passou de ~20 min → entrega o que tem + handoff".

---

## 5. Passo a passo da transição (o que foi feito)

1. Fechar o estado local: `git fetch`, confirmar tip, fazer o último merge pendente, `bun typecheck`, push na branch de integração.
2. Cancelar o que estiver prematuro (ex.: um `sf-ci` disparado antes dos fixes) e cancelar wakeups agendados.
3. Inventariar o que falta, com `rg` por formas do console morto e pelas linhas `unbound` já reportadas pelos agentes.
4. Verificar os mecanismos remotos: triggers de `test-ci`, `sf-ci`, `sf-factory-package`; id do workflow.
5. Escrever o briefing em `docs/handoff/<nome>-brief.md`, com as seções da seção 3 deste playbook.
6. Escrever `docs/handoff/HANDOFF-TEMPLATE.md`.
7. Criar branch dedicada (`sf-handoff-brief`), commitar com mensagem convencional (`docs(handoff): ...`), push. **Nunca** na base.
8. Produzir um **prompt curto** para colar: missão, contexto em 5 linhas, KISS, lista de WPs, mecânica, regras duras, contrato de handoff, formato de retorno, e o link raw do briefing completo.
9. Entregar ao dono: branch, commit, caminho do arquivo, URL raw.

---

## 6. Contrato de handoff (o que garante continuidade)

O destinatário **sempre** termina commitando `docs/handoff/HANDOFF-<branch>.md`, concluído ou não:

```md
# Handoff — <branch>
SHA: <sha>
Data: <ISO-8601>
Estado: complete | partial | blocked

## Feito
- <item> — <arquivos> — <run id + resultado>

## Pendente
- <item> — file:line — motivo (controle inexistente | produtor não calcula | decisão do dono)

## Decisões e justificativas
- Asserções removidas: <quais e por quê>
- Controles inexistentes: <file:line>

## Como retomar
1. <branch/SHA>
2. <primeiro passo>
3. <próximo passo>

## Gates
- ci-run-<nome> (run id): <resultado>
- sf-ci (run id): <resultado | não rodado>
```

Sem isso, uma sessão que morre no meio deixa o trabalho irrecuperável — e a próxima pessoa começa por arqueologia.

---

## 7. Como receber o trabalho de volta

1. Ler o handoff primeiro; ele diz onde parou e por quê.
2. Conferir o SHA e o diff dos branches de WP.
3. Reexecutar os gates **na sua máquina** o que o destinatário não podia rodar (typecheck, guards, e um teste change-scoped se necessário).
4. Merge sequencial por WP na branch de integração; typecheck a cada merge.
5. Só então o `sf-ci` único e o pacote.

---

## 8. Armadilhas já observadas

- **Referenciar caminhos locais** (`/tmp/...`, worktree, VM) num briefing para quem não tem shell. Todo artefato tem de viver no repo ou em Actions.
- **Contar com `bun run test:ci`**: é wrapper local. O equivalente remoto é `ci-run-*` + `.ci-run.json`.
- **Sobre-restrição**: regras inventadas param um modelo bom e não impedem nada que o produto já impede.
- **Número desatualizado**: contagem de resíduos muda a cada merge; reconte antes de publicar.
- **Deixar o destinatário recriar o console morto** para "fazer o teste passar": precisa estar explícito que o console é 404 por decisão de produto.
- **Deixar usar operações mortas por desenho** (ex.: `output: Schema.Never`): diga qual é o caminho real.
- **Dois `sf-ci`**: concorrência por ref cancela o primeiro; só um no fim.
- **Rodar CI antes dos fixes**: é o erro mais caro da campanha; o briefing precisa dizer isso com todas as letras.

---

## 9. Checklist antes de entregar o prompt

- [ ] SHA no briefing confere com `origin/<branch>`.
- [ ] Caminhos e `file:line` existem.
- [ ] Ids de workflow e nomes de operação conferem.
- [ ] Nenhuma instrução depende de shell, `/tmp` ou máquina local.
- [ ] Há uma seção KISS com critério de "quando parar".
- [ ] O handoff é obrigatório e tem template.
- [ ] A branch do briefing não é a base.
- [ ] O prompt curto aponta para a URL raw do briefing.
