import * as vscode from "vscode";

type QuickPickItemIcon =
    | vscode.Uri
    | { light: vscode.Uri; dark: vscode.Uri }
    | vscode.ThemeIcon
    | undefined;

export class Item implements vscode.QuickPickItem {
    description: string;
    detail: string;
    rawText: string;
    iconPath?: QuickPickItemIcon;

    constructor(
        public label: string,
        public line: number,
        rawText: string,
        description: string = "",
        detail: string = "",
        iconPath?: QuickPickItemIcon
    ) {
        this.label = label.trim();
        this.rawText = rawText;
        this.description = description
        this.detail = detail
        this.iconPath = iconPath
    }
}
