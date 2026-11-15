# Missão72 — retenção e capacidade das sessões Microsoft

## Estado e identidade da evidência

**M70-AUTH-01 tem correção de origem, regressões executadas no Actions e rechecagem independente concluída para W1/R1, sem finding bloqueante aberto nesse escopo. A composição e a revisão/aceitação do candidato final permanecem abertas.** Esta entrega não autoriza merge, deploy, restart ou operações no tenant Microsoft.

| Identidade | Valor |
| --- | --- |
| Planejamento imutável | dbf9547211d9b0fade619790de7c19c0869b7c7d |
| Pacote72 | 1f01a01f51521ae39b7a4e730acefde3b9999891 |
| Base C28 | faa30fddb7e7b61696b66fd069f51cf18c51125f |
| Produto/testes W1 | 22b4e97cfbb22703eeedb34af3b33ba74d323806 |
| Tree W1 | 8b36c0ebd5412251c15b33b6cb726fcbedddce45 |
| Snapshot de execução S | dda8ba9d0624b921d7b206f96c55ea9aa25d4955 |
| Tree S | 3776c744a50643a6c905ab075ac88c2ac4098903 |
| Delta W1 → S | Pai único W1; somente adição de .ci-run.json |
| R1 | [run 43671466268 / job 132682240447](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43671466268/job/132682240447) |

O job R1 terminou com **138 pass, 2 skip herdados, 0 fail, 1.279 expectativas, 140 testes em 11 arquivos, 14,38 s**. Os 24 casos novos passaram. Os dois skips são os casos legados de diretório e banco pertencentes a UID estrangeiro, que exigem privilégios root da fixture; não há teste novo pulado. Os seletores observados e a relação W/S pertencem ao recibo [CI72.json](CI72.json). Nenhum teste de produto foi executado localmente.

A rechecagem por /root/ci_and_readonly, sem autoria dos cinco arquivos de produto ou dos 24 testes novos, concluiu **NO_OPEN_BLOCKING_FINDING_SOURCE_AND_R1**. [INDEPENDENT-RECHECK72.md](INDEPENDENT-RECHECK72.md) e [INDEPENDENT-RECHECK72.json](INDEPENDENT-RECHECK72.json) delimitam essa independência e registram CR72-01 resolvido. O revisor produziu propostas inertes de composição; seu parecer não aprova a própria proposta, o candidato composto ou os gates finais.

