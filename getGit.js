import {execSync} from 'child_process';
import fs from 'fs';
import path from 'path';

function runGitCommand(command, options = {}) {
    try {
        const output = execSync(`git ${command}`, {
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024, // Default buffer size
            ...options // Merge additional options if provided
        });
        return output.trim();
    } catch (error) {
        console.error(`Error executing git ${command}:`, error.message);
        return null;
    }
}

function listDirectoryTree(dirPath, depth = 0, maxSubDirs = 10, indent = '') {
    if (depth > 10) {
        return indent + '[Depth limit reached]\n';
    }

    let treeText = '';
    const files = fs.readdirSync(dirPath);

    // Exclude certain large directories by name
    const excludedDirs = ['node_modules', '.git', 'dist', 'build'];
    let dirCount = 0;

    files.forEach(file => {
        if (file.startsWith('.') || excludedDirs.includes(file)) {
            // Skip hidden files and excluded directories
            return;
        }

        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            dirCount++;
            if (dirCount > maxSubDirs) {
                treeText += indent + file + '/ [Too many subdirectories]\n';
                return;
            }
            treeText += indent + file + '/\n';
            treeText += listDirectoryTree(filePath, depth + 1, maxSubDirs, indent + '    ');
        } else {
            treeText += indent + file + '\n';
        }
    });

    return treeText;
}

export function gatherGitContext() {
    const currentBranch = runGitCommand('branch --show-current');
    const lastCommitMsg = runGitCommand('log -1 --pretty=%B');
    const status = runGitCommand('status -s');
    const recentCommits = runGitCommand('log --pretty=format:"%h - %an, %ar : %s" -n 5');
    const branchList = runGitCommand('branch -a');
    const remoteInfo = runGitCommand('remote -v');
    const branchTrackingInfo = runGitCommand('branch -vv');
    let diff = '';

    const commitCount = runGitCommand('rev-list --count HEAD');
    if (commitCount && parseInt(commitCount, 10) > 1) {
        try {
            diff = runGitCommand('diff HEAD~1 HEAD', {maxBuffer: 50 * 1024 * 1024});
        } catch (error) {
            console.error('Error obtaining diff:', error.message);
            diff = 'Diff too large to display.';
        }
    } else if (parseInt(commitCount, 10) === 1) {
        diff = runGitCommand('show HEAD');
    } else {
        diff = 'No commits yet.';
    }
    const currentWorkingDirectory = process.cwd();


    const gitContext = {
        directoryTree: listDirectoryTree(currentWorkingDirectory),
        currentBranch,
        lastCommitMsg,
        status: status.split('\n'),
        recentCommits: recentCommits.split('\n'),
        branchList: branchList.split('\n'),
        remoteInfo: remoteInfo.split('\n'),
        branchTrackingInfo: branchTrackingInfo.split('\n'),
        // diff // Skip this for now
    };
    
    return gitContext;
}