# Flamengo (DEMO) — organização sintética para Orchestra-SF

**Estado do pacote:** fixtures e seed implementados; provas de tenant/VM/F04/AM **PENDING**. Nenhuma prova de ponta a ponta foi executada por este branch. **Não é afiliado ao Clube de Regatas do Flamengo.** Nada aqui representa orçamento, contrato, funcionário, transação, fornecedor ou jogador reais.

## Escopo e fonte autoritativa

Fonte revisada: `close-final-candidate@42d344a0efc4d85187388f149c54acac2db171da`. Todas as mudanças ficam em `sf/demo/flamengo/**`; o seed opera somente por serviços, comandos e imports do produto, jamais grava em banco. Em outro SHA de produto, o contrato precisa de nova revisão.

- `org.json`: raiz Flamengo → três diretorias → seis departamentos → dois centros de custo por departamento, budget e forecast por mês (BRL); seis personas com privilégios pretendidos. IDs de principal são **null**, não fabricados.
- `catalog.json`: cinco categorias, dez fornecedores **fictícios**, dez referências contratuais com datas e tetos, dois conjuntos de cotações e taxa de câmbio **sintética** BRL→USD. EUR ausente intencionalmente.
- `scenarios.json`: dez PRs transicionáveis (draft, pr_pending, sourcing, src_pending, po_draft, po_pending, po_approved, pr_rejected, EUR sem FX e revisão CAS), sete linhas OPEX, três cenários financeiros, dois casos de decisão com alternativas/sensibilidade como **insumo**, relatório, import e duas rotinas pendentes. Estados finais são alvos, não snapshots forjados.
- `seed.mjs`: CLI real, dry-run por padrão; real Settings/Suppliers/Requests/CAS, Dashboard OPEX/CAPEX, Planner OPEX e XLSX admit→preview→detail→Apply→receipt, decisão draft, DOCX e 403 de Zico. **Não** declara aprovadas alternativas ou rotinas que não foram admitidas.
- `schedule-native.ts`: integração exclusiva in-process pelo `createRoutineSchedule`/host, com identidade UI confiável e read-before-create; não expõe endpoint improvisado nem usa banco. Exige composição com owner real.
- `validate.mjs`: validação referencial e determinística offline; não constitui prova de integração.
- `TRACEABILITY.md`: matriz de evidências, resultados esperados e portas faltantes para os casos da campanha.

## Atores / grupos (o tenant é a fonte de verdade)

| Rótulo de fixture | Dashboard | Planner | Procurement |
| --- | --- | --- | --- |
| Daniel | admin | admin | admin |
| Caio | contributor | sem grupo | requester |
| Pedro | sem grupo | sem grupo | buyer |
| Gabriel | sem grupo | sem grupo | approver |
| Sofie | viewer | finance | sem grupo |
| Zico | **sem grupo / 403** | **sem grupo / 403** | **sem grupo / 403** |

**Os nomes acima são rótulos fornecidos pelo dono, não credenciais nem prova de ligação à conta.** O setup real de Entra/grupos e a correspondência com seis sessões *já autenticadas* precisam ser atestados pelo dono. O seed extrai o holder Gabriel da diretoria autenticada apresentada no formulário original, não inventa um UUID. Não versionar e-mails, OIDs, passwords, cookies, IDs de tenant ou dados reais.

## Executar

No checkout com dependências do workspace instaladas (ExcelJS de `modules/sucafina`), executar:

```sh
node sf/demo/flamengo/validate.mjs
node sf/demo/flamengo/seed.mjs
```

O primeiro valida o modelo offline. O segundo imprime inventário e todas as fases como `PENDING` sem rede. Para uma instalação **sintética e isolada** já autenticada, o owner fornece fora do Git (ex.: runner protegido, variáveis do cofre): `SF_DEMO_BASE_URL` (URL do mount real, terminando em `/sucafina`), `SF_DEMO_ALLOW_HOST` (hostname exato), `SF_DEMO_ISOLATED_INSTALLATION=yes` e `SF_DEMO_DANIEL_COOKIE`, `SF_DEMO_CAIO_COOKIE`, `SF_DEMO_PEDRO_COOKIE`, `SF_DEMO_GABRIEL_COOKIE`, `SF_DEMO_SOFIE_COOKIE`, `SF_DEMO_ZICO_COOKIE` conforme a fase. Cookies **não** entram em argumentos nem em logs. Origem HTTPS obrigatória fora de loopback; redirects/401/403 nunca são convertidos em sucesso.

```sh
node sf/demo/flamengo/seed.mjs --apply --strict --phase=settings,suppliers,procurement,planner,dashboard,imports,decisions,reports,denial,schedules
```

