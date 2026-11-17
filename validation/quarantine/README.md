# Quarentena — releases de pré-visualização Sucafina (1.18.27 / linux-x64-baseline)

**Data:** 2026-11-17 UTC (Sweden Central). **Estado:** CUSTÓDIA DE ORIGEM NÃO CERTIFICADA.
**Decisão reportada pelo dono:** retirar as versões erradas da VM e preservar cópias forenses. Este inventário não aprova redeploy.

## Por que estas quatro builds foram removidas

Os `package.json` conservados identificam `@humanguardrail/cli-linux-x64-baseline` 1.18.27 e `sfFactory: bin/local/entry.mjs`. A versão `preview-896fc974` foi **reportada** como a única servida na VM, mas o go-live requer Orchestra Web com módulo Sucafina nativo. As ocorrências abaixo foram reportadas nessa release:

- Bug de **perda de estado no formulário de import OPEX** (datas, arquivo e destino zerados no re-render) — correção proposta no PR draft #300, não verificada neste tar;
- **Fila de procurement devolvendo 503** `procurement-queue-unavailable` em instalação vazia/recem-empacotada — correção proposta no PR draft #303, não verificada neste tar;
- Falhas de CI de base foram reportadas, inclusive `sf/test-CI-SF`; não há prova de que se manifestem igualmente nos quatro tars.
- Superfície visual errada para o go-live (não é a identidade Orchestra ambicionada).

Os manifestos no repositório são distintos, mas não demonstram sua origem. A parada da unit `orchestra-sf-staging.service` e a remoção de `/opt/orchestra-sf/releases/*` são **relatadas no PR #306**, não inspecionadas independentemente no estado atual da VM.

## O que está em cada diretório

| Diretório | Tar (LFS) | distribution.json SHA256 | Conteúdo |
|---|---|---|---|
| `preview-2dcbafcf/` | `preview-2dcbafcf-quarantine.tar.gz` | `732b443aef4819d7…` | build embrionária (234M) |
| `preview-53f20783/` | `preview-53f20783-quarantine.tar.gz` | `cb211181e8ed65ec…` | build intermediária (230M) |
| `preview-896fc974/` | `preview-896fc974-quarantine.tar.gz` | `afdc14ae826fd06c…` | **reportada como a última servida** (230M) |
| `staging-591424661c/` | `staging-591424661c-quarantine.tar.gz` | `299510e2630affb3…` | build mais antiga 1.18.27 (230M) |

Os hashes e tamanhos abaixo são os valores **declarados** pelo arquivo `SHA256SUMS.txt` e ponteiros LFS. A alegada medição original na VM e conferência após download ainda exigem recibos de origem independentes.

| Tar | SHA256 | bytes |
|---|---|---|
| preview-2dcbafcf-quarantine.tar.gz | f405b3f610cfca1cda6ae5a39710af8c0d943944d416e49889d893391ff4db43 | 94317936 |
| preview-53f20783-quarantine.tar.gz | 443b912e7721d48fd1fd0368c73a5f4ec106771ffb669c0c24a1bdd4121a10a9 | 93127694 |
| preview-896fc974-quarantine.tar.gz | de2221d8c9de8740b2acace6bf4657b64442c10e84c19ddd7c6cec9ab21aae31 | 93132579 |
| staging-591424661c-quarantine.tar.gz | 1654377b3c0b793ffe8ad4b91e8629521139cc77ffc7014b3c87074932182306 | 93138263 |

Azure ARM confirma a existência do container `quarantine` na conta `orchsfstage2611162353`, em `swedencentral`, com `allowBlobPublicAccess=false` e TLS mínimo 1.2 na conta. **Não confirma os quatro objetos**: a leitura do data plane com `--auth-mode login` foi negada por ausência de papel `Storage Blob Data Reader`.

## Recibos Azure independentes consultados em 2026-11-17 (UTC)

| Fonte | Comprovado | Não comprovado |
|---|---|---|
| Snapshot (ARM) | `orchsf-qa-freeze-20261117`, `Succeeded`, `swedencentral`, criado `2026-11-17T14:23:14.1985736Z`, origem: **OS disk** associado à `orchsf-vm`. | Não é snapshot integral da VM/DB e não prova quem criou os tars. |
| Activity Log: snapshot | `Microsoft.Compute/snapshots/write`, `Succeeded` em `2026-11-17T14:23:17.7845388Z`; caller `danielzinhu_ro@hotmail.com`; correlation ID `9508c981-a4c8-45f4-b18e-0906a39edf93`. | A identidade de quem solicitou o snapshot **não** é a de quem compilou o produto. |
| Activity Log: VM | `runCommand/action` com `Succeeded` em `2026-11-17T15:52:33.4621558Z` (correlation `8675efd8-86b5-4e77-8c59-aed653f4156f`) e `2026-11-17T15:55:06.1925239Z` (`1f926682-99ce-4b17-9242-8bf7662a3eab`), mesmo caller. | Esses eventos **não exibem comandos nem saídas**; não comprovam criação, compactação, remoção ou upload dos quatro tars. |
| Storage (ARM) | Conta em `swedencentral`, container `quarantine` existente e acesso público ao Blob desabilitado na conta. | Nenhum `PutBlob`/recebimento individual, byte-size, versão ou `ETag` dos objetos foi validado. |
| Git LFS | Quatro ponteiros SHA256 e arquivo `SHA256SUMS.txt` internamente correspondentes. | Ponteiros/hashes autoconsistentes **não** atestam fonte independente nem conteúdo materializado de um clone. |

