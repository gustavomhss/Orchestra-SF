# Fundação Azure — operação para qualificação

Este guia prepara a fundação cloud do Orchestra-SF para qualificação: um grupo de recursos com rede, uma VM Linux, disco de dados, IP público e cofre de backup, com o Caddy em 503. A aplicação só entra com um candidato qualificado. HTTP 200 e `/api/health` ficam fora desta prontidão. Os exemplos são procedimentos do operador e não foram executados nesta entrega. Não houve provisionamento Azure, convite nem permissão criada. Os comandos executam ações de verdade se o operador os rodar.

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

O caminho padrão de `deploy.sh` recebe os inputs de infra, por ambiente: `OPERATION`, `VM_SIZE`, `IMAGE_VERSION`, `CONFIRM`, `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP` e `AZURE_VM_SSH_PUBLIC_KEY`. Os perfis QA abaixo acrescentam três inputs opcionais de rede. Não são flags da aplicação. O preflight monta o JSON de parâmetros em Python, sem interpolar entrada no shell. O job `validate` não chama `deploy.sh`. O deployment de grupo chama-se `orchsf-foundation`.


## Perfis de rede para G08 e G10

O perfil padrão `mvp` preserva as três regras originais e os seis parâmetros serializados pelo wrapper. Os perfis de qualificação reutilizam a mesma fundação, sem modificar o bootstrap, criar um segundo provisionador ou alterar a instalação e os recibos do produto. Compilar o ARM ou passar os smokes não comprova isolamento no Azure.

| Perfil | Grupo permitido pelo wrapper | Entrada durante a qualificação | Saída |
| --- | --- | --- | --- |
| `mvp` | Alvo original; nos três grupos abaixo, somente um grupo vazio | TCP 80/443 da Internet, como antes | Padrões existentes do Azure |
| `g08-qa` | `orchestra-sf-g08-qa` | Somente TCP 443 dos IPv4 `/32` observados | Padrões existentes do Azure; não é a cerca do clone |
| `g10-source` | `orchestra-sf-g10-source` | Somente TCP 443 dos IPv4 `/32` observados | Padrões existentes do Azure; não é a cerca do clone |
| `g10-clone` | `orchestra-sf-g10-clone` | Nenhuma regra de permissão de entrada | TCP 443 somente para os IPv4 públicos `/32` administrativos observados, negação explícita de `AzurePlatformDNS` e negação de toda outra saída sujeita ao NSG |

Os perfis G08/origem fecham também a porta 80 depois da preparação do TLS. O clone não recebe uma regra SSH nem uma permissão ampla `Internet`, `AzureCloud` ou `VirtualNetwork`. As negações de prioridade 4096 precedem as regras padrão do NSG. O vínculo subnet → NSG permanece o mesmo. Os grupos novos não reutilizam a VM, o disco, o IP, a rede nem o piloto de Compras do grupo atual.

### Entradas do wrapper

Além dos inputs de infra já existentes, `deploy.sh` aceita:

| Variável de ambiente | Parâmetro ARM | Padrão | Validação antes de qualquer chamada Azure |
| --- | --- | --- | --- |
| `NETWORK_PROFILE` | `networkProfile` | `mvp` | Enum fechado e correspondência exata, sem distinguir maiúsculas/minúsculas do RG, com a tabela acima |
| `QA_HTTPS_INGRESS_CIDRS` | `qaHttpsIngressCidrs` | `[]` | Array JSON de IPv4 `/32` canônicos; obrigatório e não vazio só em G08/origem |
| `CLONE_ADMIN_EGRESS_CIDRS` | `cloneAdminEgressCidrs` | `[]` | Array JSON de IPv4 públicos `/32` canônicos; obrigatório e não vazio só no clone para a rota administrativa atual |

Cada lista tem no máximo 32 entradas, sem duplicatas. O ingresso admite endereços privados unicast quando um observador real está nesse caminho. O egress administrativo exige endereços públicos. Máscaras mais largas, IPv6, endereço sem `/32`, tags, URLs, curingas, valores não textuais, loopback, multicast, broadcast, endereços reservados, link-local e a rede 0/8 são recusados. Os dois `/1` que cobririam a Internet também são recusados. O perfil `mvp` recusa listas não vazias; G08/origem recusam a lista administrativa; o clone recusa a lista de ingresso.

Nenhum IP de exemplo deste repositório constitui uma allowlist operacional. Os IPv4 reais precisam vir da observação dos validadores, observadores e endpoints administrativos da janela. Sintaxe válida não prova propriedade, autorização, exclusividade nem alcance do endpoint.

