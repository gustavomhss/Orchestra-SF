# Adversarial fixes — QA 360° / skills internas

**Base revisada:** PR #281, baseline `40b95470b468372a38e0cb45b68b264c5f332ea9` (antes das correções). Este documento é uma checagem de **qualidade dos artefatos**, não uma execução de usuários reais. PR permanece DRAFT.

## Defeitos reproduzidos e correções

| Achado | Correção mínima | Contraprova local |
| --- | --- | --- |
| F-01 Smoke transita para full | `smoke` agora são 4 P0 de superfícies específicas; full/release em grupo `full` owner-only | `--list-group smoke` não inclui E2E-034/040; manifest injeta E2E-034 em smoke → falha |
| F-02 Skill órfã descoberta | `--check` compara o conjunto gerado com todos os `SKILL.md` gerenciados; operação de escrita falha diante de órfão, sem apagar código do usuário | skill inventada em subtree gerada → exit 1; remoção → exit 0 |
| F-03 Orientação contraditória | Proibida nova **duplicação de skills**, não a skill por story definida pelo owner | busca do texto antigo na base retorna zero |
| F-04 Actor bindings decorativos | contar apenas identidades com provas; recusar bindings não usados e verificar três papéis incompatíveis em Procurement | 1 principal em proofs + 2 decorativos → recusa; 3 separados → admissível para revisão externa |
| F-05 Exit code do verificador | report-only exit 0 para NOT_RUN, invalid exit 1, strict incomplete exit 2, always no releaseGo | testes de subprocesso Node |
| F-06 Oracle não independente | calcula menor preço elegível de A/B/C com conversão EUR×FX em centavos; não aceita `expectedWinner` fornecido | C elegível/menor → C; `D-inexistente` → erro |
| F-07/12 Ferramentas e contraprovas | classificar passos como UI_ACTION / CONTROLLED_FAULT / READ_ONLY_WITNESS; ancorar 10 casos P0 negativos com setup real e classificação de capacidade | geração determinística e skill-base bloqueiam fault sem harness |
| F-08 Checkpoint | grupo exige before/after, SHA/fixture/atores, evidenceRef e resumableFrom por story; sem reutilizar credenciais ou provas divergentes | verificação estática dos grupos |
| F-09 Internal ≠ permissão | `internal:true` só oculta a entrada do catálogo; sessão QA precisa regras próprias, scopes exatos e ferramentas permitidas | impedir execução se grants/browser não disponíveis |
| F-10 Prompt injection | texto de UI não é comando ao agente; cenário sintético na story UI59-N01 | insumo não modifica ação nem veredito; execução real ainda pendente |
| F-11 CI sem check | um passo de integridade dentro do preflight existente; **sem novo job** | `generate-story-skills.py --check` + `node --test` |
| F-13 ZIP histórico | README identifica ZIPs V1/V2 como snapshots; branch é fonte canônica atual | conferência de links |

## Limites permanecem

- **Nenhum** login Entra, upload, falha de Graph, perda de resposta real ou jornada UI foi executado por estas correções; o browser Dock `look/find/act/wait/navigate` não suporta file chooser nem fault injection sozinho.
- A classificação das etapas ajuda a escolher ferramentas, **não** concede acesso. Se faltar perfil, grant, ferramenta ou fonte para fazer um passo, o status é `BLOCKED_ENVIRONMENT`/`BLOCKED_CAPABILITY`, não PASS.
- Os testes de Node e Python aferem somente documentos e evidência sintética. CI de produto pode permanecer vermelho por defeitos independentes. Nenhuma aprovação de release é deduzida de `internal:true`, de SHA correto ou de recibo textual.
- Repositório GitHub reportado public; confirmar intenção antes de qualquer evidência de tenant. Dados persistidos em Git devem continuar 100% fictícios.

**Princípio:** um mecanismo existente para navegar, um gerador derivado das stories, um formato de evidência e execução seletiva. Sem segundo seed, segundo navegador ou novas contagens infladas.
