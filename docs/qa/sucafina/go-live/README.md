# Preparação do go-live — G05, G06, G07, G08 e G10

**Ferramentas implementadas e provas de componente executadas; nenhum dos cinco gates está aprovado para o candidato final.** A qualificação final depende de C/T confirmados por Migração e Release, do tar original verificado e da execução nos ambientes isolados reservados. O estado e os recibos observados em 22/11/2026 constam no [registro de execução](execution-2026-11-22.md) e no [registro estruturado](status.json).

Escopo recebido no [handoff c02f329d](https://github.com/gustavomhss/Orchestra-SF/blob/c02f329d48d37e2f6296154978cd8a7cf80bcb64/docs/qa/sucafina/astra-go-live-handoff.md). Esta frente mantém os limites de posse e de produção estabelecidos pelo usuário.

## Donos e fronteiras

| Responsabilidade | Dono e situação |
| --- | --- |
| Preparação, ferramentas, coordenação e qualificação G05/G06/G07/G08/G10 | Esta sessão Astra; entregas nas PRs #637, #638, #640, #644 e #639, com registro consolidado na #628 |
| G01–G04, pool e integração do candidato | Sessão **Retomar migração para Microsoft Teams** |
| Residual #349 | Astra já responsável por essa frente |
| G09 e #588 | Gustavo e Astra já responsável |
| Aceite de Compras já realizado | Sessão **222 (2)**: 4/4 no QA em que foi produzido, conforme handoff |
| Confirmação do pacote, workflow, compilador e operador Release | Responsável operacional atual ainda sem ACK para C/T |
| Reserva QA, host, sessões Entra, grants e callbacks | Responsáveis atuais ainda sem confirmação para a execução final |
| Reserva G10, backup/chave, corte e observação independente de efeitos | Responsáveis operacionais ainda sem confirmação |

Os artefatos desta frente adicionam transportes e verificadores de prova, sem assumir G01–G04/pool, #349 ou G09. O produtor Microsoft de pacote continua sob Release; G07 verifica o tar original. O estado observado de G09 deve ser consultado na sua própria frente, sem transportar aprovação para G05–G10.

## Estado por gate

| Gate | Entrega e prova disponível | O que impede fechar |
| --- | --- | --- |
| [G05](g05-g06-controls.md) | Listener HTTP real, catálogo completo, três modos e isolamento Team com observação independente de estado; CI e SHA exatos no registro de execução | Repetir/aprovar no C/T final integrado; não herdar aprovação do candidato de trabalho |
| [G06](g05-g06-controls.md) | ClamAV real, 69 controles do verificador e 8 casos/218 asserções; arquivo benigno inválido e XLSX truncado recusados pela aplicação; cleanup observado | Nova execução no C/T final e composição pertinente; prova atual é de componente |
| [G07](g07-linux-package.md) | Verificador integrado; 31 controles Node e 18 Python; admite dois ACKs reais e verifica os bytes do produtor original | ACKs Migração/Release antes do build; tar final ainda não gerado por esta frente |
| [G08](g08-teams-qa.md) | Executor privado integrado; 84 controles Node, 28 Python; inventário de 9 casos listado sem execução instalada | Contratos UI/admin no candidato, tar G07, reserva e atores Microsoft reais; U15/U39/U40/F04/AZ02 mantêm provas próprias |
| [G10](g10-cutover-rollback.md) | Runbook e adaptador backup/clone integrados; 15 controles reais de arquivos/SQLite; origem R distinta do destino C | Tar final e ensaio reservado completo: chave utilizável, corte, efeito posterior, restart/retry e rollback compatível |

As contagens acima descrevem os runs referenciados, não um agregado executado sobre o mesmo candidato final. G08 registra nove casos como **LISTED_NOT_RUN**; não são nove passes de homologação. G10 prova o mecanismo de arquivos, não um corte nem recuperação de negócio.

## Pré-requisitos e ordem de execução

1. A Migração conclui e integra G01–G04/pool e fornece os recibos do candidato; a linha de preparação desta frente deve fazer parte de C.
2. Migração e Release confirmam explicitamente o mesmo SHA C e árvore T, o dono executor, a rota produtora e a toolchain. Os ACKs devem preceder o job produtor. O último agregado observado da Migração ainda está em falha; ver o registro com data e run.
3. G05 e G06 executam as seleções completas sobre C, sem casos obrigatórios omitidos, com recibos e limpeza verificáveis.
4. Release produz o tar original de C; G07 verifica sua proveniência, bytes, manifesto, componentes e correspondência com os dois ACKs.
5. Operadores reservam e instalam os mesmos bytes em QA e recuperação. **G08 e G10 podem avançar em paralelo**, mantendo processos, dados, sessões, escritores e callbacks isolados.
6. Consolidar os recibos finais e bloqueios de G01–G10 para a decisão humana de go/no-go. A janela e a virada de produção exigem aprovação específica posterior.

## Evidência reaproveitada

O aceite **222 (2)** permanece **4/4, aceito no QA original**, incluindo gravação/releitura e revogação do acesso temporário. O backlink original com SHA/tar/reserva ainda não foi recuperado. Isso limita a vinculação ao candidato final, sem invalidar o aceite recebido.

As provas históricas de ClamAV, pacote, recuperação e Compras continuam registradas em status.json e nos documentos de cada gate. Elas ajudam a preparar e revisar os mecanismos; o SHA testado, a identidade e o alcance de cada recibo permanecem explícitos.

## Coordenação e critério de fechamento

Pedidos persistidos para [Migração](https://github.com/gustavomhss/Orchestra-SF/pull/628#issuecomment-7074623731), [Release](https://github.com/gustavomhss/Orchestra-SF/pull/247#issuecomment-7074623941) e [empacotamento Microsoft](https://github.com/gustavomhss/Orchestra-SF/pull/257#issuecomment-7074624125). Comentários desta frente solicitando um ACK não contam como o ACK do dono. Nenhum SHA de dev é promovido automaticamente a candidato final.

O fechamento exige G05/G06 aprovados em C, G07 verificado nesse SHA, G08 comprovado no mesmo tar instalado e G10 comprovando backup, corte, retomada e rollback com efeitos e recibos pós-checkpoint preservados. **qualifiedFinalGates permanece 0/5 e goNoGoReadiness permanece NOT_READY** até esses recibos existirem. Nenhuma virada de produção foi executada.
