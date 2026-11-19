# Handoff — finish-decisions-20261119

SHA base: 03d2a11f3b8ffe51888601c5ad50ae0b16058dea
SHA de código: 22e36e44187efe73990610cb9bc4669a4e8932dc
SHA UI33/34 qualificado: 0228987a5675ae6f46e8145f6500d3dc45658308
SHA composto qualificado: 15388053117883174329454207e60e2a878f5426
Snapshot do gate: 1297999f0411681265711176f77e2e8e3fd17daa
Data: 2026-11-19
Estado: partial

## Feito

- Checkpoint UI35, ainda não qualificado: alternatives/initial.tsx liga controls.read, forecast original, expectedVersion publicado, decision-coverage e decision-promote. Exibe os componentes originais sem calcular subtotal/total. A intenção de promoção conserva transporte, owner, geração, corpo e chave, com retry somente por clique humano; desconhecido continua bloqueado.
- UI35 compara referências opacas pela mesma função sameRouteCase que já validava a resposta, corrigindo a comparação anterior entre ID simples e ref opaco. Sources/assumptions usam seções visíveis, removendo details/summary. Mensagens de autoria têm EN/PT e as novas marcas de identidade conservam os IDs/versões do produtor.

- UI33/34 qualificadas em [44601715581](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44601715581): SUCCESS, 2 passed em2,6min, job135834570675, cleanup135838373212 SUCCESS. O snapshot conserva o ingresso e a disponibilidade originais compostos pelo integrador. Isto não qualifica UI35/38/C12.
- O editor substitui o array readonly criteria com map ao alterar uma descrição, preservando IDs/required e sem cast; corrigido em022898 após o typecheck apontar TS never.

- Preservados intent/index.tsx, intent/sources.tsx e sf-u16 do WP2@7fe991b0ec6679d97bfa795eac5f45998591521f.
- UI34 permite revisar objetivo, horizonte, moeda, descrições dos critérios e fontes inspecionadas. IDs/required, CAS, principal e evidências vêm do produtor; decisions.decision-edit continua o comando original único.
- A revisão mostra os campos enviados, os vazios reais de alternativas/alterações e a quantidade de fontes/recibos. Estado incerto continua bloqueado.
- journey.ts usa signIn da instalação real e /orchestra/sf-decisions na origem :3000. A leitura auxiliar estrita usa a projeção original projection.case, com identidade/incarnação/CAS e sem inserir dados.
- case-lifecycle.ts conserva criação, payload exato, edição por CAS, reload/reabertura e perda da resposta original de criação. O CDP perde somente a resposta depois do commit; não emite outro request nem fabrica resultado.
- O spec principal e decisions-native-authoring.spec.ts chamam as mesmas duas funções. O arquivo estreito permite qualificar essas jornadas sem alegar que as outras três já foram portadas.

## Pendente

- packages/app-shell/src/orchestra/chapters/sucafina/decisions/alternatives/initial.tsx:16: o controle inicial está ligado, mas ainda precisa de typecheck, readiness original das três operações e gate instalado. O integrador está conferindo a disponibilidade; não se infere readiness do catálogo.
- packages/app-shell/e2e/sucafina/decisions-support/initial-alternatives.ts:14 e :190–265: o helper ainda aponta ao console. Portar fonte/cobertura/promoção, comparação original e catálogo de portfolio sem remover asserções numéricas ou o retry idêntico. O novo componente sozinho não fecha a jornada.
- packages/app-shell/e2e/sucafina/decisions-support/choice-history.ts:42: escolha/histórico e retry humano do mesmo corpo/key precisam do controle nativo e prova instalada C08.
- packages/app-shell/e2e/sucafina/decisions-support/procurement-closure.ts:10: sequência financeira C12 completa ainda não portata/qualificada. UI39/40 está sob posse do agente de ingresso; preparar/revisar/aplicar/recuperar deve consumir o adaptador Procurement original.
- packages/app-shell/e2e/sucafina/decisions.spec.ts:48: descoberta de catálogo vazio ainda aponta controles legados; teste permanece ativo, sem skip.
- Nenhuma prova de escolha financeira, Apply, recuperação C12 ou GO é inferida dos dois cenários básicos.

## Decisões e justificativas

- Não há testes removidos, skips ou aumento de timeout. Os cinco cenários originais continuam presentes; dois foram extraídos para funções efetivamente compartilhadas.
- A observação legado “History and sources” agora usa Review intent. Os mesmos contadores de fontes/recibos continuam exatos.
- Na criação perdida, o teste antigo apenas afirmava que Retry same creation estava habilitado; não o acionava. A jornada exigia recuperação por leitura e exatamente um POST. O nativo mantém os campos e Review creation bloqueados e oferece Refresh case list. A prova agora verifica esses estados reais e conserva o mesmo caseRef, versão, conteúdo, reload e um único POST. Não se acrescenta retry de criação ao F02 nem um botão de console aposentado.
- A verificação de edição obtém IDs e flags dos critérios pelo JSON produtor em vez de um atributo data-context legado. O produtor case-port.ts:52 define required:true para os critérios criados; a UI e a projeção agora são conferidas.
- Nenhum case, alternative, choice, baseline, receipt ou grant é inserido pela fixture.
- As três jornadas restantes seguem explicitamente pendentes e não viram expectativa de falha aceita.

## Como retomar

- O checkpoint 22e36 contém somente UI35 inicial e correção de ref; não foi incluído nos runs UI33/34 acima. A prioridade atual é resolver os zero POST de Operations antes de continuar UI35/38, por coordenação do integrador.

1. Continuar nesta branch; compor apenas os arquivos desta fatia sobre a integração atual para preservar os fixes posteriores de ingresso e BI.
2. Incluir wp03/installation-fixture.ts atual com signIn e o mapa de bindings verificado (F02/C05 já qualificado em 44594420036; Decisions/C12 em gate separado).
3. Os dois cenários de e2e/sucafina/decisions-native-authoring.spec.ts estão qualificados pelo run44601715581. Não repetir sem mudança nesse escopo; seguir para o primeiro cenário novo de alternativas/escolha.
4. Ligar alternativas, comparação/escolha e C12 aos produtores originais; portar os três cenários restantes antes de qualificar decisions.spec.ts integral.
5. Atualizar SHA, runs e pendências por file:line em cada entrega.

## Comandos e resultados

- Nenhum teste local, shell, browser local ou edição de runtime/application.ts.
- [44601715581](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44601715581): SUCCESS, job135834570675, cleanup135838373212 SUCCESS; 2 passed/2,6min, args [e2e/sucafina/decisions-native-authoring.spec.ts], package app, runner playwright, config e2e/playwright.production.config.ts. Source15388053117883174329454207e60e2a878f5426 e snapshot1297999f0411681265711176f77e2e8e3fd17daa.
- Dependência F02/C05: run 44594420036 SUCCESS, 24 pass / 0 fail / 400 expect, código 10165e1c05151ac5a952fd511fd3642e43dc9ecd. É prova da fronteira cliente, não da UI Decisions.
- Typechecks canônicos CLI/app/E2E passaram no composto em [44601278233](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44601278233), reportado pelo integrador e também exigidos no gate instalado SUCCESS acima. Guards completos permanecem pendentes.
- Nenhum merge ou sf-ci executado por este agente.

- Código UI35 22e36e44187efe73990610cb9bc4669a4e8932dc: nenhum gate ou typecheck executado neste checkpoint. Asserções antigas continuam ativas; nenhuma foi removida para representar o novo controle como completo.
