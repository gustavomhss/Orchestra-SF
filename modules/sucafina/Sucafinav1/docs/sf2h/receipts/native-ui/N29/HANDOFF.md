# N29 — handoff de autoria para integradora 125

Branch: sf-ux-n29. Baseline C60: 526e7204b310756e552196bbf3d64037dbbf047c. ACK REAL em ACK.json. Autoria publicada, sem testes, sem compilação, sem merge e sem deploy. Status de unidade: ARTIFACT_READY; operacionalidade e aceitação: PENDENTES.

## Exports / rotas congeladas

- UI64 SfRoutineCatalogView: packages/app-shell/src/orchestra/chapters/sucafina/routines/catalog/index.tsx (U27, entry/recipe/admission).
- UI65 SfRoutineRunView: packages/app-shell/src/orchestra/chapters/sucafina/routines/runs/index.tsx (U27, list/entry).
- UI66 SfSchedulesView: packages/app-shell/src/orchestra/chapters/sucafina/routines/schedules/index.tsx (U34, list/new/entry).
- UI70 SfResidentsView: packages/app-shell/src/orchestra/chapters/sucafina/routines/residents/index.tsx (U35, entry).
- Copy: sf-u27.ts, sf-u34.ts e sf-u35.ts; pares _BR correspondentes.
- Componente/estado compartilhado N29 local: routines/catalog/ui.ts. F01/F02/F03/S01/S03/S04 continuam sendo donos de contexto, transporte, layout, revisões e evidências. Sem novo dispatcher.

## Contratos e limites comprováveis de autoria

UI64 exige escolha de caso atual de A15 intelligence.analysis.choices, com id/incarnation/version original; isso adiciona dependência operacional de A15 além do catálogo A09. Sem grant de A15, mantém bloqueio seguro em vez de inventar caseRef. O catálogo A09 fornece documentId/publishedVersion/planRevisionId/writeScope; a admissão envia referências e parâmetros estritamente no campo tipado original, com digest ainda validado pelo produtor. ReadAdmission é revalidado antes de run, usando admissionRef/expectedAdmissionVersion/caseRef. Nunca interpreta admission ou runRef como execução concluída. A09 não oferece routines.cancel; nenhuma ação falsa foi habilitada.

UI65 usa projection.routine ou routines.read-run com caso autorizado. A resposta original pode fornecer runRef/resultRef/pending, mas não percentuais ou status de completude verificados; nenhum progresso ou recibo é inventado. UI65 list não possui listagem de runs autorizada; seleção depende do route builder F01.

UI66 usa somente as operações originais BusinessPorts.schedules via A09. A lista contém scheduleRef/version/state; edit só pode acontecer se o produtor opcional schedules.read fornecer detail atualizado para mesmo ref/owner/version, senão mostra schedule-detail-port-unavailable. Create/list/pause/read-run não dependem da disponibilidade do detalhe. Mutation CAS + review explícito + idempotência do F02; nenhum replay de resultado desconhecido. Nenhum uso de Core Schedule ou engine alternativo.

UI70 usa somente A15 projection.residents e mostra perfis/skills/allowedOperations/outputSchemaRefs efetivamente devolvidos. A projeção não expõe inventário dos 8 packs, recibo de carregamento nem execução/contribution envelope. Nada disso é alegado como loaded/contributed. A presença de 5 perfis, 18 skills, 39 operações ou 8 packs não é contada sem a fonte atual.

Os componentes de autoria possuem layouts responsivos e mensagens completas EN/pt-BR, mas não houve prova de navegador. Revisão local de comandos não equivale ao recibo de produtor/S03; 119/125 devem avaliar a composição final. Todos os componentes falham fechados sem grants operacionais F01.

## Ações exclusivas de 125 (não aplicadas por N29)

1. Mesclar os leaves no ponto integrado da branch sf2-stack e fazer o wiring dos exports tipados com SfSurfaceProps por ID no registro atual F01/I00. Não construir URLs a partir de refs opaque, não inventar novos códigos de operação nem um dispatcher; integrar navegação origem/lista/detalhe através do route builder F01 que já existe.
2. Aplicar/rebasear o patch de copy inerte 125-SHARED.patch sobre packages/app-shell/src/i18n/orchestra.ts. Preimage observado em sf2-stack: blob 91e526cd53e2c020f36efacb60ecad250a4da11b; confira HEAD vivo antes da aplicação.
3. Confirmar adapters reais A09 (routines e schedules) e A15 (residents e choices), F01/F02/F03/S01/S03/S04; não copiar definições, não gerar stubs. Se a instalação negar uma operação, manter somente estado indisponível correspondente, sem transpor gates.
4. Pedir ao 120 E2E cirúrgico e ao 119 compiler depois da unidade integrada; nunca inferir sucesso da existência dos arquivos. Sem reativação Goal.

## Evidência e limitações

PREPOST.json contém hash de cada leaf (preimage AUSENTE em C60, postimage GitHub verificado); AC-EVIDENCE.json mapeia U27/U34/U35 AC01-03 com NOT_RUN e gates. 120-119-QA.md descreve fixtures com produtores reais; 125-SHARED.patch é apenas um patch, não um commit nos destinos protegidos.

Entrega N29 é autoria remota concreta. Integração, status runtime e aceitação final continuam não comprovados até recibos dos owners 125/119/120.
