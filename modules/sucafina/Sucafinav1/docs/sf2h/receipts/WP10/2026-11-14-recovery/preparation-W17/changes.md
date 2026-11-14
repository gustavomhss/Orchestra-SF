# WP10 — preparação W17

W17 aplica as correções apontadas pelos três revisores independentes de W16 e consome 18 blobs publicados exatos, com pins de commit e conteúdo. Nenhum parecer de W16 é promovido a aprovação de W17.

## Correções próprias

- A reentrada de Analysis pode alcançar lifecycle após avanço legítimo da versão do caso, sob a Request e intenção humana originais. O seletor permanece na versão original; operações novas não recebem uma seleção atualizada implicitamente. O helper de produção tem contraprovas sobre C08 real, versão, participante, ACL, host, abort e encarnação.
- A seleção explícita da origem BI inclui `referenceDigest` na allowlist e no digest da intenção. A referência continua sendo resolvida e validada contra a linha real do produtor, sob as fences de saída existentes.
- As duas fixtures próprias completam seus contratos de tipos sem retirar assertions ou promover injeção de falhas a aceite nativo.

## Composição publicada

Os consumidores WP01/WP02 passam a usar a composição real de BusinessServices. Os produtores de lifecycle/rotina acrescentam proteção contra mutação de aliases e substituição de provider, com as novas contraprovas correspondentes. A auditoria preserva budgets, casos e verificadores; os testes de lifecycle são consumidos junto com suas dependências publicadas. Um delta de thread que não corrige seu diagnóstico ficou excluído.

O check W16 falhou com dois diagnósticos próprios e 36 estrangeiros únicos. A inspeção da nova onda endereça 17 estrangeiros; os 19 restantes são listados por arquivo, linha, pin e owner. A verificação de W17 ocorrerá exclusivamente no CI hospedado.

## Fronteiras de entrega

O freeze WP00 permanece exato e estrito; o novo host exige binding publicado correspondente. O adapter C07 com admissão Task real e recibos terminais ainda não está disponível. Os 171 critérios e sete tasks permanecem literais, incluindo gates nativos e globais não exercidos. Revisões independentes, mapa final e resultados hospedados serão anexados em recibos novos. Não houve testes locais de produto, alteração de branches alheias, merge ou deploy.
