# Preparação do go-live — G05, G06, G07, G08 e G10

**Os componentes de produto e execução avançaram para `dev`; os cinco gates finais continuam abertos.** Migração e #613 ainda têm casos pendentes. O coordenador G08 foi integrado, mas falta corrigir a admissão do próprio agregador antes de aceitar sua prova. C/T final, ACKs, tar e reservas continuam sem confirmação.

Corte desta edição: **22/11/2026 às 15:49:13 em America/Sao_Paulo (18:49:13 UTC)**. Último `dev` observado: `b7776698e61934ed2cb820658408ff8a8207ec62`, árvore `364344c376a4feb35245d8089bde1941d025ebf9`. Essa identidade é uma base de integração observada; não é o candidato final aprovado. Alterações posteriores ao corte devem ser consultadas nas PRs originais.

O [registro estruturado](status.json) vincula cada prova à fonte/árvore, run, artefato e recibo. O [registro de execução](execution-2026-11-22.md) preserva as edições anteriores e detalha esta atualização. Os históricos e as 12 áreas já qualificadas do #613 permanecem preservados.

## Mandato, responsáveis e fronteiras

A [coordenação #657](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7080753498) atribui a esta sessão integração final, Release, reservas QA/recuperação, importação privada Microsoft, checkpoint lógico, produtor do tar e executor G08. O mandato autoriza a preparação e integração revisada em `dev`; não confirma reservas, não aceita um candidato indefinido e não autoriza a virada de produção.

| Recorte | Responsável e estado |
| --- | --- |
| Integração final e G05/G06/G07/G08/G10 | Astra go-live; integra por PR revisado e recebe recibos completos |
| G01–G04 e pool | `focal_migration`, [#673](https://github.com/gustavomhss/Orchestra-SF/pull/673); seis jobs originais e os dois jobs da composição 9612 recebidos antes de novos deltas |
| UI42/UI43/UI44 e fechamento do design | Frente do [#613](https://github.com/gustavomhss/Orchestra-SF/pull/613); permanece no PR existente, 12/15 áreas qualificadas |
| Produto Teams | #665 e complementos integrados; CAP03/#691/#693 e jornadas/#694/#700 em dev; Teams mantém o follow-up de admissão do agregador |
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
| [#691](https://github.com/gustavomhss/Orchestra-SF/pull/691) | `7e3e5e2bfd24f2efe8f424a298e31e071763061f` | [45050299263](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45050299263): 79 DOM/1.501 asserções; prova na composição explícita ba91 + Client, distinta do head isolado 894 |
| [#693](https://github.com/gustavomhss/Orchestra-SF/pull/693) | `70e3228cf2dbbe2ba1723ea4044ed855864dd516` | [45051010616](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45051010616): 67 casos de domínio/Client/HTTP/Microsoft/G05 e nove cleanups; CAP03 original, identidade controlada |
| [#694](https://github.com/gustavomhss/Orchestra-SF/pull/694) | `9804ee30848580787cc7e556d4a26269b3960656` | [45051200489](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45051200489): 40 Node + 25 Bun; 50 jornadas apenas LISTED_NOT_RUN; F04 NOT_RUN |
| [#697](https://github.com/gustavomhss/Orchestra-SF/pull/697) | `19fbe6542cdcc27139082c28acbc01bf070d60bd` | [45052572893](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45052572893): 42 Node + 49 Python; observador after-restart vincula os bytes originais, sem executar restart |
| [#700](https://github.com/gustavomhss/Orchestra-SF/pull/700) | `327e95d552fa6edc742f8b87bc19efb0ca6a1dd6` | [45055263348](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055263348): 40 Node + 42 Bun + 21 DOM; registro original e manifesto aditivo, sem contextos Microsoft instalados |
| [#701](https://github.com/gustavomhss/Orchestra-SF/pull/701) | `5cf8419032b544b3252b00bdee39afdbb366ffa6` | [45055493019](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055493019): 128 controles de proveniência e ZIP real de controle; nenhuma prova instalada é inferida |
| [#699](https://github.com/gustavomhss/Orchestra-SF/pull/699) | `47fa6b594ce91058671d55a7104e1ed0264975c2` | [45055028234](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055028234): 40 Node + 54 Bun/188 asserções; recusa JSON original e descarte sem remover a rota passiva |
| [#698](https://github.com/gustavomhss/Orchestra-SF/pull/698) | `b7776698e61934ed2cb820658408ff8a8207ec62` | [45055970646](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055970646): 254 Node + 5 Bun; cola dos 11 grupos. Admissão do agregador atual ainda pendente |

As contagens são **de fontes distintas**. #692 foi qualificada antes dos nove controles Node adicionais de #695; seus 183 casos não são o inventário agregado corrente. O merge de #695 preserva os três arquivos de #692, mas a execução de 9f5198 não é apresentada como execução conjunta do merge.

Os quatro achados da fronteira HTTP — limite real de bytes, semântica de JSON vazio, overflow tipado e erro sem consumo do corpo — estão entregues por #665/#688. Eles deixam de ser bloqueios de implementação; o replay completo do candidato final continua obrigatório.

O merge de #699 foi relido: `response-faults.ts` conserva exatamente o runtime revisado e o `Pick<NativeManifest, "target">` de #700. A prova 45055028234 continua pertencendo à fonte 217e; ela não qualifica automaticamente a árvore integrada.

**Pendência atual de G08:** o [readback de #698](https://github.com/gustavomhss/Orchestra-SF/pull/698#issuecomment-7083738993) exige observar SHA/árvore, limpeza tracked e o evento/runner/job do agregador atual. O [follow-up reservado a Teams](https://github.com/gustavomhss/Orchestra-SF/pull/698#issuecomment-7083785318) será integrado por nova PR revisada. A proveniência dos produtores anteriores não resolve, sozinha, essa fronteira.

## Estado por gate

| Gate | Prova de componente disponível | Trabalho necessário para fechamento |
| --- | --- | --- |
| [G05](g05-g06-controls.md) | HTTP/SQLite reais, isolamento Team e 11 controles internos repetidos; fronteiras Web corrigidas. Os 409/409 históricos de coverage/auth/effect permanecem na fonte original | Fixar C/T e executar coverage/auth/effect e isolamento completo no inventário corrente, com recibos e cleanup |
| [G06](g05-g06-controls.md) | [45046401550](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45046401550), fonte B4: 172 Node e 16 Bun/146.538 asserções; ClamD real, Imports privados, cinco fronteiras de política corrente e quatro fixtures limpas | Reexecutar a seleção completa sobre o candidato final; conferir payloads inválidos, autoridade, armazenamento, intake, indisponibilidade e ausência de efeitos indevidos |
| [G07](g07-linux-package.md) | Verificador #640 e rota #668 integrados; B distinto de C, dois ACKs anteriores ao produtor e qualificação Q do tar original | ACKs Migração/Release para o mesmo C/T, operador real, produção e verificação do tar com proveniência |
| [G08](g08-teams-qa.md) | CAP03, UI/factory, registro, jornadas, observador e proveniência em dev; coordenador ainda tem o follow-up de admissão | Fechar a admissão atual, receber C/T/tar/reserva e Microsoft real, executar as 99 obrigações e receber o aceite |
| [G10](g10-cutover-rollback.md) | Backup/clone preservados; #677 qualifica política corrente e composição de 58 casos, incluindo 31 HTTP de checkpoint/recuperação | Reserva isolada, R instalado/retido, backup/chave, checkpoint lógico, corte ensaiado, restore, restart, retry, rollback e observador externo |

As **99 obrigações permanecem NOT_RUN na instalação**, em **11 invocações**: Teams:9, U15:6, U39:22, U40:22, F04:3 e as seis fases AZ02, somando 37. F04 permanece Bun/HappyDOM; AZ02 é prova operacional LIVE transversal, em seis fases **16/14/2/2/2/1**, com os 32 IDs históricos retidos e cinco adições Team. AZ02 não é uma suíte Playwright. A rota `/recover` cobre somente dashboard Team; outras classes de recuperação continuam com suas provas próprias.

## Migração e #613

O focal solicitado [45035419728](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45035419728), fonte `1c7070c348a6f5be8fed07b7138fce4b6d45827a` / árvore `7bbe9abde3faacb8684971b4ce4561b64349475f`, teve seus seis jobs e recibos recebidos antes das correções. O [intake da Migração](migration-intake.json) preserva as 205 disposições e as iterações seguintes.

O focal composto [45055109181](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055109181) executou `9612e7db0319c41ea0161e3924f332d9d76b0f9b` / T `b1dc4bdc3b4a73667e9ee8011667616565d2f9bc`. Seus dois jobs, logs e quatro ZIPs foram recebidos antes do próximo delta; [recibo e limites](https://github.com/gustavomhss/Orchestra-SF/pull/673#issuecomment-7083818853).

| Recorte | Resultado observado nessa fonte |
| --- | --- |
| Decisions | 3/5 PASS; dois Compare excederam os 180 s originais; zero skip/flaky |
| Limpeza das instalações dos dois timeouts | SIGTERM e dispose em 112/170 ms; nenhum EADDRINUSE, e os três casos seguintes passaram |
| Geradores e sete typechecks principais | PASS |
| Inclusão SF-E2E | FAIL: retorno Promise&lt;Disposable&gt;/Promise&lt;void&gt; e Window.api ausente nessa closure; 6.323 arquivos contabilizados |
| Build Web | SKIPPED após o erro SF-E2E |
| Guards | 78 regras; 0 gate findings/0 erros, **47 warnings contra origin/dev** e **69 contra a base histórica** |

A causa dos dois Compare ainda não foi separada entre servidor e observação CDP. O abort de 10 s do probe anterior não é transferido para 9612. A correção da completude do observador não pode aumentar prazos, alterar retries, substituir bytes da resposta original ou promover indisponibilidade a PASS.

Operations tem **5/5** em [45051170458](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45051170458), fonte bf1c680d; esse recibo não qualifica 9612. O focal anterior de seis jobs [45048445274](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45048445274) continua histórico: shards97/97,156/156 e140/140, Decisions3/5, Operations3/5 e pool208/209 mais recusa do hook. O diagnóstico posterior com 209 corpos aprovados não substitui o pool original do candidato final.

**Reports 11/11 do agregado44987301540 conserva seus oráculos originais.** A comparação de fonte confirmou a especificação, manifesto e 16 helpers preservados, mas os consumidores local/entry, local-store e request-body mudaram. A qualificação final exige replay dos 11 casos sobre o candidato efetivo, após a composição com #613; nenhum PASS foi transferido.

O [#613](https://github.com/gustavomhss/Orchestra-SF/pull/613) permanece em **12 de 15 áreas**, head `0a1247db9a16f9eead04788a76d25723672c7e6a`. UI42/UI43 continuam sem preview de portfólio qualificado; UI44 permanece sem avaliação instalada aprovada. As provas das 12 áreas foram preservadas.

A fonte de trabalho255 teve [8/10 verificações verdes](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7083483010): houve falha de tipos no próprio driver e timeout do C17. O recheck 45054387720 corrigiu somente o driver e passou identidade/tipos/guards; não repetiu o C17. O [perfil original45054997790](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7083761451) foi baixado e verificado: ZIP14766639145, CRC de quatro arquivos e hashes completos. O teste continua **FAIL no prazo original 105 s**. O perfil censura o restante de ancestry e serve ao diagnóstico, sem comprovar ganho ou qualificar a instalação.

O coletor antigo 45045175421 terminou cancelado, sem artefato; a leitura do log retornou 404. Sua causa permanece desconhecida. As tentativas 1480/6bec e os negativos anteriores continuam históricos, sem aceitação implícita ou promoção do head.

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

1. Integrar os recortes restantes por PR revisado, fechar a admissão do agregador G08, concluir G01–G04/pool/Reports e as jornadas do #613, preservando seus recibos.
2. Fixar C/T e receber ACKs reais de Migração e Release para essa identidade, com operador confirmado.
3. Executar G05 completo e G06 completo sobre C, com inventário, autoridade, efeitos e limpeza.
4. Admitir B distinto de C; `release-build-<B>` em C aciona o produtor original. Q e `g07-qualify-<Q>` verificam o ZIP/tar original, proveniência e componentes.
5. Instalar **os mesmos bytes** em QA e recuperação reservadas. G08 e G10 podem avançar em paralelo com processos, dados, sessões e callbacks isolados.
6. Reunir todos os recibos por candidato/run/artefato e apresentar go/no-go e janela proposta a Gustavo. A virada aguarda seu aval explícito.

O aceite **222 (2), 4/4**, continua válido no QA original; seu backlink com SHA/tar/reserva ainda precisa ser recuperado para qualquer vínculo adicional. O fechamento desta frente continua **0/5 gates finais, NOT_READY**, com C/T final, ACKs, tar, reservas, instalações e aprovações nulos.

As edições históricas [#696](https://github.com/gustavomhss/Orchestra-SF/pull/696) e [#676](https://github.com/gustavomhss/Orchestra-SF/pull/676), fonte `dd878301673ef0566ff4298e52fa63b0afe089c5`, permanece preservada. Esta atualização altera somente README, status e registro de execução; os roteiros de execução e o intake têm seus próprios responsáveis.
