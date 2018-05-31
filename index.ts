import fs = require("fs");
import path = require("path");
import child_process = require("child_process");

// This function is taken from the URL given below:
// URL: https://gist.github.com/victorsollozzo/4134793
function recFindByExt(base,ext,files,result) 
{
    files = files || fs.readdirSync(base) 
    result = result || [] 

    files.forEach( 
        function (file) {
            var newbase = path.join(base,file)
            if ( fs.statSync(newbase).isDirectory() )
            {
                result = recFindByExt(newbase,ext,fs.readdirSync(newbase),result)
            }
            else
            {
                if ( file.substr(-1*(ext.length+1)) == '.' + ext )
                {
                    result.push(newbase)
                } 
            }
        }
    )
    return result
}

class ElectronNativePlugin {

    private dependencies: any = {};
    private outputPath: string;

    constructor(options?: any) {
    }

    apply(compiler: any) {
        this.outputPath = compiler.options.output.path || "./dist";
        if(! fs.existsSync(this.outputPath)) {
            fs.mkdirSync(this.outputPath);
        }
        compiler.hooks.environment.tap("ElectronNativePlugin", () => this.rebuildNativeModules());
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
        for(let dep of nativeDeps) {
            child_process.execSync(`electron-rebuild --force --only ${dep} --module-dir ./node_modules/${dep}`, {stdio: [0, 1, 2]});
            this.saveTheDependency(dep);
        }

        // copy native modules
        for(let gypFile in this.dependencies) {
            let electronNative = this.dependencies[gypFile];
            let targetFilePath = path.join(this.outputPath, path.basename(electronNative));
            fs.copyFileSync(electronNative, targetFilePath);
        }

        // prepare and save the substitution map
        for(let gypFile in this.dependencies) {
            this.dependencies[gypFile] = path.basename(this.dependencies[gypFile]);
        }
        fs.writeFileSync("./ElectronNativeSubstitutionMap.json", JSON.stringify(this.dependencies));
    }

    private saveTheDependency(moduleName: string) {
        const modulePath = path.dirname(require.resolve(moduleName));
        let gypFile = recFindByExt(modulePath, "node", undefined, undefined)[0];
        gypFile = path.basename(gypFile);
        const electronFile = recFindByExt(`./node_modules/${moduleName}/bin`, "node", undefined, undefined)[0];
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
        return recFindByExt(modulePath, "node", undefined, undefined).length > 0;
    }

    private readProjectPackage() {
        let packageJson = fs.readFileSync("./package.json").toString();
        let dependencies = JSON.parse(packageJson).dependencies;
        return dependencies;
    }
}

export = ElectronNativePlugin;
