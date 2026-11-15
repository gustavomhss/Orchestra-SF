# N16 — patches inertes para integradora 125

Preimage central `packages/app-shell/src/i18n/orchestra.ts` em sf2-stack `a15434ab558a650137f2472c7d59e6ae1e98e72a`: blob `91e526cd53e2c020f36efacb60ecad250a4da11b`. O patch Git aplicável está em `PATCH-orchestra-i18n-125.diff`; 125 deve refazer CAS se base mudar. **Nenhum arquivo compartilhado foi editado por N16.**

## Imports do host/roteador central (propostos, sem alteração aqui)
```tsx
import { SfLocalAdministrationView } from "@/orchestra/chapters/sucafina/local-administration"
import { SfRisksView } from "@/orchestra/chapters/sucafina/operations/risks"
import { SfStakeholdersView } from "@/orchestra/chapters/sucafina/operations/stakeholders"
import { SfPerformanceView } from "@/orchestra/chapters/sucafina/operations/performance"
```

| Surface fechada | Entrypoint | Read op A01 | Mutation op A01 |
|---|---|---|---|
| UI69 | SfLocalAdministrationView | projection.local-admin | nenhuma admitida |
| CAP13 | SfRisksView | domain.page.CAP13 | domain.command.CAP13.save/delete |
| CAP15 | SfStakeholdersView | domain.page.CAP15 | domain.command.CAP15.save/delete |
| CAP16 | SfPerformanceView | domain.page.CAP16 | domain.command.CAP16.save/save-item/delete-item/save-sub/delete-sub |

125 deve adicionar os quatro bindings no mapa explícito já autorizado pelo F01/I00, com `SfSurfaceProps<Id>` e `SfResolvedRoute` fechados. **NÃO** inferir path ou grants a partir da página; usar templates e auth do surface-manifest. Não criar dispatcher nem novos endpoints. F02/A01 são dependências duras; fail-closed até instaladas.

## Patch de copy central

`PATCH-orchestra-i18n-125.diff`: import e espalhamento das seis folhas `SF_U28_COPY(_BR)`, `SF_U30_COPY(_BR)`, `SF_U31_COPY(_BR)` em `ORCHESTRA_COPY` e `ORCHESTRA_COPY_BR`. 125 verifica colisões/traduções, preimage e novo HEAD antes de aplicar.

## Selective integration / divergence

A branch autora iniciou em `526e7204b310756e552196bbf3d64037dbbf047c`, HEAD produto `7ac5d020914ddeb73b6c3071f79b792490616ae9`. A base atual `sf2-stack` divergiu, e contém mudanças anteriores incompatíveis com merge integral sem reconciliação. Não mesclar a PR inteira sem a composição/patch selection por125. A única autoria nova são os 14 arquivos em `SOURCE-POSTIMAGES-e1.json` mais receipts N16.

Gate: 120 roda hosted E2E instalado, 119 compiler e guardas só após 125 compor o mesmo C. `sf2-stack`, `dev`, deploy, Goal ficam fora da autoridade N16.
