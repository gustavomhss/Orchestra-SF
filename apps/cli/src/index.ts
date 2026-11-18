#!/usr/bin/env bun

import { NativeStartup } from "./native-startup"

await NativeStartup.admit()
await import("./cli-main")
