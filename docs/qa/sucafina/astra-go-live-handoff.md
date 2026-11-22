# Handoff para o Astra — preparação do go-live do Orchestra-SF

## Objetivo

Assuma a preparação de G05, G06, G07, G08 e G10 com entregas que possam ser verificadas no candidato de produção. Trabalhe em paralelo com a correção do G03/G04, preservando um dono por componente. O alvo de integração dos deltas de produto é dev. Em 22/11/2026, a ponta remota conferida era 79912446753af5bb291fc2581543732eb4c83057. Esse SHA serve de referência para a triagem. O candidato final ainda precisa ser fixado.

A sessão **Retomar migração para Microsoft Teams** mantém a integração de G01–G04 e do pool. O agregado 44984930949 terminou vermelho, embora o pool tenha subido para 195/206. O **222 (2)** encerrou o aceite de Compras na instalação de QA testada, com 4/4 em leitura, gravação/releitura e revogação do acesso temporário. Reaproveite essa evidência com o escopo do candidato em que foi produzida. O bundle do #349 segue com outra sessão Astra, na branch audit-residual-bundle. G09 e #588 ficam na coordenação já acordada com Gustavo. [CI integrado](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44984930949)

## O que preparar agora

| Gate | Entrega | Evidência para fechar |
| --- | --- | --- |
| **G05 — HTTP** | Conferir o wiring existente do exercitador e identificar um único dono do transporte/Server. Preparar execução focada de coverage, auth e effect no candidato. | Recibos dos três modos, incluindo Team admitido e acesso de owner incorreto recusado, com cobertura sem casos omitidos. |
| **G06 — Scanner** | Conferir a rota Teams do workflow de scanner e preparar o reaproveitamento dos controles ClamAV reais de Files/Operations. | Três controles executados contra a instalação pertinente: scanner real, arquivo malformado e admissão privada. Cada recibo vincula candidato, controle e resultado. |
| **G07 — Pacote** | Identificar e reconciliar a rota suportada de empacotamento Linux x64, a factory Microsoft, a integridade e a prova de instalação. Preparar a entrada e o esquema do recibo. | Tar verificável com SHA/árvore de produto, hash do artefato, hashes dos componentes e verificação da instalação a partir do tar. A geração final depende do pin de release. |
| **G08 — Teams em QA** | Conferir a reserva do ambiente isolado e o responsável pelas sessões Entra. Preparar a matriz de homologação instalada com identidades autorizadas e sessões reais separadas. | Mesmo tar do G07 instalado em QA. A/B/A, usuários do mesmo Team com grants distintos, duas janelas, deep link/reload, revogação/logout e admin sem Team, com evidência sanitizada. |
| **G10 — Virada e recuperação** | Preparar runbook e identificar dono do backup, corte, restauração e rollback. Definir pré-condições, dados e atores, critério de seguir/reverter e evidência coletada no ensaio. | Ensaio isolado no tar final com inventário e destino dos dados, backup e chave disponíveis no fluxo autorizado, controle do escritor, restart/retry e rollback que preserva os recibos e efeitos após o checkpoint. |

## Sequência e prestação de contas

1. Comece pela matriz de donos, evidências existentes, lacunas verificadas e trabalho que já está em andamento. Resolva sobreposição com a migração e a pessoa responsável pela release antes de editar caminhos compartilhados.
2. Avance a preparação de G05/G06, pacote, QA e runbook em paralelo. Após fechar os gates anteriores e fixar o SHA final, vincule G07 ao tar. G08 e G10 podem executar em paralelo sobre esse tar, em ambientes isolados autorizados.
3. Entregue um checkpoint por gate com dono, SHA/branch ou artefato, prova reaproveitada, primeiro bloqueio, decisão pendente e critério verificável de fechamento. Registre cada aprovação apenas para a árvore e o artefato observados.
4. A autorização desta etapa cobre preparação e coordenação. A virada de produção depende da aprovação específica da janela e de go/no-go. Preserve as frentes existentes e seus recibos.

## Referências disponíveis no GitHub

- [Plano original de teste Teams e critérios dos gates](https://github.com/gustavomhss/Orchestra-SF/blob/736a5087c223629be4d73c8a4535d615fcafd96a/docs/architecture/teams-profile-test-plan.json).
- [Mapa de aceite Teams](https://github.com/gustavomhss/Orchestra-SF/blob/736a5087c223629be4d73c8a4535d615fcafd96a/docs/architecture/teams-profile-acceptance-map.json).
- [Candidato em reparo e CI do pool](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44984930949) e [relatório G04](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44984930949/artifacts/14739143467).
- [Port de Compras no Teams](https://github.com/gustavomhss/Orchestra-SF/pull/586), [prova focada Gateway](https://github.com/gustavomhss/Orchestra-SF/pull/592) e [compatibilidade com o mount de QA](https://github.com/gustavomhss/Orchestra-SF/pull/604).
- [Bundle separado do #349](https://github.com/gustavomhss/Orchestra-SF/tree/audit-residual-bundle).
