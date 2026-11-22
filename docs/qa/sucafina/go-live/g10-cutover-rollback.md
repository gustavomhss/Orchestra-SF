# G10 — ensaio de virada, retomada e rollback

## Estado e escopo

**RUNBOOK PREPARADO; ENSAIO NÃO EXECUTADO.** A sessão Astra desta frente coordena G10. O operador do backup/host, o observador independente dos efeitos e o responsável pelo corte ainda precisam ser confirmados para o ambiente reservado. Esta preparação não registra aprovação de janela nem autoriza virada de produção.

O [handoff](https://github.com/gustavomhss/Orchestra-SF/blob/c02f329d48d37e2f6296154978cd8a7cf80bcb64/docs/qa/sucafina/astra-go-live-handoff.md) permite a qualificação em ambientes isolados autorizados. Depois do tar G07 verificado, G08 e G10 podem avançar em paralelo com processos, dados, sessões e escritores separados. O candidato final deve ser o mesmo SHA/árvore e o tar deve ter o mesmo SHA-256 nos dois ambientes.

Referência de leitura: `dev@79912446753af5bb291fc2581543732eb4c83057`, árvore `5c32cd72537799632e7d2583c1775df1d88b8780`. Não é o pin final da Release.

## O que já existe e o limite das provas

| Fonte | Capacidade disponível | Limite observado |
| --- | --- | --- |
| [PR #561](https://github.com/gustavomhss/Orchestra-SF/pull/561) | Retenção de recibos/efeitos confirmados na restauração corporativa | Fonte externa simulada; não qualifica o host de QA |
| [PR #568](https://github.com/gustavomhss/Orchestra-SF/pull/568), [run 44876219213](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44876219213) | Recuperação Microsoft por Team com registro externo, SQLite e arquivos reais | 32 testes aprovados e um caso root pulado; OIDC/Graph controlados; não é PASS de G10 |
| [PR #574](https://github.com/gustavomhss/Orchestra-SF/pull/574), [run 44877477431](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44877477431) | Checkpoint, efeito Decisions, restore e reabertura/retry com mesma chave | Sete testes hospedados; reabrir a factory não prova restart real do serviço Azure |
| [Guia Microsoft atual](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/docs/guides/sucafina-microsoft-installation.md) | Configuração, rota de recuperação e comando Decisions reais | Procedimento de produto, não recibo de ensaio |
| [Instalador atual](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/sf/azure/vm/install-factory-distribution.py) e [guia Azure](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/sf/azure/README.md) | Verificação do tar, seleção atômica e rollback de código com compatibilidade revisada | Seleção não inicia serviço nem restaura dados; manutenção deve permanecer até decisão explícita |
| [Plano G10 histórico](https://github.com/gustavomhss/Orchestra-SF/blob/736a5087c223629be4d73c8a4535d615fcafd96a/docs/architecture/teams-profile-qualification-review.json) | Obrigações de inventário, checkpoint, efeitos, clone, retomada e evidência | `sf/azure/recovery/recovery.py` e o spec de ensaio não estão no dev consultado; seus comandos não são uma rota executável atual |

Os componentes de recuperação estão em dev. A rota operacional de checkpoint/backup completo e o executor do ensaio instalado precisam ser confirmados ou implementados pelo dono acordado antes da execução. Não há recibo de ensaio no tar final nesta preparação.

## Entradas e responsáveis

| Entrada verificável | Responsável a confirmar | Bloqueio quando ausente |
| --- | --- | --- |
| Candidato C, árvore T, tar H e recibos G05/G06/G07; ACKs de Migração e Release | Migração + Release | Não iniciar o ensaio final |
| Reserva do host Linux x64 descartável, janela do ensaio, operador, limites de acesso e isolamento de G08 | Dono QA/host | Não instalar, parar serviço ou modificar dados |
| Candidato anterior R já instalado e retido em `/opt/orchestra-sf/releases/<R>`, com `.a7-source.json`, manifesto, roster, hashes e permissões verificados; tar original preservado | Release | O rollback não instala R a partir do tar: verificar a presença do release retido antes de selecionar C |
| Compatibilidade de R com o estado produzido por C, revisada independentemente | Revisor + operador | Rollback de código bloqueado |
| Inventário dos dados, donos por Team, mapeamentos, colisões e quarentena | Migração + dono dos dados | Não atribuir dados ao primeiro Team/default |
| Executor de backup/checkpoint e de migração, versão e interface admitida | Donos backup + Migração | Não improvisar cópia de banco ou SQL |
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
| 7. Checkpoint de negócio e efeito posterior | Criar um checkpoint de Team pela operação suportada. Executar um comando real com chave K; observar o efeito/recibo E e publicá-los no registro monotônico pelo observador independente. | Checkpoint, manifesto, K/E e geração externa ligados à mesma instalação/Team. E precisa existir depois do checkpoint. |
| 8. Restaurar o dashboard do Team | Com recuperador Entra atualmente autorizado, chamar a rota corporativa de recuperação com o checkpoint e a versão corrente observada. | HTTP 204 e releitura durável. A fronteira posterior e as intenções externas não retrocedem. 409/403/503 são recusas, nunca sucesso. |
| 9. Reiniciar e repetir | Reiniciar de fato o serviço C; observar PID/início/exec/factory/tar. Repetir exatamente K e o payload original com autoridade revalidada. | Mesmo recibo/resultado, exatamente um efeito no destino independente, nenhuma nova emissão ou slot duplicado. |
| 10. Executar negativas | Na cópia isolada admitida, testar registro indisponível, pin/versão incompatível, revogação, principal ou Team errado. Recuperador admin sem Team pode recuperar o Team habilitado, mas não ganha acesso de negócio. | Recusas sem novo efeito/retorno de dados; estado e registro preservados. Sem fabricar credenciais ou alterar autoridade por SQL. |
| 11. Ensaiar rollback | Repetir manutenção/drenagem; validar compatibilidade de R com o estado corrente; executar dry-run e rollback de código pelos comandos existentes; reiniciar restrito e repetir K. | Código R verificado, dados e recibos pós-checkpoint preservados; mesma deduplicação. Reversão de dados é etapa separada e precisa de prova própria. |
| 12. Encerrar | Restaurar o estado de QA acordado, revogar acessos temporários, conferir limpeza de escritores e guardar os recibos. | Resultado por etapa/caso, limpeza, RPO/RTO medidos e bloqueios remanescentes. |

O efeito de Decisions já exercitado em #574 é um candidato concreto para a etapa 7. O executor deve observar uma fonte independente autorizada. Uma reabertura do SQLite no mesmo processo, um retorno HTTP isolado ou a geração de um JSON pelo teste não comprovam restart, corte e ausência de efeito duplicado.

## Interfaces atuais que o executor deve usar

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