Não usar esse comando em tenant ou dataset de produção, mesmo com `--apply`. Não configurar o ambiente para contornar 403. As fases que falharem continuam `PENDING` e a CLI devolve exit 2. `--phase=planner` e `--phase=imports` podem ser rodadas separadamente; o alvo XLSX deve vir da descoberta real `?sf=import-targets`; se ambíguo, o owner fornece `SF_DEMO_PLANNER_SELECTION_REF` selecionado entre os retornados. O único Apply é explícito com `--apply` e o recibo é relido no produtor. Não repetir sem inspecionar recibos anteriores se a resposta caiu após o commit.

### Operações reais verificadas em código

- Legacy command: `POST {mount}/{surface}` com `{page,action,id?,version,values}` e cookie/origin reais; CAS `409` e autorização `403` não são ignorados. `GET procurement?download=register` e `?download=suppliers` dão read-before-create para não duplicar requisições ou fornecedores.
- Planner `Versions`, `OPEX`; Dashboard `OPEX Detail` e `CAPEX Projects` são os produtores, não uploads no banco. Import apenas por `sf=import-targets`, `sf=import-admit`, `sf=import-preview`, `sf=import-detail`, `sf=import-apply`; source: `product/imports/workbench-script.ts` e `product/imports/FORMATS.md`.
- Workbench decisões usa apenas `POST dashboard?sf=workbench-command` com operação `sf_case_draft`; alternativas/choice/apply pertencem aos controles e grants reais do produto. Relatório usa `GET dashboard?download=docx`. Sem endpoint HTTP de `schedule-create` no roteador `product/interface/http.ts`.
- A máquina de Procurement (`porta/act.ts`) é a autoridade do estágio. A criação não inicia sourcing; aprovações e rejeições são atos de Gabriel, sourcing/PO de Pedro. EUR sem FX deve resultar em 422 sem avançar; tentativa de revisão com versão antiga deve resultar em 409.

### Idempotência e limites de segurança

As PRs são reconciliadas por título único no registro real; fornecedores por legalName; linhas Planner usam IDs estáveis; Dashboard reconcilia nomes e lê IDs gerados pelo produtor; Settings só são atualizados quando a configuração de demo não está presente. Nenhuma rotina manda `INSERT`, realiza reset, ignora conflito ou emite pedido a fornecedor. O script interrompe em estado anterior ambíguo; não retrocede histórico. Versão oficial e dados compartilhados existentes bloqueiam a inicialização automática do Planner. Provas de import exigem comparação humana dos detalhes antes de promover Apply fora de uma instalação descartável.

**Não confundir** dados do fixture com autorização: o script só pode comprovar a sessão que o operador lhe entregou. Não atesta sozinho o subject real do Entra, nem que a instalação é isolada: ambos exigem evidência do A8/owner. As duas decisões são semeadas como *drafts*; alternativas e sensitividades **não** se tornam decisões gravadas só porque constam em JSON. Contratos do catálogo não são contratos de fornecedores ativados; não há KYC, abertura de conta nem pagamento.

## Faltas para uma prova end-to-end válida

1. O owner provisiona um ambiente realmente isolado, assinatura/VM, host no SHA candidato congelado C, instância e sessão Entra real de cada ator, prova de grupos/owners e origem.
2. A9 compõe o `sf2h.native-installed-manifest.v1` privado F04, com permissão 0600 e vínculo com C, e executa U39/U40/Q01 + AM01–06 no **mesmo** C, com receipts e resultados reais. Este branch não executa esse gate e não edita testes protegidos.
3. Validar o contrato de cada superfície via consumidor real: fontes U39/U40, `UI-OPERATIONS` (incluindo imports), `UI-DECISIONS` (alternativas e choice), `UI-REPORTS` (drilldown e documento). Um 200 de uma página não basta.
4. Para schedules, o owner do host cria recipeRef/conditionRef reais, instala `ScheduleHost.occurrences`, admission confiável `TrustedDomainContext.kind = ui`, e executa `seedFlamengoNativeSchedules` via port original. O resultado `created` não prova C07/routine concluída.
5. C12 Apply financeiro, retenção de escolha após mutação da fonte, import de Procurement caso exista uma superfície autorizada e três negativas Q01/transport requerem testes A4/A9; *não* fabricar ou substituir por import Planner.
6. Guardar evidence com SHA C, ator, superfície, tempo, idempotency key **não secreta**, digest, resultado, auditoria e count por job; limpar cookies, autorizações, payloads privados e logs de identidade dos attachments.

## Regras de promoção

- Todos os resultados da matriz começam `PENDING`; atualize somente com IDs de run/job e prova autenticada. O fato de um seed ter sido executado **não** equivale a U39/U40/AM aprovados.
- Snapshot C, revogação, provenance, 401 vs 403, drift de origem, CAS, audit, import preview→Apply, readback e rollback são gates independentes.
- Não mexer em `sf/ci/**`, required checks, proteções, políticas/secretos do tenant ou specs de outros agentes. Este pacote não cria PR fora do próprio branch nem faz merge.
