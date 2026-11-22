# G08 — executor privado, contratos atuais e obrigações preservadas

## Estado desta adaptação

A #644 usava seletores de chat/admin e uma revisão administrativa numérica que não correspondiam à linha integrada. Esta adaptação mantém **um único executor**, os quatro atores Microsoft originais e o witness instalado revisado da #644. Atualiza os controles para o seletor nativo, o contrato de navegação observado na #654 e o produtor administrativo/política observado na integração295eb/#655/#657.

São **sete controles executáveis**, não nove obrigações encerradas. Os nove IDs/títulos originais permanecem em [obligations.json](./obligations.json), junto de U15=6, U39=22, U40=22, F04=3 e das seis fases AZ02. Não há skip de chat/draft para aparentar9/9. Grants distintos e UI administrativa continuam parciais; chat/draft continuam sem implementação; todos os grupos continuam obrigatórios.

Os contratos externos foram lidos em fontes imutáveis, **não aprovados como candidato final**:

- [Dev37931](https://github.com/gustavomhss/Orchestra-SF/tree/37931c77eb07aecf01610bb0ee7d717276b85539): base desta branch.
- [Navegação #654@174ac402](https://github.com/gustavomhss/Orchestra-SF/blob/174ac4024c745e95d731daa23774c6afa79b21d5/packages/app-shell/src/pages/team-profile.tsx): seletor nativo, URL validada, intenção explícita/reload/history, logout; sem chat/draft/admin UI.
- [Produtor integrado295eb](https://github.com/gustavomhss/Orchestra-SF/blob/295eb0f01777657608cdceff2180f5efb7d8646b/modules/sucafina/Sucafinav1/runtime/team-profile-access.ts): principal autenticado em no-teams/revoked, administração observada independentemente, política atual e nenhuma autoridade de negócio por ser administrador.
- [HTTP administrativo295eb](https://github.com/gustavomhss/Orchestra-SF/blob/295eb0f01777657608cdceff2180f5efb7d8646b/modules/sucafina/Sucafinav1/runtime/team-profile-http.ts): `/api/ui/team-profiles`, origem/CSRF, catálogo e CAS. [Store original](https://github.com/gustavomhss/Orchestra-SF/blob/295eb0f01777657608cdceff2180f5efb7d8646b/modules/sucafina/Sucafinav1/runtime/team-profile-store.ts) produz tokens opacos; não existe contrato cliente de +1/+2.
- [Integração #657](https://github.com/gustavomhss/Orchestra-SF/pull/657) e [coordenação](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7080225251): composição pertence ao outro escritor. Nenhum path de #654/#655 ou do integrador é editado aqui.
- [Plano obrigatório736a](https://github.com/gustavomhss/Orchestra-SF/blob/736a5087c223629be4d73c8a4535d615fcafd96a/docs/architecture/teams-profile-test-plan.json), gate G08-NATIVE-TEAMS; [nove cenários anteriores](https://github.com/gustavomhss/Orchestra-SF/blob/aa928b6ae4a5944e5dad4b5bd206d5c123d2238e/packages/app-shell/e2e/sucafina/g08/teams-installed.spec.ts).

A integração desses contratos no C realmente instalado é pré-requisito. O preflight recusa arquivos de contrato ausentes antes de conectar o browser. Presença de arquivo não prova montagem: F02, catálogo, ação, restauração, bytes do tar, processo e ingresso são observados durante a execução. Uma fonte proposta, um `--list` verde ou um recibo de componente nunca substituem essa cadeia.

## Recibos e limites

- `sf-g08-executor-inventory-v2 / CURRENT_CONTRACT_INVENTORY_VERIFIED`: sete registros `LISTED_NOT_RUN`, `installed:false`.
- `sf-g08-current-installed-v2 / CURRENT_TEAMS_SUBSET_INSTALLED_VERIFIED`: somente após execução real no host reservado e no mesmo tar G07, `installed:true`.
- Ambos: `proofScope:"current-teams-subset"`, `g08Closed:false`, `productionCutover:false`, cobertura explícita das nove obrigações e dos cinco grupos.

A cobertura só marca as cinco obrigações integralmente mapeadas como PASS se o relatório real completo passar. Identidades distintas e HTTP administrativo positivo permanecem PARTIAL para as respectivas obrigações originais. Chat/draft, UI administrativa e grants não são presumidos. O comando `require-closed-gate` recusa esse subconjunto com `G08_REQUIRED_OBLIGATIONS_NOT_PROVEN`, mesmo que seus sete controles passem.

O agregado do plano também mantém o papel de recovery/G09 sob seu próprio dono, além de Teams/U15/U39/U40/F04/AZ02. Este executor não assume esse papel nem emite seu recibo. G01–G04/pool, #349 e G09/#588 continuam fora desta escrita.

## Mapa de equivalência obrigatório

Antes de execução instalada, **todas as linhas são NOT_RUN**. A coluna de cobertura é a capacidade dos controles após integrar os contratos e executá-los com sucesso; não é um resultado observado.

| Obrigação original | Controle/oráculo atual | Cobertura e residual |
| --- | --- | --- |
| `same-team-distinct-grants` | `same-team-principal-binding`: mesmo Team por F02 original; contexts/principals/owners distintos e reread após reload. | **Parcial.** O produtor observado ainda retorna destinations/availability vazios. Identidades distintas não comprovam grants distintos. |
| `aba-two-windows` | F02 emitido pela UI em A→B→A; URL confirmada de cada Team; janela irmã permanece em A e conserva o owner após reload. | Integral somente com a navegação #654 instalada. |
| `account-without-team` | F02 selection identifica o ator original no-teams; Team explícito retorna revoked sem owner/dados; rota de negócio original retorna403 sem body. | Integral somente com a projeção autenticada integrada.403 isolado não identifica o ator. |
| `foreign-deep-link-reload` | Deep link válido + reload; instalação estrangeira permanece na URL, UI invalid e nenhum F02 Team disparado; repetir após reload; retornar ao próprio link. | Integral somente com a navegação #654 instalada. |
| `admin-without-team` | `admin-api-without-team`: F02 administration available para principal original sem Team, catálogo HTTP original acessível, negócio403. | **Parcial.** A UI original `/orchestra/sf-home/administration`/`data-sf-team-administration=ready` não é composta por #654/#655. API não substitui essa subobrigação. |
| `narrow-keyboard-draft` | Nenhum cenário de chat executado. | **BLOCKED_BY_PRODUCT.** Preservar chat/rascunho Team por teclado em Web estreita, sem diretório/git; a landing não é equivalente. |
| `draft-cancel-discard` | Nenhum cenário de rascunho executado. | **BLOCKED_BY_PRODUCT.** Cancelar preserva A/rascunho; confirmar descarta antes de B; retorno não ressuscita conteúdo. |
| `real-revoke-restore` | Admin original faz uma única operação disable com token CAS exato; catálogo reread, F02/revogação/403 em ambos os atores, B intacto, enable e reread/cleanup reais. | Integral somente com admin/política montados e mutação temporária explicitamente autorizada. JSON/status manual não é prova. |
| `logout-original-context` | POST original204, mesmo contexto401, janela irmã401 após reload, holder original segue admitido. | Integral no seu escopo. Não prova token replay bruto, logout global Entra ou restart; são obrigações separadas AZ02. |

A UI atual pode mostrar unavailable para um Team explicitamente revogado: o leitor [team-profile-web.ts@295eb](https://github.com/gustavomhss/Orchestra-SF/blob/295eb0f01777657608cdceff2180f5efb7d8646b/packages/app-shell/src/context/team-profile-web.ts) rejeita um resultado não-ready para esse selector. O executor observa o F02 revoked original, ausência de owner/destinations/availability e de controles de negócio, além do403 original. Não inventa um alerta histórico. Uma futura projeção authenticated/denied só é aceita com essas mesmas provas de recusa.

O CAS administrativo preserva `ConfigRevision` exatamente, inclusive tokens opacos. Depois do disable, o token da resposta deve ser o do catálogo relido e diferente do anterior. Restore usa o token atual observado, uma única vez, e comprova catálogo original e nova admissão. Se o resultado do disable for incerto, uma leitura original reconcilia apenas os estados admitidos; não há retry de mutação nem sucesso manual. Falha de restauração impede o recibo.

## Grupos obrigatórios separados

| Grupo | Inventário preservado | Dependência e prova necessária |
| --- | --- | --- |
| U15 / CAP14 | 6 títulos originais | Capítulo admitido e bundle list/editable/denied/stale/lost; segundo editor Microsoft na mesma versão CAS; dados isolados/cleanup do produtor. |
| U39 / CAP04/2026 | 22 títulos originais | Bundle entry/empty/source/readonly/denied/revoked/stale/late; revogador real e segundo escritor; fonte/oráculos originais. |
| U40 / CAP05/2026 | 22 títulos originais | Mesmo contrato completo por caso, em invocação própria CAP05. Não colapsar22 casos para entry. |
| F04 | 3 controles originais | Guest no ingresso real; selector moderno malformado recusado; cliente real com geração vencida produz zero rede. Invocação Bun/Happy DOM com manifest instalado; não é positivo CDP. |
| AZ02 | preflight14, actors11, producer2, after-revoke2, logout2, after-restart1 | Contrato moderno tenant/Team/host/revisões; CAS409/422 com estado intacto; revogação observada; cookies/replay; restart real do mesmo C/T/tar. |

Títulos/blobs/paths originais de `687759276c2c9121c2cfd20a5994b277ceb7ee4d` estão no JSON. O inventário de U15/U39/U40 totaliza50 registros preservados; isso não é50 execuções. Os paths históricos de journeys/native manifest não existem na árvore base inspecionada. Nenhuma dependência legada foi importada, nenhum console ressuscitado e nenhum comando histórico foi apresentado como CLI existente.

Esses grupos continuam `NOT_RUN`. A atualização de navegação/admin não compõe por si seus capítulos/fixtures/callbacks. O executor atual não emite recibos desses papéis. A falta de reserva operacional é independente da falta de composição técnica.

## Reserva e admissão instalada

Somente o job manual `installed-teams-current` de [g08-private-preflight.yml](../../../../../.github/workflows/g08-private-preflight.yml) conecta o browser. Requisitos cumulativos:

1. C/T final confirmado por Migração e Release, recibo original G07 `PACKAGE_VERIFIED`, ZIP/tar/manifest/factory imutáveis e instalação desses bytes. Esta entrega não preenche nenhum ACK final.
2. Contratos atuais integrados nesse mesmo C. Ausência de navegação, política, admin observer/HTTP, principal no-teams/revoked ou seleção real deve bloquear; não usar flag para declarar disponibilidade.
3. Reserva exclusiva QA com responsável, VM ID, janela e referência original; autorização dos quatro atores, do logout e do disable/restore temporário do Team A. Runner label/ambiente protegido não são reserva. Metadados de autorização não são grants.
4. Quatro BrowserContexts Microsoft originais: requester, holder, denied e dashboardAdmin, todos distintos. Requester/holder admitidos em A com autoridade própria; requester também em B; denied sem Team; administrador sem Team, com autoridade administrativa original. Os contexts são identificados por F02 positivo atual, não por uma etiqueta do manifest.
5. Root privado0700, arquivos regulares0600, mesmo UID, sem symlinks/hardlinks, fora do checkout. `plan.json` canônico com newline, recibo G07 exato e `browser-endpoint.txt` loopback. Nenhum segredo no repositório.
6. Witness antes/depois: instalador real, todos os bytes/modes, current source, PID/exe/argv/factory/config, listener do PID, IMDS da VM, Caddy ativo e discovery loopback/HTTPS com mesmo hostId. `installation:null` do empacotador não satisfaz isso.
7. Cache/SW bypass, respostas originais ligadas ao frame/peerHTTPS443 nos IPs da VM reservada. Browser fetch mantém o cookie jar original; nonce somente correlaciona a resposta.
8. Cleanup: nenhum novo contexto, páginas próprias fechadas e attach desligado; ingress sem erros; mesmos process/binding antes/depois; catálogo restaurado e admissão reobservada no caso de revogação. Audit/CAS avançado não é apagado.

O plano mantém `sf-g08-private-plan-v1` e seus campos originais:

```text
candidate: { sha: C completo, tree: T completo }
packageReceiptSha256: digest do recibo original G07
reservation: { reference, owner, startsAt, endsAt, vmId, environment: qa-isolated, exclusive: true }
approvals: { actorsReference, mutationReference, scope: qualification-only }
invocation: { id: nonce32hex, runId, runAttempt, workflowSha }
target/teamB/foreignInstallation: { serverKey, discoveryOrigin, shellOrigin, publicOrigin,
  installationId, tenantId, teamObjectId, projectId, hostId, mount, chapterHref }
actors: { requester, holder, denied, dashboardAdmin }  # principalObjectId reais distintos
scratchRoot: diretório privado absoluto
```

A/B usam a mesma instalação/tenant/host e IDs de Team distintos. O target negativo mantém o mesmo host/tenant/Team e muda somente installationId. `chapterHref` usa somente `/`, `/orchestra/sf-home` ou `/orchestra/sf-home/context` e o query fechado `contractRevision/server/installationId/tenantId/teamObjectId`; os parâmetros devem corresponder ao target. Sem year, aliases legados, fragmentos ou fallback de projeto.

Sem reserva e esses insumos, não despachar instalado. A sequência existente `admit → host-before → Playwright → host-after → verify` não instala, reinicia serviço, clona sessão ou fabrica consentimento. A mutação administrativa exige a autorização específica registrada no plano. G08/G10 podem qualificar o mesmo tar em reservas separadas após o aceite dos ambientes; produção exige go/no-go e janela próprios.

## CI e evidências

Push de `teams-landing-proof` aciona somente controles hosted Linux:

- Node: private files, package/host binding, relatório exato, nove obrigações/cinco grupos preservados e recusa de promoção indevida.
- Python: witness somente leitura de instalação/processo/ingresso.
- Bun/Happy DOM: `SfTeamWebApp` real, leitor HTTP real e transporte controlado, usando os mesmos seletores do executor; resultado de componente.
- Typecheck pelo script do pacote isolado.
- Playwright `--list`: sete controles carregados, sem browser/CDP nem execução instalada.
- Guards canônicos contra `origin/dev`.

O controle DOM evita publicar seletores inexistentes como prontos. Não qualifica a integração Microsoft ou a navegação #654 só por compilar. Os source hashes, relatório bruto, host-before/after e cleanup têm digests separados. No host, apenas relatório inteiro, sete resultados originais, workers1/retries0, sem filtros/shards/skips/falhas/resultado ausente, exit0 e cleanup completo produz o recibo do subconjunto.

O recibo público permite apenas C/T, digests, IDs estáveis, contagens, referência do produtor e cobertura. Não publica URL, cookies, CDP, env, claims/bodies brutos, erro privado, trace, vídeo ou screenshot. Dados brutos permanecem na reserva privada, cuja política governa retenção/remoção.

## Fechamento

G08 exige todas as nove obrigações integralmente comprovadas, U15/U39/U40 completos em suas invocações, F04 e todas as fases AZ02, mesmo candidato/tar G07, atores/grants reais, dados/mutações autorizados e cleanup/restauração observados. Sete controles verdes não substituem essa condição.

A prova222 (2) continua4/4 no QA original atestado pelo handoff; seu backlink/SHA/tar ainda não foi recuperado nesta frente. Não é promovida para este candidato. Ver [matriz](../../../../../docs/qa/sucafina/go-live/g08-teams-qa.md) e [ledger](../../../../../docs/qa/sucafina/go-live/status.json). Resultados anteriores permanecem vinculados aos seus SHAs e alcances.
