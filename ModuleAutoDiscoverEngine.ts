import fs = require("fs");
import path = require("path");
import { FileSearch } from "./FileSearch"

export class ModuleAutoDiscoverEngine {
    private packages: string[];
    private bindingFiles: string[];

    constructor(searchRoot: string = "./") {
        let fileSearch = new FileSearch();
        this.packages = fileSearch.searchFiles(searchRoot, "package.json", ["node_modules"]);
        this.bindingFiles = fileSearch.searchFiles(searchRoot, "binding.gyp", ["node_modules"]);
    }

    findModuleByPackageName(name: string): string {
        for(let pkg of this.packages) {
            if(JSON.parse(fs.readFileSync(pkg).toString()).name == name)
                return pkg;
        }
        return null;
    }

    findModuleByDirectoryName(name: string) {
        for(let file of this.bindingFiles) {
            let dir = path.dirname(file);
            let directories = dir.split(/[\/\\]/);
            if(directories.length > 0) {
                if(directories[directories.length - 1] == name)
                    return file;
            }
        }
        return null;
    }
}
