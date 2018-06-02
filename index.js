"use strict";
var fs = require("fs");
var path = require("path");
var child_process = require("child_process");
var fsExtra = require("fs-extra");
var NativeModuleBuilder_1 = require("./NativeModuleBuilder");
var FileSearch_1 = require("./FileSearch");
var ElectronNativePlugin = /** @class */ (function () {
    function ElectronNativePlugin(options) {
        this.dependencies = {};
        this.options = this.fillInDefaults(options);
        this.fileSearch = new FileSearch_1.FileSearch();
    }
    ElectronNativePlugin.prototype.apply = function (compiler) {
        var _this = this;
        this.outputPath = compiler.options.output.path || "./dist";
        if (!fs.existsSync(this.outputPath)) {
            fs.mkdirSync(this.outputPath);
        }
        compiler.hooks.environment.tap("ElectronNativePlugin", function () { return _this.rebuildNativeModules(); });
    };
    ElectronNativePlugin.prototype.fillInDefaults = function (options) {
        options = options || {};
        options.forceRebuild = options.forceRebuild || false;
        options.outputPath = options.outputPath || "./";
        options.pythonPath = options.pythonPath || null;
        options.debugBuild = options.debugBuild || false;
        options.userModules = options.userModules || [];
        options.userModules = options.userModules.map(function (item) {
            return {
                source: item.source || item,
                outputPath: item.outputPath || "./",
                debugBuild: item.debugBuild != undefined ? item.debugBuild : null
            };
        });
        return options;
    };
    ElectronNativePlugin.prototype.rebuildNativeModules = function () {
        var _this = this;
        // read the project's package json
        var dependencies = this.readProjectPackage();
        // filter out native dependencies
        var nativeDeps = [];
        for (var dep in dependencies) {
            if (this.isModuleNative(dep))
                nativeDeps.push(dep);
        }
        // do the Electron build itself
        var forceRebuildFlag = this.options.forceRebuild ? "--force" : "";
        var debugBuildFlag = this.options.debugBuild ? "--debug" : "";
        for (var _i = 0, nativeDeps_1 = nativeDeps; _i < nativeDeps_1.length; _i++) {
            var dep = nativeDeps_1[_i];
            console.log("Building native module " + dep + "...");
            child_process.execSync("electron-rebuild " + forceRebuildFlag + " " + debugBuildFlag + " --only " + dep + " --module-dir ./node_modules/" + dep, { stdio: [0, 1, 2] });
            this.saveTheDependency(dep);
        }
        // do the build of user modules
        var moduleBuilder = new NativeModuleBuilder_1.NativeModuleBuilder(this.options, this.outputPath);
        this.options.userModules.forEach(function (m) {
            var moduleFiles = moduleBuilder.compile(m);
            if (moduleFiles != null)
                _this.dependencies[moduleFiles.nodeFile] = moduleFiles.electronFile;
        });
        // copy native modules
        for (var gypFile in this.dependencies) {
            // get the output path for the native module
            var targetFilePath = path.join(this.outputPath, this.options.outputPath);
            // if directory does not exist, then create it
            fsExtra.ensureDirSync(targetFilePath);
            // copy the native module
            var electronNative = this.dependencies[gypFile];
            targetFilePath = path.join(targetFilePath, path.basename(electronNative));
            fs.copyFileSync(electronNative, targetFilePath);
        }
        // prepare and save the substitution map
        for (var gypFile in this.dependencies) {
            this.dependencies[gypFile] = path.join(this.options.outputPath, path.basename(this.dependencies[gypFile]));
        }
        fs.writeFileSync("./ElectronNativeSubstitutionMap.json", JSON.stringify(this.dependencies));
    };
    ElectronNativePlugin.prototype.saveTheDependency = function (moduleName) {
        var modulePath = path.dirname(require.resolve(moduleName));
        var gypFile = this.fileSearch.search(modulePath, "node")[0];
        gypFile = path.basename(gypFile);
        var electronFile = this.fileSearch.search("./node_modules/" + moduleName + "/bin", "node")[0];
        this.dependencies[gypFile] = electronFile;
    };
    ElectronNativePlugin.prototype.isModuleNative = function (moduleName) {
        var modulePath = "";
        try {
            modulePath = path.dirname(require.resolve(moduleName));
        }
        catch (e) {
            console.log("Warning: module " + moduleName + " not found.");
            return false;
        }
        return this.fileSearch.search(modulePath, "node").length > 0;
    };
    ElectronNativePlugin.prototype.readProjectPackage = function () {
        var packageJson = fs.readFileSync("./package.json").toString();
        var dependencies = JSON.parse(packageJson).dependencies;
        return dependencies;
    };
    return ElectronNativePlugin;
}());
module.exports = ElectronNativePlugin;
//# sourceMappingURL=index.js.map