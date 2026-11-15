# W18 / A06 — HANDOFF autorizado S0 e folhas MATERIALIZADAS

**Este documento SUBSTITUI o estado pré-admissão histórico de `HANDOFF.md` / `PREPARED-BUNDLE.json`.**

## Estado verificável

- S0 admitiu autoria direta dos19outputs: `AUTHORING-ADMISSION19.json@8852ed4`, saída W18 é `READY_FOR_AUTHORING_SAME_ACK_ACTOR`, actor/branch `gustavomhss/sf-ux-w18`, epoch `ux-native-w18-e1`. A errata supera SOMENTE a espera da114 antes de escrever os leaves exclusivos. Não autoriza editar shared paths.
- Código real materializado exclusivamente nos cinco caminhos A06 listados em `AUTHORIZATION-MATERIALIZATION.json`; os blobs correspondem exatamente aos preparos em `PREPARED-BUNDLE.json`. F02/114 integra os callsites compartilhados; nenhuma cópia do produtor foi criada.
- As25operações `files.*` têm schema named exports + DTOs estruturais; cliente expõe25 funções sem execute livre; host adapter delega a produtores/imports/docs/scenarios/application original, falha503 se ausente; testes contratuais de componente escritos mas NÃO_EXECUTADOS.
- W18 não gerou SDK, não editou generated, não fez testes locais, não fez GitHub Actions, merge, deploy, Azure ou acesso externo.

## Autoridade/fonte e revisão

- Pin C58: `runtime/application.ts@a0deff8` (ACL de asset Procurement, proibição `local:`, export post-generation 403/409 e digest); `import-http@72196e5`, `document-http@8f679de`, `document-scenario-http@d6926db` unchanged.
- Contratos `ctx/files/transport`: catalog `31dbec17`; hosts `e99e094`; CONTRACTS `94553a3`, protocolo normativo `0151a8e` prevalece sobre duas linhas de nomenclatura UX herdadas.

## Patches compartilhados INTEGRAIS, NÃO aplicados

- Postimage `packages/schema/package.json@3831ae4dc0dc1a059f19b96846039f6761252611`, preimage `adc53ecfa8f4ac83fee37854db2dc0ec2bb9136a`.
- Postimage `packages/client/package.json@f000a7aa621e725e90ed6cd5e6bd128e68a91475`, preimage `4cd0244e98ff18b5e65d3c2808196705095b6691`.
- Cópias integrais desses postimages no diretório `prepared/packages/*/package.json`; aplicar somente após reconcile/CAS no HEAD atual 114; nunca sobrescrever atualizações de outros autores.

## Bloqueios técnicos a checar pela114 (F02/I00/D01)

1. Codificar exatamente25 metadados frozen de `files.*`, body selectors e paths por host-surface; cliente nunca autoriza actor e `surface` não deve entrar no body POST do servidor.
2. `import-admit` exige *multipart* real File + `surface`/`selectionRef`/`options`, até16MiB bytes e64KiB envelope; `asset.upload` exige raw bytes/MIME, cap contrato25MiB ou dinâmico, scanner real obrigatória; F02/D01 transformam a representação `Uint8Array` do tipo de input em transfer isolado sem JSON, paths, iframe ou URL arbitrária.
3. `document-confirm` body é DocumentEvidence EXTRACTED inteiro; `document-schema` body são seus campos, CAS id/expectedVersion. `document-open`/scenario-targets query `ref` JSON completo com candidate; schema version/CAS e autorização humana permanecem no produtor.
4. `asset.link` não é grant; `asset.download` usa HMAC exact e verifica actor/expiry no produtor. Exports são bytes com `no-store`, reauth pós-geração e digest; negar stale/timeout/unavailable, inclusive scanner ausente.
5. F02 binding/codec DEVE rejeitar campos extras e action/operation desconhecidos antes de rede; `Schema.Json` em campos matemáticos aninhados é opaque nesta folha e requer validação canônica de domínio pela equipe114/119 (não pode servir como cálculo ou autorização).

## Testes / fechamento

- W18 escreve `test/native-ui-contract/files.test.ts` como prova **componente pendente**. Não são testes instalados, não há fake de scanner/autorização.
- **120**: rodar GitHub Actions cirúrgicos após composição: spec; uploads com scanner false/throw/absent, limites e extensão; download actor/ACL/HMAC/expiry, C58 digest 403/409, imports reais xls/xlsx/json preview/apply e CAS, document extract/confirm/fieldSchema, stale/timeout e streaming.
- **119**: typecheck/guards e coerência do Schema API/registry/export maps só após 114 compor; validar qualquer parser/Schema.Json nested antes da qualificação.
- AC01 parcial autoria tipada (zero/null/CAS precisa Action); AC02 negativos especificados mas F02 strict decode/Action pendentes; AC03 pins revisados, revalidation Action pendente.
- Estado atual **LEAVES_AUTHORED / AWAITING_INTEGRATOR_AND_CI**. `ARTIFACT_READY` apenas condicionado à revisão dos codecs/bytes; não há INTEGRATED, QUALIFIED, DONE, merge nem GLOBAL_RELEASE.

## Lease

Epoch `ux-native-w18-e1` com autoria entregue em leaf exclusivo. 114 é único integrador `sf2-stack`/PR65;120 tests e119 compiler. A PR#121 é intake draft; read-only até 114 integrar e revisar.
