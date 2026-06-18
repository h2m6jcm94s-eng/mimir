#!/usr/bin/env node
import { Command } from 'commander';
import { ApiClient } from './client';
import { login } from './commands/login';
import { heartbeatNode, listNodes } from './commands/nodes';
import { showStatus } from './commands/status';
import { createTask, getTask, listTasks } from './commands/tasks';

const program = new Command();

program.name('mimir').description('Mimir terminal control and scripting CLI').version('0.0.1');

program
  .command('login')
  .description('Store API URL and key')
  .requiredOption('--api-url <url>', 'Mimir API base URL')
  .requiredOption('--api-key <key>', 'Mimir API key')
  .action((options) => login(options.apiUrl, options.apiKey));

program
  .command('status')
  .description('Show API health status')
  .action(() => showStatus(new ApiClient()));

const tasks = program.command('tasks').description('Manage tasks');

tasks
  .command('list')
  .description('List tasks')
  .option('--status <status>', 'Filter by status')
  .option('--type <type>', 'Filter by type')
  .option('--limit <limit>', 'Limit results', '20')
  .action((options) => listTasks(new ApiClient(), options));

tasks
  .command('get <jobId>')
  .description('Show task details')
  .action((jobId: string) => getTask(new ApiClient(), jobId));

tasks
  .command('create')
  .description('Create a new task')
  .requiredOption('--type <type>', 'Task type')
  .requiredOption('--prompt <prompt>', 'Task prompt')
  .option('--provider <provider>', 'Model provider')
  .option('--model <model>', 'Model name')
  .action((options) => createTask(new ApiClient(), options));

const nodes = program.command('nodes').description('Manage mesh nodes');

nodes
  .command('list')
  .description('List nodes')
  .action(() => listNodes(new ApiClient()));

nodes
  .command('heartbeat <nodeId>')
  .description('Send a heartbeat for a node')
  .option('--status <status>', 'Node status', 'up')
  .action((nodeId: string, options: { status: string }) =>
    heartbeatNode(new ApiClient(), nodeId, options.status)
  );

program.parse();