Reconsulta (sem publicar segredos ou copiar tokens):

~~~sh
az monitor activity-log list \
  --correlation-id 9508c981-a4c8-45f4-b18e-0906a39edf93 \
  --start-time 2026-11-17T14:00:00Z -o json
~~~

## Cadeia de custódia: **FIX-FIRST / recibos faltantes**

**Não declarar custódia verificada** até fechar as quatro cadeias fonte VM → upload → recebimento Blob → Git LFS, uma por tar. O usuário relatou remoção dos releases da VM; não reconstruir a história por inferência.

1. **Origem na VM.** Para cada release: caminho original, origem (commit/CI job/produtor, caso exista), manifesto e SHA256 de cada arquivo no diretório original; saída assinada/registrada do comando de criação do tar, tamanho e SHA256 **antes do envio**, com data UTC e executor. Recuperar evidência do snapshot em VM **isolada, com disco montado somente leitura**, e logs pré-existentes. `stat` pode fornecer UID/GID e timestamps, mas `ctime` **não é horário de criação**, UID **não identifica o ator**, e data do tar não prova autoria. Sem auditoria/log, registrar autor e horário exato de geração como **desconhecidos**.
2. **Ordem dos uploads.** Exigir log cronológico real dos quatro envios ao container privado: comando sem segredo, blob name exato, executor, UTC, status da resposta, `x-ms-request-id`/ID de transação, tamanho, `ETag`/version ID e hash local pré-upload. O ARM `runCommand` não é recibo de `PutBlob`. `Last-Modified` pode ter sido alterado por sobrescrita; sozinho não certifica a ordem original.
3. **Recebimento independente.** Após conceder somente RBAC `Storage Blob Data Reader`, consultar propriedades dos quatro objetos e baixar cópias de inspeção; registrar horário/`ETag`/tamanho e confrontar **SHA256 independente do original** (VM/snapshot), do Blob e do LFS. Sem logs StorageBlobLogs ou recibo do cliente, registrar **lacuna irrecuperável**, sem inventar um recibo retroativo.
4. **Fechamento.** Adicionar a este README os quatro pares de IDs de transação e hashes reconciliados somente quando verificáveis; uma revisão separada deve aceitar. O estado atual permanece **PENDENTE**, embora o snapshot e atividade ARM sejam reais.

Consulta de propriedades pendente de autorização de dados (não contornar RBAC via account key/SAS):

~~~sh
ACCOUNT=orchsfstage2611162353
CONTAINER=quarantine
az storage blob list --account-name "$ACCOUNT" -c "$CONTAINER" \
  --auth-mode login \
  --query '[].{name:name,bytes:properties.contentLength,modified:properties.lastModified,etag:properties.etag,md5:properties.contentSettings.contentMd5}' -o json
# Após descobrir o nome EXATO: az storage blob show --account-name "$ACCOUNT" -c "$CONTAINER" -n "$BLOB_NAME" --auth-mode login -o json
~~~

## Integridade pós-clone via Git LFS

No commit exato desta quarentena, da **raiz do clone**, com `git-lfs` e `sha256sum` instalados:

~~~sh
git lfs pull --include="validation/quarantine/**/*.tar.gz" --exclude=""
git lfs ls-files
git lfs fsck
sha256sum -c validation/quarantine/SHA256SUMS.txt
~~~

Aceite mínimo: quatro objetos LFS baixados, `git lfs fsck` sem erros e **4/4 OK** no `sha256sum -c`; um pointer de texto no lugar do tar falha. Isso valida apenas o clone em relação ao Git, **não** a origem independente na VM. Para cadeia de custódia, comparar também os downloads do Blob e a fonte de origem, não apenas o `SHA256SUMS.txt` do próprio PR.

## Recuperação A — OS disk do snapshot `orchsf-qa-freeze-20261117`

**Preferir nova VM isolada** para comparar os arquivos originais; o snapshot antecede a remoção relatada e pode voltar a expor a **versão errada**. Troca de disco na VM existente exige autorização expressa, janela de indisponibilidade e plano de retorno. Estes são comandos de runbook **não executados nesta revisão**.

