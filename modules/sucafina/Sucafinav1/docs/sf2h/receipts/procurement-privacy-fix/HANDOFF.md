# Missão73 — privacidade de registros Procurement

## Entrega e alcance

A unidade material da73 está liberada para composição pela71, com **29 testes selecionados PASS, zero FAIL e revisão independente de fonte sem bloqueador residual**. A PR86 permanece draft. Compiler/guards45, composição, qualificação instalada75 e aceite final continuam pendentes. **GLOBAL_RELEASE=false.**

- Branch: `procurement-privacy-fix`; lease `procurement-privacy-browser73`, encerrada pelo recibo terminal.
- Base: `faa30fddb7e7b61696b66fd069f51cf18c51125f`.
- ACK73: `6db479f1f72e6ed0419a65e55cc9fd8f7f8078a5`.
- Material W: `4bf5d040649d807d5ef6c8cbabf1409d8aee849a`; tree `bc36d52d75f59faa27bc604e399c3d096cf62df6`.
- Snapshot de CI S: `2c0b92951ea5a4d15cc40a473860465cb84ca61d`; tree `28fd369e0012bd92497dc69e21459ea867266237`. Parent único W; delta exclusivo `.ci-run.json`.
- PR draft: https://github.com/gustavomhss/Orchestra-SF/pull/86
- O commit que contém este handoff é a entrega terminal documental. Seu SHA/tree exatos serão anunciados após CAS e readback nas PRs86/65/78; os seis blobs materiais permanecem os de W.

## M70-ISO-01 corrigido na fonte

As dez ações de registro — save, submit_pr, submit_sourcing, select_quote, submit_po, approve, reject, issue, cancel e delete — agora verificam a visibilidade canônica antes de responder sobre existência, versão, conflito ou transição. Para requester puro A, um ID ausente e uma PR de B invisível produzem o mesmo status404, corpo e cabeçalhos nas versões igual, anterior e posterior. Nenhum valor privado integra a resposta.

A verificação usa `visibleRequests` existente e lookup de propriedade própria. Identificadores herdados, como `toString`, não são tratados como registros. Create fica separado: ignora ID de registro fornecido pelo caller e conserva o CAS do slot `requests:`, sem consultar nem copiar metadados de outra PR.

Para registros visíveis, permanecem o conflito409 com conteúdo atual, CAS, holder, papéis, condições de edição e transições do domínio. Visibilidade não concede permissão de escrita. O caso dual-role continua seguindo a porta canônica e mantém403 quando a edição de uma PR visível alheia é proibida. Não houve alteração em engine, alçadas, thresholds, regras financeiras, persistência ou produtores de visibilidade.

No limite HTTP de anexos quote/signed-po, a mesma verificação ocorre antes de consumir corpo/scanner e novamente na transação final, após autenticação fresca. Principais vazios/local são recusados antes do lookup; este segundo ponto veio da revisão independente e foi corrigido antes de W. IDs inválidos/ausentes podem agora receber404 opaco antecipado, em vez do400 tardio de assets; `safeId` e a política de anexação continuam intactos.

A inspeção também encontrou os caminhos adjacentes de submit_pr invisível e reutilização de metadados em create. São achados estáticos do preimage, não uma alegação de exploit antigo executado. As regressões publicadas verificam o comportamento corrigido.

## Apresentação63 e coordenação75

Os quatro hunks e sete interpolações monetárias da63 foram incorporados exatamente em `runtime/procurement.ts`, juntamente com o gate de privacidade. `30240.000000000004` passa a ser apresentado como `30240`; os números canônicos, snapshots, cálculos, ranking e tolerância não são modificados pelo formatter.

O postimage combinado é `a4ab021f646c0fc819b3afdde18796630fb9603f`. O postimage money-only63 `0a0dd9eb2299df05e8c6bc14cd4dc67313b64c25` não deve substituir este arquivo. A correção da mensagem FX acessível duplicada pertence à75 em `src/screen-shell.ts`; o postimage75 observado é `f1573e02df562db7569f53931d7a4524a108ad4b`.

[PRESENTATION-RELEASE.json](PRESENTATION-RELEASE.json) responde ao REQUEST73 da75.71 compõe as unidades liberadas;75 qualifica os cinco nominais originais com ClamD real no candidato exato. Os seis testes de render73 não substituem essas jornadas.

## Prova hospedada

[R1 / run43671737333 / job132683058916](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43671737333/job/132683058916), attempt1, conclusão **success**:

| Grupo | Casos PASS |
|---|---:|
| Commands — isolamento, conflitos e ciclo real | 17 |
| Presentation — produtores e valores canônicos | 6 |
| Uploads — recusa precoce e principals inválidos | 4 |
| Dois testes legados originais selecionados | 2 |
| Total | **29** |

**0 FAIL;15 filtered out;889 expect calls;4 arquivos;790ms reportados pelo Bun.** Job de cleanup132683555064 concluiu success e removeu a branch de snapshot. Nenhum artifact foi produzido por essa seleção Bun; o log completo está em [logs/R1.log.txt](logs/R1.log.txt).