Quando o alvo é um dos três RGs de QA, `mvp` exige que `az resource list` devolva exatamente zero recursos. Os perfis QA exigem o deployment `orchsf-foundation` e a VM `orchsf-vm` existentes, ambos com `provisioningState=Succeeded`. Consulta indisponível, resposta vazia ou deployment parcial bloqueiam o procedimento antes do what-if/create. Um grupo parcialmente provisionado não é retomado com a rede aberta de `mvp`; exige revisão do estado e um plano explícito. Estado `Succeeded` não substitui a observação do cloud-init, do disco montado, do Caddy e do canal administrativo.

### Rota operacional: Owner no Cloud Shell e o mesmo wrapper

A rota de QA é o operador Owner já autorizado, no Cloud Shell efêmero do próprio portal, executando `deploy.sh` da revisão exata aprovada no CI. O Cloud Shell pode funcionar sem conta de armazenamento; sua disponibilidade e o registro de `Microsoft.CloudShell` precisam ser observados antes do uso. Os recursos das três fundações, sua região, a cota e o custo precisam de autorização operacional específica. A identidade Actions permanece Reader: esta rota não cria credencial federada, atribuição de papel ou grant Microsoft.

O operador confere a conta, a assinatura e o tenant ativos com `az account show`, sem imprimir tokens. O wrapper não faz login nem escolhe o principal por `AZURE_CLIENT_ID`: esse input continua sendo o UUID de configuração já existente e não atesta a identidade do operador. A autorização vem da sessão Owner efetivamente observada; o wrapper compara assinatura e tenant com essa sessão. O Bicep local usado pelo wrapper tem de corresponder ao pin exato de `tools.json`; o próprio wrapper verifica seu SHA-256 antes de compilar.

Para QA, invocar o wrapper é obrigatório. O ARM compilado possui o enum e os limites de tamanho, mas não valida sozinho a relação RG/perfil, a natureza dos IPs ou a condição de grupo vazio. Importar o ARM cru em Custom Deployment e editar seus parâmetros contornaria essas verificações e não é a rota qualificada. Não há `assert` experimental, recurso fictício de trava ou política Azure adicional.

Sequência operacional, sem dados privados antes da cerca:

1. Confirmar três grupos dedicados novos, a disponibilidade/cota do SKU e a região aprovada. Criá-los vazios é ação separada do wrapper. Não reaplicar a fundação no grupo ou nas VMs atuais.
2. Executar `mvp` em cada grupo vazio, usando a versão exata da imagem, a chave SSH pública e os inputs já previstos. Esse estado serve somente ao bootstrap vazio: ainda não é homologação ou ensaio.
3. Confirmar os critérios existentes de bootstrap, volume, Caddy 503 e TLS. Preparar as ferramentas e observar os endpoints administrativos necessários sem inserir backup, dados da aplicação, cookies, segredos ou identidades de negócio. Não repetir o bootstrap depois da ativação.
4. Guardar a observação dos IPs e executar `preview` com o perfil correspondente. Revisar o what-if. Executar `apply` com os mesmos inputs e `CONFIRM='APPLY <RG-exato>'`. O wrapper repete what-if e envia o mesmo ARM e arquivo de parâmetros ao create em modo Incremental.
5. Conferir as regras efetivas no NIC/subnet e a conectividade real, incluindo a recusa de origens/destinos fora das listas. Encerrar conexões de bootstrap anteriores à cerca: NSGs são stateful e regras novas não encerram conexões já estabelecidas. Só depois admitir material privado para G08 ou G10.
6. No clone, comprovar o canal administrativo ainda funcional depois da cerca e antes de transferir o backup. DNS geral está negado; a administração precisa de resolução restrita e endpoints efetivamente observados ou de um canal alternativo comprovado. Uma lista `/32` ou exit 0 do deployment não prova esse canal. Não liberar `AzureCloud` ou `Internet` para fazer a prova passar.

Exemplo de invocação G08, depois de configurar os inputs existentes e selecionar o grupo correspondente. As sentinelas abaixo são intencionalmente inválidas até substituição por observações reais:

```bash
OPERATION=preview CONFIRM=PREVIEW \
NETWORK_PROFILE=g08-qa \
QA_HTTPS_INGRESS_CIDRS='<REQUIRES_INPUT_JSON_ARRAY_OF_OBSERVED_IPV4_32>' \
CLONE_ADMIN_EGRESS_CIDRS='[]' \
bash infra/azure/deploy.sh
```

