import path = require("path");
import fs = require("fs");
import process = require("process");
import child_process = require("child_process");
import fs_extra = require("fs-extra");
import rimraf = require("rimraf");
import { FileSearch } from "./FileSearch";

export class NativeModuleBuilder {

    private savedCurrentPath: string;

    constructor(private options: any, private distPath: string) {}

    compile(moduleOptions: any) {
        // discover the native module
        if(! this.discoverBindingGyp(moduleOptions.source)) {
            console.error(`Cannot find the native module: ${moduleOptions.source}`);
            return null;
        }

        // build the native module
        console.info(`Building native module: ${moduleOptions.source}...`);
        let moduleFiles = this.buildNativeModule(moduleOptions.source);
        if(moduleFiles == null)
            return null;

        // copy the resulting binary
        this.copyBinaryOutput(moduleFiles, moduleOptions);

        moduleFiles.nodeFile = path.basename(moduleFiles.nodeFile); // TODO: Remove, should be done in SaveDependency
        return moduleFiles;
    }

    private copyBinaryOutput(moduleFiles: any, moduleOptions: any) {
        const targetDir = path.join(this.distPath, moduleOptions.outputPath);
        fs_extra.ensureDirSync(targetDir);
        const targetFilePath = path.join(targetDir, path.basename(moduleFiles.electronFile));
        fs.copyFileSync(moduleFiles.electronFile, targetFilePath);
    }

    private buildNativeModule(source: string) {
        // go to the native module directory
        const projectDir = process.cwd();
        this.saveCurrentPath(source);

        // clean the all binary output to make sure all changes in C/C++ code will get compiled
        this.cleanBinaryOutput();

        // check if Python path is specified
        const pythonFlag = this.options.pythonDir != null ? `--python=${this.options.pythonDir}` : "";
        // compile with node-gyp
        const nodeGypExecutable = path.join(projectDir, "./node_modules/.bin/node-gyp");
        child_process.execSync(`${nodeGypExecutable} configure ${pythonFlag}`, {stdio: [0, 1, 2]});
        child_process.execSync(`${nodeGypExecutable} build`, {stdio: [0, 1, 2]});

        // rebuild it for Electron
        const electronRebuildExecutable = path.join(projectDir, "./node_modules/.bin/electron-rebuild");
        child_process.execSync(`${electronRebuildExecutable} --module-dir ./`, {stdio: [0, 1, 2]});

        // find Node and Electron native module files
        let electronModuleFile = this.searchForElectronNativeFile();
        if(electronModuleFile == null) {
            this.restoreSavedPath();
            return null;
        }
        electronModuleFile = path.resolve(electronModuleFile);

        let nodeModuleFile = this.searchForNodeNativeFile();
        if(nodeModuleFile == null) {
            this.restoreSavedPath();
            return null;
        }

        // restore the previous path
        this.restoreSavedPath();
        return {
            nodeFile: nodeModuleFile,
            electronFile: electronModuleFile
        };
    }

    private searchForElectronNativeFile() {
        let fileSearch = new FileSearch();
        let files = fileSearch.search("./bin", "node");
        if(files.length == 0) {
            console.log("Error: Cannot find the Electron native module file.");
            return null;
        }
        return files[0]
    }

    private searchForNodeNativeFile() {
        let fileSearch = new FileSearch();
        let files = fileSearch.search("./build", "node");
        if(files.length == 0) {
            console.log("Error: Cannot find the NodeJS native module file.");
            return null;
        }
        return files[0]
    }

    private saveCurrentPath(path: string) {
        this.savedCurrentPath = process.cwd();
        process.chdir(path);
    }

    private restoreSavedPath() {
        process.chdir(this.savedCurrentPath);
    }

    private cleanBinaryOutput() {
        rimraf.sync("./bin");
        rimraf.sync("./build");
    }

    private discoverBindingGyp(source: string) {
        const pathToCheck = path.join(source, "binding.gyp");
        return fs.existsSync(pathToCheck);
    }
}