import * as fs from "fs";
import * as path from "path";
import * as util from "util";
import * as cp from "child_process";

import * as vscode from "vscode";

import { getGitRepository } from "./fuzzy_git";

const exec = util.promisify(cp.exec);

async function getGitFiles(workspaceRoot: string): Promise<string[]> {
    const { stdout, stderr } = await exec("git ls-files", { cwd: workspaceRoot });

    if (stderr) {
        console.error(`git ls-files stderr: ${stderr}`);
    }

    return stdout.split("\n").filter(Boolean);
}

// TODO: we have already 3 classes of quickpickitem. Should we merge them?
class GitFileItem implements vscode.QuickPickItem {
    iconPath?: vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | vscode.ThemeIcon | undefined;

    constructor(
        public label: string,
        public description: string = "",
        public detail: string = "",
        public uri: vscode.Uri,
        public line: number | undefined,
        public rawText: string | undefined
    ) {
        // TODO: should be cool to get the language icon... but how?
        // this.iconPath = vscode.ThemeIcon.File;
    }
}

export async function showWorkdirFiles() {
    const repo = getGitRepository();
    if (!repo) {
        return;
    }

    const files = await getGitFiles(repo.rootUri.path);
    const items: GitFileItem[] = [];

    for (const file of files) {
        const filePath = path.join(repo.rootUri.path, file);

        items.push(
            new GitFileItem(
                path.basename(file),
                path.extname(file),
                path.dirname(filePath),
                vscode.Uri.file(filePath),
                undefined,
                undefined
            )
        );
    }

    vscode.window
        .showQuickPick(items, {
            title: "Workdir files",
            placeHolder: "Select a file to open",
            matchOnDescription: true,
            matchOnDetail: true,
        })
        .then((item) => {
            if (!item) {
                return;
            }
            vscode.window.showTextDocument(item.uri);
        });
}

async function getWorkdirFilesText(): Promise<GitFileItem[]> {
    const repo = getGitRepository();
    if (!repo) {
        return [];
    }

    const files = await getGitFiles(repo.rootUri.path);
    const items: GitFileItem[] = [];

    for (const file of files) {
        const filePath = path.join(repo.rootUri.path, file);

        // file could be deleted from repo but still present in git ls-files
        if (!fs.existsSync(filePath)) {
            continue;
        }

        const fileContent = fs.readFileSync(filePath);

        // Check if the file is binary. not always accurate, but good enough for most cases
        if (fileContent.includes(0)) {
            continue;
        }

        const lines = fileContent.toString("utf-8").split("\n");

        lines.forEach((text, line) => {
            if (text.length === 0) {
                return;
            }

            items.push(
                new GitFileItem(
                    text.trim(),
                    `Line: ${line + 1}`,
                    path.relative(repo.rootUri.path, filePath),
                    vscode.Uri.file(filePath),
                    line,
                    text
                )
            );
        });
    }
    return items;
}

export async function showWorkdirFilesText() {
    const items = await getWorkdirFilesText();

    const quickPick = vscode.window.createQuickPick<GitFileItem>();
    quickPick.title = "Workdir files";
    quickPick.placeholder = "Select a file to open";
    quickPick.items = items;

    let query = "";

    quickPick.onDidChangeValue((value) => {
        query = value;
    });

    quickPick.onDidAccept(async () => {
        const item = quickPick.selectedItems[0];
        if (!item) {
            quickPick.hide();
            return;
        }
        const editor = await vscode.window.showTextDocument(item.uri);
        if (item.line === undefined || item.rawText === undefined) {
            quickPick.hide();
            return;
        }

        let charPos = item.rawText.toLowerCase().indexOf(query.toLowerCase());

        if (charPos == -1) {
            charPos = 0;
        }

        const position = new vscode.Position(item.line, charPos);
        const selection = new vscode.Selection(position, position);
        editor.selection = selection;
        editor.revealRange(selection);

        quickPick.hide();
    });

    quickPick.show();
}