A compilação operacional do wrapper não é build do produto. Os smokes, guards, empacotamento e qualificação do tar continuam em Actions. O workflow `azure-mvp.yml`, seu environment e o caminho padrão não foram substituídos por este contrato.

### Limites da cerca

A negação explícita de `AzurePlatformDNS` é necessária porque o tráfego DNS da plataforma não é bloqueado por um deny genérico. IMDS permanece acessível para a prova real da identidade da VM; a VM deste modelo não recebe identidade gerida. A comunicação WireServer do agente com o host Azure também tem tratamento de plataforma fora do NSG. Esse desenho não é um air gap nem isolamento contra todos os serviços do hipervisor.

TLS deve estar preparado antes do perfil QA. A renovação ACME não é garantida com 80 fechado e 443 restrito; a validade do certificado precisa cobrir a janela de qualificação. Nenhuma condição de rede cria os quatro contextos Microsoft, registra runner, instala o tar, desabilita credenciais de produção ou substitui o observador e os recibos reais de G08/G10.

A validação em Actions preserva os 14 smokes originais, compila com o Bicep pinado, inspeciona as regras e o vínculo real no ARM e exercita o wrapper com `az` simulado. A captura lê os bytes de ARM e parâmetros que o wrapper de fato entrega a what-if/create antes de limpar os temporários. No CI, o smoke pode retê-los em um diretório absoluto indicado por `AZURE_NETWORK_EVIDENCE_DIR`, com diagnósticos que distinguem o wrapper canônico da mutação negativa de confirmação. Esses arquivos contêm apenas fixtures de teste, não uma allowlist operacional ou um recibo instalado. Eles comprovam o contrato do código, sem aplicar recursos ou afirmar conectividade Azure.

Fontes desta extensão:

