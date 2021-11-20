# jump-log
This is an extension that analyzes the build log file generated by the `rosmake` command.
Generates a view with warnings and errors extracted from `build_output.log`, and you can jump by clicking on it.

## Features
- Press `F5` to run `rosmake` command and watch until `build_output.log` has updated.
- Press `F12` to open the view with warnings and errors extracted from `build_output.log`.
- Execute `Hello cat` command to show cat coding window

## Requirements
Need to copy the `build_output.log` on Linux to windows.

## Extension Settings
This extension contributes the following settings:

* `jump-log.logFile.path`: set path to build_output.log(c:\\\\Users\\\\xxx\\\\Documents\\\\src\\\\build_output.log)
* `jump-log.projectOnLinux.path`: set path to project on Linux(/home/user/work_space/<project_name>)
* `jump-log.projectOnWindows.path`: set path to project on Windows(c:\\\\shared\\\\<project_name>)
* `jump-log.textFile.path`: set path to text file that triggers the start of the build(c:\\\\shared\\\\build_complete.txt)
* `jump-log.imageA.path`: set path to image src A(https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif)
* `jump-log.imageB.path`: set path to image src B(https://media0.giphy.com/media/13CoXDiaCcCoyk/giphy.gif)

## Known Issues
None

## Release Notes

### 0.0.1
Initial release

### 0.0.2
Fix bugs

### 0.0.3
Add compiling window

### 0.0.4
Fix bugs