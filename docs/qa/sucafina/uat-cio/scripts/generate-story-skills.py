#!/usr/bin/env python3
"""Deterministic, dependency-free materialization of one INTERNAL Orchestra skill per UAT story.

Canonical source is stories_70x2.jsonl + stories_e2e.jsonl. Never edit generated leaves
by hand: update the story and regenerate. No runtime automation, no browser control.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]  # repo root: docs/qa/sucafina/uat-cio/scripts
UAT = ROOT / "docs/qa/sucafina/uat-cio"
SKILLS = ROOT / ".orchestra/skills/sf-user-journey-qa"


def quoted(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def frontmatter(name: str, description: str, when: str | None = None,
                not_when: str | None = None) -> str:
    lines = ["---", f"name: {name}", f"description: {quoted(description)}", "internal: true"]
    if when:
        lines.append(f"when: {quoted(when)}")
    if not_when:
        lines.append(f"not-when: {quoted(not_when)}")
    return "\n".join(lines + ["---", ""])


def bullets(label: str, items: list[str], *, ordered: bool = False) -> str:
    if not items:
        return ""
    rows = [f"## {label}", ""]
    rows.extend((f"{i}. {item}" if ordered else f"- {item}") for i, item in enumerate(items, 1))
    return "\n".join(rows) + "\n\n"


def parse(filename: str) -> list[dict]:
    path = UAT / filename
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def grouping(story: dict) -> tuple[str, str, str]:
    code = story["id"]
    m = re.fullmatch(r"SF-(CAP|UI)(\d{2})-(P01|N01)", code)
    if m:
        chapter, number, variant = m.groups()
        n = int(number)
        start = (n-1)//5*5+1 if chapter == 'CAP' else 29 + ((n-29)//5)*5
        end = min(start+4, 28 if chapter == 'CAP' else 70)
        return chapter.lower(), f"{chapter.lower()}{start:02d}-{end:02d}", f"{chapter.lower()}{n:02d}-{variant.lower()}"
    m = re.fullmatch(r"SF-E2E-(\d{3})", code)
    if m:
        n = int(m.group(1))
        start = ((n-1)//9)*9+1
        return "e2e", f"e2e{start:03d}-{min(start+8,45):03d}", f"{n:03d}"
    raise ValueError(f"unrecognized story ID {code}")


def leaf(story: dict) -> tuple[Path, str, str]:
    branch, batch, segment = grouping(story)
    directory = SKILLS / branch / batch / segment
    name = f"sf-user-journey-qa-{branch}-{batch}-{segment}"
    if len(name) > 64:
        raise ValueError(f"skill name too long {name}")
    code = story["id"]
    title = story["title"]
    main_actor = story.get('actor') or 'autorizado'
    is_e2e = story["kind"] == "MULTI_ACTOR_E2E"
    desc = f"QA manutenção SF: executar story {code} ({title[:66]}) pela UI; ator {main_actor}, registrar evidência e contraprovas."
    when = f"O QA solicitou a story {code} ou o caso específico {title[:65]}"
    not_when = f"Outra story; carregue a folha que possui o ID solicitado, não esta {code}"
    out = frontmatter(name, desc, when, not_when)
    out += f"# {code} — {title}\n\n"
    out += "**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. "
    out += "**Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.\n\n"
    out += f"**Prioridade:** {story['priority']} · **Protagonista:** {main_actor}"
    if is_e2e:
        out += f" · **Outros atores:** {', '.join(x for x in story.get('actors', []) if x != main_actor)}"
    out += f" · **Superfícies:** {', '.join(story['surface_ids'])}"
    out += f" · **Jornadas:** {', '.join(story.get('journeys', []))}.\n\n"
    if is_e2e:
        cond = story.get('conditional_release_feature')
        out += f"**Dependência de release:** {cond or 'BASELINE'}; confirmar instalado, nunca presumir habilitado.\n\n"
    else:
        out += f"**Entrada UI indicada:** `{story['route']}` (rota do app-shell; confirmar owner e mount reais).\n\n"
    out += f"**Situação / dados sintéticos:** {story['fixture']}\n\n"
    out += f"**Resultado de negócio:** {story['user_story']}\n\n"
    # Common seed/auth preconditions already belong to base skill. Keep story-specific conditions.
    prec = story.get('preconditions', [])
    if is_e2e:
        prec = prec[2:] if len(prec)>2 else prec
    elif story['kind'] == 'SURFACE_PRIMARY':
        prec = prec[2:] if len(prec)>2 else prec
    out += bullets("Pré-condições específicas", prec)
    out += bullets("Passos a executar na interface", story.get('steps', []), ordered=True)
    out += bullets("Oráculos observáveis (não reescrever para passar)", story.get('expected', []))
    neg = story.get('contraprovas') or ([story['negative_expected']] if story.get('negative_expected') else [])
    out += bullets("Contraprovas", neg)
    if story.get('test_refs'):
        out += f"**Fontes de teste existentes:** {', '.join(story['test_refs'])}. Reusar para diagnosticar, não substituir a execução da UI.\n\n"
    out += ("**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, ")
    out += ("estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo ")
    out += ("`docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. ")
    out += ("Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.\n")
    return directory / 'SKILL.md', out, name


def tree_index(kind: str, folder: str, children: list[dict] | None = None) -> tuple[Path, str, str]:
    parts = [kind, folder] if folder else [kind]
    path = SKILLS.joinpath(*parts, 'SKILL.md')
    name = 'sf-user-journey-qa-' + '-'.join(parts)
    if not folder:
        titles = {'cap': 'CAP01–CAP28: capacidades originais, casos P01/N01',
                  'ui': 'UI29–UI70: superfícies novas, casos P01/N01',
                  'e2e': 'E2E-001–045: histórias multiator de negócio'}
        title=titles[kind]
    else:
        title=f"Casos {folder}: selecionar pela identidade exata da story"
    fm=frontmatter(name, f"Índice interno QA/manutenção SF: {title}.",
                    f"O ID da story pertence ao grupo {folder or kind}",
                    "A story pertence a outro grupo; navegue pelo índice raiz e escolha o grupo correto")
    text = fm + f"# {title}\n\n"
    text += ("Escolha a **story exata pelo ID** no índice 'Next level' gerado pelo Orchestra; "
             "não execute todos os casos por carregar este índice. Cada folha contém situação, atores, passos, "
             "oráculos e contraprovas. Base operacional compartilhada: `sf-user-journey-qa`.\n")
    return path,text,name



def group_manifest(primary: list[dict], e2e: list[dict]) -> list[dict]:
    manifest = json.loads((UAT / 'story-groups.json').read_text(encoding='utf-8'))
    if manifest.get('schema') != 'sf-uat-story-groups-v1':
        raise ValueError('invalid group manifest schema')
    groups = manifest.get('groups')
    if not isinstance(groups,list) or len(groups)!=10:
        raise ValueError('expected exactly 10 bounded groups (smoke + 9 domain packs)')
    by_id={s['id']:s for s in primary+e2e}
    known_chapters={s['chapter'] for s in primary}
    group_ids=set(); covered=set(); all_e2e=set()
    for group in groups:
        slug=group.get('id')
        if not isinstance(slug,str) or not re.fullmatch(r'[a-z][a-z-]*',slug) or slug in group_ids:
            raise ValueError(f'duplicate or invalid group id: {slug}')
        group_ids.add(slug)
        chapters=group.get('chapters',[])
        if not isinstance(chapters,list) or set(chapters)-known_chapters:
            raise ValueError('unknown chapters: '+str(chapters))
        surfaces=group.get('extra_surfaces',[])
        if not isinstance(surfaces,list):raise ValueError('invalid extra_surfaces')
        e2es=group.get('e2e_ids',[])
        if not isinstance(e2es,list):raise ValueError('invalid e2e_ids')
        members=[s['id'] for s in primary if s['chapter'] in chapters or any(u in surfaces for u in s['surface_ids'])]
        members.extend(e2es)
        if len(members)!=len(set(members)) or not members:
            raise ValueError('duplicate or empty group: '+slug)
        if any(i not in by_id for i in members):
            raise ValueError('unknown story ID in '+slug)
        if any(i not in {s['id'] for s in e2e} for i in e2es):
            raise ValueError('invalid E2E id in '+slug)
        if slug=='smoke' and (len(members)>10 or any(by_id[i]['priority']!='P0' for i in members)):
            raise ValueError('smoke must contain <=10 P0 stories')
        if len(members)>40:raise ValueError('unbounded group: '+slug)
        group['_members']=members
        covered.update(members)
        all_e2e.update(e2es)
    if covered!=set(by_id):
        raise ValueError('group coverage gap: '+str(sorted(set(by_id)-covered)))
    if all_e2e!={s['id'] for s in e2e}:
        raise ValueError('E2E not assigned to a group')
    return groups


def group_nodes(groups: list[dict], by_id: dict[str,dict]) -> dict[Path,str]:
    generated={}
    path=SKILLS / 'groups' / 'SKILL.md'
    name='sf-user-journey-qa-groups'
    fm=frontmatter(name, 'Grupos internos de stories do Orchestra-SF: smoke, domínios ou acesso. Executar somente o grupo solicitado.',
                   'O QA quer um grupo de stories, smoke ou regressão por domínio',
                   'O QA pediu uma story individual; use CAP/UI/E2E, não um grupo')
    generated[path]=fm+'''# Campanhas seletivas de QA / manutenção SF

**Não é uma função para usuários da Sucafina.** Cada filho é uma campanha de manutenção que aponta para skills individuais. Um grupo só é executado quando o QA o solicitar explicitamente.

Seleção: para regressão rápida, abrir `smoke`; para mudanças localizadas, abrir o domínio impactado; para uma única story, usar a folha CAP/UI/E2E correspondente. **Não rodar todos os grupos por padrão.**

Ao executar vários grupos, deduplicar stories já executadas **apenas** se SHA, fixture, instalação, versão de dados e perfis forem idênticos; caso contrário, executar novamente. `PASSED_WITH_EVIDENCE` exige UI real e observadores independentes. Nunca converter testes estáticos em PASS.

Os conteúdos, papéis e oráculos ficam nas 185 folhas; as listas de grupo não os duplicam. Fonte de verdade dos grupos: `docs/qa/sucafina/uat-cio/story-groups.json`.
'''
    for group in groups:
        slug=group['id']
        members=group['_members']
        name=f'sf-user-journey-qa-groups-{slug}'
        if len(name)>64:raise ValueError('group skill too long '+name)
        fm=frontmatter(name,'Grupo de manutenção SF '+slug+': '+group['title']+'. '+group['trigger'][:110],
                 'Quando o QA solicitar grupo '+slug+' ou mudança em '+group['title'],
                 'Outro domínio ou uma única story; abra o grupo correto ou folha individual')
        rows=[fm+f"# {group['title']}\n\n",'**Uso:** QA/manutenção interna. **Não iniciar ao carregar a skill:** esta folha define a seleção; só executar stories quando houver ordem explícita de execução do grupo.\n\n',f"**Quando selecionar:** {group['trigger']}\n\n",f"**Tamanho:** {len(members)} stories; nenhum roteiro foi executado por esta lista.\n\n",'## Ordem sugerida (skill individual por story)\n\n']
        for number,id in enumerate(members,1):
            story=by_id[id]
            _,_,_=grouping(story)
            story_skill='sf-user-journey-qa-'+'-'.join(grouping(story))
            cond=story.get('conditional_release_feature')
            rows.append(f"{number}. **{id}** · `{story_skill}` · {story['title']} ({story['priority']})"+(f" · **CONDICIONAL:** {cond}" if cond else '')+'\n')
        rows.append('''
## Protocolo deste grupo

1. Carregue `sf-user-journey-qa` (protocolo compartilhado) e identifique a versão instalada, os atores e a fixture isolada. Navegue via as skills CAP/UI/E2E existentes (não copie seus passos). O instrumento `skill` aceita o **nome exato** da folha; alternativamente percorra o índice `Next level` quando for mais conveniente.
2. **Execute só as stories deste grupo**, na ordem acima, uma tentativa por story. Antes de cada uma, comprovar precondições e isolamento; se uma story depende de uma transação anterior, use estado autorizado e documentado, nunca mutação oculta.
3. Em falha P0, interromper o grupo e reportar o restante `NOT_RUN`/`BLOCKED`, a menos que o QA tenha autorizado diagnóstico mais amplo. Para recurso condicional não promovido, marcar `BLOCKED_CAPABILITY` e seguir apenas casos independentes.
4. Registre status e evidência por story, nunca um PASS único para o grupo. O grupo só é `PASS` se todas as stories exigidas foram verificadas na mesma campanha/ambiente/versão, com evidências; não deduzir de testes estáticos.

**Sem execução implícita de outros grupos, sem novo runner, sem bypass de UX.**
''')
        generated[SKILLS / 'groups' / slug / 'SKILL.md']=''.join(rows)
    return generated


def build() -> dict[Path,str]:
    p=parse('stories_70x2.jsonl')
    q=parse('stories_e2e.jsonl')
    if len(p) != 140 or len(q) != 45 or len({s['id'] for s in p+q}) != 185:
        raise ValueError("unexpected story count or duplicate IDs")
    outputs: dict[Path,str] = {}
    seen=set()
    batches: dict[str,set[str]] = {}
    branches=set()
    for story in p+q:
        path,s,name = leaf(story)
        if name in seen or path in outputs:
            raise ValueError(f"duplicate skill {name}")
        outputs[path]=s
        seen.add(name)
        kind,group,_=grouping(story)
        branches.add(kind)
        batches.setdefault(kind,set()).add(group)
    for kind in sorted(branches):
        path,s,name=tree_index(kind,"")
        outputs[path]=s
        seen.add(name)
        for group in sorted(batches[kind]):
            path,s,name=tree_index(kind,group)
            outputs[path]=s
            seen.add(name)
    groups=group_manifest(p,q)
    outputs.update(group_nodes(groups,{item['id']:item for item in p+q}))
    # Same limit used by Orchestra seat skill trees: no node with >10 children; 4 levels max.
    parents=Counter(path.parent for path in outputs)
    if max(parents.values()) > 10:
        raise ValueError(f"index bloat: more than 10 children {parents}")
    if len(outputs) != 219:
        raise ValueError(f"expected 185 leaves + 23 indexes + 11 group nodes, got {len(outputs)}")
    return outputs


def main() -> int:
    ap=argparse.ArgumentParser()
    ap.add_argument('--check',action='store_true',help='only inspect files; do not write')
    ap.add_argument('--list-group',choices=[x['id'] for x in json.loads((UAT/'story-groups.json').read_text())['groups']],help='print only the selected group IDs; no execution')
    args=ap.parse_args()
    if args.list_group:
        groups=group_manifest(parse('stories_70x2.jsonl'),parse('stories_e2e.jsonl'))
        group=next(x for x in groups if x['id']==args.list_group)
        print(json.dumps({'group':group['id'],'status':'NOT_RUN','story_count':len(group['_members']),'stories':group['_members']},ensure_ascii=False,indent=2))
        return 0
    outputs=build()
    missing=[]
    drift=[]
    for path,content in outputs.items():
        if args.check:
            if not path.is_file(): missing.append(str(path.relative_to(ROOT)))
            elif path.read_text(encoding='utf-8')!=content: drift.append(str(path.relative_to(ROOT)))
        else:
            path.parent.mkdir(parents=True,exist_ok=True)
            path.write_text(content,encoding='utf-8')
    if args.check and (missing or drift):
        print(json.dumps({'ok':False,'missing':missing[:10],'drift':drift[:10],
                          'count_missing':len(missing),'count_drift':len(drift)},ensure_ascii=False))
        return 1
    print(json.dumps({'ok':True,'stories':185,'new_nodes':len(outputs),'index_nodes':len(outputs)-185-11,'group_nodes':11,
                      'generated':not args.check},ensure_ascii=False))
    return 0

if __name__=='__main__':sys.exit(main())