- [Cloud Shell efêmero](https://learn.microsoft.com/en-us/azure/cloud-shell/get-started/ephemeral)
- [Autenticação do Cloud Shell](https://learn.microsoft.com/en-us/azure/cloud-shell/features)
- [Regras NSG e considerações de plataforma](https://learn.microsoft.com/en-us/azure/virtual-network/network-security-groups-overview)
- [DNS e WireServer em 168.63.129.16](https://learn.microsoft.com/en-us/azure/virtual-network/what-is-ip-address-168-63-129-16)
- [Recursos experimentais no Bicep v0.49.2](https://github.com/Azure/bicep/blob/v0.49.2/docs/experimental-features.md)

## Valores que ainda exigem input

Não inventar nem commitar: assinatura, tenant, nome do registro da pipeline, `appId`, objectId do service principal, nome da credencial federada, grupo de recursos, região, SKU, versão exata da imagem, chave SSH pública, domínio ou URL, grupos, `guestObjectId`, `homeTenantId`, atribuição, consentimentos e limite de custo. O arquivo de exemplo usa sentinelas `REQUIRES_INPUT_*`, inexecutáveis até substituição e validação. Literais estáveis do contrato: usuário `sfadmin` e disco de dados de 64 GiB (mínimo 32, máximo 1024). SKUs admitidas, sem valor de desempenho: `Standard_D2as_v5` e `Standard_D4as_v5`.

A VM não tem identidade gerida nem senha. No perfil `mvp`, o NSG da sub-rede permite TCP 80 e 443 a partir da Internet e não tem regra SSH. O disco de dados usa LUN 0, cache `None` e `deleteOption` `Detach`. O subject OIDC verificado desta fundação é `repo:gustavomhss@228147811/Orchestra-SF@1455724710:environment:azure-mvp`.

## Três identidades separadas

A Azure e o tenant de recurso são nossos. A pipeline, a aplicação Entra do produto e o convidado não se misturam. Criar o registro da pipeline não concede Graph a essa app nem à app do produto, e não cria papel de diretório. Não atribuir `Directory.Read.All` nem `Global Administrator`. O B2B, por si, não pede Graph sobre o diretório da Sucafina. Nenhum convite e nenhuma permissão de aplicação foram criados.

1. Pipeline. Registro só para GitHub Actions, audiência `AzureADMyOrg`, sem segredo de cliente e sem papel de diretório. Credencial federada com issuer `https://token.actions.githubusercontent.com`, audiences `["api://AzureADTokenExchange"]` e subject exato `repo:gustavomhss@228147811/Orchestra-SF@1455724710:environment:azure-mvp`. Sem curinga e sem opt-out do subject imutável. Papel `Contributor` só no grupo de recursos, pelo objectId do service principal. Sem `User Access Administrator` e sem grant na assinatura. O modelo não cria `roleAssignments`.
2. Aplicação nativa do produto. As permissões ainda dependem do contrato aplicativo. Antes de consentimento, validar no tenant de recurso e no tenant de origem (`homeTenant`): APIs do pedido, consentimento de administrador ou de usuário, redirect URI quando houver origem HTTPS, grupos e se a política entre tenants aceita a mesma conta Microsoft. Consentimentos: não verificados e não criados aqui.
3. Convidado. O André autoriza-se como B2B com a mesma conta Microsoft do Teams, sem senha nova. Não enviar o convite. Não dar RBAC do portal ao usuário final. `Guest Inviter` e `User Administrator` dependem da política de colaboração externa; `User Administrator` não é requisito universal.

Registrar a aplicação depende da política do tenant: a conta do operador já pode registrar aplicações, ou o tenant já lhe deu um papel de aplicações. Este guia não atribui `Global Administrator` e não o toma como padrão. Atribuir `Contributor` no grupo exige, na própria conta do operador, autoridade de atribuição nesse grupo. Essa autoridade é pré-condição do operador, não um grant desta entrega. A identidade da pipeline recebe só `Contributor` no grupo de recursos.

## Passos do operador

1. `az login` e `az account set --subscription <REQUIRES_INPUT_SUBSCRIPTION_ID>`. Com `az account show`, confirmar `AzureCloud` e o tenant. Esse tenant é o futuro `AZURE_TENANT_ID`.
2. Criar o grupo vazio uma vez: `az group create --name <REQUIRES_INPUT_RG> --location <REQUIRES_INPUT_REGION>`. Preview e apply não criam o grupo.
3. Versão exata, na mesma região, só com publisher, oferta e SKU do contrato. Guardar `dígitos.dígitos.dígitos`. Recusar `latest`. Lista vazia: parar e escalar; não trocar a oferta.

```bash
az vm image list --location <REQUIRES_INPUT_REGION> --publisher Canonical --offer ubuntu-24_04-lts --sku server --all --query "[].version" -o tsv
```

4. No GitHub, criar o environment `azure-mvp` em `gustavomhss/Orchestra-SF` se ainda não existir. Em Settings → Environments → `azure-mvp` → Deployment branches and tags, escolher Selected branches and tags, deixar só a regra Branch com o padrão `dev` e remover qualquer outra regra na mesma tela. Não usar todos os branches. Não há DELETE automatizado de políticas. Revisores em Required reviewers são política adicional e não substituem essa restrição. O workflow também exige o repositório e `refs/heads/dev`; isso não configura o environment sozinho.

5. Consulta somente leitura, depois da tela e antes de qualquer grant. Parar se o comando falhar ou não imprimir `dev`. O conjunto `branch_policies` tem de ser exatamente um elemento `{name:dev, type:branch}`.

```bash
gh api repos/gustavomhss/Orchestra-SF/environments/azure-mvp/deployment-branch-policies --jq 'if ([.branch_policies[] | {name, type}] == [{name:"dev", type:"branch"}]) then "dev" else error("branch_policies diferente de um único {name:dev,type:branch}; parar") end'
```

Sem essa linha `dev`, não criar a atribuição de papel. Fonte da lista: [deployment branch policies](https://docs.github.com/en/rest/deployments/branch-policies).

6. Nome público da pipeline, `<REQUIRES_INPUT_PIPELINE_APP_NAME>`, só ASCII `A-Za-z0-9` e hífen, para o filtro OData não levar aspas. Rejeitar vazio, espaço e qualquer outro caractere. Consultar o `displayName` exato antes de criar. Zero `appId`: criar. Um `appId`: reutilizar. Dois ou mais: parar, sem apagar registros.

```bash
name='<REQUIRES_INPUT_PIPELINE_APP_NAME>'
case "$name" in
  ''|*[!A-Za-z0-9-]*) printf '%s\n' "nome rejeitado" >&2; exit 1 ;;
esac
az ad app list --filter "displayName eq '${name}'" --query "[].appId" -o tsv
```

Criar só quando a lista tiver zero linhas:

```bash
az ad app create --display-name "$name" --sign-in-audience AzureADMyOrg --query appId -o tsv
```

Com um `appId`, confirmar a audiência e parar se não for `AzureADMyOrg`. Não alterar a audiência neste guia.

```bash
az ad app show --id <APP_ID> --query signInAudience -o tsv
```

7. Antes da credencial federada, ler a customização OIDC. A consulta só passa com `use_default` true, `use_immutable_subject` true, `include_claim_keys` ausente ou vazio, e `.sub_claim_prefix` igual a `repo:gustavomhss@228147811/Orchestra-SF@1455724710`. Qualquer outro valor é erro. A linha impressa é o `.sub_claim_prefix` devolvido pela API mais `:environment:azure-mvp`, não uma constante no lugar do campo. Não enviar PUT, não fazer opt-out e não usar curinga.

```bash
gh api repos/gustavomhss/Orchestra-SF/actions/oidc/customization/sub --jq 'if .use_default != true or .use_immutable_subject != true or ((.include_claim_keys // []) | length) != 0 or .sub_claim_prefix != "repo:gustavomhss@228147811/Orchestra-SF@1455724710" then error("OIDC fora do padrão imutável; parar") else .sub_claim_prefix + ":environment:azure-mvp" end'
```

8. Service principal e credencial federada, só depois do passo 7. `<APP_ID>` é o `appId` do passo 6. O JSON fica fora do git, não leva segredo e usa o subject completo já verificado. O `name` é rótulo do operador.

```bash
az ad sp create --id <APP_ID>
cat > /tmp/orchestra-sf-federated-credential.json <<'EOF'
{
  "name": "<REQUIRES_INPUT_CREDENTIAL_NAME>",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:gustavomhss@228147811/Orchestra-SF@1455724710:environment:azure-mvp",
  "audiences": ["api://AzureADTokenExchange"]
}
EOF
az ad app federated-credential create --id <APP_ID> \
  --parameters /tmp/orchestra-sf-federated-credential.json
```

9. Copiar o `appId` para `AZURE_CLIENT_ID`. Não usar o objectId aqui. No environment `azure-mvp`, definir `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP` e `AZURE_VM_SSH_PUBLIC_KEY` (só a chave pública).

10. Antes da atribuição no grupo, o operador com autoridade na assinatura verifica o registro de `Microsoft.Compute`, `Microsoft.Network` e `Microsoft.RecoveryServices` na assinatura alvo. Se o estado não for `Registered`, o operador registra e espera `Registered`. A pipeline permanece `Contributor` só no grupo de recursos. Fonte: [provedores e tipos de recurso](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/resource-providers-and-types).

```bash
az provider show --namespace Microsoft.Compute --query registrationState -o tsv
az provider show --namespace Microsoft.Network --query registrationState -o tsv
az provider show --namespace Microsoft.RecoveryServices --query registrationState -o tsv
```

Não registrado: `az provider register --namespace <namespace>` e repetir o `show` até `Registered`.

11. `Contributor` só no grupo, e só se o passo 5 imprimiu `dev`. Sem `User Access Administrator`, sem outro escopo e sem papel de diretório. O objectId vem de `az ad sp show --id`.

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

## Depois do apply

Nada desta seção foi executado. Copiar os valores de `properties.outputs` do deployment `orchsf-foundation`. Não substituir por ids de uma conta ao vivo inventados no guia: `fqdn`, `publicOrigin`, `vmName`, `dataDiskId`, `backupVaultName`, `backupPolicyName`, `protectedItemName`.

```bash
az deployment group show --resource-group <REQUIRES_INPUT_RG> --name orchsf-foundation --query properties.outputs -o json
```

`az vm show` é consulta de plano de controle. `az vm run-command invoke` é operação remota no convidado, ainda não executada: o script espera o cloud-init e não é leitura pura. `set -eu` aborta no primeiro teste que falha. O sentinela `ORCHSF_FOUNDATION_OK` só é impresso depois de `status: done`, do bloco canônico de `/dev/disk/azure/scsi1/lun0` (`test -b`) igual à origem montada, do TARGET `/var/lib/orchestra-sf` e de `caddy` `active`. Ler `value[0].message`. Exit 0 da CLI ou `ProvisioningState` `Succeeded` só dizem que o agente rodou.

```bash
az vm show --resource-group <REQUIRES_INPUT_RG> --name <vmName> --query "storageProfile.dataDisks[?lun==\`0\`].managedDisk.id" -o tsv
az vm run-command invoke --resource-group <REQUIRES_INPUT_RG> --name <vmName> --command-id RunShellScript --scripts 'set -eu; cloud-init status --wait; ci=$(cloud-init status); printf "%s\n" "$ci"; case "$ci" in *"status: done"*) ;; *) exit 1 ;; esac; src=$(findmnt -n -o SOURCE --target /var/lib/orchestra-sf); tgt=$(findmnt -n -o TARGET --target /var/lib/orchestra-sf); canon=$(readlink -f /dev/disk/azure/scsi1/lun0); test -b "$canon"; test "$tgt" = /var/lib/orchestra-sf; test "$(readlink -f "$src")" = "$canon"; caddy=$(systemctl is-active caddy || true); test "$caddy" = active; getent passwd orchestra-sf; getent group orchestra-sf; test ! -L /var/lib/orchestra-sf && test -d /var/lib/orchestra-sf && test ! -L /var/lib/orchestra-sf/home && test -d /var/lib/orchestra-sf/home; stat -c '%u %g %F %n' /var/lib/orchestra-sf /var/lib/orchestra-sf/home; printf "%s\n" ORCHSF_FOUNDATION_OK'
```

O id do disco no `az vm show` tem de ser o `dataDiskId` do output. UUID na origem, alvo diferente ou sentinela ausente: parar. Não há fallback de UUID. `getent` e `stat` saem na mesma mensagem. Copiar UID, GID e rótulo `orchestra-sf` para um registro privado do operador, fora do Git: metadado não secreto e recibo da recuperação.

Fora da VM, no `fqdn` do output, o TLS verifica o certificado e o código esperado é 503. Sem `-k`. Sem `--fail`: 503 é a resposta da fundação, e `--fail` a trataria como erro.

```bash
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' "https://<fqdn>/"
```

Backup: listar o container e copiar `name` exatamente para `<containerName>`. Não montar `iaasvmcontainerv2;` nem prefixo `iaasvmcontainer;` à mão. O item é o output `protectedItemName`. Manter as aspas em `--name` e `--item-name`: o valor real contém `;`. O job que conta é `operation` `Backup`, `status` `Completed` e `entityFriendlyName` igual ao `vmName`. `ConfigureBackup` ou restauração `Completed` não contam. Entregar dados só com esse job, um ponto de recuperação e o ensaio isolado.

```bash
az backup container list --resource-group <REQUIRES_INPUT_RG> --vault-name <backupVaultName> --backup-management-type AzureIaasVM --query "[].{name:name, friendlyName:properties.friendlyName}" -o table
az backup item show --resource-group <REQUIRES_INPUT_RG> --vault-name <backupVaultName> --backup-management-type AzureIaasVM --container-name "<containerName>" --name "<protectedItemName>" --query properties.protectionState -o tsv
az backup job list --resource-group <REQUIRES_INPUT_RG> --vault-name <backupVaultName> --query "[?properties.operation=='Backup' && properties.status=='Completed' && properties.entityFriendlyName=='<vmName>'].name" -o tsv
az backup recoverypoint list --resource-group <REQUIRES_INPUT_RG> --vault-name <backupVaultName> --backup-management-type AzureIaasVM --container-name "<containerName>" --item-name "<protectedItemName>" --query "[].name" -o tsv
```

O `customData` da VM vale na criação. Apply incremental não regrava o cloud-init de uma VM já existente: editar `bootstrap.sh` e aplicar de novo não atualiza o script na VM. Rodar outra vez o bootstrap placeholder depois da ativação devolve o Caddy ao 503. A ativação de um release qualificado é procedimento à parte.

## Recuperação: VM inteira ou disco só

O padrão é o backup da VM inteira: SO, conta e dados juntos; conferir a identidade no recibo. Infra nova segue com outro IP, NIC e URL. O bootstrap não adota UID do disco e não faz `chown` recursivo. Comandos abaixo são recuperação futura, como root, não executados. Colisão, ocupação ou procedência desconhecida: parar e voltar à VM inteira, sem `chown` e sem editar conta alheia.

Disco só, com o bootstrap inicial já terminado e as cargas quiescentes. Esse primeiro boot pode ter deixado o LUN em escrita em `/var/lib/orchestra-sf` ao recusar a conta. Antes de desmontar, `findmnt` tem de mostrar a origem canônica igual ao LUN. Se o TARGET for o estado, `umount` desse caminho; falha ou ocupado: parar, sem `-f` e sem lazy. Depois não pode haver outra montagem do LUN: a inspeção só leitura não pode ter alias de escrita. Não se afirma que o Linux recusa sempre o mesmo device duas vezes. O `dataDiskId` do recibo é o LUN 0. Montar só leitura sob pai temporário root `0700` (`mktemp -d` e um filho), para o UID antigo do inode não permitir travessia. Conferir rótulo `orchestra-sf`, UID/GID do recibo, diretórios reais sem symlink e IDs livres. Desmontar e apagar filho e pai; só então criar a conta, antes do bootstrap manual.

```bash
set -eu
lun=/dev/disk/azure/scsi1/lun0
canon=$(readlink -f "$lun"); test -b "$canon"
tgt=$(findmnt -nr -o TARGET --target /var/lib/orchestra-sf || true)
src=$(findmnt -nr -o SOURCE --target /var/lib/orchestra-sf || true)
if [ "$tgt" = /var/lib/orchestra-sf ]; then test "$(readlink -f "$src")" = "$canon"; umount /var/lib/orchestra-sf; fi
test -z "$(findmnt -nr -o TARGET -S "$canon" || true)"
test -z "$(findmnt -nr -o TARGET -S "$lun" || true)"
parent=$(mktemp -d /mnt/orchsf-ro.XXXXXX); trap 'rmdir "$parent"' EXIT
chmod 0700 "$parent"; test "$(stat -c '%u %a' "$parent")" = "0 700"
mkdir "$parent/disk"; trap 'rmdir "$parent/disk" "$parent"' EXIT
mount -o ro "$canon" "$parent/disk"
trap 'umount "$parent/disk" && rmdir "$parent/disk" "$parent"' EXIT
test ! -L "$parent/disk" && test -d "$parent/disk"
test ! -L "$parent/disk/home" && test -d "$parent/disk/home"
test "$(stat -c '%u %g' "$parent/disk")" = "<VERIFIED_UID> <VERIFIED_GID>"
test "$(stat -c '%u %g' "$parent/disk/home")" = "<VERIFIED_UID> <VERIFIED_GID>"
umount "$parent/disk" && rmdir "$parent/disk" "$parent"; trap - EXIT
test "<VERIFIED_UID>" -gt 0 && test "<VERIFIED_GID>" -gt 0
if getent passwd <VERIFIED_UID> >/dev/null; then exit 1; fi
if getent group <VERIFIED_GID> >/dev/null; then exit 1; fi
if getent passwd orchestra-sf >/dev/null; then exit 1; fi
if getent group orchestra-sf >/dev/null; then exit 1; fi
groupadd --system --gid <VERIFIED_GID> orchestra-sf
useradd --system --uid <VERIFIED_UID> --gid orchestra-sf --no-create-home --home-dir /var/lib/orchestra-sf/home --shell /usr/sbin/nologin orchestra-sf
```

Sem `--create-home`, o home no disco permanece. O bootstrap manual seguinte reconhece essa conta e os donos preservados, e não apaga o erro original do cloud-init. Não rodar `cloud-init clean`, não marcar first boot done, e não repetir o check remoto que exige `status: done`. No registro privado, a falha original tem de ser só a identidade técnica ausente. Exigir exit 0 desse script e o log. A qualificação do reparo repete montagem canônica, Caddy `active`, TLS externo 503, job `Backup`/`Completed` do `vmName` e pontos de recuperação. É a prova equivalente de execução, sem pular esses gates.

## Custo, URL, backup e encerramento

O custo depende da VM, dos discos SSD standard, do IP público Standard estático, do cofre LRS, dos pontos de backup, do egress, dos logs e da região. Não há total nem alta disponibilidade neste contrato. Orçamento mensal e alerta de custo não estão configurados. O valor de custo não foi verificado. Não há teto de gasto. Um alerta, se for configurado depois, só avisa.

O rótulo DNS é `orchsf-` mais `uniqueString` do id do grupo. `fqdn` e `publicOrigin` permanecem enquanto esse IP e esse grupo permanecem. Um release da aplicação, nesse mesmo IP e grupo, preserva o URL. O ensaio de restauração em infraestrutura nova cria outra VM, outra NIC e outro IP. Preservar o IP e o URL atuais pede um plano explícito de reassociação do IP público e da NIC atuais, revisto antes da recuperação. A política de backup não faz essa associação sozinha. Trocar a imagem do sistema operacional é outro procedimento.

A política é Azure IaaS VM, diária às 04:00 UTC, retenção 35 dias, cofre na mesma região, LRS, APIs Recovery Services `2025-01-01` ou mais recentes em GA. Não é PITR e não é RPO de 1 hora. Não prova consistência de aplicação. O backup usa agente e extensão; ponto consistente com o sistema de arquivos não é ponto consistente com a aplicação. Não há credencial de blob própria. Os gates continuam sendo o primeiro backup concluído e a restauração isolada. Não há automação de remoção.

Apagar o grupo de recursos pode falhar com o cofre protegido e não apaga toda a custódia. O Azure Backup pode criar `AzureBackupRG_<geo>_<n>` fora do grupo da fundação; a cobrança dos snapshots e dos pontos está lá. Encerrar, nesta ordem: validar e parar a proteção conforme a política aceita; exportação ou descarte autorizado; retenção e soft delete aplicáveis, planejando pelo menos 14 dias e confirmando o prazo na região, sem prometer que o soft delete pode ser desabilitado; inventariar cofre, grupo de backup, pontos e custos residuais e confirmar o término. Só então pedir a exclusão manual, com o nome revisto. Este repositório não incorpora `az group delete --yes`.

## O que a ativação futura ainda tem de trazer

O candidato qualificado é uma versão exata do Orchestra-SF com a web e o Linux nativo empacotados. Segredos e estado ficam fora da imagem: estado em `/var/lib/orchestra-sf` no disco de dados, configuração privada em `/etc/orchestra-sf`, código em `/opt/orchestra-sf`. A adaptação real inclui origem HTTPS, OIDC, cookies, CSRF, rotas privadas de administração e leitura da configuração real. `/api/health` não é readiness.

A interface estável, ainda futura, entre a inicialização e o manifesto de release precisa tipar saúde, instalação, dados e migrações. `bin/start` não é entrypoint desta fundação. Não há workflow de release da aplicação. `bootstrap.sh` recebe só o FQDN, valida-o, obtém TLS no Caddy e mantém 503 até ativação explícita. Ele cria o usuário Linux técnico `orchestra-sf`, com nologin e home no estado persistente. Não cria identidades de negócio nem grupos Microsoft, não grava segredos e não publica a administração por um proxy genérico. A separação entre a app do produto, o B2B e o `homeTenant` permanece: este guia não envia convite nem cria permissão Graph. `mvp.parameters.example.json` é documentação pública, falha a validação até cada sentinela ser substituída e não contém chave privada nem dado corporativo.

## Fontes

- [Workload identity federation](https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation)
- [Subjects imutáveis do GitHub](https://learn.microsoft.com/en-us/entra/workload-id/workload-identities-github-immutable-subjects)
- [Find Azure VM images with the CLI](https://learn.microsoft.com/en-us/azure/virtual-machines/linux/cli-ps-findimage)
- [Azure VM backup FAQ](https://learn.microsoft.com/en-us/azure/backup/backup-azure-vm-backup-faq)
- [Backup jobs list](https://learn.microsoft.com/en-us/rest/api/backup/backup-jobs/list)
- [az backup recoverypoint](https://learn.microsoft.com/en-us/cli/azure/backup/recoverypoint)
- [Soft delete do Azure Backup](https://learn.microsoft.com/en-us/azure/backup/secure-by-default)

## Payload web opcional

`prepareDistribution` aceita a raiz web já construída (`web`). Com `index.html` não vazio na raiz, os arquivos entram em `bin/web`, lido pelo `webRoot` do servidor existente. A chamada prepara nativo e web num manifesto e em `checksums.sha256` já existentes, com reutilização imutável da saída. O exemplo não é executado. Não constrói projetos, não prova Git SHA da mesma revisão, o runtime completo da Sucafina, SSO no browser nem deploy. O chamador ainda qualifica nativo e web da mesma revisão em Linux. Entra e a aceitação de negócio seguem pendentes. Os testes usam cabeçalhos inertes e assets de fixture para admissão, integridade e preservação, sem qualificar um CLI executável. Não há entrypoint novo nem workflow de release da aplicação. O runbook de ativação futura permanece válido. Não houve execução na cloud.

```ts
import { prepareDistribution } from "../../apps/cli/script/distribution-payload"

await prepareDistribution({
  dist: "apps/cli/dist",
  web: "apps/web/dist",
  target: "linux-x64-baseline",
  version: "EXACT_VERIFIED_VERSION",
  out: "<producer-owned destination, not inside dist or web>",
})
```

## Prova web nativa no CI central

Execute `bun run test:ci cli test/distribution-web-native.test.ts --os linux --timeout 1800000` para qualificar CLI Linux e web da mesma revisão. O workflow manual `app-build` retém `distribution-logs/orchestra-sf-linux-x64-baseline.tar.gz` e `build-receipt.json`, com revisão de origem, versão e hashes do arquivo, web e catálogo público de modelos usado na compilação. O teste executa o CLI compilado do payload, sem inferência. Não é aceitação de UI, SSO nem negócio; o CI central mantém um resumo com hashes no log, enquanto a retenção do arquivo e do recibo completo exige a execução manual do workflow.
