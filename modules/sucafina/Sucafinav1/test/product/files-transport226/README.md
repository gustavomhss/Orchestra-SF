# Missão 226 — driver de produtor real (NOT_RUN)

Este driver **não** constrói usuário, grant, Request, bytes, arquivo,
provider ou resultado. A função `runSfFilesRealMatrix` exige o transporte
F02 instalado em uma sessão autenticamente aprovada e sete casos capturados
do **produto original**, com o oráculo de resultado da autoridade vigente.
Não executar contra produção nem usar fixture inventada.

Inputs mínimos para prova 223:
- descriptor e owner principalRef atuais, `ctx.context` original confirmado,
  operações `files.*` em estado `ready`, accessRevision/policyVersion
  correspondentes à mesma instalação
- seleção admitida/versão/incarnation do import real ou asset real; arquivo
  legítimo e sua autorização de upload/scan vinda do produtor, nunca conteúdo
  ou resultado sintéticos
- fonte original corrente e seus recortes de permissão, revogação, stale CAS,
  limite de tamanho, cancelamento AbortSignal e idempotency/outcome-unknown
- leitura do erro de provedor/HTTP e bytes somente após confirmação de
  request/grant/MIME/owner; nenhum uso de URL/path/header fornecido pela UI

Critérios: `allowed` precisa de resposta tipada verdadeira; `denied`,
`revoked`, `stale`, `oversize`, `cancelled` e `retry` preservam seu
estado **real**; o driver compara sem substituir envelopes nem autorizar
mutação. O resultado do driver não equivale a validação E2E sem captura de
logs, seletores, entradas, revisões e consumo por 223.
