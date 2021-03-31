const childProcess = require('child_process');
const path = require('path');
const process = require('process');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const WorkboxPlugin = require('workbox-webpack-plugin');
const CircularDependencyPlugin = require('circular-dependency-plugin');
const webpack = require('webpack');
const { merge } = require('webpack-merge');
const WebpackAssetsManifest = require('webpack-assets-manifest');

const commitHash = childProcess
    .execSync('git rev-parse HEAD')
    .toString()
    .trim();

module.exports = {
    player: playerConfig,
    deno: denoConfig,
};

function playerConfig(latestTag) {
    return merge(baseConfig(), {
        entry: {
            player: path.resolve(__dirname, 'aux-player', 'index.ts'),
            vm: path.resolve(
                __dirname,
                '..',
                '..',
                'aux-vm-browser',
                'html',
                'IframeEntry.js'
            ),
            'service-worker': path.resolve(
                __dirname,
                './shared/service-worker.ts'
            ),
            worker: path.resolve(
                __dirname,
                '..',
                '..',
                'aux-vm-browser',
                'vm',
                'WorkerEntry.ts'
            ),
        },
        plugins: [
            new CleanWebpackPlugin({
                cleanOnceBeforeBuildPatterns: [],
            }),
            new CircularDependencyPlugin({
                exclude: /node_modules/,
                failOnError: false,
                allowAsyncCycles: false,
                cwd: process.cwd(),
            }),
            new VueLoaderPlugin(),
            new HtmlWebpackPlugin({
                chunks: ['player', 'vendors', 'monaco'],
                // inject: false,
                template: path.resolve(__dirname, 'aux-player', 'index.html'),
                title: 'CasualOS',
                filename: 'player.html',
                favicon: path.resolve(__dirname, 'aux-player', 'favicon.ico'),
            }),
            new HtmlWebpackPlugin({
                chunks: ['vm', 'vendors'],
                // inject: false,
                template: path.resolve(
                    __dirname,
                    '..',
                    '..',
                    'aux-vm-browser',
                    'html',
                    'iframe_host.html'
                ),
                title: 'AUX VM',
                filename: 'aux-vm-iframe.html',
            }),
            new webpack.ProvidePlugin({
                THREE: '@casual-simulation/three',
            }),
            ...commonPlugins(latestTag),
            new WorkboxPlugin.GenerateSW({
                clientsClaim: true,
                skipWaiting: true,
                exclude: [/webxr-profiles/, /\.map$/, /fonts\/NotoSansKR/],
                include: [
                    /\.html$/,
                    /\.css$/,
                    /\.json$/,
                    /\.js$/,
                    /\.png$/,
                    /\.glb$/,
                    /\.ico$/,
                    /\.ttf$/,
                    /roboto-v18-latin-regular\.woff2$/,
                ],
                runtimeCaching: [
                    {
                        // The esbuild WASM file has a hash in the filename
                        // so we can cache it. Also there should only ever be one of them so
                        // we can discard old ones.
                        handler: 'CacheFirst',
                        urlPattern: /esbuild\.wasm$/,
                        method: 'GET',
                        options: {
                            cacheName: 'esbuild',
                            expiration: {
                                maxEntries: 1,
                            },
                        },
                    },
                    {
                        // draco_decoder does not have a hash in its filename
                        // so we will use the cached version while fetching the new version.
                        // Also there should only ever be one so we can discard old ones.
                        handler: 'StaleWhileRevalidate',
                        urlPattern: /draco_decoder\.wasm$/,
                        method: 'GET',
                        options: {
                            cacheName: 'draco_decoder',
                            expiration: {
                                maxEntries: 1,
                            },
                        },
                    },
                    {
                        // Other WASM files should have a hash in the filename
                        // so we can cache them and use an expiration date.
                        handler: 'CacheFirst',
                        urlPattern: /\.wasm$/,
                        method: 'GET',
                        options: {
                            cacheName: 'wasm',
                            expiration: {
                                maxAgeSeconds: 604800, // 7 days in seconds
                            },
                        },
                    },
                    {
                        // The assets-manifest.json file is used to determine which script to
                        // fetch for the VM. We will make a request every time we need it but can fallback
                        // to the cached version if needed.
                        handler: 'NetworkFirst',
                        urlPattern: /assets-manifest\.json$/,
                        method: 'GET',
                    },
                    {
                        // The /api/config request is used to determine some extra configuration for the app.
                        // We will make a request each time we need it but can fallback to the cached version if needed.
                        handler: 'NetworkFirst',
                        urlPattern: /\/api\/config$/,
                        method: 'GET',
                    },
                ],
                maximumFileSizeToCacheInBytes: 15728640, // 5MiB
                importScriptsViaChunks: ['service-worker'],
                swDest: 'sw.js',
                inlineWorkboxRuntime: true,
            }),
            new CopyPlugin({
                patterns: [
                    {
                        from:
                            'node_modules/@webxr-input-profiles/assets/dist/profiles',
                        to: path.resolve(__dirname, 'dist', 'webxr-profiles'),
                        context: path.resolve(__dirname, '..', '..', '..'),
                    },
                    {
                        from: path.resolve(
                            __dirname,
                            'shared',
                            'public',
                            'draco'
                        ),
                        to: path.resolve(__dirname, 'dist', 'gltf-draco'),
                    },
                    {
                        from: path.resolve(__dirname, 'aux-player', 'legal'),
                        to: path.resolve(__dirname, 'dist'),
                    },
                    {
                        from: path.resolve(
                            __dirname,
                            'aux-player',
                            'legal',
                            'terms-of-service.txt'
                        ),
                        to: path.resolve(__dirname, 'dist', 'terms'),
                        toType: 'file',
                    },
                    {
                        from: path.resolve(
                            __dirname,
                            'aux-player',
                            'legal',
                            'privacy-policy.txt'
                        ),
                        to: path.resolve(__dirname, 'dist', 'privacy-policy'),
                        toType: 'file',
                    },
                    {
                        from: path.resolve(
                            __dirname,
                            'aux-player',
                            'legal',
                            'acceptable-use-policy.txt'
                        ),
                        to: path.resolve(
                            __dirname,
                            'dist',
                            'acceptable-use-policy'
                        ),
                        toType: 'file',
                    },
                ],
            }),
            new WebpackAssetsManifest(),
        ],
    });
}

