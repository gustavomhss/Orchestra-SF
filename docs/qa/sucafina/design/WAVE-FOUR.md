# Quarta rodada — vinte áreas nativas da Sucafina

Status: **MERGED_VERIFIED**. [PR #588](https://github.com/gustavomhss/Orchestra-SF/pull/588), implementado na branch `sf-design-twenty` e mesclado em `dev` no commit `f2a6c23551289ef8705baea03f8cec2425b8445a`. O usuário aprovou expressamente: “aprovado pra merge”. [Registro e recibo do merge](wave-four/MERGE.md).

## Entrega

As próximas vinte áreas do inventário são CAP20–CAP28, UI30–UI32 e UI34–UI41. Elas abrangem **49 padrões de rota existentes**. Somadas às 21 áreas anteriores já mescladas, a campanha passa a **41 implementadas de 70**, com **29 restantes**. Os 20 itens deste bloco estão aprovados e mesclados; as 41 áreas implementadas da campanha estão integradas.

| Grupo | Áreas | Rotas existentes | Evidência |
| --- | --- | ---: | --- |
| Planejamento | CAP20 Headcount; CAP21 Alocações; CAP22 FX; CAP23 Versões/Comparação | 14 | [Galeria](wave-four/evidence/planner/README.md) |
| Compras | CAP24 Visão geral; CAP25 Requisições/Fila/Sourcing; CAP26 Aprovações; CAP27 Fornecedores; CAP28 Configurações | 17 | [Galeria](wave-four/evidence/procurement/README.md) |
| Trabalho | UI30 Meu trabalho; UI31 Busca; UI32 Visões salvas | 5 | [Galeria](wave-four/evidence/work/README.md) |
| Decisões | UI34 Intenção; UI35 Alternativas; UI36 Premissas; UI37 Perguntas; UI38 Escolha; UI39 Alterações; UI40 Histórico/Recibos; UI41 Análises | 13 | [Galeria](wave-four/evidence/decisions/README.md) |

[Galeria consolidada](wave-four/evidence/README.md) · [Validação completa](wave-four/VALIDATION.md) · [Mapa exato](wave-four/scope.json) · [Inventário geral](inventory.json)

## Composição e comportamento

A composição mantém o sistema visual nativo: eixo de conteúdo de 1160px, espaçamento de 32/24/16, controles de 44px, painéis compactos e etapas claras de lista, edição e revisão. Tabelas densas usam rolagem interna; referências longas ficam em disclosures acessíveis quando secundárias. Os textos ingleses existentes continuam literais, com português explícito nas novas mensagens.

Planejamento reúne as fontes, proveniência, editor e confirmação sem perder o contexto. Compras diferencia fatos submetidos, fonte atual e proposta; preserva cotação selecionada, notas e versões. Trabalho mostra o contexto antes da navegação autorizada; Visões salvas preserva os filtros e o período na gravação. Decisões apresenta evidências, lacunas, divergências, escolhas e histórico com a incerteza que a fonte realmente retorna.

A qualificação encontrou e corrigiu problemas funcionais na integração: metadados reativos do Solid chegando a schemas fechados, perda de projeções nativas, seleção de período nas aprovações, realimentação reativa nas configurações, readiness das leituras originais os descritores A15 cuja rota exigia um campo ausente do input e uma seleção expirada de Compras que bloqueava indevidamente a leitura de casos Planner após cinco minutos. Esses reparos mantêm CAS, idempotência, grants, produtores originais e rejeição de entradas inválidas.

Os dados de teste das jornadas são identificados e criados pelos produtores originais. Os estados vazios e indisponíveis preservam o retorno das fontes; nenhum resultado ou recibo foi fabricado. Busca foi validada com resultado canônico vazio; visões V2 continuam indisponíveis; detalhes de execução e limitações de fontes estão no relatório.

## Verificação

O candidato técnico `0550c4bb8fc3b4b4e68561777010ca03483e2391` incorpora `dev 2eeb114266f8b9c9df9bb8f78a02ccf242cdc68b`. [Gate17](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44972927162) passou **15 checks / 89 regressões**, com tipos da aplicação, E2E e CLI, zero erros de guardrails e paridade dos sete arquivos de paleta. As duas novas regressões de escopo somam 81 asserções; o teste negativo de Compras usa um fixture estrutural identificado e não qualifica uma primeira aplicação C12.

A galeria reúne **146 capturas revisadas**: 40 de Planejamento, 43 de Compras, 22 de Trabalho e 41 de Decisões. O [Decisions14](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44972048219) concluiu a jornada completa; as 56 leituras monitoradas retornaram HTTP 200, incluindo 21 depois de cinco minutos. As asserções também exigem conteúdo real no caso. A correção mantém TTL e autorização originais e aplica a exigência de seleção somente aos casos elegíveis para esse fluxo de Compras.

As jornadas reais e a revisão visual estão identificadas por grupo, snapshot e commit na [validação](wave-four/VALIDATION.md). Cada galeria mantém a origem exata das imagens. Chromium e viewports estreitos não são apresentados como cobertura de todos os navegadores, zoom real ou todas as combinações de estado.

A [auditoria de cópia](wave-four/copy-audit.json) preserva 574 textos ingleses existentes em dez catálogos; os nove textos novos têm português explícito. As 583 chaves atuais têm valor BR. O [registro A15](wave-four/A15-REVIEW.md) distingue a mudança de descritor de rota das formas de input/output, que permanecem intactas.

## Integração anterior e aceite

A outra sessão concluiu o PR #587, mesclado em `d9ab14b6d9cab74843b0689d5d67d1c70d45cc02`. Esta branch incorporou o merge real e, depois, 21 commits de dev com 80 caminhos distintos, em três composições. O único caminho sobreposto nas duas primeiras composições foi host-context.ts; as alterações de FSUtil e reviewer recall do upstream foram preservadas junto dos observadores nativos. A terceira composição copiou 18 caminhos por seus hashes exatos, sem sobreposição com o trabalho deste bloco. [Registro da composição](wave-four/DEV-COMPOSITION.md). Na integração final, dev avançou até `ad47c1b804452f3a7a943a7d4dad75d74a6367e5`: dez commits posteriores a dev2eeb, em 13 caminhos de segurança/logging do processo principal do desktop, sem sobreposição com este bloco. A árvore real do merge coincide com a união exata desses blobs e do HEAD aprovado. As execuções nativas continuam atribuídas aos seus produtos e snapshots originais.

Nenhuma branch da outra sessão foi alterada. O núcleo HuGR, o console legado branco/verde, workflows, guardrails e allowlists não foram modificados por este redesign. A execução ocorreu exclusivamente em snapshots do test-ci existente.

O PR #588 está fechado e mesclado. O inventário registra 41 áreas mescladas e 29 restantes. A autorização usada foi a aprovação expressa deste bloco após a apresentação das telas.
