import fs from 'fs';
import path from 'path';
import os from 'os';

const configFilePath = path.join(os.homedir(), '.myclitoolconfig.json');

export function readConfig() {
    if (fs.existsSync(configFilePath)) {
        const configFile = fs.readFileSync(configFilePath, 'utf8');
        return JSON.parse(configFile);
    }
    return {};
}

export function updateConfig(update) {
    const config = readConfig();
    const updatedConfig = {...config, ...update};
    fs.writeFileSync(configFilePath, JSON.stringify(updatedConfig, null, 2));
}
