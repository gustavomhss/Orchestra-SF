# P8 — composição C35 e nominal11

Estado: **3 PASS / 2 FAIL**, sem skips ou retries. A fonte52 permanece ACTIVE; este pacote preserva evidência intermediária e propostas completas, sem release global.

Fonte própria `56239d138ed4ae7cac9ac6b01e68a3ee78d1bf4f`; base integrada C35 `e87e22d163924635bf0b41785c9bc80bf780ac0a`; W `fb9ed54674e7792008e8d1bd7425adc7effe8c09`; S `f0b9c4c92c74072b86484fcbdd0f8aff1d990f05`; run `43672508561`.

P8 acrescenta somente dois fixes próprios ao harness: a espera da resposta original termina em falha anterior à interceptação; o encerramento da instalação também é aguardado pelo afterEach. Assertions, cinco títulos, ações UI e budget180000ms por teste permanecem. O spec e o caller da escolha não mudaram.

## Resultado individual

| Identidade no spec | Resultado | Duração | Limite observado |
|---|---|---:|---|
| J1, linha12, evidências/alternativas/comparação/regra/escolha/histórico | FAIL |81376ms|Escolha200, recuperação do mesmo intento e histórico durável passaram. Após mudar a fonte real2400→3600, Workbench200 mostrou No accessible decisions; linkesperado1/observado0. Igualdade do histórico depois da alteração ainda não provada.|
| J2, linha21, jornada financeira obrigatória | FAIL |14554ms|GET Requests503 e formulário0 antes de qualquer mutação financeira. M31/MI07 permanecem holds contratuais independentes.|
| J3, linha35, criar/editar/reabrir | PASS |10207ms|Mesmo caso durável, revisão humana e reabertura verificadas.|
| J4, linha87, catálogo real | PASS |7037ms|Resposta de domínio JSON e catálogo do caso correto; HTML200 não aceito.|
| J5, linha135, criação incerta | PASS |7426ms|Resposta real perdida e caso recuperado por leitura, com uma única submissão de criação.|

Os cinco anexos de observações e CLI existem; nenhum EADDRINUSE. O nominal10 permanece registrado separadamente:0PASS/5FAIL, J1timeout e quatro setups bloqueados, sem logs de rede/CLI. Não se infere sua causa HTTP a partir do nominal11.

## Composição e custódia

O patch canônico contém25deltas:10 próprios,14 propostas compartilhadas e1 proposta unitária. Os9 arquivos Runtime59 estão integrados emC29 e ficam como dependência conferida, sem overlay. Os três hunks52 de host-context foram recompostos sobre Native64, preservando seus seis hunks. C33/C12-65, C34/export66 e C35/Workbench68 permanecem integrais. Todos25postimages/modos batem o W remoto; S preserva43entradas da raiz W e acrescenta apenas o sentinel3619f1fd8b14262b0c89ee9830269f2b05356aaf.

Os arquivos compartilhados e o teste que importa o helper compartilhado permanecem propostas inertes na fonte52. Preimages/postimages completos terminam em.txt. Nenhum path Reports48, Procurement/C12 ou CurrentChoice foi modificado pela52; nenhum workflow foi editado. A47 é o destinatário solicitado do handoff; o ACK71 observado identifica a custódia atual do target, sem transferência de autoridade de escrita à52.

Próximo defeito concreto: produzir e ler a captura protegida das fontes da escolha, preservando as provas atuais de acesso e continuidade. Nenhuma mudança de política ou aprovação financeira está autorizada por este resultado.
