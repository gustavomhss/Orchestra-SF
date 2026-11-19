# Handoff — audit-sf-20261119

SHA: 03d2a11f3b8ffe51888601c5ad50ae0b16058dea (composição de código; o commit desta branch acrescenta somente workflow de auditoria e este handoff).
Data: 2026-11-19
Estado: partial

## Feito
- Auditoria temporária das suítes Bun admitidas pelo manifesto sf/ci/suites.json, usando script/sf-ci/gate.mjs select sem alterar exclusões, particionamento, runners ou timeouts.
- Copiados somente os jobs unit e unit-sf do workflow existente. O action original omni-binaries é resolvido diretamente, sem depender do job omni do sf-ci.
- Código composto: Reports fd7383288efcaeb33a7f085edd3961a4fc3146dc; bindings a45298af5012ef787502fddaac6373bc9bdd6b41; ingresso 7fe991b0ec6679d97bfa795eac5f45998591521f; Operations a910756151609a539f0fa3c76de062615e911490; BI 2adac1e88b980ba86abc5c42ddb5962288ed96c7; revisão fd019bf85319792bdba4d9e320e5a2960e424fd4; integração 2b37f0aabe61be42fc0bab34a33464303f968efa contém as mesmas correções dos PRs373–375.

## Pendente
- Resultados desta auditoria; os arquivos/linhas realmente falhos serão registrados após os jobs.
- Jornadas Playwright são verificadas por test-ci separadamente; ainda há gates pendentes.

## Decisões e justificativas
- O inventário antigo tinha falhas já corrigidas. Esta execução produz observação atual sem consumir o único sf-ci final.
- Nenhuma modificação de suites.json, baseline, digest, coverage ou aprovação. O GUARDRAIL_APPROVED copiado do workflow original continua vazio neste evento push.
- Esta branch é somente de verificação. Não integrar o workflow temporário em sf-join-four.
- Asserções removidas: nenhuma.

## Como retomar
Ler os jobs deste run, corrigir somente falhas demonstradas, manter gates por mudança e então concluir pacote, guards e o único sf-ci final.

## Comandos e resultados
- As seleções e comandos são os jobs originais versionados em .github/workflows/sf-ci.yml.
- Run desta auditoria: pendente.
