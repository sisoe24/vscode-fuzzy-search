import * as vscode from "vscode";

type QuickPickItemIcon =
    | vscode.Uri
    | { light: vscode.Uri; dark: vscode.Uri }
    | vscode.ThemeIcon
    | undefined;

export class Item implements vscode.QuickPickItem {

    constructor(
        public label: string,
        public line: number,
        public rawText: string,
        public description: string = "",
        public detail: string = "",
    ) {
    }
}
