import * as vscode from "vscode";
import { Item } from "./fuzzy_item";
import { pad } from "./extension";

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

export function getFileDiagnostics(fileName: string, level: vscode.DiagnosticSeverity): Item[] {
    const allDiagnostics = vscode.languages.getDiagnostics();
    const currentFileDiagnostics = allDiagnostics.filter((diag) => diag[0].path === fileName)[0][1];

    const errors = currentFileDiagnostics;
    const items: Item[] = [];

    for (let i = 0; i < errors.length; i++) {
        const error = errors[i];
        const errNum = pad((i + 1).toString(), errors.length.toString().length);
        const errObj = diagnosticIcons[error.severity];

        const loc = `Ln ${error.range.start.line + 1}, Col ${error.range.start.character + 1}`;
        items.push(
            new Item(
                `$(${errObj.icon}) ${errNum} - ${errObj.label}`,
                error.range.start.line,
                error.message,
                `${error.source} [${loc}]`,
                error.message
            )
        );
    }

    return items;
}
