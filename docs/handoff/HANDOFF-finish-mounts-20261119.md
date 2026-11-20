# Handoff — finish-mounts-20261119

SHA: f0652fd2a37c440349eaa102f806a1301edc22b6 (código qualificado; este handoff é o commit documental seguinte)
Data: 2026-11-19
Estado: complete (montagem HTTP nativa e fronteira M79)

## Feito

- `test/product/operations-functional-closure/mount-boundary.test.ts`: inicializa o grafo original com o mesmo SQLite e as mesmas sessões de operador da instalação. CAP23 é decodificado pelo schema oficial; o comando original cria uma versão e o catálogo autorizado de importação deve retornar essa mesma identidade, nome e formatos. Descoberta de documentos continua exigindo o resultado exato esperado para uma instalação sem anexos.
- Mantidas as negativas de sessão ausente, papel viewer sem mutação humana, seletor não emitido, sessão revogada e upload sem scanner. A última conserva o snapshot integral antes/depois e o erro exato do scanner.
- `test/product/installed-post-cause/probe.test.ts`: mantém o listener Node/Effect original, o POST de 77 bytes enviado uma vez, ausência de timeout, resposta 200/ok, exatamente uma versão e dois registros de auditoria no SQLite. As leituras anterior/posterior agora usam CAP23; os IDs retornados devem coincidir com os IDs físicos persistidos.
- O controle mínimo M79 de 28 bytes permanece intacto. Nenhum browser é aberto; o listener HTTP local original na porta 4110 não é navegação de E2E.
- `operations-support/installation.ts` copiado sem alteração do WP5, branch `finish-operations-20261119` @ `a910756151609a539f0fa3c76de062615e911490`, blob `c70a97e1d24d77fe2e7aa49f211f0e37010f79db`.
- `wp04/host.ts` copiado sem alteração do mesmo SHA, blob `5232f82e8344621805dc7d631a8b849550149333`. É o caller compartilhado obrigatório da nova assinatura async: sem ele a integração manteria argumentos síncronos e um dispose inexistente. Não foram importadas mudanças de UI ou dos specs E2E.
- Gate Actions [44583932001](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44583932001): **success**, 7 pass / 0 fail / 85 expect, dois arquivos em 7,41 s. Job de teste `135771659309` e cleanup `135773543903`: success.

## Pendente

- `packages/app-shell/e2e/sucafina/wp04/host.ts:104`: montagem copiada e exercitada indiretamente pela factory no gate Bun; o processo completo Playwright e as jornadas Operations continuam sob o gate do WP5. Esta fatia não os declara qualificados.
- `packages/app-shell/e2e/sucafina/wp04/host.ts:42`: typecheck SF E2E não executado neste gate Bun (etapa skipped). O gate Playwright da integração deve validar o caller completo.
- `modules/sucafina/Sucafinav1/test/product/wp08/thread-period-continuity.test.ts:14`: os dois casos de continuidade temporal permanecem pendentes em outra fatia; último diagnóstico `44581002299` resultou em 1 pass / 2 timeouts / 55 expect. Nenhum timeout ou contrato foi alterado aqui.

## Decisões e justificativas

- Asserções HTML substituídas: “Create first version”, ausência desse texto após salvar, `data-import-workbench` e `data-document-workbench`. Esses elementos pertencem ao console descomissionado. A cobertura positiva foi transferida para os produtores reais CAP23/import-targets/document-sources, com gravação e releitura autorizadas, e os GETs HTML continuam exigindo 404 com o corpo exato do descomissionamento.
- Nenhuma asserção de negócio ou segurança foi apagada, pulada ou afrouxada; nenhum timeout foi aumentado.
- A nova montagem usa `microsoftNativeHost` já integrado, com origem local vinda da discovery real, grafo original, identidade produzida pelo host e caminhos privados. O nome do helper não transforma o operador local em Microsoft.
- A factory mantém os grants explícitos originais de Operations separados dos papéis humanos. Nenhum context stamp, projeção, recibo ou autorização foi fabricado.
- Não houve edição de `runtime/application.ts`, workflows, suites, baseline, coverage ou receipts; `.ci-run.json` existe apenas no snapshot descartável de verificação. Isto é inventário da alteração, não resultado de guards.

## Como retomar

1. Integrar esta branch em `sf-join-four`; a base desta fatia é `ab9c515abee460c294bd061c99f41dbd0064fdf6`.
2. Para reproduzir somente esta fronteira, criar snapshot atômico do SHA de código com o pedido abaixo e uma branch `ci-run-linux-...`.
3. WP5 prossegue com o gate Playwright de Operations sobre a factory e o caller já integrados. Root coordena typecheck, guards e a futura verificação agregada de unidades.
4. Não repetir sf-ci completo por causa desta fatia. Este handoff não declara GO.

## Comandos e resultados

Pedido change-scoped:

```json
{"package":"sucafina","runner":"bun","args":["Sucafinav1/test/product/operations-functional-closure/mount-boundary.test.ts","Sucafinav1/test/product/installed-post-cause/probe.test.ts"]}
```

- Snapshot CI: `7b33d84fe1d7cf0f32bcb2cea1c1644903671d0e`, parent de código `f0652fd2a37c440349eaa102f806a1301edc22b6`.
- Branch descartável: `ci-run-linux-mounts-20261119`; cleanup success.
- Run `44583932001`: completed/success; 7 pass / 0 fail / 85 expect.
- M79 observado: corpo de 77 bytes; mutationCount 1; POST 200 em 24 ms; GETs nativos 200; versions 1; auditCount 2; IDs nativos iguais aos físicos.
- `bun typecheck` (app-shell) / typecheck SF E2E: não rodados por esta fatia.
- `bun run check:guards --base origin/dev`: não rodado por esta fatia.
- Nenhuma execução local, shell ou máquina do dono.
