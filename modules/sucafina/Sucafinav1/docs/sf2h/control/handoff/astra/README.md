# Astra — primeiros quatro WPs

Uma conversa independente por WP. Cada Astra implementa o WP completo, publica commit/PR e executa CI cirúrgico. S0 revisa e integra depois em sf2-stack; epic/global somente após o bundle. As sessões antigas permanecem paradas e a Goal pausada.

| Handoff | Tasks | Critérios próprios | Branch | Base da PR |
|---|---:|---:|---|---|
| [WP00](WP00.md) |4|85|astra-wp00|sf2-stack|
| [WP01](WP01.md) |5|75|astra-wp01|sf2-stack|
| [WP02](WP02.md) |4|78|astra-wp02|sf2-stack|
| [WP03](WP03.md) |5|112|astra-wp03|sf2-stack|

18 tasks e 350 critérios próprios; a campanha completa continua 15 WPs/74 tasks/1.610 critérios. Critérios globais também estão nos packs para composição final. Seeds partem da mesma base e preservam apenas arquivos próprios, evitando deleções cruzadas dos antigos snapshots. Packs são derivados operacionais da fonte fixa, sem alterar planejamento ou reduzir escopo.

Cole em cada chat: “Execute integralmente o handoff WPxx.md deste diretório. Leia o pack completo vinculado. Entregue commit publicado, PR contra sf2-stack e CI cirúrgico comprovado. Você implementa e testa; S0 revisa e integra. Não só planeje.”

[Protocolo de CI](CI.md). [Branches/SHAs preparados](seed-results.json). Nenhuma das quatro novas branches foi testada ou considerada pronta só por ter sido preparada.
