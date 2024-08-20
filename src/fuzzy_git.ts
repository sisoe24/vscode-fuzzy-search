import path = require("path");
import * as vscode from "vscode";
import { GitExtension, Repository, Status } from "vscode-git-types";
import { Item } from "./fuzzy_item";

/**
 * Represents a Git blame line pattern. (e.g. 00000000  ... 5 ) text)
 */
const GIT_BLAME_LINE_PATTERN = new RegExp(/(\d+)\)(?:\s(.+))?/);

/**
 * Represents a Git status record.
 */
interface StatusRecord {
    key: string;
    symbol: string;
    description: string;
    icon: string;
}

/**
 * represents a git status object.
 */
type GitChangeInfo = {
    status: StatusRecord;
    uri: vscode.Uri;
};

/**
 * Represents a Git item for quick pick.
 */
class GitItem implements vscode.QuickPickItem {
    constructor(public label: string, public description: string, public uri: vscode.Uri) {}
}

/**
 * represents a hunk in git changes.
 */
type Hunk = {
    startLine: string;
    endLine: string;
    text: string;
};

/**
 * Represents a line hunk in Git changes.
 */
type LineHunk = {
    text: string;
    line: string;
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

function makeGitStatusObject(gitStatusCode: Status, uri: vscode.Uri): GitChangeInfo {
    return { status: StatusMap[gitStatusCode], uri: uri };
}

/**
 * Retrieves the Git repository.
 * @returns The Git repository or null if not found.
 */
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

/**
 * Retrieves the Git status.
 *
 * NOTE: Currently, deleted files are not shown.
 *
 * @returns A promise that resolves to an array of Git status objects.
 */
function getGitStatuses(): GitChangeInfo[] {
    const gitStatusList: GitChangeInfo[] = [];
    const repo = getGitRepository();
    if (!repo) {
        return [];
    }

    for (const change of repo.state.indexChanges) {
        gitStatusList.push(makeGitStatusObject(change.status, change.uri));
    }

    for (const change of repo.state.untrackedChanges) {
        gitStatusList.push(makeGitStatusObject(change.status, change.uri));
    }

    for (const change of repo.state.workingTreeChanges) {
        // Skip deleted for now as I don't know how to show them
        if (change.status === 6) {
            continue;
        }
        gitStatusList.push(makeGitStatusObject(change.status, change.uri));
    }

    return gitStatusList;
}

/**
 * Shows a quick pick of Git status.
 */
export function showGitStatus() {
    const gitStatus = getGitStatuses();
    if (gitStatus.length === 0) {
        vscode.window.showInformationMessage("No git changes found");
        return;
    }

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
            title: "Git status",
            placeHolder: "Select a file to open",
        })
        .then((item) => {
            if (!item) {
                return;
            }
            vscode.window.showTextDocument(item.uri);
        });
}


/**
 * Get git changes by parsing the blame output.
 * @returns A promise that resolves to an array of Hunk.
 */
function parseBlameOutput(blameOutput: String): Hunk[] {
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

    for (const line of blameOutput.split("\n")) {
        if (line.startsWith("00000000")) {
            const match = GIT_BLAME_LINE_PATTERN.exec(line);
            if (match) {
                lines.push({ line: match[1], text: match[2] || "New line" });
            }
        } else {
            addHunk();
        }
    }

    // we could finish a file with a hunk so we need to add it
    addHunk();
    return hunkList;
}

export async function getGitChanges(editor: vscode.TextEditor): Promise<Item[]> {
    const repo = getGitRepository();
    if (!repo) {
        return [];
    }

    const activeFile = getGitStatuses().filter(
        (change) => change.uri.fsPath === editor.document.fileName
    )[0];

    if (!activeFile) {
        vscode.window.showInformationMessage("No git changes found");
        return [];
    }

    if (activeFile.status.key === "UNTRACKED") {
        // We can't show untracked changes since they are not in the git history.
        vscode.window.showInformationMessage("Untracked file");
        return [];
    }

    // Use blame to get the full file and its line count, making it easier to
    // parse compared to diff HEAD. Probably not the most efficient way but it
    // works for now.
    const gitChanges = parseBlameOutput(await repo.blame(activeFile.uri.path));

    if (gitChanges.length === 0) {
        vscode.window.showInformationMessage("No git changes found");
        return [];
    }

    const pickerItems: Item[] = [];

    for (let i = 0; i < gitChanges.length; i++) {
        const file = gitChanges[i];
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
