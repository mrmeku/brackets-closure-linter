brackets-closure-linter
=======================

A [Brackets](http://brackets.io/) extension that provides hooks to the [Closure Linter](https://developers.google.com/closure/utilities/). The Closure Linter is a utility that checks JavaScript files for style issues such as operator placement, missing semicolons, spacing, the presence of JsDoc annotations, and more.

Installation
---
To install, place in your ```brackets/src/extensions/user``` folder.

Usage
---
After installation, the closure linter's `gjslint` becomes your default javascript linter. To see it in action, open a JavaScript file. In the bottom right corner of your editor you will either see a green checkmark (which means no problems were found) or a yellow exclamation mark. Click on the exclamation mark and a bottom panel will open listing all the problems found.

The closure linter also comes bundled with a `fixjsstyle` command which can automatically fix identified linting errors. To see it in action, open a JavaScript file. If you see a yellow exclamation mark in the bottom right corner of your editor, you have linting errors that `fixjsstyle` may be able to fix. Select  `Edit > Fixjsstyle` menu or `Cmd-Shift-J(Mac) / Ctrl-Shift-J(Win)` to run the command. Then save your file and watch your linting errors disappear!

You can also have fixjsstyle run automatically whenever you save a javascript or html document by selecting `Edit > Fixjsstyle On Save`.

