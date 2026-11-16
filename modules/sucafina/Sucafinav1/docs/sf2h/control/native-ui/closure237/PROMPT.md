Trabalhe em sessão NOVA no repositório gustavomhss/Orchestra-SF. Missão 237: concluir proteção de rascunhos e saída do shell Sucafina. Branch criada: sf-shell-guard, HEAD inicial 95322577a4f4b1392163695b990199e5f88655fb. Faça código completo, testes de regressão e PR; não entregue só diagnóstico.

Leia AGENTS e as partes pertinentes do plano imutável dbf9547211d9b0fade619790de7c19c0869b7c7d, START.md, WORKFLOW.md, execution/COMMON.md, contratos F01/U01/UI33/UI34 e as ordens UX aprovadas cbac654784714f68779ae1434d30e6ea8970c4d1. Preserve escopo integral da campanha.

Leia primeiro o handoff real:
https://github.com/gustavomhss/Orchestra-SF/blob/95322577a4f4b1392163695b990199e5f88655fb/modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure231/HANDOFF.json
e PATCH-SET.json na mesma pasta. A 231 liberou a escrita e entregou owner-runtime231 e patches inertes; nada disso prova integração ou CI.

Resolva os achados 231-DIRTY-EDITOR-CONSUMER e 231-ROOT-SHELL-EXIT. Integre os campos editáveis reais UI33 ao SfDraftRegistry e conecte o guard de descarte ao fluxo real de troca de capítulo/servidor pelo menu global e navegação do shell. Preserve uma única autoridade do proprietário, rascunhos por identidade, bloqueio de navegação quando usuário escolhe continuar editando, limpeza após descarte confirmado, troca de owner, cancelamento e retorno/foco. Reutilize o runtime e patches 231 e os arquivos reais 227/228; não crie controlador paralelo nem invente permissão/identidade. Mantenha a experiência de outros capítulos do Orchestra.

Produza patches completos INERTES nos receipts para qualquer arquivo existente de UI33, shell, contexto, navegação ou sidebar, incluindo pre/post blobs e dependências 227/228/231. Pode escrever somente:
- modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure237/**
- packages/app-shell/test-browser/sucafina-native/shell-guard237.test.ts
- packages/app-shell/e2e/sucafina/native/journeys/shell-guard237.spec.ts
Confronte cada preimage com a PR de integração #208 e forneça composição sem apagar suas alterações. Se existirem conflitos, entregue resolução completa. Inclua cobertura de edição suja, cancelar, confirmar descarte, troca de owner, saída pelo sidebar e ausência de vazamento; não altere asserções para esconder regressão.

Não altere políticas financeiras, Azure, engines, identidade, segredos ou runtime desktop/server; não faça merge em dev. GitHub MCP somente para remoto, com expected-head e sem force. Não rode testes/typecheck/build/validadores localmente, nem dispare CI: forneça seleção cirúrgica ao sucessor autorizado do handoff232. Abra PR rascunho contra sf-integration-preview, sem modificar essa branch nem presumir que outros chats receberam mensagens.

Entregue ACK e HANDOFF com exatos SHAs, arquivos/payloads, comportamento, limites, CI-REQUEST, RECHECK e liberação de escrita. Classifique provas não executadas NOT_RUN. Prepare patch real mesmo se o host instalado necessário para prova positiva não estiver disponível. Não afirme GLOBAL_RELEASE.