Verificar snapshot e identificar/preservar o ID do disco atual:

~~~sh
RG=orchestra-sf-mvp
VM=orchsf-vm
SNAP=orchsf-qa-freeze-20261117
az snapshot show -g "$RG" -n "$SNAP" \
  --query '{state:provisioningState,source:creationData.sourceResourceId,created:timeCreated,location:location}' -o json
CURRENT_OS_DISK="$(az vm show -g "$RG" -n "$VM" \
  --query storageProfile.osDisk.managedDisk.id -o tsv)"
printf 'Disco atual: %s\n' "$CURRENT_OS_DISK"
~~~

**Somente se autorizado**, com operador responsável, fazer snapshot de segurança do disco atual, restaurar disco novo, deallocate e trocar o OS disk (nunca sobrescrever o disco anterior):

~~~sh
SAFETY="orchsf-os-pre-restore-$(date -u +%Y%m%d%H%M%S)"
RESTORE="orchsf-os-restored-$(date -u +%Y%m%d%H%M%S)"
az snapshot create -g "$RG" -n "$SAFETY" \
  --source "$CURRENT_OS_DISK" --location swedencentral
az disk create -g "$RG" -n "$RESTORE" \
  --source "$SNAP" --location swedencentral
RESTORED_OS_DISK="$(az disk show -g "$RG" -n "$RESTORE" --query id -o tsv)"
az vm deallocate -g "$RG" -n "$VM"
az vm update -g "$RG" -n "$VM" --os-disk "$RESTORED_OS_DISK"
az vm start -g "$RG" -n "$VM"
~~~

Antes de liberar tráfego: verificar boot, serviço, configurações, autenticação/OIDC, smoke em loopback e origem real. Para retornar, deallocate, `az vm update --os-disk "$CURRENT_OS_DISK"` e start (se o disco original ainda for íntegro). O snapshot é **somente de OS disk**: não cobre banco externo, data disks, blob storage, rede, identidade Azure, segredos externos nem consistência transacional de aplicativo.

## Recuperação B — container privado → release na VM

Recuperação **não significa aprovação para go-live**. Fazer em host isolado primeiro. Com leitura de blobs autorizada, escolher nome **real** retornado pelo `blob list` e SHA256 correspondente da tabela, sem presumir a estrutura do container:

~~~sh
ACCOUNT=orchsfstage2611162353
CONTAINER=quarantine
BLOB_NAME='<nome-real-obtido-no-blob-list>'
EXPECTED_SHA='<sha256-exato-da-tabela>'
OUT=/tmp/orchestra-sf-quarantine.tar.gz
az storage blob download --account-name "$ACCOUNT" -c "$CONTAINER" \
  --name "$BLOB_NAME" --file "$OUT" --auth-mode login
printf '%s  %s\n' "$EXPECTED_SHA" "$OUT" | sha256sum -c -
tar -tzf "$OUT" | head -80
~~~

**Abortar** se checksum/bytes/manifesto divergem; inspecionar caminhos absolutos, `..`, links e arquivos inesperados no tar antes da extração. Após aprovação, extrair como conteúdo não confiável em **novo** `/opt/orchestra-sf/releases/recovery-<ID>`, sem sobrescrever outros releases. Verificar `distribution.json`, `checksums.sha256`, `package.json` e `bin/local/entry.mjs` (no nível correto do tar), permissões e checksums internos.

Para re-subir, **inspecionar antes** `systemctl cat orchestra-sf-staging.service` e `systemctl show -p ExecStart -p WorkingDirectory orchestra-sf-staging.service`. Apontar a unit para o diretório novo via override revisado de `WorkingDirectory` e, **se `ExecStart` estiver absoluto/pinado no release removido**, preservar o argv/flags/ambiente originais ao corrigir esse caminho. Não inventar comando/porta ou restaurar segredos pela documentação. Só após validação isolada usar `sudo systemctl daemon-reload`, `sudo systemctl start orchestra-sf-staging.service` e smoke autenticado no origin correto; em falha, parar unit e reverter unit/WorkingDirectory/caminho com recibo.

## Não coberto / limites de afirmação

- Sem prova independente do **autor/criação** dos tars, da **ordem/recibos de PutBlob**, de recebimento objeto a objeto ou de igualdade binária fonte→Blob→LFS.
- Git LFS e um container privado **não** implicam retenção imutável/WORM, assinatura, revisão de segredos/PII/malware ou prova de que o conteúdo seja seguro.
- Nenhum **restore, boot, re-deploy, teste de browser ou UAT** foi executado por esta revisão; isto é um procedimento de recuperação, não aceitação operacional.
- O snapshot pode ser crash-consistent e **não é cópia full-stack**; nem a restauração do tar antigo nem a do snapshot comprovam Orchestra Web nativo, white-label, OIDC ou correções de #300/#303.
