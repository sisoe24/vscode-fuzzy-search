import path = require("path");
import * as vscode from "vscode";
import { GitExtension, Repository, Status } from "vscode-git-types";
import { Item } from "./fuzzy_item";

interface StatusRecord {
    key: string;
    symbol: string;
    description: string;
    icon: string;
}

type GitStatusObject = {
    status: StatusRecord;
    uri: vscode.Uri;
};

// prettier-ignore
const StatusMap: Record<Status, StatusRecord> = {
    [Status.INDEX_MODIFIED]: { key: 'INDEX_MODIFIED', symbol: 'M', description: 'Modified in index', icon: 'diff-modified' },
    [Status.INDEX_ADDED]: { key: 'INDEX_ADDED', symbol: 'A', description: 'Added to index', icon: 'diff-added' },
    [Status.INDEX_DELETED]: { key: 'INDEX_DELETED', symbol: 'D', description: 'Deleted from index', icon: 'diff-removed' },
    [Status.INDEX_RENAMED]: { key: 'INDEX_RENAMED', symbol: 'R', description: 'Renamed in index', icon: 'diff-renamed' },
    [Status.INDEX_COPIED]: { key: 'INDEX_COPIED', symbol: 'C', description: 'Copied in index', icon: '' },
    [Status.MODIFIED]: { key: 'MODIFIED', symbol: 'M', description: 'Modified in working tree', icon: 'diff-modified' },
    [Status.DELETED]: { key: 'DELETED', symbol: 'D', description: 'Deleted in working tree', icon: 'diff-removed' },
    [Status.UNTRACKED]: { key: 'UNTRACKED', symbol: '?', description: 'Untracked', icon: 'diff-added' },
    [Status.IGNORED]: { key: 'IGNORED', symbol: '!', description: 'Ignored', icon: 'diff-ignored' },
    [Status.INTENT_TO_ADD]: { key: 'INTENT_TO_ADD', symbol: 'A', description: 'Intent to add', icon: 'diff-added' },
    [Status.INTENT_TO_RENAME]: { key: 'INTENT_TO_RENAME', symbol: 'R', description: 'Intent to rename', icon: 'diff-renamed' },
    [Status.TYPE_CHANGED]: { key: 'TYPE_CHANGED', symbol: 'T', description: 'Type changed', icon: '' },
    [Status.ADDED_BY_US]: { key: 'ADDED_BY_US', symbol: 'U', description: 'Added by us in merge', icon: 'git-merge' },
    [Status.ADDED_BY_THEM]: { key: 'ADDED_BY_THEM', symbol: 'T', description: 'Added by them in merge', icon: 'git-merge' },
    [Status.DELETED_BY_US]: { key: 'DELETED_BY_US', symbol: 'U', description: 'Deleted by us in merge', icon: 'git-merge' },
    [Status.DELETED_BY_THEM]: { key: 'DELETED_BY_THEM', symbol: 'T', description: 'Deleted by them in merge', icon: 'git-merge' },
    [Status.BOTH_ADDED]: { key: 'BOTH_ADDED', symbol: 'B', description: 'Both added in merge', icon: 'git-merge' },
    [Status.BOTH_DELETED]: { key: 'BOTH_DELETED', symbol: 'B', description: 'Both deleted in merge', icon: 'git-merge' },
    [Status.BOTH_MODIFIED]: { key: 'BOTH_MODIFIED', symbol: 'B', description: 'Both modified in merge', icon: 'git-merge' },
};

function makeGitStatusObject(gitStatusCode: Status, uri: vscode.Uri): GitStatusObject {
    return { status: StatusMap[gitStatusCode], uri: uri };
}

function getGitRepository(): Repository | null {
    const gitExtension = vscode.extensions.getExtension<GitExtension>("vscode.git")?.exports;
    if (!gitExtension) {
        vscode.window.showErrorMessage("Git extension not found");
        return null;
    }

    const git = gitExtension.getAPI(1);
    const repo = git.repositories[0];

    if (!repo) {
        vscode.window.showErrorMessage("No git repositories found");
        return null;
    }
    return repo;
}


async function getGitStatus(): Promise<GitStatusObject[]> {
    const gitStatus: GitStatusObject[] = [];
    const repo = getGitRepository();
    if (!repo) {
        return [];
    }

    for (const change of repo.state.indexChanges) {
        gitStatus.push(makeGitStatusObject(change.status, change.uri));
    }

    for (const change of repo.state.untrackedChanges) {
        gitStatus.push(makeGitStatusObject(change.status, change.uri));
    }

    for (const change of repo.state.workingTreeChanges) {
        // Skip deleted for now as I don't know how to show them
        if (change.status === 6) {
            continue;
        }
        gitStatus.push(makeGitStatusObject(change.status, change.uri));
    }

    return gitStatus;
}

class GitItem implements vscode.QuickPickItem {
    constructor(public label: string, public description: string, public uri: vscode.Uri) {}
}

export async function showGitStatus() {
    const gitStatus = await getGitStatus();
    const pickerItems: GitItem[] = [];

    for (const file of gitStatus) {
        pickerItems.push(
            new GitItem(
                `$(${file.status.icon}) ${file.status.symbol} ${path.basename(file.uri.path)}`,
                file.status.description,
                file.uri
            )
        );
    }

    vscode.window
        .showQuickPick(pickerItems, {
            title: "Git files",
            placeHolder: "Select a file to open",
        })
        .then((item) => {
            if (!item) {
                return;
            }
            vscode.window.showTextDocument(item.uri);
        });
}

type Hunk = {
    startLine: string;
    endLine: string;
    text: string;
};

type LineHunk = {
    text: string;
    line: string;
};

const pattern = new RegExp(/(\d+)\)(?:\s(.+))?/);

export async function showGitChanges(editor: vscode.TextEditor): Promise<Item[]> {

    const repo = getGitRepository();
    if (!repo) {
        return [];
    }

    // todo need also index changed (staged)
    const activeFile = repo.state.workingTreeChanges.filter(
        (change) => change.uri.fsPath === editor.document.fileName
    )[0];

    // Use blame to get the full file and its line count, making it easier to 
    // parse compared to diff HEAD.
    const blame = await repo.blame(activeFile.uri.path);

    let lines: LineHunk[] = [];
    const hunkList: Hunk[] = [];

    const addHunk = function () {
        if (lines.length === 0) {
            return;
        }

        hunkList.push({
            startLine: lines[0].line,
            endLine: lines[lines.length - 1].line,
            text: lines
                .map((value) => {
                    return value.text.trim();
                })
                .join("\n"),
        });
        lines.length = 0;
    };

    for (const line of blame.split("\n")) {
        if (line.startsWith("00000000")) {
            const match = pattern.exec(line);
            if (match) {
                lines.push({ line: match[1], text: match[2] || "New line" });
            }
        } else {
            addHunk();
        }
    }

    // we could finish a file with a hunk so we need to add it
    addHunk();

    const pickerItems: Item[] = [];

    for (let i = 0; i < hunkList.length; i++) {
        const file = hunkList[i];
        pickerItems.push(
            new Item(
                `$(git-commit) Hunk ${i + 1}`,
                Number(file.startLine) - 1,
                "",
                `line: ${file.startLine} - ${file.endLine}`,
                file.text
            )
        );
    }
    return pickerItems;
}
