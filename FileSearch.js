"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
// This function is taken from the URL given below:
// URL: https://gist.github.com/victorsollozzo/4134793
var FileSearch = /** @class */ (function () {
    function FileSearch() {
    }
    FileSearch.prototype.search = function (base, ext) {
        return this.recFindByExt(base, ext, undefined, undefined);
    };
    FileSearch.prototype.recFindByExt = function (base, ext, files, result) {
        var _this = this;
        files = files || fs.readdirSync(base);
        result = result || [];
        files.forEach(function (file) {
            var newbase = path.join(base, file);
            if (fs.statSync(newbase).isDirectory()) {
                result = _this.recFindByExt(newbase, ext, fs.readdirSync(newbase), result);
            }
            else {
                if (file.substr(-1 * (ext.length + 1)) == '.' + ext) {
                    result.push(newbase);
                }
            }
        });
        return result;
    };
    return FileSearch;
}());
exports.FileSearch = FileSearch;
//# sourceMappingURL=FileSearch.js.map