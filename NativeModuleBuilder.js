"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var path = require("path");
var fs = require("fs");
var process = require("process");
var child_process = require("child_process");
var fs_extra = require("fs-extra");
var rimraf = require("rimraf");
var FileSearch_1 = require("./FileSearch");
var NativeModuleBuilder = /** @class */ (function () {
    function NativeModuleBuilder(options, distPath) {
        this.options = options;
        this.distPath = distPath;
    }
    NativeModuleBuilder.prototype.compile = function (moduleOptions) {
        // discover the native module
        if (!this.discoverBindingGyp(moduleOptions.source)) {
            console.error("Cannot find the native module: " + moduleOptions.source);
            return null;
        }
        // build the native module
        console.info("Building native module: " + moduleOptions.source + "...");
        var moduleFiles = this.buildNativeModule(moduleOptions.source);
        if (moduleFiles == null)
            return null;
        // copy the resulting binary
        this.copyBinaryOutput(moduleFiles, moduleOptions);
        moduleFiles.nodeFile = path.basename(moduleFiles.nodeFile); // TODO: Remove, should be done in SaveDependency
        return moduleFiles;
    };
    NativeModuleBuilder.prototype.copyBinaryOutput = function (moduleFiles, moduleOptions) {
        var targetDir = path.join(this.distPath, moduleOptions.outputPath);
        fs_extra.ensureDirSync(targetDir);
        var targetFilePath = path.join(targetDir, path.basename(moduleFiles.electronFile));
        fs.copyFileSync(moduleFiles.electronFile, targetFilePath);
    };
    NativeModuleBuilder.prototype.buildNativeModule = function (source) {
        // go to the native module directory
        var projectDir = process.cwd();
        this.saveCurrentPath(source);
        // clean the all binary output to make sure all changes in C/C++ code will get compiled
        this.cleanBinaryOutput();
        // check if Python path is specified
        var pythonFlag = this.options.pythonDir != null ? "--python=" + this.options.pythonDir : "";
        // compile with node-gyp
        var nodeGypExecutable = path.join(projectDir, "./node_modules/.bin/node-gyp");
        child_process.execSync(nodeGypExecutable + " configure " + pythonFlag, { stdio: [0, 1, 2] });
        child_process.execSync(nodeGypExecutable + " build", { stdio: [0, 1, 2] });
        // rebuild it for Electron
        var electronRebuildExecutable = path.join(projectDir, "./node_modules/.bin/electron-rebuild");
        child_process.execSync(electronRebuildExecutable + " --module-dir ./", { stdio: [0, 1, 2] });
        // find Node and Electron native module files
        var electronModuleFile = this.searchForElectronNativeFile();
        if (electronModuleFile == null) {
            this.restoreSavedPath();
            return null;
        }
        electronModuleFile = path.resolve(electronModuleFile);
        var nodeModuleFile = this.searchForNodeNativeFile();
        if (nodeModuleFile == null) {
            this.restoreSavedPath();
            return null;
        }
        // restore the previous path
        this.restoreSavedPath();
        return {
            nodeFile: nodeModuleFile,
            electronFile: electronModuleFile
        };
    };
    NativeModuleBuilder.prototype.searchForElectronNativeFile = function () {
        var fileSearch = new FileSearch_1.FileSearch();
        var files = fileSearch.search("./bin", "node");
        if (files.length == 0) {
            console.log("Error: Cannot find the Electron native module file.");
            return null;
        }
        return files[0];
    };
    NativeModuleBuilder.prototype.searchForNodeNativeFile = function () {
        var fileSearch = new FileSearch_1.FileSearch();
        var files = fileSearch.search("./build", "node");
        if (files.length == 0) {
            console.log("Error: Cannot find the NodeJS native module file.");
            return null;
        }
        return files[0];
    };
    NativeModuleBuilder.prototype.saveCurrentPath = function (path) {
        this.savedCurrentPath = process.cwd();
        process.chdir(path);
    };
    NativeModuleBuilder.prototype.restoreSavedPath = function () {
        process.chdir(this.savedCurrentPath);
    };
    NativeModuleBuilder.prototype.cleanBinaryOutput = function () {
        rimraf.sync("./bin");
        rimraf.sync("./build");
    };
    NativeModuleBuilder.prototype.discoverBindingGyp = function (source) {
        var pathToCheck = path.join(source, "binding.gyp");
        return fs.existsSync(pathToCheck);
    };
    return NativeModuleBuilder;
}());
exports.NativeModuleBuilder = NativeModuleBuilder;
//# sourceMappingURL=NativeModuleBuilder.js.map