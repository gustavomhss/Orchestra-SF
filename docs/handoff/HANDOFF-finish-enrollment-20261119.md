# Handoff — finish-enrollment-20261119

SHA de código: a55a65a077a9200eb15109f8894f9ca9ca871962
Data: 2026-11-19
Estado: partial

## Feito
- `modules/sucafina/Sucafinav1/test/operator-browser.test.ts`: o mesmo Chrome real abre o artefato privado de enrollment; observa o GET original 303, redirect para /, no-store e cookie original HttpOnly/SameSite/Path.
- A configuração e o navegador usam a origem pública http://localhost:3000. O runtime protegido não foi editado.
- A prova positiva de autorização usa o GET original dashboard?download=json: antes do enrollment retorna o 303 original para auth/login com returnTo exato e no-store, observado com maxRedirects:0; depois retorna 200 com o arquivo JSON original, headers e igualdade integral com publicSfData do snapshot autoritativo.
- Os três consoles e todas as páginas de seus registries são navegados pelo browser e devem devolver 404 e o corpo exato de descomissionamento. Preservados screenshots, ausência de erro de página e ausência da mensagem de falha Microsoft.
- Fontes conferidas: runtime/operator-identity.ts (enrollment/location/cookie), runtime/application.ts:58–95 e :524–635 (404 e autorização do download), runtime/downloads.ts:18–33 (nome/MIME/conteúdo JSON).

## Pendente
- `modules/sucafina/Sucafinav1/test/operator-browser.test.ts:13`: gate1 falhou no novo probe anônimo por seguir o redirect automaticamente; corrigido conforme local/entry.ts:351–355, gate2 pendente. Não prova a renderização do capítulo; esta pertence aos specs app-shell.
- `modules/sucafina/Sucafinav1/test/local-controls-browser.test.ts:24`: fluxo de backup/notificações ainda usa fixture e navegação legada; não incluído neste branch.

## Decisões e justificativas
- Asserções removidas: body[data-surface], #content contendo Homologação local, sidebar/ordem dos links e seus HTML200 (linhas29–51 do arquivo anterior). O produtor não publica mais esse HTML: seu contrato deliberado é 404. A cobertura de cada rota foi preservada com status/corpo exatos; nenhuma asserção financeira, CAS ou mutação foi eliminada.
- Esta é a exceção explícita do briefing para dado/controle que o produtor não carrega. Não restaura console e não troca o contrato por check vazio.
- O redirect / é o original do enrollment. A instalação modular pode devolver o frame estático da raiz (local/entry.ts:283–286); este teste não declara qualificação do capítulo por esse frame. A sessão é demonstrada pelo download original autorizado e comparado integralmente.
- O capítulo/owner e o catálogo têm provas separadas: 44607176525 SUCCESS (2 testes F01) e 44612205026 SUCCESS (2 testes/2277 expect); não são gates deste commit.
- Timeout original de 60000ms, lançamento Chrome, isolamento e cleanup preservados.

## Como retomar
1. Partir de finish-enrollment-20261119, código 6eddfd0219ac8f92691aab67fe08ad805c4836a7.
2. Criar snapshot ci-run-linux-enrollment-20261119 com package sucafina, runner bun e args ["Sucafinav1/test/operator-browser.test.ts"].
3. Registrar run terminal e causa exata se falhar; só integrar após prova do arquivo. Não executar sf-ci antes do gate final único.

## Comandos e resultados
- `bun run typecheck`: não executado neste checkpoint.
- `bun run check:guards --base origin/dev`: não executado neste checkpoint.
- `bun test Sucafinav1/test/operator-browser.test.ts` via test-ci: pendente.
- Nenhum GO declarado. Nenhuma baseline/coverage/digest fabricada.

- Gate1 [44621735409](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44621735409): FAILURE, 0 pass/1 fail; snapshot43157ccec8aefc6a0c25a3f458471d4f619e1249. Probe anônimo seguia o 303 do wrapper até a página Signed out200. Fonte original local/entry.ts:351–355 confirma 303+returnTo; teste agora observa esse redirect sem seguir. Cleanup135906373407 SUCCESS; runtime permanece intacto.
