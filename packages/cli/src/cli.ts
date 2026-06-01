#!/usr/bin/env node
import { runCli } from "./index";

runCli().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
