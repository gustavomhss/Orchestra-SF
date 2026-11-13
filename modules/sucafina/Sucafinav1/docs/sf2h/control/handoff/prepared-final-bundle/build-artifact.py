from pathlib import Path
import json,re
r=Path('/Users/gustavoschneiter/Documents/sucafina/sf2h-integral-20261112')
w=r/'work/stack'; out=r/'validation/final-bundle'
u=(w/'.github/inherited-workflows/test.yml.disabled').read_text(); c=(w/'.github/workflows/test-ci.yml').read_text(); recipes=json.loads((r/'plan/ci-recipes.json').read_text())
guard="github.repository == 'gustavomhss/Orchestra-SF' && github.repository_id == '1455724710' && github.ref == 'refs/heads/sf2-epic-c' && github.event_name == 'push'"
start=u.index('concurrency:');u='name: sf2-epic\n\non:\n  push:\n    branches: [sf2-epic-c]\n\n'+u[start:]
u=re.sub(r'  group: .*\n  cancel-in-progress: true',"  group: sf2-epic-${{ github.sha }}\n  cancel-in-progress: false",u,count=1)
u=u.replace('  checks: write\n','')
u=u.replace("if: github.event_name == 'workflow_dispatch' || github.event.label.name == 'epic'",'if: '+guard)
u=u.replace("if: (github.event_name != 'pull_request' && inputs.packages == '') || needs.atlas-scope.outputs.changed == 'true'",'if: '+guard+" && needs.atlas-scope.outputs.changed == 'true'")
u=u.replace("if: (github.event_name == 'workflow_dispatch' && (inputs.packages == '' || contains(format(',{0},', inputs.packages), ',@orchestra/app,'))) || github.event.label.name == 'epic'",'if: '+guard)
u=u.replace("settings: ${{ fromJSON(inputs.windows_e2e && '[{\"name\":\"linux\",\"host\":\"ubuntu-24.04\"},{\"name\":\"windows\",\"host\":\"windows-latest\"}]' || '[{\"name\":\"linux\",\"host\":\"ubuntu-24.04\"}]') }}", "settings: ${{ fromJSON('[{\"name\":\"linux\",\"host\":\"ubuntu-24.04\"}]') }}")
u=re.sub(r'(?<!\$)inputs\.packages', "''", u).replace('!inputs.cold', 'false').replace('inputs.cold', 'true')
u=u.replace('bun turbo test --filter=@orchestra/core --', 'bun turbo test --force --filter=@orchestra/core --').replace('bun turbo test --concurrency=', 'bun turbo test --force --concurrency=')
u=u.replace('if: always() && matrix.turbo\n', 'if: false\n')
# A cold bundle must not restore or save Turbo / previous-pass results.
for name in ["Restore Turbo cache", "Save Turbo cache", "Check for a previous pass", "Record the pass", "Save the pass"]:
    u = re.sub(r"      - name: " + re.escape(name) + r"\n.*?(?=\n      (?:- name:|- uses:)|\n  [a-z][a-z0-9-]*:|\Z)", "", u, flags=re.S)
u = re.sub(r"^        if: steps\.previous\.outputs\.hit != 'true'\n", "", u, flags=re.M)
u = u.replace(" && steps.previous.outputs.hit != 'true'", "")
# Reuse the repository test-ci job, preserving request/selection validation and test executor.
t=c[c.index('  test:\n'):c.index('  cleanup:\n')];t=t.replace('  test:\n','  recipe:\n',1)
start=t.index('    strategy:\n');end=t.index('    runs-on:',start)
lines=['    strategy:','      fail-fast: false','      max-parallel: 5','      matrix:','        include:']
for x in recipes['recipes']:
 req={**x['request'],'directory':x['directory'],'env':{}}
 lines += [f"          - id: {x['id']}", '            host: ubuntu-24.04', '            request: '+json.dumps(json.dumps(req,separators=(',',':')))]
t=t[:start]+'\n'.join(lines)+'\n'+t[end:];t=t.replace('    name: test (${{ matrix.host }})','    name: recipe (${{ matrix.id }})\n    if: '+guard,1)
needle='      # Extension: branch-scoped so a misrouted ARM64 request cannot skip its CPU assertion.'
insert="""      - name: Materialize validated recipe request
        env:
          REQUEST: ${{ matrix.request }}
        run: |
          node -e 'const fs = require("node:fs"); const r = JSON.parse(process.env.REQUEST); fs.writeFileSync(".ci-run.json", JSON.stringify(r))'

"""
t=t.replace(needle,insert+needle,1)
t=t.replace('name: playwright-${{ matrix.host }}-${{ github.run_attempt }}','name: recipe-${{ matrix.id }}-playwright-${{ github.run_attempt }}')
t=t.replace('name: lean-visual-${{ runner.os }}','name: recipe-${{ matrix.id }}-lean-${{ runner.os }}')
# Explicitly load the same omni control where the package bunfig omits it.
t=t.replace('GITHUB_ACTIONS=false bun test --conditions=solid "${unit[@]}" "${common[@]}"', 'GITHUB_ACTIONS=false bun test --conditions=solid --preload ../../script/test-omni-control.ts "${unit[@]}" "${common[@]}"')
t=t.replace('GITHUB_ACTIONS=false bun test "${args[@]}"', 'if [ "$DIRECTORY" = "modules/atlas/boundary" ]; then\n              GITHUB_ACTIONS=false bun test --preload ../../../script/test-omni-control.ts "${args[@]}"\n              exit $?\n            fi\n            GITHUB_ACTIONS=false bun test "${args[@]}"')
# Capture and enforce the repository's nonce-bound omni verdict for every Bun recipe.
run_start = t.index("        run: |\n", t.index("      - name: Run tests\n")) + len("        run: |\n")
run_end = t.index("\n      - name: Upload Lean", run_start)
body = t[run_start:run_end]

