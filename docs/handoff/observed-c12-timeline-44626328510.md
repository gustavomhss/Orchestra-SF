# C12 native8 original timeline

Read-only source run44626328510, artifact14580395699, snapshot095f6f6293489b2bc5ed3330efb454453d19fa4d. No rerun.

Embedded payloads: 1

## Original C12 report

```json
{
  "testId": "2209c11afb188e42c54f-8dbc06234591a8e8aae3",
  "title": "C12 native UI recovers the original receipt after lost response concurrent edit reload and a new SQLite composition",
  "projectName": "chromium",
  "location": {
    "file": "sucafina/decisions-native-recovery.spec.ts",
    "line": 7,
    "column": 1
  },
  "duration": 60271,
  "annotations": [],
  "tags": [],
  "outcome": "unexpected",
  "path": [],
  "results": [
    {
      "duration": 60271,
      "startTime": "2026-11-19T22:16:26.248Z",
      "retry": 0,
      "steps": [
        {
          "title": "Before Hooks",
          "startTime": "2026-11-19T22:16:26.250Z",
          "duration": 711,
          "steps": [
            {
              "title": "Fixture \"browser\"",
              "startTime": "2026-11-19T22:16:26.258Z",
              "duration": 703,
              "steps": [
                {
                  "title": "Launch browser",
                  "startTime": "2026-11-19T22:16:26.260Z",
                  "duration": 701,
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
          "title": "The original C12 host must initialize",
          "startTime": "2026-11-19T22:16:28.439Z",
          "duration": 5879,
          "steps": [
            {
              "title": "The original C12 host must initialize",
              "startTime": "2026-11-19T22:16:28.441Z",
              "duration": 1,
              "steps": [],
              "location": {
                "file": "sucafina/decisions-support/c12-installation.ts",
                "line": 59,
                "column": 9
              },
              "error": "Error: The original C12 host must initialize\n\n\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32mtrue\u001b[39m\nReceived: \u001b[31mfalse\u001b[39m",
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  58 |\u001b[39m         \u001b[36mlet\u001b[39m ready\u001b[33m:\u001b[39m \u001b[33mC12Ready\u001b[39m \u001b[33m|\u001b[39m undefined\n \u001b[90m  59 |\u001b[39m         \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(\u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  60 |\u001b[39m           \u001b[36mif\u001b[39m (state\u001b[33m.\u001b[39mexited) \u001b[36mthrow\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mError\u001b[39m(\u001b[32m\"The C12 host exited before its original graph initialized\"\u001b[39m)"
            },
            {
              "title": "The original C12 host must initialize",
              "startTime": "2026-11-19T22:16:28.544Z",
              "duration": 0,
              "steps": [],
              "location": {
                "file": "sucafina/decisions-support/c12-installation.ts",
                "line": 59,
                "column": 9
              },
              "error": "Error: The original C12 host must initialize\n\n\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32mtrue\u001b[39m\nReceived: \u001b[31mfalse\u001b[39m",
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  58 |\u001b[39m         \u001b[36mlet\u001b[39m ready\u001b[33m:\u001b[39m \u001b[33mC12Ready\u001b[39m \u001b[33m|\u001b[39m undefined\n \u001b[90m  59 |\u001b[39m         \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(\u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  60 |\u001b[39m           \u001b[36mif\u001b[39m (state\u001b[33m.\u001b[39mexited) \u001b[36mthrow\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mError\u001b[39m(\u001b[32m\"The C12 host exited before its original graph initialized\"\u001b[39m)"
            },
            {
              "title": "The original C12 host must initialize",
              "startTime": "2026-11-19T22:16:28.795Z",
              "duration": 1,
              "steps": [],
              "location": {
                "file": "sucafina/decisions-support/c12-installation.ts",
                "line": 59,
                "column": 9
              },
              "error": "Error: The original C12 host must initialize\n\n\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32mtrue\u001b[39m\nReceived: \u001b[31mfalse\u001b[39m",
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  58 |\u001b[39m         \u001b[36mlet\u001b[39m ready\u001b[33m:\u001b[39m \u001b[33mC12Ready\u001b[39m \u001b[33m|\u001b[39m undefined\n \u001b[90m  59 |\u001b[39m         \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(\u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  60 |\u001b[39m           \u001b[36mif\u001b[39m (state\u001b[33m.\u001b[39mexited) \u001b[36mthrow\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mError\u001b[39m(\u001b[32m\"The C12 host exited before its original graph initialized\"\u001b[39m)"
            },
            {
              "title": "The original C12 host must initialize",
              "startTime": "2026-11-19T22:16:29.297Z",
              "duration": 1,
              "steps": [],
              "location": {
                "file": "sucafina/decisions-support/c12-installation.ts",
                "line": 59,
                "column": 9
              },
              "error": "Error: The original C12 host must initialize\n\n\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32mtrue\u001b[39m\nReceived: \u001b[31mfalse\u001b[39m",
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  58 |\u001b[39m         \u001b[36mlet\u001b[39m ready\u001b[33m:\u001b[39m \u001b[33mC12Ready\u001b[39m \u001b[33m|\u001b[39m undefined\n \u001b[90m  59 |\u001b[39m         \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(\u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  60 |\u001b[39m           \u001b[36mif\u001b[39m (state\u001b[33m.\u001b[39mexited) \u001b[36mthrow\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mError\u001b[39m(\u001b[32m\"The C12 host exited before its original graph initialized\"\u001b[39m)"
            },
            {
              "title": "The original C12 host must initialize",
              "startTime": "2026-11-19T22:16:30.300Z",
              "duration": 0,
              "steps": [],
              "location": {
                "file": "sucafina/decisions-support/c12-installation.ts",
                "line": 59,
                "column": 9
              },
              "error": "Error: The original C12 host must initialize\n\n\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32mtrue\u001b[39m\nReceived: \u001b[31mfalse\u001b[39m",
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  58 |\u001b[39m         \u001b[36mlet\u001b[39m ready\u001b[33m:\u001b[39m \u001b[33mC12Ready\u001b[39m \u001b[33m|\u001b[39m undefined\n \u001b[90m  59 |\u001b[39m         \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(\u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  60 |\u001b[39m           \u001b[36mif\u001b[39m (state\u001b[33m.\u001b[39mexited) \u001b[36mthrow\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mError\u001b[39m(\u001b[32m\"The C12 host exited before its original graph initialized\"\u001b[39m)"
            },
            {
              "title": "The original C12 host must initialize",
              "startTime": "2026-11-19T22:16:31.302Z",
              "duration": 0,
              "steps": [],
              "location": {
                "file": "sucafina/decisions-support/c12-installation.ts",
                "line": 59,
                "column": 9
              },
              "error": "Error: The original C12 host must initialize\n\n\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32mtrue\u001b[39m\nReceived: \u001b[31mfalse\u001b[39m",
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  58 |\u001b[39m         \u001b[36mlet\u001b[39m ready\u001b[33m:\u001b[39m \u001b[33mC12Ready\u001b[39m \u001b[33m|\u001b[39m undefined\n \u001b[90m  59 |\u001b[39m         \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(\u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  60 |\u001b[39m           \u001b[36mif\u001b[39m (state\u001b[33m.\u001b[39mexited) \u001b[36mthrow\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mError\u001b[39m(\u001b[32m\"The C12 host exited before its original graph initialized\"\u001b[39m)"
            },
            {
              "title": "The original C12 host must initialize",
              "startTime": "2026-11-19T22:16:32.305Z",
              "duration": 0,
              "steps": [],
              "location": {
                "file": "sucafina/decisions-support/c12-installation.ts",
                "line": 59,
                "column": 9
              },
              "error": "Error: The original C12 host must initialize\n\n\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32mtrue\u001b[39m\nReceived: \u001b[31mfalse\u001b[39m",
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  58 |\u001b[39m         \u001b[36mlet\u001b[39m ready\u001b[33m:\u001b[39m \u001b[33mC12Ready\u001b[39m \u001b[33m|\u001b[39m undefined\n \u001b[90m  59 |\u001b[39m         \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(\u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  60 |\u001b[39m           \u001b[36mif\u001b[39m (state\u001b[33m.\u001b[39mexited) \u001b[36mthrow\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mError\u001b[39m(\u001b[32m\"The C12 host exited before its original graph initialized\"\u001b[39m)"
            },
            {
              "title": "The original C12 host must initialize",
              "startTime": "2026-11-19T22:16:33.307Z",
              "duration": 1,
              "steps": [],
              "location": {
                "file": "sucafina/decisions-support/c12-installation.ts",
                "line": 59,
                "column": 9
              },
              "error": "Error: The original C12 host must initialize\n\n\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32mtrue\u001b[39m\nReceived: \u001b[31mfalse\u001b[39m",
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  58 |\u001b[39m         \u001b[36mlet\u001b[39m ready\u001b[33m:\u001b[39m \u001b[33mC12Ready\u001b[39m \u001b[33m|\u001b[39m undefined\n \u001b[90m  59 |\u001b[39m         \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(\u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  60 |\u001b[39m           \u001b[36mif\u001b[39m (state\u001b[33m.\u001b[39mexited) \u001b[36mthrow\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mError\u001b[39m(\u001b[32m\"The C12 host exited before its original graph initialized\"\u001b[39m)"
            },
            {
              "title": "The original C12 host must initialize",
              "startTime": "2026-11-19T22:16:34.318Z",
              "duration": 0,
              "steps": [],
              "location": {
                "file": "sucafina/decisions-support/c12-installation.ts",
                "line": 59,
                "column": 9
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  58 |\u001b[39m         \u001b[36mlet\u001b[39m ready\u001b[33m:\u001b[39m \u001b[33mC12Ready\u001b[39m \u001b[33m|\u001b[39m undefined\n \u001b[90m  59 |\u001b[39m         \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(\u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  60 |\u001b[39m           \u001b[36mif\u001b[39m (state\u001b[33m.\u001b[39mexited) \u001b[36mthrow\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mError\u001b[39m(\u001b[32m\"The C12 host exited before its original graph initialized\"\u001b[39m)"
            }
          ],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 67,
            "column": 83
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  66 |\u001b[39m           \u001b[36mreturn\u001b[39m \u001b[33m!\u001b[39m\u001b[33m!\u001b[39mready\n \u001b[90m  67 |\u001b[39m         }\u001b[33m,\u001b[39m { timeout\u001b[33m:\u001b[39m \u001b[35m60\u001b[39m_000\u001b[33m,\u001b[39m message\u001b[33m:\u001b[39m \u001b[32m\"The original C12 host must initialize\"\u001b[39m })\u001b[33m.\u001b[39mtoBe(\u001b[36mtrue\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                  ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  68 |\u001b[39m         \u001b[36mif\u001b[39m (\u001b[33m!\u001b[39mready) \u001b[36mthrow\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mError\u001b[39m(\u001b[32m\"C12 native host unavailable\"\u001b[39m)"
        },
        {
          "title": "Create context",
          "startTime": "2026-11-19T22:16:34.326Z",
          "duration": 10,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 76,
            "column": 23
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  75 |\u001b[39m     \u001b[36mconst\u001b[39m saved \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m withC12Host(installation\u001b[33m,\u001b[39m info\u001b[33m,\u001b[39m \u001b[32m\"initial\"\u001b[39m\u001b[33m,\u001b[39m \u001b[36masync\u001b[39m (host) \u001b[33m=>\u001b[39m {\n \u001b[90m  76 |\u001b[39m       \u001b[36mconst\u001b[39m session \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m browser\u001b[33m.\u001b[39mnewContext()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                      ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  77 |\u001b[39m       \u001b[36mtry\u001b[39m {"
        },
        {
          "title": "Expect \"toEqual\"",
          "startTime": "2026-11-19T22:16:34.340Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 78,
            "column": 46
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  77 |\u001b[39m       \u001b[36mtry\u001b[39m {\n[redacted]\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                             ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  79 |\u001b[39m         \u001b[36mconst\u001b[39m page \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m session\u001b[33m.\u001b[39mnewPage()"
        },
        {
          "title": "Create page",
          "startTime": "2026-11-19T22:16:34.341Z",
          "duration": 32,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 79,
            "column": 36
          },
          "count": 1,
          "skipped": false,
          "snippet": "[redacted]\n \u001b[90m  79 |\u001b[39m         \u001b[36mconst\u001b[39m page \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m session\u001b[33m.\u001b[39mnewPage()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                   ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  80 |\u001b[39m         page\u001b[33m.\u001b[39mon(\u001b[32m\"pageerror\"\u001b[39m\u001b[33m,\u001b[39m (error) \u001b[33m=>\u001b[39m errors\u001b[33m.\u001b[39mpush(error\u001b[33m.\u001b[39mmessage))"
        },
        {
          "title": "GET \"/api/sucafina/installations?select=location&location%5Bdirectory%5D=%2Ftmp%2Fsf-c12-native-7EH4DR\"",
          "startTime": "2026-11-19T22:16:34.377Z",
          "duration": 20,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 97,
            "column": 41
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  96 |\u001b[39m   discoveryURL\u001b[33m.\u001b[39msearch \u001b[33m=\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mURLSearchParams\u001b[39m({ select\u001b[33m:\u001b[39m \u001b[32m\"location\"\u001b[39m\u001b[33m,\u001b[39m \u001b[32m\"location[directory]\"\u001b[39m\u001b[33m:\u001b[39m installation\u001b[33m.\u001b[39mdirectory })\u001b[33m.\u001b[39mtoString()\n \u001b[90m  97 |\u001b[39m   \u001b[36mconst\u001b[39m discovered \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mrequest\u001b[33m.\u001b[39m\u001b[36mget\u001b[39m(discoveryURL\u001b[33m.\u001b[39mtoString())\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  98 |\u001b[39m   expect(discovered\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:16:34.397Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 98,
            "column": 31
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  97 |\u001b[39m   \u001b[36mconst\u001b[39m discovered \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mrequest\u001b[33m.\u001b[39m\u001b[36mget\u001b[39m(discoveryURL\u001b[33m.\u001b[39mtoString())\n \u001b[90m  98 |\u001b[39m   expect(discovered\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                              ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  99 |\u001b[39m   \u001b[36mconst\u001b[39m discovery \u001b[33m=\u001b[39m \u001b[33mSchema\u001b[39m\u001b[33m.\u001b[39mdecodeUnknownSync(\u001b[33mSfInstallationList\u001b[39m)(\u001b[36mawait\u001b[39m discovered\u001b[33m.\u001b[39mjson())"
        },
        {
          "title": "Expect \"toHaveLength\"",
          "startTime": "2026-11-19T22:16:34.399Z",
          "duration": 1,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 100,
            "column": 35
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  99 |\u001b[39m   \u001b[36mconst\u001b[39m discovery \u001b[33m=\u001b[39m \u001b[33mSchema\u001b[39m\u001b[33m.\u001b[39mdecodeUnknownSync(\u001b[33mSfInstallationList\u001b[39m)(\u001b[36mawait\u001b[39m discovered\u001b[33m.\u001b[39mjson())\n \u001b[90m 100 |\u001b[39m   expect(discovery\u001b[33m.\u001b[39minstallations)\u001b[33m.\u001b[39mtoHaveLength(\u001b[35m1\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                  ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 101 |\u001b[39m   \u001b[36mconst\u001b[39m binding \u001b[33m=\u001b[39m discovery\u001b[33m.\u001b[39minstallations[\u001b[35m0\u001b[39m]\u001b[33m!\u001b[39m"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:16:34.400Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 102,
            "column": 25
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 101 |\u001b[39m   \u001b[36mconst\u001b[39m binding \u001b[33m=\u001b[39m discovery\u001b[33m.\u001b[39minstallations[\u001b[35m0\u001b[39m]\u001b[33m!\u001b[39m\n \u001b[90m 102 |\u001b[39m   expect(binding\u001b[33m.\u001b[39mmount)\u001b[33m.\u001b[39mtoBe(\u001b[32m\"/sucafina\"\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 103 |\u001b[39m   expect(binding\u001b[33m.\u001b[39mpublicOrigin)\u001b[33m.\u001b[39mtoBe(installation\u001b[33m.\u001b[39morigin)"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:16:34.400Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 103,
            "column": 32
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 102 |\u001b[39m   expect(binding\u001b[33m.\u001b[39mmount)\u001b[33m.\u001b[39mtoBe(\u001b[32m\"/sucafina\"\u001b[39m)\n \u001b[90m 103 |\u001b[39m   expect(binding\u001b[33m.\u001b[39mpublicOrigin)\u001b[33m.\u001b[39mtoBe(installation\u001b[33m.\u001b[39morigin)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                               ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 104 |\u001b[39m   \u001b[36mconst\u001b[39m url \u001b[33m=\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mURL\u001b[39m(binding\u001b[33m.\u001b[39mmount \u001b[33m+\u001b[39m \u001b[32m\"/api/ui/context\"\u001b[39m\u001b[33m,\u001b[39m binding\u001b[33m.\u001b[39mpublicOrigin)"
        },
        {
          "title": "GET \"/sucafina/api/ui/context?installationId=a2e2446f-a73e-4d00-9a65-fa236b152abd&projectId=global&hostId=fe22bd27-b574-46c8-b456-1bd072e239c7\"",
          "startTime": "2026-11-19T22:16:34.401Z",
          "duration": 1038,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 106,
            "column": 46
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 105 |\u001b[39m   url\u001b[33m.\u001b[39msearch \u001b[33m=\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mURLSearchParams\u001b[39m({ installationId\u001b[33m:\u001b[39m binding\u001b[33m.\u001b[39minstallationId\u001b[33m,\u001b[39m projectId\u001b[33m:\u001b[39m binding\u001b[33m.\u001b[39mprojectId\u001b[33m,\u001b[39m hostId\u001b[33m:\u001b[39m binding\u001b[33m.\u001b[39mhostId })\u001b[33m.\u001b[39mtoString()\n \u001b[90m 106 |\u001b[39m   \u001b[36mconst\u001b[39m contextResponse \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mrequest\u001b[33m.\u001b[39m\u001b[36mget\u001b[39m(url\u001b[33m.\u001b[39mtoString())\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                             ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 107 |\u001b[39m   expect(contextResponse\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:16:35.439Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 107,
            "column": 36
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 106 |\u001b[39m   \u001b[36mconst\u001b[39m contextResponse \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mrequest\u001b[33m.\u001b[39m\u001b[36mget\u001b[39m(url\u001b[33m.\u001b[39mtoString())\n \u001b[90m 107 |\u001b[39m   expect(contextResponse\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                   ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 108 |\u001b[39m   \u001b[36mconst\u001b[39m context \u001b[33m=\u001b[39m \u001b[33mSchema\u001b[39m\u001b[33m.\u001b[39mdecodeUnknownSync(\u001b[33mSfContextResult\u001b[39m)(\u001b[36mawait\u001b[39m contextResponse\u001b[33m.\u001b[39mjson())"
        },
        {
          "title": "Expect \"toMatchObject\"",
          "startTime": "2026-11-19T22:16:35.457Z",
          "duration": 1,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 110,
            "column": 31
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 109 |\u001b[39m   \u001b[36mif\u001b[39m (context\u001b[33m.\u001b[39mstatus \u001b[33m!==\u001b[39m \u001b[32m\"ok\"\u001b[39m) \u001b[36mthrow\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mError\u001b[39m(\u001b[32m\"The C12 operator did not receive original context admission\"\u001b[39m)\n \u001b[90m 110 |\u001b[39m   expect(context\u001b[33m.\u001b[39mvalue\u001b[33m.\u001b[39mstamp)\u001b[33m.\u001b[39mtoMatchObject({ installationId\u001b[33m:\u001b[39m binding\u001b[33m.\u001b[39minstallationId\u001b[33m,\u001b[39m projectId\u001b[33m:\u001b[39m binding\u001b[33m.\u001b[39mprojectId\u001b[33m,\u001b[39m\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                              ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 111 |\u001b[39m     hostId\u001b[33m:\u001b[39m binding\u001b[33m.\u001b[39mhostId\u001b[33m,\u001b[39m principalRef\u001b[33m:\u001b[39m host\u001b[33m.\u001b[39mactorId })"
        },
        {
          "title": "Set viewport size",
          "startTime": "2026-11-19T22:16:35.459Z",
          "duration": 2,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 112,
            "column": 14
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 111 |\u001b[39m     hostId\u001b[33m:\u001b[39m binding\u001b[33m.\u001b[39mhostId\u001b[33m,\u001b[39m principalRef\u001b[33m:\u001b[39m host\u001b[33m.\u001b[39mactorId })\n \u001b[90m 112 |\u001b[39m   \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39msetViewportSize({ width\u001b[33m:\u001b[39m \u001b[35m1440\u001b[39m\u001b[33m,\u001b[39m height\u001b[33m:\u001b[39m \u001b[35m900\u001b[39m })\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m             ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 113 |\u001b[39m   \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mgoto(installation\u001b[33m.\u001b[39morigin \u001b[33m+\u001b[39m \u001b[32m\"/\"\u001b[39m)"
        },
        {
          "title": "Navigate to \"/\"",
          "startTime": "2026-11-19T22:16:35.461Z",
          "duration": 432,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 113,
            "column": 14
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 112 |\u001b[39m   \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39msetViewportSize({ width\u001b[33m:\u001b[39m \u001b[35m1440\u001b[39m\u001b[33m,\u001b[39m height\u001b[33m:\u001b[39m \u001b[35m900\u001b[39m })\n \u001b[90m 113 |\u001b[39m   \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mgoto(installation\u001b[33m.\u001b[39morigin \u001b[33m+\u001b[39m \u001b[32m\"/\"\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m             ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 114 |\u001b[39m   \u001b[36mconst\u001b[39m project \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Choose project\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })"
        },
        {
          "title": "Click getByRole('button', { name: 'Choose project', exact: true })",
          "startTime": "2026-11-19T22:16:35.895Z",
          "duration": 405,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 115,
            "column": 17
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 114 |\u001b[39m   \u001b[36mconst\u001b[39m project \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Choose project\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\n \u001b[90m 115 |\u001b[39m   \u001b[36mawait\u001b[39m project\u001b[33m.\u001b[39mclick()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 116 |\u001b[39m   \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mlocator(\u001b[32m'[data-component=\"orchestra-profile-picker\"]'\u001b[39m)\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"menuitem\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Add project\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mclick()"
        },
        {
          "title": "Click locator('[data-component=\"orchestra-profile-picker\"]').getByRole('menuitem', { name: 'Add project', exact: true })",
          "startTime": "2026-11-19T22:16:36.308Z",
          "duration": 128,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 116,
            "column": 129
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 115 |\u001b[39m   \u001b[36mawait\u001b[39m project\u001b[33m.\u001b[39mclick()\n \u001b[90m 116 |\u001b[39m   \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mlocator(\u001b[32m'[data-component=\"orchestra-profile-picker\"]'\u001b[39m)\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"menuitem\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Add project\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mclick()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                                                                ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 117 |\u001b[39m   \u001b[36mconst\u001b[39m folders \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"dialog\"\u001b[39m)"
        },
        {
          "title": "Fill \"/tmp/sf-c12-native-7EH4DR\" getByRole('dialog').getByPlaceholder('Search folders', { exact: true })",
          "startTime": "2026-11-19T22:16:36.437Z",
          "duration": 121,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 118,
            "column": 69
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 117 |\u001b[39m   \u001b[36mconst\u001b[39m folders \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"dialog\"\u001b[39m)\n \u001b[90m 118 |\u001b[39m   \u001b[36mawait\u001b[39m folders\u001b[33m.\u001b[39mgetByPlaceholder(\u001b[32m\"Search folders\"\u001b[39m\u001b[33m,\u001b[39m { exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mfill(installation\u001b[33m.\u001b[39mdirectory)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 119 |\u001b[39m   \u001b[36mawait\u001b[39m folders\u001b[33m.\u001b[39mlocator(\u001b[32m`[data-directory-path=${JSON.stringify(installation.directory)}]`\u001b[39m)\u001b[33m.\u001b[39mclick()"
        },
        {
          "title": "Click getByRole('dialog').locator('[data-directory-path=\"/tmp/sf-c12-native-7EH4DR\"]')",
          "startTime": "2026-11-19T22:16:36.560Z",
          "duration": 1384,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 119,
            "column": 92
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 118 |\u001b[39m   \u001b[36mawait\u001b[39m folders\u001b[33m.\u001b[39mgetByPlaceholder(\u001b[32m\"Search folders\"\u001b[39m\u001b[33m,\u001b[39m { exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mfill(installation\u001b[33m.\u001b[39mdirectory)\n \u001b[90m 119 |\u001b[39m   \u001b[36mawait\u001b[39m folders\u001b[33m.\u001b[39mlocator(\u001b[32m`[data-directory-path=${JSON.stringify(installation.directory)}]`\u001b[39m)\u001b[33m.\u001b[39mclick()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                           ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 120 |\u001b[39m   \u001b[36mawait\u001b[39m expect(project\u001b[33m.\u001b[39mlocator(\u001b[32m\"small\"\u001b[39m))\u001b[33m.\u001b[39mtoHaveAttribute(\u001b[32m\"title\"\u001b[39m\u001b[33m,\u001b[39m installation\u001b[33m.\u001b[39mdirectory)"
        },
        {
          "title": "Expect \"toHaveAttribute\" getByRole('button', { name: 'Choose project', exact: true }).locator('small')",
          "startTime": "2026-11-19T22:16:37.948Z",
          "duration": 56,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 120,
            "column": 42
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 119 |\u001b[39m   \u001b[36mawait\u001b[39m folders\u001b[33m.\u001b[39mlocator(\u001b[32m`[data-directory-path=${JSON.stringify(installation.directory)}]`\u001b[39m)\u001b[33m.\u001b[39mclick()\n \u001b[90m 120 |\u001b[39m   \u001b[36mawait\u001b[39m expect(project\u001b[33m.\u001b[39mlocator(\u001b[32m\"small\"\u001b[39m))\u001b[33m.\u001b[39mtoHaveAttribute(\u001b[32m\"title\"\u001b[39m\u001b[33m,\u001b[39m installation\u001b[33m.\u001b[39mdirectory)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                         ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 121 |\u001b[39m }"
        },
        {
          "title": "Navigate to \"/orchestra/sf-decisions/r_Y2FzZTo2NDcxZGFiOS00MDYzLTQ3OTItOGY4Mi1hMjljMWEzNzMxYjQ6M2MyNTg0ZmItMjkwNy00NGRiLThkNzUtMWYyNDliZTZkYWQ1/changes/r_M2VjMzhiZGEtMjlmYi00ZDcwLWFhNzQtNDJjMWRkYjRhNmI2\"",
          "startTime": "2026-11-19T22:16:38.005Z",
          "duration": 1051,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 82,
            "column": 28
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  81 |\u001b[39m         \u001b[36mawait\u001b[39m enterC12Shell(page\u001b[33m,\u001b[39m installation\u001b[33m,\u001b[39m host)\n \u001b[90m  82 |\u001b[39m         expect((\u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mgoto(changeURL(installation\u001b[33m.\u001b[39morigin\u001b[33m,\u001b[39m host)))\u001b[33m?\u001b[39m\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                           ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  83 |\u001b[39m         \u001b[36mawait\u001b[39m expect(page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Read producer review\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m }))\u001b[33m.\u001b[39mtoHaveCount(\u001b[35m1\u001b[39m)"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:16:39.057Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 82,
            "column": 83
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  81 |\u001b[39m         \u001b[36mawait\u001b[39m enterC12Shell(page\u001b[33m,\u001b[39m installation\u001b[33m,\u001b[39m host)\n \u001b[90m  82 |\u001b[39m         expect((\u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mgoto(changeURL(installation\u001b[33m.\u001b[39morigin\u001b[33m,\u001b[39m host)))\u001b[33m?\u001b[39m\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                  ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  83 |\u001b[39m         \u001b[36mawait\u001b[39m expect(page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Read producer review\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m }))\u001b[33m.\u001b[39mtoHaveCount(\u001b[35m1\u001b[39m)"
        },
        {
          "title": "Expect \"toHaveCount\" getByRole('button', { name: 'Read producer review', exact: true })",
          "startTime": "2026-11-19T22:16:39.058Z",
          "duration": 7037,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 83,
            "column": 95
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  82 |\u001b[39m         expect((\u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mgoto(changeURL(installation\u001b[33m.\u001b[39morigin\u001b[33m,\u001b[39m host)))\u001b[33m?\u001b[39m\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m  83 |\u001b[39m         \u001b[36mawait\u001b[39m expect(page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Read producer review\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m }))\u001b[33m.\u001b[39mtoHaveCount(\u001b[35m1\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                              ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  84 |\u001b[39m         \u001b[36mconst\u001b[39m apply \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m readProducerReview(page)"
        },
        {
          "title": "Expect \"toHaveCount\" getByRole('button', { name: 'Apply reviewed change', exact: true })",
          "startTime": "2026-11-19T22:16:46.095Z",
          "duration": 3,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 17,
            "column": 90
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  16 |\u001b[39m   \u001b[90m// of the retired HTML checkbox. Before that review no Apply can be submitted.\u001b[39m\n \u001b[90m  17 |\u001b[39m   \u001b[36mawait\u001b[39m expect(page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Apply reviewed change\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m }))\u001b[33m.\u001b[39mtoHaveCount(\u001b[35m0\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                         ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  18 |\u001b[39m   \u001b[36mconst\u001b[39m read \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mwaitForResponse((response) \u001b[33m=>\u001b[39m isMode(response\u001b[33m.\u001b[39murl()\u001b[33m,\u001b[39m \u001b[32m\"decision-review\"\u001b[39m))"
        },
        {
          "title": "Wait for event \"response\"",
          "startTime": "2026-11-19T22:16:46.099Z",
          "duration": 5997,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 18,
            "column": 21
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  17 |\u001b[39m   \u001b[36mawait\u001b[39m expect(page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Apply reviewed change\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m }))\u001b[33m.\u001b[39mtoHaveCount(\u001b[35m0\u001b[39m)\n \u001b[90m  18 |\u001b[39m   \u001b[36mconst\u001b[39m read \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mwaitForResponse((response) \u001b[33m=>\u001b[39m isMode(response\u001b[33m.\u001b[39murl()\u001b[33m,\u001b[39m \u001b[32m\"decision-review\"\u001b[39m))\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  19 |\u001b[39m   \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Read producer review\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mclick()"
        },
        {
          "title": "Click getByRole('button', { name: 'Read producer review', exact: true })",
          "startTime": "2026-11-19T22:16:46.099Z",
          "duration": 21,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 19,
            "column": 81
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  18 |\u001b[39m   \u001b[36mconst\u001b[39m read \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mwaitForResponse((response) \u001b[33m=>\u001b[39m isMode(response\u001b[33m.\u001b[39murl()\u001b[33m,\u001b[39m \u001b[32m\"decision-review\"\u001b[39m))\n \u001b[90m  19 |\u001b[39m   \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Read producer review\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mclick()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  20 |\u001b[39m   expect((\u001b[36mawait\u001b[39m read)\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:16:52.097Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 20,
            "column": 33
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  19 |\u001b[39m   \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Read producer review\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mclick()\n \u001b[90m  20 |\u001b[39m   expect((\u001b[36mawait\u001b[39m read)\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  21 |\u001b[39m   \u001b[36mconst\u001b[39m button \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mlocator(\u001b[32m'[data-component=\"sf-change-review\"]'\u001b[39m)\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Apply reviewed change\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })"
        },
        {
          "title": "Expect \"toBeEnabled\" locator('[data-component=\"sf-change-review\"]').getByRole('button', { name: 'Apply reviewed change', exact: true })",
          "startTime": "2026-11-19T22:16:52.097Z",
          "duration": 12,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 22,
            "column": 24
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  21 |\u001b[39m   \u001b[36mconst\u001b[39m button \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mlocator(\u001b[32m'[data-component=\"sf-change-review\"]'\u001b[39m)\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Apply reviewed change\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\n \u001b[90m  22 |\u001b[39m   \u001b[36mawait\u001b[39m expect(button)\u001b[33m.\u001b[39mtoBeEnabled()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  23 |\u001b[39m   \u001b[36mreturn\u001b[39m button"
        },
        {
          "title": "The fixture must observe the original SQLite state",
          "startTime": "2026-11-19T22:16:52.193Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 74,
            "column": 89
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  73 |\u001b[39m             body\u001b[33m:\u001b[39m \u001b[33mJSON\u001b[39m\u001b[33m.\u001b[39mstringify({ operation }) })\n \u001b[90m  74 |\u001b[39m           expect(response\u001b[33m.\u001b[39mstatus\u001b[33m,\u001b[39m \u001b[32m\"The fixture must observe the original SQLite state\"\u001b[39m)\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  75 |\u001b[39m           \u001b[36mreturn\u001b[39m response\u001b[33m.\u001b[39mjson() \u001b[36mas\u001b[39m \u001b[33mPromise\u001b[39m\u001b[33m<\u001b[39m\u001b[33mC12Control\u001b[39m\u001b[33m>\u001b[39m"
        },
        {
          "title": "Expect \"toHaveLength\"",
          "startTime": "2026-11-19T22:16:52.195Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 86,
            "column": 83
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  85 |\u001b[39m         \u001b[36mconst\u001b[39m reviewed \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m host\u001b[33m.\u001b[39mcontrol()\n \u001b[90m  86 |\u001b[39m         expect(reviewed\u001b[33m.\u001b[39mtraffic\u001b[33m.\u001b[39mfilter((item) \u001b[33m=>\u001b[39m item\u001b[33m.\u001b[39mmode \u001b[33m===\u001b[39m \u001b[32m\"decision-apply\"\u001b[39m))\u001b[33m.\u001b[39mtoHaveLength(\u001b[35m0\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                  ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  87 |\u001b[39m         \u001b[36mconst\u001b[39m proof \u001b[33m=\u001b[39m reviewDigest(reviewed\u001b[33m.\u001b[39mtraffic\u001b[33m.\u001b[39mfind((item) \u001b[33m=>\u001b[39m item\u001b[33m.\u001b[39mmode \u001b[33m===\u001b[39m \u001b[32m\"decision-review\"\u001b[39m)\u001b[33m!\u001b[39m\u001b[33m.\u001b[39mresult)"
        },
        {
          "title": "Expect \"not toBeNull\"",
          "startTime": "2026-11-19T22:16:52.198Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/journey.ts",
            "line": 21,
            "column": 21
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  20 |\u001b[39m \u001b[36mexport\u001b[39m \u001b[36mfunction\u001b[39m asRecord(value\u001b[33m:\u001b[39m unknown)\u001b[33m:\u001b[39m \u001b[33mRecord\u001b[39m\u001b[33m<\u001b[39m\u001b[33mstring\u001b[39m\u001b[33m,\u001b[39m unknown\u001b[33m>\u001b[39m {\n \u001b[90m  21 |\u001b[39m   expect(value)\u001b[33m.\u001b[39mnot\u001b[33m.\u001b[39mtoBeNull()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  22 |\u001b[39m   expect(\u001b[36mtypeof\u001b[39m value)\u001b[33m.\u001b[39mtoBe(\u001b[32m\"object\"\u001b[39m)"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:16:52.199Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/journey.ts",
            "line": 22,
            "column": 24
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  21 |\u001b[39m   expect(value)\u001b[33m.\u001b[39mnot\u001b[33m.\u001b[39mtoBeNull()\n \u001b[90m  22 |\u001b[39m   expect(\u001b[36mtypeof\u001b[39m value)\u001b[33m.\u001b[39mtoBe(\u001b[32m\"object\"\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  23 |\u001b[39m   expect(\u001b[33mArray\u001b[39m\u001b[33m.\u001b[39misArray(value))\u001b[33m.\u001b[39mtoBe(\u001b[36mfalse\u001b[39m)"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:16:52.199Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/journey.ts",
            "line": 23,
            "column": 32
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  22 |\u001b[39m   expect(\u001b[36mtypeof\u001b[39m value)\u001b[33m.\u001b[39mtoBe(\u001b[32m\"object\"\u001b[39m)\n \u001b[90m  23 |\u001b[39m   expect(\u001b[33mArray\u001b[39m\u001b[33m.\u001b[39misArray(value))\u001b[33m.\u001b[39mtoBe(\u001b[36mfalse\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                               ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  24 |\u001b[39m   \u001b[36mreturn\u001b[39m value \u001b[36mas\u001b[39m \u001b[33mRecord\u001b[39m\u001b[33m<\u001b[39m\u001b[33mstring\u001b[39m\u001b[33m,\u001b[39m unknown\u001b[33m>\u001b[39m"
        },
        {
          "title": "Expect \"toMatch\"",
          "startTime": "2026-11-19T22:16:52.200Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 66,
            "column": 17
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  65 |\u001b[39m   \u001b[36mconst\u001b[39m value \u001b[33m=\u001b[39m asRecord(body\u001b[33m.\u001b[39mvalue)\u001b[33m.\u001b[39mreviewDigest\n \u001b[90m  66 |\u001b[39m   expect(value)\u001b[33m.\u001b[39mtoMatch(\u001b[35m/^[a-f0-9]{64}$/\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  67 |\u001b[39m   \u001b[36mif\u001b[39m (\u001b[36mtypeof\u001b[39m value \u001b[33m!==\u001b[39m \u001b[32m\"string\"\u001b[39m) \u001b[36mthrow\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mError\u001b[39m(\u001b[32m\"Original review digest missing\"\u001b[39m)"
        },
        {
          "title": "The fixture must observe the original SQLite state",
          "startTime": "2026-11-19T22:16:52.239Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 74,
            "column": 89
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  73 |\u001b[39m             body\u001b[33m:\u001b[39m \u001b[33mJSON\u001b[39m\u001b[33m.\u001b[39mstringify({ operation }) })\n \u001b[90m  74 |\u001b[39m           expect(response\u001b[33m.\u001b[39mstatus\u001b[33m,\u001b[39m \u001b[32m\"The fixture must observe the original SQLite state\"\u001b[39m)\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  75 |\u001b[39m           \u001b[36mreturn\u001b[39m response\u001b[33m.\u001b[39mjson() \u001b[36mas\u001b[39m \u001b[33mPromise\u001b[39m\u001b[33m<\u001b[39m\u001b[33mC12Control\u001b[39m\u001b[33m>\u001b[39m"
        },
        {
          "title": "Wait for event \"requestfailed\"",
          "startTime": "2026-11-19T22:16:52.253Z",
          "duration": 6478,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 36,
            "column": 23
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  35 |\u001b[39m   }\u001b[33m,\u001b[39m { times\u001b[33m:\u001b[39m \u001b[35m1\u001b[39m })\n \u001b[90m  36 |\u001b[39m   \u001b[36mconst\u001b[39m failed \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mwaitForEvent(\u001b[32m\"requestfailed\"\u001b[39m\u001b[33m,\u001b[39m { predicate\u001b[33m:\u001b[39m (request) \u001b[33m=>\u001b[39m isMode(request\u001b[33m.\u001b[39murl()\u001b[33m,\u001b[39m \u001b[32m\"decision-apply\"\u001b[39m) })\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                      ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  37 |\u001b[39m   \u001b[36mreturn\u001b[39m { status\u001b[33m:\u001b[39m lost\u001b[33m.\u001b[39mpromise\u001b[33m,\u001b[39m failed }"
        },
        {
          "title": "Click locator('[data-component=\"sf-change-review\"]').getByRole('button', { name: 'Apply reviewed change', exact: true })",
          "startTime": "2026-11-19T22:16:52.254Z",
          "duration": 111,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 91,
            "column": 21
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  90 |\u001b[39m         \u001b[36mconst\u001b[39m lost \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m dropApplication(page)\n \u001b[90m  91 |\u001b[39m         \u001b[36mawait\u001b[39m apply\u001b[33m.\u001b[39mclick()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  92 |\u001b[39m         \u001b[36mawait\u001b[39m lost\u001b[33m.\u001b[39mfailed"
        },
        {
          "title": "POST \"/sucafina/procurement?sf=decision-apply\"",
          "startTime": "2026-11-19T22:16:52.364Z",
          "duration": 6359,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 30,
            "column": 36
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  29 |\u001b[39m     \u001b[36mtry\u001b[39m {\n \u001b[90m  30 |\u001b[39m       \u001b[36mconst\u001b[39m response \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m route\u001b[33m.\u001b[39mfetch({ maxRetries\u001b[33m:\u001b[39m \u001b[35m0\u001b[39m })\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                   ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  31 |\u001b[39m       lost\u001b[33m.\u001b[39mresolve(response\u001b[33m.\u001b[39mstatus())"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:16:58.733Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 93,
            "column": 35
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  92 |\u001b[39m         \u001b[36mawait\u001b[39m lost\u001b[33m.\u001b[39mfailed\n \u001b[90m  93 |\u001b[39m         expect(\u001b[36mawait\u001b[39m lost\u001b[33m.\u001b[39mstatus)\u001b[33m.\u001b[39mtoBe(\u001b[35m503\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                  ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  94 |\u001b[39m         \u001b[36mconst\u001b[39m retry \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Retry same application\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })"
        },
        {
          "title": "Expect \"toBeEnabled\" getByRole('button', { name: 'Retry same application', exact: true })",
          "startTime": "2026-11-19T22:16:58.735Z",
          "duration": 12,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 95,
            "column": 29
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  94 |\u001b[39m         \u001b[36mconst\u001b[39m retry \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Retry same application\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\n \u001b[90m  95 |\u001b[39m         \u001b[36mawait\u001b[39m expect(retry)\u001b[33m.\u001b[39mtoBeEnabled()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                            ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  96 |\u001b[39m         \u001b[36mconst\u001b[39m observed \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m host\u001b[33m.\u001b[39mcontrol()"
        },
        {
          "title": "The fixture must observe the original SQLite state",
          "startTime": "2026-11-19T22:16:58.808Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 74,
            "column": 89
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  73 |\u001b[39m             body\u001b[33m:\u001b[39m \u001b[33mJSON\u001b[39m\u001b[33m.\u001b[39mstringify({ operation }) })\n \u001b[90m  74 |\u001b[39m           expect(response\u001b[33m.\u001b[39mstatus\u001b[33m,\u001b[39m \u001b[32m\"The fixture must observe the original SQLite state\"\u001b[39m)\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  75 |\u001b[39m           \u001b[36mreturn\u001b[39m response\u001b[33m.\u001b[39mjson() \u001b[36mas\u001b[39m \u001b[33mPromise\u001b[39m\u001b[33m<\u001b[39m\u001b[33mC12Control\u001b[39m\u001b[33m>\u001b[39m"
        },
        {
          "title": "Expect \"toEqual\"",
          "startTime": "2026-11-19T22:16:58.812Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 98,
            "column": 40
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  97 |\u001b[39m         \u001b[36mconst\u001b[39m first \u001b[33m=\u001b[39m observed\u001b[33m.\u001b[39mtraffic\u001b[33m.\u001b[39mfind((item) \u001b[33m=>\u001b[39m item\u001b[33m.\u001b[39mmode \u001b[33m===\u001b[39m \u001b[32m\"decision-apply\"\u001b[39m)\u001b[33m!\u001b[39m\n \u001b[90m  98 |\u001b[39m         expect(\u001b[33mJSON\u001b[39m\u001b[33m.\u001b[39mparse(first\u001b[33m.\u001b[39mbody))\u001b[33m.\u001b[39mtoEqual({ \u001b[33m...\u001b[39mhost\u001b[33m.\u001b[39mprepared\u001b[33m.\u001b[39mrequest\u001b[33m,\u001b[39m reviewDigest\u001b[33m:\u001b[39m proof })\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  99 |\u001b[39m         expect(first\u001b[33m.\u001b[39mresult)\u001b[33m.\u001b[39mtoEqual({ status\u001b[33m:\u001b[39m \u001b[32m\"unavailable\"\u001b[39m\u001b[33m,\u001b[39m reason\u001b[33m:\u001b[39m \u001b[32m\"domain-application-unavailable\"\u001b[39m })"
        },
        {
          "title": "Expect \"toEqual\"",
          "startTime": "2026-11-19T22:16:58.813Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 99,
            "column": 30
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  98 |\u001b[39m         expect(\u001b[33mJSON\u001b[39m\u001b[33m.\u001b[39mparse(first\u001b[33m.\u001b[39mbody))\u001b[33m.\u001b[39mtoEqual({ \u001b[33m...\u001b[39mhost\u001b[33m.\u001b[39mprepared\u001b[33m.\u001b[39mrequest\u001b[33m,\u001b[39m reviewDigest\u001b[33m:\u001b[39m proof })\n \u001b[90m  99 |\u001b[39m         expect(first\u001b[33m.\u001b[39mresult)\u001b[33m.\u001b[39mtoEqual({ status\u001b[33m:\u001b[39m \u001b[32m\"unavailable\"\u001b[39m\u001b[33m,\u001b[39m reason\u001b[33m:\u001b[39m \u001b[32m\"domain-application-unavailable\"\u001b[39m })\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                             ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 100 |\u001b[39m         expect(first\u001b[33m.\u001b[39mkey)\u001b[33m.\u001b[39mtoBeTruthy()"
        },
        {
          "title": "Expect \"toBeTruthy\"",
          "startTime": "2026-11-19T22:16:58.813Z",
          "duration": 1,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 100,
            "column": 27
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  99 |\u001b[39m         expect(first\u001b[33m.\u001b[39mresult)\u001b[33m.\u001b[39mtoEqual({ status\u001b[33m:\u001b[39m \u001b[32m\"unavailable\"\u001b[39m\u001b[33m,\u001b[39m reason\u001b[33m:\u001b[39m \u001b[32m\"domain-application-unavailable\"\u001b[39m })\n \u001b[90m 100 |\u001b[39m         expect(first\u001b[33m.\u001b[39mkey)\u001b[33m.\u001b[39mtoBeTruthy()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                          ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 101 |\u001b[39m         \u001b[36mconst\u001b[39m committed \u001b[33m=\u001b[39m observed\u001b[33m.\u001b[39mobservation"
        },
        {
          "title": "Expect \"not toBeNull\"",
          "startTime": "2026-11-19T22:16:58.814Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/journey.ts",
            "line": 21,
            "column": 21
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  20 |\u001b[39m \u001b[36mexport\u001b[39m \u001b[36mfunction\u001b[39m asRecord(value\u001b[33m:\u001b[39m unknown)\u001b[33m:\u001b[39m \u001b[33mRecord\u001b[39m\u001b[33m<\u001b[39m\u001b[33mstring\u001b[39m\u001b[33m,\u001b[39m unknown\u001b[33m>\u001b[39m {\n \u001b[90m  21 |\u001b[39m   expect(value)\u001b[33m.\u001b[39mnot\u001b[33m.\u001b[39mtoBeNull()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  22 |\u001b[39m   expect(\u001b[36mtypeof\u001b[39m value)\u001b[33m.\u001b[39mtoBe(\u001b[32m\"object\"\u001b[39m)"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:16:58.815Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/journey.ts",
            "line": 22,
            "column": 24
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  21 |\u001b[39m   expect(value)\u001b[33m.\u001b[39mnot\u001b[33m.\u001b[39mtoBeNull()\n \u001b[90m  22 |\u001b[39m   expect(\u001b[36mtypeof\u001b[39m value)\u001b[33m.\u001b[39mtoBe(\u001b[32m\"object\"\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  23 |\u001b[39m   expect(\u001b[33mArray\u001b[39m\u001b[33m.\u001b[39misArray(value))\u001b[33m.\u001b[39mtoBe(\u001b[36mfalse\u001b[39m)"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:16:58.816Z",
          "duration": 2,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/journey.ts",
            "line": 23,
            "column": 32
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  22 |\u001b[39m   expect(\u001b[36mtypeof\u001b[39m value)\u001b[33m.\u001b[39mtoBe(\u001b[32m\"object\"\u001b[39m)\n \u001b[90m  23 |\u001b[39m   expect(\u001b[33mArray\u001b[39m\u001b[33m.\u001b[39misArray(value))\u001b[33m.\u001b[39mtoBe(\u001b[36mfalse\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                               ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  24 |\u001b[39m   \u001b[36mreturn\u001b[39m value \u001b[36mas\u001b[39m \u001b[33mRecord\u001b[39m\u001b[33m<\u001b[39m\u001b[33mstring\u001b[39m\u001b[33m,\u001b[39m unknown\u001b[33m>\u001b[39m"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:16:58.819Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 102,
            "column": 65
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 101 |\u001b[39m         \u001b[36mconst\u001b[39m committed \u001b[33m=\u001b[39m observed\u001b[33m.\u001b[39mobservation\n \u001b[90m 102 |\u001b[39m         expect(asRecord(committed\u001b[33m.\u001b[39mdomain\u001b[33m.\u001b[39mrequest\u001b[33m.\u001b[39mpr)\u001b[33m.\u001b[39mestAmount)\u001b[33m.\u001b[39mtoBe(\u001b[35m150\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 103 |\u001b[39m         expect(committed\u001b[33m.\u001b[39mdomain\u001b[33m.\u001b[39mversion)\u001b[33m.\u001b[39mtoMatchObject({ version\u001b[33m:\u001b[39m \u001b[35m1\u001b[39m\u001b[33m,\u001b[39m by\u001b[33m:\u001b[39m host\u001b[33m.\u001b[39mactorId })"
        },
        {
          "title": "Expect \"toMatchObject\"",
          "startTime": "2026-11-19T22:16:58.820Z",
          "duration": 2,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 103,
            "column": 42
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 102 |\u001b[39m         expect(asRecord(committed\u001b[33m.\u001b[39mdomain\u001b[33m.\u001b[39mrequest\u001b[33m.\u001b[39mpr)\u001b[33m.\u001b[39mestAmount)\u001b[33m.\u001b[39mtoBe(\u001b[35m150\u001b[39m)\n \u001b[90m 103 |\u001b[39m         expect(committed\u001b[33m.\u001b[39mdomain\u001b[33m.\u001b[39mversion)\u001b[33m.\u001b[39mtoMatchObject({ version\u001b[33m:\u001b[39m \u001b[35m1\u001b[39m\u001b[33m,\u001b[39m by\u001b[33m:\u001b[39m host\u001b[33m.\u001b[39mactorId })\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                         ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 104 |\u001b[39m         expect(committed\u001b[33m.\u001b[39mdomain\u001b[33m.\u001b[39mrequest\u001b[33m.\u001b[39mhistory)\u001b[33m.\u001b[39mtoHaveLength(\u001b[35m1\u001b[39m)"
        },
        {
          "title": "Expect \"toHaveLength\"",
          "startTime": "2026-11-19T22:16:58.823Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 104,
            "column": 50
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 103 |\u001b[39m         expect(committed\u001b[33m.\u001b[39mdomain\u001b[33m.\u001b[39mversion)\u001b[33m.\u001b[39mtoMatchObject({ version\u001b[33m:\u001b[39m \u001b[35m1\u001b[39m\u001b[33m,\u001b[39m by\u001b[33m:\u001b[39m host\u001b[33m.\u001b[39mactorId })\n \u001b[90m 104 |\u001b[39m         expect(committed\u001b[33m.\u001b[39mdomain\u001b[33m.\u001b[39mrequest\u001b[33m.\u001b[39mhistory)\u001b[33m.\u001b[39mtoHaveLength(\u001b[35m1\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                 ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 105 |\u001b[39m         expect(\u001b[33mArray\u001b[39m\u001b[33m.\u001b[39misArray(committed\u001b[33m.\u001b[39mdomain\u001b[33m.\u001b[39mrequest\u001b[33m.\u001b[39mhistory) \u001b[33m?\u001b[39m committed\u001b[33m.\u001b[39mdomain\u001b[33m.\u001b[39mrequest\u001b[33m.\u001b[39mhistory[\u001b[35m0\u001b[39m] \u001b[33m:\u001b[39m undefined)"
        },
        {
          "title": "Expect \"toMatchObject\"",
          "startTime": "2026-11-19T22:16:58.824Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 106,
            "column": 12
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 105 |\u001b[39m         expect(\u001b[33mArray\u001b[39m\u001b[33m.\u001b[39misArray(committed\u001b[33m.\u001b[39mdomain\u001b[33m.\u001b[39mrequest\u001b[33m.\u001b[39mhistory) \u001b[33m?\u001b[39m committed\u001b[33m.\u001b[39mdomain\u001b[33m.\u001b[39mrequest\u001b[33m.\u001b[39mhistory[\u001b[35m0\u001b[39m] \u001b[33m:\u001b[39m undefined)\n \u001b[90m 106 |\u001b[39m           \u001b[33m.\u001b[39mtoMatchObject({ action\u001b[33m:\u001b[39m \u001b[32m\"Saved\"\u001b[39m\u001b[33m,\u001b[39m by\u001b[33m:\u001b[39m host\u001b[33m.\u001b[39mactorId })\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m           ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 107 |\u001b[39m         expect(committed\u001b[33m.\u001b[39mreceipts)\u001b[33m.\u001b[39mtoHaveLength(\u001b[35m1\u001b[39m)"
        },
        {
          "title": "Expect \"toHaveLength\"",
          "startTime": "2026-11-19T22:16:58.824Z",
          "duration": 1,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 107,
            "column": 36
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 106 |\u001b[39m           \u001b[33m.\u001b[39mtoMatchObject({ action\u001b[33m:\u001b[39m \u001b[32m\"Saved\"\u001b[39m\u001b[33m,\u001b[39m by\u001b[33m:\u001b[39m host\u001b[33m.\u001b[39mactorId })\n \u001b[90m 107 |\u001b[39m         expect(committed\u001b[33m.\u001b[39mreceipts)\u001b[33m.\u001b[39mtoHaveLength(\u001b[35m1\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                   ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 108 |\u001b[39m         expect(committed\u001b[33m.\u001b[39mreceipts[\u001b[35m0\u001b[39m])\u001b[33m.\u001b[39mtoMatchObject({ principalRef\u001b[33m:\u001b[39m host\u001b[33m.\u001b[39mactorId\u001b[33m,\u001b[39m surface\u001b[33m:\u001b[39m \u001b[32m\"procurement\"\u001b[39m\u001b[33m,\u001b[39m version\u001b[33m:\u001b[39m \u001b[35m1\u001b[39m\u001b[33m,\u001b[39m"
        },
        {
          "title": "Expect \"toMatchObject\"",
          "startTime": "2026-11-19T22:16:58.828Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 108,
            "column": 39
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 107 |\u001b[39m         expect(committed\u001b[33m.\u001b[39mreceipts)\u001b[33m.\u001b[39mtoHaveLength(\u001b[35m1\u001b[39m)\n \u001b[90m 108 |\u001b[39m         expect(committed\u001b[33m.\u001b[39mreceipts[\u001b[35m0\u001b[39m])\u001b[33m.\u001b[39mtoMatchObject({ principalRef\u001b[33m:\u001b[39m host\u001b[33m.\u001b[39mactorId\u001b[33m,\u001b[39m surface\u001b[33m:\u001b[39m \u001b[32m\"procurement\"\u001b[39m\u001b[33m,\u001b[39m version\u001b[33m:\u001b[39m \u001b[35m1\u001b[39m\u001b[33m,\u001b[39m\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                      ^\u001b[22m\u001b[39m\u001b[0m\n[redacted]"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:16:58.828Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 111,
            "column": 46
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 110 |\u001b[39m           commandDigest\u001b[33m:\u001b[39m host\u001b[33m.\u001b[39mprepared\u001b[33m.\u001b[39mchange\u001b[33m.\u001b[39moperation\u001b[33m.\u001b[39mcommandDigest })\n \u001b[90m 111 |\u001b[39m         expect(committed\u001b[33m.\u001b[39mdecision\u001b[33m.\u001b[39mobjective)\u001b[33m.\u001b[39mtoBe(\u001b[32m\"Concurrent authorized case edit\"\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                             ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 112 |\u001b[39m         expect(committed\u001b[33m.\u001b[39mdecision\u001b[33m.\u001b[39mchoices)\u001b[33m.\u001b[39mtoEqual(choiceBefore)"
        },
        {
          "title": "Expect \"toEqual\"",
          "startTime": "2026-11-19T22:16:58.829Z",
          "duration": 3,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 112,
            "column": 44
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 111 |\u001b[39m         expect(committed\u001b[33m.\u001b[39mdecision\u001b[33m.\u001b[39mobjective)\u001b[33m.\u001b[39mtoBe(\u001b[32m\"Concurrent authorized case edit\"\u001b[39m)\n \u001b[90m 112 |\u001b[39m         expect(committed\u001b[33m.\u001b[39mdecision\u001b[33m.\u001b[39mchoices)\u001b[33m.\u001b[39mtoEqual(choiceBefore)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                           ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 113 |\u001b[39m         expect(committed\u001b[33m.\u001b[39mdecision\u001b[33m.\u001b[39mpreparedChanges[\u001b[35m0\u001b[39m]\u001b[33m?\u001b[39m\u001b[33m.\u001b[39mstate)\u001b[33m.\u001b[39mtoBe(\u001b[32m\"planned\"\u001b[39m)"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:16:58.832Z",
          "duration": 5,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 113,
            "column": 62
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 112 |\u001b[39m         expect(committed\u001b[33m.\u001b[39mdecision\u001b[33m.\u001b[39mchoices)\u001b[33m.\u001b[39mtoEqual(choiceBefore)\n \u001b[90m 113 |\u001b[39m         expect(committed\u001b[33m.\u001b[39mdecision\u001b[33m.\u001b[39mpreparedChanges[\u001b[35m0\u001b[39m]\u001b[33m?\u001b[39m\u001b[33m.\u001b[39mstate)\u001b[33m.\u001b[39mtoBe(\u001b[32m\"planned\"\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                             ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 114 |\u001b[39m         expect(committed\u001b[33m.\u001b[39mdecision\u001b[33m.\u001b[39mreceipts)\u001b[33m.\u001b[39mtoEqual([])"
        },
        {
          "title": "Expect \"toEqual\"",
          "startTime": "2026-11-19T22:16:58.838Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 114,
            "column": 45
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 113 |\u001b[39m         expect(committed\u001b[33m.\u001b[39mdecision\u001b[33m.\u001b[39mpreparedChanges[\u001b[35m0\u001b[39m]\u001b[33m?\u001b[39m\u001b[33m.\u001b[39mstate)\u001b[33m.\u001b[39mtoBe(\u001b[32m\"planned\"\u001b[39m)\n \u001b[90m 114 |\u001b[39m         expect(committed\u001b[33m.\u001b[39mdecision\u001b[33m.\u001b[39mreceipts)\u001b[33m.\u001b[39mtoEqual([])\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                            ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 115 |\u001b[39m         expect(observed\u001b[33m.\u001b[39mreceiptCommits)\u001b[33m.\u001b[39mtoHaveLength(\u001b[35m1\u001b[39m)"
        },
        {
          "title": "Expect \"toHaveLength\"",
          "startTime": "2026-11-19T22:16:58.838Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 115,
            "column": 41
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 114 |\u001b[39m         expect(committed\u001b[33m.\u001b[39mdecision\u001b[33m.\u001b[39mreceipts)\u001b[33m.\u001b[39mtoEqual([])\n \u001b[90m 115 |\u001b[39m         expect(observed\u001b[33m.\u001b[39mreceiptCommits)\u001b[33m.\u001b[39mtoHaveLength(\u001b[35m1\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 116 |\u001b[39m"
        },
        {
          "title": "Wait for event \"response\"",
          "startTime": "2026-11-19T22:16:58.839Z",
          "duration": 147,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 117,
            "column": 30
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 116 |\u001b[39m\n \u001b[90m 117 |\u001b[39m         \u001b[36mconst\u001b[39m retried \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mwaitForResponse((response) \u001b[33m=>\u001b[39m isMode(response\u001b[33m.\u001b[39murl()\u001b[33m,\u001b[39m \u001b[32m\"decision-apply\"\u001b[39m))\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                             ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 118 |\u001b[39m         \u001b[36mawait\u001b[39m retry\u001b[33m.\u001b[39mclick()"
        },
        {
          "title": "Click getByRole('button', { name: 'Retry same application', exact: true })",
          "startTime": "2026-11-19T22:16:58.842Z",
          "duration": 65,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 118,
            "column": 21
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 117 |\u001b[39m         \u001b[36mconst\u001b[39m retried \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mwaitForResponse((response) \u001b[33m=>\u001b[39m isMode(response\u001b[33m.\u001b[39murl()\u001b[33m,\u001b[39m \u001b[32m\"decision-apply\"\u001b[39m))\n \u001b[90m 118 |\u001b[39m         \u001b[36mawait\u001b[39m retry\u001b[33m.\u001b[39mclick()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 119 |\u001b[39m         expect((\u001b[36mawait\u001b[39m retried)\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m409\u001b[39m)"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:16:58.987Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 119,
            "column": 42
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 118 |\u001b[39m         \u001b[36mawait\u001b[39m retry\u001b[33m.\u001b[39mclick()\n \u001b[90m 119 |\u001b[39m         expect((\u001b[36mawait\u001b[39m retried)\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m409\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                         ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 120 |\u001b[39m         \u001b[36mconst\u001b[39m afterRetry \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m host\u001b[33m.\u001b[39mcontrol()"
        },
        {
          "title": "The fixture must observe the original SQLite state",
          "startTime": "2026-11-19T22:16:59.020Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 74,
            "column": 89
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  73 |\u001b[39m             body\u001b[33m:\u001b[39m \u001b[33mJSON\u001b[39m\u001b[33m.\u001b[39mstringify({ operation }) })\n \u001b[90m  74 |\u001b[39m           expect(response\u001b[33m.\u001b[39mstatus\u001b[33m,\u001b[39m \u001b[32m\"The fixture must observe the original SQLite state\"\u001b[39m)\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  75 |\u001b[39m           \u001b[36mreturn\u001b[39m response\u001b[33m.\u001b[39mjson() \u001b[36mas\u001b[39m \u001b[33mPromise\u001b[39m\u001b[33m<\u001b[39m\u001b[33mC12Control\u001b[39m\u001b[33m>\u001b[39m"
        },
        {
          "title": "Expect \"toHaveLength\"",
          "startTime": "2026-11-19T22:16:59.022Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 122,
            "column": 30
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 121 |\u001b[39m         \u001b[36mconst\u001b[39m applications \u001b[33m=\u001b[39m afterRetry\u001b[33m.\u001b[39mtraffic\u001b[33m.\u001b[39mfilter((item) \u001b[33m=>\u001b[39m item\u001b[33m.\u001b[39mmode \u001b[33m===\u001b[39m \u001b[32m\"decision-apply\"\u001b[39m)\n \u001b[90m 122 |\u001b[39m         expect(applications)\u001b[33m.\u001b[39mtoHaveLength(\u001b[35m2\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                             ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 123 |\u001b[39m         expect(applications[\u001b[35m1\u001b[39m])\u001b[33m.\u001b[39mtoMatchObject({ body\u001b[33m:\u001b[39m first\u001b[33m.\u001b[39mbody\u001b[33m,\u001b[39m key\u001b[33m:\u001b[39m first\u001b[33m.\u001b[39mkey })"
        },
        {
          "title": "Expect \"toMatchObject\"",
          "startTime": "2026-11-19T22:16:59.022Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 123,
            "column": 33
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 122 |\u001b[39m         expect(applications)\u001b[33m.\u001b[39mtoHaveLength(\u001b[35m2\u001b[39m)\n \u001b[90m 123 |\u001b[39m         expect(applications[\u001b[35m1\u001b[39m])\u001b[33m.\u001b[39mtoMatchObject({ body\u001b[33m:\u001b[39m first\u001b[33m.\u001b[39mbody\u001b[33m,\u001b[39m key\u001b[33m:\u001b[39m first\u001b[33m.\u001b[39mkey })\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 124 |\u001b[39m         expect(afterRetry\u001b[33m.\u001b[39mobservation)\u001b[33m.\u001b[39mtoEqual(committed)"
        },
        {
          "title": "Expect \"toEqual\"",
          "startTime": "2026-11-19T22:16:59.023Z",
          "duration": 4,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 124,
            "column": 40
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 123 |\u001b[39m         expect(applications[\u001b[35m1\u001b[39m])\u001b[33m.\u001b[39mtoMatchObject({ body\u001b[33m:\u001b[39m first\u001b[33m.\u001b[39mbody\u001b[33m,\u001b[39m key\u001b[33m:\u001b[39m first\u001b[33m.\u001b[39mkey })\n \u001b[90m 124 |\u001b[39m         expect(afterRetry\u001b[33m.\u001b[39mobservation)\u001b[33m.\u001b[39mtoEqual(committed)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                       ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 125 |\u001b[39m         expect((\u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mreload())\u001b[33m?\u001b[39m\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)"
        },
        {
          "title": "Reload",
          "startTime": "2026-11-19T22:16:59.028Z",
          "duration": 257,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 125,
            "column": 28
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 124 |\u001b[39m         expect(afterRetry\u001b[33m.\u001b[39mobservation)\u001b[33m.\u001b[39mtoEqual(committed)\n \u001b[90m 125 |\u001b[39m         expect((\u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mreload())\u001b[33m?\u001b[39m\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                           ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 126 |\u001b[39m         \u001b[36mawait\u001b[39m expect(page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Recover recorded receipt\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m }))\u001b[33m.\u001b[39mtoBeEnabled()"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:16:59.286Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 125,
            "column": 49
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 124 |\u001b[39m         expect(afterRetry\u001b[33m.\u001b[39mobservation)\u001b[33m.\u001b[39mtoEqual(committed)\n \u001b[90m 125 |\u001b[39m         expect((\u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mreload())\u001b[33m?\u001b[39m\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 126 |\u001b[39m         \u001b[36mawait\u001b[39m expect(page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Recover recorded receipt\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m }))\u001b[33m.\u001b[39mtoBeEnabled()"
        },
        {
          "title": "Expect \"toBeEnabled\" getByRole('button', { name: 'Recover recorded receipt', exact: true })",
          "startTime": "2026-11-19T22:16:59.286Z",
          "duration": 9971,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 126,
            "column": 99
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 125 |\u001b[39m         expect((\u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mreload())\u001b[33m?\u001b[39m\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m 126 |\u001b[39m         \u001b[36mawait\u001b[39m expect(page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Recover recorded receipt\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m }))\u001b[33m.\u001b[39mtoBeEnabled()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                                  ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 127 |\u001b[39m         \u001b[36mconst\u001b[39m beforeClose \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m host\u001b[33m.\u001b[39mcontrol()"
        },
        {
          "title": "The fixture must observe the original SQLite state",
          "startTime": "2026-11-19T22:17:09.276Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 74,
            "column": 89
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  73 |\u001b[39m             body\u001b[33m:\u001b[39m \u001b[33mJSON\u001b[39m\u001b[33m.\u001b[39mstringify({ operation }) })\n \u001b[90m  74 |\u001b[39m           expect(response\u001b[33m.\u001b[39mstatus\u001b[33m,\u001b[39m \u001b[32m\"The fixture must observe the original SQLite state\"\u001b[39m)\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  75 |\u001b[39m           \u001b[36mreturn\u001b[39m response\u001b[33m.\u001b[39mjson() \u001b[36mas\u001b[39m \u001b[33mPromise\u001b[39m\u001b[33m<\u001b[39m\u001b[33mC12Control\u001b[39m\u001b[33m>\u001b[39m"
        },
        {
          "title": "Expect \"toHaveLength\"",
          "startTime": "2026-11-19T22:17:09.277Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 128,
            "column": 86
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 127 |\u001b[39m         \u001b[36mconst\u001b[39m beforeClose \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m host\u001b[33m.\u001b[39mcontrol()\n \u001b[90m 128 |\u001b[39m         expect(beforeClose\u001b[33m.\u001b[39mtraffic\u001b[33m.\u001b[39mfilter((item) \u001b[33m=>\u001b[39m item\u001b[33m.\u001b[39mmode \u001b[33m===\u001b[39m \u001b[32m\"decision-apply\"\u001b[39m))\u001b[33m.\u001b[39mtoHaveLength(\u001b[35m2\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                     ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 129 |\u001b[39m         \u001b[36mreturn\u001b[39m { committed\u001b[33m,\u001b[39m choiceBefore\u001b[33m,\u001b[39m first\u001b[33m,\u001b[39m proof\u001b[33m,\u001b[39m traffic\u001b[33m:\u001b[39m beforeClose\u001b[33m.\u001b[39mtraffic\u001b[33m,\u001b[39m prepared\u001b[33m:\u001b[39m host\u001b[33m.\u001b[39mprepared }"
        },
        {
          "title": "Close context",
          "startTime": "2026-11-19T22:17:09.515Z",
          "duration": 5,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 130,
            "column": 19
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 129 |\u001b[39m         \u001b[36mreturn\u001b[39m { committed\u001b[33m,\u001b[39m choiceBefore\u001b[33m,\u001b[39m first\u001b[33m,\u001b[39m proof\u001b[33m,\u001b[39m traffic\u001b[33m:\u001b[39m beforeClose\u001b[33m.\u001b[39mtraffic\u001b[33m,\u001b[39m prepared\u001b[33m:\u001b[39m host\u001b[33m.\u001b[39mprepared }\n \u001b[90m 130 |\u001b[39m       } \u001b[36mfinally\u001b[39m { \u001b[36mawait\u001b[39m session\u001b[33m.\u001b[39mclose() }\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                  ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 131 |\u001b[39m     })"
        },
        {
          "title": "Attach \"c12-initial-host.log\"",
          "startTime": "2026-11-19T22:17:09.759Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 87,
            "column": 16
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  86 |\u001b[39m       \u001b[33m.\u001b[39mreplace(\u001b[35m/\\b[a-f0-9]{32,}\\b/gi\u001b[39m\u001b[33m,\u001b[39m \u001b[32m\"[redacted-hex]\"\u001b[39m)\n \u001b[90m  87 |\u001b[39m     \u001b[36mawait\u001b[39m info\u001b[33m.\u001b[39mattach(\u001b[32m\"c12-\"\u001b[39m \u001b[33m+\u001b[39m phase \u001b[33m+\u001b[39m \u001b[32m\"-host.log\"\u001b[39m\u001b[33m,\u001b[39m { body\u001b[33m:\u001b[39m source\u001b[33m,\u001b[39m contentType\u001b[33m:\u001b[39m \u001b[32m\"text/plain\"\u001b[39m })\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m               ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  88 |\u001b[39m     \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(portAvailable\u001b[33m,\u001b[39m { timeout\u001b[33m:\u001b[39m \u001b[35m5\u001b[39m_000\u001b[33m,\u001b[39m message\u001b[33m:\u001b[39m \u001b[32m\"The old C12 host releases its owned listener\"\u001b[39m })\u001b[33m.\u001b[39mtoBe(\u001b[36mtrue\u001b[39m)"
        },
        {
          "title": "The old C12 host releases its owned listener",
          "startTime": "2026-11-19T22:17:09.760Z",
          "duration": 2,
          "steps": [
            {
              "title": "The old C12 host releases its owned listener",
              "startTime": "2026-11-19T22:17:09.762Z",
              "duration": 0,
              "steps": [],
              "location": {
                "file": "sucafina/decisions-support/c12-installation.ts",
                "line": 88,
                "column": 5
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  87 |\u001b[39m     \u001b[36mawait\u001b[39m info\u001b[33m.\u001b[39mattach(\u001b[32m\"c12-\"\u001b[39m \u001b[33m+\u001b[39m phase \u001b[33m+\u001b[39m \u001b[32m\"-host.log\"\u001b[39m\u001b[33m,\u001b[39m { body\u001b[33m:\u001b[39m source\u001b[33m,\u001b[39m contentType\u001b[33m:\u001b[39m \u001b[32m\"text/plain\"\u001b[39m })\n \u001b[90m  88 |\u001b[39m     \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(portAvailable\u001b[33m,\u001b[39m { timeout\u001b[33m:\u001b[39m \u001b[35m5\u001b[39m_000\u001b[33m,\u001b[39m message\u001b[33m:\u001b[39m \u001b[32m\"The old C12 host releases its owned listener\"\u001b[39m })\u001b[33m.\u001b[39mtoBe(\u001b[36mtrue\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  89 |\u001b[39m   }"
            }
          ],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 88,
            "column": 115
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  87 |\u001b[39m     \u001b[36mawait\u001b[39m info\u001b[33m.\u001b[39mattach(\u001b[32m\"c12-\"\u001b[39m \u001b[33m+\u001b[39m phase \u001b[33m+\u001b[39m \u001b[32m\"-host.log\"\u001b[39m\u001b[33m,\u001b[39m { body\u001b[33m:\u001b[39m source\u001b[33m,\u001b[39m contentType\u001b[33m:\u001b[39m \u001b[32m\"text/plain\"\u001b[39m })\n \u001b[90m  88 |\u001b[39m     \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(portAvailable\u001b[33m,\u001b[39m { timeout\u001b[33m:\u001b[39m \u001b[35m5\u001b[39m_000\u001b[33m,\u001b[39m message\u001b[33m:\u001b[39m \u001b[32m\"The old C12 host releases its owned listener\"\u001b[39m })\u001b[33m.\u001b[39mtoBe(\u001b[36mtrue\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                                                  ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  89 |\u001b[39m   }"
        },
        {
          "title": "The original C12 host must initialize",
          "startTime": "2026-11-19T22:17:09.766Z",
          "duration": 2866,
          "steps": [
            {
              "title": "The original C12 host must initialize",
              "startTime": "2026-11-19T22:17:09.768Z",
              "duration": 0,
              "steps": [],
              "location": {
                "file": "sucafina/decisions-support/c12-installation.ts",
                "line": 59,
                "column": 9
              },
              "error": "Error: The original C12 host must initialize\n\n\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32mtrue\u001b[39m\nReceived: \u001b[31mfalse\u001b[39m",
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  58 |\u001b[39m         \u001b[36mlet\u001b[39m ready\u001b[33m:\u001b[39m \u001b[33mC12Ready\u001b[39m \u001b[33m|\u001b[39m undefined\n \u001b[90m  59 |\u001b[39m         \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(\u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  60 |\u001b[39m           \u001b[36mif\u001b[39m (state\u001b[33m.\u001b[39mexited) \u001b[36mthrow\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mError\u001b[39m(\u001b[32m\"The C12 host exited before its original graph initialized\"\u001b[39m)"
            },
            {
              "title": "The original C12 host must initialize",
              "startTime": "2026-11-19T22:17:09.876Z",
              "duration": 0,
              "steps": [],
              "location": {
                "file": "sucafina/decisions-support/c12-installation.ts",
                "line": 59,
                "column": 9
              },
              "error": "Error: The original C12 host must initialize\n\n\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32mtrue\u001b[39m\nReceived: \u001b[31mfalse\u001b[39m",
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  58 |\u001b[39m         \u001b[36mlet\u001b[39m ready\u001b[33m:\u001b[39m \u001b[33mC12Ready\u001b[39m \u001b[33m|\u001b[39m undefined\n \u001b[90m  59 |\u001b[39m         \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(\u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  60 |\u001b[39m           \u001b[36mif\u001b[39m (state\u001b[33m.\u001b[39mexited) \u001b[36mthrow\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mError\u001b[39m(\u001b[32m\"The C12 host exited before its original graph initialized\"\u001b[39m)"
            },
            {
              "title": "The original C12 host must initialize",
              "startTime": "2026-11-19T22:17:10.127Z",
              "duration": 1,
              "steps": [],
              "location": {
                "file": "sucafina/decisions-support/c12-installation.ts",
                "line": 59,
                "column": 9
              },
              "error": "Error: The original C12 host must initialize\n\n\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32mtrue\u001b[39m\nReceived: \u001b[31mfalse\u001b[39m",
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  58 |\u001b[39m         \u001b[36mlet\u001b[39m ready\u001b[33m:\u001b[39m \u001b[33mC12Ready\u001b[39m \u001b[33m|\u001b[39m undefined\n \u001b[90m  59 |\u001b[39m         \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(\u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  60 |\u001b[39m           \u001b[36mif\u001b[39m (state\u001b[33m.\u001b[39mexited) \u001b[36mthrow\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mError\u001b[39m(\u001b[32m\"The C12 host exited before its original graph initialized\"\u001b[39m)"
            },
            {
              "title": "The original C12 host must initialize",
              "startTime": "2026-11-19T22:17:10.629Z",
              "duration": 0,
              "steps": [],
              "location": {
                "file": "sucafina/decisions-support/c12-installation.ts",
                "line": 59,
                "column": 9
              },
              "error": "Error: The original C12 host must initialize\n\n\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32mtrue\u001b[39m\nReceived: \u001b[31mfalse\u001b[39m",
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  58 |\u001b[39m         \u001b[36mlet\u001b[39m ready\u001b[33m:\u001b[39m \u001b[33mC12Ready\u001b[39m \u001b[33m|\u001b[39m undefined\n \u001b[90m  59 |\u001b[39m         \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(\u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  60 |\u001b[39m           \u001b[36mif\u001b[39m (state\u001b[33m.\u001b[39mexited) \u001b[36mthrow\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mError\u001b[39m(\u001b[32m\"The C12 host exited before its original graph initialized\"\u001b[39m)"
            },
            {
              "title": "The original C12 host must initialize",
              "startTime": "2026-11-19T22:17:11.630Z",
              "duration": 1,
              "steps": [],
              "location": {
                "file": "sucafina/decisions-support/c12-installation.ts",
                "line": 59,
                "column": 9
              },
              "error": "Error: The original C12 host must initialize\n\n\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32mtrue\u001b[39m\nReceived: \u001b[31mfalse\u001b[39m",
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  58 |\u001b[39m         \u001b[36mlet\u001b[39m ready\u001b[33m:\u001b[39m \u001b[33mC12Ready\u001b[39m \u001b[33m|\u001b[39m undefined\n \u001b[90m  59 |\u001b[39m         \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(\u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  60 |\u001b[39m           \u001b[36mif\u001b[39m (state\u001b[33m.\u001b[39mexited) \u001b[36mthrow\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mError\u001b[39m(\u001b[32m\"The C12 host exited before its original graph initialized\"\u001b[39m)"
            },
            {
              "title": "The original C12 host must initialize",
              "startTime": "2026-11-19T22:17:12.632Z",
              "duration": 0,
              "steps": [],
              "location": {
                "file": "sucafina/decisions-support/c12-installation.ts",
                "line": 59,
                "column": 9
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  58 |\u001b[39m         \u001b[36mlet\u001b[39m ready\u001b[33m:\u001b[39m \u001b[33mC12Ready\u001b[39m \u001b[33m|\u001b[39m undefined\n \u001b[90m  59 |\u001b[39m         \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(\u001b[36masync\u001b[39m () \u001b[33m=>\u001b[39m {\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  60 |\u001b[39m           \u001b[36mif\u001b[39m (state\u001b[33m.\u001b[39mexited) \u001b[36mthrow\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mError\u001b[39m(\u001b[32m\"The C12 host exited before its original graph initialized\"\u001b[39m)"
            }
          ],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 67,
            "column": 83
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  66 |\u001b[39m           \u001b[36mreturn\u001b[39m \u001b[33m!\u001b[39m\u001b[33m!\u001b[39mready\n \u001b[90m  67 |\u001b[39m         }\u001b[33m,\u001b[39m { timeout\u001b[33m:\u001b[39m \u001b[35m60\u001b[39m_000\u001b[33m,\u001b[39m message\u001b[33m:\u001b[39m \u001b[32m\"The original C12 host must initialize\"\u001b[39m })\u001b[33m.\u001b[39mtoBe(\u001b[36mtrue\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                  ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  68 |\u001b[39m         \u001b[36mif\u001b[39m (\u001b[33m!\u001b[39mready) \u001b[36mthrow\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mError\u001b[39m(\u001b[32m\"C12 native host unavailable\"\u001b[39m)"
        },
        {
          "title": "The fixture must observe the original SQLite state",
          "startTime": "2026-11-19T22:17:12.654Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 74,
            "column": 89
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  73 |\u001b[39m             body\u001b[33m:\u001b[39m \u001b[33mJSON\u001b[39m\u001b[33m.\u001b[39mstringify({ operation }) })\n \u001b[90m  74 |\u001b[39m           expect(response\u001b[33m.\u001b[39mstatus\u001b[33m,\u001b[39m \u001b[32m\"The fixture must observe the original SQLite state\"\u001b[39m)\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  75 |\u001b[39m           \u001b[36mreturn\u001b[39m response\u001b[33m.\u001b[39mjson() \u001b[36mas\u001b[39m \u001b[33mPromise\u001b[39m\u001b[33m<\u001b[39m\u001b[33mC12Control\u001b[39m\u001b[33m>\u001b[39m"
        },
        {
          "title": "Expect \"toEqual\"",
          "startTime": "2026-11-19T22:17:12.655Z",
          "duration": 3,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 135,
            "column": 50
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 134 |\u001b[39m     \u001b[36mawait\u001b[39m withC12Host(installation\u001b[33m,\u001b[39m info\u001b[33m,\u001b[39m \u001b[32m\"reopened\"\u001b[39m\u001b[33m,\u001b[39m \u001b[36masync\u001b[39m (host) \u001b[33m=>\u001b[39m {\n \u001b[90m 135 |\u001b[39m       expect((\u001b[36mawait\u001b[39m host\u001b[33m.\u001b[39mcontrol())\u001b[33m.\u001b[39mobservation)\u001b[33m.\u001b[39mtoEqual(saved\u001b[33m.\u001b[39mcommitted)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                 ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 136 |\u001b[39m       \u001b[36mconst\u001b[39m fresh \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m browser\u001b[33m.\u001b[39mnewContext()"
        },
        {
          "title": "Create context",
          "startTime": "2026-11-19T22:17:12.658Z",
          "duration": 2,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 136,
            "column": 21
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 135 |\u001b[39m       expect((\u001b[36mawait\u001b[39m host\u001b[33m.\u001b[39mcontrol())\u001b[33m.\u001b[39mobservation)\u001b[33m.\u001b[39mtoEqual(saved\u001b[33m.\u001b[39mcommitted)\n \u001b[90m 136 |\u001b[39m       \u001b[36mconst\u001b[39m fresh \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m browser\u001b[33m.\u001b[39mnewContext()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 137 |\u001b[39m       \u001b[36mtry\u001b[39m {"
        },
        {
          "title": "Expect \"toEqual\"",
          "startTime": "2026-11-19T22:17:12.662Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 138,
            "column": 44
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 137 |\u001b[39m       \u001b[36mtry\u001b[39m {\n[redacted]\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                           ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 139 |\u001b[39m         \u001b[36mconst\u001b[39m page \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m fresh\u001b[33m.\u001b[39mnewPage()"
        },
        {
          "title": "Create page",
          "startTime": "2026-11-19T22:17:12.662Z",
          "duration": 28,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 139,
            "column": 34
          },
          "count": 1,
          "skipped": false,
          "snippet": "[redacted]\n \u001b[90m 139 |\u001b[39m         \u001b[36mconst\u001b[39m page \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m fresh\u001b[33m.\u001b[39mnewPage()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                 ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 140 |\u001b[39m         page\u001b[33m.\u001b[39mon(\u001b[32m\"pageerror\"\u001b[39m\u001b[33m,\u001b[39m (error) \u001b[33m=>\u001b[39m errors\u001b[33m.\u001b[39mpush(error\u001b[33m.\u001b[39mmessage))"
        },
        {
          "title": "GET \"/api/sucafina/installations?select=location&location%5Bdirectory%5D=%2Ftmp%2Fsf-c12-native-7EH4DR\"",
          "startTime": "2026-11-19T22:17:12.693Z",
          "duration": 8,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 97,
            "column": 41
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  96 |\u001b[39m   discoveryURL\u001b[33m.\u001b[39msearch \u001b[33m=\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mURLSearchParams\u001b[39m({ select\u001b[33m:\u001b[39m \u001b[32m\"location\"\u001b[39m\u001b[33m,\u001b[39m \u001b[32m\"location[directory]\"\u001b[39m\u001b[33m:\u001b[39m installation\u001b[33m.\u001b[39mdirectory })\u001b[33m.\u001b[39mtoString()\n \u001b[90m  97 |\u001b[39m   \u001b[36mconst\u001b[39m discovered \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mrequest\u001b[33m.\u001b[39m\u001b[36mget\u001b[39m(discoveryURL\u001b[33m.\u001b[39mtoString())\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  98 |\u001b[39m   expect(discovered\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:17:12.701Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 98,
            "column": 31
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  97 |\u001b[39m   \u001b[36mconst\u001b[39m discovered \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mrequest\u001b[33m.\u001b[39m\u001b[36mget\u001b[39m(discoveryURL\u001b[33m.\u001b[39mtoString())\n \u001b[90m  98 |\u001b[39m   expect(discovered\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                              ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  99 |\u001b[39m   \u001b[36mconst\u001b[39m discovery \u001b[33m=\u001b[39m \u001b[33mSchema\u001b[39m\u001b[33m.\u001b[39mdecodeUnknownSync(\u001b[33mSfInstallationList\u001b[39m)(\u001b[36mawait\u001b[39m discovered\u001b[33m.\u001b[39mjson())"
        },
        {
          "title": "Expect \"toHaveLength\"",
          "startTime": "2026-11-19T22:17:12.703Z",
          "duration": 1,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 100,
            "column": 35
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  99 |\u001b[39m   \u001b[36mconst\u001b[39m discovery \u001b[33m=\u001b[39m \u001b[33mSchema\u001b[39m\u001b[33m.\u001b[39mdecodeUnknownSync(\u001b[33mSfInstallationList\u001b[39m)(\u001b[36mawait\u001b[39m discovered\u001b[33m.\u001b[39mjson())\n \u001b[90m 100 |\u001b[39m   expect(discovery\u001b[33m.\u001b[39minstallations)\u001b[33m.\u001b[39mtoHaveLength(\u001b[35m1\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                  ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 101 |\u001b[39m   \u001b[36mconst\u001b[39m binding \u001b[33m=\u001b[39m discovery\u001b[33m.\u001b[39minstallations[\u001b[35m0\u001b[39m]\u001b[33m!\u001b[39m"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:17:12.704Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 102,
            "column": 25
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 101 |\u001b[39m   \u001b[36mconst\u001b[39m binding \u001b[33m=\u001b[39m discovery\u001b[33m.\u001b[39minstallations[\u001b[35m0\u001b[39m]\u001b[33m!\u001b[39m\n \u001b[90m 102 |\u001b[39m   expect(binding\u001b[33m.\u001b[39mmount)\u001b[33m.\u001b[39mtoBe(\u001b[32m\"/sucafina\"\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                        ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 103 |\u001b[39m   expect(binding\u001b[33m.\u001b[39mpublicOrigin)\u001b[33m.\u001b[39mtoBe(installation\u001b[33m.\u001b[39morigin)"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:17:12.704Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 103,
            "column": 32
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 102 |\u001b[39m   expect(binding\u001b[33m.\u001b[39mmount)\u001b[33m.\u001b[39mtoBe(\u001b[32m\"/sucafina\"\u001b[39m)\n \u001b[90m 103 |\u001b[39m   expect(binding\u001b[33m.\u001b[39mpublicOrigin)\u001b[33m.\u001b[39mtoBe(installation\u001b[33m.\u001b[39morigin)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                               ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 104 |\u001b[39m   \u001b[36mconst\u001b[39m url \u001b[33m=\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mURL\u001b[39m(binding\u001b[33m.\u001b[39mmount \u001b[33m+\u001b[39m \u001b[32m\"/api/ui/context\"\u001b[39m\u001b[33m,\u001b[39m binding\u001b[33m.\u001b[39mpublicOrigin)"
        },
        {
          "title": "GET \"/sucafina/api/ui/context?installationId=a2e2446f-a73e-4d00-9a65-fa236b152abd&projectId=global&hostId=054e6490-02e5-4eea-a211-b282581b553d\"",
          "startTime": "2026-11-19T22:17:12.705Z",
          "duration": 1012,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 106,
            "column": 46
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 105 |\u001b[39m   url\u001b[33m.\u001b[39msearch \u001b[33m=\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mURLSearchParams\u001b[39m({ installationId\u001b[33m:\u001b[39m binding\u001b[33m.\u001b[39minstallationId\u001b[33m,\u001b[39m projectId\u001b[33m:\u001b[39m binding\u001b[33m.\u001b[39mprojectId\u001b[33m,\u001b[39m hostId\u001b[33m:\u001b[39m binding\u001b[33m.\u001b[39mhostId })\u001b[33m.\u001b[39mtoString()\n \u001b[90m 106 |\u001b[39m   \u001b[36mconst\u001b[39m contextResponse \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mrequest\u001b[33m.\u001b[39m\u001b[36mget\u001b[39m(url\u001b[33m.\u001b[39mtoString())\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                             ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 107 |\u001b[39m   expect(contextResponse\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:17:13.718Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 107,
            "column": 36
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 106 |\u001b[39m   \u001b[36mconst\u001b[39m contextResponse \u001b[33m=\u001b[39m \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mrequest\u001b[33m.\u001b[39m\u001b[36mget\u001b[39m(url\u001b[33m.\u001b[39mtoString())\n \u001b[90m 107 |\u001b[39m   expect(contextResponse\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                   ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 108 |\u001b[39m   \u001b[36mconst\u001b[39m context \u001b[33m=\u001b[39m \u001b[33mSchema\u001b[39m\u001b[33m.\u001b[39mdecodeUnknownSync(\u001b[33mSfContextResult\u001b[39m)(\u001b[36mawait\u001b[39m contextResponse\u001b[33m.\u001b[39mjson())"
        },
        {
          "title": "Expect \"toMatchObject\"",
          "startTime": "2026-11-19T22:17:13.731Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 110,
            "column": 31
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 109 |\u001b[39m   \u001b[36mif\u001b[39m (context\u001b[33m.\u001b[39mstatus \u001b[33m!==\u001b[39m \u001b[32m\"ok\"\u001b[39m) \u001b[36mthrow\u001b[39m \u001b[36mnew\u001b[39m \u001b[33mError\u001b[39m(\u001b[32m\"The C12 operator did not receive original context admission\"\u001b[39m)\n \u001b[90m 110 |\u001b[39m   expect(context\u001b[33m.\u001b[39mvalue\u001b[33m.\u001b[39mstamp)\u001b[33m.\u001b[39mtoMatchObject({ installationId\u001b[33m:\u001b[39m binding\u001b[33m.\u001b[39minstallationId\u001b[33m,\u001b[39m projectId\u001b[33m:\u001b[39m binding\u001b[33m.\u001b[39mprojectId\u001b[33m,\u001b[39m\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                              ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 111 |\u001b[39m     hostId\u001b[33m:\u001b[39m binding\u001b[33m.\u001b[39mhostId\u001b[33m,\u001b[39m principalRef\u001b[33m:\u001b[39m host\u001b[33m.\u001b[39mactorId })"
        },
        {
          "title": "Set viewport size",
          "startTime": "2026-11-19T22:17:13.731Z",
          "duration": 3,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 112,
            "column": 14
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 111 |\u001b[39m     hostId\u001b[33m:\u001b[39m binding\u001b[33m.\u001b[39mhostId\u001b[33m,\u001b[39m principalRef\u001b[33m:\u001b[39m host\u001b[33m.\u001b[39mactorId })\n \u001b[90m 112 |\u001b[39m   \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39msetViewportSize({ width\u001b[33m:\u001b[39m \u001b[35m1440\u001b[39m\u001b[33m,\u001b[39m height\u001b[33m:\u001b[39m \u001b[35m900\u001b[39m })\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m             ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 113 |\u001b[39m   \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mgoto(installation\u001b[33m.\u001b[39morigin \u001b[33m+\u001b[39m \u001b[32m\"/\"\u001b[39m)"
        },
        {
          "title": "Navigate to \"/\"",
          "startTime": "2026-11-19T22:17:13.735Z",
          "duration": 426,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 113,
            "column": 14
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 112 |\u001b[39m   \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39msetViewportSize({ width\u001b[33m:\u001b[39m \u001b[35m1440\u001b[39m\u001b[33m,\u001b[39m height\u001b[33m:\u001b[39m \u001b[35m900\u001b[39m })\n \u001b[90m 113 |\u001b[39m   \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mgoto(installation\u001b[33m.\u001b[39morigin \u001b[33m+\u001b[39m \u001b[32m\"/\"\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m             ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 114 |\u001b[39m   \u001b[36mconst\u001b[39m project \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Choose project\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })"
        },
        {
          "title": "Click getByRole('button', { name: 'Choose project', exact: true })",
          "startTime": "2026-11-19T22:17:14.162Z",
          "duration": 315,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 115,
            "column": 17
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 114 |\u001b[39m   \u001b[36mconst\u001b[39m project \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Choose project\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\n \u001b[90m 115 |\u001b[39m   \u001b[36mawait\u001b[39m project\u001b[33m.\u001b[39mclick()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 116 |\u001b[39m   \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mlocator(\u001b[32m'[data-component=\"orchestra-profile-picker\"]'\u001b[39m)\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"menuitem\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Add project\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mclick()"
        },
        {
          "title": "Click locator('[data-component=\"orchestra-profile-picker\"]').getByRole('menuitem', { name: 'Add project', exact: true })",
          "startTime": "2026-11-19T22:17:14.478Z",
          "duration": 260,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 116,
            "column": 129
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 115 |\u001b[39m   \u001b[36mawait\u001b[39m project\u001b[33m.\u001b[39mclick()\n \u001b[90m 116 |\u001b[39m   \u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mlocator(\u001b[32m'[data-component=\"orchestra-profile-picker\"]'\u001b[39m)\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"menuitem\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Add project\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mclick()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                                                                ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 117 |\u001b[39m   \u001b[36mconst\u001b[39m folders \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"dialog\"\u001b[39m)"
        },
        {
          "title": "Fill \"/tmp/sf-c12-native-7EH4DR\" getByRole('dialog').getByPlaceholder('Search folders', { exact: true })",
          "startTime": "2026-11-19T22:17:14.739Z",
          "duration": 131,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 118,
            "column": 69
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 117 |\u001b[39m   \u001b[36mconst\u001b[39m folders \u001b[33m=\u001b[39m page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"dialog\"\u001b[39m)\n \u001b[90m 118 |\u001b[39m   \u001b[36mawait\u001b[39m folders\u001b[33m.\u001b[39mgetByPlaceholder(\u001b[32m\"Search folders\"\u001b[39m\u001b[33m,\u001b[39m { exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mfill(installation\u001b[33m.\u001b[39mdirectory)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 119 |\u001b[39m   \u001b[36mawait\u001b[39m folders\u001b[33m.\u001b[39mlocator(\u001b[32m`[data-directory-path=${JSON.stringify(installation.directory)}]`\u001b[39m)\u001b[33m.\u001b[39mclick()"
        },
        {
          "title": "Click getByRole('dialog').locator('[data-directory-path=\"/tmp/sf-c12-native-7EH4DR\"]')",
          "startTime": "2026-11-19T22:17:14.872Z",
          "duration": 886,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 119,
            "column": 92
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 118 |\u001b[39m   \u001b[36mawait\u001b[39m folders\u001b[33m.\u001b[39mgetByPlaceholder(\u001b[32m\"Search folders\"\u001b[39m\u001b[33m,\u001b[39m { exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m })\u001b[33m.\u001b[39mfill(installation\u001b[33m.\u001b[39mdirectory)\n \u001b[90m 119 |\u001b[39m   \u001b[36mawait\u001b[39m folders\u001b[33m.\u001b[39mlocator(\u001b[32m`[data-directory-path=${JSON.stringify(installation.directory)}]`\u001b[39m)\u001b[33m.\u001b[39mclick()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                           ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 120 |\u001b[39m   \u001b[36mawait\u001b[39m expect(project\u001b[33m.\u001b[39mlocator(\u001b[32m\"small\"\u001b[39m))\u001b[33m.\u001b[39mtoHaveAttribute(\u001b[32m\"title\"\u001b[39m\u001b[33m,\u001b[39m installation\u001b[33m.\u001b[39mdirectory)"
        },
        {
          "title": "Expect \"toHaveAttribute\" getByRole('button', { name: 'Choose project', exact: true }).locator('small')",
          "startTime": "2026-11-19T22:17:15.761Z",
          "duration": 54,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 120,
            "column": 42
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 119 |\u001b[39m   \u001b[36mawait\u001b[39m folders\u001b[33m.\u001b[39mlocator(\u001b[32m`[data-directory-path=${JSON.stringify(installation.directory)}]`\u001b[39m)\u001b[33m.\u001b[39mclick()\n \u001b[90m 120 |\u001b[39m   \u001b[36mawait\u001b[39m expect(project\u001b[33m.\u001b[39mlocator(\u001b[32m\"small\"\u001b[39m))\u001b[33m.\u001b[39mtoHaveAttribute(\u001b[32m\"title\"\u001b[39m\u001b[33m,\u001b[39m installation\u001b[33m.\u001b[39mdirectory)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                         ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 121 |\u001b[39m }"
        },
        {
          "title": "Navigate to \"/orchestra/sf-decisions/r_Y2FzZTo2NDcxZGFiOS00MDYzLTQ3OTItOGY4Mi1hMjljMWEzNzMxYjQ6M2MyNTg0ZmItMjkwNy00NGRiLThkNzUtMWYyNDliZTZkYWQ1/changes/r_M2VjMzhiZGEtMjlmYi00ZDcwLWFhNzQtNDJjMWRkYjRhNmI2\"",
          "startTime": "2026-11-19T22:17:15.816Z",
          "duration": 992,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 142,
            "column": 28
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 141 |\u001b[39m         \u001b[36mawait\u001b[39m enterC12Shell(page\u001b[33m,\u001b[39m installation\u001b[33m,\u001b[39m host)\n \u001b[90m 142 |\u001b[39m         expect((\u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mgoto(changeURL(installation\u001b[33m.\u001b[39morigin\u001b[33m,\u001b[39m host)))\u001b[33m?\u001b[39m\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                           ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 143 |\u001b[39m         \u001b[36mawait\u001b[39m expect(page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Recover recorded receipt\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m }))\u001b[33m.\u001b[39mtoBeEnabled()"
        },
        {
          "title": "Expect \"toBe\"",
          "startTime": "2026-11-19T22:17:16.809Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 142,
            "column": 83
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 141 |\u001b[39m         \u001b[36mawait\u001b[39m enterC12Shell(page\u001b[33m,\u001b[39m installation\u001b[33m,\u001b[39m host)\n \u001b[90m 142 |\u001b[39m         expect((\u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mgoto(changeURL(installation\u001b[33m.\u001b[39morigin\u001b[33m,\u001b[39m host)))\u001b[33m?\u001b[39m\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                  ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 143 |\u001b[39m         \u001b[36mawait\u001b[39m expect(page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Recover recorded receipt\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m }))\u001b[33m.\u001b[39mtoBeEnabled()"
        },
        {
          "title": "Expect \"toBeEnabled\" getByRole('button', { name: 'Recover recorded receipt', exact: true })",
          "startTime": "2026-11-19T22:17:16.810Z",
          "duration": 10001,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 143,
            "column": 99
          },
          "error": "Error: \u001b[2mexpect(\u001b[22m\u001b[31mlocator\u001b[39m\u001b[2m).\u001b[22mtoBeEnabled\u001b[2m(\u001b[22m\u001b[2m)\u001b[22m failed\n\nLocator: getByRole('button', { name: 'Recover recorded receipt', exact: true })\nExpected: enabled\nTimeout: 10000ms\nError: element(s) not found\n\nCall log:\n\u001b[2m  - Expect \"toBeEnabled\" with timeout 10000ms\u001b[22m\n\u001b[2m  - waiting for getByRole('button', { name: 'Recover recorded receipt', exact: true })\u001b[22m",
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 142 |\u001b[39m         expect((\u001b[36mawait\u001b[39m page\u001b[33m.\u001b[39mgoto(changeURL(installation\u001b[33m.\u001b[39morigin\u001b[33m,\u001b[39m host)))\u001b[33m?\u001b[39m\u001b[33m.\u001b[39mstatus())\u001b[33m.\u001b[39mtoBe(\u001b[35m200\u001b[39m)\n \u001b[90m 143 |\u001b[39m         \u001b[36mawait\u001b[39m expect(page\u001b[33m.\u001b[39mgetByRole(\u001b[32m\"button\"\u001b[39m\u001b[33m,\u001b[39m { name\u001b[33m:\u001b[39m \u001b[32m\"Recover recorded receipt\"\u001b[39m\u001b[33m,\u001b[39m exact\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m }))\u001b[33m.\u001b[39mtoBeEnabled()\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                                  ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 144 |\u001b[39m         \u001b[90m// Normal shell server/project preferences are allowed. No original\u001b[39m"
        },
        {
          "title": "Close context",
          "startTime": "2026-11-19T22:17:27.010Z",
          "duration": 3,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-recovery.ts",
            "line": 190,
            "column": 19
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m 189 |\u001b[39m           privateRecoveryStateAbsent\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m\u001b[33m,\u001b[39m newAdmission\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m\u001b[33m,\u001b[39m servicesReconstructed\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m\u001b[33m,\u001b[39m sqliteReopened\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m\u001b[33m,\u001b[39m processRestarted\u001b[33m:\u001b[39m \u001b[36mtrue\u001b[39m }))\n \u001b[90m 190 |\u001b[39m       } \u001b[36mfinally\u001b[39m { \u001b[36mawait\u001b[39m fresh\u001b[33m.\u001b[39mclose() }\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                  ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m 191 |\u001b[39m     })"
        },
        {
          "title": "Attach \"c12-reopened-host.log\"",
          "startTime": "2026-11-19T22:17:27.226Z",
          "duration": 0,
          "steps": [],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 87,
            "column": 16
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  86 |\u001b[39m       \u001b[33m.\u001b[39mreplace(\u001b[35m/\\b[a-f0-9]{32,}\\b/gi\u001b[39m\u001b[33m,\u001b[39m \u001b[32m\"[redacted-hex]\"\u001b[39m)\n \u001b[90m  87 |\u001b[39m     \u001b[36mawait\u001b[39m info\u001b[33m.\u001b[39mattach(\u001b[32m\"c12-\"\u001b[39m \u001b[33m+\u001b[39m phase \u001b[33m+\u001b[39m \u001b[32m\"-host.log\"\u001b[39m\u001b[33m,\u001b[39m { body\u001b[33m:\u001b[39m source\u001b[33m,\u001b[39m contentType\u001b[33m:\u001b[39m \u001b[32m\"text/plain\"\u001b[39m })\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m               ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  88 |\u001b[39m     \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(portAvailable\u001b[33m,\u001b[39m { timeout\u001b[33m:\u001b[39m \u001b[35m5\u001b[39m_000\u001b[33m,\u001b[39m message\u001b[33m:\u001b[39m \u001b[32m\"The old C12 host releases its owned listener\"\u001b[39m })\u001b[33m.\u001b[39mtoBe(\u001b[36mtrue\u001b[39m)"
        },
        {
          "title": "The old C12 host releases its owned listener",
          "startTime": "2026-11-19T22:17:27.227Z",
          "duration": 1,
          "steps": [
            {
              "title": "The old C12 host releases its owned listener",
              "startTime": "2026-11-19T22:17:27.228Z",
              "duration": 0,
              "steps": [],
              "location": {
                "file": "sucafina/decisions-support/c12-installation.ts",
                "line": 88,
                "column": 5
              },
              "count": 1,
              "skipped": false,
              "snippet": " \u001b[90m  87 |\u001b[39m     \u001b[36mawait\u001b[39m info\u001b[33m.\u001b[39mattach(\u001b[32m\"c12-\"\u001b[39m \u001b[33m+\u001b[39m phase \u001b[33m+\u001b[39m \u001b[32m\"-host.log\"\u001b[39m\u001b[33m,\u001b[39m { body\u001b[33m:\u001b[39m source\u001b[33m,\u001b[39m contentType\u001b[33m:\u001b[39m \u001b[32m\"text/plain\"\u001b[39m })\n \u001b[90m  88 |\u001b[39m     \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(portAvailable\u001b[33m,\u001b[39m { timeout\u001b[33m:\u001b[39m \u001b[35m5\u001b[39m_000\u001b[33m,\u001b[39m message\u001b[33m:\u001b[39m \u001b[32m\"The old C12 host releases its owned listener\"\u001b[39m })\u001b[33m.\u001b[39mtoBe(\u001b[36mtrue\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m    ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  89 |\u001b[39m   }"
            }
          ],
          "location": {
            "file": "sucafina/decisions-support/c12-installation.ts",
            "line": 88,
            "column": 115
          },
          "count": 1,
          "skipped": false,
          "snippet": " \u001b[90m  87 |\u001b[39m     \u001b[36mawait\u001b[39m info\u001b[33m.\u001b[39mattach(\u001b[32m\"c12-\"\u001b[39m \u001b[33m+\u001b[39m phase \u001b[33m+\u001b[39m \u001b[32m\"-host.log\"\u001b[39m\u001b[33m,\u001b[39m { body\u001b[33m:\u001b[39m source\u001b[33m,\u001b[39m contentType\u001b[33m:\u001b[39m \u001b[32m\"text/plain\"\u001b[39m })\n \u001b[90m  88 |\u001b[39m     \u001b[36mawait\u001b[39m expect\u001b[33m.\u001b[39mpoll(portAvailable\u001b[33m,\u001b[39m { timeout\u001b[33m:\u001b[39m \u001b[35m5\u001b[39m_000\u001b[33m,\u001b[39m message\u001b[33m:\u001b[39m \u001b[32m\"The old C12 host releases its owned listener\"\u001b[39m })\u001b[33m.\u001b[39mtoBe(\u001b[36mtrue\u001b[39m)\n \u001b[90m     |\u001b[39m \u001b[31m\u001b[1m                                                                                                                  ^\u001b[22m\u001b[39m\u001b[0m\n \u001b[90m  89 |\u001b[39m   }"
        },
        {
          "title": "After Hooks",
          "startTime": "2026-11-19T22:17:27.231Z",
          "duration": 5,
          "steps": [],
          "count": 1,
          "skipped": false
        },
        {
          "title": "Worker Cleanup",
          "startTime": "2026-11-19T22:17:27.236Z",
          "duration": 24,
          "steps": [
            {
              "title": "Fixture \"browser\"",
              "startTime": "2026-11-19T22:17:27.237Z",
              "duration": 21,
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
          "message": "Error: \u001b[2mexpect(\u001b[22m\u001b[31mlocator\u001b[39m\u001b[2m).\u001b[22mtoBeEnabled\u001b[2m(\u001b[22m\u001b[2m)\u001b[22m failed\n\nLocator: getByRole('button', { name: 'Recover recorded receipt', exact: true })\nExpected: enabled\nTimeout: 10000ms\nError: element(s) not found\n\nCall log:\n\u001b[2m  - Expect \"toBeEnabled\" with timeout 10000ms\u001b[22m\n\u001b[2m  - waiting for getByRole('button', { name: 'Recover recorded receipt', exact: true })\u001b[22m\n\n\n   at sucafina/decisions-support/c12-recovery.ts:143\n\n  141 |         await enterC12Shell(page, installation, host)\n  142 |         expect((await page.goto(changeURL(installation.origin, host)))?.status()).toBe(200)\n> 143 |         await expect(page.getByRole(\"button\", { name: \"Recover recorded receipt\", exact: true })).toBeEnabled()\n      |                                                                                                   ^\n  144 |         // Normal shell server/project preferences are allowed. No original\n  145 |         // C12 receipt, review digest or command body may be rehydrated from them.\n  146 |         const retainedPrivateState = await page.evaluate((values) => {\n    at /home/runner/work/Orchestra-SF/Orchestra-SF/packages/app-shell/e2e/sucafina/decisions-support/c12-recovery.ts:143:99",
          "codeframe": "   43 |   await page.route(/\\/sucafina\\/procurement\\?sf=decision-recover$/, async (route) => {\n   44 |     try {\n   45 |       expect(route.request().method()).toBe(\"POST\")\n   46 |       const response = await route.fetch({ maxRetries: 0 })\n   47 |       try {\n   48 |         const observed = { status: response.status(), body: await response.json() }\n   49 |         await route.fulfill({ response })\n   50 |         captured.resolve(observed)\n   51 |       } finally { await response.dispose() }\n   52 |     } catch (error) { captured.reject(error); throw error }\n   53 |   }, { times: 1 })\n   54 |   const projected = page.waitForResponse((response) => response.request().method() === \"GET\" &&\n   55 |     new URL(response.url()).pathname === \"/sucafina/api/ui/projections/case\")\n   56 |   await page.getByRole(\"button\", { name: \"Recover recorded receipt\", exact: true }).click()\n   57 |   const response = await captured.promise\n   58 |   expect(response.status).toBe(200)\n   59 |   expect((await projected).status()).toBe(200)\n   60 |   await expect(page.locator(\"dt\").filter({ hasText: /^Producer state$/ }).locator(\"+ dd\")).toHaveText(\"applied\")\n   61 |   return response\n   62 | }\n   63 |\n   64 | function reviewDigest(body: Record<string, unknown>) {\n   65 |   const value = asRecord(body.value).reviewDigest\n   66 |   expect(value).toMatch(/^[a-f0-9]{64}$/)\n   67 |   if (typeof value !== \"string\") throw new Error(\"Original review digest missing\")\n   68 |   return value\n   69 | }\n   70 |\n   71 | export async function interruptedC12Recovery(browser: Browser, info: TestInfo) {\n   72 |   const installation = await createC12Installation()\n   73 |   const errors: string[] = []\n   74 |   try {\n   75 |     const saved = await withC12Host(installation, info, \"initial\", async (host) => {\n   76 |       const session = await browser.newContext()\n   77 |       try {\n[redacted]\n   79 |         const page = await session.newPage()\n   80 |         page.on(\"pageerror\", (error) => errors.push(error.message))\n   81 |         await enterC12Shell(page, installation, host)\n   82 |         expect((await page.goto(changeURL(installation.origin, host)))?.status()).toBe(200)\n   83 |         await expect(page.getByRole(\"button\", { name: \"Read producer review\", exact: true })).toHaveCount(1)\n   84 |         const apply = await readProducerReview(page)\n   85 |         const reviewed = await host.control()\n   86 |         expect(reviewed.traffic.filter((item) => item.mode === \"decision-apply\")).toHaveLength(0)\n   87 |         const proof = reviewDigest(reviewed.traffic.find((item) => item.mode === \"decision-review\")!.result)\n   88 |         const choiceBefore = structuredClone(reviewed.observation.decision.choices)\n   89 |         await host.control(\"interrupt\")\n   90 |         const lost = await dropApplication(page)\n   91 |         await apply.click()\n   92 |         await lost.failed\n   93 |         expect(await lost.status).toBe(503)\n   94 |         const retry = page.getByRole(\"button\", { name: \"Retry same application\", exact: true })\n   95 |         await expect(retry).toBeEnabled()\n   96 |         const observed = await host.control()\n   97 |         const first = observed.traffic.find((item) => item.mode === \"decision-apply\")!\n   98 |         expect(JSON.parse(first.body)).toEqual({ ...host.prepared.request, reviewDigest: proof })\n   99 |         expect(first.result).toEqual({ status: \"unavailable\", reason: \"domain-application-unavailable\" })\n  100 |         expect(first.key).toBeTruthy()\n  101 |         const committed = observed.observation\n  102 |         expect(asRecord(committed.domain.request.pr).estAmount).toBe(150)\n  103 |         expect(committed.domain.version).toMatchObject({ version: 1, by: host.actorId })\n  104 |         expect(committed.domain.request.history).toHaveLength(1)\n  105 |         expect(Array.isArray(committed.domain.request.history) ? committed.domain.re"
        }
      ],
      "status": "failed",
      "annotations": [],
      "workerIndex": 0
    }
  ],
  "ok": false
}
```

## Original C12 report

```json
{
  "testId": "2209c11afb188e42c54f-8dbc06234591a8e8aae3",
  "title": "C12 native UI recovers the original receipt after lost response concurrent edit reload and a new SQLite composition",
  "projectName": "chromium",
  "location": {
    "file": "sucafina/decisions-native-recovery.spec.ts",
    "line": 7,
    "column": 1
  },
  "duration": 60271,
  "annotations": [],
  "tags": [],
  "outcome": "unexpected",
  "path": [],
  "ok": false,
  "results": [
    {
      "startTime": "2026-11-19T22:16:26.248Z",
      "workerIndex": 0
    }
  ]
}
```

