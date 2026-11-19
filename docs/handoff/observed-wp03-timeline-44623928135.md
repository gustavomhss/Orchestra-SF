# WP03 planner4 original timeline

Read-only source run44623928135, artifact14577074454, snapshot106afd29068c0034dc2b48821b509d9689d98917. No rerun.

Embedded payloads: 1

## Original WP03 report

```json
{
  "testId": "f615f93066b00a759654-4ee5fb3564ba17f0fd20",
  "title": "real mounted Planner preserves monthly edits, filters and official-version controls",
  "projectName": "chromium",
  "location": {
    "file": "sucafina/wp03/planner-mounted.spec.ts",
    "line": 11,
    "column": 1
  },
  "duration": 184676,
  "annotations": [],
  "tags": [],
  "outcome": "unexpected",
  "path": [],
  "results": [
    {
      "duration": 184676,
      "startTime": "2026-11-19T22:06:41.794Z",
      "retry": 0,
      "steps": [
        {
          "title": "Before Hooks",
          "startTime": "2026-11-19T22:06:41.797Z",
          "duration": 3347,
          "steps": [
            {
              "title": "Fixture \"browser\"",
              "startTime": "2026-11-19T22:06:41.803Z",
              "duration": 3303,
              "steps": [
                {
                  "title": "Launch browser",
                  "startTime": "2026-11-19T22:06:41.806Z",
                  "duration": 3300,
                  "steps": [],
                  "count": 1,
                  "skipped": false
                }
              ],
              "count": 1,
              "skipped": false
            },
            {
              "title": "Fixture \"context\"",
              "startTime": "2026-11-19T22:06:45.107Z",
              "duration": 8,
              "steps": [
                {
                  "title": "Create context",
                  "startTime": "2026-11-19T22:06:45.109Z",
                  "duration": 5,
                  "steps": [],
                  "count": 1,
                  "skipped": false
                }
              ],
              "count": 1,
              "skipped": false
            },
            {
              "title": "Fixture \"page\"",
              "startTime": "2026-11-19T22:06:45.116Z",
              "duration": 28,
              "steps": [
                {
                  "title": "Create page",
                  "startTime": "2026-11-19T22:06:45.118Z",
                  "duration": 26,
                  "steps": [],
                  "count": 1,
                  "skipped": false
                }
              ],
              "count": 1,
              "skipped": false
            }
          ],
          "count": 1,
          "skipped": false
        },
        {
          "title": "the real CLI serves the isolated local-operator installation",
          "startTime": "2026-11-19T22:06:45.251Z",
          "duration": 3943,
          "steps": [
            {
              "title": "the real CLI serves the isolated local-operator installation",
              "startTime": "2026-11-19T22:06:45.292Z",
              "duration": 9,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/installation-fixture.ts",
                "line": 85,
                "column": 5
              },
              "error": "Error: the real CLI serves the isolated local-operator installation\n\n\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32m\"local-operator\"\u001b[39m\nReceived: \u001b[31m\"HTTP 500\"\u001b[39m",
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  84 |\u001b[39m   \u001b[36mtry\u001b[39m {\n \u001b[90m  85 |\u001b[39m     \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(\u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  86 |\u001b[39m       \u001b[36mif\u001b[39m (exited()) \u001b[36mreturn\u001b[39m \u001b[32m`CLI exited: ${state.error?.message ?? child.exitCode ?? child.signalCode}`\u001b[39m"
            },
            {
              "title": "the real CLI serves the isolated local-operator installation",
              "startTime": "2026-11-19T22:06:45.409Z",
              "duration": 0,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/installation-fixture.ts",
                "line": 85,
                "column": 5
              },
              "error": "Error: the real CLI serves the isolated local-operator installation\n\n\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32m\"local-operator\"\u001b[39m\nReceived: \u001b[31m\"HTTP 500\"\u001b[39m",
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  84 |\u001b[39m   \u001b[36mtry\u001b[39m {\n \u001b[90m  85 |\u001b[39m     \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(\u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  86 |\u001b[39m       \u001b[36mif\u001b[39m (exited()) \u001b[36mreturn\u001b[39m \u001b[32m`CLI exited: ${state.error?.message ?? child.exitCode ?? child.signalCode}`\u001b[39m"
            },
            {
              "title": "the real CLI serves the isolated local-operator installation",
              "startTime": "2026-11-19T22:06:45.667Z",
              "duration": 3,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/installation-fixture.ts",
                "line": 85,
                "column": 5
              },
              "error": "Error: the real CLI serves the isolated local-operator installation\n\n\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32m\"local-operator\"\u001b[39m\nReceived: \u001b[31m\"HTTP 500\"\u001b[39m",
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  84 |\u001b[39m   \u001b[36mtry\u001b[39m {\n \u001b[90m  85 |\u001b[39m     \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(\u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  86 |\u001b[39m       \u001b[36mif\u001b[39m (exited()) \u001b[36mreturn\u001b[39m \u001b[32m`CLI exited: ${state.error?.message ?? child.exitCode ?? child.signalCode}`\u001b[39m"
            },
            {
              "title": "the real CLI serves the isolated local-operator installation",
              "startTime": "2026-11-19T22:06:46.174Z",
              "duration": 0,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/installation-fixture.ts",
                "line": 85,
                "column": 5
              },
              "error": "Error: the real CLI serves the isolated local-operator installation\n\n\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32m\"local-operator\"\u001b[39m\nReceived: \u001b[31m\"HTTP 500\"\u001b[39m",
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  84 |\u001b[39m   \u001b[36mtry\u001b[39m {\n \u001b[90m  85 |\u001b[39m     \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(\u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  86 |\u001b[39m       \u001b[36mif\u001b[39m (exited()) \u001b[36mreturn\u001b[39m \u001b[32m`CLI exited: ${state.error?.message ?? child.exitCode ?? child.signalCode}`\u001b[39m"
            },
            {
              "title": "the real CLI serves the isolated local-operator installation",
              "startTime": "2026-11-19T22:06:48.177Z",
              "duration": 1,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/installation-fixture.ts",
                "line": 85,
                "column": 5
              },
              "error": "Error: the real CLI serves the isolated local-operator installation\n\n\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32m\"local-operator\"\u001b[39m\nReceived: \u001b[31m\"not-listening\"\u001b[39m",
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  84 |\u001b[39m   \u001b[36mtry\u001b[39m {\n \u001b[90m  85 |\u001b[39m     \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(\u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  86 |\u001b[39m       \u001b[36mif\u001b[39m (exited()) \u001b[36mreturn\u001b[39m \u001b[32m`CLI exited: ${state.error?.message ?? child.exitCode ?? child.signalCode}`\u001b[39m"
            },
            {
              "title": "the real CLI serves the isolated local-operator installation",
              "startTime": "2026-11-19T22:06:49.194Z",
              "duration": 0,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/installation-fixture.ts",
                "line": 85,
                "column": 5
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  84 |\u001b[39m   \u001b[36mtry\u001b[39m {\n \u001b[90m  85 |\u001b[39m     \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(\u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  86 |\u001b[39m       \u001b[36mif\u001b[39m (exited()) \u001b[36mreturn\u001b[39m \u001b[32m`CLI exited: ${state.error?.message ?? child.exitCode ?? child.signalCode}`\u001b[39m"
            }
          ],
          "location": {
            "file": "sucafina/wp03/installation-fixture.ts",
            "line": 95,
            "column": 102
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  94 |\u001b[39m       } \u001b[36mcatch\u001b[39m { \u001b[36mreturn\u001b[39m \u001b[32m\"not-listening\"\u001b[39m }\n \u001b[90m  95 |\u001b[39m     }\u001b[33m,\u001b[39m { message\u001b[33m:\u001b[39m \u001b[32m\"the real CLI serves the isolated local-operator installation\"\u001b[39m\u001b[33m,\u001b[39m timeout\u001b[33m:\u001b[39m \u001b[35m75\u001b[39m_000 })\u001b[33m.\u001b[39mtoBe(\u001b[32m\"local-operator\"\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                                     ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  96 |\u001b[39m     console\u001b[33m.\u001b[39minfo(\u001b[32m\"[sf-installed] The real CLI installation is ready\"\u001b[39m)"
        },
        {
          "title": "enroll and create the fiscal version through original commands and authorized reads",
          "startTime": "2026-11-19T22:06:49.202Z",
          "duration": 9305,
          "steps": [
            {
              "title": "The selected host must expose real installation discovery",
              "startTime": "2026-11-19T22:06:49.212Z",
              "duration": 0,
              "steps": [],
              "location": {
                "file": "sucafina/installed-shell.ts",
                "line": 37,
                "column": 88
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 36 |\u001b[39m   })\n \u001b[90m 37 |\u001b[39m   expect(response\u001b[33m.\u001b[39mstatus\u001b[33m,\u001b[39m \u001b[32m\"The selected host must expose real installation discovery\"\u001b[39m)\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m    |\u001b[39m \u001b[31m\u001b[1m                                                                                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 38 |\u001b[39m   \u001b[36mconst\u001b[39m discovered \u001b[33m=\u001b[39m \u001b[33mSchema\u001b[39m\u001b[33m.\u001b[39mdecodeUnknownSync(\u001b[33mSfInstallationList\u001b[39m\u001b[33m,\u001b[39m { onExcessProperty\u001b[33m:\u001b[39m \u001b[32m\"error\"\u001b[39m })(\u001b[36mawait\u001b[39m response\u001b[33m.\u001b[39mjson())"
            },
            {
              "title": "Expect \"toHaveLength\"",
              "startTime": "2026-11-19T22:06:49.214Z",
              "duration": 0,
              "steps": [],
              "location": {
                "file": "sucafina/installed-shell.ts",
                "line": 39,
                "column": 36
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 38 |\u001b[39m   \u001b[36mconst\u001b[39m discovered \u001b[33m=\u001b[39m \u001b[33mSchema\u001b[39m\u001b[33m.\u001b[39mdecodeUnknownSync(\u001b[33mSfInstallationList\u001b[39m\u001b[33m,\u001b[39m { onExcessProperty\u001b[33m:\u001b[39m \u001b[32m\"error\"\u001b[39m })(\u001b[36mawait\u001b[39m response\u001b[33m.\u001b[39mjson())\n \u001b[90m 39 |\u001b[39m   expect(discovered\u001b[33m.\u001b[39minstallations)\u001b[33m.\u001b[39mtoHaveLength(\u001b[35m1\u001b[39m)\n \u001b[90m    |\u001b[39m \u001b[31m\u001b[1m                                   ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 40 |\u001b[39m   \u001b[36mconst\u001b[39m binding \u001b[33m=\u001b[39m discovered\u001b[33m.\u001b[39minstallations[\u001b[35m0\u001b[39m]\u001b[33m!\u001b[39m"
            },
            {
              "title": "Expect \"toBe\"",
              "startTime": "2026-11-19T22:06:49.216Z",
              "duration": 0,
              "steps": [],
              "location": {
                "file": "sucafina/installed-shell.ts",
                "line": 41,
                "column": 32
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 40 |\u001b[39m   \u001b[36mconst\u001b[39m binding \u001b[33m=\u001b[39m discovered\u001b[33m.\u001b[39minstallations[\u001b[35m0\u001b[39m]\u001b[33m!\u001b[39m\n \u001b[90m 41 |\u001b[39m   expect(binding\u001b[33m.\u001b[39mpublicOrigin)\u001b[33m.\u001b[39mtoBe(installation\u001b[33m.\u001b[39morigin)\n \u001b[90m    |\u001b[39m \u001b[31m\u001b[1m                               ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 42 |\u001b[39m   expect(binding\u001b[33m.\u001b[39mmount)\u001b[33m.\u001b[39mtoBe(installation\u001b[33m.\u001b[39mmount)"
            },
            {
              "title": "Expect \"toBe\"",
              "startTime": "2026-11-19T22:06:49.217Z",
              "duration": 0,
              "steps": [],
              "location": {
                "file": "sucafina/installed-shell.ts",
                "line": 42,
                "column": 25
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 41 |\u001b[39m   expect(binding\u001b[33m.\u001b[39mpublicOrigin)\u001b[33m.\u001b[39mtoBe(installation\u001b[33m.\u001b[39morigin)\n \u001b[90m 42 |\u001b[39m   expect(binding\u001b[33m.\u001b[39mmount)\u001b[33m.\u001b[39mtoBe(installation\u001b[33m.\u001b[39mmount)\n \u001b[90m    |\u001b[39m \u001b[31m\u001b[1m                        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 43 |\u001b[39m   expect(binding\u001b[33m.\u001b[39mauthMode)\u001b[33m.\u001b[39mtoBe(\u001b[32m\"local-operator\"\u001b[39m)"
            },
            {
              "title": "Expect \"toBe\"",
              "startTime": "2026-11-19T22:06:49.218Z",
              "duration": 0,
              "steps": [],
              "location": {
                "file": "sucafina/installed-shell.ts",
                "line": 43,
                "column": 28
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 42 |\u001b[39m   expect(binding\u001b[33m.\u001b[39mmount)\u001b[33m.\u001b[39mtoBe(installation\u001b[33m.\u001b[39mmount)\n \u001b[90m 43 |\u001b[39m   expect(binding\u001b[33m.\u001b[39mauthMode)\u001b[33m.\u001b[39mtoBe(\u001b[32m\"local-operator\"\u001b[39m)\n \u001b[90m    |\u001b[39m \u001b[31m\u001b[1m                           ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 44 |\u001b[39m   \u001b[36mconst\u001b[39m contextURL \u001b[33m=\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mURL\u001b[39m(binding\u001b[33m.\u001b[39mmount \u001b[33m+\u001b[39m \u001b[32m\"/api/ui/context\"\u001b[39m\u001b[33m,\u001b[39m binding\u001b[33m.\u001b[39mpublicOrigin)"
            },
            {
              "title": "GET \"/sucafina/api/ui/context?installationId=90f0a130-5839-4d1f-9291-cbd7f56b96f7&projectId=global&hostId=9cc07ab6-eaaa-4aea-b58b-9d9efde2d571\"",
              "startTime": "2026-11-19T22:06:49.220Z",
              "duration": 1070,
              "steps": [],
              "location": {
                "file": "sucafina/installed-shell.ts",
                "line": 47,
                "column": 46
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 46 |\u001b[39m   console\u001b[33m.\u001b[39minfo(\u001b[32m\"[sf-installed] Reading the original native context\"\u001b[39m)\n \u001b[90m 47 |\u001b[39m   \u001b[36mconst\u001b[39m contextResponse \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mrequest\u001b[33m.\u001b[39m\u001b[36mget\u001b[39m(contextURL\u001b[33m.\u001b[39mtoString())\n \u001b[90m    |\u001b[39m \u001b[31m\u001b[1m                                             ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 48 |\u001b[39m   expect(contextResponse\u001b[33m.\u001b[39mstatus()\u001b[33m,\u001b[39m \u001b[32m\"The operator session must admit its original native context\"\u001b[39m)\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)"
            },
            {
              "title": "The operator session must admit its original native context",
              "startTime": "2026-11-19T22:06:50.291Z",
              "duration": 1,
              "steps": [],
              "location": {
                "file": "sucafina/installed-shell.ts",
                "line": 48,
                "column": 99
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 47 |\u001b[39m   \u001b[36mconst\u001b[39m contextResponse \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mrequest\u001b[33m.\u001b[39m\u001b[36mget\u001b[39m(contextURL\u001b[33m.\u001b[39mtoString())\n \u001b[90m 48 |\u001b[39m   expect(contextResponse\u001b[33m.\u001b[39mstatus()\u001b[33m,\u001b[39m \u001b[32m\"The operator session must admit its original native context\"\u001b[39m)\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m    |\u001b[39m \u001b[31m\u001b[1m                                                                                                  ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 49 |\u001b[39m   \u001b[36mconst\u001b[39m context \u001b[33m=\u001b[39m \u001b[33mSchema\u001b[39m\u001b[33m.\u001b[39mdecodeUnknownSync(\u001b[33mSfContextResult\u001b[39m\u001b[33m,\u001b[39m { onExcessProperty\u001b[33m:\u001b[39m \u001b[32m\"error\"\u001b[39m })(\u001b[36mawait\u001b[39m contextResponse\u001b[33m.\u001b[39mjson())"
            },
            {
              "title": "Expect \"toMatchObject\"",
              "startTime": "2026-11-19T22:06:50.310Z",
              "duration": 0,
              "steps": [],
              "location": {
                "file": "sucafina/installed-shell.ts",
                "line": 51,
                "column": 31
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 50 |\u001b[39m   \u001b[36mif\u001b[39m (context\u001b[33m.\u001b[39mstatus \u001b[33m!==\u001b[39m \u001b[32m\"ok\"\u001b[39m) \u001b[36mthrow\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mError\u001b[39m(\u001b[32m\"The isolated native context was not admitted\"\u001b[39m)\n \u001b[90m 51 |\u001b[39m   expect(context\u001b[33m.\u001b[39mvalue\u001b[33m.\u001b[39mstamp)\u001b[33m.\u001b[39mtoMatchObject({ installationId\u001b[33m:\u001b[39m binding\u001b[33m.\u001b[39minstallationId\u001b[33m,\u001b[39m projectId\u001b[33m:\u001b[39m binding\u001b[33m.\u001b[39mprojectId\u001b[33m,\u001b[39m\n \u001b[90m    |\u001b[39m \u001b[31m\u001b[1m                              ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 52 |\u001b[39m     hostId\u001b[33m:\u001b[39m binding\u001b[33m.\u001b[39mhostId\u001b[33m,\u001b[39m principalRef\u001b[33m:\u001b[39m installation\u001b[33m.\u001b[39mactorId })"
            },
            {
              "title": "Navigate to \"/\"",
              "startTime": "2026-11-19T22:06:50.312Z",
              "duration": 438,
              "steps": [],
              "location": {
                "file": "sucafina/installed-shell.ts",
                "line": 55,
                "column": 14
              },
              "count": 1,
              "skipped": false,
              "snippet": "[redacted]\n \u001b[90m 55 |\u001b[39m   \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mgoto(installation\u001b[33m.\u001b[39morigin \u001b[33m+\u001b[39m \u001b[32m\"/\"\u001b[39m\u001b[33m,\u001b[39m { waitUntil\u001b[33m:\u001b[39m \u001b[32m\"domcontentloaded\"\u001b[39m\u001b[33m,\u001b[39m timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })\n \u001b[90m    |\u001b[39m \u001b[31m\u001b[1m             ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 56 |\u001b[39m   console\u001b[33m.\u001b[39minfo(\u001b[32m\"[sf-installed] The shell document is loaded\"\u001b[39m)"
            },
            {
              "title": "Expect \"toBeVisible\" getByRole('button', { name: 'Status', exact: true }).or(getByRole('region', { name: 'Servers', exact: true }))",
              "startTime": "2026-11-19T22:06:50.753Z",
              "duration": 126,
              "steps": [],
              "location": {
                "file": "sucafina/installed-shell.ts",
                "line": 59,
                "column": 37
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 58 |\u001b[39m   \u001b[36mconst\u001b[39m recovery \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"region\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Servers\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\n \u001b[90m 59 |\u001b[39m   \u001b[36mawait\u001b[39m expect(status\u001b[33m.\u001b[39mor(recovery))\u001b[33m.\u001b[39mtoBeVisible({ timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })\n \u001b[90m    |\u001b[39m \u001b[31m\u001b[1m                                    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 60 |\u001b[39m   \u001b[36mlet\u001b[39m add\u001b[33m:\u001b[39m \u001b[33mLocator\u001b[39m"
            },
            {
              "title": "Click getByRole('region', { name: 'Servers', exact: true }).getByRole('button', { name: 'Add server', exact: true })",
              "startTime": "2026-11-19T22:06:50.882Z",
              "duration": 20,
              "steps": [],
              "location": {
                "file": "sucafina/installed-shell.ts",
                "line": 65,
                "column": 77
              },
              "count": 1,
              "skipped": false,
              "snippet": "[redacted]\n \u001b[90m 65 |\u001b[39m     \u001b[36mawait\u001b[39m recovery\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Add server\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mclick({ timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })\n \u001b[90m    |\u001b[39m \u001b[31m\u001b[1m                                                                            ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 66 |\u001b[39m     add \u001b[33m=\u001b[39m recovery\u001b[33m.\u001b[39mlocator(\u001b[32m\"form\"\u001b[39m)"
            },
            {
              "title": "Fill \"http://127.0.0.1:3000\" getByRole('region', { name: 'Servers', exact: true }).locator('form').getByLabel('Server address', { exact: true })",
              "startTime": "2026-11-19T22:06:50.904Z",
              "duration": 5,
              "steps": [],
              "location": {
                "file": "sucafina/installed-shell.ts",
                "line": 77,
                "column": 59
              },
              "count": 1,
              "skipped": false,
              "snippet": "[redacted]\n \u001b[90m 77 |\u001b[39m   \u001b[36mawait\u001b[39m add\u001b[33m.\u001b[39mgetByLabel(\u001b[32m\"Server address\"\u001b[39m\u001b[33m,\u001b[39m { exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mfill(installation\u001b[33m.\u001b[39morigin\u001b[33m,\u001b[39m { timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })\n \u001b[90m    |\u001b[39m \u001b[31m\u001b[1m                                                          ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 78 |\u001b[39m   \u001b[36mawait\u001b[39m add\u001b[33m.\u001b[39mgetByLabel(\u001b[32m\"Username (optional)\"\u001b[39m\u001b[33m,\u001b[39m { exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mfill(\u001b[32m\"orchestra\"\u001b[39m\u001b[33m,\u001b[39m { timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })"
            },
            {
              "title": "Fill \"orchestra\" getByRole('region', { name: 'Servers', exact: true }).locator('form').getByLabel('Username (optional)', { exact: true })",
              "startTime": "2026-11-19T22:06:50.910Z",
              "duration": 5,
              "steps": [],
              "location": {
                "file": "sucafina/installed-shell.ts",
                "line": 78,
                "column": 64
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 77 |\u001b[39m   \u001b[36mawait\u001b[39m add\u001b[33m.\u001b[39mgetByLabel(\u001b[32m\"Server address\"\u001b[39m\u001b[33m,\u001b[39m { exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mfill(installation\u001b[33m.\u001b[39morigin\u001b[33m,\u001b[39m { timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })\n \u001b[90m 78 |\u001b[39m   \u001b[36mawait\u001b[39m add\u001b[33m.\u001b[39mgetByLabel(\u001b[32m\"Username (optional)\"\u001b[39m\u001b[33m,\u001b[39m { exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mfill(\u001b[32m\"orchestra\"\u001b[39m\u001b[33m,\u001b[39m { timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })\n \u001b[90m    |\u001b[39m \u001b[31m\u001b[1m                                                               ^\u001b[22m\u001b[39m\u001b[0m\n[redacted]"
            },
            {
              "title": "[redacted]",
              "startTime": "2026-11-19T22:06:50.916Z",
              "duration": 2,
              "steps": [],
              "location": {
                "file": "sucafina/installed-shell.ts",
                "line": 80,
                "column": 28
              },
              "count": 1,
              "skipped": false,
              "snippet": "[redacted]\n[redacted]\n \u001b[90m    |\u001b[39m \u001b[31m\u001b[1m                           ^\u001b[22m\u001b[39m\u001b[0m\n[redacted]"
            },
            {
              "title": "[redacted]",
              "startTime": "2026-11-19T22:06:50.919Z",
              "duration": 5,
              "steps": [],
              "location": {
                "file": "sucafina/installed-shell.ts",
                "line": 81,
                "column": 20
              },
              "count": 1,
              "skipped": false,
              "snippet": "[redacted]\n[redacted]\n \u001b[90m    |\u001b[39m \u001b[31m\u001b[1m                   ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 82 |\u001b[39m   \u001b[36mawait\u001b[39m add\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m submit\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mclick({ timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })"
            },
            {
              "title": "Click getByRole('region', { name: 'Servers', exact: true }).locator('form').getByRole('button', { name: 'Save', exact: true })",
              "startTime": "2026-11-19T22:06:50.924Z",
              "duration": 47,
              "steps": [],
              "location": {
                "file": "sucafina/installed-shell.ts",
                "line": 82,
                "column": 64
              },
              "count": 1,
              "skipped": false,
              "snippet": "[redacted]\n \u001b[90m 82 |\u001b[39m   \u001b[36mawait\u001b[39m add\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m submit\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mclick({ timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })\n \u001b[90m    |\u001b[39m \u001b[31m\u001b[1m                                                               ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 83 |\u001b[39m   \u001b[36mawait\u001b[39m expect(add)\u001b[33m.\u001b[39mtoHaveCount(\u001b[35m0\u001b[39m\u001b[33m,\u001b[39m { timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })"
            },
            {
              "title": "Expect \"toHaveCount\" getByRole('region', { name: 'Servers', exact: true }).locator('form')",
              "startTime": "2026-11-19T22:06:50.972Z",
              "duration": 131,
              "steps": [],
              "location": {
                "file": "sucafina/installed-shell.ts",
                "line": 83,
                "column": 21
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 82 |\u001b[39m   \u001b[36mawait\u001b[39m add\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m submit\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mclick({ timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })\n \u001b[90m 83 |\u001b[39m   \u001b[36mawait\u001b[39m expect(add)\u001b[33m.\u001b[39mtoHaveCount(\u001b[35m0\u001b[39m\u001b[33m,\u001b[39m { timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })\n \u001b[90m    |\u001b[39m \u001b[31m\u001b[1m                    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 84 |\u001b[39m"
            },
            {
              "title": "Click getByRole('button', { name: 'Choose project', exact: true })",
              "startTime": "2026-11-19T22:06:51.104Z",
              "duration": 98,
              "steps": [],
              "location": {
                "file": "sucafina/installed-shell.ts",
                "line": 87,
                "column": 17
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 86 |\u001b[39m   \u001b[36mconst\u001b[39m profile \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Choose project\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\n \u001b[90m 87 |\u001b[39m   \u001b[36mawait\u001b[39m profile\u001b[33m.\u001b[39mclick({ timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })\n \u001b[90m    |\u001b[39m \u001b[31m\u001b[1m                ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 88 |\u001b[39m   \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mlocator(\u001b[32m'[data-component=\"orchestra-profile-picker\"]'\u001b[39m)\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"menuitem\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Add project\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mclick({ timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })"
            },
            {
              "title": "Click locator('[data-component=\"orchestra-profile-picker\"]').getByRole('menuitem', { name: 'Add project', exact: true })",
              "startTime": "2026-11-19T22:06:51.204Z",
              "duration": 67,
              "steps": [],
              "location": {
                "file": "sucafina/installed-shell.ts",
                "line": 88,
                "column": 129
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 87 |\u001b[39m   \u001b[36mawait\u001b[39m profile\u001b[33m.\u001b[39mclick({ timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })\n \u001b[90m 88 |\u001b[39m   \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mlocator(\u001b[32m'[data-component=\"orchestra-profile-picker\"]'\u001b[39m)\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"menuitem\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Add project\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mclick({ timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })\n \u001b[90m    |\u001b[39m \u001b[31m\u001b[1m                                                                                                                                ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 89 |\u001b[39m   \u001b[36mconst\u001b[39m folders \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"dialog\"\u001b[39m)"
            },
            {
              "title": "Fill \"/tmp/sf-wp03-browser-mCqHdK\" getByRole('dialog').getByPlaceholder('Search folders', { exact: true })",
              "startTime": "2026-11-19T22:06:51.272Z",
              "duration": 93,
              "steps": [],
              "location": {
                "file": "sucafina/installed-shell.ts",
                "line": 90,
                "column": 69
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 89 |\u001b[39m   \u001b[36mconst\u001b[39m folders \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"dialog\"\u001b[39m)\n \u001b[90m 90 |\u001b[39m   \u001b[36mawait\u001b[39m folders\u001b[33m.\u001b[39mgetByPlaceholder(\u001b[32m\"Search folders\"\u001b[39m\u001b[33m,\u001b[39m { exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mfill(installation\u001b[33m.\u001b[39mroot\u001b[33m,\u001b[39m { timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })\n \u001b[90m    |\u001b[39m \u001b[31m\u001b[1m                                                                    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 91 |\u001b[39m   \u001b[36mawait\u001b[39m folders\u001b[33m.\u001b[39mlocator(\u001b[32m`[data-directory-path=${JSON.stringify(installation.root)}]`\u001b[39m)\u001b[33m.\u001b[39mclick({ timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })"
            },
            {
              "title": "Click getByRole('dialog').locator('[data-directory-path=\"/tmp/sf-wp03-browser-mCqHdK\"]')",
              "startTime": "2026-11-19T22:06:51.367Z",
              "duration": 219,
              "steps": [],
              "location": {
                "file": "sucafina/installed-shell.ts",
                "line": 91,
                "column": 87
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 90 |\u001b[39m   \u001b[36mawait\u001b[39m folders\u001b[33m.\u001b[39mgetByPlaceholder(\u001b[32m\"Search folders\"\u001b[39m\u001b[33m,\u001b[39m { exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mfill(installation\u001b[33m.\u001b[39mroot\u001b[33m,\u001b[39m { timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })\n \u001b[90m 91 |\u001b[39m   \u001b[36mawait\u001b[39m folders\u001b[33m.\u001b[39mlocator(\u001b[32m`[data-directory-path=${JSON.stringify(installation.root)}]`\u001b[39m)\u001b[33m.\u001b[39mclick({ timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })\n \u001b[90m    |\u001b[39m \u001b[31m\u001b[1m                                                                                      ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 92 |\u001b[39m   \u001b[36mawait\u001b[39m expect(profile\u001b[33m.\u001b[39mlocator(\u001b[32m\"small\"\u001b[39m))\u001b[33m.\u001b[39mtoHaveAttribute(\u001b[32m\"title\"\u001b[39m\u001b[33m,\u001b[39m installation\u001b[33m.\u001b[39mroot\u001b[33m,\u001b[39m { timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })"
            },
            {
              "title": "Expect \"toHaveAttribute\" getByRole('button', { name: 'Choose project', exact: true }).locator('small')",
              "startTime": "2026-11-19T22:06:51.587Z",
              "duration": 5,
              "steps": [],
              "location": {
                "file": "sucafina/installed-shell.ts",
                "line": 92,
                "column": 42
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 91 |\u001b[39m   \u001b[36mawait\u001b[39m folders\u001b[33m.\u001b[39mlocator(\u001b[32m`[data-directory-path=${JSON.stringify(installation.root)}]`\u001b[39m)\u001b[33m.\u001b[39mclick({ timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })\n \u001b[90m 92 |\u001b[39m   \u001b[36mawait\u001b[39m expect(profile\u001b[33m.\u001b[39mlocator(\u001b[32m\"small\"\u001b[39m))\u001b[33m.\u001b[39mtoHaveAttribute(\u001b[32m\"title\"\u001b[39m\u001b[33m,\u001b[39m installation\u001b[33m.\u001b[39mroot\u001b[33m,\u001b[39m { timeout\u001b[33m:\u001b[39m \u001b[35m10\u001b[39m_000 })\n \u001b[90m    |\u001b[39m \u001b[31m\u001b[1m                                         ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 93 |\u001b[39m   \u001b[36mreturn\u001b[39m { binding\u001b[33m,\u001b[39m context\u001b[33m:\u001b[39m context\u001b[33m.\u001b[39mvalue }"
            },
            {
              "title": "Navigate to \"/orchestra/sf-planner/versions\"",
              "startTime": "2026-11-19T22:06:51.593Z",
              "duration": 1937,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/planner-mounted.spec.ts",
                "line": 46,
                "column": 18
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  45 |\u001b[39m       \u001b[36mawait\u001b[39m installation\u001b[33m.\u001b[39msignIn(page)\n \u001b[90m  46 |\u001b[39m       \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mgoto(planner(\u001b[32m\"Versions\"\u001b[39m))\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                 ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  47 |\u001b[39m       \u001b[36mawait\u001b[39m expect(page)\u001b[33m.\u001b[39mtoHaveURL(\u001b[35m/\\/orchestra\\/sf-planner\\/versions$/\u001b[39m)"
            },
            {
              "title": "Expect \"toHaveURL\"",
              "startTime": "2026-11-19T22:06:53.531Z",
              "duration": 80,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/planner-mounted.spec.ts",
                "line": 47,
                "column": 26
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  46 |\u001b[39m       \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mgoto(planner(\u001b[32m\"Versions\"\u001b[39m))\n \u001b[90m  47 |\u001b[39m       \u001b[36mawait\u001b[39m expect(page)\u001b[33m.\u001b[39mtoHaveURL(\u001b[35m/\\/orchestra\\/sf-planner\\/versions$/\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                         ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  48 |\u001b[39m       \u001b[36mawait\u001b[39m expect(page\u001b[33m.\u001b[39mlocator(\u001b[32m'[data-sf-surface=\"CAP23\"]'\u001b[39m))\u001b[33m.\u001b[39mtoBeVisible()"
            },
            {
              "title": "Expect \"toBeVisible\" locator('[data-sf-surface=\"CAP23\"]')",
              "startTime": "2026-11-19T22:06:53.612Z",
              "duration": 4890,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/planner-mounted.spec.ts",
                "line": 48,
                "column": 63
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  47 |\u001b[39m       \u001b[36mawait\u001b[39m expect(page)\u001b[33m.\u001b[39mtoHaveURL(\u001b[35m/\\/orchestra\\/sf-planner\\/versions$/\u001b[39m)\n \u001b[90m  48 |\u001b[39m       \u001b[36mawait\u001b[39m expect(page\u001b[33m.\u001b[39mlocator(\u001b[32m'[data-sf-surface=\"CAP23\"]'\u001b[39m))\u001b[33m.\u001b[39mtoBeVisible()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                              ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  49 |\u001b[39m       \u001b[36mawait\u001b[39m expect(page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Sign out\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m }))\u001b[33m.\u001b[39mtoBeEnabled()"
            },
            {
              "title": "Expect \"toBeEnabled\" getByRole('button', { name: 'Sign out', exact: true })",
              "startTime": "2026-11-19T22:06:58.503Z",
              "duration": 4,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/planner-mounted.spec.ts",
                "line": 49,
                "column": 81
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  48 |\u001b[39m       \u001b[36mawait\u001b[39m expect(page\u001b[33m.\u001b[39mlocator(\u001b[32m'[data-sf-surface=\"CAP23\"]'\u001b[39m))\u001b[33m.\u001b[39mtoBeVisible()\n \u001b[90m  49 |\u001b[39m       \u001b[36mawait\u001b[39m expect(page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Sign out\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m }))\u001b[33m.\u001b[39mtoBeEnabled()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  50 |\u001b[39m     })"
            }
          ],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 44,
            "column": 5
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  43 |\u001b[39m   \u001b[36mtry\u001b[39m {\n \u001b[90m  44 |\u001b[39m     \u001b[36mawait\u001b[39m test\u001b[33m.\u001b[39mstep(\u001b[32m\"enroll and create the fiscal version through original commands and authorized reads\"\u001b[39m\u001b[33m,\u001b[39m \u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  45 |\u001b[39m       \u001b[36mawait\u001b[39m installation\u001b[33m.\u001b[39msignIn(page)"
        },
        {
          "title": "GET \"/sucafina/api/ui/pages/CAP23\"",
          "startTime": "2026-11-19T22:06:58.508Z",
          "duration": 1801,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 23,
            "column": 41
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  22 |\u001b[39m   \u001b[36mconst\u001b[39m readVersions \u001b[33m=\u001b[39m \u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m  23 |\u001b[39m     \u001b[36mconst\u001b[39m response \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mrequest\u001b[33m.\u001b[39m\u001b[36mget\u001b[39m(api(\u001b[32m\"CAP23\"\u001b[39m))\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  24 |\u001b[39m     expect(response\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:07:00.310Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 24,
            "column": 31
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  23 |\u001b[39m     \u001b[36mconst\u001b[39m response \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mrequest\u001b[33m.\u001b[39m\u001b[36mget\u001b[39m(api(\u001b[32m\"CAP23\"\u001b[39m))\n \u001b[90m  24 |\u001b[39m     expect(response\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                              ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  25 |\u001b[39m     \u001b[36mconst\u001b[39m body \u001b[33m=\u001b[39m \u001b[33mSchema\u001b[39m\u001b[33m.\u001b[39mdecodeUnknownSync(\u001b[33mSfDomainPageCap23\u001b[39m\u001b[33m.\u001b[39moutput)(\u001b[36mawait\u001b[39m response\u001b[33m.\u001b[39mjson())"
        },
        {
          "title": "Navigate to \"/orchestra/sf-planner/versions/new\"",
          "startTime": "2026-11-19T22:07:00.312Z",
          "duration": 263,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 52,
            "column": 16
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  51 |\u001b[39m     \u001b[36mconst\u001b[39m beforeFirst \u001b[33m=\u001b[39m (\u001b[36mawait\u001b[39m readVersions())\u001b[33m.\u001b[39mdata\u001b[33m.\u001b[39mversions\n \u001b[90m  52 |\u001b[39m     \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mgoto(\u001b[32m\"/orchestra/sf-planner/versions/new\"\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m               ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  53 |\u001b[39m     \u001b[36mawait\u001b[39m command(page\u001b[33m,\u001b[39m page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Create first version\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m,\u001b[39m \u001b[32m\"save\"\u001b[39m)"
        },
        {
          "title": "Expect \"toBeEnabled\" getByRole('button', { name: 'Create first version', exact: true })",
          "startTime": "2026-11-19T22:07:00.576Z",
          "duration": 4940,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 289,
            "column": 24
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 288 |\u001b[39m \u001b[36masync\u001b[39m \u001b[36mfunction\u001b[39m command(page\u001b[33m:\u001b[39m \u001b[33mPage\u001b[39m\u001b[33m,\u001b[39m button\u001b[33m:\u001b[39m \u001b[33mLocator\u001b[39m\u001b[33m,\u001b[39m action\u001b[33m:\u001b[39m string) {\n \u001b[90m 289 |\u001b[39m   \u001b[36mawait\u001b[39m expect(button)\u001b[33m.\u001b[39mtoBeEnabled()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 290 |\u001b[39m   \u001b[36mconst\u001b[39m pending \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mwaitForResponse((response) \u001b[33m=>\u001b[39m response\u001b[33m.\u001b[39mrequest()\u001b[33m.\u001b[39mmethod() \u001b[33m===\u001b[39m \u001b[32m\"POST\"\u001b[39m \u001b[33m&&\u001b[39m"
        },
        {
          "title": "Wait for event \"response\"",
          "startTime": "2026-11-19T22:07:05.517Z",
          "duration": 123,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 290,
            "column": 24
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 289 |\u001b[39m   \u001b[36mawait\u001b[39m expect(button)\u001b[33m.\u001b[39mtoBeEnabled()\n \u001b[90m 290 |\u001b[39m   \u001b[36mconst\u001b[39m pending \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mwaitForResponse((response) \u001b[33m=>\u001b[39m response\u001b[33m.\u001b[39mrequest()\u001b[33m.\u001b[39mmethod() \u001b[33m===\u001b[39m \u001b[32m\"POST\"\u001b[39m \u001b[33m&&\u001b[39m\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 291 |\u001b[39m     \u001b[36mnew\u001b[39m \u001b[33mURL\u001b[39m(response\u001b[33m.\u001b[39murl())\u001b[33m.\u001b[39mpathname \u001b[33m===\u001b[39m \u001b[32m\"/sucafina/planner\"\u001b[39m \u001b[33m&&\u001b[39m \u001b[33m!\u001b[39m\u001b[36mnew\u001b[39m \u001b[33mURL\u001b[39m(response\u001b[33m.\u001b[39murl())\u001b[33m.\u001b[39msearchParams\u001b[33m.\u001b[39mhas(\u001b[32m\"sf\"\u001b[39m) \u001b[33m&&\u001b[39m"
        },
        {
          "title": "Click getByRole('button', { name: 'Create first version', exact: true })",
          "startTime": "2026-11-19T22:07:05.518Z",
          "duration": 19,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 293,
            "column": 16
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 292 |\u001b[39m     response\u001b[33m.\u001b[39mrequest()\u001b[33m.\u001b[39mpostDataJSON()\u001b[33m?\u001b[39m\u001b[33m.\u001b[39maction \u001b[33m===\u001b[39m action)\n \u001b[90m 293 |\u001b[39m   \u001b[36mawait\u001b[39m button\u001b[33m.\u001b[39mclick()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m               ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 294 |\u001b[39m   \u001b[36mconst\u001b[39m review \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mlocator(\u001b[32m'[data-component=\"sf-change-review\"]'\u001b[39m)"
        },
        {
          "title": "Expect \"toHaveCount\" locator('[data-component=\"sf-change-review\"]')",
          "startTime": "2026-11-19T22:07:05.537Z",
          "duration": 2,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 295,
            "column": 24
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 294 |\u001b[39m   \u001b[36mconst\u001b[39m review \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mlocator(\u001b[32m'[data-component=\"sf-change-review\"]'\u001b[39m)\n \u001b[90m 295 |\u001b[39m   \u001b[36mawait\u001b[39m expect(review)\u001b[33m.\u001b[39mtoHaveCount(\u001b[35m1\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 296 |\u001b[39m   \u001b[36mconst\u001b[39m confirm \u001b[33m=\u001b[39m review\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[35m/^(Confirm|Review changes)$/\u001b[39m })"
        },
        {
          "title": "Expect \"toBeEnabled\" locator('[data-component=\"sf-change-review\"]').getByRole('button', { name: /^(Confirm|Review changes)$/ })",
          "startTime": "2026-11-19T22:07:05.540Z",
          "duration": 2,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 297,
            "column": 25
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 296 |\u001b[39m   \u001b[36mconst\u001b[39m confirm \u001b[33m=\u001b[39m review\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[35m/^(Confirm|Review changes)$/\u001b[39m })\n \u001b[90m 297 |\u001b[39m   \u001b[36mawait\u001b[39m expect(confirm)\u001b[33m.\u001b[39mtoBeEnabled()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 298 |\u001b[39m   \u001b[36mawait\u001b[39m confirm\u001b[33m.\u001b[39mclick()"
        },
        {
          "title": "Click locator('[data-component=\"sf-change-review\"]').getByRole('button', { name: /^(Confirm|Review changes)$/ })",
          "startTime": "2026-11-19T22:07:05.543Z",
          "duration": 61,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 298,
            "column": 17
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 297 |\u001b[39m   \u001b[36mawait\u001b[39m expect(confirm)\u001b[33m.\u001b[39mtoBeEnabled()\n \u001b[90m 298 |\u001b[39m   \u001b[36mawait\u001b[39m confirm\u001b[33m.\u001b[39mclick()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 299 |\u001b[39m   \u001b[36mconst\u001b[39m body \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m responseBody(\u001b[36mawait\u001b[39m pending) \u001b[36mas\u001b[39m { ok\u001b[33m:\u001b[39m boolean }"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:07:05.641Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 283,
            "column": 29
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 282 |\u001b[39m \u001b[36masync\u001b[39m \u001b[36mfunction\u001b[39m responseBody(response\u001b[33m:\u001b[39m \u001b[33mResponse\u001b[39m) {\n \u001b[90m 283 |\u001b[39m   expect(response\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                            ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 284 |\u001b[39m   expect(\u001b[36mawait\u001b[39m response\u001b[33m.\u001b[39mfinished())\u001b[33m.\u001b[39mtoBeNull()"
        },
        {
          "title": "Expect \"toBeNull\"",
          "startTime": "2026-11-19T22:07:05.645Z",
          "duration": 1,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 284,
            "column": 37
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 283 |\u001b[39m   expect(response\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m 284 |\u001b[39m   expect(\u001b[36mawait\u001b[39m response\u001b[33m.\u001b[39mfinished())\u001b[33m.\u001b[39mtoBeNull()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 285 |\u001b[39m   expect(response\u001b[33m.\u001b[39mrequest()\u001b[33m.\u001b[39mfailure())\u001b[33m.\u001b[39mtoBeNull()"
        },
        {
          "title": "Expect \"toBeNull\"",
          "startTime": "2026-11-19T22:07:05.646Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 285,
            "column": 40
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 284 |\u001b[39m   expect(\u001b[36mawait\u001b[39m response\u001b[33m.\u001b[39mfinished())\u001b[33m.\u001b[39mtoBeNull()\n \u001b[90m 285 |\u001b[39m   expect(response\u001b[33m.\u001b[39mrequest()\u001b[33m.\u001b[39mfailure())\u001b[33m.\u001b[39mtoBeNull()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 286 |\u001b[39m   \u001b[36mreturn\u001b[39m response\u001b[33m.\u001b[39mjson()"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:07:05.648Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 300,
            "column": 19
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 299 |\u001b[39m   \u001b[36mconst\u001b[39m body \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m responseBody(\u001b[36mawait\u001b[39m pending) \u001b[36mas\u001b[39m { ok\u001b[33m:\u001b[39m boolean }\n \u001b[90m 300 |\u001b[39m   expect(body\u001b[33m.\u001b[39mok)\u001b[33m.\u001b[39mtoBe(\u001b[36mtrue\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                  ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 301 |\u001b[39m   \u001b[36mawait\u001b[39m expect(review)\u001b[33m.\u001b[39mtoHaveCount(\u001b[35m0\u001b[39m)"
        },
        {
          "title": "Expect \"toHaveCount\" locator('[data-component=\"sf-change-review\"]')",
          "startTime": "2026-11-19T22:07:05.649Z",
          "duration": 2,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 301,
            "column": 24
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 300 |\u001b[39m   expect(body\u001b[33m.\u001b[39mok)\u001b[33m.\u001b[39mtoBe(\u001b[36mtrue\u001b[39m)\n \u001b[90m 301 |\u001b[39m   \u001b[36mawait\u001b[39m expect(review)\u001b[33m.\u001b[39mtoHaveCount(\u001b[35m0\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 302 |\u001b[39m }"
        },
        {
          "title": "GET \"/sucafina/api/ui/pages/CAP23\"",
          "startTime": "2026-11-19T22:07:05.652Z",
          "duration": 3665,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 23,
            "column": 41
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  22 |\u001b[39m   \u001b[36mconst\u001b[39m readVersions \u001b[33m=\u001b[39m \u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m  23 |\u001b[39m     \u001b[36mconst\u001b[39m response \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mrequest\u001b[33m.\u001b[39m\u001b[36mget\u001b[39m(api(\u001b[32m\"CAP23\"\u001b[39m))\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  24 |\u001b[39m     expect(response\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:07:09.318Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 24,
            "column": 31
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  23 |\u001b[39m     \u001b[36mconst\u001b[39m response \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mrequest\u001b[33m.\u001b[39m\u001b[36mget\u001b[39m(api(\u001b[32m\"CAP23\"\u001b[39m))\n \u001b[90m  24 |\u001b[39m     expect(response\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                              ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  25 |\u001b[39m     \u001b[36mconst\u001b[39m body \u001b[33m=\u001b[39m \u001b[33mSchema\u001b[39m\u001b[33m.\u001b[39mdecodeUnknownSync(\u001b[33mSfDomainPageCap23\u001b[39m\u001b[33m.\u001b[39moutput)(\u001b[36mawait\u001b[39m response\u001b[33m.\u001b[39mjson())"
        },
        {
          "title": "Expect \"toHaveLength\"",
          "startTime": "2026-11-19T22:07:09.320Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 55,
            "column": 19
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  54 |\u001b[39m     \u001b[36mconst\u001b[39m added \u001b[33m=\u001b[39m (\u001b[36mawait\u001b[39m readVersions())\u001b[33m.\u001b[39mdata\u001b[33m.\u001b[39mversions\u001b[33m.\u001b[39mfilter((record) \u001b[33m=>\u001b[39m \u001b[33m!\u001b[39mbeforeFirst\u001b[33m.\u001b[39msome((old) \u001b[33m=>\u001b[39m old\u001b[33m.\u001b[39mid \u001b[33m===\u001b[39m record\u001b[33m.\u001b[39mid))\n \u001b[90m  55 |\u001b[39m     expect(added)\u001b[33m.\u001b[39mtoHaveLength(\u001b[35m1\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                  ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  56 |\u001b[39m     \u001b[36mconst\u001b[39m createdVersion \u001b[33m=\u001b[39m added[\u001b[35m0\u001b[39m]\u001b[33m!\u001b[39m"
        },
        {
          "title": "Expect \"toMatch\"",
          "startTime": "2026-11-19T22:07:09.321Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 57,
            "column": 31
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  56 |\u001b[39m     \u001b[36mconst\u001b[39m createdVersion \u001b[33m=\u001b[39m added[\u001b[35m0\u001b[39m]\u001b[33m!\u001b[39m\n \u001b[90m  57 |\u001b[39m     expect(createdVersion\u001b[33m.\u001b[39mid)\u001b[33m.\u001b[39mtoMatch(\u001b[35m/\\S+/\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                              ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  58 |\u001b[39m     expect(createdVersion\u001b[33m.\u001b[39mname)\u001b[33m.\u001b[39mtoMatch(\u001b[35m/\\S+/\u001b[39m)"
        },
        {
          "title": "Expect \"toMatch\"",
          "startTime": "2026-11-19T22:07:09.322Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 58,
            "column": 33
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  57 |\u001b[39m     expect(createdVersion\u001b[33m.\u001b[39mid)\u001b[33m.\u001b[39mtoMatch(\u001b[35m/\\S+/\u001b[39m)\n \u001b[90m  58 |\u001b[39m     expect(createdVersion\u001b[33m.\u001b[39mname)\u001b[33m.\u001b[39mtoMatch(\u001b[35m/\\S+/\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  59 |\u001b[39m     expect(\u001b[33mNumber\u001b[39m\u001b[33m.\u001b[39misInteger(createdVersion\u001b[33m.\u001b[39myear))\u001b[33m.\u001b[39mtoBe(\u001b[36mtrue\u001b[39m)"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:07:09.322Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 59,
            "column": 51
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  58 |\u001b[39m     expect(createdVersion\u001b[33m.\u001b[39mname)\u001b[33m.\u001b[39mtoMatch(\u001b[35m/\\S+/\u001b[39m)\n \u001b[90m  59 |\u001b[39m     expect(\u001b[33mNumber\u001b[39m\u001b[33m.\u001b[39misInteger(createdVersion\u001b[33m.\u001b[39myear))\u001b[33m.\u001b[39mtoBe(\u001b[36mtrue\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                  ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  60 |\u001b[39m     \u001b[36mconst\u001b[39m versionId \u001b[33m=\u001b[39m createdVersion\u001b[33m.\u001b[39mid"
        },
        {
          "title": "Expect \"toHaveCount\" locator('tr[data-sf-row=\"df49019e-c664-4492-93f9-582f899a20ba\"]')",
          "startTime": "2026-11-19T22:07:09.323Z",
          "duration": 2864,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 61,
            "column": 41
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  60 |\u001b[39m     \u001b[36mconst\u001b[39m versionId \u001b[33m=\u001b[39m createdVersion\u001b[33m.\u001b[39mid\n \u001b[90m  61 |\u001b[39m     \u001b[36mawait\u001b[39m expect(versionRow(versionId))\u001b[33m.\u001b[39mtoHaveCount(\u001b[35m1\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  62 |\u001b[39m     \u001b[36mawait\u001b[39m versionRow(versionId)\u001b[33m.\u001b[39mlocator(\u001b[32m'button[data-sf-action=\"select\"]'\u001b[39m)\u001b[33m.\u001b[39mclick()"
        },
        {
          "title": "Click locator('tr[data-sf-row=\"df49019e-c664-4492-93f9-582f899a20ba\"]').locator('button[data-sf-action=\"select\"]')",
          "startTime": "2026-11-19T22:07:12.188Z",
          "duration": 27,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 62,
            "column": 76
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  61 |\u001b[39m     \u001b[36mawait\u001b[39m expect(versionRow(versionId))\u001b[33m.\u001b[39mtoHaveCount(\u001b[35m1\u001b[39m)\n \u001b[90m  62 |\u001b[39m     \u001b[36mawait\u001b[39m versionRow(versionId)\u001b[33m.\u001b[39mlocator(\u001b[32m'button[data-sf-action=\"select\"]'\u001b[39m)\u001b[33m.\u001b[39mclick()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                           ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  63 |\u001b[39m     \u001b[36mawait\u001b[39m expect(page)\u001b[33m.\u001b[39mtoHaveURL((url) \u001b[33m=>\u001b[39m url\u001b[33m.\u001b[39mpathname \u001b[33m===\u001b[39m \u001b[32m\"/orchestra/sf-planner/versions/\"\u001b[39m \u001b[33m+\u001b[39m encodeSfRouteRef(versionId))"
        },
        {
          "title": "Expect \"toHaveURL\"",
          "startTime": "2026-11-19T22:07:12.216Z",
          "duration": 2,
          "steps": [
            {
              "title": "Wait for load state \"load\"",
              "startTime": "2026-11-19T22:07:12.218Z",
              "duration": 0,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/planner-mounted.spec.ts",
                "line": 63,
                "column": 24
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  62 |\u001b[39m     \u001b[36mawait\u001b[39m versionRow(versionId)\u001b[33m.\u001b[39mlocator(\u001b[32m'button[data-sf-action=\"select\"]'\u001b[39m)\u001b[33m.\u001b[39mclick()\n \u001b[90m  63 |\u001b[39m     \u001b[36mawait\u001b[39m expect(page)\u001b[33m.\u001b[39mtoHaveURL((url) \u001b[33m=>\u001b[39m url\u001b[33m.\u001b[39mpathname \u001b[33m===\u001b[39m \u001b[32m\"/orchestra/sf-planner/versions/\"\u001b[39m \u001b[33m+\u001b[39m encodeSfRouteRef(versionId))\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  64 |\u001b[39m     \u001b[36mawait\u001b[39m expect(page\u001b[33m.\u001b[39mlocator(\u001b[32m\"#sf-u46-name\"\u001b[39m))\u001b[33m.\u001b[39mtoHaveValue(createdVersion\u001b[33m.\u001b[39mname)"
            }
          ],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 63,
            "column": 24
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  62 |\u001b[39m     \u001b[36mawait\u001b[39m versionRow(versionId)\u001b[33m.\u001b[39mlocator(\u001b[32m'button[data-sf-action=\"select\"]'\u001b[39m)\u001b[33m.\u001b[39mclick()\n \u001b[90m  63 |\u001b[39m     \u001b[36mawait\u001b[39m expect(page)\u001b[33m.\u001b[39mtoHaveURL((url) \u001b[33m=>\u001b[39m url\u001b[33m.\u001b[39mpathname \u001b[33m===\u001b[39m \u001b[32m\"/orchestra/sf-planner/versions/\"\u001b[39m \u001b[33m+\u001b[39m encodeSfRouteRef(versionId))\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  64 |\u001b[39m     \u001b[36mawait\u001b[39m expect(page\u001b[33m.\u001b[39mlocator(\u001b[32m\"#sf-u46-name\"\u001b[39m))\u001b[33m.\u001b[39mtoHaveValue(createdVersion\u001b[33m.\u001b[39mname)"
        },
        {
          "title": "Expect \"toHaveValue\" locator('#sf-u46-name')",
          "startTime": "2026-11-19T22:07:12.219Z",
          "duration": 2861,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 64,
            "column": 48
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  63 |\u001b[39m     \u001b[36mawait\u001b[39m expect(page)\u001b[33m.\u001b[39mtoHaveURL((url) \u001b[33m=>\u001b[39m url\u001b[33m.\u001b[39mpathname \u001b[33m===\u001b[39m \u001b[32m\"/orchestra/sf-planner/versions/\"\u001b[39m \u001b[33m+\u001b[39m encodeSfRouteRef(versionId))\n \u001b[90m  64 |\u001b[39m     \u001b[36mawait\u001b[39m expect(page\u001b[33m.\u001b[39mlocator(\u001b[32m\"#sf-u46-name\"\u001b[39m))\u001b[33m.\u001b[39mtoHaveValue(createdVersion\u001b[33m.\u001b[39mname)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                               ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  65 |\u001b[39m     \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mlocator(\u001b[32m\"#sf-u46-name\"\u001b[39m)\u001b[33m.\u001b[39mfill(\u001b[32m\"WP03 Browser Plan\"\u001b[39m)"
        },
        {
          "title": "Fill \"WP03 Browser Plan\" locator('#sf-u46-name')",
          "startTime": "2026-11-19T22:07:15.081Z",
          "duration": 6,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 65,
            "column": 40
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  64 |\u001b[39m     \u001b[36mawait\u001b[39m expect(page\u001b[33m.\u001b[39mlocator(\u001b[32m\"#sf-u46-name\"\u001b[39m))\u001b[33m.\u001b[39mtoHaveValue(createdVersion\u001b[33m.\u001b[39mname)\n \u001b[90m  65 |\u001b[39m     \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mlocator(\u001b[32m\"#sf-u46-name\"\u001b[39m)\u001b[33m.\u001b[39mfill(\u001b[32m\"WP03 Browser Plan\"\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  66 |\u001b[39m     \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mlocator(\u001b[32m\"#sf-u46-year\"\u001b[39m)\u001b[33m.\u001b[39mfill(\u001b[32m\"2027\"\u001b[39m)"
        },
        {
          "title": "Fill \"2027\" locator('#sf-u46-year')",
          "startTime": "2026-11-19T22:07:15.087Z",
          "duration": 5,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 66,
            "column": 40
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  65 |\u001b[39m     \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mlocator(\u001b[32m\"#sf-u46-name\"\u001b[39m)\u001b[33m.\u001b[39mfill(\u001b[32m\"WP03 Browser Plan\"\u001b[39m)\n \u001b[90m  66 |\u001b[39m     \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mlocator(\u001b[32m\"#sf-u46-year\"\u001b[39m)\u001b[33m.\u001b[39mfill(\u001b[32m\"2027\"\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  67 |\u001b[39m     \u001b[36mawait\u001b[39m command(page\u001b[33m,\u001b[39m page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Save\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m,\u001b[39m \u001b[32m\"save\"\u001b[39m)"
        },
        {
          "title": "Expect \"toBeEnabled\" getByRole('button', { name: 'Save', exact: true })",
          "startTime": "2026-11-19T22:07:15.093Z",
          "duration": 3,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 289,
            "column": 24
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 288 |\u001b[39m \u001b[36masync\u001b[39m \u001b[36mfunction\u001b[39m command(page\u001b[33m:\u001b[39m \u001b[33mPage\u001b[39m\u001b[33m,\u001b[39m button\u001b[33m:\u001b[39m \u001b[33mLocator\u001b[39m\u001b[33m,\u001b[39m action\u001b[33m:\u001b[39m string) {\n \u001b[90m 289 |\u001b[39m   \u001b[36mawait\u001b[39m expect(button)\u001b[33m.\u001b[39mtoBeEnabled()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 290 |\u001b[39m   \u001b[36mconst\u001b[39m pending \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mwaitForResponse((response) \u001b[33m=>\u001b[39m response\u001b[33m.\u001b[39mrequest()\u001b[33m.\u001b[39mmethod() \u001b[33m===\u001b[39m \u001b[32m\"POST\"\u001b[39m \u001b[33m&&\u001b[39m"
        },
        {
          "title": "Wait for event \"response\"",
          "startTime": "2026-11-19T22:07:15.096Z",
          "duration": 209,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 290,
            "column": 24
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 289 |\u001b[39m   \u001b[36mawait\u001b[39m expect(button)\u001b[33m.\u001b[39mtoBeEnabled()\n \u001b[90m 290 |\u001b[39m   \u001b[36mconst\u001b[39m pending \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mwaitForResponse((response) \u001b[33m=>\u001b[39m response\u001b[33m.\u001b[39mrequest()\u001b[33m.\u001b[39mmethod() \u001b[33m===\u001b[39m \u001b[32m\"POST\"\u001b[39m \u001b[33m&&\u001b[39m\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 291 |\u001b[39m     \u001b[36mnew\u001b[39m \u001b[33mURL\u001b[39m(response\u001b[33m.\u001b[39murl())\u001b[33m.\u001b[39mpathname \u001b[33m===\u001b[39m \u001b[32m\"/sucafina/planner\"\u001b[39m \u001b[33m&&\u001b[39m \u001b[33m!\u001b[39m\u001b[36mnew\u001b[39m \u001b[33mURL\u001b[39m(response\u001b[33m.\u001b[39murl())\u001b[33m.\u001b[39msearchParams\u001b[33m.\u001b[39mhas(\u001b[32m\"sf\"\u001b[39m) \u001b[33m&&\u001b[39m"
        },
        {
          "title": "Click getByRole('button', { name: 'Save', exact: true })",
          "startTime": "2026-11-19T22:07:15.097Z",
          "duration": 73,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 293,
            "column": 16
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 292 |\u001b[39m     response\u001b[33m.\u001b[39mrequest()\u001b[33m.\u001b[39mpostDataJSON()\u001b[33m?\u001b[39m\u001b[33m.\u001b[39maction \u001b[33m===\u001b[39m action)\n \u001b[90m 293 |\u001b[39m   \u001b[36mawait\u001b[39m button\u001b[33m.\u001b[39mclick()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m               ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 294 |\u001b[39m   \u001b[36mconst\u001b[39m review \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mlocator(\u001b[32m'[data-component=\"sf-change-review\"]'\u001b[39m)"
        },
        {
          "title": "Expect \"toHaveCount\" locator('[data-component=\"sf-change-review\"]')",
          "startTime": "2026-11-19T22:07:15.171Z",
          "duration": 1,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 295,
            "column": 24
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 294 |\u001b[39m   \u001b[36mconst\u001b[39m review \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mlocator(\u001b[32m'[data-component=\"sf-change-review\"]'\u001b[39m)\n \u001b[90m 295 |\u001b[39m   \u001b[36mawait\u001b[39m expect(review)\u001b[33m.\u001b[39mtoHaveCount(\u001b[35m1\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 296 |\u001b[39m   \u001b[36mconst\u001b[39m confirm \u001b[33m=\u001b[39m review\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[35m/^(Confirm|Review changes)$/\u001b[39m })"
        },
        {
          "title": "Expect \"toBeEnabled\" locator('[data-component=\"sf-change-review\"]').getByRole('button', { name: /^(Confirm|Review changes)$/ })",
          "startTime": "2026-11-19T22:07:15.173Z",
          "duration": 2,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 297,
            "column": 25
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 296 |\u001b[39m   \u001b[36mconst\u001b[39m confirm \u001b[33m=\u001b[39m review\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[35m/^(Confirm|Review changes)$/\u001b[39m })\n \u001b[90m 297 |\u001b[39m   \u001b[36mawait\u001b[39m expect(confirm)\u001b[33m.\u001b[39mtoBeEnabled()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 298 |\u001b[39m   \u001b[36mawait\u001b[39m confirm\u001b[33m.\u001b[39mclick()"
        },
        {
          "title": "Click locator('[data-component=\"sf-change-review\"]').getByRole('button', { name: /^(Confirm|Review changes)$/ })",
          "startTime": "2026-11-19T22:07:15.176Z",
          "duration": 100,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 298,
            "column": 17
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 297 |\u001b[39m   \u001b[36mawait\u001b[39m expect(confirm)\u001b[33m.\u001b[39mtoBeEnabled()\n \u001b[90m 298 |\u001b[39m   \u001b[36mawait\u001b[39m confirm\u001b[33m.\u001b[39mclick()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 299 |\u001b[39m   \u001b[36mconst\u001b[39m body \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m responseBody(\u001b[36mawait\u001b[39m pending) \u001b[36mas\u001b[39m { ok\u001b[33m:\u001b[39m boolean }"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:07:15.306Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 283,
            "column": 29
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 282 |\u001b[39m \u001b[36masync\u001b[39m \u001b[36mfunction\u001b[39m responseBody(response\u001b[33m:\u001b[39m \u001b[33mResponse\u001b[39m) {\n \u001b[90m 283 |\u001b[39m   expect(response\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                            ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 284 |\u001b[39m   expect(\u001b[36mawait\u001b[39m response\u001b[33m.\u001b[39mfinished())\u001b[33m.\u001b[39mtoBeNull()"
        },
        {
          "title": "Expect \"toBeNull\"",
          "startTime": "2026-11-19T22:07:15.311Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 284,
            "column": 37
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 283 |\u001b[39m   expect(response\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m 284 |\u001b[39m   expect(\u001b[36mawait\u001b[39m response\u001b[33m.\u001b[39mfinished())\u001b[33m.\u001b[39mtoBeNull()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 285 |\u001b[39m   expect(response\u001b[33m.\u001b[39mrequest()\u001b[33m.\u001b[39mfailure())\u001b[33m.\u001b[39mtoBeNull()"
        },
        {
          "title": "Expect \"toBeNull\"",
          "startTime": "2026-11-19T22:07:15.311Z",
          "duration": 1,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 285,
            "column": 40
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 284 |\u001b[39m   expect(\u001b[36mawait\u001b[39m response\u001b[33m.\u001b[39mfinished())\u001b[33m.\u001b[39mtoBeNull()\n \u001b[90m 285 |\u001b[39m   expect(response\u001b[33m.\u001b[39mrequest()\u001b[33m.\u001b[39mfailure())\u001b[33m.\u001b[39mtoBeNull()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 286 |\u001b[39m   \u001b[36mreturn\u001b[39m response\u001b[33m.\u001b[39mjson()"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:07:15.317Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 300,
            "column": 19
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 299 |\u001b[39m   \u001b[36mconst\u001b[39m body \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m responseBody(\u001b[36mawait\u001b[39m pending) \u001b[36mas\u001b[39m { ok\u001b[33m:\u001b[39m boolean }\n \u001b[90m 300 |\u001b[39m   expect(body\u001b[33m.\u001b[39mok)\u001b[33m.\u001b[39mtoBe(\u001b[36mtrue\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                  ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 301 |\u001b[39m   \u001b[36mawait\u001b[39m expect(review)\u001b[33m.\u001b[39mtoHaveCount(\u001b[35m0\u001b[39m)"
        },
        {
          "title": "Expect \"toHaveCount\" locator('[data-component=\"sf-change-review\"]')",
          "startTime": "2026-11-19T22:07:15.317Z",
          "duration": 5,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 301,
            "column": 24
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 300 |\u001b[39m   expect(body\u001b[33m.\u001b[39mok)\u001b[33m.\u001b[39mtoBe(\u001b[36mtrue\u001b[39m)\n \u001b[90m 301 |\u001b[39m   \u001b[36mawait\u001b[39m expect(review)\u001b[33m.\u001b[39mtoHaveCount(\u001b[35m0\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 302 |\u001b[39m }"
        },
        {
          "title": "Navigate to \"/orchestra/sf-planner/versions?year=2027\"",
          "startTime": "2026-11-19T22:07:15.323Z",
          "duration": 251,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 68,
            "column": 16
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  67 |\u001b[39m     \u001b[36mawait\u001b[39m command(page\u001b[33m,\u001b[39m page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Save\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m,\u001b[39m \u001b[32m\"save\"\u001b[39m)\n \u001b[90m  68 |\u001b[39m     \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mgoto(planner(\u001b[32m\"Versions\"\u001b[39m) \u001b[33m+\u001b[39m \u001b[32m\"?year=2027\"\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m               ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  69 |\u001b[39m     \u001b[36mawait\u001b[39m expect(versionRow(versionId)\u001b[33m.\u001b[39mlocator(\u001b[32m\".sf-s01-cell-value\"\u001b[39m))\u001b[33m.\u001b[39mtoHaveText(\u001b[32m\"WP03 Browser Plan\"\u001b[39m)"
        },
        {
          "title": "Expect \"toHaveText\" locator('tr[data-sf-row=\"df49019e-c664-4492-93f9-582f899a20ba\"]').locator('.sf-s01-cell-value')",
          "startTime": "2026-11-19T22:07:15.577Z",
          "duration": 6884,
          "steps": [],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 69,
            "column": 71
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  68 |\u001b[39m     \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mgoto(planner(\u001b[32m\"Versions\"\u001b[39m) \u001b[33m+\u001b[39m \u001b[32m\"?year=2027\"\u001b[39m)\n \u001b[90m  69 |\u001b[39m     \u001b[36mawait\u001b[39m expect(versionRow(versionId)\u001b[33m.\u001b[39mlocator(\u001b[32m\".sf-s01-cell-value\"\u001b[39m))\u001b[33m.\u001b[39mtoHaveText(\u001b[32m\"WP03 Browser Plan\"\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                      ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  70 |\u001b[39m"
        },
        {
          "title": "keep invalid pasted text, exclude that row from partial apply, correct both rows and reload",
          "startTime": "2026-11-19T22:07:22.462Z",
          "duration": 147306,
          "steps": [
            {
              "title": "Navigate to \"/orchestra/sf-planner/opex?year=2027&version=df49019e-c664-4492-93f9-582f899a20ba\"",
              "startTime": "2026-11-19T22:07:22.463Z",
              "duration": 100,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/planner-mounted.spec.ts",
                "line": 72,
                "column": 18
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  71 |\u001b[39m     \u001b[36mawait\u001b[39m test\u001b[33m.\u001b[39mstep(\u001b[32m\"keep invalid pasted text, exclude that row from partial apply, correct both rows and reload\"\u001b[39m\u001b[33m,\u001b[39m \u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m  72 |\u001b[39m       \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mgoto(planner(\u001b[32m\"OPEX\"\u001b[39m\u001b[33m,\u001b[39m versionId))\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                 ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  73 |\u001b[39m       \u001b[36mconst\u001b[39m firstId \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m addLine(page\u001b[33m,\u001b[39m \u001b[32m\"OPEX\"\u001b[39m\u001b[33m,\u001b[39m \u001b[32m\"WP03 License A\"\u001b[39m\u001b[33m,\u001b[39m \u001b[32m\"1200\"\u001b[39m\u001b[33m,\u001b[39m installation\u001b[33m.\u001b[39mactorId)"
            },
            {
              "title": "Fill \"WP03 License A\" locator('form[data-page=\"OPEX\"][data-command=\"save\"][data-record=\"\"]').getByLabel('Name', { exact: true })",
              "startTime": "2026-11-19T22:07:22.564Z",
              "duration": 6436,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/planner-mounted.spec.ts",
                "line": 327,
                "column": 50
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 326 |\u001b[39m   \u001b[36mconst\u001b[39m form \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mlocator(\u001b[32m'form[data-page=\"'\u001b[39m \u001b[33m+\u001b[39m surface \u001b[33m+\u001b[39m \u001b[32m'\"][data-command=\"save\"][data-record=\"\"]'\u001b[39m)\n \u001b[90m 327 |\u001b[39m   \u001b[36mawait\u001b[39m form\u001b[33m.\u001b[39mgetByLabel(\u001b[32m\"Name\"\u001b[39m\u001b[33m,\u001b[39m { exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mfill(name)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                 ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 328 |\u001b[39m   \u001b[36mawait\u001b[39m form\u001b[33m.\u001b[39mgetByLabel(\u001b[32m\"Owner\"\u001b[39m\u001b[33m,\u001b[39m { exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mselectOption(owner)"
            },
            {
              "title": "Select option locator('form[data-page=\"OPEX\"][data-command=\"save\"][data-record=\"\"]').getByLabel('Owner', { exact: true })",
              "startTime": "2026-11-19T22:07:29.002Z",
              "duration": 11,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/planner-mounted.spec.ts",
                "line": 328,
                "column": 51
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 327 |\u001b[39m   \u001b[36mawait\u001b[39m form\u001b[33m.\u001b[39mgetByLabel(\u001b[32m\"Name\"\u001b[39m\u001b[33m,\u001b[39m { exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mfill(name)\n \u001b[90m 328 |\u001b[39m   \u001b[36mawait\u001b[39m form\u001b[33m.\u001b[39mgetByLabel(\u001b[32m\"Owner\"\u001b[39m\u001b[33m,\u001b[39m { exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mselectOption(owner)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                  ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 329 |\u001b[39m   \u001b[36mawait\u001b[39m form\u001b[33m.\u001b[39mgetByLabel(\u001b[32m\"Element\"\u001b[39m\u001b[33m,\u001b[39m { exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mselectOption(\u001b[32m\"licenses\"\u001b[39m)"
            },
            {
              "title": "Select option locator('form[data-page=\"OPEX\"][data-command=\"save\"][data-record=\"\"]').getByLabel('Element', { exact: true })",
              "startTime": "2026-11-19T22:07:29.014Z",
              "duration": 9,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/planner-mounted.spec.ts",
                "line": 329,
                "column": 53
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 328 |\u001b[39m   \u001b[36mawait\u001b[39m form\u001b[33m.\u001b[39mgetByLabel(\u001b[32m\"Owner\"\u001b[39m\u001b[33m,\u001b[39m { exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mselectOption(owner)\n \u001b[90m 329 |\u001b[39m   \u001b[36mawait\u001b[39m form\u001b[33m.\u001b[39mgetByLabel(\u001b[32m\"Element\"\u001b[39m\u001b[33m,\u001b[39m { exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mselectOption(\u001b[32m\"licenses\"\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 330 |\u001b[39m   \u001b[36mawait\u001b[39m form\u001b[33m.\u001b[39mgetByLabel(\u001b[32m\"Annual budget\"\u001b[39m\u001b[33m,\u001b[39m { exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mfill(annual)"
            },
            {
              "title": "Fill \"1200\" locator('form[data-page=\"OPEX\"][data-command=\"save\"][data-record=\"\"]').getByLabel('Annual budget', { exact: true })",
              "startTime": "2026-11-19T22:07:29.025Z",
              "duration": 7,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/planner-mounted.spec.ts",
                "line": 330,
                "column": 59
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 329 |\u001b[39m   \u001b[36mawait\u001b[39m form\u001b[33m.\u001b[39mgetByLabel(\u001b[32m\"Element\"\u001b[39m\u001b[33m,\u001b[39m { exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mselectOption(\u001b[32m\"licenses\"\u001b[39m)\n \u001b[90m 330 |\u001b[39m   \u001b[36mawait\u001b[39m form\u001b[33m.\u001b[39mgetByLabel(\u001b[32m\"Annual budget\"\u001b[39m\u001b[33m,\u001b[39m { exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mfill(annual)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                          ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 331 |\u001b[39m   \u001b[36mif\u001b[39m (project) \u001b[36mawait\u001b[39m form\u001b[33m.\u001b[39mgetByLabel(\u001b[32m\"Project\"\u001b[39m\u001b[33m,\u001b[39m { exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mselectOption(project)"
            },
            {
              "title": "Expect \"toBeEnabled\" locator('form[data-page=\"OPEX\"][data-command=\"save\"][data-record=\"\"]').getByRole('button', { name: 'Save', exact: true })",
              "startTime": "2026-11-19T22:07:29.034Z",
              "duration": 3,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/planner-mounted.spec.ts",
                "line": 289,
                "column": 24
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 288 |\u001b[39m \u001b[36masync\u001b[39m \u001b[36mfunction\u001b[39m command(page\u001b[33m:\u001b[39m \u001b[33mPage\u001b[39m\u001b[33m,\u001b[39m button\u001b[33m:\u001b[39m \u001b[33mLocator\u001b[39m\u001b[33m,\u001b[39m action\u001b[33m:\u001b[39m string) {\n \u001b[90m 289 |\u001b[39m   \u001b[36mawait\u001b[39m expect(button)\u001b[33m.\u001b[39mtoBeEnabled()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 290 |\u001b[39m   \u001b[36mconst\u001b[39m pending \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mwaitForResponse((response) \u001b[33m=>\u001b[39m response\u001b[33m.\u001b[39mrequest()\u001b[33m.\u001b[39mmethod() \u001b[33m===\u001b[39m \u001b[32m\"POST\"\u001b[39m \u001b[33m&&\u001b[39m"
            },
            {
              "title": "Wait for event \"response\"",
              "startTime": "2026-11-19T22:07:29.039Z",
              "duration": 177,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/planner-mounted.spec.ts",
                "line": 290,
                "column": 24
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 289 |\u001b[39m   \u001b[36mawait\u001b[39m expect(button)\u001b[33m.\u001b[39mtoBeEnabled()\n \u001b[90m 290 |\u001b[39m   \u001b[36mconst\u001b[39m pending \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mwaitForResponse((response) \u001b[33m=>\u001b[39m response\u001b[33m.\u001b[39mrequest()\u001b[33m.\u001b[39mmethod() \u001b[33m===\u001b[39m \u001b[32m\"POST\"\u001b[39m \u001b[33m&&\u001b[39m\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 291 |\u001b[39m     \u001b[36mnew\u001b[39m \u001b[33mURL\u001b[39m(response\u001b[33m.\u001b[39murl())\u001b[33m.\u001b[39mpathname \u001b[33m===\u001b[39m \u001b[32m\"/sucafina/planner\"\u001b[39m \u001b[33m&&\u001b[39m \u001b[33m!\u001b[39m\u001b[36mnew\u001b[39m \u001b[33mURL\u001b[39m(response\u001b[33m.\u001b[39murl())\u001b[33m.\u001b[39msearchParams\u001b[33m.\u001b[39mhas(\u001b[32m\"sf\"\u001b[39m) \u001b[33m&&\u001b[39m"
            },
            {
              "title": "Click locator('form[data-page=\"OPEX\"][data-command=\"save\"][data-record=\"\"]').getByRole('button', { name: 'Save', exact: true })",
              "startTime": "2026-11-19T22:07:29.040Z",
              "duration": 85,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/planner-mounted.spec.ts",
                "line": 293,
                "column": 16
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 292 |\u001b[39m     response\u001b[33m.\u001b[39mrequest()\u001b[33m.\u001b[39mpostDataJSON()\u001b[33m?\u001b[39m\u001b[33m.\u001b[39maction \u001b[33m===\u001b[39m action)\n \u001b[90m 293 |\u001b[39m   \u001b[36mawait\u001b[39m button\u001b[33m.\u001b[39mclick()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m               ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 294 |\u001b[39m   \u001b[36mconst\u001b[39m review \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mlocator(\u001b[32m'[data-component=\"sf-change-review\"]'\u001b[39m)"
            },
            {
              "title": "Expect \"toHaveCount\" locator('[data-component=\"sf-change-review\"]')",
              "startTime": "2026-11-19T22:07:29.126Z",
              "duration": 2,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/planner-mounted.spec.ts",
                "line": 295,
                "column": 24
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 294 |\u001b[39m   \u001b[36mconst\u001b[39m review \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mlocator(\u001b[32m'[data-component=\"sf-change-review\"]'\u001b[39m)\n \u001b[90m 295 |\u001b[39m   \u001b[36mawait\u001b[39m expect(review)\u001b[33m.\u001b[39mtoHaveCount(\u001b[35m1\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 296 |\u001b[39m   \u001b[36mconst\u001b[39m confirm \u001b[33m=\u001b[39m review\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[35m/^(Confirm|Review changes)$/\u001b[39m })"
            },
            {
              "title": "Expect \"toBeEnabled\" locator('[data-component=\"sf-change-review\"]').getByRole('button', { name: /^(Confirm|Review changes)$/ })",
              "startTime": "2026-11-19T22:07:29.129Z",
              "duration": 2,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/planner-mounted.spec.ts",
                "line": 297,
                "column": 25
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 296 |\u001b[39m   \u001b[36mconst\u001b[39m confirm \u001b[33m=\u001b[39m review\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[35m/^(Confirm|Review changes)$/\u001b[39m })\n \u001b[90m 297 |\u001b[39m   \u001b[36mawait\u001b[39m expect(confirm)\u001b[33m.\u001b[39mtoBeEnabled()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 298 |\u001b[39m   \u001b[36mawait\u001b[39m confirm\u001b[33m.\u001b[39mclick()"
            },
            {
              "title": "Click locator('[data-component=\"sf-change-review\"]').getByRole('button', { name: /^(Confirm|Review changes)$/ })",
              "startTime": "2026-11-19T22:07:29.132Z",
              "duration": 71,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/planner-mounted.spec.ts",
                "line": 298,
                "column": 17
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 297 |\u001b[39m   \u001b[36mawait\u001b[39m expect(confirm)\u001b[33m.\u001b[39mtoBeEnabled()\n \u001b[90m 298 |\u001b[39m   \u001b[36mawait\u001b[39m confirm\u001b[33m.\u001b[39mclick()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 299 |\u001b[39m   \u001b[36mconst\u001b[39m body \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m responseBody(\u001b[36mawait\u001b[39m pending) \u001b[36mas\u001b[39m { ok\u001b[33m:\u001b[39m boolean }"
            },
            {
              "title": "Expect \"toBe\"",
              "startTime": "2026-11-19T22:07:29.217Z",
              "duration": 0,
              "steps": [],
              "location": {
                "file": "sucafina/wp03/planner-mounted.spec.ts",
                "line": 283,
                "column": 29
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m 282 |\u001b[39m \u001b[36masync\u001b[39m \u001b[36mfunction\u001b[39m responseBody(response\u001b[33m:\u001b[39m \u001b[33mResponse\u001b[39m) {\n \u001b[90m 283 |\u001b[39m   expect(response\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                            ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 284 |\u001b[39m   expect(\u001b[36mawait\u001b[39m response\u001b[33m.\u001b[39mfinished())\u001b[33m.\u001b[39mtoBeNull()"
            }
          ],
          "location": {
            "file": "sucafina/wp03/planner-mounted.spec.ts",
            "line": 71,
            "column": 5
          },
          "error": "Error: Test timeout of 180000ms exceeded.",
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  70 |\u001b[39m\n \u001b[90m  71 |\u001b[39m     \u001b[36mawait\u001b[39m test\u001b[33m.\u001b[39mstep(\u001b[32m\"keep invalid pasted text, exclude that row from partial apply, correct both rows and reload\"\u001b[39m\u001b[33m,\u001b[39m \u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  72 |\u001b[39m       \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mgoto(planner(\u001b[32m\"OPEX\"\u001b[39m\u001b[33m,\u001b[39m versionId))"
        },
        {
          "title": "After Hooks",
          "startTime": "2026-11-19T22:09:45.111Z",
          "duration": 4682,
          "steps": [
            {
              "title": "Fixture \"page\"",
              "startTime": "2026-11-19T22:09:45.250Z",
              "duration": 0,
              "steps": [],
              "count": 1,
              "skipped": false
            },
            {
              "title": "Fixture \"context\"",
              "startTime": "2026-11-19T22:09:45.250Z",
              "duration": 4535,
              "steps": [
                {
                  "title": "Close context",
                  "startTime": "2026-11-19T22:09:45.316Z",
                  "duration": 4460,
                  "steps": [],
                  "count": 1,
                  "skipped": false
                },
                {
                  "title": "the fixture-owned CLI exits after SIGTERM",
                  "startTime": "2026-11-19T22:09:49.769Z",
                  "duration": -1,
                  "steps": [
                    {
                      "title": "the fixture-owned CLI exits after SIGTERM",
                      "startTime": "2026-11-19T22:09:49.773Z",
                      "duration": 1,
                      "steps": [],
                      "error": "Error: the fixture-owned CLI exits after SIGTERM\n\n\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32mtrue\u001b[39m\nReceived: \u001b[31mfalse\u001b[39m",
                      "count": 1,
                      "skipped": false
                    }
                  ],
                  "location": {
                    "file": "sucafina/wp03/installation-fixture.ts",
                    "line": 70,
                    "column": 114
                  },
                  "count": 1,
                  "skipped": false,
                  "snippet": " \u001b[90m  69 |\u001b[39m       \u001b[36mif\u001b[39m (\u001b[33m!\u001b[39mexited()) child\u001b[33m.\u001b[39mkill(\u001b[32m\"SIGTERM\"\u001b[39m)\n \u001b[90m  70 |\u001b[39m       \u001b[36mtry\u001b[39m { \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(exited\u001b[33m,\u001b[39m { message\u001b[33m:\u001b[39m \u001b[32m\"the fixture-owned CLI exits after SIGTERM\"\u001b[39m\u001b[33m,\u001b[39m timeout\u001b[33m:\u001b[39m \u001b[35m15\u001b[39m_000 })\u001b[33m.\u001b[39mtoBe(\u001b[36mtrue\u001b[39m) }\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                                                 ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  71 |\u001b[39m       \u001b[36mcatch\u001b[39m {"
                }
              ],
              "count": 1,
              "skipped": false
            }
          ],
          "count": 1,
          "skipped": false
        },
        {
          "title": "Worker Cleanup",
          "startTime": "2026-11-19T22:09:49.793Z",
          "duration": 22,
          "steps": [
            {
              "title": "Fixture \"browser\"",
              "startTime": "2026-11-19T22:09:49.794Z",
              "duration": 20,
              "steps": [],
              "count": 1,
              "skipped": false
            }
          ],
          "count": 1,
          "skipped": false
        }
      ],
      "errors": [
        {
          "message": "\u001b[31mTest timeout of 180000ms exceeded.\u001b[39m"
        }
      ],
      "status": "timedOut",
      "annotations": [],
      "workerIndex": 0
    }
  ],
  "ok": false
}
```

## Original WP03 report

```json
{
  "testId": "f615f93066b00a759654-4ee5fb3564ba17f0fd20",
  "title": "real mounted Planner preserves monthly edits, filters and official-version controls",
  "projectName": "chromium",
  "location": {
    "file": "sucafina/wp03/planner-mounted.spec.ts",
    "line": 11,
    "column": 1
  },
  "duration": 184676,
  "annotations": [],
  "tags": [],
  "outcome": "unexpected",
  "path": [],
  "ok": false,
  "results": [
    {
      "startTime": "2026-11-19T22:06:41.794Z",
      "workerIndex": 0
    }
  ]
}
```