function denoConfig(latestTag) {
    return merge(baseConfig(), {
        entry: {
            deno: path.resolve(
                __dirname,
                '..',
                '..',
                'aux-vm-deno',
                'vm',
                'DenoAuxChannel.worker.js'
            ),
        },
        plugins: [...commonPlugins(latestTag)],
    });
}

function commonPlugins(latestTag) {
    return [
        new webpack.DefinePlugin({
            GIT_HASH: JSON.stringify(commitHash),
            GIT_TAG: JSON.stringify(latestTag),
            PROXY_CORS_REQUESTS: process.env.PROXY_CORS_REQUESTS !== 'false',
        }),
        new webpack.NormalModuleReplacementPlugin(/^esbuild$/, 'esbuild-wasm'),
        new webpack.NormalModuleReplacementPlugin(
            /^three$/,
            '@casual-simulation/three'
        ),
    ];
}

function baseConfig() {
    return {
        output: {
            publicPath: '/',
            filename: '[name].js',
            chunkFilename: '[name].chunk.js',
            path: path.resolve(__dirname, 'dist'),
        },
        node: {
            global: true,
            __filename: 'mock',
            __dirname: 'mock',
        },
        module: {
            rules: [
                {
                    test: /\.worker(\.(ts|js))?$/,
                    use: [
                        {
                            // loader: 'worker-loader',
                            loader: path.resolve(
                                __dirname,
                                '../loaders/worker-loader/cjs.js'
                            ),
                            options: {
                                inline: 'fallback',
                            },
                        },
                    ],
                    exclude: /node_modules/,
                },
                {
                    test: /\.vue$/,
                    use: {
                        loader: 'vue-loader',
                        options: {
                            transformAssetUrls: {
                                video: ['src', 'poster'],
                                source: ['src', 'srcset'],
                                img: 'src',
                                image: ['xlink:href', 'href'],
                                use: ['xlink:href', 'href'],
                            },
                        },
                    },
                    exclude: /node_modules/,
                },
                {
                    test: /\.tsx?$/,
                    loader: 'ts-loader',
                    include: [
                        __dirname,
                        path.resolve(__dirname, '..', 'shared'),
                    ],
                    exclude: /node_modules/,
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader'],
                },
                {
                    test: /\.svg$/,
                    use: 'vue-svg-loader',
                },
                {
                    test: /von-grid.min.js$/,
                    use: 'exports-loader?vg=vg',
                },
                {
                    test: /\.(gltf|glb)$/,
                    use: [
                        {
                            loader: 'file-loader',
                            options: {
                                name: '[contenthash].[name].[ext]',
                                outputPath: 'gltf',
                            },
                        },
                    ],
                },
                {
                    test: /\.(wasm)$/,
                    use: [
                        {
                            loader: 'file-loader',
                            options: {
                                name: '[contenthash].[name].[ext]',
                                outputPath: 'wasm',
                            },
                        },
                    ],
                },
                {
                    test: /\.(png|jpg|gif|webp)$/,
                    use: [
                        {
                            loader: 'file-loader',
                            options: {
                                // Required for images loaded via Vue code
                                esModule: false,
                                outputPath: 'images',
                            },
                        },
                    ],
                },
                {
                    test: /\.(ttf|woff|woff2|otf)$/,
                    use: [
                        {
                            loader: 'file-loader',
                            options: {
                                name: './fonts/[name].[ext]',
                            },
                        },
                    ],
                },
                {
                    test: /three\/examples\/js/,
                    use: {
                        loader: 'imports-loader',
                        options: {
                            imports: ['namespace three THREE'],
                        },
                    },
                },
                {
                    test: /\.js$/,
                    use: ['source-map-loader'],
                    include: [/aux-common/, /aux-vm/],
                    enforce: 'pre',
                },

                // See https://github.com/dchest/tweetnacl-js/wiki/Using-with-Webpack
                // Gist is that tweetnacl-js has some require() statements that webpack
                // will parse and may try to include shims automatically.
                // So here we tell webpack to ignore tweetnacl and import from the global
                // window.nacl property.
                {
                    test: /[\\\/]tweetnacl[\\\/]/,
                    use: [
                        {
                            loader: 'exports-loader',
                            options: {
                                type: 'commonjs',
                                exports: 'single globalThis.nacl',
                            },
                        },
                        {
                            loader: 'imports-loader',
                            options: {
                                wrapper: {
                                    thisArg: 'globalThis',
                                    args: {
                                        module: '{}',
                                        require: 'false',
                                    },
                                },
                            },
                        },
                    ],
                },
            ],
            noParse: [/[\\\/]tweetnacl[\\\/]/, /[\\\/]tweetnacl-auth[\\\/]/],
        },
        resolve: {
            extensions: ['.vue', '.js', '.ts', '.css'],
            alias: {
                'vue-json-tree-view': path.resolve(
                    __dirname,
                    'shared/public/VueJsonTreeView/index.ts'
                ),
                'three-legacy-gltf-loader': path.resolve(
                    __dirname,
                    'shared/public/three-legacy-gltf-loader/LegacyGLTFLoader.js'
                ),
                'three-vrcontroller-module': path.resolve(
                    __dirname,
                    'shared/public/three-vrcontroller-module/VRController.js'
                ),
                callforth: path.resolve(
                    __dirname,
                    'shared/public/callforth/index.js'
                ),
                'vue-qrcode-reader': path.resolve(
                    __dirname,
                    'shared/public/vue-qrcode-reader/'
                ),
                'clipboard-polyfill': path.resolve(
                    __dirname,
                    'shared/public/clipboard-polyfill/clipboard-polyfill.js'
                ),

                os: false,
                constants: false,
                fs: false,
            },
        },
    };
}
