# HANDOFF — sf-ops-import-observed

## Checkpoint vigente após o primeiro gate desta composição

- Run44671315734 terminou **failure antes de executar testes de produto**; typecheck E2E original TS2367 em apps/cli/src/sucafina-product/native-ui/import-health.ts:31:45.
- Job136072705652 failure no typecheck; cleanup136075460011 success. Nenhum resultado de Import/Sourcing/Documents pode ser inferido.
- Causa: comparação entre as interfaces AssetPersistence e Persistence & SfScopedSourcePort declaradas sem sobreposição.
- Correção concreta: códigoc182df016a561c2ab53d01a6624f2cb11331e41f, treeff16873c116625737373760faa1121c99be28f9c; blob817f50ae7dab6c092d13f342cb0f33edc82c0c53.
- Único hunk: a mesma identidade de objetos passa a ser comparada com Object.is, sem cast, alteração de permissões, shape ou semântica de autorização.
- Shared source separado: sf-import-identity@455f64a689f000cdb4c0ed88fdcd229a4de81992, baseado em integração124d5b5, sem dependência #393.
- O novo snapshot de Operations será filho do checkpoint documental que inclui este fix; request original e todas as assertions permanecem inalterados.
- Estado ainda PARTIAL até conclusão real do novo gate. Nenhuma repetição de código idêntico e nenhuma qualificação integral antecipada.

## SHA e estado históricos
- Estado: PARTIAL / NOT_REVALIDATED. Gate original de Operations ainda não executado neste checkpoint.
- Código: a3dde87cb329cc203170f00e78dc6f766a57d941; tree 512fb0e57046e83ae9bfc9b93a2fee6a1bc9fb88.
- Parent: sf-import-native@ed8db1bd407d09c908aa90b900e7ecba258b41f7, código64d96d475b38f308bea2d468f2d1c33617002a35, base5856483ee09bcb6b3511aa2d70276dc44b3aa0e5.
- Esta composição é exclusiva para qualificação. NÃO MERGEAR A BRANCH INTEIRA: ela herda dois blobs de Files do PR #393, cujo head ainda não satisfaz a condição de checks success.

## Mudanças concretas desde o gate anterior
- Gate44662419134: 1 pass / 4 fail. PROC-01 passou; PROC-02/03 timeout; Import raiz ausente em operations-support/imports.ts:155; Documents comando desabilitado em documents.ts:93/97.
- Sourcing: slots intermediários do array serializado são preenchidos com null antes de atribuir scores, impedindo undefined incompatível com a validação JSON original (c4218a0911e10c1ca791b784dc0ded22ca7bcd75).
- Import migra para UI55 /orchestra/sf-imports/new e UI57 canônica; mantém números, seis linhas, fórmulas, digest/manifesto, CAS+1 e um único Apply. Recuperação usa o recibo original após perda deliberada de entrega.
- Shared Import: apresenta manifesto/ator/versão do recibo e corrige o callback do painel unknown para reconcile, preservando o botão externo Refresh receipt.
- Revogação separa 403 real do produtor via APIRequestContext e preflight401 real da UI; zero reference GET de navegador, zero Apply extra e DOM privado ausente. Não alega limpeza em memória.
- Observers Files/Import #431: source6732ff508922b097e5c9c42b457e3dc8dc6c65ae, gate44666552454 success26/0/182, merge295c2bdca05c2373f821d50aab5d3ee3d3fb218b. Host3f6863be244ce79dc6538564ac0c0b6b8b58e8c1 inclui também #407.
- Foram compostos exatamente os módulos asset-health/import-health, seus testes, runtime/assets, local/entry e operations-support/installation; hunks originais aplicados contra a base5856483, mantendo idleTimeout0. Nenhuma edição em runtime/application.ts.
- Observer Review #407 também preservado: review-agenda-health9a2b1a69ec2e213318d4961696f8e0ed17c57ac2 e teste e04f557d48805c2abf754015d2c3414bb8478eb9.
- Retainer original5b4c067dca7af31cdb2dd6c6b6a5005fd23be339 compõe a dependência do helper Import. Ele captura a resposta original no estágio Response e não substitui status/corpo, não repete requests e rejeita redirects/cancelamentos/cardinalidade incorreta.

## Limites da evidência
- Retainer NÃO está globalmente qualificado: o run Reports44668834875 falhou0/4, incluindo cancelamentos originais e UI48 ausente. Não relaxar as suas cercas para aceitar requisição cancelada.
- Multipart usa a Response original, sem afirmação de retenção comprovada contra eviction. Coexistência entre Fetch e page.route precisa ser demonstrada pelo gate.
- Nenhum timeout maior, skip, retry, baseline inventado, GO, deploy ou aceitação integral de UI/shards.
- O ingress desta composição usa4174, conservando3000 como origem pública; não usar o listener legado proibido.
- #392 e #237 permanecem draft; #393 continua uma dependência não integrada.

## Gate autorizado — uma execução após estes fixes
Request original:
```json
{"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/operations.spec.ts"]}
```
A raiz cria snapshot filho deste handoff em ci-run-linux-sfc-ops-import-observed, sem --grep, mudanças de assertions ou execução local. Limite de dois gates simultâneos sob controle da raiz.

## Como retomar
1. Ler conclusão, jobs, logs e artefatos do run efetivo; registrar primeira causa/file:line.
2. Em success, qualificar apenas os deltas exatos novos com handoffs correspondentes e tratar #393 separadamente pela condição do usuário.
3. Em failure, conservar esta composição como partial/unbound; nova execução apenas após correção concreta e revisada.
