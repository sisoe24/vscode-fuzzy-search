# Fuzzy search

Provides a fuzzy search using the quick pick window of the current text
document.

Bind `fuzzySearch.activeTextEditor` to a keyboard shortcut to use the search
quickly.

## Available Commands

All commands are available by opening the Command Palette (`Command+Shift+P` on macOS and `Ctrl+Shift+P` on Windows/Linux) and typing in one of the following Command Names:

| Command Name                                   | Description                                           | Command ID                                         |
| ---------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| `Search: Fuzzy outline`                        | Fuzzy search through the current file's outline       | `fuzzySearch.activeTextEditor`                     |
| `Search: Fuzzy outline with current selection` | Fuzzy search outline, starting with current selection | `fuzzySearch.activeTextEditorWithCurrentSelection` |
| `Search: Fuzzy diagnostics`                    | Fuzzy search through current file's diagnostics       | `fuzzySearch.activeTextEditorDiagnostics`          |
| `Search: Fuzzy git status`                     | Fuzzy search through git status of working directory  | `fuzzySearch.gitStatus`                            |
| `Search: Fuzzy git changes`                    | Fuzzy search through git changes in current file      | `fuzzySearch.gitChanges`                           |
| `Search: Fuzzy git files`                      | Fuzzy search through git-tracked files in working dir | `fuzzySearch.gitFiles`                              |
| `Search: Fuzzy git files text`                 | Fuzzy search text in git-tracked files of working dir | `fuzzySearch.gitFilesText`                          |

- By default, the extension does not provide any shortcut. But you can assign each command to one. (see [Key Bindings for Visual Studio Code](https://code.visualstudio.com/docs/getstarted/keybindings) for more information).

    Example `keybindings.json` :

    ```json
    [
        {
            "key": "alt+shift+o",
            "command": "fuzzySearch.activeTextEditor",
            "when": "editorTextFocus"
        },
        {
            "key": "alt+shift+d",
            "command": "fuzzySearch.activeTextEditorDiagnostics",
            "when": "editorTextFocus"
        },
        {
            "key": "alt+shift+g",
            "command": "fuzzySearch.gitStatus"
        }
    ]
    ```

## Known Issues

- `Fuzzy git status` does not show deleted git files.
- `Fuzzy git changes` does not show deleted lines.
- `Fuzzy git files` does not show new files (files that are not yet tracked by git).

## Demo

![Demo](./images/demo.gif)
