# Preparação do go-live — G05, G06, G07, G08 e G10

**A frente avançou de preparação para integração e execução de controles reais, mas os cinco gates finais continuam abertos.** A composição nativa de Imports, a rota Release admitida e o checkpoint lógico Microsoft estão integrados. A adaptação G08 tem nove controles implementados e testados como componentes numa composição explícita; aguarda a integração de produto #665. Ainda faltam o C/T final, os ACKs reais, o tar e as qualificações nos ambientes reservados.

O [registro de execução](execution-2026-11-22.md) contém fontes, merges, runs, artefatos e hashes. O [registro estruturado](status.json) conserva os campos finais nulos e separa provas históricas, componentes e execução instalada. Escopo original: [handoff c02f329d](https://github.com/gustavomhss/Orchestra-SF/blob/c02f329d48d37e2f6296154978cd8a7cf80bcb64/docs/qa/sucafina/astra-go-live-handoff.md).

## Mandato atual, donos e fronteiras

Gustavo atribuiu a esta sessão os três próximos trabalhos: **coordenar a integração do candidato; confirmar e executar a rota Release admitida; obter e conferir as reservas QA/G10**. A ampliação foi registrada na [coordenação #657](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7080753498). Ela autoriza o avanço desses trabalhos e não constitui ACK de um candidato ainda indefinido, confirmação de reserva ou aprovação de produção.

| Responsabilidade | Dono e situação |
| --- | --- |
| Preparação, ferramentas e qualificação G05/G06/G07/G08/G10 | Esta sessão Astra, com revisão técnica entre subfrentes |
| Integração do candidato e coordenação G01–G04/pool | Esta sessão coordena o fechamento e consome as entregas da Migração; intake #673 com escritor `focal_migration`; recibos e aprovações permanecem por fonte |
| Integração Teams de produto | #657 integrada; #665 é a integração posterior de Session/Chat/admin, com escritores ativos preservados e reparos em andamento |
| Imports Microsoft e controles G05/G06 | #670 integrada, mantendo os oito controles legados, três Microsoft/Team e os 11 controles internos G05 |
| Confirmação e produção Release | Esta sessão prepara/coordena a rota #668; dono/operador real e dois ACKs para C/T ainda não confirmados |
| Reserva QA, host, sessões Entra, grants e callbacks | Obtenção/conferência assumida; responsáveis operacionais e reserva exclusiva ainda não confirmados |
| Reserva G10, backup/chave, corte e observador externo | Obtenção/conferência assumida; nenhuma reserva ou observação instalada comprovada |
| Aceite de Compras já realizado | Sessão **222 (2)**: 4/4 no QA em que foi produzido, preservado conforme o handoff |
| #349 | Astra já responsável, fora desta escrita |
| G09 e #588 | Gustavo e Astra já responsável; a rota Release conserva o produtor e os jobs G09 originais |

O papel nativo `recovery` do plano pertence a **G10**. A avaliação de G09 permanece separada. Um comentário técnico, identidade compartilhada de conta ou merge de ferramenta não substitui o aceite do dono de um gate.

## Estado por gate

| Gate | Entrega e evidência disponível | O que falta para o gate final |
| --- | --- | --- |
| [G05](g05-g06-controls.md) | #637: 409/409 em cada modo coverage/auth/effect e 11 controles Team no SHA original. #660 e #670 repetiram o caso Team com os mesmos 11 controles; HTTP/SQLite reais, identidade Entra/Graph controlada | Concluir a integração e repetir o inventário completo corrente sobre C/T final, incluindo coverage/auth/effect; não herdar o 409 histórico |
| [G06](g05-g06-controls.md) | #638/#660 preservadas; #670 montou Imports nativo Microsoft/Team e passou 162 Node + 16 Bun/126.359 asserções, com scanner real, payload inválido, autoridade, isolamento, limite de intake e cleanup | Reexecutar a seleção completa v3 no candidato integrado final; qualificação de componente não prova tenant ou instalação real |
| [G07](g07-linux-package.md) | #640 verificador original; #668 rota B/C/T/Q, ACKs reais antes do build e produtor original preservado; 68 Node + 18 Python, guards limpos | C/T confirmado, ACKs e operador reais, produção do tar original e verificação dos seus bytes/proveniência |
| [G08](g08-teams-qa.md) | #644/#659 históricas; #672 revisada, testada em composição explícita #665 + nove blobs G08: 134 Node, 28 Python, oito DOM/243 asserções e nove casos apenas listados | Integrar #665/#672; reservar e instalar o mesmo tar; executar nove obrigações, U15/U39/U40/F04 e prova LIVE transversal AZ02 |
| [G10](g10-cutover-rollback.md) | #639/#658 backup/clone com 17 controles; #669/#674 integradas: captura lógica e recuperação por política corrente, 41 PASS/um skip preexistente, 403 asserções; oito casos novos passaram | Conservar o contrato na integração final; reservas, R retido, backup/chave/observador e ensaio instalado de corte, retomada e rollback |

As contagens pertencem aos runs e fontes registrados, não a um replay conjunto. **G08 instalado permanece NOT_RUN em todas as nove obrigações e cinco grupos de acompanhamento.** U15/U39/U40 e F04 são obrigações diretas de G08; AZ02 é evidência operacional LIVE transversal, com 32 registros/seis fases, e não uma suíte Playwright adicional. O quinto papel nativo é recovery/G10. Nenhuma VM reservada executou o ensaio G10 nesta frente.

## Integração em curso e dependências técnicas

A primeira base Teams [#657](https://github.com/gustavomhss/Orchestra-SF/pull/657) entrou em `ad6d245119ef2d69fb96471edd62dd6413ae185f`. A [#665](https://github.com/gustavomhss/Orchestra-SF/pull/665) integra os contratos posteriores. Seu replay observado em `fde191dfc1970d37021d82370cccac657efac246` foi classificado pelo integrador como [**19/22 gates**](https://github.com/gustavomhss/Orchestra-SF/pull/665#issuecomment-7081262811): dois casos falhos (HTTP inválido retornando 500 e encerramento SSE) e o gate que recusa um WARN do gerador. Os reparos posteriores continuam ativos; a prova G08 focada não substitui esse replay.

A [#673](https://github.com/gustavomhss/Orchestra-SF/pull/673), intake `f382029d7be3f4e31440814f7b3e16038ad65329`, reconcilia 205 caminhos de G01–G04/pool. Na fonte do [run 45035419728](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45035419728), SF4 e SF5 passaram; SF8, UI Decisions, UI Operations e pool falharam. O [manifesto imutável do intake](https://github.com/gustavomhss/Orchestra-SF/blob/f382029d7be3f4e31440814f7b3e16038ad65329/docs/qa/sucafina/go-live/migration-intake.json) preserva os recibos. Esta consolidação não altera esse arquivo nem assume um PASS da Migração.

As duas lacunas assumidas nesta retomada têm entregas concretas:

- **Imports:** #670 monta `import-admit/import-preview` nativos na composição Microsoft/Team, com serviços/authority/ClamD originais. O upload de fornecedor da #660 permanece prova distinta; seu recibo não foi promovido.
- **Checkpoint:** #669 expõe observação/captura lógica e #674 usa política persistente corrente na recuperação. O backup físico, a utilização da chave e o observador independente continuam provas separadas. A integração #665 deve admitir `checkpoint` no decoder privado e conservar os hooks/política.

## Descoberta operacional — bloqueio observado

As PRs [#666](https://github.com/gustavomhss/Orchestra-SF/pull/666) e [#671](https://github.com/gustavomhss/Orchestra-SF/pull/671) entregaram inventário Azure somente leitura. O [run 45036787201](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45036787201), job `137252212765`, parou antes do login: as quatro variáveis Azure vieram vazias no preflight e a autenticação foi **SKIPPED**. O environment `azure-mvp` existe; sua resposta não apresentou políticas de proteção. Runners e nomes de variáveis retornaram 403; branch-policy retornou 404.

A consulta a GitHub Settings estava deslogada, e o inventário de desktop encontrou apenas um Mac offline. Isso limita os caminhos de descoberta tentados. **Não demonstra ausência de ambientes, reservas ou infraestrutura.** Nenhum host foi modificado, nenhum parâmetro privado histórico foi publicado e nenhum login Azure foi executado nesse run. ZIP/CRC e recibos minimizados foram conferidos; os hashes estão no registro de execução.

## Ordem de qualificação final

1. Concluir e integrar os slices de produto e G01–G04/pool, consumindo os recibos originais e resolvendo os gates pendentes com os escritores atuais.
2. Migração e Release confirmam explicitamente o mesmo SHA C e árvore T, com papéis e operador. Preparar B sem alterar C; os ACKs devem anteceder o job produtor.
3. Executar G05 completo e G06 v3 sobre C, sem omissões, com inventário, autoridade, efeito e limpeza verificáveis.
4. A referência `release-build-<B>` em C aciona o produtor original; depois Q e `g07-qualify-<Q>` em C verificam o ZIP/tar original. Conferir proveniência, manifesto, componentes e os dois ACKs reais.
5. Operadores confirmam reservas e instalam os mesmos bytes em QA e recuperação. **G08 e G10 podem avançar em paralelo**, com processos, dados, sessões, escritores e callbacks isolados.
6. Reunir os recibos exigidos por cada gate e os resultados das outras frentes para a decisão de go/no-go. A cobertura G08, isoladamente, não fecha G01–G10. Janela e virada de produção exigem aprovação específica.

## Evidência reaproveitada e critério de fechamento

O aceite **222 (2)** permanece **4/4, aceito no QA original**, incluindo gravação/releitura e revogação do acesso temporário. O backlink original com SHA/tar/reserva ainda não foi recuperado. Isso limita a ligação ao candidato final sem invalidar o aceite recebido.

As provas anteriores de HTTP, ClamAV, pacote, recuperação e Compras permanecem nos documentos e no ledger. Correções novas não transportam seus resultados para outro SHA nem convertem inventário em execução instalada.

O fechamento exige G05/G06 aprovados em C, G07 verificado no mesmo SHA, G08 comprovado no tar instalado e G10 comprovando backup, corte, retomada e rollback com efeitos e recibos posteriores preservados. **`qualifiedFinalGates:0/5`, `goNoGoReadiness:NOT_READY`.** C/T final, ACKs, tar, reservas, instalações e aprovações permanecem nulos. Nenhuma virada de produção foi executada.

### Observação de integração posterior ao replay

A #665 incorporou dev em `51278d55623f69f950785a9de8b8f1d0082bf62a`, incluindo #670 e #669/#674. Isso não promove os recibos antigos a esse head. A [#675](https://github.com/gustavomhss/Orchestra-SF/pull/675), fonte `2c27173bb983e8a609312795cbfa3068104e7cc6` / árvore `ae97fdcefa5b0148fa8faad4086f196a0bb23e34`, prepara a admissão explícita de `checkpoint` separada de `recover` e normaliza namespaces/operations omitidos para listas vazias, sem ampliar autoridade de negócio/Session. Seu snapshot CI é `2127c9112ee09a78a897c7b2dc7fb68ef5de2d36`; o resultado ainda está pendente nesta edição. Nenhum ACK final ou gate aprovado é inferido.
