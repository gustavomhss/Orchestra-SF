# Mapa das jornadas de decisões após a auditoria

## Por que o caso foi separado

O teste anterior, `wave four decisions: real sources, retained drafts, uncertainty and native review`, combinava gravação, retenção de rascunhos, 24 aberturas para a matriz visual EN e oito aberturas PT em um único ciclo de vida. A execução original [45221845895](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45221845895) mediu aproximadamente 40 segundos por admissão e leitura de caso e 254 segundos até concluir a revisão/gravação de UI34. Esse custo torna a soma das jornadas incompatível com o teto anterior de 780 segundos por caso.

A divisão conserva os produtores, o seed `four-decisions`, o enrollment e os contratos originais. Cada caso recebe uma instalação isolada e nova do mesmo fixture. Tema e viewport reutilizam a folha já admitida; os oráculos de conteúdo, contexto, ações, tamanho e alinhamento são repetidos depois de cada mudança visual.

## Antes e depois

| Oráculo ou captura anterior | Caso responsável após a divisão |
| --- | --- |
| UI33 original, hrefs de casos admitidos, referências decodificadas pelo host, disponibilidade e snapshots de origem | `originalDecisionFixture`, executado em cada caso com a fonte original |
| UI34: restrições legíveis, códigos íntegros, rascunho retido, confirmação e gravação com CAS | `wave four decisions: original interactions, retained drafts and native review` |
| UI35: ausência real de alternativas/escolha, comparação condicionada e evidências | Mesmo caso de interações |
| UI36: filtro, estado vazio, teclado/disclosure, motivo autoral e categorias sem duplicação | Mesmo caso de interações |
| UI37: revisão retida, preparação original e distinção entre preparar, registrar e enviar | Mesmo caso de interações |
| UI38–40: admissão e proveniência da escolha, mudanças e recibos realmente ausentes | Mesmo caso de interações |
| UI41: catálogo original, seleção/modelo/limites e histórico; nenhuma análise inventada | Mesmo caso de interações |
| Oito folhas em dark desktop, light desktop e dark 390; mesmos nomes de 24 PNGs | `wave four decisions: original English dark, light and narrow views` |
| Oito folhas PT em desktop; mesmas verificações de divergências/estado vazio e nomes de PNGs | `wave four decisions: original Portuguese views and retained question review` |
| UI37 PT: revisão a 320, cancelamento e retenção do texto | Mesmo caso PT |
| Erros de página/console e tempos dos reads originais | Attachments de escopo por caso |

A matriz EN passa de três admissões por folha para uma. Em cada tema/largura, `assertScreen` conserva os mesmos oráculos de prontidão e conteúdo real, `aria-busy`, largura máxima, contexto, destino de retorno, alvo mínimo e alinhamento; `reflow` e a captura continuam presentes. A matriz visual não executa comandos de alteração.

Os casos visuais partem do seed original fresco, sem transferir o caso editado de outra execução. A verificação da gravação, versão, valores preservados e payload exato permanece na jornada de interações. Essa separação evita compartilhar estado mutável entre provas visuais independentes.

## Limites preservados

- O teto por caso continua em **780000 ms**. Agora são três casos independentes; o limite agregado do arquivo corresponde à soma desses casos.
- Os deadlines existentes de ações e DOM permanecem iguais: 15000 ms no page e 10000 ms de prontidão, com os 40000 ms já existentes em UI35/UI38.
- O fixture original conserva 190000 ms. O runner conserva um worker, uma execução e zero retries.
- Nenhuma gravação é repetida para obter aprovação. Cada comando da jornada de interações pertence à instalação isolada daquele caso.
- Os dois reads F01 e os reads F02 permanecem originais e são seguidos pelos oráculos da interface.

## Destinatários de UI37

O contexto original desta instalação pode publicar `collaboration.recipients` como indisponível. O produto corretamente não emite o POST nesse estado. O observador espera esse POST somente quando a disponibilidade original já lida no teste o declara pronto e operacional. Quando indisponível, a jornada verifica o seletor desabilitado e a opção `No recipient` / `Sem destinatário`. Nenhuma disponibilidade é fabricada.

## Integridade da refatoração

A extração está confinada ao spec existente e a este mapa. Os 172 enunciados de assertiva que já existiam antes da divisão continuam presentes; foram acrescentadas verificações de ausência de comandos nos casos de captura. O produtor, o DTO e o código do produto não mudam nesta divisão. A execução e as capturas finais são registradas no relatório do lote de produto.
