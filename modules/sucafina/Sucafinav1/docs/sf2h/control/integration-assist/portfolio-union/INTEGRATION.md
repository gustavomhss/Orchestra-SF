# Instrução de integração — somente sessão14

## Pré-condições de autoridade e conteúdo

1. Consumir o commit de payload indicado no HANDOFF e esta única PR contra sf2-control. Conferir o namespace documental. Não mesclar nem cherry-pickar o commit documental inteiro no produto.
2. Fixar o head/tree atual de sf2-stack como C0 e registrar o lease da sessão14. Ler o handoff/intake mais recente de Finance; esta proposta não assume sua escrita.
3. Comparar cada preimage de patch-manifest.json com C0. Os 31 held e o suplemento handoff-c08 foram reconferidos em d8ab1d3321a76870ed3092ba043fe1b5781a2c23; os dois destinos novos estavam ausentes. Se qualquer blob divergir, interromper apenas aquele intake e reconciliar seus hunks com o owner. Não sobrescrever o arquivo divergente pelo postimage nem escolher uma versão pela data.
4. Reconferir especialmente planner-sensitivity.ts, verification.ts e threshold-proof.ts no head Finance atual e no candidato. Os três coincidiam com o bundle e com Finance W2 no último refresh. Conferir também as dependências KEEP_CURRENT: sensitivity.ts certificado, sensitivity-v6 null guards, stores e handoff. A versão de sensitivity.ts que emite known-components no evaluator não substitui o blob admitido `247a0cdc456f386475f53765e6da2e1db156eba8`.
5. Finance W2 tem intake separado: sensitivity-units.ts d2ae9e7b→29ef0758 e decisions/result-store.ts 33a99c9f→23a90b2e, mais seus três testes. Os preimages do target ainda coincidiam. A sessão14 decide sua admissão pelo manifesto Finance e conserva a compatibilidade de recibos compactos; não importa snapshots herdados de finance-resume. P01 não depende de escolher a versão mais recente de qualquer outro arquivo.

## Ordem exata

| Ordem | Unidade | Regra |
| --- | --- | --- |
| 1 | P01 — [0001-sensitivity-disclosure-and-replay.patch](patches/0001-sensitivity-disclosure-and-replay.patch) | Aplicar os seis destinos como uma unidade. Finalizador e verificador devem entrar juntos com as regressões. |
| 2 | P02 — [0002-human-choice-history-and-reservations.patch](patches/0002-human-choice-history-and-reservations.patch) | Cinco testes, sem remover as expectativas admitidas. Inclui suplemento handoff-c08 já presente no bundle. |
| 3 | P03 — [0003-coverage-and-source-consumers.patch](patches/0003-coverage-and-source-consumers.patch) | Dois arquivos existentes + companion source-scenario novo. Não alterar source-scenario-fixture nem renewal-choice-fixture. |
| 4 | P04 — [0004-portfolio-contract-notes.patch](patches/0004-portfolio-contract-notes.patch) | Somente documentação de contrato no README de portfolio. |

Os patches usam paths desde a raiz do repositório. As imagens completas são referência para inspeção e hash; a operação semântica são os hunks declarados. Em preimage exato, o resultado deve ter exatamente o postimage Git blob registrado. Arquivo já igual ao postimage é aplicação idempotente; registrar e não duplicar hunks. Destino novo já existente com outro blob exige reconciliação, nunca overwrite silencioso.

Os 19 KEEP_CURRENT não geram escrita. Seus postimages completos servem para documentar o estado preservado. As três entradas adicionais fora do held são handoff-c08-integration.test.ts, semantic-union-source-scenario.test.ts e sensitivity-disclosure.test.ts; todas estão no manifesto de patches. Nenhum outro path de produto é autorizado por esta entrega.

## Commit do candidato e dispatcher

Depois de compor todos os owners e estes patches, a sessão14 registra o novo commit e tree C, os blobs finais, o source/input digest e qualquer reconciliação adicional. Só esse C é o W de produto para o dispatcher. O SHA da PR documental jamais é candidato de execução de produto.

Materializar as seleções de dispatcher/selection.json no mecanismo já existente, conservando configurações, fixtures, timeouts e oráculos. U01 é o discriminante curto antes das seleções caras. U02 conserva as fronteiras de retry e autoridade; U03 a prova C10/limiar e formas históricas; U04 os dois históricos C08 e reconciliação; U05 a reserva/recibo; U06 o restart real. U07 cobre consumidores WP05/WP10/WP12 e não equivale sozinho a AM/C17 instalado.

Nenhum request de CI foi criado nesta preparação. O dispatcher preenche o commit/tree efetivamente aplicado, faz dedupe por C/seleção/config/fixtures e anexa seus run/job/receipt. No protocolo de spawn dos testes existentes, manter expectSpawn e o runner correspondente; não ajustar o teste ou aumentar prazo para obter verde.

Se houver FAIL, registrar a mesma assertion e a fase sob o orçamento original. FIN-IND-005 já possui S3 FAIL na guarda 180000 na fonte Finance; a repetição dessa jornada exige novo delta causal comprovado pelo owner, não uma troca de chat ou a publicação desta documentação. As provas curtas da fonte não são herdadas como PASS da composição.

## Saída exigida da integração

Registrar por arquivo: preimage observado, patch/unidade aplicado, postimage observado e commit C. Registrar por seleção: identidade exata, resultado, assertions executadas, timeouts e limitações. Conservar open-findings.json e os mandatos integrais de criteria-map.json; NOT_RUN, HOLD e diagnósticos estáticos não viram PASS. Não declarar WP13 DONE nem GLOBAL_RELEASE por esta preparação.
