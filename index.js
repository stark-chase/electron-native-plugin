"use strict";
var fs = require("fs");
var path = require("path");
var child_process = require("child_process");
var fsExtra = require("fs-extra");
// This function is taken from the URL given below:
// URL: https://gist.github.com/victorsollozzo/4134793
function recFindByExt(base, ext, files, result) {
    files = files || fs.readdirSync(base);
    result = result || [];
    files.forEach(function (file) {
        var newbase = path.join(base, file);
        if (fs.statSync(newbase).isDirectory()) {
            result = recFindByExt(newbase, ext, fs.readdirSync(newbase), result);
        }
        else {
            if (file.substr(-1 * (ext.length + 1)) == '.' + ext) {
                result.push(newbase);
            }
        }
    });
    return result;
}
var ElectronNativePlugin = /** @class */ (function () {
    function ElectronNativePlugin(options) {
        this.dependencies = {};
        this.options = this.fillInDefaults(options);
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
        options.userModules = options.userModules || [];
        options.userModules.filter(function (item) { return typeof item == "string"; })
            .map(function (item) { return { "source": item }; });
        options.userModules.map(function (item) {
            return {
                source: item.source,
                outputPath: item.outputPath || "./"
            };
        });
        return options;
    };
    ElectronNativePlugin.prototype.rebuildNativeModules = function () {
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
        for (var _i = 0, nativeDeps_1 = nativeDeps; _i < nativeDeps_1.length; _i++) {
            var dep = nativeDeps_1[_i];
            child_process.execSync("electron-rebuild " + forceRebuildFlag + " --only " + dep + " --module-dir ./node_modules/" + dep, { stdio: [0, 1, 2] });
            this.saveTheDependency(dep);
        }
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
        var gypFile = recFindByExt(modulePath, "node", undefined, undefined)[0];
        gypFile = path.basename(gypFile);
        var electronFile = recFindByExt("./node_modules/" + moduleName + "/bin", "node", undefined, undefined)[0];
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
        return recFindByExt(modulePath, "node", undefined, undefined).length > 0;
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