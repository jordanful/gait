import {execSync} from 'child_process';
import fs from 'fs';
import path from 'path';

function runGitCommand(command) {
    try {
        const output = execSync(`git ${command}`, {encoding: 'utf8'});
        return output.trim();
    } catch (error) {
        console.error(`Error executing git ${command}:`, error.message);
        return null;
    }
}

function listDirectoryTree(dirPath, depth = 0, maxSubDirs = 10) {
    if (depth > 10) {
        return '[Depth limit reached]';
    }

    let tree = {};
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
                tree[file] = '[Too many subdirectories]';
                return;
            }
            tree[file] = listDirectoryTree(filePath, depth + 1, maxSubDirs);
        } else {
            tree[file] = 'file';
        }
    });

    return tree;
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
        diff = runGitCommand('diff HEAD~1 HEAD');
    } else {
        diff = 'Not enough commits for diff.';
    }
    const currentWorkingDirectory = process.cwd();


    return {
        directoryTree: JSON.stringify(listDirectoryTree(currentWorkingDirectory), null, 2),
        currentBranch,
        lastCommitMsg,
        status: status.split('\n'),
        recentCommits: recentCommits.split('\n'),
        branchList: branchList.split('\n'),
        remoteInfo: remoteInfo.split('\n'),
        branchTrackingInfo: branchTrackingInfo.split('\n'),
        diff
    };
}