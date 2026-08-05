#!/usr/bin/env node
import { program } from "commander";

const foundry = program
  .name("foundry")
  .description("Automate your project with factory control loops");


foundry.command('init').description('Initialize foundry in your project').action(() => console.log('initialize project'));
foundry.command('run').description('Run a control loop in your project').action(() => console.log('run control loop'));

foundry.parse();