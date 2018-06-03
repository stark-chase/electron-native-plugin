import fs = require("fs");
import path = require("path");
import child_process = require("child_process");
import fsExtra = require("fs-extra");
import { NativeModuleBuilder } from "./NativeModuleBuilder"
import { FileSearch } from "./FileSearch";
import  validate = require('@webpack-contrib/schema-utils');

// Options schema
const optionsSchema = {
    type: "object",
    properties: {
        forceRebuild: { type: "boolean" },
        debugBuild: { type: "boolean" },
        outputPath: { type: "string" },
        pythonPath: { 
            anyOf: [
                { type: "string" },
                { type: "null" }
            ]
        },
        userModules: {
            anyOf: [
                { type: "string" },
                {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            source: { type: "string" },
                            debugBuild: { 
                                anyOf: [
                                    { type: "boolean" },
                                    { type: "null" }
                                ]
                            },
                            outputPath: { type: "string" }
                        },
                        additionalProperties: false
                    }
                }
            ]
        }
    },
    additionalProperties: false
}

class ElectronNativePlugin {

    private dependencies: any = {};
    private moduleOutputPaths: any = {};

    private outputPath: string;
    private options: any;
    private fileSearch: FileSearch;

    constructor(options?: any) {
        this.options = this.fillInDefaults(options);
        this.validateOptions();
        this.fileSearch = new FileSearch();
    }

    apply(compiler: any) {
        this.outputPath = compiler.options.output.path || "./dist";
        if(! fs.existsSync(this.outputPath)) {
            fs.mkdirSync(this.outputPath);
        }
        compiler.hooks.environment.tap("ElectronNativePlugin", () => this.rebuildNativeModules());
    }

    private validateOptions() {
        validate({name: "ElectronNativePlugin", schema: optionsSchema, target: this.options});
    }

    private fillInDefaults(options: any) {
        options = options || {};
        options.forceRebuild = options.forceRebuild || false;
        options.outputPath = options.outputPath || "./";
        options.pythonPath = options.pythonPath || null;
        options.debugBuild = options.debugBuild || false;
        options.userModules = options.userModules || [];
        options.userModules = options.userModules.map(item => { 
            return {
                source: item.source || item, 
                outputPath: item.outputPath || options.outputPath,
                debugBuild: item.debugBuild != undefined ? item.debugBuild : null
            };
        });
        return options;
    }

    private rebuildNativeModules() {
        // read the project's package json
        let dependencies = this.readProjectPackage();

        // filter out native dependencies
        let nativeDeps: string[] = [];
        for(let dep in dependencies) {
            if(this.isModuleNative(dep))
                nativeDeps.push(dep);
        }

        // do the Electron build itself
        let forceRebuildFlag = this.options.forceRebuild ? "--force" : "";
        let debugBuildFlag = this.options.debugBuild ? "--debug" : "";
        for(let dep of nativeDeps) {
            console.log(`Building native module ${dep}...`);
            child_process.execSync(`electron-rebuild ${forceRebuildFlag} ${debugBuildFlag} --only ${dep} --module-dir ./node_modules/${dep}`, {stdio: [0, 1, 2]});
            this.saveTheDependency(dep);
        }

        // do the build of user modules
        let moduleBuilder = new NativeModuleBuilder(this.options, this.outputPath);
        this.options.userModules.forEach(m => {
            let moduleFiles = moduleBuilder.compile(m);
            if(moduleFiles != null) {
                this.dependencies[moduleFiles.nodeFile] = moduleFiles.electronFile;
                this.moduleOutputPaths[moduleFiles.nodeFile] = m.outputPath;
            }
        });

        // copy native modules
        for(let gypFile in this.dependencies) {
            // get the output path for the native module
            let outputPath = this.moduleOutputPaths[gypFile] || this.options.outputPath;
            let targetFilePath = path.join(this.outputPath, outputPath);
            // if directory does not exist, then create it
            fsExtra.ensureDirSync(targetFilePath);
            // copy the native module
            let electronNative = this.dependencies[gypFile];
            targetFilePath = path.join(targetFilePath, path.basename(electronNative));
            fs.copyFileSync(electronNative, targetFilePath);
        }

         // prepare and save the substitution map
        for(let gypFile in this.dependencies) {
            let outputPath = this.moduleOutputPaths[gypFile] || this.options.outputPath;
            this.dependencies[gypFile] = path.join(outputPath, path.basename(this.dependencies[gypFile]));
        }
        fs.writeFileSync("./ElectronNativeSubstitutionMap.json", JSON.stringify(this.dependencies));
    }

    private saveTheDependency(moduleName: string) {
        const modulePath = path.dirname(require.resolve(moduleName));
        let gypFile = this.fileSearch.search(modulePath, "node")[0];
        gypFile = path.basename(gypFile);
        const electronFile = this.fileSearch.search(`./node_modules/${moduleName}/bin`, "node")[0];
        this.dependencies[gypFile] = electronFile;
    }

    private isModuleNative(moduleName: string) {
        let modulePath = "";
        try {
            modulePath = path.dirname(require.resolve(moduleName));
        }
        catch(e) {
            console.log(`Warning: module ${moduleName} not found.`);
            return false;
        }
        return this.fileSearch.search(modulePath, "node").length > 0;
    }

    private readProjectPackage() {
        let packageJson = fs.readFileSync("./package.json").toString();
        let dependencies = JSON.parse(packageJson).dependencies;
        return dependencies;
    }
}

export = ElectronNativePlugin;
