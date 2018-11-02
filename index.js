"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var fs = require("fs");
var path = require("path");
var child_process = require("child_process");
var fsExtra = require("fs-extra");
var NativeModuleBuilder_1 = require("./NativeModuleBuilder");
var FileSearch_1 = require("./FileSearch");
var validate = require("@webpack-contrib/schema-utils");
var optionsSchema = require("./options.schema.json");
var ElectronNativePlugin = /** @class */ (function () {
    function ElectronNativePlugin(options) {
        this.dependencies = {};
        this.moduleOutputPaths = {};
        this.options = this.fillInDefaults(options);
        this.validateOptions();
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
    ElectronNativePlugin.prototype.validateOptions = function () {
        validate({ name: "ElectronNativePlugin", schema: optionsSchema, target: this.options });
    };
    ElectronNativePlugin.prototype.fillInDefaults = function (options) {
        options = options || {};
        options.forceRebuild = options.forceRebuild || false;
        options.outputPath = options.outputPath || "./";
        options.pythonPath = options.pythonPath || null;
        options.debugBuild = options.debugBuild || false;
        options.parallelBuild = options.parallelBuild || false;
        options.userModules = options.userModules || [];
        options.userModules = options.userModules.map(function (item) {
            return {
                source: item.source || item,
                outputPath: item.outputPath || options.outputPath,
                debugBuild: item.debugBuild != undefined ? item.debugBuild : null
            };
        });
        return options;
    };
    ElectronNativePlugin.prototype.rebuildNativeModules = function () {
        var _this = this;
        // read the project's package json
        var dependencies = this.readProjectPackage();
        // filter out not installed optional dependencies
        var filteredDeps = [];
        for (var dep in dependencies) {
            if (!this.isModuleOptionalAndNotInstalled(dep))
                filteredDeps.push(dep);
        }
        // filter out native dependencies
        var nativeDeps = [];
        for (var dep in filteredDeps) {
            var dependency = filteredDeps[dep];
            if (this.isModuleNative(dependency))
                nativeDeps.push(dependency);
        }
        // do the Electron build itself
        var forceRebuildFlag = this.options.forceRebuild ? "-f" : "";
        var debugBuildFlag = this.options.debugBuild ? "-b" : "";
        var parallelBuildFlag = this.options.parallelBuild ? "-p" : "";
        for (var _i = 0, nativeDeps_1 = nativeDeps; _i < nativeDeps_1.length; _i++) {
            var dep = nativeDeps_1[_i];
            console.log("Rebuilding native module " + dep + "...");
            child_process.execSync("electron-rebuild " + forceRebuildFlag + " " + debugBuildFlag + " " + parallelBuildFlag + " -o " + dep, { stdio: [0, 1, 2] });
            this.saveTheDependency(dep);
        }
        // do the build of user modules
        var moduleBuilder = new NativeModuleBuilder_1.NativeModuleBuilder(this.options, this.outputPath);
        this.options.userModules.forEach(function (m) {
            var moduleFiles = moduleBuilder.compile(m);
            if (moduleFiles != null) {
                _this.dependencies[moduleFiles.nodeFile] = moduleFiles.electronFile;
                _this.moduleOutputPaths[moduleFiles.nodeFile] = m.outputPath;
            }
        });
        // copy native modules
        for (var gypFile in this.dependencies) {
            // get the output path for the native module
            var outputPath = this.moduleOutputPaths[gypFile] || this.options.outputPath;
            var targetFilePath = path.join(this.outputPath, outputPath);
            // if directory does not exist, then create it
            fsExtra.ensureDirSync(targetFilePath);
            // copy the native module
            var electronNative = this.dependencies[gypFile];
            targetFilePath = path.join(targetFilePath, gypFile);
            fs.copyFileSync(electronNative, targetFilePath);
        }
        // prepare and save the substitution map
        for (var gypFile in this.dependencies) {
            var outputPath = this.moduleOutputPaths[gypFile] || this.options.outputPath;
            this.dependencies[gypFile] = path.join(outputPath, path.basename(this.dependencies[gypFile]));
        }
        fs.writeFileSync("./ElectronNativeSubstitutionMap.json", JSON.stringify(this.dependencies));
    };
    ElectronNativePlugin.prototype.saveTheDependency = function (moduleName) {
        var modulePath = path.resolve(path.dirname(require.resolve(moduleName)), "build/");
        var gypFile = this.fileSearch.search(modulePath, "node")[0];
        gypFile = path.basename(gypFile);
        var electronFile = this.fileSearch.search("./node_modules/" + moduleName + "/bin", "node")[0];
        this.dependencies[gypFile] = electronFile;
    };
    ElectronNativePlugin.prototype.isModuleOptionalAndNotInstalled = function (moduleName) {
        var modulePath = "";
        var packageJson = fs.readFileSync("./package.json").toString();
        var optionalDependencies = JSON.parse(packageJson).optionalDependencies;
        if (!(moduleName in optionalDependencies))
            return false;
        try {
            modulePath = path.dirname(require.resolve(moduleName));
        }
        catch (e) {
            console.log("[WARNING]: Module " + moduleName + ", configured in your package.json as optional, not found. Skipped.");
            return true;
        }
        return false;
    };
    ElectronNativePlugin.prototype.isModuleNative = function (moduleName) {
        var modulePath = "";
        try {
            modulePath = path.dirname(require.resolve(moduleName));
        }
        catch (e) {
            console.log("[WARNING]: Module " + moduleName + ", configured in your package.json, not found. Please, check your dependencies.");
            return false;
        }
        return this.fileSearch.search(modulePath, "node").length > 0;
    };
    ElectronNativePlugin.prototype.readProjectPackage = function () {
        var packageJson = fs.readFileSync("./package.json").toString();
        var dependencies = JSON.parse(packageJson).dependencies;
        if (this.options.optionalDependencies) {
            var optionalDependencies = JSON.parse(packageJson).optionalDependencies;
            dependencies = __assign({}, dependencies, optionalDependencies);
        }
        return dependencies;
    };
    return ElectronNativePlugin;
}());
module.exports = ElectronNativePlugin;
