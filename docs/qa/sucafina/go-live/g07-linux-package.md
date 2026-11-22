# G07 — pacote Linux x64 para o go-live

## Estado desta preparação

**PREPARADO; QUALIFICAÇÃO FINAL NÃO EXECUTADA.** Este documento reconcilia as rotas de pacote disponíveis. Nenhum tar foi gerado por esta frente, nenhum workflow foi disparado e nenhum ambiente foi alterado. O SHA final permanece sem pin conjunto da Migração e da Release.

Fonte de escopo: [handoff c02f329d](https://github.com/gustavomhss/Orchestra-SF/blob/c02f329d48d37e2f6296154978cd8a7cf80bcb64/docs/qa/sucafina/astra-go-live-handoff.md). Referência de triagem: `dev@79912446753af5bb291fc2581543732eb4c83057`, árvore `5c32cd72537799632e7d2583c1775df1d88b8780`. Esse pin de leitura não é o candidato final.

## Donos e pré-condições

| Responsabilidade | Dono / situação verificada |
| --- | --- |
| Preparação e coordenação de G07 | Esta sessão Astra, conforme autorização de Gustavo |
| Integração de G01–G04 e pool | Sessão Retomar migração para Microsoft Teams |
| Execução do pacote final | Dono operacional da Release ainda precisa registrar o aceite para este candidato |
| Empacotamento histórico | [#257](https://github.com/gustavomhss/Orchestra-SF/pull/257), `sfa-factory-package@3910a644c7fdab1a438c2b5b39d69afc19361709`, aberto/draft, base `sf-package-hold` |
| Release histórica | [#247](https://github.com/gustavomhss/Orchestra-SF/pull/247), `sfa-release@a8634972abb4e042fc4cf401c2c6c966f2f56cb7`, aberto/draft; sem aceite atual de C encontrado |
| Rota prod observada na frente G09 | Mantida sob seu dono atual; reutilização exige coordenação, sem editar sua branch ou disparar seu workflow |
| Instalação em QA / ensaio de recuperação | Ambientes isolados autorizados de G08 e G10, depois de validar o tar |

Os pins antigos contidos nos corpos de #247 e #257 não substituem seus heads observados nem constituem confirmação da Release. Os comentários de 18/11 registram esses PRs como superseded pelo bundle antigo; por isso seus nomes não são aceites operacionais atuais. Em 22/11, outra frente Astra registrou em [#257](https://github.com/gustavomhss/Orchestra-SF/pull/257#issuecomment-7074525725) a reconciliação dos sourcemaps do empacotador genérico para o residual #349. Esta frente G07 preserva esse dono e não inicia um segundo escritor nesse recorte. Antes da geração final, registrar os dois ACKs — Migração e Release — para o mesmo SHA C e árvore T, a rota de execução, o compilador e os recibos de pré-requisitos. A aprovação da janela e o go/no-go de produção são decisões posteriores e específicas.

## Reconciliação das rotas existentes

| Rota no pin de triagem | Uso correto |
| --- | --- |
| [apps/cli/script/azure-entra-package.ts](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/apps/cli/script/azure-entra-package.ts) | Produtor Microsoft real; blob `b2f4e16a8737f4cdfaa906e5acd628c21a97115d` |
| [sf/azure/vm/install-factory-distribution.py](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/sf/azure/vm/install-factory-distribution.py) | Verificação independente e instalação; blob `17345366812c79944928731d4fe188b3bced7342` |
| [app-build.yml](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/.github/workflows/app-build.yml) | Distribuição genérica CLI/Web. O [teste invocado](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/apps/cli/test/distribution-web-native.test.ts) fixa canal `dev`; não gera o pacote Microsoft final de G07 |
| `sf/ci/assemble-orchestra-web.mjs` e `.github/workflows/sf-factory-package.yml` | Ausentes em `dev@7991244` e no candidato de preparação `g03-g04-repair@b4ba7f595e6b3b5ff10a3379cd91b6771bb1b793`; as receitas antigas não podem ser executadas como se esses caminhos estivessem presentes |
| [g09-candidate.yml@83f1283](https://github.com/gustavomhss/Orchestra-SF/blob/83f1283f8e39cd5863d9806b9a48f0573f44eaff/.github/workflows/g09-candidate.yml) | Referência concreta de produção Linux Microsoft com `ORCHESTRA_CHANNEL=prod`, marca Sucafina, inventário e proveniência; não foi assumida por esta frente |

A rota prod de referência usa o mesmo blob do produtor Microsoft presente no `dev` observado. Sua workflow usa Node 24.15 e Bun 1.4.1 baseline, revisão `4661e494f052c83c80dade1318e5710238340be6`, ZIP SHA-256 `a8c9c6738202e2fced555dd860a953c56c0cd059f75041e7010ae81a32802646`. O plano antigo e a workflow genérica citam Bun 1.3.14. A Release deve fixar essa decisão explicitamente; não trocar o compilador silenciosamente nem transportar prova entre versões.

## Evidência anterior disponível

Referência observada em [run 44983358294, tentativa 1](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44983358294), job [teams-profile-artifact / 137088492396](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44983358294/job/137088492396), concluído com sucesso.

| Campo | Valor observado |
| --- | --- |
| Fonte / workflow | `83f1283f8e39cd5863d9806b9a48f0573f44eaff` |
| Árvore da fonte | `3dc5e13e4368c0452fa54481878965295f77405e` |
| Artefato Actions | [14738902174](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44983358294/artifacts/14738902174), `orchestra-sf-entra-linux-83f1283f8e39cd5863d9806b9a48f0573f44eaff` |
| SHA-256 do ZIP Actions | `f080447b290086cc2b4fa0229204568876ee76f4cba5a98e608e0ba0aa1312a9` |
| Tar interno | `orchestra-sf-entra-linux-x64-baseline.tar.gz` |
| SHA-256 do tar interno | `af312871e79307bd281e7d46a162feeb44bc0112db0e67cb59f8be55db20a109` |
| SHA-256 de distribution.json | `12fe0b65b2c6b7851ba7184914145d0e0c0ff92c071c6fead7821085e0aeaca9` |
| SHA-256 da factory | `fdcb3fbc2348b3e1a8a8054c7ea518c21df504e02e60e372ae4c5c8565606297` |

Foram lidos o código da workflow, metadata do artefato, passos e logs. Os logs registram `sf-entra-factory-package-v1`, `PACKAGE_VERIFIED`, instalação temporária, segunda instalação idempotente e inventário de 1.391 membros. O hash do ZIP Actions identifica o contêiner de transporte; é distinto do hash do tar instalado.

**Limites:** a instalação no runner substitui `vm_preflight` e os paths por diretórios temporários. Ela não comprova Caddy, systemd, volume Azure ou login Entra real. O fluxo C17 dessa execução usa Entra sintético. Essa referência não aprova G07 no candidato futuro, não qualifica G08/G10 e não concede PASS formal de G09. Os metadados e logs foram verificados nesta preparação; não foi feita nova aquisição e verificação dos bytes do artefato.

O [#555](https://github.com/gustavomhss/Orchestra-SF/pull/555) também contém testes históricos do instalador e da factory, inclusive com executável sintético. O [#585](https://github.com/gustavomhss/Orchestra-SF/pull/585) contém prova instalada C17 anterior em canal `dev`. Servem para entender mecanismos e casos; não substituem o tar prod final.

## Contrato do produtor e do instalador

O produtor exige checkout limpo e igual a `--source-sha`, destino novo sem sobreposição com os inputs e distribuição Linux x64. Ele prepara o payload pelo produtor comum, verifica ELF64 x86_64, empacota `bin/local/entry.mjs` e `bin/local/closure.json` e confere os marcadores Sucafina/artwork no Web fornecido.

O recibo `sf-entra-factory-package-v1` contém `sourceSHA`, `checkoutSHA`, `expectedSourceSHA`, `target`, `archiveFile`, `archiveSha256`, `manifestSha256`, `bundleSha256` e, em Actions, `runID`/`runAttempt`. O tar contém `distribution.json` e `checksums.sha256`, com roster, hashes e bits executáveis de cada componente.

O recibo nativo deve ser preservado como produzido. A evidência complementar de G07 vincula árvore, canal/brand, compilador, workflow/job, inventário, identidade do artefato e instalação. Não preencher ausências por inferência.

O instalador verifica hash antes de escrever, recusa membros especiais/duplicados, compara roster e checksums exatos, valida closure e ELF e aplica permissões geridas. A instalação real exige Linux x64/root, conta não privilegiada do serviço, volume privado independente, Caddy em manutenção e serviço parado. `INSTALLED_NOT_STARTED_CADDY_STILL_503` significa que o código foi selecionado; não significa que o serviço foi iniciado ou que houve corte.

## Procedimento pós-pin — preparado, não executado

1. Registrar C/T e os ACKs reais da Migração e da Release; conferir os pré-requisitos no mesmo candidato. Revalidar os blobs das ferramentas no C final.
2. Fixar workflow e compilador. Confirmar fonte limpa, canal `prod`, marca `sucafina`, modo production e ausência de overrides `VITE_*`. Capturar os pins e hashes dos inputs, incluindo o catálogo de modelos usado no build.
3. No runner Linux x64 autorizado, instalar dependências congeladas, construir Omni/CLI e Web pelo roteiro reconciliado. Preservar separadamente os mapas/ledgers vinculados aos bytes para a frente G09. Nunca publicar mapas por acidente no payload.
4. Executar o produtor Microsoft sobre os outputs desse mesmo checkout.
5. Verificar o tar com o instalador, capturar inventário e hashes e publicar o artefato imutável. Registrar também ID/nome/digest do ZIP e run/tentativa/job.
6. Disponibilizar exatamente esse tar para G08 e G10. Nas instalações autorizadas, conferir `.a7-source.json`, hashes instalados e identidade do executável/factory em uso. Não reconstruir entre os gates.

Comandos existentes para uso após o pin. `C`, `PACKAGE_OUT`, `TAR_SHA256` e `QA_FQDN` são inputs reais a obter e validar; não são valores observados nesta preparação.

```bash
# Contexto: raiz do checkout C limpo, com CLI e Web prod já construídos.
bun apps/cli/script/azure-entra-package.ts \
  --dist "$PWD/apps/cli/dist" \
  --web "$PWD/apps/web/dist" \
  --out "$PACKAGE_OUT" \
  --source-sha "$C" \
  --factory-source-map

python3 -B sf/azure/vm/install-factory-distribution.py verify \
  --artifact "$PACKAGE_OUT/orchestra-sf-entra-linux-x64-baseline.tar.gz" \
  --receipt "$PACKAGE_OUT/orchestra-sf-entra-package-receipt.json" \
  --candidate "$C" \
  --sha256 "$TAR_SHA256"

# Na VM de QA isolada autorizada, com inputs absolutos e propriedade exigida.
python3 -B sf/azure/vm/install-factory-distribution.py install \
  --artifact "$PACKAGE_OUT/orchestra-sf-entra-linux-x64-baseline.tar.gz" \
  --receipt "$PACKAGE_OUT/orchestra-sf-entra-package-receipt.json" \
  --candidate "$C" \
  --sha256 "$TAR_SHA256" \
  --fqdn "$QA_FQDN" \
  --dry-run
```

O `--dry-run` não prova a instalação efetiva e não exige os mesmos controles de manutenção que `--apply`; a aplicação no ensaio autorizado deve conservar o preflight real. Nenhum monkeypatch de `vm_preflight` conta como prova da VM. A ativação e a recuperação pertencem aos procedimentos de G08/G10 e à autorização do ambiente.

## Registro proposto — não é recibo de execução

```json
{
  "gate": "G07",
  "status": "PREPARED_BLOCKED_ON_FINAL_PIN",
  "preparationOwner": "Astra go-live",
  "releaseExecutionOwner": null,
  "candidateSha": null,
  "candidateTree": null,
  "migrationAcknowledgement": null,
  "releaseAcknowledgement": null,
  "producer": {
    "workflowSha": null,
    "runId": null,
    "runAttempt": null,
    "jobId": null,
    "checkRunId": null,
    "toolchainReceipt": null,
    "buildInputsReceipt": null
  },
  "artifact": {
    "id": null,
    "name": null,
    "zipSha256": null,
    "archiveFile": null,
    "archiveSha256": null,
    "manifestSha256": null,
    "componentInventory": null,
    "packageReceipt": null
  },
  "installation": {
    "authorizedEnvironmentRef": null,
    "receipt": null,
    "installedComponentHashes": null,
    "runningBinaryAndFactoryProof": null
  },
  "referenceRun": "44983358294",
  "referenceArtifactId": "14738902174",
  "referenceOnly": true,
  "firstBlocker": "Pin final e rota de execução ainda sem confirmação conjunta da Migração e da Release."
}
```

**Fechamento de G07:** tar verificado e instalado com prova real, vinculado ao C/T confirmado, componente por componente, com recibos e identidade do artefato. Esse mesmo hash de tar deve constar nos resultados de G08 e G10. Qualquer mudança de fonte, compilador ou bytes exige nova identificação e qualificação do que mudou; nenhuma aprovação é herdada para outro candidato.
