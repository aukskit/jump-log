const vscode = require('vscode');
const fs = require('fs');
// const { stringify } = require('querystring');
// const { countReset } = require('console');
const child_process = require('child_process');

async function watchFile() {
	console.log('watch() called');
	let file = vscode.workspace.getConfiguration('PATH').get("logfile");
	
	if(!file) {
		vscode.window.showErrorMessage("Logfile not found");
		return;
	}
	vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: "Waiting for update",
		cancellable: true
	}, async (progress, token) => {
		const p = new Promise(resolve => {
			// Set progress counter
			let cnt = 0;
			setInterval(() => {
				progress.report({ increment: 1, message: cnt+" sec" })
				cnt++;
			}, 1000)

			// file watcher
			var watcher = fs.watch(file, async function(event, filename) {
				if(event == 'change') {
					watcher.close();
					console.log('watch() finished');
					resolve();

					const answer = await vscode.window.showInformationMessage("Logfile updated. Open logfile?", "Yes", "No")
					
					if(answer === "Yes") {
						// vscode.workspace.openTextDocument(file).then((newDoc) => {
						// 	vscode.window.showTextDocument(newDoc);
						// })
						_extractLog();
					}
				}
			})
			token.onCancellationRequested(() => watcher.close());
		})
		return p;
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
			// vscode.window.showInformationMessage('Jump');
			_analyse();
		})
	);

	// The command has been defined in the package.json file
	context.subscriptions.push(
		vscode.commands.registerCommand('jump-log.watchLogFile', async function () {
			_run_bat();
			watchFile();
			// _extractLog();
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
	
	let windows_path = _get_windows_path(linux_path);

	_jumpTo(windows_path, rows);
}

function _get_windows_path(linux_path)
{
	let searchValue = vscode.workspace.getConfiguration('PATH').get("projectOnUbuntu");
	let replaceValue = vscode.workspace.getConfiguration('PATH').get("projectOnWindows");
	return linux_path.replace(searchValue, replaceValue).replaceAll("\\", "/");
}

function _jumpTo(file_path, line)
{
	vscode.workspace.openTextDocument(file_path).then((newDoc) => {
		vscode.window.showTextDocument(newDoc, { }).then( () => {
			_moveTo(line);
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

function _run_bat()
{
	let path = vscode.workspace.getConfiguration('PATH').get("batfile");
	if(!path) {
		vscode.window.showErrorMessage("batfile not found");
		return;
	}
	cmdOut(path);
}

function cmdRun(command) {
	return child_process.execSync(command).toString();
  }

function cmdOut(command){
	let result = cmdRun(command);
	console.log("> " + command + "\n => " + result);
	return result;
}

function _extractLog(editor) {
	const panel = _webview();

	let file = vscode.workspace.getConfiguration('PATH').get("logfile");
	vscode.workspace.openTextDocument(file).then((newDoc) => {
		let text = newDoc.getText();
		var array = text.split(/\r?\n/g);
		var error = array.filter( function( value ) {
			if(value.match("Error")) {
				return value.split(":").length >= 5 ? value : null;
			} else {
				return null;
			}
		})
		var warning = array.filter( function( value ) {
			if(value.match("warning")) {
				return value.split(":").length >= 5 ? value : null;
			} else {
				return null;
			}
		})
		// set webview title
		panel.title = "Error:"+error.length + " Warning:"+ warning.length;
		
		var list = error.concat(warning);
		for(let i=0; i < list.length; i++) {
			let text = list[i].split(":");
			if(text.length >= 5) {
				let linux_path = text[0];
				let rows = text[1];
				let cols = text[2];
				let type = text[3];
				let discription = text[4];
				let message = "[" + type + "] " + discription;
				console.log(type+":"+discription);
				let windows_path = _get_windows_path(linux_path);
				panel.webview.postMessage({ message: message, path: windows_path, line: rows});
			}
		}
		
	});
}

function _webview()
{
	const panel = vscode.window.createWebviewPanel(
		'catCoding', // Identifies the type of the webview. Used internally
		'Cat Coding', // Title of the panel displayed to the user
		vscode.ViewColumn.One, // Editor column to show the new webview panel in.
		{
			enableScripts: true,
			enableFindWidget: true
		} 
	);
	panel.webview.html = getWebviewContent();

	panel.webview.onDidReceiveMessage(
        message => {
			console.log(message.path);
			_jumpTo(message.path, message.line);
        }
    );
	return panel;
}

function getWebviewContentCat() {
	return `<!DOCTYPE html>
  <html lang="en">
  <head>
	  <meta charset="UTF-8">
	  <meta name="viewport" content="width=device-width, initial-scale=1.0">
	  <title>Cat Coding</title>
  </head>
  <body>
	  <img src="https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif" width="300" />
	  <h1 id="lines-of-code-counter">0</h1>
  
	  <script>
	  
		  const counter = document.getElementById('lines-of-code-counter');
		  
		  let count = 0;
		  counter.textContent = count++;
		  setInterval(() => {
			  counter.textContent = count++;
		  }, 100);
	  </script>
  </body>
  </html>`;
}

function getWebviewContent() {
	return `<!DOCTYPE html>
  <html lang="en">
  <head>
	  <meta charset="UTF-8">
	  <meta name="viewport" content="width=device-width, initial-scale=1.0">
	  <title>Cat Coding</title>
  </head>
  <body>
	  <img src="https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif" width="300" />
	  <div id="parent"></div>
	  
	  <script type="text/javascript">
		function OnLinkClick() {
			let target = document.getElementById("output");
			target.innerHTML = "Penguin";
			return false;
		}

		window.addEventListener('message', event => {
			const message = event.data;
			let elm = document.getElementById('parent');
			let div = document.createElement('div');
			let a = document.createElement('a');
			a.id = "a"+elm.childElementCount;
			a.innerHTML = message.message + "..." + message.path + " : "+ message.line;
			a.href = "#";
			a.onclick = () => {
				const vscode = acquireVsCodeApi();
				vscode.postMessage({
					path: message.path,
					line: message.line
				})
			}
			div.appendChild(a);
			parent.appendChild(div);
		});
	  </script>
  </body>
  </html>`;
}

module.exports = {
	activate,
	deactivate
}
