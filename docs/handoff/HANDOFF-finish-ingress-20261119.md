# Handoff — finish-ingress-20261119

SHA: 88c06fcee93719f8d4758db35a46328112c38bda (código desta rodada)
Data: 2026-11-19T16:14:00Z
Estado: partial

## Feito
- Configuração explícita de origem pública da instalação: `apps/cli/src/commands/{commands.ts,handlers/serve.ts}`, `modules/sucafina/Sucafinav1/{local/prepare.ts,runtime/local-configuration.ts}`. O default normal continua `http://localhost:4110`; a configuração local admite apenas uma origem HTTP loopback canônica. A opção CLI `--public-origin` requer uma instalação explícita.
- Proxy real e seleção same-origin no navegador instalado: `apps/web/vite.config.ts`, `packages/app-shell/e2e/playwright.production.config.ts`. Somente a execução SF configura o upstream de fixture; caminhos, Host, Origin, cookies e respostas são preservados. O navegador usa o shell configurado em :3000.
- Fixtures WP03 e Reports passam a usar a origem pública real configurada. O parser de cookie mantém a política de sessão e usa o hostname de onde o cookie foi realmente emitido. O cookie não é transformado em uma concessão de acesso.
- `packages/app-shell/e2e/sucafina/installed-shell.ts` usa a senha emitida pelo Daemon privado da própria instalação, lê discovery e contexto reais, confere o stamp/principal e seleciona servidor e diretório pelos controles existentes do shell. Não cria estado de autoridade nem registros de localStorage.
- Prova estreita adicionada em `packages/app-shell/e2e/sucafina/wp03/native-ingress.spec.ts`: alcançar CAP23 e recarregar a mesma página, além de conferir a identidade retornada pelo contexto real.
- Infraestrutura de compilação já integrada pelo root em `0a3c05fbc4175f9514a12036d43ff1e5cca51d56` incluída como parent explícito. O próximo gate executa esse check antes do navegador.

## Pendente
- Prova de ingresso — `packages/app-shell/e2e/sucafina/wp03/native-ingress.spec.ts:6` — run 44563472283 em execução; nenhum resultado de sucesso desta implementação foi observado.
- Seleção do primeiro servidor/projeto — `packages/app-shell/e2e/sucafina/installed-shell.ts:49` — os controles estão conferidos no código; o gate ainda precisa atravessá-los.
- Demais callsites WP03/Dashboard/BI — `packages/app-shell/e2e/sucafina/wp03/planner-mounted.spec.ts:25`, `dashboard-installed/confirmation-access.spec.ts:29`, `dashboard-installed/records-signals-history.spec.ts:25`, `bi-installed/installed-planner-ingress.spec.ts:77` — trocar a mera cópia do cookie pelo novo `installation.signIn(page)` e fechar o comportamento nativo depois da prova de ingresso.
- Queries de família na seleção nativa — `packages/app-shell/src/orchestra/chapters/sucafina/host/owner-runtime231.tsx:452` — o parser inicial exige somente o triplet; queries year/month dos capítulos requerem admissão de sintaxe da família antes de extrair o owner. Ainda não alterado nesta rodada.

## Decisões e justificativas
- Asserções removidas: nenhuma. Nenhum skip, aumento de timeout, baseline, coverage, digest ou declaração de GO foi adicionado.
- O primeiro gate falhou antes da interface: o runner fornece regexes com separadores `[\\/]`, e a detecção inicial de SF não ativava o proxy. A segunda revisão normaliza os argumentos conforme o seletor WP04 existente e expõe o content-type inesperado no diagnóstico de readiness.
- Não foi alterado `runtime/application.ts`, não foi reconstruído o console descomissionado e não foi apontado o navegador para :4110.
- Controles que não existem: os controles legados restantes nos WPs2/3 continuam sujeitos aos handoffs anteriores; este pacote estabelece a ligação autêntica para poder verificar e migrar esses fluxos.
- A nova instrução do dono autoriza continuar corrigindo causas e executar novos gates até fechar o trabalho. O limite anterior de uma verificação/20 minutos não interrompe esta rodada.

## Como retomar
1. Partir de `finish-ingress-20261119`; código em `88c06fcee93719f8d4758db35a46328112c38bda`.
2. Ler o resultado e os logs do run [44563472283](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44563472283). Corrigir a primeira falha observada, sem alterar a asserção de CAP23/reload nem seu timeout.
3. Novo gate: criar commit com `.ci-run.json` parent do código e só então criar `ci-run-linux-<nome>`, evitando o disparo vazio. JSON: `{"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/wp03/native-ingress.spec.ts"]}`.
4. Depois da prova, migrar os callsites para `signIn(page)` e executar os specs próprios. Reports e WP10 ficam com o root; Operations fica com WP5. Não sobrescrever arquivos desses agentes.
5. Entregar ao root para integração apenas com os resultados reais; nenhum merge na integração foi feito por este agente.

## Comandos e resultados
- `bun typecheck` (app-shell): não executado nesta branch. A infraestrutura anterior passou `typecheck:sf-e2e` no run 44561871689, sem qualificar as mudanças de ingresso.
- `bun run check:guards --base origin/dev`: não executado nesta rodada.
- `bun run test:ci` equivalente, via test-ci [44562317697](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44562317697), código `93fcfca58a33cb848822e67f8c23156a729af7d1`, config commit `f9c4f81f602d6a4b4a5c47554f532f25aebf92e6`: **failure, 1 failed**. Readiness recebeu `not-listening`; timeout original de 60s do novo spec. A detecção de SF não reconhecia os separadores do seletor.
- `bun run test:ci` equivalente, via test-ci [44563472283](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44563472283), código `88c06fcee93719f8d4758db35a46328112c38bda`, config commit `e30889e94f88c242553a574ffa8b6213699a4386`: **in_progress**, sem conclusão observada.
