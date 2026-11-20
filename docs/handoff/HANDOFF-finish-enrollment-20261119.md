# Handoff — finish-enrollment-20261119

SHA de código qualificado: a55a65a077a9200eb15109f8894f9ca9ca871962
Data: 2026-11-19
Estado: complete

## Feito
- `modules/sucafina/Sucafinav1/test/operator-browser.test.ts`: Chrome real abre o mesmo artefato privado de enrollment, observa GET303/location /, no-store e cookie original HttpOnly/SameSite/Path.
- Configuração e navegador usam http://localhost:3000. Runtime protegido intacto.
- Antes do enrollment, o GET original dashboard?download=json recebe303 para auth/login com returnTo exato, sem seguir redirects. Depois, recebe200 com nome/MIME/no-store e JSON integralmente igual a publicSfData do snapshot autoritativo.
- Os três consoles e todas as páginas de seus registries são navegados e devem devolver404 com corpo exato de descomissionamento. Screenshots e ausência de erro de página preservados.
- Gate [44622375499](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44622375499) SUCCESS: 1pass/0fail/110expect, 14.19s. Snapshotca203215f18e67ebd895584c63c9815ea2bfc976; jobs135907128956 e135908496686 SUCCESS.

## Pendente
- Nenhum item pendente dentro deste arquivo/recorte.
- Fora deste recorte: `modules/sucafina/Sucafinav1/test/local-controls-browser.test.ts:24` ainda dirige backup/notificações a partir de navegação legada; não recebe qualificação por este run.
- Guards gerais, pacote e sf-ci único dependem da integração final; não executados aqui.

## Decisões e justificativas
- Asserções removidas: body[data-surface], #content contendo Homologação local, sidebar/ordem dos links e HTML200 dessas telas (linhas29–51 anteriores). O produtor não publica esse HTML desde o descomissionamento. A navegação de cada rota permanece coberta por404/corpo exatos; nenhuma asserção financeira, CAS ou mutação foi eliminada.
- Exceção explícita do briefing para controle/dado que o produtor deixou de carregar. Não há skip, check vazio, timeout aumentado ou console recriado.
- Fontes: runtime/application.ts:58–95/524–635; runtime/downloads.ts:18–33; runtime/operator-identity.ts e local/entry.ts:351–355. O wrapper local encaminha anônimo para login antes do download; o primeiro probe esperava401 do nível interno e seguia esse redirect até200/Signed out. Corrigido para aferir o contrato externo real.
- A raiz pode fornecer frame estático de apps/web/index.html. Este teste comprova a sessão pelo produtor autenticado; não declara qualificação de capítulo pela existência desse frame.
- Timeout60000ms, lançamento Chrome, isolamento e cleanup originais preservados.

## Como retomar
1. Branch finish-enrollment-20261119, código a55a65a077a9200eb15109f8894f9ca9ca871962.
2. Reproduzir pelo test-ci com package sucafina, runner bun, args ["Sucafinav1/test/operator-browser.test.ts"], branchci-run-linux-*.
3. Continuar o backlog nativo e guards finais sem repetir este gate na ausência de mudança causal.

## Comandos e resultados
- `bun test Sucafinav1/test/operator-browser.test.ts` via GitHub Actions: 44622375499 SUCCESS, 1pass/110expect.
- Gate1 [44621735409](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44621735409): FAILURE, 0pass/1fail, snapshot43157ccec8aefc6a0c25a3f458471d4f619e1249. Probe anônimo seguia303 até Signed out200. Corrigido conforme wrapper original; cleanup135906373407 SUCCESS.
- `bun run typecheck` e `bun run check:guards --base origin/dev`: não executados neste recorte.
- Nenhum GO declarado; baseline/coverage/digest não fabricados.
