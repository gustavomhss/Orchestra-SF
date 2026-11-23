# Auditoria adversarial — telas de negócio Sucafina

Base fixada: [dev `5b48dab52621037168ad4e3a6243c79a4fe5ad6e`](https://github.com/gustavomhss/Orchestra-SF/tree/5b48dab52621037168ad4e3a6243c79a4fe5ad6e). Agente: `/root/product_audit`. Revisão somente de leitura. Este documento complementa a auditoria do shell, do design system e dos workflows conduzida pelo agente raiz.

## Veredito desta fatia

A leitura não sustenta uma certificação de acabamento impecável. Há problemas de interpretação e de revisão antes de problemas cosméticos: valores financeiros sem contexto suficiente, revisão que oculta o valor anterior conhecido, confirmação sem comparação e ações com retorno incompleto. Há também defeitos pequenos e objetivos, como o ano cortado no editor de OPEX em português. As capturas mostram esforço de composição consistente em muitos estados, mas isso não elimina os achados abaixo.

## Cobertura comprovada

| Medida | Escopo |
|---|---|
| Inventário | 70 superfícies, 165 padrões de rota |
| Fonte | 66 componentes leaf, 28.840 linhas, mais 13 arquivos de suporte registrados |
| Imagens business vistas | 103/103 PNGs fora de attachments: 97 nomeados + 6 test-finished |
| Famílias vistas por este agente | CAP02, CAP03, CAP04, CAP06, CAP07, CAP08, CAP09, CAP10 |
| Idiomas e layouts presentes | EN e PT-BR; dark/light; desktop 1440, 1440×800 e largura 320 conforme arquivo |
| Achados desta fatia | 11: nove P2, dois P3; dois P2 têm correção parcial/principal no #613 |
| Execução local de produto | Nenhuma |

O JSON [product-audit-final.json](product.json) contém cada caminho de imagem efetivamente vista, mapeamento para achados, cada componente com blob SHA e a lista das 70 superfícies. O denominador é o conjunto business, não todas as telas do produto. Screenshots de guard não equivalem à folha renderizada.

As imagens business foram produzidas em cf241b8. A correspondência dos blobs relevantes com a base fixada, os hashes dos arquivos compactados e a proveniência Actions ficam no manifesto do agente raiz. Os arquivos foram abertos individualmente; não se usou um mosaico como substituto da inspeção. Nenhuma captura mencionada neste relatório é uma composição gerada.

## Priorização

P2 significa problema que deve ser corrigido para um fluxo confiável, claro e refinado. P3 significa polimento visível e consistente, sem demonstração de bloqueio funcional. Não se atribuiu P1 a suspeita de race, nem se chamou de corrupção um problema de apresentação.

| ID | Prioridade | Achado | Evidência | Proprietário |
|---|---|---|---|---|
| B1 | P2 | CAP03: a revisão oculta o valor anterior conhecido | Alta: visto em capturas originais e confirmado no código | Novo/coordenação design system |
| B2 | P2 | UI48: valores preservados perdem identidade semântica e associação ao registro | Alta no código; evidência visual observada pelo agente raiz | Coordenar #613; persiste no patch lido |
| B3 | P2 | UI50: dois formulários de formato, duas ações de gerar e um título sem efeito | Alta: código e capturas inspecionadas pelo agente raiz | Correção já no #613, verificar integração |
| B4 | P2 | UI47–50: preservar termina em referência crua e as rotas de entrada não ajudam a continuar | Alta no código; estado confirmado observado pelo agente raiz | Correção já no #613, verificar integração |
| B5 | P2 | UI48: Open source pode falhar em silêncio e conservar links de outra seleção | Alta quanto à lógica; reprodução com transporte controlado ainda necessária | Coordenar #613; persiste no patch lido |
| B6 | P2 | CAP10: Budget e Spent não informam moeda nem sua ausência | Alta: capturas originais e código | Novo/coordenação design system |
| B7 | P2 | CAP10: revisão de milestone promete comparação, mas mostra só a proposta | Alta: captura original e código | Novo/coordenação design system |
| B8 | P2 | CAP08: Edit review abre um cadastro completo e enterra a avaliação | Alta no layout observado; severidade é julgamento de UX | Novo/coordenação design system |
| B9 | P2 | CAP07/08: Voltar para equipe/talentos depende de histórico arbitrário | Alta no código; comportamento ainda a reproduzir em Actions | Novo/coordenação design system |
| B10 | P3 | CAP04: mês por extenso em PT perde o último dígito do ano | Alta: duas capturas originais e causa CSS exata | Novo/coordenação design system |
| B11 | P3 | Formulários equivalentes usam eixos de composição divergentes | Alta no layout e nas regras; recomendação é julgamento de design | Novo/coordenação design system |

## B1 · P2 · CAP03: a revisão oculta o valor anterior conhecido

**Classificação:** Defeito de informação. **Confiança:** Alta: visto em capturas originais e confirmado no código.

**Observação.** Ao alterar o mês atual de 6 para 7, a revisão mostra julho de 2026 como proposta, mas Original e Fonte atual aparecem como 'Not supplied in this version' / 'Não informado nessa versão'. O valor anterior está disponível na tela e é passado ao editor.

**Causa e fonte.** Budget passa value e version, mas não recordId. SfU02Edit exige recordId para construir qualquer base persistida; sem ele descarta os campos da base, apesar de current().sourceValue continuar conhecido. A mesma condição afeta o editor da receita anual.

- [packages/app-shell/src/orchestra/chapters/sucafina/dashboard/budget/index.tsx:130–159](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/budget/index.tsx#L130-L159)
- [packages/app-shell/src/orchestra/chapters/sucafina/dashboard/executive/edit.tsx:211–244](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/executive/edit.tsx#L211-L244)
- [packages/app-shell/src/orchestra/chapters/sucafina/dashboard/executive/edit.tsx:321–327](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/executive/edit.tsx#L321-L327)

**Reprodução.** Na visão de orçamento com mês atual 6, abrir Edit current month, informar 7 e revisar. Repetir com uma receita anual já existente.

**Efeito.** A confirmação não permite comparar antes e depois justamente em uma edição financeira. O texto declara ausência de algo que a aplicação conhece; isso reduz a confiabilidade da revisão, sem evidência de corrupção dos números gravados.

**Correção proposta.** Representar valores de configuração/coleção conhecidos no contrato de revisão, com a versão real. Não fabricar um recordId para satisfazer o componente.

**Aceite.**

- Revisão de 6 → 7 mostra junho de 2026 → julho de 2026 em EN e PT.
- Receita conhecida aparece antes e depois com a situação real da moeda.
- Ausência real permanece explícita; mudança concorrente da fonte não é confundida com o valor original.

**Sobreposição.** Não identificado como correção existente em #613/#713/#716. O componente compartilhado deve ser coordenado com o responsável pelo sistema de revisão.

**Limite.** Capturas provam o problema no mês; extensão à receita é inferência direta da mesma chamada e condição.


**Capturas originais vistas.**

- `[62]` [CAP03-dark-desktop-review-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-two-i-2f47b-PEX-with-real-source-writes-chromium/CAP03-dark-desktop-review-test-data.png)
- `[65]` [CAP03-dark-320-review-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-two-i-2f47b-PEX-with-real-source-writes-chromium/CAP03-dark-320-review-test-data.png)
- `[70]` [CAP03-pt-BR-dark-desktop-editor-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-two-i-2f47b-PEX-with-real-source-writes-chromium/CAP03-pt-BR-dark-desktop-editor-test-data.png)
- `[72]` [CAP03-pt-BR-dark-desktop-review-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-two-i-2f47b-PEX-with-real-source-writes-chromium/CAP03-pt-BR-dark-desktop-review-test-data.png)
- `[86]` [CAP03-dark-desktop-annual-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-two-i-2f47b-PEX-with-real-source-writes-chromium/CAP03-dark-desktop-annual-test-data.png)

## B2 · P2 · UI48: valores preservados perdem identidade semântica e associação ao registro

**Classificação:** Defeito de hierarquia e interpretação. **Confiança:** Alta no código; evidência visual observada pelo agente raiz.

**Observação.** O agente raiz inspecionou UI48-original-preserved-review em desktop dark/light. Cada cartão se chama 'Recorded value'; UUIDs, 180,000.00, 2,026 e outros números aparecem sem rótulo de campo ou associação visível ao registro. O identificador fica em uma disclosure. O modo de apresentação também renderiza valores soltos.

**Causa e fonte.** O renderer usa o mesmo dt traduzido para todo valor, exibe apenas value.id na disclosure e passa qualquer número para AmountText. O schema ProjectionValue não contém label nem tipo semântico. AmountText aplica separadores de milhar a qualquer número sem moeda, inclusive anos.

- [packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/index.tsx:185–200](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/index.tsx#L185-L200)
- [packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/index.tsx:299–311](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/index.tsx#L299-L311)
- [packages/app-shell/src/orchestra/chapters/sucafina/reviews/labels.tsx:76–90](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/reviews/labels.tsx#L76-L90)
- [packages/schema/src/sucafina/reviews.ts:56–62](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/schema/src/sucafina/reviews.ts#L56-L62)

**Reprodução.** Preservar uma seção com vários registros e campos, abrir a revisão e seu modo de apresentação. Tentar identificar o significado de cada número sem abrir as referências técnicas.

**Efeito.** A revisão preserva dados, mas não permite entendê-los com segurança. Um ano vira '2,026'; um valor financeiro pode ser indistinguível de outro campo. Não há alegação de mudança do valor armazenado.

**Correção proposta.** Transportar rótulos e tipos semânticos reais do produtor; agrupar por registro e campo; usar ano, contagem, porcentagem ou moeda conforme o contrato autorizado. Manter IDs e proveniência acessíveis em segundo plano.

**Aceite.**

- Cada valor mostra identidade humana de campo e registro sem exigir disclosures técnicas.
- Ano é apresentado como ano; valores monetários usam somente moeda efetivamente fornecida.
- Ausências continuam explícitas e a exportação/apresentação conserva a mesma semântica.

**Sobreposição.** #613 toca UI48, mas a versão sf-design-next inspecionada conserva esse renderer. Coordenar no mesmo proprietário; não considerar corrigido pela existência do PR.

**Limite.** Visual do workflow foi observado pelo agente raiz, não contado nos 103 screenshots business vistos por este agente. Não inferir moeda ou nome de campo a partir de UUID opaco.

## B3 · P2 · UI50: dois formulários de formato, duas ações de gerar e um título sem efeito

**Classificação:** Defeito de interface e promessa de controle. **Confiança:** Alta: código e capturas inspecionadas pelo agente raiz.

**Observação.** UI50 mostra dois seletores Format, dois controles Generate report, um campo Title e uma lista estática de páginas acima das seções efetivamente autorizadas. Title não participa do payload de geração.

**Causa e fonte.** O formulário legado em 231–262 coexiste com o seletor localizado de 263–275 e com a primaryAction da página. requestReport envia reviewRef, sectionRefs e format; title não é incluído.

- [packages/app-shell/src/orchestra/chapters/sucafina/reviews/reports/index.tsx:175–176](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/reviews/reports/index.tsx#L175-L176)
- [packages/app-shell/src/orchestra/chapters/sucafina/reviews/reports/index.tsx:204–209](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/reviews/reports/index.tsx#L204-L209)
- [packages/app-shell/src/orchestra/chapters/sucafina/reviews/reports/index.tsx:231–275](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/reviews/reports/index.tsx#L231-L275)

**Reprodução.** Abrir uma revisão autorizada na rota de relatório; preencher Title, alternar Format e comparar os dois blocos antes de gerar.

**Efeito.** O usuário precisa decidir qual formulário é válido e acredita configurar um título que a operação ignora. Há duplicação visual, texto sem i18n e excesso de camadas de cartão.

**Correção proposta.** Integrar a remoção do bloco legado já preparada no proprietário #613. Manter uma seleção de formato e uma ação principal, ligadas ao conteúdo autorizado.

**Aceite.**

- Uma única escolha de formato e uma única ação principal por estado, em desktop e 320px.
- Nenhum campo editável sem efeito real no pedido.
- Seções exibidas e selecionadas correspondem exatamente às seções autorizadas e preservadas.

**Sobreposição.** Já tratado no patch #613 inspecionado; não abrir correção paralela. Ainda presente no SHA dev auditado. Precisa integração e nova evidência.

**Limite.** Capturas UI50 foram vistas pelo agente raiz. Ausência de title no payload é fato de código; não foi executada uma exportação local.

## B4 · P2 · UI47–50: preservar termina em referência crua e as rotas de entrada não ajudam a continuar

**Classificação:** Quebra de continuidade da jornada. **Confiança:** Alta no código; estado confirmado observado pelo agente raiz.

**Observação.** Após preservar, o sucesso exibe apenas id e versão, sem Abrir revisão ou próximo passo. Nas rotas raiz de revisões/relatórios, não existe reviewRef; o estado fica unavailable e Retry repete a mesma ausência.

**Causa e fonte.** A confirmação UI47 de 338–345 é somente um dl; a prévia fica desabilitada na fase confirmed. UI48 lê ref apenas das rotas entry/present e marca unavailable quando ausente. Retry incrementa uma contagem sem resolver o pré-requisito.

- [packages/app-shell/src/orchestra/chapters/sucafina/reviews/agenda/index.tsx:255–268](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/reviews/agenda/index.tsx#L255-L268)
- [packages/app-shell/src/orchestra/chapters/sucafina/reviews/agenda/index.tsx:338–345](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/reviews/agenda/index.tsx#L338-L345)
- [packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/index.tsx:39–40](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/index.tsx#L39-L40)
- [packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/index.tsx:85–88](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/index.tsx#L85-L88)
- [packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/index.tsx:162–165](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/index.tsx#L162-L165)
- [packages/app-shell/src/orchestra/chapters/sucafina/reviews/reports/index.tsx:216–219](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/reviews/reports/index.tsx#L216-L219)

**Reprodução.** Concluir preservação; procurar como abrir a revisão recém-criada. Abrir /orchestra/sf-reviews/reviews ou /orchestra/sf-reviews/reports sem referência e usar Retry.

**Efeito.** O resultado técnico existe, mas a navegação exige descobrir uma URL/referência. Uma recuperação genérica sugere falha transitória para uma ausência estrutural.

**Correção proposta.** Integrar o openPreserved e o SfOpenReviewReference do #613. Na descoberta inicial da agenda, substituir conhecimento implícito do nome da página por orientação ou seleção autorizada quando o produtor puder fornecê-la.

**Aceite.**

- Sucesso oferece Abrir revisão com a referência real e corretamente codificada.
- Entradas raiz explicam o pré-requisito e oferecem ação útil autorizada.
- Retry representa uma nova tentativa que pode de fato alterar o resultado.
- Nenhuma lista de fontes é inventada para melhorar a aparência.

**Sobreposição.** #613 já adiciona continuidade e entrada por referência. A descoberta inicial continua sendo um campo livre na versão inspecionada; isso permanece uma decisão de UX a revisar.

**Limite.** A necessidade de descoberta inicial é julgamento de UX; a ausência de ação no sucesso e o Retry sem ref são fatos de código.

## B5 · P2 · UI48: Open source pode falhar em silêncio e conservar links de outra seleção

**Classificação:** Defeito de feedback e atribuição. **Confiança:** Alta quanto à lógica; reprodução com transporte controlado ainda necessária.

**Observação.** openSource retorna sem feedback quando a releitura é inválida/não-ok, e só atualiza sourceLinks em um resultado com links. Não limpa os links anteriores ao iniciar outra seleção, não associa o resultado à referência selecionada e não expõe estado de carregamento/erro.

**Causa e fonte.** O método 101–120 usa geração/owner como validação, mas não a identidade da tentativa ou referência. A UI 228–231 mostra qualquer sourceLinks residual. Uma exceção também não tem catch local nesse método.

- [packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/index.tsx:101–120](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/index.tsx#L101-L120)
- [packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/index.tsx:220–231](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/index.tsx#L220-L231)

**Reprodução.** Em Actions, abrir fonte A com sucesso; abrir fonte B com resposta denied/unavailable ou falha de transporte; depois repetir com A/B atrasadas em ordem invertida.

**Efeito.** A ação parece inerte ou a interface mantém links de A após a solicitação de B, sem explicar a atribuição. A condição é derivada do código; não foi afirmado incidente de produção.

**Correção proposta.** Modelar estado por seleção/tentativa, abortar ou invalidar a anterior e apresentar loading, erro e recuperação. Limpar links antigos ou mantê-los explicitamente atribuídos à seleção anterior.

**Aceite.**

- Falha e recusa exibem mensagem útil, sem links apresentados como se fossem resultado da nova seleção.
- Respostas antigas não substituem a seleção atual.
- A revisão permanece legível durante a tentativa; retry reaplica apenas a ação de leitura apropriada.

**Sobreposição.** #613 conserva o método na versão inspecionada. Coordenar dentro do mesmo proprietário de UI48.

**Limite.** Sem execução local. Uma prova Actions de erro/atraso é necessária para fechar a reprodução comportamental; a omissão de estados e limpeza está confirmada na fonte.

## B6 · P2 · CAP10: Budget e Spent não informam moeda nem sua ausência

**Classificação:** Defeito de contexto financeiro. **Confiança:** Alta: capturas originais e código.

**Observação.** Tabela e detalhe exibem 240,000 / 92,000 e outros valores de Budget/Spent sem moeda ou declaração de moeda desconhecida. CAP03/04, no mesmo conjunto, explicam 'Source currency not specified'.

**Causa e fonte.** As células e o detalhe usam Intl.NumberFormat puro. O modelo de projeto consumido contém budget/spent, mas nenhuma moeda ou unidade. O componente não sinaliza essa limitação.

- [packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/index.tsx:192–199](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/index.tsx#L192-L199)
- [packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/index.tsx:292–296](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/index.tsx#L292-L296)
- [packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/model.ts:16–41](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/model.ts#L16-L41)

**Reprodução.** Abrir a lista de projetos e o detalhe do mesmo projeto com orçamento/gasto preenchidos. Comparar o contexto informado ao disponível em OPEX.

**Efeito.** A apresentação financeira omite a unidade necessária para interpretar o valor. A interface parece mais certa do que o contrato permite. Não se afirma que o número esteja incorreto.

**Correção proposta.** Exibir a moeda real se o contrato autorizado a fornece. Se a fonte não a fornece, declarar a ausência junto aos valores. Não presumir USD/BRL ou derivar moeda do idioma.

**Aceite.**

- Lista, detalhe, edição e revisão comunicam a mesma situação de unidade.
- Valores preservam precisão e ausência; nenhum fallback transforma vazio em zero.
- Dados com diferentes moedas, quando admitidos pelo contrato, não são comparados como uma só unidade.

**Sobreposição.** Não identificado como coberto pelas correções #613/#713/#716.

**Limite.** O modelo analisado não traz moeda; corrigir sem inventar dado pode exigir apenas indicação de ausência ou evolução real do contrato.


**Capturas originais vistas.**

- `[38]` [CAP10-dark-desktop-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-three-2c03a-es-and-exact-change-reviews-chromium/CAP10-dark-desktop-test-data.png)
- `[42]` [CAP10-pt-BR-dark-desktop-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-three-2c03a-es-and-exact-change-reviews-chromium/CAP10-pt-BR-dark-desktop-test-data.png)
- `[46]` [CAP10-dark-desktop-project-detail-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-three-2c03a-es-and-exact-change-reviews-chromium/CAP10-dark-desktop-project-detail-test-data.png)
- `[54]` [CAP10-light-desktop-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-three-2c03a-es-and-exact-change-reviews-chromium/CAP10-light-desktop-test-data.png)
- `[60]` [CAP10-dark-desktop-project-review-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-three-2c03a-es-and-exact-change-reviews-chromium/CAP10-dark-desktop-project-review-test-data.png)
- `[44]` [CAP10-pt-BR-dark-desktop-project-review-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-three-2c03a-es-and-exact-change-reviews-chromium/CAP10-pt-BR-dark-desktop-project-review-test-data.png)

## B7 · P2 · CAP10: revisão de milestone promete comparação, mas mostra só a proposta

**Classificação:** Defeito de revisão e microcopy. **Confiança:** Alta: captura original e código.

**Observação.** A tela diz para revisar mudanças contra fonte e versão atuais, porém apresenta apenas Project, Milestone, Date, Status e Notes propostos. Não há valor anterior nem marcação de alteração.

**Causa e fonte.** O bloco de save-milestone usa exclusivamente command.draft; a seleção original contém milestones, mas ela não participa dessa comparação.

- [packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/index.tsx:442–469](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/index.tsx#L442-L469)

**Reprodução.** Editar data/status/notas de um milestone existente, avançar para a revisão e tentar reconhecer o que mudou sem voltar ao editor.

**Efeito.** A etapa de confirmação adiciona fricção sem oferecer a comparação prometida. Erros de alteração são mais difíceis de detectar.

**Correção proposta.** Mostrar antes/depois dos campos alterados usando o milestone de origem real e sua versão; distinguir criação de edição. Nomear o primeiro avanço como Revisar alterações quando ele ainda não salva.

**Aceite.**

- Edição mostra original e proposta com diferenças identificáveis.
- Criação deixa explícito que não há registro anterior.
- A confirmação informa a versão real usada, sem versão sintética.
- Botão que abre a revisão não promete que já salvará o milestone.

**Sobreposição.** Não identificado como coberto pelas correções #613/#713/#716.

**Limite.** O rótulo inicial Save milestone é observado; a comparação ausente está confirmada. Não foi executada persistência local.


**Capturas originais vistas.**

- `[39]` [CAP10-dark-desktop-milestone-editor-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-three-2c03a-es-and-exact-change-reviews-chromium/CAP10-dark-desktop-milestone-editor-test-data.png)
- `[55]` [CAP10-dark-desktop-milestone-review-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-three-2c03a-es-and-exact-change-reviews-chromium/CAP10-dark-desktop-milestone-review-test-data.png)
- `[56]` [CAP10-dark-desktop-milestones-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-three-2c03a-es-and-exact-change-reviews-chromium/CAP10-dark-desktop-milestones-test-data.png)

## B8 · P2 · CAP08: Edit review abre um cadastro completo e enterra a avaliação

**Classificação:** Problema de foco de tarefa. **Confiança:** Alta no layout observado; severidade é julgamento de UX.

**Observação.** A ação Edit review abre Save member. Na captura desktop 1440×1100 aparecem Identity e Employment; os campos próprios da avaliação ficam abaixo da primeira área visível. Leader é um UUID editável como texto.

**Causa e fonte.** talentFields ordena nome, cargo, vínculo, leaderId, localização, datas e status antes de classificação, outlook e notas. SfPeopleEditor recebe todo o conjunto. Comentário da fonte explica que o catálogo de líderes não está na projeção.

- [packages/app-shell/src/orchestra/chapters/sucafina/people/talent/index.tsx:24–62](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/people/talent/index.tsx#L24-L62)
- [packages/app-shell/src/orchestra/chapters/sucafina/people/talent/index.tsx:323–330](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/people/talent/index.tsx#L323-L330)

**Reprodução.** Em Talent Review, escolher um membro e Edit review. Localizar classificação/outlook/notas antes de rolar e avaliar quais campos parecem fazer parte da tarefa.

**Efeito.** A tarefa sugerida pelo comando e a hierarquia da tela divergem. A edição de dados cadastrais e IDs técnicos compete com a avaliação de talento.

**Correção proposta.** Tornar classificação, outlook e notas o centro imediato da tarefa; resumir identidade em contexto legível e separar a edição cadastral quando necessário. Para líderes, usar apenas catálogo autorizado real ou manter a referência protegida/explicada conforme o contrato.

**Aceite.**

- O primeiro campo relevante à avaliação aparece imediatamente em desktop e numa sequência clara em 320px.
- Título e botão descrevem a tarefa real.
- Não inventar nomes de líderes nem alterar payload/autorizações para maquiar a interface.
- A revisão final preserva o escopo exato do que será escrito.

**Sobreposição.** Não identificado como coberto pelas correções #613/#713/#716.

**Limite.** Layout e ordem de campos são fatos observados; a proposta de separar cadastro e avaliação requer decisão de produto, não é alegação de falha de dados.


**Capturas originais vistas.**

- `[12]` [CAP08-dark-desktop-assessment-editor-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-three-631f5-talent-and-honest-workbooks-chromium/CAP08-dark-desktop-assessment-editor-test-data.png)
- `[22]` [CAP08-pt-BR-dark-desktop-assessment-editor-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-three-631f5-talent-and-honest-workbooks-chromium/CAP08-pt-BR-dark-desktop-assessment-editor-test-data.png)
- `[10]` [CAP08-dark-desktop-assessment-review-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-three-631f5-talent-and-honest-workbooks-chromium/CAP08-dark-desktop-assessment-review-test-data.png)
- `[31]` [CAP08-pt-BR-dark-desktop-assessment-review-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-three-631f5-talent-and-honest-workbooks-chromium/CAP08-pt-BR-dark-desktop-assessment-review-test-data.png)

## B9 · P2 · CAP07/08: Voltar para equipe/talentos depende de histórico arbitrário

**Classificação:** Defeito potencial de navegação em deep link. **Confiança:** Alta no código; comportamento ainda a reproduzir em Actions.

**Observação.** Controles com destino semântico como Back to team / Back to talent review usam navigate(-1). Isso não garante a rota nomeada quando a página é aberta diretamente ou vem de outro lugar.

**Causa e fonte.** close de estrutura e dismiss de talento limpam a seleção e navegam uma entrada no histórico. Import/export do talento usa navigate(-1) diretamente.

- [packages/app-shell/src/orchestra/chapters/sucafina/people/structure/index.tsx:114–117](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/people/structure/index.tsx#L114-L117)
- [packages/app-shell/src/orchestra/chapters/sucafina/people/talent/index.tsx:124–127](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/people/talent/index.tsx#L124-L127)
- [packages/app-shell/src/orchestra/chapters/sucafina/people/talent/index.tsx:349–351](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/people/talent/index.tsx#L349-L351)

**Reprodução.** Abrir um detalhe/editor/import/export por URL em uma nova aba e acionar o botão rotulado Voltar para a lista. Repetir chegando de uma página externa ou outro capítulo.

**Efeito.** O botão pode não sair do detalhe ou levar a um lugar diferente do destino anunciado. Prejudica abertura por links compartilhados e recuperação de estados indisponíveis.

**Correção proposta.** Navegar para a rota de coleção semântica preservando owner/filtros apropriados, ou usar um retorno validado interno com fallback explícito. Não trocar silenciosamente o rótulo por uma promessa inexistente.

**Aceite.**

- Nova aba sem histórico retorna à coleção correta.
- Histórico externo não redefine o destino de Voltar para equipe/talentos.
- Retorno preserva contexto autorizado e filtros quando disponíveis.

**Sobreposição.** Não identificado como coberto pelas correções #613/#713/#716.

**Limite.** Não é afirmação de incidente observado: é inferência da escolha de navigate(-1). O controle visível e sua rotulagem foram vistos nas capturas.


**Capturas originais vistas.**

- `[14]` [CAP08-dark-desktop-member-detail-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-three-631f5-talent-and-honest-workbooks-chromium/CAP08-dark-desktop-member-detail-test-data.png)
- `[15]` [CAP07-dark-desktop-member-detail-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-three-631f5-talent-and-honest-workbooks-chromium/CAP07-dark-desktop-member-detail-test-data.png)
- `[24]` [CAP08-dark-desktop-import-unavailable-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-three-631f5-talent-and-honest-workbooks-chromium/CAP08-dark-desktop-import-unavailable-test-data.png)
- `[27]` [CAP08-dark-desktop-export-unavailable-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-three-631f5-talent-and-honest-workbooks-chromium/CAP08-dark-desktop-export-unavailable-test-data.png)
- `[9]` [test-finished-1.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-three-631f5-talent-and-honest-workbooks-chromium/test-finished-1.png)
- `[30]` [test-finished-2.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-three-631f5-talent-and-honest-workbooks-chromium/test-finished-2.png)

## B10 · P3 · CAP04: mês por extenso em PT perde o último dígito do ano

**Classificação:** Defeito visual de conteúdo localizado. **Confiança:** Alta: duas capturas originais e causa CSS exata.

**Observação.** O campo somente leitura exibe 'janeiro de 202' em vez de 'janeiro de 2026'. A captura PT do editor e o test-finished PT mostram o mesmo corte.

**Causa e fonte.** O campo de mês usa o limite de largura do seletor de ano: --sf-opex-year-width:112px. Dentro dele há padding horizontal e uma string localizada de mês longo + ano. Em <=767px a regra muda, portanto é problema específico do estágio desktop atual.

- [packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/opex.css:13–16](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/opex.css#L13-L16)
- [packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/opex.css:307–314](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/opex.css#L307-L314)
- [packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/surface.tsx:892–907](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/surface.tsx#L892-L907)

**Reprodução.** Trocar para PT-BR, editar um mês de OPEX em desktop e observar o campo Mês sem foco ou scroll interno.

**Efeito.** Uma informação temporal essencial fica truncada em um controle que nem é editável. É um microdefeito diretamente incompatível com acabamento refinado.

**Correção proposta.** Dar ao valor somente leitura largura suficiente ou apresentá-lo como texto de contexto com quebra adequada. Separar as necessidades do seletor de ano e do período completo.

**Aceite.**

- Janeiro, setembro e dezembro de 2026 ficam completos em PT; os equivalentes EN também.
- Desktop e 320px sem corte, rolagem interna ou crescimento indevido do seletor de ano.
- Zoom e aumento de fonte não ocultam o ano.

**Sobreposição.** Não identificado como coberto pelas correções #613/#713/#716.

**Limite.** Os pixels do corte foram observados; não foram medidos layout/zoom no navegador local.


**Capturas originais vistas.**

- `[80]` [CAP04-pt-BR-dark-desktop-editor-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-two-i-2f47b-PEX-with-real-source-writes-chromium/CAP04-pt-BR-dark-desktop-editor-test-data.png)
- `[101]` [test-finished-2.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-two-i-2f47b-PEX-with-real-source-writes-chromium/test-finished-2.png)

## B11 · P3 · Formulários equivalentes usam eixos de composição divergentes

**Classificação:** Inconsistência visual entre famílias. **Confiança:** Alta no layout e nas regras; recomendação é julgamento de design.

**Observação.** Em 1440px, os editores CAP02/CAP04 começam alinhados ao título da página, aproximadamente x=288; CAP07/CAP10 deslocam o formulário de 760px para o centro, aproximadamente x=458, enquanto o título continua no eixo original.

**Causa e fonte.** CAP04 define 760px sem centralização. People centraliza os estágios com margin-inline:auto; Projects faz o mesmo. O resultado não segue um contrato único de título, largura e estágio.

- [packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/opex.css:301–303](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/opex.css#L301-L303)
- [packages/app-shell/src/orchestra/chapters/sucafina/people/structure/people.css:174–178](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/people/structure/people.css#L174-L178)
- [packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/projects.css:101–104](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/projects.css#L101-L104)

**Reprodução.** Alternar entre editar OPEX, membro e projeto no mesmo viewport desktop, comparando o eixo do título, do formulário e do botão de retorno.

**Efeito.** As tarefas parecem pertencer a sistemas de composição diferentes; o deslocamento lateral é grande e sem justificativa semântica visível. É acabamento, não bloqueio funcional.

**Correção proposta.** Definir um contrato de formulário de tarefa para eixo, largura máxima, cabeçalho, distância e ações. Adotar exceções somente quando a tarefa pedir explicitamente outro estágio.

**Aceite.**

- Amostra lado a lado CAP02/04/07/10 em 1440px apresenta regra coerente documentada.
- 320px mantém ordem, espaçamento e ações completas.
- Mudança respeita os tokens e o vidro existentes; não cria outra família de sombras/cartões.

**Sobreposição.** Coordenar com a auditoria do design system do agente raiz; não é pedido de redesenho isolado de cada família.

**Limite.** Coordenadas são leitura aproximada de captura, não medição DOM. Os valores 760px e margin-inline:auto foram confirmados na fonte.


**Capturas originais vistas.**

- `[98]` [CAP02-dark-desktop-editor-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-two-i-2f47b-PEX-with-real-source-writes-chromium/CAP02-dark-desktop-editor-test-data.png)
- `[94]` [CAP04-dark-desktop-editor-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-two-i-2f47b-PEX-with-real-source-writes-chromium/CAP04-dark-desktop-editor-test-data.png)
- `[5]` [CAP07-dark-desktop-member-editor-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-three-631f5-talent-and-honest-workbooks-chromium/CAP07-dark-desktop-member-editor-test-data.png)
- `[61]` [CAP10-dark-desktop-project-editor-test-data.png](sandbox:artifact-extract/business/packages/app-shell/e2e/test-results/sucafina-design-wave-three-2c03a-es-and-exact-change-reviews-chromium/CAP10-dark-desktop-project-editor-test-data.png)

## Apoio ao relatório do agente raiz e risco separado

### N1 · UI61/UI63 e outros guard states são fallback nativo, não a UI da folha

O agente raiz viu o fallback 'Sucafina route not admitted' com Refresh access e Sign out. A string nasce no Switch nativo de owner-runtime231.tsx:308, não no harness.

Registrar leafRendered:false. O guard pode receber copy/recuperação localizada sem relaxar admissão. Não certificar Memory/Routines/Collaboration por uma imagem que só contém o guard.

- [packages/app-shell/src/orchestra/chapters/sucafina/host/owner-runtime231.tsx:265–281](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/host/owner-runtime231.tsx#L265-L281)
- [packages/app-shell/src/orchestra/chapters/sucafina/host/owner-runtime231.tsx:305–308](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/host/owner-runtime231.tsx#L305-L308)

### R1 · Risco não reproduzido: resultado assíncrono tardio em cenários/sensibilidade

Algumas operações de preview/issue/evaluate criam AbortController sem limpeza da operação ao sair da rota; validações focam geração/versão. Route teardown pode desmontar o componente e alterar o efeito real. Não foi demonstrada contaminação de caso.

Risco a testar, sem severidade fechada. Testar transporte atrasado, troca de caso/rota, teardown e resposta fora de ordem em Actions. Não relatar corrupção ou P1 sem prova.

- [packages/app-shell/src/orchestra/chapters/sucafina/portfolio/scenarios/index.tsx:162–210](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/scenarios/index.tsx#L162-L210)
- [packages/app-shell/src/orchestra/chapters/sucafina/portfolio/sensitivity/index.tsx:141–193](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/sensitivity/index.tsx#L141-L193)

## O que não foi promovido a defeito

- Algumas capturas de detalhe e de pós-save contêm um Loading de seletor/skeleton. Uma imagem de um estado pendente não demonstra espera infinita nem flakiness.
- O campo de data nativo em PT mostra mm/dd/yyyy em navegador configurado em EN; esse contraste pode depender do locale do navegador. Não se concluiu falha de localização do aplicativo sem reproduzir o ambiente apropriado.
- Conteúdo de fixture em EN/PT e valores como nomes ou No leader não foram automaticamente classificados como strings sem tradução. O produtor pode fornecer esses textos.
- Tabelas estreitas com rolagem horizontal não foram chamadas de dados inacessíveis apenas pelo recorte. Descoberta de rolagem é uma hipótese de design separada.
- O componente compartilhado de estado mantém filhos para filtered-empty. A hipótese de filtro desaparecer e prender o usuário foi descartada após leitura.
- O início aparente de um valor de input focado pode estar deslocado por rolagem interna de texto. Isso não foi reportado como truncagem geral de campos.
- A ausência de um achado específico em operações, compras, importações, documentos, memória e rotinas nesta primeira fatia não as certifica visualmente. A leitura de fonte foi ampla; a evidência de pixels deste lote é mais estreita.

## Portões de fechamento recomendados

1. Integrar os proprietários existentes antes de avaliar como novo o que #613/#713/#716 já corrigem.
2. Corrigir primeiro semântica de revisão, unidades e continuidade da jornada; então consolidar composição e microcopy.
3. Verificar cada correção no GitHub Actions em sua rota real, dados autorizados, EN/PT, dark/light e 320/1440 conforme o impacto.
4. Usar atraso e recusa de transporte apenas nos achados que dependem disso: B5 e risco R1. Para B9, cobrir entrada direta e histórico externo.
5. Comparar capturas do mesmo dado e estado. Guard/pré-requisito, pending e conteúdo renderizado precisam ter classificações diferentes.

Nenhum estado não visto deve ser marcado como aprovado. Uma captura com um guard bem alinhado não prova a qualidade da tela protegida.

## Limitações completas

- 70 superfícies/165 padrões de rota foram inventariados; 66 componentes leaf únicos foram buscados e examinados na fonte. A profundidade variou; isto não certifica cada estado.
- 103/103 PNGs fora de attachments do pacote business foram inspecionados individualmente: 97 capturas nomeadas e 6 test-finished. Oito superfícies visuais: CAP02/03/04/06/07/08/09/10.
- Capturas produzidas em cf241b8, não no SHA dev fixado. O agente raiz é responsável pela verificação de equivalência de blobs relevantes, hashes dos arquivos compactados e proveniência Actions.
- UI47/UI48/UI50/guard screenshots mencionados em achados foram observados pelo agente raiz; não estão incluídos no denominador business deste agente.
- Nenhum build, teste, aplicação de produto, browser interativo ou alteração de produto foi executado localmente. Somente leitura de fonte, leitura de imagens e escrita destas notas de auditoria.
- Ausência de defeito reportado em uma família não significa aprovação visual. Estados vazios/erro/atraso/teclado/zoom/movimento/rede não vistos não são certificados.
- Textos e dados de fixtures não foram tratados automaticamente como defeitos de tradução; captured Loading não foi tratado como loading perpétuo.
- Branches #613/#713/#716 têm proprietários ativos. A presença de um patch não equivale a sua integração no SHA dev auditado.

