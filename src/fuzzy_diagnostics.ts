import * as vscode from "vscode";
import { Item } from "./fuzzy_item";

const diagnosticIcons = {
    [vscode.DiagnosticSeverity.Error]: {
        label: "Error",
        icon: "error",
    },
    [vscode.DiagnosticSeverity.Warning]: {
        label: "Warning",
        icon: "warning",
    },
    [vscode.DiagnosticSeverity.Information]: {
        label: "Information",
        icon: "info",
    },
    [vscode.DiagnosticSeverity.Hint]: {
        label: "Hint",
        icon: "lightbulb",
    },
};

class DiagnosticItem extends Item {
    constructor(
        public label: string,
        public description: string,
        public detail: string,
        public line: number,
        public charPos: number
    ) {
        super(label, line, "", description, detail);
    }
}

function getFileDiagnostics(filePath: string): DiagnosticItem[] {
    const allDiagnostics = vscode.languages.getDiagnostics();
    if (allDiagnostics.length === 0) {
        vscode.window.showInformationMessage("No diagnostics found");
        return [];
    }

    const currentFileDiagnostics = allDiagnostics.filter((diag) => diag[0].path === filePath)[0][1];
    const items: DiagnosticItem[] = [];

    for (let i = 0; i < currentFileDiagnostics.length; i++) {
        const error = currentFileDiagnostics[i];
        const errObj = diagnosticIcons[error.severity];

        const loc = `Ln ${error.range.start.line + 1}, Col ${error.range.start.character + 1}`;
        items.push(
            new DiagnosticItem(
                `$(${errObj.icon}) ${errObj.label}`,
                `${error.source} [${loc}]`,
                error.message,
                error.range.start.line,
                error.range.start.character
            )
        );
    }

    items.sort((a, b) => {
        return a.line - b.line;
    });

    return items;
}

interface LineCharPositionItem extends vscode.QuickPickItem {
    line: number;
    charPos: number;
}

function openLinePicker(editor: vscode.TextEditor, items: LineCharPositionItem[]): void {
    const quickPick = vscode.window.createQuickPick<LineCharPositionItem>();

    quickPick.title = "Diagnostics";
    quickPick.canSelectMany = false;
    quickPick.placeholder = "Search a diagnostic to jump to";
    quickPick.items = items;
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = true;

    // Preselect the first item that is at or below the current cursor position.
    quickPick.activeItems = [items.filter((item) => item.line >= editor.selection.active.line)[0]];

    quickPick.onDidChangeActive((items) => {
        let p = new vscode.Position(items[0].line, items[0].charPos);
        editor.revealRange(new vscode.Range(p, p), vscode.TextEditorRevealType.InCenter);
        editor.selection = new vscode.Selection(p, p);
    });

    quickPick.onDidAccept(() => {
        const item = quickPick.selectedItems[0];
        const position = new vscode.Position(item.line, item.charPos);
        const selection = new vscode.Selection(position, position);
        editor.selection = selection;
        editor.revealRange(selection);

        quickPick.hide();
    });

    quickPick.show();
}

export function showFileDiagnostics(editor: vscode.TextEditor) {
    const items = getFileDiagnostics(editor.document.fileName);
    if (items.length === 0) {
        return;
    }

    openLinePicker(editor, items);
}