A fixture usa HTTP/application, resolução canônica de papéis e SQLite reais, com identidades/grupos/dados sintéticos declarados. As recusas comparam snapshots persistidos; uploads comparam também payloads/blobs. Duas instâncias SQLite disputam a mesma versão e somente uma grava; o estado é conferido depois de reabrir o store.

Os dois testes originais selecionados, sem modificação, foram:
- `complete procurement field roundtrip and frozen approvals survive settings edits`
- `dual-role request transitions retain porta authorization without permitting foreign PR edits`

O scanner negativo lança se for chamado. Isso prova que a recusa antecede o scanner; não representa ClamD limpo nem a corrida de revogação durante um scan aceito. O gate após scan recebeu revisão estática. Playwright/Chromium não foram executados. O controle Omni registrou **not applicable**, nonce `f93a4df3a0e29efea31c1b5a505feaf1`, sem spawn/delegação; não há crédito Omni/nativo.

[checks/R1.json](checks/R1.json), [request exata](checks/R1.request.json), [metadados dos jobs](checks/R1.jobs.json) e [revisão independente](reviews/INDEPENDENT-RECHECK.json) vinculam os resultados a W/S. Nenhum teste, typecheck, guard ou build de produto foi executado localmente.

## Composição mínima pela71

[SOURCE-MANIFEST.json](SOURCE-MANIFEST.json) fixa os pre/postblobs e SHA256 de **dois arquivos runtime e quatro arquivos novos de testes**. [source-and-tests.patch](source-and-tests.patch) é o patch material completo desses seis arquivos; SHA256 `e634e32c31acfe370ee86bf06738f39abbfb2901b310b6fc28797a6aad44c839`. A checagem estática de aplicação nos preimages exatos passou. Os recibos são arquivados pela árvore terminal, fora desse patch material.

[DEPENDENCIES.json](DEPENDENCIES.json) registra os imports diretos dos seis arquivos e a herança do restante da árvore de base, sem overlay estrangeiro. Na observação C34 `4bcafba5d73497f9afbc9ac7965eeab8070b3900`, os dois preimages runtime73 ainda coincidiam. `contract.ts` e `local-store.ts` haviam mudado por integrações anteriores. Essa diferença impede transportar os29PASS para C34 ou para um candidato futuro.

A71 deve conferir HEAD/autoridade e preimages novamente, compor a unidade mínima sem substituir dependências de outros owners, arquivar recibos e pedir qualificação pelas lanes45/S0 apropriadas.71 continua único writer do stack e não recebe autorização deste handoff para despachar testes, checks ou AM.

### Patch legado preparado, não aplicado

[external/MANIFEST.json](external/MANIFEST.json) e [external/legacy-hidden-request-status.patch](external/legacy-hidden-request-status.patch) fornecem uma única mudança403→404 para save de PR invisível no teste legado de ownership, fora dos paths de autoria73.

- Preimage: `d622fa8463ee6d05a5c03de6517381045b6f0241`.
- Postimage proposto: `5c25f109c4df835761e8aba8351686174ac6d7aa`.
- Patch SHA256: `68828d7623bf9bfb9926276f130db23d1754379754fd2fa158b029ef5a9c6f6b`.

O403 do dual-role visível permanece intacto. Não houve skip, enfraquecimento de fixture/oráculo ou aumento de timeout; a seleção R1 é explícita. A suíte legada completa não foi executada pela73 e precisa da disposição do owner seguida de regressão no candidato composto.

## Critérios e pendências

[CRITERIA.json](CRITERIA.json) conserva os111 IDs do pack S2-A e diferencia regressão de fonte, prova parcial e não executado pela73. Nenhum critério amplo ou status do plano foi substituído por um PASS genérico. Permanecem15WPs/74tasks/17contratos/1610critérios e o planejamento imutável. CAS de comandos comuns não é qualificação de PreparedChange/C03/replayC12; C02 aqui usa contexto sintético declarado.

[checks/REQUEST-45.json](checks/REQUEST-45.json) referencia o pedido exato já feito na PR32 para `bun typecheck` e `bun run check:guards --base origin/dev`. Não foi observado resultado45 para W; os checks são **REQUESTED_NOT_RUN**, obrigatórios e sem waiver. Não foi enviado pedido duplicado.

Solicita-se **ACK71** da unidade W/árvore/terminal/pre-post e roteamento de recheck independente de **M70-ISO-01 no candidato composto**. A revisão de fonte por `/root/privacy_review`, sem autoria de código/testes, encontrou zero bloqueador residual; ela não é uma das três revisões FINAL da campanha.

Continuam obrigatórios: checks45, patch e regressão legado, composição71, ClamD real/cinco nominais75, evidência dinâmica antes de alegar cobertura da corrida pós-scan, oito seleções finais, AM01–AM06, três revisões FINAL e gates C/G7/D/G8. Provas Microsoft/B2B, instalação nativa e os demais HOLDs herdados não são resolvidos por esta entrega.

[CONSUMER-RELEASE.json](CONSUMER-RELEASE.json) libera a unidade delimitada para composição e [AUTHORITY-FINAL.json](AUTHORITY-FINAL.json) encerra a lease73. Nenhum merge, deploy ou liberação global foi realizado.
