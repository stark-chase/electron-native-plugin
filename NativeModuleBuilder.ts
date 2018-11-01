import path = require("path");
import fs = require("fs");
import process = require("process");
import child_process = require("child_process");
import fs_extra = require("fs-extra");
import rimraf = require("rimraf");
import { FileSearch } from "./FileSearch";
import { debug } from "util";
import { ModuleAutoDiscoverEngine } from "./ModuleAutoDiscoverEngine"
import os = require("os");

export class NativeModuleBuilder {

    private savedCurrentPath: string;
    private autoDiscover: ModuleAutoDiscoverEngine = null;

    constructor(private options: any, private distPath: string) {}

    compile(moduleOptions: any) {
        // discover the native module
        let moduleDir = this.discoverBindingGyp(moduleOptions.source);
        if(moduleDir == null) {
            console.error(`[ERROR]: Cannot find a native module: ${moduleOptions.source}`);
            process.abort();
            return;
        }

        // build the native module
        let moduleFiles = this.buildNativeModule(moduleDir, moduleOptions.debugBuild);
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

    private buildNativeModule(source: string, debugBuild: boolean) {
        // if debugBuild is unspecified in the module config, then use the global version
        if(debugBuild == null)
            debugBuild = this.options.debugBuild;

        // go to the native module directory
        const projectDir = process.cwd();
        this.saveCurrentPath(source);

        // clean the all binary output to make sure all changes in C/C++ code will get compiled
        this.cleanBinaryOutput();
        this.checkPackageFile();

        // check if node_modules subdirectory does exist
        const nodeModuleDir = path.join(projectDir, source, "node_modules");
        fs_extra.ensureDirSync(nodeModuleDir);

        // check if Python path is specified
        console.info(`Compiling native module in: ${source}...`);
        const pythonFlag = this.options.pythonPath != null ? `--python=${this.options.pythonPath}` : "";
        let debugBuildFlag = debugBuild ? "--debug" : "";
        let parallelBuildFlag = this.options.parallelBuild ? "--jobs " + os.cpus().length : "";

        // compile with node-gyp
        const nodeGypExecutable = path.join(projectDir, "./node_modules/.bin/node-gyp");
        child_process.execSync(`${nodeGypExecutable} configure ${debugBuildFlag} ${pythonFlag} ${parallelBuildFlag}`, {stdio: [0, 1, 2]});
        child_process.execSync(`${nodeGypExecutable} build ${debugBuildFlag} ${parallelBuildFlag}`, {stdio: [0, 1, 2]});

        // rebuild it for Electron
        console.info(`Rebuilding native module in: ${source}...`);
        parallelBuildFlag = this.options.parallelBuild ? "--parallel" : "";
        const electronRebuildExecutable = path.join(projectDir, "./node_modules/.bin/electron-rebuild");
        child_process.execSync(`${electronRebuildExecutable} ${debugBuildFlag} ${parallelBuildFlag} --module-dir ./`, {stdio: [0, 1, 2]});

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

    private checkPackageFile() {
        if(fs.existsSync("./package.json"))
            return;
        // if the NPM package.json file does not exist, then create the default one
        let config: any = {};
        const bindingConfig: any = JSON.parse(fs.readFileSync("./binding.gyp").toString());
        config.name = bindingConfig.targets[0].target_name || "default-name"
        config.version = "1.0.0";
        config.gypFile = true;
        config.main = "index.js";
        fs.writeFileSync("./package.json", JSON.stringify(config, null, 4));
    }

    private searchForElectronNativeFile() {
        let fileSearch = new FileSearch();
        let files = fileSearch.search("./bin", "node");
        if(files.length == 0) {
            console.log("[ERROR]: Cannot find the Electron native module file.");
            process.abort();
            return null;
        }
        return files[0]
    }

    private searchForNodeNativeFile() {
        let fileSearch = new FileSearch();
        let files = fileSearch.search("./build", "node");
        if(files.length == 0) {
            console.log("[ERROR]: Cannot find the NodeJS native module file.");
            process.abort();
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
        if(fs.existsSync(pathToCheck))
            return source;

        if(this.autoDiscover == null)
            this.autoDiscover = new ModuleAutoDiscoverEngine();
        let filename = this.autoDiscover.findModuleByPackageName(source);
        if(filename != null)
            return path.dirname(filename);
        
        filename = this.autoDiscover.findModuleByDirectoryName(source);
        if(filename != null)
            return path.dirname(filename);

        return null;
    }
}