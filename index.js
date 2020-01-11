const path = require('path')
module.exports = class GetScriptWebpackPlugin {
    constructor(options = {}, callback = () => {}) {
        this.filename = options.filename ? options.filename : 'files.json'
        this.state = {}
        this.options = {}
        this.afterAssetsGenerater = callback
    }

    /**
     * Encode each path component using `encodeURIComponent` as files can contain characters
     * which needs special encoding in URLs like `+ `.
     *
     * @param {string} filePath
     */
    urlencodePath (filePath) {
        return filePath.split('/').map(encodeURIComponent).join('/');
    }


    getAssets(compilation, entryNames) {
        const compilationHash = compilation.hash

        /**
         * @type {string} the configured public path to the asset root
         * if a path publicPath is set in the current webpack config use it otherwise
         * fallback to a realtive path
         */
        const webpackPublicPath = compilation.mainTemplate.getPublicPath({ hash: compilationHash });
        const isPublicPathDefined = webpackPublicPath.trim() !== '';
        let publicPath = isPublicPathDefined
          // If a hard coded public path exists use it
          ? webpackPublicPath
          // If no public path was set get a relative url path
          : path.relative(path.resolve(compilation.options.output.path, path.dirname(childCompilationOutputName)), compilation.options.output.path)
            .split(path.sep).join('/');

        if (publicPath.length && publicPath.substr(-1, 1) !== '/') {
            publicPath += '/';
        }

        /**
         * @type {{
        publicPath: string,
        js: Array<string>,
        css: Array<string>,
        manifest?: string,
        favicon?: string
      }}
         */
        const assets = {
            // The public path
            publicPath: publicPath,
            // Will contain all js and mjs files
            js: [],
            // Will contain all css files
            css: [],
            // Will contain the html5 appcache manifest files if it exists
            manifest: Object.keys(compilation.assets).find(assetFile => path.extname(assetFile) === '.appcache'),
            // Favicon
            favicon: undefined
        };
        // Extract paths to .js, .mjs and .css files from the current compilation
        const entryPointPublicPathMap = {};
        const extensionRegexp = /\.(css|js|mjs)(\?|$)/;
        for (let i = 0; i < entryNames.length; i++) {
            const entryName = entryNames[i];
            const entryPointFiles = compilation.entrypoints.get(entryName).getFiles();
            // Prepend the publicPath and append the hash depending on the
            // webpack.output.publicPath and hashOptions
            // E.g. bundle.js -> /bundle.js?hash
            const entryPointPublicPaths = entryPointFiles
              .map(chunkFile => {
                  const entryPointPublicPath = publicPath + this.urlencodePath(chunkFile);
                  return entryPointPublicPath;
              });

            entryPointPublicPaths.forEach((entryPointPublicPath) => {
                const extMatch = extensionRegexp.exec(entryPointPublicPath);
                // Skip if the public path is not a .css, .mjs or .js file
                if (!extMatch) {
                    return;
                }
                // Skip if this file is already known
                // (e.g. because of common chunk optimizations)
                if (entryPointPublicPathMap[entryPointPublicPath]) {
                    return;
                }
                entryPointPublicPathMap[entryPointPublicPath] = true;
                // ext will contain .js or .css, because .mjs recognizes as .js
                const ext = extMatch[1] === 'mjs' ? 'js' : extMatch[1];
                assets[ext].push(entryPointPublicPath);
            });
        }
        return assets;
    }

    apply(compiler) {
        compiler.hooks.emit.tap('getScriptWebpackPlugin', (compilation) => {
            try {
                const entryNames = Array.from(compilation.entrypoints.keys())
                this.state = this.getAssets(compilation, entryNames)
                Object.assign(this.state, this.options)
                const content = JSON.stringify(this.state, null, 2)
                compilation.assets[this.filename] = {
                    source: () => content,
                    size: () => content.length
                }
                this.afterAssetsGenerater(this.state)
            } catch (e) {
                console.log(e);
            }
        })
    }
}
