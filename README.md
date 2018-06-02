# electron-native-plugin
This is a plugin for WebPack version 4 and higher. It is used to bundle Node native modules for the Electron platform. It was developed mainly to provide this ability for the [electron-angular-webpack](https://github.com/lbassin/electron-angular-webpack) project. 
It consists of three separate NPM packages:
1. **electron-native-plugin**
2. [**electron-native-loader**](https://github.com/evonox/electron-native-loader)
3. [**electron-native-patch-loader**](https://github.com/evonox/electron-native-patch-loader)

The role of these packages is given further in the text.

## Installation
I presume you have Node and NPM installed. 
Then it is necessary to install **node-gyp** which is a Node native module compiler.
```bash
npm install --save-dev node-gyp
```
For the use with this plugin the node-gyp installation **needs to be local**.

Next it is necessary to install a C++ compiler and Python 2.7 specific for your platform. Windows users can use this package to install them. If you use Linux or MacOS, please consult the manual of your distribution to install GCC or CLang tool-chain.
```bash
npm install --global windows-build-tools
```
It might be necessary to setup some environment variables, please consult [windows-build-tools](https://www.npmjs.com/package/windows-build-tools) page.

Then we need electron-rebuild NPM package. This can be installed by the following command.
```bash
npm install --save-dev electron-rebuild
```
Next it is necessary to install **WebPack** if you have not done already.
```bash
npm install --save-dev webpack
```
Finally we can install **electron-native-plugin** packages.
```bash
npm install --save-dev electron-native-plugin
```
The other two plugins, **electron-native-loader** and **electron-native-patch-loader**, will be installed automatically as its peer dependencies.
## Types of native modules
The **electron-native-plugin** supports compilation and bundling of two types of native modules:
* **library native modules**
* **project native modules**

**Library native modules** are the modules present in your **node_modules** directory. They will be most of the time 3rd-party modules that just need to be recompiled for the Electron's V8 machine. The most common scenario is that you will just install such a module via NPM and it will get then compiled by **node-gyp** during the NPM post-install stage.

**Project native modules** are the ones you write yourself and are present in the **src** directory of your project. If you want to integrate a library that takes longer to compile in C++, the recommended scenario is as follows:
1. Prepare a project for your native library outside your Electron project and compile it as a static library.
2. In your post-build process copy the static library with the necessary header files to your Electron project.
3. Write in your Electron project the necessary C/C++ code for the interface with Electron, best using [the Nan library](https://github.com/nodejs/nan).
4. Recompile and link using Webpack just the interface for Electron.

## Algorithm used to compile library native modules
This subclause describes briefly what in fact **electron-native-plugin** is doing when compiling **library native modules**.
1. When the webpack launches the plugin starts by parsing your **package.json** file.
2. Then it reads your dependencies and checks which modules are the native ones. The **devDependencies** section is obviously ignored.
3. The next step the plugin performs is to run **electron-rebuild** command for each native module to convert it for the use with the  Electron V8 machine.
4. Next it will write a substitution map into a file. This map is simply a key/value pair between the old NodeJS file and the Electron native module file.
5. This map is then read by **electron-native-loader** which is used to update the references in your project to the Electron binaries which are then bundled by **WebPack**.

## How to setup webpack.config.js
To setup this set of NPM modules for the use in WebPack is quite simple.
First load and add the ElectronNativePlugin as follows:
```javascript
const Webpack = require('webpack');
const ElectronNativePlugin = require("electron-native-plugin");
...
plugins: 
    [
        new ElectronNativePlugin(),
        new Webpack.IgnorePlugin(/node-gyp/)
    ]
...
```
Finally setup the module rules as follows:
```javascript
...
 module: 
    {
        rules: [
            {
                test: /\.js$/,
                use: 
                [
                    "electron-native-patch-loader",
                    {
                        loader: "electron-native-loader",
                        options: {
                            outputPath: outputPath  // Set here your defined path 
                                                    // for the output bundles, e.g. "./dist"
                        }
                    }
                ]
            },
            { 
                test: /\.node$/, 
                use: "electron-native-loader" 
            }
        ]
    }
...
```

Note: **DO NOT FORGET** to set the output path in the options of **electron-native-loader**. It must be **the root output path** where you place your JS bundles and assets. It is marked by the comment in the figure above.

## Configuration of project native modules
The subclause above described just the minimum configuration of the plugin. If you intend to use compilation of **project native modules**, the configuration is a little more complicated. Let's see the figure below:
```javascript
new ElectronNativePlugin({
        forceRebuild: false,
        outputPath: "./electron/native-modules/aa/bb", // a default relative output path for all native modules
        userModules: 
        [
            "./cc/bb/aa",   // path to the binding.gyp file 
            { 
                source: "./native-module/",     // path to the binding.gyp file
                debugBuild: false,              // we are overriding the default debugBuild settings
                outputPath: "./greeting-module/" // this is a relative path to the path of output bundles, 
                                                 // we override the default
            }
        ],
        debugBuild: true        // yes, do debug builds
    }),
```

Let's describe the options one by one:
* **forceRebuild** - when it is **true**, the **electron-rebuild** command is forced to do the rebuild in every case
* **outputPath** - specifies the **default** relative path to the root output directory for the native modules
* **debugBuild** - when is set to **true**, debug binaries are generated
* **userModules** - specifies the array of **project native module** configuration

The **project module** configuration can be specified either by a string or an object. When a string is used, then it is assumed it is a path to the project's **binding.gyp** file. The object notation is described below.

User module or project module has the following properties:
* **source** -  specifies the path where the **binding.gyp** file is placed
* **debugBuild** - overwrites the default debug build settings
* **outputPath** - overwrites the default output path settings

## Things get a bit tough
Some Node native libraries are not directly compatible with Webpack and cannot be so easily bundled. It is maily due to the fact that they load dependencies in various ways which WebPack cannot detect and parse. One of the examples is sqlite3 database. As a rescue to solve this incompatibility comes electron-native-patch-loader NPM module. It works simply by text replacement of the JS source files based on its JSON configuration. Its description is found at [electron-native-patch-loader](https://github.com/evonox/electron-native-patch-loader) page.
