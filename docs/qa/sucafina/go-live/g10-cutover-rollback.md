# G10 — ensaio de virada, retomada e rollback

## Estado e escopo

**RUNBOOK E ADAPTADOR BACKUP/CLONE IMPLEMENTADOS; CONTROLES APROVADOS; ENSAIO INSTALADO NÃO EXECUTADO.** A sessão Astra desta frente coordena G10. O operador do backup/host, o observador independente dos efeitos e o responsável pelo corte ainda precisam ser confirmados para o ambiente reservado. Esta preparação não registra aprovação de janela nem autoriza virada de produção.

O [handoff](https://github.com/gustavomhss/Orchestra-SF/blob/c02f329d48d37e2f6296154978cd8a7cf80bcb64/docs/qa/sucafina/astra-go-live-handoff.md) permite a qualificação em ambientes isolados autorizados. Depois do tar G07 verificado, G08 e G10 podem avançar em paralelo com processos, dados, sessões e escritores separados. O candidato final deve ser o mesmo SHA/árvore e o tar deve ter o mesmo SHA-256 nos dois ambientes.

Referência de leitura: `dev@79912446753af5bb291fc2581543732eb4c83057`, árvore `5c32cd72537799632e7d2583c1775df1d88b8780`. Não é o pin final da Release.

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

## O que já existe e o limite das provas

| Fonte | Capacidade disponível | Limite observado |
| --- | --- | --- |
| [PR #561](https://github.com/gustavomhss/Orchestra-SF/pull/561) | Retenção de recibos/efeitos confirmados na restauração corporativa | Fonte externa simulada; não qualifica o host de QA |
| [PR #568](https://github.com/gustavomhss/Orchestra-SF/pull/568), [run 44876219213](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44876219213) | Recuperação Microsoft por Team com registro externo, SQLite e arquivos reais | 32 testes aprovados e um caso root pulado; OIDC/Graph controlados; não é PASS de G10 |
| [PR #574](https://github.com/gustavomhss/Orchestra-SF/pull/574), [run 44877477431](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44877477431) | Checkpoint, efeito Decisions, restore e reabertura/retry com mesma chave | Sete testes hospedados; reabrir a factory não prova restart real do serviço Azure |
| [Guia Microsoft atual](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/docs/guides/sucafina-microsoft-installation.md) | Configuração, rota de recuperação e comando Decisions reais | Procedimento de produto, não recibo de ensaio |
| [Instalador atual](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/sf/azure/vm/install-factory-distribution.py) e [guia Azure](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/sf/azure/README.md) | Verificação do tar, seleção atômica e rollback de código com compatibilidade revisada | Seleção não inicia serviço nem restaura dados; manutenção deve permanecer até decisão explícita |
| [Plano G10 histórico](https://github.com/gustavomhss/Orchestra-SF/blob/736a5087c223629be4d73c8a4535d615fcafd96a/docs/architecture/teams-profile-qualification-review.json) | Obrigações de inventário, checkpoint, efeitos, clone, retomada e evidência | `sf/azure/recovery/recovery.py` e o spec de ensaio não estão no dev consultado; seus comandos não são uma rota executável atual |

Os componentes de recuperação e o novo adaptador backup/clone estão em dev. O executor operacional deve vincular a reserva, a migração admitida, a chave utilizável, as observações do host e os efeitos de negócio às etapas abaixo. Os controles de componente, incluindo os 17 do replay final, não executaram essa sequência. Não há recibo de ensaio no tar final nesta preparação.

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
| 7. Checkpoint de negócio e efeito posterior | **Bloqueado até confirmar a rota operacional de captura lógica no tar Microsoft.** Obter o checkpoint do Team por essa rota; depois executar o comando real com chave K, observar efeito/recibo E e publicá-los no registro monotônico pelo observador independente. | Checkpoint, manifesto, K/E e geração externa ligados à mesma instalação/Team. E precisa existir depois do checkpoint. |
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

### Dependência operacional do checkpoint lógico

A revisão de `dev@37931c77eb07aecf01610bb0ee7d717276b85539` confirmou uma lacuna na etapa 7. O tar físico criado por `teams-checkpoint.py` contém `state/`, `configuration/` e seu inventário. Ele não cria o checkpoint lógico `backups-teams/<partition>/dashboard/backup-<UUID>` consumido pela rota corporativa.

A API interna [`createLocalBackups(...).capture(...)`](https://github.com/gustavomhss/Orchestra-SF/blob/37931c77eb07aecf01610bb0ee7d717276b85539/modules/sucafina/Sucafinav1/runtime/local-backups.ts) produz esse checkpoint, mas a [factory Microsoft](https://github.com/gustavomhss/Orchestra-SF/blob/37931c77eb07aecf01610bb0ee7d717276b85539/modules/sucafina/Sucafinav1/local/microsoft-entry.ts) não expõe uma operação de captura. A ação `backup-now` existente em `local/entry.ts` é restrita à composição Local Operator. O uso direto da API no teste Microsoft não fornece um comando ao operador do tar.

Antes do ensaio, a coordenação precisa confirmar a rota de captura e o dono da composição, com autorização corrente, Team/instalação explícitos e saída ligada ao checkpoint/manifesto. Também deve definir a leitura operacional de `snapshot.versions.dataset?.version ?? 0` e da fronteira corrente entregue ao observador independente. A requisição `recover` usa essa versão de dataset; não usa uma versão inferida do arquivo de backup. Pedido registrado em [7080174757](https://github.com/gustavomhss/Orchestra-SF/pull/628#issuecomment-7080174757).

Até essa rota existir, as etapas 7–9 ficam `BLOCKED_BY_CHECKPOINT_OPERATION`. Não substituir o checkpoint lógico por export JSON público, tar físico, fixture ou escrita SQL. A captura não concede autoridade de recuperação, e a leitura local não substitui a observação independente do efeito nem publica a geração monotônica.

### Recuperação corporativa

Esta rota recupera somente o dashboard do Team indicado. A prova checkpoint → efeito → restore → retry das etapas 7–9 cobre esse domínio. O backup operacional completo da etapa 4 precisa comprovar separadamente a recuperação das demais classes inventariadas, incluindo Planner, Procurement, arquivos e estado do host. O HTTP 204 desta rota não encerra essa obrigação.

Fonte: [corporate-recovery-http.ts](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/modules/sucafina/Sucafinav1/runtime/corporate-recovery-http.ts).

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

O zero acima é apenas o tipo/formato do exemplo; o executor deve substituir pela versão corrente observada. O recuperador precisa de grupo administrativo atual e uma única entrada de grant com `migrationActions: ["recover"]`. A autorização é reavaliada antes do commit. A resposta contém apenas status, sem expor o estado recuperado.

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

