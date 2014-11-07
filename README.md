brackets-closure-linter
=======================

[Brackets](http://brackets.io/) Extension that for the [Closure Linter](https://developers.google.com/closure/utilities/) that provides an interface to both gjslint and fixjsstyle.

Installation
---
To install, place in your ```brackets/src/extensions/user``` folder.

Usage
---
To see gjslint in action, open a JavaScript file. In the bottom right corner of your editor you will either see a green checkmark (which means no problems were found) or a yellow exclamation mark. Click on the exclamation mark and a bottom panel will open listing all the problems found.

To see fixjsstyle in action, open a JavaScript file. If you see a yellow exclamation mark in the bottom right corner of your editor, you have linting errors that fixjsstyle may be able to automatically fix. To run fixjsstyle, select  `Edit > Fixjsstyle` menu or `Cmd-Shift-J(Mac) / Ctrl-Shift-J(Win)` key.

You can also have fixjsstyle run automatically whenever you save a javascript or html document by selecting **Edit > Fixjsstyle On Save**

