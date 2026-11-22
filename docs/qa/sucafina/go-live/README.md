# Preparação do go-live — G05, G06, G07, G08 e G10

**As implementações e correções de preparação desta frente estão integradas em `dev`. Os cinco gates finais continuam abertos.** O código entregue inclui as provas HTTP/Team, os controles reais de ClamAV, o verificador do pacote, o executor privado de QA e o adaptador de backup/clone. Os recibos disponíveis são de candidatos de trabalho; a qualificação final depende do C/T confirmado, do tar original e das execuções instaladas autorizadas.

O [registro de execução](execution-2026-11-22.md) contém fontes, merges, runs, artefatos e hashes. O [registro estruturado](status.json) conserva os campos finais ainda nulos. Escopo recebido no [handoff c02f329d](https://github.com/gustavomhss/Orchestra-SF/blob/c02f329d48d37e2f6296154978cd8a7cf80bcb64/docs/qa/sucafina/astra-go-live-handoff.md).

## Donos e fronteiras

| Responsabilidade | Dono e situação |
| --- | --- |
| Preparação, ferramentas, coordenação e qualificação G05/G06/G07/G08/G10 | Esta sessão Astra; PRs #637, #638, #640, #644 e #639, complementadas por #660, #659 e #658, todas mergeadas |
| G01–G04, pool e integração do candidato | Sessão **Retomar migração para Microsoft Teams** |
| Residual #349 | Astra já responsável por essa frente |
| G09 e #588 | Gustavo e Astra já responsável |
| Aceite de Compras já realizado | Sessão **222 (2)**: 4/4 no QA em que foi produzido, conforme handoff |
| Confirmação do pacote, workflow, compilador e operador Release | Responsável operacional atual ainda sem ACK para C/T |
| Reserva QA, host, sessões Entra, grants e callbacks | Responsáveis operacionais ainda sem reserva confirmada nos canais consultados |
| Reserva G10, backup/chave, corte e observação independente de efeitos | Responsáveis operacionais ainda sem reserva confirmada nos canais consultados |

A integração de produto proposta na [#657](https://github.com/gustavomhss/Orchestra-SF/pull/657) continua com seu dono. Os paths das correções #659/#660 não se sobrepõem a essa integração. O produtor Microsoft do pacote continua sob Release; G07 verifica os bytes originais. As aprovações de outras frentes permanecem vinculadas aos seus próprios contratos.

## Estado por gate

| Gate | Entrega integrada e evidência disponível | O que falta para o gate final |
| --- | --- | --- |
| [G05](g05-g06-controls.md) | #637: 409/409 em cada modo coverage/auth/effect e 11 controles Team. #660: helper compartilhado com os mesmos 11 controles executados novamente | Reconciliar o inventário e repetir a seleção completa no C/T final integrado |
| [G06](g05-g06-controls.md) | #638 e #660: ClamAV real; execução expandida com 107 controles Node e 12 casos Bun/1.085 asserções, incluindo os oito legados, três Microsoft/Team e o caso G05 | Integrar e provar o importador privado na composição Microsoft; qualificar todos os controles no C/T final |
| [G07](g07-linux-package.md) | #640: verificador do tar original, 31 controles Node e 18 Python aprovados | ACKs Migração/Release, operador e disparo do produtor existente reconciliado com C; produzir e verificar o tar final |
| [G08](g08-teams-qa.md) | #644 e #659: executor adaptado ao seletor nativo e CAS opaco; 111 controles Node, 28 Python, quatro testes DOM/127 asserções; sete casos instalados apenas listados | Integrar contratos de produto; tar G07 instalado, reserva e atores reais; executar as nove obrigações completas e U15/U39/U40/F04/AZ02 |
| [G10](g10-cutover-rollback.md) | #639 e #658: runbook, backup/clone e recibo com identidade observada do destino; 17 controles de arquivos/SQLite aprovados | Operação de checkpoint lógico no tar Microsoft; tar e ambientes reservados; ensaio de backup, corte, retomada e rollback com efeitos posteriores preservados |

As contagens descrevem runs distintos nos SHAs registrados. Não houve um replay conjunto no candidato final. Em G08, os sete casos estão `LISTED_NOT_RUN`: cinco obrigações têm controles completos implementados, duas têm cobertura parcial e duas ainda dependem de composição de produto. **Todas as nove obrigações e os cinco grupos permanecem `NOT_RUN`.** Em G10, os testes conferem o mecanismo de arquivos; ainda não houve ensaio em VM reservada.

## Pré-requisitos e ordem de execução

1. A Migração conclui e integra G01–G04/pool e as dependências de produto, confirma a inclusão das ferramentas já integradas e entrega os recibos do candidato.
2. Migração e Release confirmam explicitamente o mesmo SHA C e árvore T, o dono executor, a rota produtora e a toolchain. Os ACKs devem preceder o job produtor. A Release precisa reconciliar o disparo do produtor existente, hoje restrito à branch histórica `g09-final-review`.
3. G05 e G06 executam as seleções completas sobre C, sem obrigações omitidas, com recibos e limpeza verificáveis.
4. Release produz o tar original de C; G07 verifica proveniência, bytes, manifesto, componentes e correspondência com os dois ACKs.
5. Operadores reservam e instalam os mesmos bytes em QA e recuperação. **G08 e G10 podem avançar em paralelo**, com processos, dados, sessões, escritores e callbacks isolados e seus pré-requisitos técnicos atendidos.
6. Consolidar os recibos finais e bloqueios de G01–G10 para a decisão de go/no-go. A janela e a virada de produção exigem aprovação específica posterior.

## Dependências técnicas já identificadas

O suplemento G06 usa a factory Microsoft original e confirma uploads privados isolados por Team. O produtor nativo `import-admit/import-preview` ainda não está montado por `runTeamBusiness` no código inspecionado; uploads de fornecedor não substituem essa obrigação.

G08 conserva as exigências de grants distintos, UI administrativa, chat/rascunho e descarte, além dos grupos completos. API administrativa e dois principals diferentes fornecem somente a cobertura parcial declarada. Os controles atuais recusam fechar o gate com o subconjunto disponível.

G10 distingue o backup físico do checkpoint lógico consumido por `recover`. A API de captura existe internamente, mas a factory Microsoft inspecionada não oferece uma operação instalada de captura. As etapas de checkpoint → efeito → restore → retry dependem desse contrato operacional. A integridade do clone, a utilização da chave e a recuperação de negócio são provas distintas.

## Evidência reaproveitada

O aceite **222 (2)** permanece **4/4, aceito no QA original**, incluindo gravação/releitura e revogação do acesso temporário. O backlink original com SHA/tar/reserva ainda não foi recuperado. Isso limita a vinculação ao candidato final, sem invalidar o aceite recebido.

As provas anteriores de HTTP, ClamAV, pacote, recuperação e Compras continuam no registro. As correções novas não transportam seus resultados para outro SHA nem convertem inventário de testes em execução instalada.

## Coordenação e critério de fechamento

Pedidos concretos foram publicados para [Migração e reservas](https://github.com/gustavomhss/Orchestra-SF/pull/628#issuecomment-7079652837), [Release e produtor](https://github.com/gustavomhss/Orchestra-SF/pull/247#issuecomment-7079656702), [checkpoint lógico](https://github.com/gustavomhss/Orchestra-SF/pull/628#issuecomment-7080174757) e [integração #657](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7080225251). Na última consulta registrada, esses canais não continham o ACK final nem as reservas. Isso não demonstra inexistência ou indisponibilidade dos ambientes. Pedidos desta frente não contam como confirmação dos donos.

O fechamento exige G05/G06 aprovados em C, G07 verificado nesse SHA, G08 comprovado no mesmo tar instalado e G10 comprovando backup, corte, retomada e rollback com efeitos e recibos pós-checkpoint preservados. **`qualifiedFinalGates` permanece 0/5 e `goNoGoReadiness` permanece `NOT_READY`.** Nenhuma virada de produção foi executada.
