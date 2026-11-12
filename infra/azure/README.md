# Fundação Azure — operação para qualificação

Este guia prepara a fundação cloud do Orchestra-SF para qualificação: um grupo de recursos com rede, uma VM Linux, disco de dados, IP público e cofre de backup, com o Caddy em 503. Não é aplicação corporativa pronta e não trata HTTP 200 nem `/api/health` como prontidão. A integração da aplicação segue em trilha própria e só começa com um candidato qualificado.

Os exemplos são procedimentos do operador. O código de infra não implica deployment ao vivo. Nesta preparação não houve provisionamento Azure nem convite de convidado. Os comandos abaixo executam ações de verdade se o operador os rodar.

## Artefatos e pins

| Peça | Caminho |
| --- | --- |
| Modelo | `infra/azure/main.bicep` |
| Inicialização | `infra/azure/bootstrap.sh` |
| Deploy de infra | `infra/azure/deploy.sh` |
| Ferramentas | `infra/azure/tools.json` |
| Workflow | `.github/workflows/azure-mvp.yml` |
| Parâmetros de exemplo | `infra/azure/mvp.parameters.example.json` |
| Testes de fundação | `packages/script/test/azure-foundation.node-smoke.mjs` e `packages/script/test/azure-workflow.node-smoke.mjs` |

O workflow dispara só com `workflow_dispatch`. Actions fixas: `actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5`, `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020`, `azure/login@7184910d9eb2b1c5e48f7073824a90609bb9b6d6`. Preview e apply compilam o mesmo ARM JSON com o Bicep de `infra/azure/tools.json`: versão `v0.49.2`, arquivo `bicep-linux-x64`, SHA-256 `0ab9de90c2493f206f8281bae74f9ee2d5ed3605548dab1adf41fef185e1f7c5`. Não há pipeline de release da aplicação nem login do produto implementados aqui.

`deploy.sh` recebe só inputs de infra, por ambiente: `OPERATION`, `VM_SIZE`, `IMAGE_VERSION`, `CONFIRM`, `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP` e `AZURE_VM_SSH_PUBLIC_KEY`. Não são flags da aplicação. O preflight monta o JSON de parâmetros em Python, sem interpolar entrada no shell. O job `validate` não chama `deploy.sh`.

## Valores que ainda exigem input

Não inventar nem commitar: assinatura, tenant, nome do registro da pipeline, `appId`, objectId do service principal, nome da credencial federada, grupo de recursos, região, SKU, versão exata da imagem, chave SSH pública, domínio ou URL, grupos, `guestObjectId`, `homeTenantId`, atribuição, consentimentos e limite de custo. O arquivo de exemplo usa sentinelas `REQUIRES_INPUT_*`, inexecutáveis até substituição e validação. Literais estáveis do contrato: usuário `sfadmin` e disco de dados de 64 GiB (mínimo 32, máximo 1024). SKUs admitidas, sem valor de desempenho: `Standard_D2as_v5` e `Standard_D4as_v5`.

A VM não tem identidade gerida nem senha. O NSG da sub-rede permite TCP 80 e 443 a partir da Internet e não tem regra SSH. O disco de dados usa LUN 0, cache `None` e `deleteOption` `Detach`.

## Três identidades separadas

A Azure e o tenant de recurso são nossos. A pipeline, a aplicação Entra do produto e o convidado não se misturam. Criar o registro da pipeline não concede permissão Graph a essa app nem à app do produto. Não atribuir `Directory.Read.All` por conveniência. O B2B, por si, não pede Graph sobre o diretório da Sucafina.

1. Pipeline. Registro só para GitHub Actions, sem segredo de cliente e sem papel de diretório. Credencial federada com issuer `https://token.actions.githubusercontent.com`, audiences `["api://AzureADTokenExchange"]` e subject exato `repo:gustavomhss/Orchestra-SF:environment:azure-mvp`. Papel `Contributor` só no grupo de recursos, pelo objectId do service principal. Sem `User Access Administrator`. O modelo não cria `roleAssignments`. Quem executa os comandos precisa ter, na própria conta, autoridade para registrar aplicação e atribuir RBAC. Isso é requisito do operador, não um grant que esta entrega já tenha feito.
2. Aplicação nativa do produto. As permissões ainda dependem do contrato aplicativo. Antes de consentimento, validar no tenant de recurso e no tenant de origem: APIs do pedido, consentimento de administrador ou de usuário, redirect URI quando houver origem HTTPS, grupos e se a política entre tenants aceita a mesma conta Microsoft. Consentimentos: não verificados.
3. Convidado. O André autoriza-se como B2B com a mesma conta Microsoft do Teams, sem senha nova. Não enviar o convite agora. Não dar RBAC do portal ao usuário final. `Guest Inviter` e `User Administrator` dependem da política de colaboração externa; `User Administrator` não é requisito universal.

## Passos do operador

