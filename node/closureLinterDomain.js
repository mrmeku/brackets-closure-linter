(function() {
  'use strict';

  var exec = require('child_process').exec,
      path = require('path'),
      fs = require('fs');

  var GJSLINT_PATH = path.normalize(__dirname +
          '/../closure_linter/gjslint.py').replace(/ /g, '\\ '),
      FIXJSSTYLE_PATH = path.normalize(__dirname +
          '/../closure_linter/fixjsstyle.py').replace(/ /g, '\\ '),
      TEMP_COPY_PREFIX = '/brackets-closure-linter-temp';

  /**
   * Creates a path to a temporary copy in the same directory as original.
   * @param {string} filePath Path of file to copy.
   * @return {string} Path to temporary copy in same directory as original.
   */
  function createTempCopy(text, filePath, callback) {
    var dirName = path.dirname(filePath),
        baseName = path.basename(filePath),
        tempId = 0,
        tempPath = [dirName, TEMP_COPY_PREFIX, '.', baseName].join('');
    while (fs.existsSync(tempPath)) {
      tempId++;
      tempPath = [dirName, TEMP_COPY_PREFIX, tempId, '.', baseName].join('');
    }
    console.log(tempPath);
    fs.writeFile(tempPath, text, function(error) {
      if (error) {
        callback(error, 'Temporary file could not be written.');
      } else {
        callback(null, tempPath);
      }
    });
  }

  /**
   * Runs fixjsstyle on potentially unsaved text.
   * @param {string} text Potentially unsaved text of file.
   * @param {filePath} filePath Path of file to fix.
   * @param {function} callback Callback to be called after. Takes an error or
   *    null as first parameter and gjslint output as the second parameter.
   */
  function gjslint(text, filePath, callback) {
    // TODO (mrmeku): parse gjslintrc for flags.
    var flags = '--quiet --nosummary --strict';
    createTempCopy(text, filePath, function(error, tempPath) {
      var escapedPath = tempPath.replace(/ /g, '\\ '),
          command = ['python', GJSLINT_PATH, flags, escapedPath].join(' ');
      if (error) {
        callback(error, tempPath);
        return;
      }
      exec(command, function(error, stdout, stderr) {
        fs.unlink(tempPath);
        if (stderr) {
          callback(error, stderr);
        } else {
          callback(null, stdout);
        }
      });
    });
  }

  /**
   * Runs fixjsstyle on potentially unsaved text.
   * @param {string} text Potentially unsaved text of file.
   * @param {filePath} filePath Path of file to fix.
   * @param {function} callback Callback to be called after. Takes an error or
   *    null as first parameter and fixed text as the second parameter.
   */
  function fixjsstyle(text, filePath, callback) {
    // TODO (mrmeku): parse gjslintrc for flags.
    var flags = '--strict';
    createTempCopy(text, filePath, function(error, tempPath) {
      var escapedPath = tempPath.replace(/ /g, '\\ '),
          command = ['python', FIXJSSTYLE_PATH, flags, escapedPath].join(' ');
      if (error) {
        callback(error, tempPath);
        return;
      }
      exec(command, function(error, stdout, stderr) {
        var fixedText = fs.readFileSync(tempPath, 'utf8');
        fs.unlink(tempPath);
        if (error) {
          callback(error, stderr);
        } else {
          callback(null, fixedText);
        }
      });
    });
  }

  /**
   * Registers the closure linter domain and gjslint, fixjsstyle methods.
   * @param {!DomainManager} domainManager The DomainManager for the server.
   */
  function init(domainManager) {
    if (!domainManager.hasDomain('closureLinter')) {
      domainManager.registerDomain('closureLinter', {
        major: 0,
        minor: 1
      });
    }

    domainManager.registerCommand(
        'closureLinter',  // domain name
        'gjslint',        // command name
        gjslint,          // command handler function
        true              // this command is asynchronous in Node
    );

    domainManager.registerCommand(
        'closureLinter',  // domain name
        'fixjsstyle',     // command name
        fixjsstyle,       // command handler function
        true              // this command is asynchronous in Node
    );
  }

  exports.init = init;
}());