t = t[:run_start] + "          set -o pipefail\n          {\n" + body + r'''
          } 2>&1 | tee "$GITHUB_WORKSPACE/test-ci-evidence/recipe-run.log"
          if [ "$RUNNER" = bun ]; then
            count=$(grep -Fc "omni positive control [$ORCHESTRA_OMNI_CONTROL_NONCE]:" "$GITHUB_WORKSPACE/test-ci-evidence/recipe-run.log" || true)
            [ "$count" = 1 ] || { echo '::error::missing or repeated nonce-bound omni verdict'; exit 1; }
            grep -F "omni positive control [$ORCHESTRA_OMNI_CONTROL_NONCE]:" "$GITHUB_WORKSPACE/test-ci-evidence/recipe-run.log" | grep -Eq ': (pass|not applicable) \(' || { echo '::error::omni verdict failed'; exit 1; }
          fi
''' + t[run_end:]

t += """      - name: Upload recipe request and log
        if: always()
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
        with:
          name: recipe-${{ matrix.id }}-request-log-${{ github.run_attempt }}
          path: test-ci-evidence
          if-no-files-found: error
          retention-days: 7
"""
# Execute mandatory explicit static gates independently on exactly the same checkout.
static=f'''  sf-static:
    if: {guard}
    name: SF static and typechecks
    runs-on: ubuntu-24.04
    timeout-minutes: 45
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5
        with:
          fetch-depth: 0
      - uses: ./.github/actions/setup-bun
      - name: Verify generated Atlas before generation
        working-directory: modules/atlas/boundary
        run: bun run check:generated
      - name: Generate Atlas and verify unchanged
        working-directory: modules/atlas/boundary
        run: |
          bun run generate
          git diff --exit-code -- .
      - name: Typecheck Atlas
        working-directory: modules/atlas/boundary
        run: bun typecheck
      - name: Typecheck Sucafina
        working-directory: modules/sucafina
        run: bun typecheck
      - name: Typecheck Core
        working-directory: packages/core
        run: bun typecheck
      - name: Typecheck CLI
        working-directory: apps/cli
        run: bun typecheck
      - name: Typecheck app
        working-directory: packages/app-shell
        run: bun typecheck
      - name: Fetch guard base
        run: git fetch origin +dev:refs/remotes/origin/dev
      - name: Guardrails at C
        run: |
          mkdir -p guard-evidence
          set +e
          bun run check:guards --base origin/dev > guard-evidence/stdout-stderr.log 2>&1
          status=$?
          set -e
          cat guard-evidence/stdout-stderr.log
          GUARD_STATUS="$status" node -e 'const fs=require("node:fs"),cp=require("node:child_process"); const actual=cp.execFileSync("git",["rev-parse","HEAD"],{{encoding:"utf8"}}).trim(); const base=cp.execFileSync("git",["rev-parse","origin/dev"],{{encoding:"utf8"}}).trim(); fs.writeFileSync("guard-evidence/receipt.json",JSON.stringify({{candidate:process.env.GITHUB_SHA,checkout:actual,base,status:Number(process.env.GUARD_STATUS),command:"bun run check:guards --base origin/dev"}},null,2)); if(actual!==process.env.GITHUB_SHA) process.exit(1)'
          exit "$status"
      - name: Spawn import gate
        run: bun run check:spawn-imports
      - name: Upload C guard evidence
        if: always()
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
        with:
          name: guard-c-${{{{ github.sha }}}}-${{{{ github.run_attempt }}}}
          path: guard-evidence
          if-no-files-found: error
          retention-days: 14
'''
final=f'''  bundle-result:
    if: always() && {guard}
    needs: [plan, atlas-scope, atlas, omni, unit-rest, e2e, recipe, sf-static]
    runs-on: ubuntu-24.04
    timeout-minutes: 5
    steps:
      - name: Require all gates on this run
        env:
          RESULTS: ${{{{ toJSON(needs) }}}}
        run: |
          node -e 'const n=JSON.parse(process.env.RESULTS); const bad=Object.entries(n).filter(([,v])=>v.result!=="success"); if(bad.length) {{ console.error(JSON.stringify(bad)); process.exit(1) }}'
'''
(out/'sf2-epic.yml').write_text(u+'\n'+t+'\n'+static+'\n'+final)
