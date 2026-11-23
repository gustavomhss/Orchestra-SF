# Índice de achados

**34 itens priorizados:** 1 P1, 23 P2, 10 P3. As contagens incluem defeitos demonstrados, problemas de UX observados e problemas inferidos da fonte; não representam esse número de bugs reproduzidos em runtime.

**Fechamento:** SYS-03 foi tratado na fonte pela PR #716, integrada após a base auditada. O item permanece no histórico; consulte [DELTA.md](DELTA.md).

BA-02, a hipótese de foco por IDs iguais e as races de UI42/UI44 foram excluídas desta contagem e estão documentadas nas ressalvas.

| ID | Prioridade | Achado | Evidência detalhada |
| --- | --- | --- | --- |
| BA-01 | P1 | Teams apaga um rascunho nunca enviado após interrupção do stream | [Fonte, reprodução, critérios e limites](reviewers/behavior.md) |
| B1 | P2 | CAP03: a revisão oculta o valor anterior conhecido | [Fonte, reprodução, critérios e limites](reviewers/product.md) |
| B12 | P2 | CAP16: confirmação de excesso de pesos aparece sem uma exceção identificada | [Fonte, reprodução, critérios e limites](reviewers/product-supplement.md) |
| B2 | P2 | UI48: valores preservados perdem identidade semântica e associação ao registro | [Fonte, reprodução, critérios e limites](reviewers/product.md) |
| B3 | P2 | UI50: dois formulários de formato, duas ações de gerar e um título sem efeito | [Fonte, reprodução, critérios e limites](reviewers/product.md) |
| B4 | P2 | UI47–50: preservar termina em referência crua e as rotas de entrada não ajudam a continuar | [Fonte, reprodução, critérios e limites](reviewers/product.md) |
| B5 | P2 | UI48: Open source pode falhar em silêncio e conservar links de outra seleção | [Fonte, reprodução, critérios e limites](reviewers/product.md) |
| B6 | P2 | CAP10: Budget e Spent não informam moeda nem sua ausência; extensão B6-S1 em CAP14 | [Fonte, reprodução, critérios e limites](reviewers/product.md); [extensão B6-S1](reviewers/product-supplement.md) |
| B7 | P2 | CAP10: revisão de milestone promete comparação, mas mostra só a proposta | [Fonte, reprodução, critérios e limites](reviewers/product.md) |
| B8 | P2 | CAP08: Edit review abre um cadastro completo e enterra a avaliação | [Fonte, reprodução, critérios e limites](reviewers/product.md) |
| B9 | P2 | CAP07/08: Voltar para equipe/talentos depende de histórico arbitrário | [Fonte, reprodução, critérios e limites](reviewers/product.md) |
| BA-03 | P2 | Editar uma alocação existente mostra Add allocation | [Fonte, reprodução, critérios e limites](reviewers/behavior.md) |
| BA-04 | P2 | Ações de versões perdem toda a identificação da linha em 320px | [Fonte, reprodução, critérios e limites](reviewers/behavior.md) |
| BA-05 | P2 | Revisões elevam UUIDs e chaves técnicas à identidade principal | [Fonte, reprodução, critérios e limites](reviewers/behavior.md) |
| ROOT-01 | P2 | UI46: o gráfico móvel separa o período da barra e do valor | [Fonte, reprodução, critérios e limites](reviewers/root.json) |
| ROOT-02 | P2 | UI49: comparação móvel deixa antes/depois fora da primeira leitura | [Fonte, reprodução, critérios e limites](reviewers/root.json) |
| ROOT-03 | P2 | Guard nativo entrega uma linha técnica em inglês sem orientação útil de recuperação | [Fonte, reprodução, critérios e limites](reviewers/root.json) |
| SUP-01 | P2 | Add server perde largura, margem e padding próprios porque o seletor procura a classe no nó errado | [Fonte, reprodução, critérios e limites](reviewers/system-supplement.md) |
| SUP-02 | P2 | RAG Studio repete mensagens de indisponibilidade e não oferece nova tentativa local | [Fonte, reprodução, critérios e limites](reviewers/system-supplement.md) |
| SUP-03 | P2 | Registro de documento exige que o usuário descubra e digite ID interno e versão CAS | [Fonte, reprodução, critérios e limites](reviewers/system-supplement.md) |
| SYS-01 | P2 | A superfície de Teams termina no meio da administração expandida em desktop | [Fonte, reprodução, critérios e limites](reviewers/system.md) |
| SYS-02 | P2 | Campo Microsoft Team ID ativo e vazio tem contorno essencial abaixo de 3:1 | [Fonte, reprodução, critérios e limites](reviewers/system.md) |
| SYS-03 | P2 | Fechar configuração de provider deixa alerta técnico CancelledError — ocorrência tratada por #716 após a base | [Fonte, reprodução, critérios e limites](reviewers/system.md) |
| SYS-04 | P2 | Token de warning inexistente remove a semântica visual de três superfícies | [Fonte, reprodução, critérios e limites](reviewers/system.md) |
| B10 | P3 | CAP04: mês por extenso em PT perde o último dígito do ano | [Fonte, reprodução, critérios e limites](reviewers/product.md) |
| B11 | P3 | Formulários equivalentes usam eixos de composição divergentes | [Fonte, reprodução, critérios e limites](reviewers/product.md) |
| B13 | P3 | Revisões operacionais repetem o payload inteiro em Effects depois do antes/depois | [Fonte, reprodução, critérios e limites](reviewers/product-supplement.md) |
| BA-06 | P3 | Aviso bloqueante duplica a mesma razão | [Fonte, reprodução, critérios e limites](reviewers/behavior.md) |
| BA-07 | P3 | Comparação mensal rola título e cabeçalho Month para fora do recorte | [Fonte, reprodução, critérios e limites](reviewers/behavior.md) |
| BA-08 | P3 | KPIs perdem alinhamento vertical quando o rótulo PT-BR ocupa duas linhas | [Fonte, reprodução, critérios e limites](reviewers/behavior.md) |
| BA-09 | P3 | Fila de aprovações comprime a identidade em desktop apesar do espaço livre no assunto | [Fonte, reprodução, critérios e limites](reviewers/behavior.md) |
| BF-01 | P3 | Revisão financeira regride para números crus e código de mês | [Fonte, reprodução, critérios e limites](reviewers/behavior-finance.md) |
| REF-01 | P3 / design judgment | Estados terminais de ausência gastam altura de gráfico vazio no Home móvel | [Fonte, reprodução, critérios e limites](reviewers/system.md) |
| REF-02 | P3 / design judgment | A hierarquia de Teams repete instruções e dedica pouco espaço inicial à conversa | [Fonte, reprodução, critérios e limites](reviewers/system.md) |

## Decisões de classificação

- BA-01 é o único P1: a perda do rascunho foi reproduzida em uma execução nova.
- SYS-04, B5 e B9 têm mecanismos inspecionados na fonte; não são apresentados como incidentes de runtime reproduzidos.
- ROOT-01/02 e vários P3 são julgamentos de UX baseados em pixels e fonte; não são alegações de cálculo incorreto ou de scroll impossível.
- SYS-03 tem toast visível; frequência e combinação exata de concorrência não foram medidas.
- Sobreposição de trabalho: #613 e #713 abertas; #716 integrada no fechamento. A contagem histórica continua ligada à base fixada; DELTA.md distingue a resolução posterior.
- A hipótese de restauração de foco por IDs de linha iguais foi retirada por interpretação incorreta de Solid on(...).
