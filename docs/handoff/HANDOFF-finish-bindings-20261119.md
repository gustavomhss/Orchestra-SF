# Handoff — finish-bindings-20261119

SHA: base d93d7c7687c2335cb89fd1e26bec562d07d9ec7f; o snapshot aponta para o commit de código.
Data: 2026-11-19
Estado: partial

## Feito

- Binding fechado decisions.decision-edit, sobre POST ?sf=decision-edit original de decision-domain-http:98–112, com caseRef/CAS, objetivo, critérios, evidências e opcionais reais. A resposta original de case-management.edit é {caseRef}; não foi fabricado recibo.
- Descoberta/inspeção Planner reutilizam bi.bi-options/bi.bi-data existentes, como o editor original. controls.forecasts contém apenas fontes já anexadas e não substitui o catálogo.
- UI34 recebe essas operações em seu recurso; nenhuma membership é tratada como autorização.
- Health de intenção/BI observa o vínculo montado original, dependências atuais, admissão do Request original, ação humana decisions.edit quando necessária, namespace C08 e revalidação antes/depois. Nenhum caso, seleção, fonte ou grant é criado pela observação.
- Codec unitário cobre valores/CAS exatos, rota original, rejeição de autoridade extra e preservação das negativas.

## Pendente

- packages/app-shell/src/orchestra/chapters/sucafina/decisions/intent/index.tsx:14 — editor de anexos sob finish-ingress-20261119; ainda não qualificado.
- apps/cli/src/sucafina-product/native-ui/decision-intent-health.ts:12 — qualificar na instalação real com UI33/34 e BI; o unitário de codec não prova readiness instalada.
- packages/client/test/sucafina/decision-edit.test.ts:12 — gate estreito ainda não iniciado ao gravar este documento.

## Decisões e justificativas

- Nenhum editor genérico de decisões: a frente de UI conserva os campos atuais e acrescenta somente evidência Planner inspecionada, após revisão explícita.
- A infraestrutura de sf_case_draft é ligada ao descriptor real draftCase e cases:write; a edição exige a ação humana original. Cada comando ainda executa suas verificações próprias.
- Asserções removidas: nenhuma. runtime/application.ts não foi editado.
- A branch parte de sf-join-four e permanece separada de Reports; common/registry/live-context/host-context requerem integração explícita das duas adições.

## Como retomar

1. Rodar o unitário do codec.
2. Compor esta branch com o editor UI34, ingresso qualificado e Reports, preservando as adições de ambas em common/registry/live-context/host-context.
3. Executar o spec BI instalado com valores/zeros/CAS originais, atualizar resultados e somente então integrar.

## Comandos e resultados

- GitHub Actions exclusivamente; nenhum shell local.
- Nenhum resultado de navegador ou GO declarado.
