# Handoff — <branch>

SHA: <sha do último commit>
Data: <ISO-8601>
Estado: complete | partial | blocked

## Feito
- <wp ou item> — <arquivos> — <evidência: comando + resultado>

## Pendente
- <item> — file:line — motivo (controle inexistente no capítulo | produtor não calcula | precisa decisão do dono)

## Decisões e justificativas
- Asserções removidas: <quais e por quê>
- Controles que não existem: <lista file:line>

## Como retomar
1. <branch/SHA de onde partir>
2. <primeiro comando>
3. <próximo passo concreto>

## Comandos e resultados
- `bun typecheck` (app-shell): <0 | erros>
- `bun run check:guards --base origin/dev`: <0 errors | achados>
- `bun run test:ci ...`: <resultado | não rodado>
