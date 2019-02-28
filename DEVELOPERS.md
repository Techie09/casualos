# Development Setup

## Prerequisites

Make sure you have all the prerequisite tools installed:

- [Node.js](https://nodejs.org/en/download/) 10.13.0 or later.
    - If installing for the first time, it is reccommended that you install it via Node Version Manager. ([Mac][nvm-mac], [Windows][nvm-windows])
    - Once NVM is installed, you can install the correct version of Node by running `nvm install 10.13.0` in your favorite terminal.
- Docker ([Mac][docker-for-mac], [Windows][docker-for-windows])
    - Used to make development with MongoDB easy.
    - Once installed, make sure the `/data` directory is shared with docker.
        - On Mac you can get to this via:
        - Docker Menu (On top bar) -> Preferences... -> File Sharing and add the `/data` directory.

## First Time Setup

1. Clone the repository.
    - `git clone https://github.com/yeticgi/aux`
2. Make sure Lerna is installed.
    - `npm install -g lerna`
3. Bootstrap the project.
    - `npm run bootstrap`
4. Start MongoDB.
    1. `cd` to `src/aux-server`
    2. `docker-compose up -d`
5. Add `projector.localhost` and `player.localhost` to your [hosts file][hosts-file].
    - These are the domains that the projector and player sites are available at in development.
    - Follow these steps:
        1. Open the hosts file as Sudo/Admin.
            - On Max/Linux it's at `/etc/hosts`
            - On Windows it's at `C:\Windows\System32\drivers\etc\hosts`
        2. Add entries to route `projector.localhost` and `player.localhost` to `127.0.0.1`:
            ```
            127.0.0.1 projector.localhost
            127.0.0.1 player.localhost
            ```

## Commands

When developing there are a couple of key commands you can run.
Most of them are NPM scripts, so they're easy to run.

- Build & Run in Watch Mode
    - `npm run watch`
    - This will trigger webpack to start in watch mode and run nodemon.
    - When ready, the server will be available at http://localhost:3000.
- Build in Production Mode
    - `npm run build`
    - This will trigger Webpack in production mode.
    - The output files will be in the `dist` folders of each project.
- Test In Watch Mode
    - `npm run test:watch`
- Test
    - `npm test`

You can find other scripts in the `package.json` file at the root of the repository.

## Tools we use

Here's a list of the tools and packages that we're using to build AUX.

- Dev tools
    - [TypeScript](https://github.com/Microsoft/TypeScript) for type checking.
    - [Webpack](https://webpack.js.org/) for bundling assets.
        - [webpack-merge](https://github.com/survivejs/webpack-merge) for dev/production configs.
        - Loaders
            - [ts-loader](https://github.com/TypeStrong/ts-loader) for TypeScript integration.
            - [vue-loader](https://github.com/vuejs/vue-loader) for Vue.js integration.
            - [vue-svg-loader](https://github.com/visualfanatic/vue-svg-loader) for loading SVG files as Vue components.
            - [css-loader](https://github.com/webpack-contrib/css-loader) for loading CSS in .vue files.
            - [file-loader](https://github.com/webpack-contrib/file-loader) for loading arbitary files.
            - [babel-loader](https://github.com/babel/babel-loader) for transpiling ES6 features to ES5. (some of our dependencies are ES6 only)
            - [source-map-loader](https://github.com/webpack-contrib/source-map-loader) for loading sourcemaps from pre-compiled JS.
        - Plugins
            - [offline-plugin](https://github.com/NekR/offline-plugin) for service worker support.
            - [html-webpack-plugin](https://github.com/jantimon/html-webpack-plugin) for generating index.html files.
            - [terser-webpack-plugin](https://github.com/webpack-contrib/terser-webpack-plugin) for minifying JS.
            - [clean-webpack-plugin](https://github.com/johnagan/clean-webpack-plugin) for clean builds.
            - [mini-css-extract-plugin](https://github.com/webpack-contrib/mini-css-extract-plugin) for splitting CSS into its own bundle.
            - [optimize-css-assets-webpack-plugin](https://github.com/NMFR/optimize-css-assets-webpack-plugin) for minifying CSS.
    - [Lerna](https://github.com/lerna/lerna) for managing multiple NPM packages.
    - [Gulp](https://gulpjs.com/) for minor tasks that Webpack doesn't handle.
    - [Jest](https://jestjs.io/) for testing.
        - [ts-jest](https://kulshekhar.github.io/ts-jest/) for using TypeScript.
    - [concurrently](https://github.com/kimmobrunfeldt/concurrently) for running multiple things at a time.
    - [nodemon](https://nodemon.io/) for running node in watch mode.
    - [Visual Studio Code](https://code.visualstudio.com/) for file editing and debugging.
- Dependencies
    - AUX Common
        - [acorn](https://github.com/acornjs/acorn) for parsing AUX formulas.
        - [astring](https://github.com/davidbonnet/astring) for generating JS from acorn trees.
        - [estraverse](https://github.com/estools/estraverse) for traversing the acorn trees and transforming them.
        - [lodash](https://lodash.com/) for easy array/object manipulation.
        - [lru-cache](https://github.com/isaacs/node-lru-cache) for caching formula transpilation results.
        - [rxjs](https://github.com/ReactiveX/rxjs) for reactive programming.
        - [uuid](https://github.com/kelektiv/node-uuid) for generating UUIDs.
    - AUX Server
        - [vue](https://github.com/vuejs/vue) for JS <--> HTML UI binding.
            - [vue-material](https://github.com/vuematerial/vue-material) for Material components.
            - [vue-color](https://github.com/xiaokaike/vue-color) for color pickers.
            - [@chenfengyuan/vue-qrcode](https://fengyuanchen.github.io/vue-qrcode/) for rendering QR Codes.
            - [vue-router](https://github.com/vuejs/vue-router) for SPA routing.
            - [vue-property-decorator](https://github.com/kaorun343/vue-property-decorator) for property decorators on Vue classes.
            - [vue-class-component](https://github.com/vuejs/vue-class-component) for class decorators on Vue classes.
        - [three](https://threejs.org/) for 3D WebGL rendering.
            - [three-bmfont-text](https://github.com/Jam3/three-bmfont-text) for 3D text rendering.
        - [express](http://expressjs.com/) for the HTTP server.
        - [es6-promise](https://github.com/stefanpenner/es6-promise) for ES6-style promises.
        - [socket.io](https://github.com/socketio/socket.io) for WebSocket based realtime communication.
        - [filepond](https://github.com/pqina/filepond) for file uploads.
            - [vue-filepond](https://github.com/pqina/vue-filepond) for Vue.js integration.
        - [downloadjs](https://github.com/rndme/download) for file downloads.
        - [@sentry/browser](https://github.com/getsentry/sentry-javascript/tree/master/packages/browser) for error reporting.
        - [mongodb](https://github.com/mongodb/node-mongodb-native) for MongoDB connections.
        - [webvr-polyfill](https://github.com/immersive-web/webvr-polyfill) for WebVR 1.0 and 1.1 support.
        - [webxr-polyfill](https://github.com/mozilla/webxr-polyfill) for [WebXR Viewer iOS app](https://github.com/mozilla-mobile/webxr-ios) support.

If you're using Visual Studio Code, I recommend getting the Jest extension. It makes it real easy to debug unit tests.

[docker-for-mac]: https://docs.docker.com/v17.12/docker-for-mac/install/
[docker-for-windows]: https://docs.docker.com/docker-for-windows/install/
[nvm-mac]: https://github.com/creationix/nvm
[nvm-windows]: https://github.com/coreybutler/nvm-windows
[hosts-file]: https://en.wikipedia.org/wiki/Hosts_(file)