O [pacote72](https://github.com/gustavomhss/Orchestra-SF/blob/1f01a01f51521ae39b7a4e730acefde3b9999891/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/auth-retention-fix.json) delimita a missão a autenticação/retention e exige preservar readonly59 na composição por71. A [revisão70](https://github.com/gustavomhss/Orchestra-SF/blob/9c6946c31887ca1899a99ce120921c8bf937e721/modules/sucafina/Sucafinav1/docs/sf2h/receipts/cold-auth-review/FINDINGS70.json) avaliou o SHA 7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85 por análise causal estática. Seu desenho e seus contraexemplos estão em [REMEDIATION70.md](https://github.com/gustavomhss/Orchestra-SF/blob/9c6946c31887ca1899a99ce120921c8bf937e721/modules/sucafina/Sucafinav1/docs/sf2h/receipts/cold-auth-review/REMEDIATION70.md#auth-01).

## Defeito anterior e discriminante executado

O achado obrigatório era crescimento persistente de challenges abandonados, sessões vencidas e revogações, além de criação de estado para cookies nunca emitidos. A validade de uma sessão já era recusada pela expiração; o problema incluía retenção e consumo de recursos. Não se transforma esse achado em alegação de plaintext ou bypass OIDC.

O baseline B0 executou apenas o discriminante de logout inventado sobre C28, com a fixture adicionada: W0 0f93897311a41b938ff321e9734ba99c3e92e2a4, tree 6d0b5f26c87532451e675324635057c483ee5af7; snapshot S0 e0a94d9c1b2abc6e957aa0886587fba8bca7a091, tree b8565e48822576193a38494eb21dc3759e0be763. O [job B0](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43671182262/job/132681354612) falhou na comparação dos registros físicos: após 16 logouts contendo 32 handles inventados, a tabela passou de **1 para 33 linhas** e de **221 para 253 bytes de payload**. Foram 0 pass, 1 fail, 1 caso filtrado e 50 expectativas. A falha observada foi o crescimento de armazenamento, não falha de setup.

Em R1, a mesma comparação física passa e a checagem posterior de pendingRevocations é zero. O baseline e R1 não são fixtures byte a byte idênticas: o suporte ao timeout de lock e a checagem posterior de estatísticas foram acrescentados depois. Os demais aspectos do finding70 têm cenários pós-correção em R1; não se alega reprodução executada de cada caminho no baseline.

## Correlação durável e prazo fixo

A emissão e a autorização para usar um payload são separadas. A tabela authentication_issuance conserva a chave derivada, tipo, estado, expiração, retain_until e, para a sessão, a chave do challenge pai. A tabela authentication_payloads conserva somente os bytes existentes do payload autenticado e sua expiração. As chaves de armazenamento continuam derivadas da origem, mount, perfil Microsoft, tenant, client e handle.

| Estado / objeto | Payload | Retenção mínima da correlação |
| --- | --- | --- |
| Challenge emitido, ainda não consumido | Challenge criptografado | Até a expiração do challenge, no máximo 10 minutos após emissão |
| Challenge consumido / callback pendente | Segredo retirado atomicamente por take | Expiração do challenge + 8 horas |
| Challenge com sessão concluída | Segredo do challenge ausente | Conserva o mesmo prazo máximo de expiração do challenge + 8 horas |
| Sessão ativa | Credencial criptografada | Expiração absoluta da sessão, no máximo 8 horas após criação |
| Sessão revogada | Payload removido | Conserva a expiração absoluta original |
| Challenge revogado | Payload removido | Prazo já necessário ao estado durável observado; consumo concorrente conserva o horizonte ampliado |

O consumo do challenge retira verifier/nonce e muda sua correlação para pending na mesma escrita. A emissão da sessão exige um pai pending admissível e o transforma em completed uma única vez. Não se usa a ausência de ciphertext após take como prova de que o handle nunca existiu.

O prazo do pai consumido usa o **máximo permitido de 8 horas**, mesmo que uma instância configure uma sessão mais curta. A correlação pode, portanto, permanecer por até **8 horas e 10 minutos desde a emissão do challenge**. Refresh não desloca o vencimento absoluto. Logout repetido não renova o prazo. Após a coleta do pai, uma nova tentativa de emissão dependente é recusada; depois da remoção da sessão, put gerenciado não a recria.

Um handle sintático desconhecido não cria linha, intenção de revogação em memória ou reserva. A resposta de logout pode limpar os cookies e retornar 204 sem escrever armazenamento. Logout conhecido só declara 204 depois da operação durável; falha de persistência retorna 503.

## Capacidade compartilhada e métricas

A política é persistida na instalação. Na inicialização, overrides explícitos devem ser inteiros positivos e podem apenas reduzir os máximos de fábrica. Ao reabrir, opções omitidas adotam a política existente; um valor explícito divergente é recusado. Não há alteração silenciosa de capacidade por uma segunda instância, nem alteração online da política por esses overrides.

| Limite padrão | Unidade e efeito |
| --- | --- |
| maxRecords = 4.096 | Registros lógicos: todas as correlações de emissão, inclusive pending/completed/revoked, mais payloads legados sem correlação correspondente |
| maxChallenges = 512 | Challenges issued/pending, mais challenges legados ainda sem correlação; o limite total continua contando os outros estados |
| maxBytes = 33.554.432 | 32 MiB na soma dos bytes de payloads persistidos, inclusive backlog legado |
| maxPayloadBytes = 65.536 | 64 KiB por novo payload gerenciado ou substituição por refresh |
| batchSize = 128 | Máximo agregado de linhas SQL removidas por execução: payloads + correlações |
| Intervalo = 60.000 ms | Um ciclo inicial e ciclos periódicos de manutenção, sem execuções sobrepostas |

A verificação de admissão e a inserção ficam na mesma transação de escrita SQLite. Duas instâncias compartilham a quota da instalação. Saturação recusa login novo com 503 ou callback sem capacidade com 403; não desaloja sessão, challenge ou revogação ainda necessários. Um refresh acima do limite individual ou total preserva os bytes anteriores e sua expiração.

Um login concluído normalmente ocupa duas correlações — pai e sessão —, e o pai pode sobreviver à sessão. Por isso, 4.096 registros não é uma promessa de 4.096 sessões simultâneas. O orçamento de bytes soma todos os payloads da tabela: ciphertext, marcadores legados de um byte e valores de adapters genéricos confiáveis. Não inclui páginas, índices, WAL, cabeçalhos ou todos os objetos do processo.

O put legado para chaves não gerenciadas permanece disponível aos adapters locais confiáveis e não recebe esta quota, podendo excedê-la por esse caminho interno. Seus payloads entram na contagem usada para admitir emissões Microsoft, que são recusadas enquanto não houver capacidade. A garantia de admissão limitada cobre os handles Microsoft gerenciados; não é um limite universal de qualquer writer/adaptador que tenha acesso ao banco.

As intenções locais de revogação e as promises de refresh também têm admissão limitada a maxRecords, respectivamente por store e por identidade. Refreshes pendentes podem sobreviver à expiração/coleta da sessão: o limite continua valendo entre gerações de sessões, sem descartar trabalho pendente. R1 observa três chamadas retidas ao provider com cap reduzido a três; uma quarta sessão válida não inicia uma quarta chamada.

## Expurgo, ociosidade e armazenamento físico

A manutenção usa índices de expiração e um orçamento único de linhas. Remove primeiro payloads vencidos e usa o restante do lote em correlações cujo retain_until já terminou. Nunca remove um pai necessário antes do horizonte seguro.

startAuthMaintenance executa fora do contexto de request/transação de negócio, inicia uma passagem e agenda as seguintes. A execução é única enquanto houver lote em andamento. Dispose interrompe o timer e aguarda o lote admitido antes de fechar o store. A composição em local/entry.ts conecta esse ciclo independentemente do perfil operator e dos jobs de backup. R1 prova o módulo e seu ciclo com SQLite real; a qualificação da ligação na composição instalada continua necessária.

A leitura de autenticação permanece sem escrita e usa uma conexão de leitura atual. Tentativas de escrita de manutenção aninhadas continuam submetidas às regras de escopo/contaminação do store. Não se insere GC em get, authenticate ou no caminho do callback de uma transação de negócio.

**Expiração lógica não é prazo de compactação física.** A credencial deixa de ser admissível no instante de expiração, independentemente de GC. Cada passagem remove até 128 linhas; backlog, lock ocupado, erro de I/O ou indisponibilidade do processo podem exigir ciclos adicionais. O intervalo de 60 segundos não é SLA para eliminar todo o backlog.

DELETE torna linhas removidas/reutilizáveis pelo SQLite, mas não garante redução imediata do arquivo principal ou do WAL, nem apagamento seguro de bytes em páginas livres. Esta correção não executa VACUUM ou um projeto de compactação. Uma política operacional de compactação, se necessária, exige tratamento separado e a autoridade correspondente. O status do ciclo distingue lote em andamento, último sucesso, totais removidos e falha sanitizada de manutenção.

Dados legados já acima das quotas são contados integralmente. A abertura não faz uma varredura destrutiva; novas emissões são recusadas até existir capacidade. Lotes retiram apenas linhas elegíveis, preservando payloads legados válidos. Não se promete que um backlog anterior arbitrário caiba imediatamente nos limites novos.

## Corridas preservadas e CR72-01

Os casos executados mantêm as seguintes consequências observáveis:

- Um challenge cujo segredo já foi consumido ainda pode ser cancelado por outra instância. Callback pendente termina sem cookie de sessão.
- Logout durante redemption, antes da emissão da sessão e após seu commit impede a entrega tardia da credencial.
- Duas instâncias não resgatam o mesmo challenge duas vezes. Restart preserva a revogação; cópia de cookie não readquire acesso.
- Refresh e resolução Graph revalidam a sessão antes de produzir autoridade ou dados. Escrita tardia de refresh não recria sessão revogada.
- Coleta durante callback pendente preserva o pai no horizonte necessário; no limite seguro, a coleta impede emissão derivada posterior.
- A expiração absoluta permanece fixa, inclusive depois de refresh.

**CR72-01** trata a falha de escrita do logout enquanto uma transação de negócio aguarda Graph. O fence local é instalado antes de entrar na fila do writer. Se a admissão ou o commit falha, a intenção continua revogando leituras locais até seu horizonte fixo; apenas a promise em andamento é liberada para permitir retry. Uma sessão usa seu vencimento absoluto; a intenção de cancelamento de login cobre também a janela máxima de uma possível sessão, caso um peer tenha consumido o challenge enquanto a escrita aguardava.

O teste mantém o writer real, força timeout de 40 ms e observa logout 503. Antes de liberar Graph, inspect ainda retorna revoked. A autenticação em voo termina null. O retry fora da transação retorna 204, zera pendingRevocations e a revogação persiste após reopen. Uma falha ainda sem retry **não é** uma revogação durável demonstrada entre processos ou após crash; o 503 comunica precisamente essa situação.

## Criptografia, fronteiras e limitações de rollout

A implementação mantém ciphertext autenticado AES-256-GCM com AAD ligado à chave de armazenamento, cookies opacos, PKCE/nonce, isolamento de tenant/client/origem e keys da instalação. R1 inclui as suítes legadas de local identity/store, Microsoft session, Entra client, configuração e operador. Elas exercitam adulteração/AAD, origem, tenant, chave, callback, logout e expiração, além dos casos novos.

A fixture OIDC assina JWTs e percorre o cliente real, com PKCE e verificação criptográfica, sobre transporte sintético; SQLite é real. Isso não demonstra consentimento, B2B, proxy, disponibilidade ou operação de um tenant Microsoft corporativo.

Há uma limitação importante de **rollout com writers antigos e novos simultaneamente**. Um callback da implementação antiga pode já ter executado take e apagado o challenge sem deixar correlação. O writer novo não consegue distinguir esse handle de um handle nunca emitido e não pode recriar essa história por inferência. Writers antigos também não obedecem à nova política de admissão. A compatibilidade de leitura com payloads legados não constitui prova de rollout misto ao vivo.

O plano de instalação por owner autorizado deve eliminar callbacks/writers antigos em andamento antes de tratar as novas garantias como compartilhadas por toda a instalação; preservar dados e keys, qualificar a composição e definir drenagem/cancelamento são pré-condições operacionais. Esta missão não executa essa mudança operacional nem reivindica compatibilidade sem interrupção.

## Matriz de regressões e composição readonly59

| Suíte nova executada em R1 | Casos | Consequência provada |
| --- | ---: | --- |
| unknown-handles.test.ts | 2 | Ausência de alocação por handles nunca emitidos; repetição idempotente e prazo fixo |
| retention.test.ts | 5 | TTL exato, expiração absoluta, pai consumido, horizonte seguro e orçamento de lote |
| capacity.test.ts | 7 | Quotas compartilhadas, bytes, preservação de refresh, política persistida e migração do backlog |
| races.test.ts | 8 | Callback/logout/refresh/Graph, dois stores, reopen, promises retidas e CR72-01 |
| maintenance.test.ts | 2 | Coleta ociosa, execução única e drenagem de dispose |

Os dois casos de readonly59 estão em composition/readonly59/readonly-composed.test.ts.txt, **inertes e NOT_RUN**: fence antes do logout durável enfileirado sob readSnapshotRoot, e rejeição de manutenção aninhada que contamina a raiz. No primeiro, o logout deve iniciar no escopo externo; iniciá-lo dentro do callback herdaria ALS e testaria escrita aninhada em vez de fila externa. A raiz readonly59 existente ainda usa BEGIN IMMEDIATE; não é válido esperar que um peer conclua escrita enquanto essa raiz conserva o writer.

71 deve aplicar o patch de auth sobre os pre/postimages exatos de readonly59, preservando sua API e seu código de raiz, e reconciliar o mapa/pointer Microsoft. O material em composition/ é proposta revisável, não prova instalada. O mapa55 e archives49 históricos continuam sendo evidência de seus candidatos originais.

## Critérios, rechecagem e autoridade

[CRITERIA72.json](CRITERIA72.json) liga os quatro itens de aceitação72, as exigências de AUTH-01 da revisão70 e os critérios canônicos ao cenário, consequência, correção e execução exatos. Os rótulos locais de teste não são novos critérios do plano.

No [WP10 canônico](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.md), QLT.01 exige cenário/comportamento/consequência; QLT.40 exige critério/evidência/impacto/correção/recheck/SHA. Este documento fornece os insumos de autoria; o relatório independente separado conclui a rechecagem de origem W1/R1. A rechecagem do futuro candidato composto/final continua pendente. INV.40 e CHK.03 impedem que o autor aceite independentemente a própria correção; CHK.40 exige identificar reviewer/authors por seção.

Permanecem obrigatórios: ACK e composição por71; rechecagem fria independente do candidato composto/final; qualificação dos dois casos readonly59 e da composição/lifecycle/ponteiros; checks/typecheck/guards sob45; e os gates finais do candidato integrado, incluindo as seleções finais, AM, reviews, C-G7 e D-G8. A rechecagem de origem W1/R1 já está concluída. Os gates externos e outros findings da revisão70 não são fechados por R1. **GLOBAL_RELEASE=false.** Não há declaração de encerramento dos critérios de toda a campanha.

