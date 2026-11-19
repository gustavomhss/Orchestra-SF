# Handoff — finish-layout-20261119

SHA: código deste commit; base 2b37f0aabe61be42fc0bab34a33464303f968efa.
Data: 2026-11-19
Estado: partial

## Feito
- O antigo form-layout.test.ts passou a verificar o contrato atual: 28 páginas registradas e as três entradas de superfície retornam 404 e o corpo exato de descomissionamento, na instalação local autenticada original.
- Controle positivo concreto: lê CAP23 vazio, envia uma criação real pelo produtor original, exige exatamente um ID/nome/ano e relê o registro completo preservado. Sem escrita ou aprovação simulada.
- localNative ganhou apenas o POST autenticado usado pelo teste, com a mesma sessão/origem privadas da fixture existente. Não há browser nem listener nesta fatia.

## Pendente
- modules/sucafina/Sucafinav1/test/form-layout.test.ts:8: gate estreito pendente.
- Geometria do capítulo nativo não é qualificada por este teste; a aposentadoria do console não prova layout de /orchestra.

## Decisões e justificativas
- Asserções retiradas: form-layout.test.ts anterior, linhas29–130, que exigiam .metric, #content, aside.sidebar, details.editor-panel, form[data-command], dialog legado e suas medidas em1440/1024/390. O produtor HTML correspondente está descomissionado e responde404; restaurar esses elementos violaria a regra expressa do trabalho. Não se tratava de dados publicados pelo capítulo.
- Não reivindicamos equivalência entre essa geometria aposentada e a prova atual. Mantidos os registros de páginas, contagens16/7/5, sem duplicação, e adicionada a prova de dado persistido original.
- Nenhum timeout aumentado (o limite60s permanece), skip, baseline, digest, coverage ou GO produzido.
- Revisão de escopo por ci_read confirmou que transportar literalmente esse DOM recriaria o contrato proibido.

## Como retomar
Executar test-ci com package=sucafina, runner=bun, args=[Sucafinav1/test/form-layout.test.ts]. Se falhar, corrigir o acesso original/shape observado, sem reativar HTML.

## Comandos e resultados
- Auditoria [44585817131](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44585817131), job135778309562: shard8 617 pass, 3 fail, 30558 expect; falha antiga em form-layout.test.ts:32 aguardava .metric em HTML404.
- Gate após a mudança: pendente.
