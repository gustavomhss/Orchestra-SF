# Preparação do go-live — G05, G06, G07, G08 e G10

**Os contratos de componente avançaram para `dev`; os cinco gates finais continuam abertos.** O candidato final ainda não foi fixado. Migração e #613 têm jornadas pendentes; faltam os dois ACKs para o mesmo SHA/árvore, o tar Linux verificado e as qualificações nas reservas QA e recuperação.

Observação desta edição: **22/11/2026 às 14:39:16 em America/Sao_Paulo (17:39:16 UTC)**. Último `dev` observado: `9db779820a54d251890b399c7f97ed99b333e228`, árvore `b0e17cdcc1a88348399e1d1254bd306ac8235504`. Essa identidade é uma base de integração observada; não é o candidato final aprovado.

O [registro estruturado](status.json) vincula cada prova à fonte/árvore, run, artefato e recibo. O [registro de execução](execution-2026-11-22.md) preserva as edições anteriores e detalha esta atualização. As observações antigas de “PR pendente” continuam históricas; o estado atual dos merges está separado no ledger.

## Mandato, responsáveis e fronteiras

A [coordenação #657](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7080753498) atribui a esta sessão integração final, Release, reservas QA/recuperação, importação privada Microsoft, checkpoint lógico, produtor do tar e executor G08. O mandato autoriza a preparação e integração revisada em `dev`; não confirma reservas, não aceita um candidato indefinido e não autoriza a virada de produção.

| Recorte | Responsável e estado |
| --- | --- |
| Integração final e G05/G06/G07/G08/G10 | Astra go-live; integra por PR revisado e recebe recibos completos |
| G01–G04 e pool | `focal_migration`, [#673](https://github.com/gustavomhss/Orchestra-SF/pull/673); seis jobs recebidos antes de novos deltas |
| UI42/UI43/UI44 e fechamento do design | Frente do [#613](https://github.com/gustavomhss/Orchestra-SF/pull/613); permanece no PR existente, 12/15 áreas qualificadas |
| Produto Teams | #665 integrada, complementada por #677/#685/#688/#689/#690; CAP03 em #691/#693 e jornadas em #694 |
| Release e tar | Astra coordena a rota #668; C/T, ACKs dos dois papéis e operador do produtor ainda pendentes |
| QA / Microsoft / grants | Reserva exclusiva, operador e identidades/sessões reais ainda sem confirmação |
| Recuperação / backup / chave / observador | Reserva isolada e responsáveis operacionais ainda sem confirmação |
| Aceite de Compras 222 (2) | 4/4 no QA original; preservar esse aceite, sem transferi-lo para outro tar |
| #349, #588 e escopo técnico G09/#647 | Encerrados; registros preservados, sem reabertura nesta frente |

Revisão técnica entre assistentes, COMMENT pela conta compartilhada e merge de ferramenta não substituem o aceite formal de um gate. O papel nativo `recovery` pertence a **G10**.

## Integrações recebidas

| PR | Merge em `dev` | Evidência e limite |
| --- | --- | --- |
| [#665](https://github.com/gustavomhss/Orchestra-SF/pull/665) | `5ba96127750f15fe221daebfc0635466997b69d6` | Integra Session/Chat/admin, contratos G08, decoder e fronteira Web. Os focais pertencem às suas fontes; nenhum replay agregado final é inferido |
| [#677](https://github.com/gustavomhss/Orchestra-SF/pull/677) | `5d0d3973a21b02df954e0e5cf31afe103960c23d` | [45047908103](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45047908103): 58/58 e 5.537 asserções. Árvore do merge igual à fonte testada; política privada corrente e cleanup EOF |
| [#685](https://github.com/gustavomhss/Orchestra-SF/pull/685) | `0fa4778b559963e0f3e7c60051060844d362e796` | Reader CAP25 original e executor AZ02. A correção de seus dois oráculos entrou separadamente por #695 |
| [#689](https://github.com/gustavomhss/Orchestra-SF/pull/689) | `428cb9f93c59288d299f57dc70ed93566eda6ec1` | [45048002949](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45048002949): 60 DOM/1.227 asserções. Hooks, navegação e folhas originais no shell Team |
| [#690](https://github.com/gustavomhss/Orchestra-SF/pull/690) | `d9194fc04428da9a6c0ebf348e84633968f77b51` | [45049032082](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45049032082): 8 HTTP nativos, 28 Microsoft e 1 caso G05 com 11 obrigações. Identidade controlada |
| [#688](https://github.com/gustavomhss/Orchestra-SF/pull/688) | `2fdc76d8b40cd62c2da4967a5b9533411af308df` | [45049241686](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45049241686): 33 Server e 1 factory CLI. Overflow tipado retorna 413; erro do handler não inicia nova leitura |
| [#692](https://github.com/gustavomhss/Orchestra-SF/pull/692) | `51d1879122f39bf894b3fc7d25c361ef2336753a` | [45049839950](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45049839950): 183 controles no inventário daquela fonte. Preserva 32 históricos e exige 37 AZ02 atuais |
| [#695](https://github.com/gustavomhss/Orchestra-SF/pull/695) | `9db779820a54d251890b399c7f97ed99b333e228` | [45050173497](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45050173497): 42 Node e 10 Bun/123 asserções; três paths, 78 guards limpos. Recusa exige JSON válido; MISSING_SELECTORS conserva media type JSON |

As contagens são **de fontes distintas**. #692 foi qualificada antes dos nove controles Node adicionais de #695; seus 183 casos não são o inventário agregado corrente. O merge de #695 preserva os três arquivos de #692, mas a execução de 9f5198 não é apresentada como execução conjunta do merge.

Os quatro achados da fronteira HTTP — limite real de bytes, semântica de JSON vazio, overflow tipado e erro sem consumo do corpo — estão entregues por #665/#688. Eles deixam de ser bloqueios de implementação; o replay completo do candidato final continua obrigatório.

## Estado por gate

| Gate | Prova de componente disponível | Trabalho necessário para fechamento |
| --- | --- | --- |
| [G05](g05-g06-controls.md) | HTTP/SQLite reais, isolamento Team e 11 controles internos repetidos; fronteiras Web corrigidas. Os 409/409 históricos de coverage/auth/effect permanecem na fonte original | Fixar C/T e executar coverage/auth/effect e isolamento completo no inventário corrente, com recibos e cleanup |
| [G06](g05-g06-controls.md) | [45046401550](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45046401550), fonte B4: 172 Node e 16 Bun/146.538 asserções; ClamD real, Imports privados, cinco fronteiras de política corrente e quatro fixtures limpas | Reexecutar a seleção completa sobre o candidato final; conferir payloads inválidos, autoridade, armazenamento, intake, indisponibilidade e ausência de efeitos indevidos |
| [G07](g07-linux-package.md) | Verificador #640 e rota #668 integrados; B distinto de C, dois ACKs anteriores ao produtor e qualificação Q do tar original | ACKs Migração/Release para o mesmo C/T, operador real, produção e verificação do tar com proveniência |
| [G08](g08-teams-qa.md) | Nove oráculos Teams preparados; UI/factory originais e executor AZ02 integrados; ledger exige 37 casos operacionais | Concluir CAP03/#691/#693 e jornadas/#694; reserva, Microsoft real, mesmos bytes G07 instalados, execução de todos os grupos e aceite |
| [G10](g10-cutover-rollback.md) | Backup/clone preservados; #677 qualifica política corrente e composição de 58 casos, incluindo 31 HTTP de checkpoint/recuperação | Reserva isolada, R instalado/retido, backup/chave, checkpoint lógico, corte ensaiado, restore, restart, retry, rollback e observador externo |

Todas as nove obrigações Teams e os cinco grupos de acompanhamento permanecem **NOT_RUN na instalação**. O inventário exigido é **U15:6, U39:22, U40:22, F04:3 e AZ02:37**. F04 permanece Bun/HappyDOM; AZ02 é prova operacional LIVE transversal, em seis fases **16/14/2/2/2/1**, com os 32 IDs históricos retidos e cinco adições Team. AZ02 não é uma suíte Playwright. A rota `/recover` cobre somente dashboard Team; outras classes de recuperação continuam com suas provas próprias.

## Migração e #613

O focal solicitado [45035419728](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45035419728), fonte `1c7070c348a6f5be8fed07b7138fce4b6d45827a` / árvore `7bbe9abde3faacb8684971b4ce4561b64349475f`, teve seus seis jobs e recibos recebidos antes das correções. O [manifesto de intake](https://github.com/gustavomhss/Orchestra-SF/pull/673) e o ledger preservam esse resultado e as iterações seguintes.

O [último focal completo 45048445274](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45048445274), fonte `c9a9b0b3a85ea7f663b50d16527f45e977ccd3b5` / árvore `8e6d5f3113dd0fc3149877f0f2846302866a0956`, terminou com:

| Job | Resultado recebido |
| --- | --- |
| SF4 | 97/97 PASS |
| SF5 | 156/156 PASS; inclui os 52 casos originais planner-runtime |
| SF8 | 140/140 PASS |
| Decisions | 3/5; dois helpers ainda divergem da navegação visível original |
| Operations | 3/5; resposta GET200 CAP25 perde o corpo no cache do Chromium |
| Pool | 208/209, mais recusa do hook; evento da resposta tardia 401 não observado em 5 s |

O [recibo dos seis jobs](https://github.com/gustavomhss/Orchestra-SF/pull/673#issuecomment-7082886558) registra a aquisição dos onze ZIPs, hashes, CRC e vínculos de fonte. No pool, a limpeza física passou — um Chrome, 48 aquisições/liberações, PID encerrado —, mas isso não converte a falha funcional em PASS. O pool 209/209 de [45045269481](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45045269481) continua restrito à fonte 385b13. A seleção canônica recomposta explica as novas contagens dos shards; não há substituição retroativa de cobertura. **Reports 11/11 do agregado 44987301540 permanece evidência histórica, reutilizável somente onde a fonte e a composição continuarem aplicáveis.**

O [#613](https://github.com/gustavomhss/Orchestra-SF/pull/613) permanece em **12 de 15 áreas**. Os cinco controles da correção de escopo passaram em 45042892840 na fonte `0a1247db9a16f9eead04788a76d25723672c7e6a`; UI44 ainda falhou sem resposta no prazo original de 120 s em 45043532716. UI42/UI43 seguem sem preview de portfólio qualificado. O coletor de CPU 45045175421 estava sem recibo/artefato após mais de 50 minutos, com causa desconhecida.

A tentativa C17 `6bec7f15` terminou [6/7 controles verdes](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7082905911), mas ancestry excedeu os 105 s originais; ciclo e recuperação/revogação não foram concluídos. Essa tentativa não foi aceita para composição. Os prazos e asserções originais permanecem preservados.

## Bloqueio operacional e responsáveis pela liberação

O inventário somente leitura de [#666](https://github.com/gustavomhss/Orchestra-SF/pull/666)/[#671](https://github.com/gustavomhss/Orchestra-SF/pull/671), [45036787201](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45036787201), parou **antes do login Azure**. O environment `azure-mvp` existe, mas o preflight recebeu vazias `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` e `AZURE_RESOURCE_GROUP`; login foi SKIPPED. Respostas de metadata 403/404 limitam a observação e não demonstram ausência de infraestrutura.

| Dependência | Quem pode liberar | Ação concreta |
| --- | --- | --- |
| Inventário da infraestrutura existente | Administrador do repositório/environment | Restaurar a configuração existente das quatro variáveis e repetir o inventário somente leitura |
| G08 instalado | Operador QA e responsável Entra | Confirmar reserva exclusiva, host, janela e contextos/atores Microsoft reais com grants e callbacks autorizados |
| G10 ensaiado | Operador de recuperação, backup/chave e observador | Confirmar ambiente isolado, R retido, acesso à chave, censo de efeitos e janela do ensaio |
| G07 | Migração e Release, com operador do produtor | Confirmar o mesmo C/T final e emitir os ACKs antes do build |
| Produção | Gustavo | Decidir go/no-go e janela somente após receber a evidência dos gates; aval explícito antes da virada |

Nenhuma reserva foi registrada como confirmada e nenhum host foi alterado por esta frente. A ausência de confirmação não prova que os ambientes não existam.

## Ordem de qualificação final

1. Integrar os recortes restantes por PR revisado, concluir G01–G04/pool e as jornadas do #613, preservando seus recibos.
2. Fixar C/T e receber ACKs reais de Migração e Release para essa identidade, com operador confirmado.
3. Executar G05 completo e G06 completo sobre C, com inventário, autoridade, efeitos e limpeza.
4. Admitir B distinto de C; `release-build-<B>` em C aciona o produtor original. Q e `g07-qualify-<Q>` verificam o ZIP/tar original, proveniência e componentes.
5. Instalar **os mesmos bytes** em QA e recuperação reservadas. G08 e G10 podem avançar em paralelo com processos, dados, sessões e callbacks isolados.
6. Reunir todos os recibos por candidato/run/artefato e apresentar go/no-go e janela proposta a Gustavo. A virada aguarda seu aval explícito.

O aceite **222 (2), 4/4**, continua válido no QA original; seu backlink com SHA/tar/reserva ainda precisa ser recuperado para qualquer vínculo adicional. O fechamento desta frente continua **0/5 gates finais, NOT_READY**, com C/T final, ACKs, tar, reservas, instalações e aprovações nulos.

A edição histórica [#676](https://github.com/gustavomhss/Orchestra-SF/pull/676), fonte `dd878301673ef0566ff4298e52fa63b0afe089c5`, permanece preservada. Esta atualização altera somente README, status e registro de execução; os roteiros de execução e o intake têm seus próprios responsáveis.