1. `az login` e `az account set --subscription <REQUIRES_INPUT_SUBSCRIPTION_ID>`. Com `az account show`, confirmar `AzureCloud` e o tenant. Esse tenant é o futuro `AZURE_TENANT_ID`.
2. Criar o grupo vazio uma vez: `az group create --name <REQUIRES_INPUT_RG> --location <REQUIRES_INPUT_REGION>`. Preview e apply não criam o grupo.
3. Versão exata, na mesma região, só com publisher, oferta e SKU do contrato. Guardar `dígitos.dígitos.dígitos`. Recusar `latest`. Lista vazia: parar e escalar; não trocar a oferta.

```bash
az vm image list --location <REQUIRES_INPUT_REGION> \
  --publisher Canonical --offer ubuntu-24_04-lts --sku server --all \
  --query "[].version" -o tsv
```

4. No GitHub, antes de qualquer credencial federada, criar o environment `azure-mvp` em `gustavomhss/Orchestra-SF` e restringir a implantação a um único branch. Em Settings → Environments → `azure-mvp` → Deployment branches and tags, escolher Selected branches and tags e adicionar só a regra Branch com o padrão `dev`. Apagar qualquer outra regra. Não usar todos os branches. Revisores humanos ficam em Required reviewers: são política adicional e não substituem essa restrição. O workflow também exige o repositório e `refs/heads/dev`; isso não configura o environment sozinho.

A mesma restrição, pela API REST documentada (não executada nesta entrega):

```bash
gh api --method PUT repos/gustavomhss/Orchestra-SF/environments/azure-mvp --input - <<'EOF'
{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}
EOF
gh api --method POST \
  repos/gustavomhss/Orchestra-SF/environments/azure-mvp/deployment-branch-policies \
  --input - <<'EOF'
{"name":"dev","type":"branch"}
EOF
```

