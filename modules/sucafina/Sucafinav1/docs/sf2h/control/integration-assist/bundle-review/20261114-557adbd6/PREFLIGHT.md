# Pré-conferência independente — árvore inicial

Data de observação: 2026-11-14 19:43:54 UTC. Missão 17, pack S3-R3. Ausência de autoria do produto declarada em `CLAIM.json`.

## Pins e estado

- Instrução fixa: `557adbd63f5700f487447cbb6167fe7c71e9bcdb`.
- Plano fixo: `dbf9547211d9b0fade619790de7c19c0869b7c7d`.
- Stack observado: `6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0`; tree `acf3b722ad55c090bef8e9dc2b3fac2d9ad570af`.
- Nenhum incremento novo do integrador foi observado até esta pré-conferência. Este registro não chama a base de candidato final C nem infere inatividade da sessão 14.
- Branch documental aceita no head `557adbd63f5700f487447cbb6167fe7c71e9bcdb`, base `sf2-control`. Escrita exclusiva neste namespace.
- Remoto exclusivamente por GitHub MCP; sem testes, dispatch, rerun, merge ou alteração do produto.

## Ancestralidade e disposição inicial

`source-ancestry.json` fixa as 42 PRs 20–61 da missão, seus heads observados e merge-bases. As 39 fontes de produto descendem do stack inicial. As três revisões 49/50/51 divergem pela baseline `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf` e são somente evidência. `sf2-control@557adbd6` também diverge (25 commits próprios e 56 do stack desde a base comum): não pode ser mergeado ou usado como snapshot de CI.

Nove heads diferem do pacote de instrução. Ambos os pins são preservados; head novo não recebe automaticamente aceite de consumo. Não confundir a ancestralidade com a preservação de todos os blobs de uma fonte, nem o total `changed_files` com a lista completa.

## Checklist de composição

1. Identificar cada incremento por commit **e tree**; duas referências com a mesma tree não geram revisão duplicada.
2. Exigir recibo do integrador com fonte/owner/lease, path, preimage e postimage, seleção ou reconciliação e consumidor. Distinguir fonte admitida, proposta inerte, delta em andamento e pendência externa.
3. Inventariar a árvore Git completa por subárvores não truncadas, com tipo, modo e blob. Comparar adições, alterações, deleções, renames e substituições de tipo; não usar as primeiras 300 linhas do compare como total.
4. Para cada path admitido, conferir source SHA/blob → commit integrado/postimage → import/export/consumer. Blob diferente exige explicação de reconciliação e recheck de fronteira; presença isolada não é integração.
5. Transportar com a implementação seus testes, fixtures, assets, config, manifests, prompts, skills e guias. Preservar os inputs arquivados como evidência inerte; não executá-los nem copiá-los sobre fontes atuais.
6. Priorizar recibo exato de ACK no produtor e no consumidor, fences de acesso/incarnation/generation, Memory preflight, proteção de namespace, fontes de cálculo e exports. Texto/autor não substitui identidade do recibo.
7. Deduplicar snapshots herdados e versões repetidas sem descartar uma contribuição própria. Comparar fontes por ownership e merge-base, nunca aceitar a árvore inteira da PR mais nova por ser maior.
8. Confrontar Azure/deploy/identidade/engines, guards/allowlists e controle com a base autorizada. Diferença exige disposição explícita do owner; esta revisão não autoriza ignores.
9. Conservar W/S, requests, runs/jobs, seleção, env/config/fixtures e limites dos resultados anteriores. Guard PASS e typecheck skipped não fecham jornada. Nenhum PASS de componente é transplantado ao stack.
10. Emitir findings por SHA/path/fonte/critério/evidência/owner/recheck. O auditor não corrige o defeito. As três aprovações finais, oito seleções mínimas e adicionais, AM01–AM06, C/G7 e D/G8 permanecem obrigatórios.

## Próxima saída

Manifestos completos de retenção/diferença/omissão e parecer por árvore efetivamente examinada, com handoff à sessão 14 e S0 via estes arquivos e descrição da única PR. Nenhum polling vazio, nova sessão ou watchdog.
