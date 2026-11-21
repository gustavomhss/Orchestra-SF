# Instalação Azure do Orchestra-SF com Microsoft Entra

O instalador seleciona uma distribuição Linux x64 em `/opt/orchestra-sf/current`. A unidade systemd usa a factory Microsoft do `serve --installation` e mantém os dados em `/var/lib/orchestra-sf`, em um volume separado. O proxy é responsável pelo HTTPS e pelo cabeçalho privado exigido pelo listener Entra. O preparo do pacote, a seleção da versão e a abertura do tráfego são operações separadas.

## Preparar o pacote

Use o checkout limpo do SHA escolhido e o build nativo `cli-linux-x64-baseline` produzido a partir desse mesmo checkout. O packager confere o SHA do checkout e a arquitetura do binário fornecido. A origem do binário continua sendo responsabilidade do produtor.

```sh
bun apps/cli/script/azure-entra-package.ts \
  --dist /caminho/absoluto/dist \
  --out /caminho/absoluto/saida-nova \
  --source-sha "$CANDIDATE_SHA"
```

A saída contém `orchestra-sf-entra-linux-x64-baseline.tar.gz` e `orchestra-sf-entra-package-receipt.json`. O recibo `packaged` registra os hashes do arquivo, do manifesto e da factory empacotada a partir de `local/microsoft-entry.ts`. Verifique o SHA-256 do arquivo por um canal confiável antes de transferi-lo. A homologação do binário instalado, do proxy e do tenant real exige uma prova operacional separada.

## Preparar a VM e o Entra

- Provisione a conta sem privilégios `orchestra-sf`, o diretório `/opt/orchestra-sf` de `root:root` com modo `0755` e o volume montado em `/var/lib/orchestra-sf` de `orchestra-sf` com modo `0700`.
- Provisione o descritor e os segredos no diretório privado previsto em [runtime.env.example](runtime/runtime.env.example). Siga o [guia da instalação Microsoft](../../docs/guides/sucafina-microsoft-installation.md) para chaves, ambiente XDG, grupos e Teams. Configure `mount` como `/sucafina`, `listenerOrigin` como `http://127.0.0.1:4096` e o `workspaceDirectory` fora da árvore do descritor. O navegador usa a origem HTTPS pública. Registre no Entra a URI pública de callback `/sucafina/auth/callback`.
- Instale a [unidade systemd](runtime/orchestra-sf.service) e o ambiente `/etc/orchestra-sf/runtime.env` com `root:root` e modo `0600`. A unidade lê a configuração privada e roda como `orchestra-sf`.
- Reserve o [template Caddy](runtime/Caddyfile.template) para a abertura do tráfego. Substitua `__SF_FQDN__` pelo hostname público e `__SF_INGRESS_HOST__` pela autoridade de `ingressOrigin`, com porta quando configurada. Forneça `SF_INGRESS_PROOF` no ambiente privado do processo Caddy com os mesmos 64 caracteres hexadecimais de `ingress-secret.txt`. Restrinja a administração do proxy ao operador, mantenha o log de depuração desativado e aplique os limites de taxa e concorrência nas rotas de autenticação descritos no guia.

## Selecionar a versão

Coloque o domínio em manutenção 503 e confira a resposta HTTPS a partir de fora da VM. O Caddyfile de manutenção aceito contém somente `FQDN { respond 503 }`, com quebras de linha opcionais no bloco e a linha inicial opcional `# managed-orchestra-sf-mode: maintenance`. Pare `orchestra-sf.service` e confirme seu estado inativo.

Transfira o tar interno e o recibo para um diretório restrito. Os arquivos devem ser regulares, pertencer a `root` e impedir escrita pelo grupo e por outros usuários. O SHA-256 deve vir da verificação independente do pacote.

```sh
sudo python3 sf/azure/vm/install-factory-distribution.py install \
  --artifact /caminho/absoluto/orchestra-sf-entra-linux-x64-baseline.tar.gz \
  --receipt /caminho/absoluto/orchestra-sf-entra-package-receipt.json \
  --candidate "$CANDIDATE_SHA" --sha256 "$ARCHIVE_SHA256" \
  --fqdn "$SF_FQDN" --dry-run
```

Repita com `--apply` para publicar o diretório imutável e trocar `current` atomicamente. A execução mantém o serviço parado e o proxy em manutenção. Durante a janela de manutenção, valide a inicialização com o binário extraído e o ingresso local com prova privada. A fábrica dedicada exige essa prova, e a navegação sem sessão começa com redirecionamento para login. Faça a homologação com uma conta permitida e outra negada antes da abertura do proxy. O teste do tenant real deve usar o callback e as rotas protegidas configurados na instalação.

O comando `rollback` seleciona outra distribuição Entra instalada e verificada. Exige os SHAs de origem e destino, um documento de aprovação e uma prova independente de compatibilidade com o estado persistente, ambos de `root:root` em modo `0600`. Use `--dry-run` antes de `--apply`. A reversão troca apenas o código e mantém os dados no volume existente.
