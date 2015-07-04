define(function(require, exports, module) {
  'use strict';

  var EXTENSION_ID = 'com.github.mrmeku.closure-linter',
      GJSLINT_ID = EXTENSION_ID + '.gjslint',
      FIXJSSTYLE_ID = EXTENSION_ID + '.fixjsstyle',
      FIXJSSTYLE_ONSAVE_ID = FIXJSSTYLE_ID + '.onSave',
      FIXJSSTYLE_SHORTCUT = [{
        key: 'Ctrl-Shift-J',
        platform: 'win'
      }, {
        key: 'Cmd-Shift-J',
        platform: 'mac'
      }],
      LINT_ERROR_REGEXP = new RegExp('^Line (\\d+), ([E,W])(:[\\d]+: (.*))$'),
      CONFIG_FILE_NAME = '.gjslintrc',
      DEFAULT_CONFIG = {
        flags: {
          gjslint: '--quiet --nosummary --strict',
          fixjsstyle: '--strict'
        }
      };

  var AppInit = brackets.getModule('utils/AppInit'),
      DocumentManager = brackets.getModule('document/DocumentManager'),
      CommandManager = brackets.getModule('command/CommandManager'),
      CodeInspection = brackets.getModule('language/CodeInspection'),
      EditorManager = brackets.getModule('editor/EditorManager'),
      ExtensionUtils = brackets.getModule('utils/ExtensionUtils'),
      FileUtils = brackets.getModule('file/FileUtils'),
      FileSystem = brackets.getModule('filesystem/FileSystem'),
      Menus = brackets.getModule('command/Menus'),
      NodeDomain = brackets.getModule('utils/NodeDomain'),
      PreferencesManager = brackets.getModule('preferences/PreferencesManager'),
      ProjectManager = brackets.getModule('project/ProjectManager');

  // Access to node process with hooks to closure linter.
  var closureLinter = new NodeDomain('closureLinter',
      ExtensionUtils.getModulePath(module, 'node/closureLinterDomain'));

  // Make DocumentManager into a jquery object for event binding.
  var $DocumentManager = $(DocumentManager);

  // Register commands to be made into menu items.
  var fixjsstyleCommand = CommandManager.register(
      'Fixjsstyle', FIXJSSTYLE_ID, fixjsstyleAsync),
      fixjsstyleOnSaveCommand = CommandManager.register(
      'Fixjsstyle On Save', FIXJSSTYLE_ONSAVE_ID, function() {
        setFixjsstyleOnSave(!this.getChecked());
      });


  function _loadConfigHelper(rootPath, currentPath, deferredResult) {
    var configFilePath = currentPath + CONFIG_FILE_NAME;
    var file = FileSystem.getFileForPath(configFilePath);
    FileUtils
        .readAsText(file)
        .then(
        function(content) {
          try {
            var config = JSON.parse(content);
            $.extend(DEFAULT_CONFIG, config);
            deferredResult.resolve(config);
          }
          catch (e) {
            console.error(EXTENSION_ID + ': invalid json ' + configFilePath);
            deferredResult.reject(e);
          }
        },
        function(err) {
          if (rootPath === currentPath) {
            deferredResult.resolve(DEFAULT_CONFIG);
          }
          else {
            currentPath = FileUtils.getParentPath(currentPath);
            _loadConfigHelper(rootPath, currentPath, deferredResult);
          }
        }
        );
  }

  /**
   * Loads closure-linter configuration for the specified file.
   *
   * The configuration file should have name .gjslint. If the specified file
   * is outside the current project root, then defaultConfiguration is used.
   * Otherwise, the configuration file is looked up starting from the directory
   * where the specified file is located, going up to the project root,
   * but no further.
   *
   * @param {string}    fullPath Absolute path for the file linted.
   *
   * @return {$.Promise} Promise to return JSHint configuration object.
   *
   * @see <a href="http://www.jshint.com/docs/options/">JSHint option
   * reference</a>.
   */
  function _loadConfig(fullPath) {

    var projectRoot = ProjectManager.getProjectRoot(),
        deferredResult = new $.Deferred();

    if (!projectRoot || !fullPath) {
      return deferredResult.reject().promise();
    }

    var rootPath = projectRoot.fullPath,
        currentPath = FileUtils.getParentPath(fullPath);

    _loadConfigHelper(rootPath, currentPath, deferredResult);
    return deferredResult.promise();
  }

  /**
   * Makes an asynchronous call to gjslint on the potentially unsaved text.
   * @param {string} text Text content of the potentially unsaved file.
   * @param {string} fullPath Path to the potentially unsaved file being linted.
   * @return {$.Promise} Promise to return an object mapping to an array of
   *     linting errors.
   */
  function gjslintAsync(text, fullPath) {
    var deferred = new $.Deferred();

    _loadConfig(fullPath).then(
        function(config) {
          var flags = config.flags.gjslint;
          closureLinter.exec('gjslint', text, fullPath, flags)
          .done(function(stdout) {
            deferred.resolve({errors: parseGjslintStdout(stdout)});
          })
          .fail(function(error, message) {
            deferred.reject(error, message);
          });
        },
        function() {
          deferred.reject();
        }
    );

    return deferred.promise();
  }


  /**
   * Creates array of linting error objects from stdout of gjslint.
   * @param {string} output Stdout produced by gjslint.
   * @return {Array.<Object>} Array of brackets lint error objects.
   */
  function parseGjslintStdout(stdout) {
    var lines = stdout.split('\n'),
        lintingErrors = [];
    lines.forEach(function(line) {
      var match = LINT_ERROR_REGEXP.exec(line);
      if (match) {
        lintingErrors.push({
          pos: {line: parseInt(match[1], 10) - 1},
          message: match[2] + match[3],
          type: match[2] === 'E' ?
              CodeInspection.Type.ERROR : CodeInspection.Type.WARNING
        });
      }
    });
    return lintingErrors;
  }


  /**
   * Makes an asyncrhonous call to fixjsstyle on the potentially unsaved text.
   * @return {$.Promise} Promise to return text with fixed style.
   */
  function fixjsstyleAsync() {
    var editor = EditorManager.getCurrentFullEditor(),
        fullPath = EditorManager.getCurrentlyViewedPath();

    if (editor && fullPath) {
      var document = editor.document,
          text = document.getText(),
          cursor = editor.getCursorPos(),
          scroll = editor.getScrollPos(),
          flags;

      // Keep a reference of document during async command.
      document.addRef();
      _loadConfig(fullPath).then(
          function(config) {
            var flags = config.flags.fixjsstyle;
            closureLinter.exec('fixjsstyle', text, fullPath, flags)
            .done(function(styledText) {
              if (styledText !== text) {
                // Replace the text and reset the viewport/cursor.
                editor.document.setText(styledText);
                editor.setScrollPos(scroll.x, scroll.y);
                editor.setCursorPos(cursor.line, cursor.ch);
              }
            })
            .always(function() {
              // Release document reference since we are done with it.
              document.releaseRef();
            });
          });
    }
  }


  /**
   * Turns Fixjsstyle On Save command on or off.
   * @param {Boolean} checked True turns command on and vice versa.
   */
  function setFixjsstyleOnSave(checked) {
    $DocumentManager[checked ? 'on' : 'off'](
        'documentSaved', fixjsstyleAsync);
    fixjsstyleOnSaveCommand.setChecked(checked);
    PreferencesManager.set(FIXJSSTYLE_ONSAVE_ID, checked);
    PreferencesManager.save();
  }


  AppInit.appReady(function() {
    // Set up fixjsstyle menu items.
    var editMenu = Menus.getMenu(Menus.AppMenuBar.EDIT_MENU);
    editMenu.addMenuDivider();
    editMenu.addMenuItem(FIXJSSTYLE_ID, FIXJSSTYLE_SHORTCUT);
    editMenu.addMenuItem(FIXJSSTYLE_ONSAVE_ID);
    // Restore previous menu preferences.
    setFixjsstyleOnSave(PreferencesManager.get(FIXJSSTYLE_ONSAVE_ID));
    // Register gjslint to lint javascript and html files.
    CodeInspection.register('javascript', {
      name: GJSLINT_ID,
      scanFileAsync: gjslintAsync
    });
    CodeInspection.register('html', {
      name: GJSLINT_ID,
      scanFileAsync: gjslintAsync
    });
  });
});
