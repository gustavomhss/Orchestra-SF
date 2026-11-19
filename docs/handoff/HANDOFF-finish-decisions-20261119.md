# Handoff — finish-decisions-20261119

SHA base: 03d2a11f3b8ffe51888601c5ad50ae0b16058dea
SHA anterior de código: 9cea9389cf808a9e00762e5a63cc0d4134e9ebd2
SHA deste checkpoint: commit que contém este documento; entregar SHA exato ao integrador
Data: 2026-11-19
Estado: partial

## Feito

- Preservados intent/index.tsx, intent/sources.tsx e sf-u16 do WP2@7fe991b0ec6679d97bfa795eac5f45998591521f.
- UI34 permite revisar objetivo, horizonte, moeda, descrições dos critérios e fontes inspecionadas. IDs/required, CAS, principal e evidências vêm do produtor; decisions.decision-edit continua o comando original único.
- A revisão mostra os campos enviados, os vazios reais de alternativas/alterações e a quantidade de fontes/recibos. Estado incerto continua bloqueado.
- journey.ts usa signIn da instalação real e /orchestra/sf-decisions na origem :3000. A leitura auxiliar estrita usa a projeção original projection.case, com identidade/incarnação/CAS e sem inserir dados.
- case-lifecycle.ts conserva criação, payload exato, edição por CAS, reload/reabertura e perda da resposta original de criação. O CDP perde somente a resposta depois do commit; não emite outro request nem fabrica resultado.
- O spec principal e decisions-native-authoring.spec.ts chamam as mesmas duas funções. O arquivo estreito permite qualificar essas jornadas sem alegar que as outras três já foram portadas.

## Pendente

- packages/app-shell/e2e/sucafina/decisions-native-authoring.spec.ts:8: gate composto de dois cenários ainda não executado; requer ingresso atual, tipos e o mapa original de bindings da branch finish-retry-20261119.
- packages/app-shell/e2e/sucafina/decisions-support/initial-alternatives.ts:14: primeira alternativa com cobertura pendente precisa de controles nativos ligados aos produtores originais, sem seed.
- packages/app-shell/e2e/sucafina/decisions-support/choice-history.ts:42: escolha/histórico e retry humano do mesmo corpo/key precisam do controle nativo e prova instalada C08.
- packages/app-shell/e2e/sucafina/decisions-support/procurement-closure.ts:10: sequência financeira C12 completa ainda não portata/qualificada. UI39/40 está sob posse do agente de ingresso; preparar/revisar/aplicar/recuperar deve consumir o adaptador Procurement original.
- packages/app-shell/e2e/sucafina/decisions.spec.ts:48: descoberta de catálogo vazio ainda aponta controles legados; teste permanece ativo, sem skip.
- packages/app-shell/src/orchestra/chapters/sucafina/decisions/intent/sources.tsx:62: editor ampliado ainda aguarda typecheck e gate composto.
- Nenhuma prova de escolha financeira, Apply, recuperação C12 ou GO é inferida dos dois cenários básicos.

## Decisões e justificativas

- Não há testes removidos, skips ou aumento de timeout. Os cinco cenários originais continuam presentes; dois foram extraídos para funções efetivamente compartilhadas.
- A observação legado “History and sources” agora usa Review intent. Os mesmos contadores de fontes/recibos continuam exatos.
- Na criação perdida, o teste antigo apenas afirmava que Retry same creation estava habilitado; não o acionava. A jornada exigia recuperação por leitura e exatamente um POST. O nativo mantém os campos e Review creation bloqueados e oferece Refresh case list. A prova agora verifica esses estados reais e conserva o mesmo caseRef, versão, conteúdo, reload e um único POST. Não se acrescenta retry de criação ao F02 nem um botão de console aposentado.
- A verificação de edição obtém IDs e flags dos critérios pelo JSON produtor em vez de um atributo data-context legado. O produtor case-port.ts:52 define required:true para os critérios criados; a UI e a projeção agora são conferidas.
- Nenhum case, alternative, choice, baseline, receipt ou grant é inserido pela fixture.
- As três jornadas restantes seguem explicitamente pendentes e não viram expectativa de falha aceita.

## Como retomar

1. Continuar nesta branch; compor apenas os arquivos desta fatia sobre a integração atual para preservar os fixes posteriores de ingresso e BI.
2. Incluir wp03/installation-fixture.ts atual com signIn e o mapa de bindings verificado (F02/C05 já qualificado em 44594420036; Decisions/C12 em gate separado).
3. Rodar apenas e2e/sucafina/decisions-native-authoring.spec.ts na configuração production, depois corrigir qualquer falha concreta conservando os contratos.
4. Ligar alternativas, comparação/escolha e C12 aos produtores originais; portar os três cenários restantes antes de qualificar decisions.spec.ts integral.
5. Atualizar SHA, runs e pendências por file:line em cada entrega.

## Comandos e resultados

- Nenhum teste local, shell, browser local ou edição de runtime/application.ts.
- Nenhum gate instalado desta fatia executado neste checkpoint.
- Dependência F02/C05: run 44594420036 SUCCESS, 24 pass / 0 fail / 400 expect, código 10165e1c05151ac5a952fd511fd3642e43dc9ecd. É prova da fronteira cliente, não da UI Decisions.
- Typecheck, guards e test:ci instalado desta fatia: pendentes na composição.
- Nenhum merge ou sf-ci executado por este agente.
