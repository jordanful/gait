#!/usr/bin/env node

import {program} from 'commander';
import inquirer from 'inquirer';
import input from '@inquirer/input';
import select from '@inquirer/select';
import chalk from 'chalk';
import figlet from 'figlet';
import os from 'os';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import ora from "ora";
import OpenAI from "openai";
import {readConfig, updateConfig} from "./config.js";
import {gatherGitContext} from "./getGit.js";

const homeDir = os.homedir();
const envFilePath = path.join(homeDir, '.gait.env');
dotenv.config({path: envFilePath});

function displayBanner() {
    console.log(chalk.green(figlet.textSync('gait', {
        horizontalLayout: 'full',
        font: 'big money-nw',
    })));
}

function displayWelcomeMessage() {
    console.log(chalk.green.dim('👋 Gait is an AI-powered CLI that helps you interact with git repositories using plain old English.'));
    console.log(chalk.green.dim('So, instead of memorizing git commands, you can just ask Gait to do it for you.'))
    console.log(chalk.green.dim("Or if you get stuck in a sticky situation, just describe what you'd like to do and Gait will help you out."))
    console.log(chalk.green('To get started, we need your OpenAI API key. You can get one here: https://platform.openai.com/account/api-keys'))
}

async function setupWizard() {
    displayBanner();
    displayWelcomeMessage();

    let existingApiKey = process.env.OPENAI_API_KEY;
    let apiKey = '';
    if (existingApiKey) {
        const maskedApiKey = `${existingApiKey.substring(0, 3)}...${existingApiKey.slice(-3)}`;
        const useExistingKeyAnswer = await inquirer.prompt([{
            type: 'confirm',
            name: 'useExisting',
            message: `${chalk.bgGreen(`We found an existing OpenAI API key: ${chalk.yellow(maskedApiKey)}. Do you want to use it?`)}`,
            default: true
        }]);

        if (useExistingKeyAnswer.useExisting) {
            apiKey = existingApiKey;
        } else {
            const newApiKeyAnswer = await inquirer.prompt([{
                type: 'password',
                message: chalk.bgGreen('🔒Enter a new OpenAI API key (stored locally only):'),
                name: 'apiKey',
                mask: '○'
            }]);
            apiKey = newApiKeyAnswer.apiKey;
        }
    } else {
        const newApiKeyAnswer = await inquirer.prompt([{
            type: 'password',
            message: chalk.bgGreen('🔒Enter your OpenAI API key (stored locally only):'),
            name: 'apiKey',
            mask: '○'
        }]);
        apiKey = newApiKeyAnswer.apiKey;
    }

    const modelAnswer = await inquirer.prompt([
        {
            type: 'list',
            message: chalk.bgGreen('Select a model (make sure your account has access):'),
            name: 'model',
            choices: [
                'gpt-4-1106-preview',
                'gpt-3.5-turbo-1106'
            ]
        }
    ]);

    updateConfig({
        selectedModel: modelAnswer.model,
    })
    console.log(chalk.green(`👍 We'll use ${modelAnswer.model}. You can update this anytime by running \`gait setup\` again.`));
}

function runGitCommand(command) {
    exec(`git ${command}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Stderr: ${stderr}`);
            return;
        }
        console.log(stdout);
    });
}

program
    .name('gait')
    .description('AI-powered git CLI')
    .version('1.0.0');

program
    .command('setup')
    .description('Run the setup wizard')
    .action(setupWizard);

// Handling generic commands
program
    .arguments('<commands...>')
    .action((commands) => {
        if (commands.length === 1 && commands[0] === 'help') {
            // If the only command is 'help', show help menu
            program.help();
        } else {
            // Process as a generic command
            const fullCommand = commands.join(' ');
            processCommand(fullCommand);
        }
    });

async function fetchSystemPrompt() {
    const systemPrompt = await fetch('https://go.promptprompt.io/I5REV4HB')
    return systemPrompt.text()
}

async function processCommand(command) {
    // First check if we are in a git repo
    const gitDirExists = fs.existsSync('.git');
    if (!gitDirExists) {
        console.log(chalk.red('Hmm... I could not find a git repository here. Are you sure you are in the right directory?'));
        return;
    }
    const repoContext = gatherGitContext();
    console.log(repoContext)
    const systemPrompt = await fetchSystemPrompt();
    const completePrompt = `${systemPrompt}\nRepo context:${repoContext}\nUser's query: ${command}`;
    const spinner = ora('Loading').start();
    spinner.color = 'green';
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
    const completion = await openai.chat.completions.create({
        messages: [{role: 'user', content: completePrompt}],
        model: readConfig().selectedModel,
        response_format: {type: "json_object"}
    });
    spinner.stop();
    const response = completion.choices[0]?.message?.content
    if (response.isRunnable) {
        console.log(chalk.bgGreen(response.message));
        const confirmResponse = await input({message: 'Run it? (y/n)'});
        if (confirmResponse === 'y') {
            runGitCommand(response.command);
            const answer = await select({
                message: 'Done. Should I confirm before running this command next time?',
                choices: [
                    {
                        name: "Always confirm before running any command",
                        value: "always-any"
                    },
                    {
                        name: "Confirm before running this command",
                        value: `always-${response.message}`
                    },
                    {
                        name: "Never confirm before running this command",
                        value: `never-${response.message}`
                    },
                    {
                        name: "Never confirm before running any command",
                        value: "never-any"
                    }
                ]
            });

            switch (answer.value) {
                case "always-any":
                    updateConfig({confirmations: {always: ["*"], never: []}});
                    break;
                case "never-any":
                    updateConfig({confirmations: {always: [], never: ["*"]}});
                    break;
                case `always-${response.message}`:
                    addCommandToConfirmationList("always", response.message);
                    break;
                case `never-${response.message}`:
                    addCommandToConfirmationList("never", response.message);
                    break;
            }

            function addCommandToConfirmationList(listType, command) {
                const config = readConfig();
                if (!config.confirmations) {
                    config.confirmations = {always: [], never: []};
                }
                if (!config.confirmations[listType].includes(command)) {
                    config.confirmations[listType].push(command);
                }
                updateConfig({confirmations: config.confirmations});
            }

        }
    } else {
        console.log(chalk.green(response));
        const followUpResponse = await input({message: ''});
    }

}

// Custom help and no command provided
if (process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === 'help')) {
    displayBanner();
    displayWelcomeMessage();
    program.help();
}

program.parse(process.argv);