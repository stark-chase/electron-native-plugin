"use strict";
exports.__esModule = true;
var fs = require("fs");
var path = require("path");
var FileSearch_1 = require("./FileSearch");
var ModuleAutoDiscoverEngine = /** @class */ (function () {
    function ModuleAutoDiscoverEngine(searchRoot) {
        if (searchRoot === void 0) { searchRoot = "./"; }
        var fileSearch = new FileSearch_1.FileSearch();
        this.packages = fileSearch.searchFiles(searchRoot, "package.json", ["node_modules"]);
        this.bindingFiles = fileSearch.searchFiles(searchRoot, "binding.gyp", ["node_modules"]);
    }
    ModuleAutoDiscoverEngine.prototype.findModuleByPackageName = function (name) {
        for (var _i = 0, _a = this.packages; _i < _a.length; _i++) {
            var pkg = _a[_i];
            if (JSON.parse(fs.readFileSync(pkg).toString()).name == name)
                return pkg;
        }
        return null;
    };
    ModuleAutoDiscoverEngine.prototype.findModuleByDirectoryName = function (name) {
        for (var _i = 0, _a = this.bindingFiles; _i < _a.length; _i++) {
            var file = _a[_i];
            var dir = path.dirname(file);
            var directories = dir.split(/[\/\\]/);
            if (directories.length > 0) {
                if (directories[directories.length - 1] == name)
                    return file;
            }
        }
        return null;
    };
    return ModuleAutoDiscoverEngine;
}());
exports.ModuleAutoDiscoverEngine = ModuleAutoDiscoverEngine;
