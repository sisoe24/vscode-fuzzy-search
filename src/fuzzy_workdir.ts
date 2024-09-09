import * as fs from "fs";
import * as path from "path";
import * as util from "util";
import * as cp from "child_process";

import * as vscode from "vscode";

import { getGitRepository } from "./fuzzy_git";
import { Item } from "./fuzzy_item";

const exec = util.promisify(cp.exec);

class GitFile extends Item {
    constructor(
        public label: string,
        public description: string,
        public detail: string,
        public uri: vscode.Uri
    ) {
        super(label, 0, "", description, detail);
        // TODO: would be cool to get the language icon... but how?
    }
}

async function getGitFiles(workspaceRoot: string): Promise<string[]> {
    const { stdout, stderr } = await exec("git ls-files", { cwd: workspaceRoot });

    if (stderr) {
        vscode.window.showErrorMessage(`Failed to get git files: ${stderr}`);
        return [];
    }

    return stdout.split("\n").filter(Boolean);
}

let index = 0
let fileIndexMap: { [key: string]: number } = {};

export async function showGitFiles() {
    const repo = getGitRepository();
    if (!repo) {
        return;
    }

    const files = await getGitFiles(repo.rootUri.path);
    const items: GitFile[] = [];

    for (const file of files) {
        const filePath = path.join(repo.rootUri.path, file);
        if (!fs.existsSync(filePath)) {
            continue
        }

        items.push(
            new GitFile(
                path.basename(file),
                path.extname(file),
                path.dirname(filePath),
                vscode.Uri.file(filePath)
            )
        );
    }

    items.sort((a, b) => {
        const aTime = fileIndexMap[a.label] || 0;
        const bTime = fileIndexMap[b.label] || 0;
        return bTime - aTime;
    });

    vscode.window
        .showQuickPick(items, {
            title: "Git files",
            placeHolder: "Select a file to open",
            matchOnDescription: true,
            matchOnDetail: true,
        })
        .then((item) => {
            if (!item) {
                return;
            }

            index++;
            fileIndexMap[item.label] = index;
            vscode.window.showTextDocument(item.uri);
        });
}

class GitFileText extends Item {
    constructor(
        public label: string,
        public description: string,
        public detail: string,
        public rawText: string,
        public line: number,
        public uri: vscode.Uri
    ) {
        super(label, line, rawText, description, detail);
    }
}
async function getGitFilesText(): Promise<GitFileText[]> {
    const repo = getGitRepository();
    if (!repo) {
        return [];
    }

    const files = await getGitFiles(repo.rootUri.path);
    const items: GitFileText[] = [];

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
                new GitFileText(
                    text.trim(),
                    `Line: ${line + 1}`,
                    path.relative(repo.rootUri.path, filePath),
                    text,
                    line,
                    vscode.Uri.file(filePath)
                )
            );
        });
    }
    return items;
}

interface LineCharPositionItem extends vscode.QuickPickItem {
    rawText: string;
    line: number;
    uri: vscode.Uri;
}

export async function openTextFilePicker(items: LineCharPositionItem[]) {
    const quickPick = vscode.window.createQuickPick<LineCharPositionItem>();
    quickPick.title = "Git files text";
    quickPick.placeholder = "Select a file to open";
    quickPick.items = items;

    let query = "";

    quickPick.onDidChangeValue((value) => {
        query = value;
    });

    quickPick.onDidAccept(async () => {
        const item = quickPick.selectedItems[0];

        let charPos = item.rawText.toLowerCase().indexOf(query.toLowerCase());
        if (charPos == -1) {
            charPos = 0;
        }

        const position = new vscode.Position(item.line, charPos);
        const selection = new vscode.Selection(position, position);

        const editor = await vscode.window.showTextDocument(item.uri);
        editor.selection = selection;
        editor.revealRange(selection);

        quickPick.hide();
    });

    quickPick.show();
}

export async function showGitFilesText() {
    const items = await getGitFilesText();
    if (items.length === 0) {
        vscode.window.showInformationMessage("No text files in workdir");
        return;
    }

    openTextFilePicker(items);
}
