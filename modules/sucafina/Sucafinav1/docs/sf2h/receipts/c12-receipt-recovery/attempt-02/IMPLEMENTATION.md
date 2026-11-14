# C12 — checkpoint de correção dos testes, tentativa 02

Status ao commit: **TEST SUPPORT CORRECTED / HOSTED REVALIDATION NOT YET RUN**.

O produto de W1 `3f333173780756a42b90b5e1c6dd99de2c5fe40f` permanece byte a byte idêntico. O primeiro run `43635717762` falhou: 16 pass, 3 fail, 373 expectativas, 183,36 s. Seu resultado foi preservado em `../attempt-01/TESTS.json` e `TESTS.log`; não foi reclassificado como PASS.

## Correções exclusivas dos testes C12

- `partial.ts`: a fixture usava `sf_context_read`, operação inexistente. Agora usa `sf_case_read` com caseRef canônico, lê o caso com autoridade real e confere sua versão antes de emitir a fonte Planner. Inclui no caso exatamente a evidence emitida pelo issuer real, satisfazendo a cobertura de fontes do PreparedChange estrangeiro. Não modifica grants, autoridade, fixture compartilhada ou produto.
- `recovery-ui.test.ts`: os corpos das respostas 200 eram consultados por CDP depois de o script real iniciar reload. Um relay de uso único por recuperação agora executa `route.fetch({ maxRetries: 0 })`, captura status/JSON reais antes da entrega e encaminha o mesmo APIResponse via `route.fulfill({ response })`, sem substituir corpo, status ou cabeçalhos. O browser recebe a resposta real, tem seu status conferido e realiza o reload normal. A perda de resposta de Apply continua usando abort após o request real terminar.

Todas as asserções anteriores são mantidas. A captura cobre a primeira recuperação canônica, sua repetição e a recuperação da resposta 200 perdida; a primeira também tinha a mesma corrida latente embora tivesse passado antes da falha tardia. Nenhum recibo, digest ou sucesso foi fabricado.

## Seleção afetada e deduplicação

Reexecutar no Actions somente:

1. `./Sucafinav1/test/product/c12-receipt-recovery/recovery-http.test.ts`
2. `./Sucafinav1/test/product/c12-receipt-recovery/recovery-ui.test.ts`

A seleção tem sete cenários e cobre os três que falharam. O helper parcial é importado apenas pelo teste HTTP selecionado. A fixture C12 comum, o consumer, os quatro arquivos de produto e todas as configurações permanecem iguais a W1.

Os dois testes `normal-retry.test.ts` e os dez testes OPS-REV-02/WP04 passaram individualmente no primeiro run, que terminou FAIL. Não serão repetidos sem alteração em sua cadeia de entradas. A evidência combinada deve registrar essa reutilização por identidade, sem apresentar o primeiro run como verde nem inventar uma execução única dos dezenove cenários no novo SHA.

Typecheck Sucafina, typecheck CLI e guards serão executados no novo checkpoint por Actions, após a seleção afetada terminar. Não houve teste local, epic/full suite ou restart do Orchestra.
