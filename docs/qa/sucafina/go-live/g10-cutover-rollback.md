# G10 — ensaio de virada, retomada e rollback

## Estado e escopo

**RUNBOOK, BACKUP/CLONE E CHECKPOINT LÓGICO MICROSOFT INTEGRADOS; CONTROLES DE COMPONENTE VERIFICADOS; ENSAIO INSTALADO NÃO EXECUTADO.** A sessão Astra desta frente coordena G10 e, pelo mandato ampliado de Gustavo, a integração, Release e obtenção das reservas. O operador do backup/host, o observador independente dos efeitos e o responsável pelo corte ainda precisam ser confirmados para o ambiente reservado. Esta preparação não registra aprovação de janela nem autoriza virada de produção.

O [handoff](https://github.com/gustavomhss/Orchestra-SF/blob/c02f329d48d37e2f6296154978cd8a7cf80bcb64/docs/qa/sucafina/astra-go-live-handoff.md) permite a qualificação em ambientes isolados autorizados. Depois do tar G07 verificado, G08 e G10 podem avançar em paralelo com processos, dados, sessões e escritores separados. O candidato final deve ser o mesmo SHA/árvore e o tar deve ter o mesmo SHA-256 nos dois ambientes.

Referência de leitura: `dev@79912446753af5bb291fc2581543732eb4c83057`, árvore `5c32cd72537799632e7d2583c1775df1d88b8780`. Não é o pin final da Release.

## Pendência operacional desta edição

Dono da coordenação e execução do ensaio: Astra go-live. Não há recibo instalado novo de backup/corte/retomada/rollback. A configuração Azure observada continua bloqueada antes do login, conforme o [registro atualizado](README.md#acesso-operacional). A reserva, os acessos ao host/clone, o release R retido, a chave utilizável e o observador externo ainda precisam ser materializados com os responsáveis pelos recursos.

O tar G07 deve ser o mesmo usado em G08; a execução paralela começa apenas depois da verificação e em reservas separadas. O observador de restart #697 pertence à cadeia AZ02/G08; ele não substitui o ensaio de recuperação nem comanda reinício. G10 continua exigindo backup real, prova de leitura da chave, efeito posterior ao checkpoint, registro monotônico independente, corte, restore/restart/retry sem duplicação e rollback R com recibos próprios. Os negativos e as medições RPO/RTO deste runbook permanecem obrigatórios.

## Adaptador implementado nesta frente

A [PR #639](https://github.com/gustavomhss/Orchestra-SF/pull/639), fonte `f5b22050bbe04c228576dbe5ca1356cafbe1f431`, árvore `28a6d7cd0cbecaf6d3f3d364c81cda1bca9ca5c0`, foi integrada em `e1ed546cac909208959f60734d601723d3101662`. O [run 45024293423](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45024293423), job 137213794907, aprovou **15 controles reais de arquivos/SQLite**, zero falha/skip, spawn-imports e guards.

O artefato [14755630213](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45024293423/artifacts/14755630213), ZIP SHA-256 `ba3531559a97f82f5a1533c5b2aaa5517aae03f566e9dad90ba052334fd27655`, foi adquirido e conferido independentemente. Seu recibo é `orchestra-sf.g10-component-tests.v1`, classe `FILESYSTEM_COMPONENT_CONTROLS`, `installedTeamsProof:false`, `releaseQualified:false`.

`sf/azure/recovery/teams-checkpoint.py` inventaria os arquivos e diretórios existentes em `/var/lib/orchestra-sf` e `/etc/orchestra-sf`, verifica SQLite em repouso, produz um arquivo privado em volume independente e confere cada membro/byte. A recuperação de integridade escreve somente em `target/restored` numa **outra VM Azure reservada**. A reserva exige as atestações `networkEgressFenced:true` e `credentialsDisabled:true`; o adaptador observa a VM, mas não implementa nem comprova a cerca de saída ou a desativação das credenciais. O operador precisa fornecer a observação independente dessas condições antes de recuperar o clone. Não ativa serviço, seleciona release, sobrescreve dados vivos nem escreve o registro monotônico externo.

A origem instalada **R** é verificada por `current_source()`, `check_rollback_release(R)` e `.a7-source.json`, separadamente do destino **C/T/tar** fornecido por G07. Assim o backup anterior ao corte não exige instalar C antes. Se a origem já for C, tar e manifesto precisam coincidir exatamente com G07. O registro externo permanece fora das duas raízes restauradas.

O CLI real exige Linux x64/root, lock/preflight do instalador, serviço parado, Caddy em manutenção, volume de dados e Azure IMDS compatíveis com a reserva privada. A drenagem dos demais escritores é uma atestação do operador vinculada por hash; inatividade do serviço e bytes da instalação são observações. A presença/leitura da chave no inventário **não prova decriptação**.

Os recibos operacionais `orchestra-sf.teams-checkpoint.v2` e `orchestra-sf.teams-clone-integrity.v3` conservam `releaseQualified:false`, `businessRecovery:NOT_RUN` e `keyDecryption:NOT_RUN`. O censo cobre as raízes observadas, não uma lista predefinida de todos os bancos possíveis; o operador deve conciliar esse inventário com todas as classes e destinos de dados da instalação.

Contrato, entradas privadas e comandos completos: [sf/azure/recovery/README.md](../../../../sf/azure/recovery/README.md).

## Correção integrada do recibo de clone

A [PR #658](https://github.com/gustavomhss/Orchestra-SF/pull/658) corrigiu a perda da identidade do destino no recibo. Fonte `9714cd1819e2f0f5158210076268ac2bb0e5f9fb`, árvore `25139019a6152f771dfdcb977267f1c5d6b9146a`, merge `1773fe7fcff1e291e7f15786f42262af3bb40d3c`.

O caminho operacional passa a emitir `orchestra-sf.teams-clone-integrity.v3`, com bloco obrigatório `clone`: VM retornada pelo Azure IMDS, horário da observação, hash dos mesmos bytes da reserva lidos na admissão e horário da conclusão da verificação. O binding da origem permanece separado. As condições de isolamento continuam identificadas como `OPERATOR_ATTESTATION`. O resultado v2 do helper de arquivos não comprova a VM de destino.

O [run 45030815611](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45030815611), tentativa 1, job 137233784079, aprovou **17 controles de arquivos/SQLite**, zero falha/erro/skip, spawn-imports e 78 guards sem findings em três paths. O snapshot de CI `100be506a886bef64d210fedb0342e38fc5fc044` tem a fonte revisada como pai único e acrescenta somente a workflow descartável; o job executou o checkout exato da fonte/árvore. Essa workflow não entrou no merge.

Artefato [14758030307](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45030815611/artifacts/14758030307), 2.874 bytes, ZIP SHA-256 `f9a4b0078640013dcc7669766356cc0518bfeab07a6ab55db48960b904ea9513`; recibo SHA-256 `4b15cc7049220905f95969718dc31aa14ab0dc95c74de815c68a344ec9988062`. Aquisição, hash/CRC, refs, inventário, logs e recibo foram conferidos pela coordenação. A comparação após merge confirmou os três blobs revisados.

Os dois novos controles usam fixtures declaradas de identidade de VM para verificar o vínculo do recibo e recusas antes de escrita; não acessam Azure. A prova continua `FILESYSTEM_COMPONENT_CONTROLS`, `installedTeamsProof:false`, `releaseQualified:false`. Os runs anteriores 45030521031 e 45030692679 falharam no driver de CI e permanecem históricos; o verde acima é o registro final dessa correção. Nenhum ensaio instalado foi executado.


## Checkpoint lógico e recuperação por política corrente — #669/#674

A lacuna de captura lógica identificada na revisão anterior foi implementada na [#669](https://github.com/gustavomhss/Orchestra-SF/pull/669). A [#674](https://github.com/gustavomhss/Orchestra-SF/pull/674) acrescenta a leitura da política persistente corrente na recuperação. O merge dependente de #674 foi `f84f9c0fbdf8d93ede8c0d14eeed270771bbd519`; a #669 entrou em **dev** no merge `6beab17e71c246b871b5a7f92c5de5ff2b0477d8`, árvore `3179c5c01ce287353fbef02b698c983a8f845f84`. A comparação final preservou os sete caminhos revisados byte a byte.

| Registro | Evidência observada |
| --- | --- |
| Produto testado D/T | `32f06e47407e31c98d84babb31a1565d8aedbd4c` / `4d01afacc5287eea5f6fd8a81c523ec83c484c7f` |
| Snapshot CI S | `237f9bec632e1aeb6b7e6559f2451ca81f989ee7`; pai único D e somente runner efêmero adicional |
| Run / job | [45038388189](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45038388189) / `137257131236`, **SUCCESS** |
| Casos | 42 em quatro arquivos: **41 PASS, um skip preexistente de ownership/root**, zero falha; 403 asserções; os oito casos novos passaram |
| Validação | Typecheck Sucafina aprovado; 78 guards, sete paths, zero findings |
| Artefato | [14760886449](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45038388189/artifacts/14760886449), 6.863 bytes |
| ZIP SHA-256 | `6d51d4e9e7d2303395dc3081aeb111f9071961cb197252248cff9257cbf9cb24` |
| Recibo SHA-256 | `748b66fbd215b243f62ebcef992f34eec19f89287bada04a237a934da3aa2875` |

A coordenação conferiu tamanho/digest/CRC, nove hashes internos, JUnit e fontes; os sete arquivos do manifesto foram relidos pelo Git SHA-1 e SHA-256. O skip foi preservado como limitação da seleção hospedada, não convertido em controle aprovado. SQLite, blobs, backups, `policy.mutate` e HTTP de componente são reais; identidade Microsoft, seed do produto e publicação externa do pin são controlados. Não houve observação independente operacional ou execução instalada. Omni é `not applicable` nesse recorte, sem reivindicação de spawn.

A fonte final da #669 é `f84f9c0fbdf8d93ede8c0d14eeed270771bbd519`, árvore `d9d329d4d55a08ca3c969c2565d11665b85f5b05`. Ela difere do produto D testado somente no guia. O [run final de guards 45038822594](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45038822594), job `137258474958`, snapshot `60ca68083b83660c46a6286a5494a23b21b85f7e`, confirmou 78 regras/sete paths/zero findings. Artefato [14760034604](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45038822594/artifacts/14760034604), 1.892 bytes; ZIP `919b291c31c4a609a990eab49b1415bd18b75c29a437a806ce5b13a757502e49`; recibo `9e84040c5fe47e458d77b7ecff5a3dfc9f9e2ce9b0f421d0a295e0cfe1b8d4ea`. CRC e quatro hashes internos conferidos. As revisões técnicas #674/`6013028788` e #669/`6013043654` não são aprovações de ensaio instalado.

O run anterior [45038117675](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45038117675) tinha 41 PASS e falhou no typecheck de IDs sem brands do fixture; a correção usou os tipos originais, sem cast e sem mudança no produto. Os 17 controles de arquivos/clone da #658 permanecem vinculados ao seu próprio run; não foram apresentados como repetidos por essa seleção.

A #675 entregou a admissão explícita de `checkpoint` no decoder privado e foi incorporada em dev pela #665, merge `5ba96127750f15fe221daebfc0635466997b69d6`. A #677 integrou a política persistente corrente e sua composição, merge `5d0d3973a21b02df954e0e5cf31afe103960c23d`. O decoder e a captura lógica já estão entregues; presença no C/tar e comportamento instalado ainda precisam ser comprovados. Esses merges não são ACK final, tar produzido ou ensaio G10.

## O que já existe e o limite das provas

| Fonte | Capacidade disponível | Limite observado |
| --- | --- | --- |
| [PR #561](https://github.com/gustavomhss/Orchestra-SF/pull/561) | Retenção de recibos/efeitos confirmados na restauração corporativa | Fonte externa simulada; não qualifica o host de QA |
| [PR #568](https://github.com/gustavomhss/Orchestra-SF/pull/568), [run 44876219213](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44876219213) | Recuperação Microsoft por Team com registro externo, SQLite e arquivos reais | 32 testes aprovados e um caso root pulado; OIDC/Graph controlados; não é PASS de G10 |
| [PR #574](https://github.com/gustavomhss/Orchestra-SF/pull/574), [run 44877477431](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44877477431) | Checkpoint, efeito Decisions, restore e reabertura/retry com mesma chave | Sete testes hospedados; reabrir a factory não prova restart real do serviço Azure |
| [Guia Microsoft da #669/#674](https://github.com/gustavomhss/Orchestra-SF/blob/6beab17e71c246b871b5a7f92c5de5ff2b0477d8/docs/guides/sucafina-microsoft-installation.md) | Observação/captura lógica, recuperação por política atual e comando Decisions reais | Procedimento integrado e controles de componente; não recibo de ensaio |
| [Instalador atual](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/sf/azure/vm/install-factory-distribution.py) e [guia Azure](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/sf/azure/README.md) | Verificação do tar, seleção atômica e rollback de código com compatibilidade revisada | Seleção não inicia serviço nem restaura dados; manutenção deve permanecer até decisão explícita |
| [Plano G10 histórico](https://github.com/gustavomhss/Orchestra-SF/blob/736a5087c223629be4d73c8a4535d615fcafd96a/docs/architecture/teams-profile-qualification-review.json) | Obrigações de inventário, checkpoint, efeitos, clone, retomada e evidência | `sf/azure/recovery/recovery.py` e o spec de ensaio não estão no dev consultado; seus comandos não são uma rota executável atual |

Os componentes de recuperação e o novo adaptador backup/clone estão em dev. O executor operacional deve vincular a reserva, a migração admitida, a chave utilizável, as observações do host e os efeitos de negócio às etapas abaixo. Os controles de componente, incluindo os 17 do replay #658 e os controles #669/#674, não executaram essa sequência. Não há recibo de ensaio no tar final nesta preparação.

## Entradas e responsáveis

| Entrada verificável | Responsável a confirmar | Bloqueio quando ausente |
| --- | --- | --- |
| Candidato C, árvore T, tar H e recibos G05/G06/G07; ACKs de Migração e Release | Migração + Release | Não iniciar o ensaio final |
| Reserva do host Linux x64 descartável, janela do ensaio, operador, limites de acesso e isolamento de G08 | Dono QA/host | Não instalar, parar serviço ou modificar dados |
| Candidato anterior R já instalado e retido em `/opt/orchestra-sf/releases/<R>`, com `.a7-source.json`, manifesto, roster, hashes e permissões verificados; tar original preservado | Release | O rollback não instala R a partir do tar: verificar a presença do release retido antes de selecionar C |
| Compatibilidade de R com o estado produzido por C, revisada independentemente | Revisor + operador | Rollback de código bloqueado |
| Inventário dos dados, donos por Team, mapeamentos, colisões e quarentena | Migração + dono dos dados | Não atribuir dados ao primeiro Team/default |
| Adaptador backup/clone desta frente e executor de migração admitido, em C | Donos backup + Migração | Confirmar contrato operacional e reserva; não improvisar SQL |
| Destino privado fora da área restaurada, retenção, backup verificado e acesso autorizado à chave | Dono backup/chave | Não fazer corte sem recuperação verificável |
| Controle do escritor antigo, drenagem de tarefas/Relay/jobs e critério de quiescência | Dono runtime/host | Não obter snapshot com escritores desconhecidos |
| Sessões Entra reais: ator de negócio e recuperador administrativo; grants atuais | Dono Entra | Não inferir autorização a partir de acesso root |
| Registro monotônico externo e observador independente capaz de confirmar efeito e recibo | Dono do observador | Recusa de restauração/retomada; não fabricar pin |
| Destino controlado dos efeitos e consulta independente de quantidade/identidade | Dono do destino QA | Não declarar ausência de duplicação |
| RPO/RTO e condições de seguir/reverter aprovados para o ensaio | Release + dono operacional | Registrar medições, sem inventar metas |

Os responsáveis históricos A7/VM, A8/Identidade e A10/Release aparecem em [#248](https://github.com/gustavomhss/Orchestra-SF/pull/248), [#245](https://github.com/gustavomhss/Orchestra-SF/pull/245) e [#247](https://github.com/gustavomhss/Orchestra-SF/pull/247). Essas referências ajudam a coordenação; não provam uma reserva ou aceite atual.

## Observação operacional e reserva ainda pendentes

O inventário somente leitura das PRs #666/#671 não chegou ao login Azure: no run [45036787201](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45036787201), as quatro variáveis Azure vieram vazias antes da autenticação, que ficou SKIPPED. O environment `azure-mvp` existe; runners e nomes de variáveis ficaram não observáveis pelo token. A UI de Settings estava deslogada e o único desktop inventariado era um Mac offline. Esses fatos bloqueiam a descoberta operacional pelos caminhos tentados; **não comprovam ausência de reservas, hosts, dados ou chaves**. Os hashes e limites estão no [registro de execução](execution-2026-11-22.md). Nenhum parâmetro privado histórico foi reutilizado como reserva atual.

## Inventário antes de tocar os dados

O inventário privado deve cobrir:

- Release ativa, executável/factory efetivamente usados, tar, manifesto, permissões e ponteiro `current`.
- Volume e diretórios de dados, SQLite e arquivos auxiliares, anexos, relatórios privados e versões.
- Cada `business-teams/<partitionDigest>`, seu Team/tenant/instalação observados e sua origem.
- Checkpoints em `backups-teams/<partitionDigest>`, manifesto e hashes dos anexos.
- Sessões/revogação, intenções idempotentes fora da partição de negócio, recibos, outbox, deduplicação, slots consumidos, cancelamentos e identificadores já emitidos.
- Registro externo de recuperação, geração atual e identidade do observador. Ele permanece fora do backup restaurado e não pode ser recuado junto com o estado.
- Dados legados sem dono inequívoco, suas restrições e destino privado de quarentena.
- Referências à chave e à autorização de recuperação; nunca o material da chave no relatório.

Origem, destino e política de retenção são campos obrigatórios por classe de dado. Um inventário vazio ou preenchido apenas com nomes de diretórios não comprova os dados existentes.

## Sequência do ensaio

Todas as etapas estão **NOT_RUN** nesta frente. Cada transição exige o recibo anterior; uma falha mantém o acesso de negócio bloqueado e preserva os artefatos para diagnóstico.

| Etapa | Ação no ambiente isolado autorizado | Evidência exigida e condição de parada |
| --- | --- | --- |
| 1. Admitir o ensaio | Conferir reserva, C/T/H, R, atores, grants, executor, chaves e destinos. Observar a identidade real do release instalado e verificar R já retido no diretório canônico. | Manifesto de admissão e autorização do ambiente. Divergência de SHA/tar ou ator interrompe o ensaio. |
| 2. Inventariar e planejar | Executar censo e dry-run da migração; fixar mapeamentos por Team e quarentena de ambiguidade. | Inventário/digests e plano versionado. Migração mantém a posse dessa transformação. |
| 3. Parar admissões e drenar | Ativar manutenção no ingresso isolado, impedir novos comandos, drenar escritores/tarefas e parar o serviço para o checkpoint consistente. | Observações do ingresso e serviço, writers/leases drenados, sem escrita após a fronteira. |
| 4. Fazer backup e provar leitura | Executar a rota de backup admitida; verificar arquivo, anexos, destino independente e acesso à chave. Validar recuperação em destino isolado antes do corte. | Recibo de backup com hashes, recovery point, prova de leitura/restore, duração e resultado. Checkpoint isoladamente não fecha G10. |
| 5. Instalar e migrar C | Verificar e instalar o tar G07; executar a migração admitida, inclusive interrupção/retomada planejada. O escritor antigo continua recusado; R permanece instalado e retido. | Mesmos bytes C/T/H, versões, IDs/proveniência preservados, nenhum fallback para Team padrão. |
| 6. Cortar no QA restrito | Iniciar o serviço instalado e abrir apenas o ingresso restrito aos validadores da reserva, mantendo o callback Entra autorizado. Validar leitura/escrita por Team. | Identidade física do processo, health/negativos, leitura e efeito autorizado. Registrar tempo de corte/retomada. |
| 7. Checkpoint de negócio e efeito posterior | Confirmar no tar instalado as rotas #669 e o grant explícito checkpoint. Observar versão/snapshot e obter o checkpoint do Team por essa rota; depois executar o comando real com chave K, observar efeito/recibo E e publicá-los no registro monotônico pelo observador independente. | Checkpoint, manifesto, K/E e geração externa ligados à mesma instalação/Team. E precisa existir depois do checkpoint. |
| 8. Restaurar o dashboard do Team | Com recuperador Entra atualmente autorizado, chamar a rota corporativa de recuperação com o checkpoint e a versão corrente observada. | HTTP 204 e releitura durável. A fronteira posterior e as intenções externas não retrocedem. 409/403/503 são recusas, nunca sucesso. |
| 9. Reiniciar e repetir | Reiniciar de fato o serviço C; observar PID/início/exec/factory/tar. Repetir exatamente K e o payload original com autoridade revalidada. | Mesmo recibo/resultado, exatamente um efeito no destino independente, nenhuma nova emissão ou slot duplicado. |
| 10. Executar negativas | Na cópia isolada admitida, testar registro indisponível, pin/versão incompatível, revogação, principal ou Team errado. Recuperador admin sem Team pode recuperar o Team habilitado, mas não ganha acesso de negócio. | Recusas sem novo efeito/retorno de dados; estado e registro preservados. Sem fabricar credenciais ou alterar autoridade por SQL. |
| 11. Ensaiar rollback | Repetir manutenção/drenagem; validar compatibilidade de R com o estado corrente; executar dry-run e rollback de código pelos comandos existentes; reiniciar restrito e repetir K. | Código R verificado, dados e recibos pós-checkpoint preservados; mesma deduplicação. Reversão de dados é etapa separada e precisa de prova própria. |
| 12. Encerrar | Restaurar o estado de QA acordado, revogar acessos temporários, conferir limpeza de escritores e guardar os recibos. | Resultado por etapa/caso, limpeza, RPO/RTO medidos e bloqueios remanescentes. |

O efeito de Decisions já exercitado em #574 é um candidato concreto para a etapa 7. O executor deve observar uma fonte independente autorizada. Uma reabertura do SQLite no mesmo processo, um retorno HTTP isolado ou a geração de um JSON pelo teste não comprovam restart, corte e ausência de efeito duplicado.

## Interfaces atuais que o executor deve usar

### Backup e clone de integridade

Executar apenas no host e clone reservados, com os arquivos privados observados. A reserva de checkpoint vincula `sourceRelease` R e `candidate` C/T; a reserva do clone conserva a mesma origem e aponta outra VM. Não publicar reservas, inventários, backup, chave ou configuração em artefatos públicos.

~~~sh
python3 -B sf/azure/recovery/teams-checkpoint.py checkpoint \
  --reservation "$G10_CHECKPOINT_RESERVATION" \
  --g07-receipt "$G10_G07_RECEIPT" \
  --output-dir "$G10_INDEPENDENT_BACKUP_DIRECTORY"

python3 -B sf/azure/recovery/teams-checkpoint.py verify-clone \
  --reservation "$G10_CLONE_RESERVATION" \
  --archive "$G10_PRIVATE_CHECKPOINT_TAR" \
  --receipt "$G10_PRIVATE_CHECKPOINT_RECEIPT" \
  --target "$G10_EMPTY_CLONE_DIRECTORY"
~~~

O restore de arquivos verificado no clone é parte da etapa 4. Validar separadamente a utilização da chave, as classes de negócio e a recuperação operacional admitida. Nenhum recibo de integridade de arquivo autoriza ativar o clone.

### Captura e observação do checkpoint lógico

A revisão histórica em `37931c77eb07aecf01610bb0ee7d717276b85539` encontrou apenas a API interna de captura e o consumidor `recover`, conforme o pedido [7080174757](https://github.com/gustavomhss/Orchestra-SF/pull/628#issuecomment-7080174757). Essa lacuna foi resolvida no código da #669; o tar físico continua distinto do checkpoint lógico. A fonte integrada é [corporate-checkpoint-http.ts](https://github.com/gustavomhss/Orchestra-SF/blob/6beab17e71c246b871b5a7f92c5de5ff2b0477d8/modules/sucafina/Sucafinav1/runtime/corporate-checkpoint-http.ts).

As duas operações usam a sessão Microsoft original e a origem HTTPS exata, grupo administrativo atual e **uma única entrada de grant** com `migrationActions:["checkpoint"]`. `recover` não concede captura implicitamente; um ator que executa ambas precisa de `["checkpoint","recover"]` explícito. Não há obrigação de participar do Team para o papel administrativo, nem acesso de negócio concedido pela captura.

1. Enviar `POST <mount>/api/ui/team-profile-migration/checkpoint-observe`, `Content-Type:application/json`, corpo com somente `teamObjectId`. A resposta `sf-corporate-checkpoint-observation-v1` fornece `datasetVersion`, `snapshotDigest`, `frontierDigest`, revisão da política, digests de instalação/partição, incarnation/revision de produto e horário. Não retorna os dados brutos nem cria um store ausente.
2. Enviar `POST <mount>/api/ui/team-profile-migration/checkpoint` com exatamente `teamObjectId`, `expectedVersion`, `expectedSnapshotDigest` da observação e `confirm:true`. O corpo é limitado a 2 KiB; campos extras são recusados.
3. Conferir o **201** e o schema `sf-corporate-checkpoint-v1`, `checkpointId`, horários/digests, quantidade de anexos/bytes e `independentApproval:false`. A implementação compara o snapshot inteiro, revalida sessão/grupo/política antes de publicar, conserva checkpoints anteriores e relê o arquivo/anexos antes da resposta.
4. Após o efeito posterior E, observar novamente a versão/fronteira corrente para a recuperação. A versão de `recover` deve vir dessa observação atual, não do arquivo antigo. O observador independente continua responsável por confirmar E/recibo e publicar a geração externa admitida.

O checkpoint permanece privado em `backups-teams/<partitionDigest>/dashboard/<checkpointId>`. A observação de metadados não aprova o restore, escreve o registro, escolhe a geração ou substitui a fonte independente do efeito. Tar físico, chave utilizável e restart/rollback continuam provas separadas.

Respostas 403, 404, 409 e 503 são recusas/indisponibilidade, nunca sucesso. Uma resposta perdida ou uma recusa tardia depois da publicação pode deixar um checkpoint existente: conferir o inventário privado antes de repetir. Não inferir ausência de arquivo a partir de timeout. Antes do ensaio final, confirmar o contrato completo na composição C instalada, incluindo o decoder #675, já integrado em dev pela #665, e a política persistente corrente da #677.

### Recuperação corporativa

Esta rota recupera somente o dashboard do Team indicado. A prova checkpoint → efeito → restore → retry das etapas 7–9 cobre esse domínio. O backup operacional completo da etapa 4 precisa comprovar separadamente a recuperação das demais classes inventariadas, incluindo Planner, Procurement, arquivos e estado do host. O HTTP 204 desta rota não encerra essa obrigação.

Fonte: [corporate-recovery-http.ts integrado](https://github.com/gustavomhss/Orchestra-SF/blob/6beab17e71c246b871b5a7f92c5de5ff2b0477d8/modules/sucafina/Sucafinav1/runtime/corporate-recovery-http.ts).

A instalação habilita a rota com `SUCAFINA_CORPORATE_RECOVERY_REGISTER`. O SQLite externo e seus ancestrais são controlados por root; o serviço mantém acesso de leitura, usa o mesmo inode e segura a geração até o commit. A fonte independente publica gerações crescentes. O servidor não publica nem repara o próprio testemunho.

`POST <mount>/api/ui/team-profile-migration/recover`, mesma origem HTTPS, sessão Entra atual, `Content-Type: application/json`, com exatamente:

```json
{
  "teamObjectId": "<Team habilitado observado>",
  "checkpointId": "<backup-UUID observado>",
  "expectedVersion": 0,
  "confirm": true
}
```

O zero acima é apenas o tipo/formato do exemplo; o executor deve substituir pela versão corrente observada. O recuperador precisa de grupo administrativo atual e uma única entrada de grant com `migrationActions: ["recover"]`. A autorização e a mesma revisão opaca do catálogo persistente são reavaliadas dentro do pin independente e antes do commit. Team desabilitado/removido, mudança de revisão ou indisponibilidade da política impedem a recuperação; `enabledTeamIds` é apenas seed inicial. A resposta contém apenas status, sem expor o estado recuperado.

O comando de efeito Decisions usa `POST <mount>/teams/<teamObjectId>/dashboard?sf=workbench-command`, `Idempotency-Key` estável e DTO real da operação admitida. Requer a ativação `SUCAFINA_NATIVE_TEAM_DECISIONS=1` e as permissões reais do principal. O roteiro não inventa um payload de negócio ou concede grant automaticamente.

### Verificação e rollback do tar

Os comandos abaixo existem no instalador atual. São uma receita preparada para o operador no ambiente isolado autorizado. Os arquivos de aprovação e compatibilidade precisam de emissores reais; o roteiro não os preenche nem assina.

```sh
python3 -B sf/azure/vm/install-factory-distribution.py verify \
  --artifact "$G10_TAR_PATH" --receipt "$G10_PACKAGE_RECEIPT" \
  --candidate "$G10_CANDIDATE_SHA" --sha256 "$G10_ARCHIVE_SHA256"

python3 -B sf/azure/vm/install-factory-distribution.py rollback \
  --from-candidate "$G10_CANDIDATE_SHA" --to-candidate "$G10_PREVIOUS_SHA" \
  --approval "$G10_ROLLBACK_APPROVAL" \
  --compatibility-proof "$G10_COMPATIBILITY_PROOF" \
  --fqdn "$G10_QA_FQDN" --dry-run
```

Após os pré-requisitos verificados, o operador usa `--apply` para a etapa real de rollback no ensaio. O preflight real exige serviço parado e Caddy em manutenção; não deve ser substituído. O instalador confere emissor da aprovação diferente do revisor de compatibilidade, candidatos exatos, recovery point e hash do documento de compatibilidade.

O retorno `ROLLED_BACK_CODE_ONLY_CADDY_STILL_503` comprova apenas a troca de código. É necessário iniciar, observar o processo e revalidar dados, recibos e retry antes de considerar a etapa concluída.

## Condições de seguir e de reverter

Seguir no ensaio exige identidade C/T/H exata, backup recuperável com chave disponível, escritores controlados, autorização atual, fronteira externa íntegra e todos os controles da etapa anterior aprovados.

Interromper e manter o ambiente em manutenção se houver divergência de pacote/instalação, acesso cruzado entre Teams, efeito não confirmado, repetição de efeito, perda de recibos, backup incompleto, ausência da chave, escritor antigo ativo, falha de isolamento ou incompatibilidade de rollback. Preservar os dados/recibos atuais antes de qualquer restauração. Quando a compatibilidade com R não estiver provada, permanecer parado para decisão operacional; não selecionar R por tentativa.

O go/no-go de produção exige G01–G10 qualificados nos respectivos contratos e a decisão humana sobre a janela. G09 e #588 continuam com os donos existentes. Este runbook não aprova produção.

## Recibo G10 e fechamento

O registro final deve conter dono/executor/revisor, autorização e reserva, C/T/H e candidato R, workflow ou executor/versão, run/tentativa/casos, inventário de origem/destino, mapeamento/quarentena, backup/recovery point/hash/chave por referência, writer fence, corte, PID/restart observado, checkpoint, efeito/recibo posterior, geração externa, restore, retry sem duplicação, rollback e releituras, medidas RPO/RTO, limpeza e resultado de cada negativa.

Usar hashes e aliases sanitizados no repositório. Estado bruto, chaves, cookies, IDs privados, banco e arquivos de backup ficam no fluxo privado autorizado. Campos ainda não observados permanecem nulos ou NOT_RUN, nunca PASS.

**Fechamento:** ensaio realizado no tar final instalado, com backup, corte, retomada e rollback comprovados, preservando recibos e efeitos posteriores ao checkpoint. A preparação documental e as provas antigas não atendem sozinhas a esse fechamento.

### Integração fixada nesta edição

A #665 incorporou dev em `51278d55623f69f950785a9de8b8f1d0082bf62a`, árvore `a64eb0f6d173036ea9b380ce81e80efbaec730f0`, incluindo #670 e #669/#674. O [run 45039881113](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45039881113) aprovou a composição de componente nesse source, sem aprovação instalada.

A [#675](https://github.com/gustavomhss/Orchestra-SF/pull/675) entrou primeiro **na branch #665** e posteriormente em dev por #665. O merge dependente histórico foi `4bee9c656034bb6771929a3d1eb893bc65af6a7a`; sua árvore `b3614391f2d6a7a4f89bd298aa861be3a469a972` é idêntica à fonte testada `a675a5792b9260054d043624dc45d60a5adb8dbf`. Admite `checkpoint` separado de `recover` e normaliza apenas namespaces/operations omitidos para listas vazias, sem ampliar autoridade Session/negócio. O [run 45040408446](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45040408446), job `137263353207`, passou 46 casos/481 asserções e preservou um skip anterior de ownership/root; tipos SF e guards 78/97 paths/zero findings. Snapshot `9709e78f39f0ec0449e2319242f1b37aec335911`. Nenhum ACK final ou qualificação instalada é inferido.

O complemento #675 tem artefato [14761970496](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45040408446/artifacts/14761970496), 12.387 bytes, ZIP `58965ccb1590817ecce89d438c7b645b151091f5da951cd9efe30d9ad5fe403c` e recibo `f8eaf43472da823e05ebb654017a0c71efac9d2f16513dfab5c2d7159be53cca`. Root conferiu download/CRC/nove hashes internos/JUnit/dois digests de fontes; revisão 6013130249 e handoff 7081657071. A primeira execução 45040173632 falhou apenas no typecheck do teste; a correção não mudou o produto. O positivo atual não elimina o skip de ownership nem comprova ensaio G10.
