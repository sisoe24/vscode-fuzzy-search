import * as util from "util";
import * as cp from "child_process";

import * as vscode from "vscode";

const exec = util.promisify(cp.exec);

import { getGitRepository } from "./fuzzy_git";
import path = require("path");

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
        public uri: vscode.Uri
    ) {
        // TODO: should be cool to get the language icon... but how?
        this.iconPath = vscode.ThemeIcon.File;
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
                vscode.Uri.file(filePath)
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
