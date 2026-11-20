# Handoff — sf-reports-artifact-audit

## SHA e estado

- Estado: **PARCIAL — diagnóstico preparado, sem execução nova**.
- Branch: `sf-reports-artifact-audit`.
- Base do leitor já executado pela integração: `12dd4126441861fb62f9306a3fa7ff0a1b47c656`.
- Código deste recorte: `63ea031a5ed0771b0c2d0403b483154d0ed0dc2b`.
- Tree de código: `a7669b98e0b37dbe2eb532a7bfc0123199a1e647`.
- O commit posterior acrescenta somente este handoff. Nenhum PR, merge ou gate foi criado por este agente.

## Evidência original congelada

| Campo | Valor confirmado pelo conector GitHub |
| --- | --- |
| Repositório | `gustavomhss/Orchestra-SF` |
| Run | `44660375065` |
| Job original | `136036842660` |
| Snapshot | `4cdba6118ff547d9ed23cd5cdb284e55e218d675` |
| Código pai do snapshot | `4ccf99576e6886b178c5502fc02bfa41bef6730c` |
| Artefato | `14596071954` |
| Nome | `playwright-ubuntu-24.04-1` |
| Tamanho | **365836 bytes** |
| SHA-256 declarado pelo GitHub | `2c1bb49b65772852b63c762a632ea6b12acfddf5bfd6c7088a9ae47d9a4eb488` |

A consulta `fetch_workflow_run_artifacts` confirmou também `expired: false` e a associação ao run/snapshot acima. O workflow confronta novamente esses campos antes do download por ID, com a action fixada em SHA. Este recorte não inventa digest nem trata o digest de metadata como um novo cálculo local do ZIP.

## Causa que motivou o diagnóstico

O run original terminou com quatro falhas. RPT-01 chegou à exportação depois da preservação e edição real de janeiro, mas `packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:415:24` não encontrou `[data-sf-surface="UI50"]`. RPT-02 falhou ao obter o corpo original de preview em `review-flow.ts:140:38`; RPT-03 e RPT-04 falharam no corpo original de discovery em `review-flow.ts:40:37`, com `Network.getResponseBody` sem dados para o identificador.

A leitura estática do código congelado excluiu uma ausência simples de rota, formulário ou operation ID: `reviews-route.tsx:46–57` exige `dashboard.dashboard-review`, `reviews.report.prepare` e `files.export.review`, já observados por `report-health.ts`. `review-report` é o `fixedQuery.sf` do prepare. UI50 existe fora do painel de disponibilidade em `reviews/reports/index.tsx:211`; o frame insere seus children sem condição em `shared/frame/index.tsx:240–242`. Isso ainda não distingue uma recusa/resolução F01 de uma exceção de render no run real.

O `ECONNREFUSED` do proxy apareceu no encerramento do caso; não foi promovido a causa do desaparecimento de UI50. A próxima leitura usa o `error-context.md` original de RPT-01, já retido no artefato, sem repetir o produto.

## Mudanças e fronteiras

1. `apps/cli/audit-reports-retained.node-smoke.mjs`: adaptação do leitor de Operations já existente. Lê somente o artefato baixado. Reconhece os quatro casos RPT-01..04 e, no fallback JSON, exige as linhas originais 26, 41, 107 e 123, Chromium, retry zero e resultado único.
2. `.github/workflows/test-ci.yml`: acrescenta seleção exata da requisição diagnóstica abaixo e dois passos condicionais: conferência de metadata e download fixado. Os passos do diagnóstico Operations permanecem intactos.
3. `docs/handoff/HANDOFF-sf-reports-artifact-audit.md`: este registro.

O leitor procura o relatório HTML com ZIP embutido e usa o JSON de runtime original se não houver um único relatório HTML válido. O fallback exige o `request.json` original com SHA, plataforma Linux/x64, pacote, diretório, runner, config e spec exatos. Ausência de steps permanece `not-recorded`.

A classificação de UI lê somente o fence `Page snapshot` do caminho original de RPT-01. O texto de `Test source` e `Error details` não é usado para afirmar que um controle esperado apareceu. A saída contém apenas códigos de labels conhecidas do F01, landmarks de Report/Agenda/meeting e da página de erro; categorias conhecidas de exceção; status/duração; nomes de `test.step`/API numa lista fechada; e `file:line:column` de paths do repositório permitidos. Ausência de um marcador não é prova de ausência do estado. Nenhum DOM, corpo de resposta, credencial, URL, identificador de review/principal/instalação ou erro bruto é impresso.

Este código não importa o produto, inicia browser/listener, faz request/replay de negócio, modifica dados, cria grants ou muda qualquer asserção. Nenhum uso do listener proibido. `reviews.export.docx/pptx` continuam `Schema.Never`; bytes de relatórios continuam vinculados ao GET original `?sf=review-download`. O fix CDP de retenção original pertence a outro recorte e não está neste branch.

## Merges, checks e pacote

- Ordem de merges deste recorte: nenhuma.
- PRs: nenhum; o diagnóstico temporário não qualifica merge de Reports.
- Verificação feita: leitura do diff e readback exato dos dois blobs de código no GitHub.
- Actions novas: nenhuma disparada por este agente. Root revisa e controla a leitura necessária.
- Guards: não executados neste recorte; nenhum resultado de guards é alegado.
- `sf-ci`: não executado; reserva de uma única corrida final continua com a integração.
- Baseline/coverage: nenhum alterado ou fabricado.
- Pacote/SHA-256 de pacote: não aplicável ao diagnóstico; nenhum pacote, GO, deploy ou marcador de verificação emitido.

## Como retomar

Root pode criar um único snapshot `ci-run-linux-*` do head desta branch, acrescentando somente `.ci-run.json` com:

```json
{
  "package": "cli",
  "directory": "apps/cli",
  "runner": "node",
  "args": [
    "audit-reports-retained.node-smoke.mjs"
  ],
  "env": {
    "ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER": "1"
  }
}
```

Reter as linhas `AUDIT_REPORTS_RETAINED_SOURCE`, `RESULT`, `RPT01_CONTEXT` e `SUMMARY`. A execução é uma leitura de evidência já produzida, sem novo Playwright ou inicialização do produto. Seu sucesso significa somente que o artefato foi lido sob as guardas declaradas. Após isso, decidir a correção causal de UI50 a partir dos marcadores observados; se não houver informação suficiente, manter `unbound(review-flow.ts:415)` explícito.

Não repetir um gate idêntico de Reports por este diagnóstico. Integrar somente correções concretas com a qualificação correspondente, preservando os quatro cenários originais e a autoridade real.
