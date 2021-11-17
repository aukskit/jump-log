const vscode = require('vscode');
const fs = require('fs');

let panel = null;
let isCompiling = false;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// The command has been defined in the package.json file
	context.subscriptions.push(
		vscode.commands.registerCommand('jump-log.helloWorld', function () {
			vscode.window.showInformationMessage('Hello world');
			_createCatWebview();
		})
	);

	// The command has been defined in the package.json file
	context.subscriptions.push(
		vscode.commands.registerCommand('jump-log.openJumpLogWindow', function () {
			updateJumpLogWindow();
		})
	);

	// The command has been defined in the package.json file
	context.subscriptions.push(
		vscode.commands.registerCommand('jump-log.watchLogFile', async function () {
			removeTextFile();
			watchLogFile();
		})
	);
}

// this method is called when your extension is deactivated
function deactivate() {}

// Watch the log file until it is updated, and open a jump log window when it is updated.
async function watchLogFile() {
	let file = vscode.workspace.getConfiguration('PATH').get("logfile");
	
	if(!file) {
		vscode.window.showErrorMessage("Logfile not found");
		return;
	}
	if(isCompiling) {
		return;
	}
	
	compilingJumpLogWindow();

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

			// file watcher
			var watcher = fs.watch(file, async function(event, filename) {
				if(event == 'change') {
					watcher.close();
					resolve();
					
					vscode.window.showInformationMessage('Logfile updated.');
					// Wait for log file to update completely
					setTimeout(() => {
						isCompiling = false;
						updateJumpLogWindow();
					}, 1000)
				}
			})
			token.onCancellationRequested(() => {
				watcher.close();
				isCompiling = false;
			})
		})
		return p;
	})
}

// Remove text file
function removeTextFile()
{
	let path = vscode.workspace.getConfiguration('PATH').get("textfile");
	if(path) {
		fs.unlink(path,(error) => {});
	}
}

// update jump log window(Open the window if it's not already open)
function updateJumpLogWindow() {
	if(!panel) {
		_createWebview();
	}
	let file = vscode.workspace.getConfiguration('PATH').get("logfile");
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

		// clear div's children
		panel.webview.postMessage({ command: "Clear"});

		// set state
		panel.webview.postMessage({ command: "State", state: "done!"});

		// set build completed image
		panel.webview.postMessage({ command: "Image", src: vscode.workspace.getConfiguration('PATH').get("image_b")});
		
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
				
				// Add warning/error messages 
				panel.webview.postMessage({ command: "Add", message: message, path: windows_path, line: rows});
			}
		}
	});
}

function compilingJumpLogWindow() 
{	
	isCompiling = true;
	if(!panel) {
		_createWebview();
	}
	panel.title = "Compiling...";

	// clear div's children
	panel.webview.postMessage({ command: "Clear"});

	// set state
	panel.webview.postMessage({ command: "State", state: "compiling..."});

	// set compiling image
	panel.webview.postMessage({ command: "Image", src: vscode.workspace.getConfiguration('PATH').get("image_a")});
}

// create jump log window(webview)
function _createWebview()
{
	panel = vscode.window.createWebviewPanel(
		'catCoding', // Identifies the type of the webview. Used internally
		'Cat Coding', // Title of the panel displayed to the user
		vscode.ViewColumn.One, // Editor column to show the new webview panel in.
		{
			enableScripts: true
		} 
	);
	panel.webview.html = getWebviewContent();

	panel.webview.onDidReceiveMessage(
        message => {
			_jumpTo(message.path, message.line);
        }
    );

	panel.onDidChangeViewState( e => {
		if(isCompiling) {
			compilingJumpLogWindow();
		} else {
			updateJumpLogWindow();
		}
	});

	panel.onDidDispose( e => {
		panel = null;
	});
	
	return panel;
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
		vscode.window.showTextDocument(newDoc, { viewColumn: 1}).then( () => {
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

function getWebviewContent() {
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
			case "Clear":
				while( elm.firstChild ){
					elm.removeChild( elm.firstChild );
				}
				break;
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

function _createCatWebview()
{
	let p = vscode.window.createWebviewPanel(
		'catCoding', // Identifies the type of the webview. Used internally
		'Cat Coding', // Title of the panel displayed to the user
		vscode.ViewColumn.One, // Editor column to show the new webview panel in.
		{
			enableScripts: true
		} 
	);
	p.webview.html = getWebviewContentCat();
	
	return p;
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

module.exports = {
	activate,
	deactivate
}