Fonte: [deployment branch policies](https://docs.github.com/en/rest/deployments/branch-policies) e [environments](https://docs.github.com/en/rest/deployments/environments). Conferir que a lista de políticas contém só `dev` / `branch`.

5. Criar o registro da pipeline uma vez. Se o nome já existir, não repetir o create: listar e copiar o `appId` exato. Mais de um resultado: parar.

```bash
az ad app create --display-name <REQUIRES_INPUT_PIPELINE_APP_NAME> --query appId -o tsv
az ad app list --display-name <REQUIRES_INPUT_PIPELINE_APP_NAME> --query "[].appId" -o tsv
```

6. Service principal e credencial federada. `<APP_ID>` é o `appId` do passo 5. O JSON fica fora do git e não leva segredo. O `name` é rótulo escolhido pelo operador.

```bash
az ad sp create --id <APP_ID>
cat > /tmp/orchestra-sf-federated-credential.json <<'EOF'
{
  "name": "<REQUIRES_INPUT_CREDENTIAL_NAME>",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:gustavomhss/Orchestra-SF:environment:azure-mvp",
  "audiences": ["api://AzureADTokenExchange"]
}
EOF
az ad app federated-credential create --id <APP_ID> \
  --parameters /tmp/orchestra-sf-federated-credential.json
```

7. Copiar o `appId` para `AZURE_CLIENT_ID`. Não usar o objectId aqui. No environment `azure-mvp`, definir `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP` e `AZURE_VM_SSH_PUBLIC_KEY` (só a chave pública).

Antes da atribuição da pipeline no grupo, o operador com autoridade na assinatura verifica o registro de `Microsoft.Compute`, `Microsoft.Network` e `Microsoft.RecoveryServices` na assinatura alvo. Se o estado não for `Registered`, o operador registra e espera `Registered`. A pipeline permanece `Contributor` só no grupo de recursos, sem grant na assinatura. Fonte: [provedores e tipos de recurso](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/resource-providers-and-types).

```bash
az provider show --namespace Microsoft.Compute --query registrationState -o tsv
az provider show --namespace Microsoft.Network --query registrationState -o tsv
az provider show --namespace Microsoft.RecoveryServices --query registrationState -o tsv
```

Não registrado: `az provider register --namespace <namespace>` e repetir o `show` até `Registered`.

8. `Contributor` só no grupo, pelo objectId do service principal (`az ad sp show --id` devolve esse id). Sem `User Access Administrator` e sem outro escopo.

```bash
az ad sp show --id <APP_ID> --query id -o tsv
az role assignment create \
  --assignee-object-id <SP_OBJECT_ID> \
  --assignee-principal-type ServicePrincipal \
  --role Contributor \
  --scope /subscriptions/<REQUIRES_INPUT_SUBSCRIPTION_ID>/resourceGroups/<REQUIRES_INPUT_RG>
```

## Como invocar o workflow

`validate` é o padrão. Roda em `ubuntu-24.04` com Node `24.15`, executa os smokes Node e não pede `id-token` nem login Azure.

```bash
gh workflow run azure-mvp.yml --repo gustavomhss/Orchestra-SF --ref dev \
  -f operation=validate
```

Preview e apply chamam `bash infra/azure/deploy.sh` no environment `azure-mvp`, com OIDC. Os dois compilam o ARM com o mesmo Bicep pin. Preview faz `az deployment group what-if` e não altera a cloud. O grupo precisa existir.

```bash
gh workflow run azure-mvp.yml --repo gustavomhss/Orchestra-SF --ref dev \
  -f operation=preview -f vm_size=<SKU-permitido> \
  -f image_version=<versão-exata>
```

Apply exige `CONFIRM` exato `APPLY <nome-do-grupo>`, igual a `AZURE_RESOURCE_GROUP`. Há what-if imediato e depois `az deployment group create` em modo `Incremental`. Concurrency `azure-mvp`, `cancel-in-progress: false`. Sem delete, sem ativação da aplicação e sem segredos nos logs.

```bash
gh workflow run azure-mvp.yml --repo gustavomhss/Orchestra-SF --ref dev \
  -f operation=apply -f vm_size=<SKU-permitido> \
  -f image_version=<versão-exata> \
  -f confirm='APPLY <nome-do-grupo>'
```

## Custo, URL, backup e encerramento

O custo depende da VM, dos discos SSD standard, do IP público Standard estático, do cofre LRS, dos pontos de backup, do egress, dos logs e da região. Não há total nem alta disponibilidade neste contrato. Um alerta de orçamento avisa; não corta gasto. O limite de custo segue em aberto.

O rótulo DNS é `orchsf-` mais `uniqueString` do id do grupo. `fqdn` e `publicOrigin` permanecem enquanto o IP e o grupo permanecem. Um release da aplicação, nesse mesmo IP e grupo, preserva o URL. Trocar a imagem do sistema operacional é outro procedimento: pode exigir recriar a VM ou restaurar discos. Não há atualização in-place da VM garantida.

A política é Azure IaaS VM, diária às 04:00 UTC, retenção 35 dias, cofre na mesma região, LRS, APIs Recovery Services `2025-01-01` ou mais recentes em GA. Não é PITR, não é RPO de 1 hora e não prova consistência de aplicação. O backup usa agente e extensão; ponto consistente com o sistema de arquivos não é ponto consistente com a aplicação. Não há credencial de blob própria.

Antes de entregar dados: o primeiro backup conclui, o job fica registrado e uma restauração é ensaiada em infraestrutura nova. Quiescência aprovada não autoriza afrouxar AppArmor nem user namespaces.

Apagar o grupo de recursos pode falhar com o cofre protegido e não apaga toda a custódia. O Azure Backup pode criar `AzureBackupRG_<geo>_<n>` fora do grupo da fundação; a cobrança dos snapshots e dos pontos está lá, não no grupo da VM. Encerrar, nesta ordem: validar e parar a proteção conforme a política aceita; exportação ou descarte autorizado; retenção e soft delete aplicáveis, planejando pelo menos 14 dias e confirmando o prazo na região, sem prometer que o soft delete pode ser desabilitado; inventariar cofre, grupo de backup, pontos e custos residuais e confirmar o término. Só então pedir a exclusão manual, com o nome revisto. Este repositório não incorpora `az group delete --yes`.

## O que a ativação futura ainda tem de trazer

O candidato qualificado é uma versão exata do Orchestra-SF com a web e o Linux nativo empacotados. Segredos e estado ficam fora da imagem: estado em `/var/lib/orchestra-sf` no disco de dados, configuração privada em `/etc/orchestra-sf`, código em `/opt/orchestra-sf`. A adaptação real inclui origem HTTPS, OIDC, cookies, CSRF, rotas privadas de administração e leitura da configuração real. `/api/health` não é readiness.

A interface estável, ainda futura, entre a inicialização e o manifesto de release precisa tipar saúde, instalação, dados e migrações. `bin/start` não é entrypoint desta fundação. Não há workflow de release da aplicação. `bootstrap.sh` recebe só o FQDN, valida-o, obtém TLS no Caddy e mantém 503 até ativação explícita. Ele cria o usuário Linux técnico `orchestra-sf`, com nologin e home no estado persistente. Não cria identidades de negócio nem grupos Microsoft, não grava segredos e não publica a administração por um proxy genérico.

O arquivo `mvp.parameters.example.json` é documentação pública. Falha a validação até cada sentinela ser substituída. Não contém chave privada nem dado corporativo.

## Fontes

- [Workload identity federation](https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation)
- [Find Azure VM images with the CLI](https://learn.microsoft.com/en-us/azure/virtual-machines/linux/cli-ps-findimage)
- [Azure VM backup FAQ](https://learn.microsoft.com/en-us/azure/backup/backup-azure-vm-backup-faq)
- [Soft delete do Azure Backup](https://learn.microsoft.com/en-us/azure/backup/secure-by-default)
