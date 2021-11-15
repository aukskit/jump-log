const vscode = require('vscode');
const fs = require('fs');

async function watchFile() {
	console.log('watch() called');
	let file = vscode.workspace.getConfiguration('PATH').get("logfile");
	if(!file) {
		vscode.window.showErrorMessage("Logfile not found")
	} else {
		vscode.window.showInformationMessage("Start watching Logfile for update")
	}
	var watcher = fs.watch(file, function(event, filename) {
		if(event == 'change') {
			watcher.close();
			console.log('watch() finished');
			vscode.window.showInformationMessage("logfile updated")
		}
	})
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	console.log('Congratulations, your extension "jump-log" is now active!');

	// The command has been defined in the package.json file
	context.subscriptions.push(
		vscode.commands.registerCommand('jump-log.helloWorld', function () {
			vscode.window.showInformationMessage('Hello world');
		})
	);

	// The command has been defined in the package.json file
	context.subscriptions.push(
		vscode.commands.registerCommand('jump-log.jumpToFile', function () {
			vscode.window.showInformationMessage('Jump');
			_analyse();
		})
	);

	// The command has been defined in the package.json file
	context.subscriptions.push(
		vscode.commands.registerCommand('jump-log.watchLogFile', function () {
			watchFile();
		})
	);
}

// this method is called when your extension is deactivated
function deactivate() {}

function _analyse() {
	let editor = vscode.window.activeTextEditor;
	let text = editor.document.lineAt(editor.selection.active.line).text;

	// '/home/xxx/xxx/xxx/a.cpp:30:0: Error' -> Goto: 'c:\Users\xxx\a.cpp' line:30
	let word = text.split(":");
	if(word.length < 3) {
		return;
	}
	let linux_path = word[0];
	let rows = word[1];
	let cols = word[2];
	
	let searchValue = vscode.workspace.getConfiguration('PATH').get("projectOnUbuntu");
	let replaceValue = vscode.workspace.getConfiguration('PATH').get("projectOnWindows");

	let windows_path = linux_path.replace(searchValue, replaceValue);

	vscode.workspace.openTextDocument(windows_path).then((newDoc) => {
		vscode.window.showTextDocument(newDoc, { }).then( () => {
			_moveTo(rows);
		})
	})
}

function _moveTo(targetline) {
	let editor = vscode.window.activeTextEditor;
	let currentline = editor.selection.active.line + 1;
	if(currentline === targetline) {
		return;
	}
	vscode.commands.executeCommand("cursorMove",
	{
		to: "up", by:'line', value: currentline - targetline
	});
}

module.exports = {
	activate,
	deactivate
}
