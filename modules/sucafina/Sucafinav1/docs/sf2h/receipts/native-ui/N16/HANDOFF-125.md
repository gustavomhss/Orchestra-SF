# N16 → 125: terminal handoff de autoria

**ARTIFACT_READY, integração não autorizada a N16.** Origem `526e7204b310756e552196bbf3d64037dbbf047c`, postimage HEAD `7ac5d020914ddeb73b6c3071f79b792490616ae9`; owner/epoch `ux-native-n16-e1`.

Entrega: U28 `SfLocalAdministrationView` (UI69), U30 `SfRisksView` e `SfStakeholdersView` (CAP13/15), U31 `SfPerformanceView` (CAP16), 3 folhas i18n EN/BR, CSS, 3 specs hosted, além de drafts/reviews em folhas exclusivas. A01 typed client e F01 atual, sem stubs/POST paralelo.

- Importar 14 paths autorais listados em `SOURCE-POSTIMAGES-e1.json`, preservando SHAs e preimage ausente no HEAD inicial.
- Aplicar **apenas após revalidar preimage/CAS** o patch global `PATCH-orchestra-i18n-125.diff` ou reconciliar com mudanças de outros autores; registrar quatro bindings estáticos do `PATCH-125.md`.
- Dependências de runtime F01/F02/F03/S01/S03/A01/I00 precisam mesmo candidate C; enquanto ausentes, `unavailable`, não UI falsa.
- 120: `TEST_REQUEST-120.json` para hosted E2E após 125. 119: `COMPILER_REQUEST-119.json` para compiler/guardas após 125.
- Critérios U28/U30/U31 em `EVIDENCE-e1.md`, todos `NOT_RUN` quanto a teste real; ressalvas de dados não publicados pelo produtor.
- A diferença PR vs sf2-stack inclui material herdado, não autoria N16. **NÃO MERGE DIRETO**, seleção controlada dos commits/paths. Nenhuma alteração em protected_paths/compartilhados por N16.
- Sem testes locais, resets, force, branch estrangeira, deploy, merge dev ou reativação da Goal. PR para revisão, sem autorização para release.

PR N16: verificar lista de PR abertas após publicação do receipt; 125 recebe links e objetos remotos da mesma branch.
