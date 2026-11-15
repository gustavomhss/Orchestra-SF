# Missão52 — diagnóstico18 histórico, sem aceitação nominal

**D18 concluiu4PASS/1FAIL, incluindo as nove etapas deJ1. Estes resultados são diagnósticos e acrescentam zero fragmentos de aceitação. Source52 permaneceACTIVE.**

## Material e execução

- BaseC53+terminal105: `eeff9b78219b5efe1ad78e68d4490af0d7c5ed07`, tree `072950bafdc50b9eddc549f7a327742bc5086bf6`.
- Parent limpoW17/P13: `2624fe74b31cb5613f9c8546961e7a393f06ab9e`, tree `73ef254b9b9e75f8a9a3db900684b0b756f080b3`.
- W diagnóstico: `03e5439ab1c935ece5b58c90101750495416a341`, tree `c36a60094e43742170ee14c2705f3e30a9d2e5e0`.
- S: `17cd5a0747a32d0ce5ce7efe3edbd565f1c55b15`, tree `135178fa94d68bb8086db0a310b427478d874bd8`.
- Run `43688075463`; testjob `132732645584` failure; cleanup `132733863034` success; attempt1.
- Artefato `14151645954`,385258bytes,11arquivos, SHA256 `165737802c6c0300577d3892a4c2efc1e366ad2d135180093b73f28279d81811`.

O source de composição foi4a6;43a foi o checkpoint publicado observado ao despacho. Esse vínculo histórico permanece. O request original3619f1fd selecionou as cinco identidades na mesma configuração de produção. Budgets:180000ms/caso,10000ms na UI,worker1,repeat1,retries0. A listagem de seleção mostra cinco itens sem execução; o runtime real registra zero skips.

## Cinco resultados observados

| Jornada | Runtime | Escopo |
|---|---|---|
| J1 | PASS;98.450ms | Nove etapas completas. Três comparações200/ok e regra200/ok; escolha original200 capturada e perdida deliberadamente; retry explícito após reload; histórico completo preservado após alteração real da fonte. |
| J2 financeiro | FAIL;14.598ms | Requests503/form0 antes de mutação. Proposta,aprovação formal,MI07/M31,Apply e recuperação não alcançados. |
| J3 | PASS;10.580ms | Criar,editar,reabrir o mesmo caso pela UI. |
| J4 | PASS;7.020ms | Catálogo real de alternativas para o caso vazio. |
| J5 | PASS;7.524ms | Recuperar criação incerta por leitura, sem reenviar criação. |

NoJ1, o helper preservado lê a resposta original da escolha e exige200/JSON/statusok/casev5 antes de causar `ConnectionReset`. O log de rede registra a falha deliberada e a resposta200 do retry; a prova do primeiro200 é a assertion executada no corpo aprovado, não um evento de rede inventado. Exatamente dois POSTs usam a mesma intenção, corpo e chave; um único ChoiceRecord permanece.

A alteração Planner2400→3600USD foi salva e reaberta através da UI. Depois, Workbench encontra exatamente o mesmo caso; a igualdade do registro inteiro preserva o subtotal histórico2400USD, diferença1200USD, totalnull, comparação condicionada e nove categorias pending. Não houve terceira mutação de escolha. Essa escolha contém zero operações/assumptions; Prepare continua desabilitado e nenhum Apply é oferecido.

## Instrumentação e restauração

Sete paths estão arquivados com pre/post completos e patch: helper novo `runtime/sf52-profile.ts`, wrappers de `decision-case-http.ts` e `portfolio-http.ts`, LocalStore, state-provider, canonical e mutations. O preimage do helper é explicitamente ausente; os outros seis têm conteúdo completo anterior. O índice de material não depende de inferir um arquivo ausente.

O patch de22133bytes foi reconstruído independentemente para frente e para trás por processamento textual. As medições registram nomes fixos, ordinais, contagens e durações agregadas. Os guards, chamadas reais, ordem e resultados/erros do produto permanecem; wrappers assíncronos e instrumentação podem afetar escalonamento/custo. Não há garantia de equivalência temporal.

**Restaurar os seis preimages e remover o helper novo antes de qualquer nominal limpo.** Este arquivo histórico não é proposta de integração da instrumentação. Não foram alterados spec,helpersUI,workflows,assertions ou budgets.

## Limites da evidência

-4PASS/1FAIL desteW instrumentado não substitui3PASS/2FAIL do nominal17, não conclui missão52 e não promove critério integral.
- Os226 fragmentos nominais e os83 registros originais continuam byte a byte intactos na matriz17; o adendo apenas vincula o histórico diagnóstico. Todos os `integrated_proofs` permanecem vazios.
- A etapa de escolha12.778ms inclui perda/reload/retry. Durações de perfil são inclusivas/sobrepostas; não somar comoCPU exclusiva nem equiparar handler a latênciaHTTP. Um sucesso não estabelece margem temporal estável nem causalidade de ganho.
- O comportamento visível de histórico foi demonstrado. EsteE2E não exportou o conteúdo interno de outbox/capture para provar todas as invariantes atômicas; Unit05 é evidência suplementar separada.
- Recarregar o navegador não é reiniciar processo/provider/native. Um operador não prova colaboração, revogação ou aceitação residente/nativa.
- A indisponibilidade503 financeira não identifica sozinha qual precondição de admissão falhou. Escolha humana não é aprovação formal; nenhuma política foi alterada.
- Não há terminal52, escrita no target, GLOBAL_RELEASE ou WP11DONE. Integrador105 continua encerrado sem sucessor nomeado neste corte.

O recibo raiz, revisões, perfis e manifestos são cópias históricas com hashes. Este arquivo foi preparado apenas por leitura e processamento textual, sem produto/testes/operações remotas.
