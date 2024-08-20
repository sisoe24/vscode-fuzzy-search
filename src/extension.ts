import * as vscode from 'vscode';
import { showGitChanges, showGitFiles } from './fuzzy_git';
import { Item } from "./fuzzy_item"



// Changes "5" to "0005", ie, ensures that |str| has |length| characters in it.
function pad(str: string, length: number) {
  return '0'.repeat(length - str.length) + str
}

function getEnumKey(enumObj: any, value: number | string): string | undefined  {
  return Object.keys(enumObj).find((key) => enumObj[key] === value);
}

let valueFromPreviousInvocation = '';
let lastSelected: Item = new Item('', 0, '');

function showFuzzySearch(editor: vscode.TextEditor, quickPickEntries: Item[], useCurrentSelection: boolean) {
  // Build the entries we will show the user. One entry for each non-empty line,
  // prefixed with the line number. We prefix with the line number so lines stay
  // in the correct order and so duplicate lines do not get merged together.

  // Setup basic quick pick.
  let pick = vscode.window.createQuickPick<Item>();
  pick.items = quickPickEntries;
  pick.canSelectMany = false;

  // Try to preselect the previously selected item.
  if (lastSelected) {
    // Update `lastSelected` reference to point to the current entry in `items`.
    lastSelected = quickPickEntries.find(
      t => t.line == lastSelected.line || t.label == lastSelected.label)!;
  }
  pick.activeItems = [lastSelected];

  // Save the item the user selected so it can be pre-selected next time fuzzy
  // search is invoked.
  pick.onDidAccept(() => {
    lastSelected = pick.selectedItems[0];

    // Find the first occurrence of the search string in the selected item.
    let charPos = lastSelected.rawText
      .toLowerCase()
      .indexOf(valueFromPreviousInvocation.toLowerCase()
    );

    if (charPos == -1) {
      charPos = 0;
    }

    const position = new vscode.Position(lastSelected.line, charPos);
    const selection = new vscode.Selection(position, position);
    editor.selection = selection;

    pick.hide();
  });


  // Show the currently selected item in the editor.
  pick.onDidChangeActive(items => {
    if (!items.length) return;
    
    let p = new vscode.Position(items[0].line, 0);
    editor.revealRange(
    new vscode.Range(p, p), vscode.TextEditorRevealType.InCenter);
    editor.selection = new vscode.Selection(p, p);
  });


  if (useCurrentSelection) {
    pick.value = editor.document.getText(editor.selection);
  } else {
    // Show the previous search string. When the user types a character, the
    // preview string will replaced with the typed character.
    pick.value = valueFromPreviousInvocation;
    let previewValue = valueFromPreviousInvocation;
    let hasPreviewValue = previewValue.length > 0;
    pick.onDidChangeValue(value => {
      if (hasPreviewValue) {
        hasPreviewValue = false;

        // Try to figure out what text the user typed. Assumes that the user
        // typed at most one character.
        for (let i = 0; i < value.length; ++i) {
          if (previewValue.charAt(i) != value.charAt(i)) {
            pick.value = value.charAt(i);
            break;
          }
        }
      }
    });
    // Save the search string so we can show it next time fuzzy search is
    // invoked.
    pick.onDidChangeValue(value => valueFromPreviousInvocation = value);
  }


  // If fuzzy-search was cancelled navigate to the previous location.
  let startingSelection = editor.selection;
  pick.onDidHide(() => {
    if (pick.selectedItems.length == 0) {
      editor.revealRange(
        new vscode.Range(startingSelection.start, startingSelection.end),
        vscode.TextEditorRevealType.InCenter);
      editor.selection = startingSelection;
    }
  });


  pick.show();
}

function fuzzySearch(useCurrentSelection: boolean = false) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const lines: string[] = editor.document.getText().split(/\r?\n/);
  const maxNumberLength = lines.length.toString().length;
  const quickPickEntries: Item[] = [];

  for (let i = 0; i < lines.length; ++i) {
    if (lines[i]) {
      quickPickEntries.push(
        new Item(
          `${pad((i + 1).toString(), maxNumberLength)}: ${lines[i]}`,
          i,
          lines[i]
        )
      );
    }
  }

  showFuzzySearch(editor, quickPickEntries, useCurrentSelection);
}

const diagnosticIcons = {
    [vscode.DiagnosticSeverity.Error]: "$(error)",
    [vscode.DiagnosticSeverity.Warning]: "$(warning)",
    [vscode.DiagnosticSeverity.Information]: "$(info)",
    [vscode.DiagnosticSeverity.Hint]: "$(lightbulb)",
};

function showDiagnostics(level: vscode.DiagnosticSeverity) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const currentFile = editor.document.fileName;
    const allDiagnostics = vscode.languages.getDiagnostics();

    for (const [uri, diagnostics] of allDiagnostics) {
        if (uri.path !== currentFile) {
            continue;
        }

        const errors = diagnostics.filter((diag) => diag.severity <= level);
        const quickPickEntries: Item[] = [];

        for (let i = 0; i < errors.length; i++) {
            const error = errors[i];
            const errNum = pad((i + 1).toString(), errors.length.toString().length);
            const errLabel = getEnumKey(vscode.DiagnosticSeverity, error.severity);

            quickPickEntries.push(
                new Item(
                    `[${errNum} ${errLabel}]: ${error.message}`,
                    error.range.start.line,
                    error.message
                )
            );
        }

        showFuzzySearch(editor, quickPickEntries, false);
    }
}


export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand("fuzzySearch.activeTextEditor", () => fuzzySearch())
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("fuzzySearch.activeTextEditorWithCurrentSelection", () =>
            fuzzySearch(true)
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("fuzzySearch.gitFiles", () => {
            showGitFiles();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("fuzzySearch.gitChanges", async () => {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            return;
          }
            const items = await showGitChanges(editor);
            showFuzzySearch(editor, items, false);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("fuzzySearch.activeTextEditorErrors", () =>
            // TODO: We should make it configurable
            showDiagnostics(vscode.DiagnosticSeverity.Error)
        )
    );
}
