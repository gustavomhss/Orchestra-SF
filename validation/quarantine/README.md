# Quarentena — releases de pré-visualização Sucafina (1.18.27 / linux-x64-baseline)

**Data da quarentena:** 2026-11-17 (suécia) · **Autor:** cadeia de go-live (lead)
**Decisão do dono:** a versão servida na VM está errada — pedido explícito para retirar da VM e reter no repositório como quarentena/forense.

## Por que estas quatro builds foram removidas

Todas pertencem à linhagem `orchestra@1.18.27` (`@humanguardrail/cli-linux-x64-baseline`, `sfFactory: bin/local/entry.mjs`), serviam o produto Sucafina standalone com chrome Sucafina (tema verde CIO Dashboard) em `/sucafina/*`, e não correspondem à versão esperada para o go-live (Orchestra web nativo com o módulo Sucafina dentro, sidebar nativo + features do Orchestra). Em particular, `preview-896fc974` (a única que estava em produção na VM) apresenta:

- Bug de **perda de estado no formulário de import OPEX** (datas, arquivo e destino zerados no re-render) — corrigido no PR #300 (fora deste build);
- **Fila de procurement devolvendo 503** `procurement-queue-unavailable` em instalação vazia/recem-empacotada — correção no PR #303;
- **CI elevada na base** `sf/test-CI-SF` vermelha idêntica em todo PR (falha `planner chart has keyed colors`, `fill="#b54a22"` ausente no SVG atual — fixture histórico divergente do comportamento atual);
- Superfície visual errada para o go-live (não é a identidade Orchestra ambicionada).

As quatro são builds distintas (distribution.json com SHA256 distintos: ver arquivos `distribution.json` em cada diretório e `checksums.sha256` dentro de cada tar). Nenhuma está, a partir desta quarentena, em lugar nenhum da VM `orchsf-vm` (RG `orchestra-sf-mvp`); a unit `orchestra-sf-staging.service` foi parada e os diretórios de release foram removidos da VM (vide PR de quarentena).

## O que está em cada diretório

| Diretório | Tar (LFS) | distribution.json SHA256 | Conteúdo |
|---|---|---|---|
| `preview-2dcbafcf/` | `preview-2dcbafcf-quarantine.tar.gz` | `732b443aef4819d7…` | build embrionária (234M) |
| `preview-53f20783/` | `preview-53f20783-quarantine.tar.gz` | `cb211181e8ed65ec…` | build intermediária (230M) |
| `preview-896fc974/` | `preview-896fc974-quarantine.tar.gz` | `afdc14ae826fd06c…` | **a que estava no ar** (230M) |
| `staging-591424661c/` | `staging-591424661c-quarantine.tar.gz` | `299510e2630affb3…` | build mais antiga 1.18.27 (230M) |

Hash completo e tamanho de cada tar está na tabela abaixo e no `SHA256SUMS.txt` (sha256 dos tars, medido na VM e reconferido após download).

| Tar | SHA256 | bytes |
|---|---|---|
| preview-2dcbafcf-quarantine.tar.gz | f405b3f610cfca1cda6ae5a39710af8c0d943944d416e49889d893391ff4db43 | 94317936 |
| preview-53f20783-quarantine.tar.gz | 443b912e7721d48fd1fd0368c73a5f4ec106771ffb669c0c24a1bdd4121a10a9 | 93127694 |
| preview-896fc974-quarantine.tar.gz | de2221d8c9de8740b2acace6bf4657b64442c10e84c19ddd7c6cec9ab21aae31 | 93132579 |
| staging-591424661c-quarantine.tar.gz | 1654377b3c0b793ffe8ad4b91e8629521139cc77ffc7014b3c87074932182306 | 93138263 |

Cópia adicional forense nos blobs privados do container `quarantine` da storage account `orchsfstage2611162353` (Sweden Central, RG `orchestra-sf-mvp`, sem acesso público; apenas dados criptografados em repouso).

## Seguro de desastre adicional

- Snapshot de congelamento do disco da VM: `orchsf-qa-freeze-20261117` (criado em 2026-11-17, Sweden Central) — permite restaurar a VM inteira ao estado pré go-live.
- Reconstrução a partir do candidato vivo: branch `sfa-candidate-assembly` (PR #262).

## Recuperação (se alguém precisar mesmo disto)

1. Preferível: refazer o build a partir do candidato — **não** re-implantar estes tars.
2. Para inspeção forense: extrair o tar correspondente em qualquer host Linux x64 (`bin/` contém `entry.mjs` do sfFactory; `distribution.json` descreve todos os arquivos e hashes; `bin/web/` contém o bundle web empacotado).
