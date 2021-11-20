const vscode = require('vscode');
const fs = require('fs');

let panel = null;
let isCompiling = false;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	context.subscriptions.push(
		vscode.commands.registerCommand('jump-log.helloCat', function () {
			vscode.window.showInformationMessage('Hello Cat');
			createCatWebview();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('jump-log.openJumpLogWindow', function () {
			if(isPathOK()){
				updateJumpLogWindow();
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('jump-log.watchLogFile', async function () {
			if(isPathOK()){
				removeTextFile();
				watchLogFile();
			}
		})
	);
}

// this method is called when your extension is deactivated
function deactivate() {}

// check path settings
function isPathOK()
{
	let logFilePath = vscode.workspace.getConfiguration('jump-log').get("logFile.path");
	if(!logFilePath) {
		vscode.window.showErrorMessage("\"logFile.path\" is not yet set");
		return false;
	}
	let projectOnLinuxPath = vscode.workspace.getConfiguration('jump-log').get("projectOnLinux.path");
	if(!projectOnLinuxPath) {
		vscode.window.showErrorMessage("\"projectOnLinux.path\" is not yet set");
		return false;
	}
	let projectOnWindowsPath = vscode.workspace.getConfiguration('jump-log').get("projectOnWindows.path");
	if(!projectOnWindowsPath ) {
		vscode.window.showErrorMessage("\"projectOnWindows.path\" is not yet set");
		return false;
	}
	return true;
}


// watch the log file until it is updated, and open a jump log window when it is updated.
async function watchLogFile() {
	
	if(isCompiling) {
		return;
	}

	_dispCompilingWindow();

	vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: "Waiting for update",
		cancellable: true
	}, async (progress, token) => {
		const p = new Promise(resolve => {
			// set progress counter
			let cnt = 0;
			setInterval(() => {
				progress.report({ increment: 1, message: cnt+" sec" })
				cnt++;
			}, 1000)

			// watch for file updates
			let file = vscode.workspace.getConfiguration('jump-log').get("logFile.path");
			var watcher = fs.watch(file, async function(event, filename) {
				if(event == 'change') {
					watcher.close();
					resolve();
					
					vscode.window.showInformationMessage('Logfile updated.');
					// wait for log file to update completely
					setTimeout(() => {
						isCompiling = false;
						updateJumpLogWindow();
					}, 1000)
				}
			})

			// if the user clicks `Cancel`
			token.onCancellationRequested(() => {
				isCompiling = false;
				watcher.close();
				if(panel){
					panel.dispose();
				}
			})
		})
		return p;
	})
}

// remove text file
function removeTextFile()
{
	let path = vscode.workspace.getConfiguration('jump-log').get("textFile.path");
	if(path) {
		fs.unlink(path,(error) => {});
	}
}

// update jump log window(Open the window if it's not already open)
function updateJumpLogWindow() {

	panel =	_createWebview();
	
	let file = vscode.workspace.getConfiguration('jump-log').get("logFile.path");
	vscode.workspace.openTextDocument(file).then((newDoc) => {
		let text = newDoc.getText();
		var array = text.split(/\r?\n/g);
		var error = array.filter( function( value ) {
			if(value.match("error")) {
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

		// set state
		panel.webview.postMessage({ command: "State", state: "done!"});

		// set build completed image
		panel.webview.postMessage({ command: "Image", src: vscode.workspace.getConfiguration('jump-log').get("imageB.path")});
		
		// parse warning and error and add them to webview
		var list = error.concat(warning);
		for(let i=0; i < list.length; i++) {
			let text = list[i].split(":");
			if(text.length >= 5) {
				let linux_path = text[0];
				let rows = text[1];
				let cols = text[2];
				let type = text[3];
				let discription = text[4];
				let message = "[" + type + " ] " + discription;
				let windows_path = _get_windows_path(linux_path);
				
				panel.webview.postMessage({ command: "Add", message: message, path: windows_path, line: rows});
			}
		}
	});
}

// create cat webview!
function createCatWebview()
{
	let p = vscode.window.createWebviewPanel(
		'catCoding', // Identifies the type of the webview. Used internally
		'Cat Coding', // Title of the panel displayed to the user
		vscode.ViewColumn.One, // Editor column to show the new webview panel in.
		{
			enableScripts: true
		} 
	);
	p.webview.html = _getWebviewContentCat();
	
	return p;
}

// display compiling window
function _dispCompilingWindow () 
{
	// set compiling flag
	isCompiling = true;

	// create webview
	panel = _createWebview();

	// set webview title
	panel.title = "Compiling...";

	// set state
	panel.webview.postMessage({ command: "State", state: "compiling..."});

	// set compiling image
	panel.webview.postMessage({ command: "Image", src: vscode.workspace.getConfiguration('jump-log').get("imageA.path")});
}

// create jump log window(webview)
function _createWebview()
{
	if(panel) {
		panel.dispose();
	}
	panel = vscode.window.createWebviewPanel(
		'jumpLog', // Identifies the type of the webview. Used internally
		'Jump Log', // Title of the panel displayed to the user
		vscode.ViewColumn.Two, // Editor column to show the new webview panel in.
		{
			enableScripts: true,
			retainContextWhenHidden: true
		} 
	);
	panel.webview.html = _getWebviewContent();

	// receive message from webview 
	panel.webview.onDidReceiveMessage(
        message => {
			_jumpTo(message.path, message.line);
        }
    );

	// set dispose event
	panel.onDidDispose( e => {
		panel = null;
	});
	
	return panel;
}

// convert linux path to window path
function _get_windows_path(linux_path)
{
	let searchValue = vscode.workspace.getConfiguration('jump-log').get("projectOnLinux.path");
	if(!searchValue) {
		vscode.window.showErrorMessage("projectOnLinux.path not found");
	}
	let replaceValue = vscode.workspace.getConfiguration('jump-log').get("projectOnWindows.path");
	if(!replaceValue ) {
		vscode.window.showErrorMessage("projectOnWindows.path not found");
	}
	return linux_path.replace(searchValue, replaceValue).replaceAll("\\", "/");
}

// jumps to the line in the file.
function _jumpTo(file_path, line)
{
	vscode.workspace.openTextDocument(file_path).then((newDoc) => {
		vscode.window.showTextDocument(newDoc, { viewColumn: 1}).then( () => {
			_moveTo(line);
		})
	})
}

// move to the row of active text editor
function _moveTo(targetline) {
	let editor = vscode.window.activeTextEditor;
	let currentline = editor.selection.active.line + 1;
	if(currentline == targetline) {
		return;
	}
	vscode.commands.executeCommand("cursorMove",
	{
		to: "up", by:'line', value: currentline - targetline
	});
}

// get webview content
function _getWebviewContent() {
	return `<!DOCTYPE html>
  <html lang="en">
  <head>
	  <meta charset="UTF-8">
	  <meta name="viewport" content="width=device-width, initial-scale=1.0">
	  <title>Cat Coding</title>
  </head>
  <body>
	  <img id="img" src="" width="300" />
	  <h1 id="state"></h1>
	  <div id="parent"></div>
	  
	  <script type="text/javascript">
	  	const vscode = acquireVsCodeApi();

		window.addEventListener('message', event => {
			const message = event.data;
			let elm = document.getElementById('parent');
			
			switch(message.command) {
			case "Add":
				let elm = document.getElementById('parent');
				let div = document.createElement('div');
				let a = document.createElement('a');
				a.id = "a"+elm.childElementCount;
				a.innerHTML = message.message + "..." + message.path + " : "+ message.line;
				a.href = "";
				a.onclick = () => {
					vscode.postMessage({
						path: message.path,
						line: message.line
					})
				}
				div.appendChild(a);
				parent.appendChild(div);
				break;
			case "State":
				let state = document.getElementById('state');
				state.textContent = message.state;
				break;
			case "Image":
				let img = document.getElementById('img');
				img.src = message.src;
				break;
			}
		});
	  </script>
  </body>
  </html>`;
}

function _getWebviewContentCat() {
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

module.exports = {
	activate,
	deactivate
}
