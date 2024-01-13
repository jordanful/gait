#!/usr/bin/env node

import {program} from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import figlet from 'figlet';
import os from 'os';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

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

    // Load existing .env file, if it exists
    const homeDir = os.homedir();
    const envFilePath = path.join(homeDir, '.gait.env');
    dotenv.config({path: envFilePath});
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

    const envContent = `OPENAI_API_KEY=${apiKey}\nSELECTED_MODEL=${modelAnswer.model}\n`;
    fs.writeFileSync(envFilePath, envContent);
    console.log(chalk.green(`👍 Configuration stored in '${envFilePath}'`));
    console.log(chalk.green.dim('Keep in mind that this is stored as plain text. You can update your settings anytime by running `gait setup` again.'));
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

function processCommand(command) {
    console.log(`Processing command: ${command}`);
    // Add your logic here to process the command
}

// Custom help and no command provided
if (process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === 'help')) {
    displayBanner();
    displayWelcomeMessage();
    program.help();
}

program.parse(process.argv);