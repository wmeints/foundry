#!/usr/bin/env node
import { program } from "commander";

program
  .name("foundry")
  .description("Automate your project with factory control loops")
  .command("init")
  .action((_args) => {
    console.log("Hello world");
  });
