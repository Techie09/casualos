import {
    createBot,
    createPrecalculatedBot,
    OpenCustomPortalOptions,
    stateUpdatedEvent,
} from '@casual-simulation/aux-common';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { Subscription } from 'rxjs';
import {
    DEFAULT_BASE_MODULE_URL,
    ESBuildPortalBundler,
    EXTERNAL_MODULE_SYMBOL,
    PortalBundler,
    ScriptPrefix,
} from './PortalBundler';

console.log = jest.fn();
jest.mock('axios');

describe('ESBuildPortalBundler', () => {
    let bundler: PortalBundler;

    describe('bundleTag()', () => {
        let func1: jest.Mock<any>;
        let func2: jest.Mock<any>;

        beforeEach(() => {
            bundler = new ESBuildPortalBundler();
            (<any>globalThis).func1 = func1 = jest.fn();
            (<any>globalThis).func2 = func2 = jest.fn();
        });

        afterEach(() => {
            delete (<any>globalThis).func2;
            delete (<any>globalThis).func1;
        });

        const prefixCases: [string, string[], string, string][] = [
            ['library emoji', ['📖'], '📖', '📖'],
            ['smile emoji', ['🙂'], '🙂', '🙂'],
            ['multiple emoji', ['📖', '🙂'], '🙂', '📖'],
        ];

        describe.each(prefixCases)(
            '%s',
            (desc, scriptPrefixes, firstPrefix, secondPrefix) => {
                let prefixes: ScriptPrefix[];

                beforeEach(() => {
                    prefixes = [
                        {
                            prefix: firstPrefix,
                            language: 'javascript',
                        },
                        {
                            prefix: secondPrefix,
                            language: 'javascript',
                        },
                    ];
                });

                it('should resolve with null if there are no tags with the right prefix', async () => {
                    const state = {
                        bot1: createPrecalculatedBot('bot1', {
                            main: `console.log("abc")`,
                        }),
                        bot2: createPrecalculatedBot('bot2', {
                            main: `console.log("def")`,
                        }),
                    };
                    const bundle = await bundler.bundleTag(
                        state,
                        'main',
                        prefixes
                    );

                    expect(bundle).toEqual(null);
                });

                it('should resolve with a bundle that contains the specified tags', async () => {
                    const state = {
                        bot1: createPrecalculatedBot('bot1', {
                            main: `${firstPrefix}console.log("abc")`,
                        }),
                        bot2: createPrecalculatedBot('bot2', {
                            main: `${secondPrefix}console.log("def")`,
                        }),
                    };

                    const bundle = await bundler.bundleTag(
                        state,
                        'main',
                        prefixes
                    );

                    expect(bundle).not.toEqual(null);
                    expect(bundle.source).toBeTruthy();
                    expect(bundle).toMatchSnapshot();
                });

                it('should resolve with build errors', async () => {
                    const state = {
                        bot1: createPrecalculatedBot('bot1', {
                            main: `${firstPrefix}console.log("ab`,
                        }),
                    };

                    const bundle = await bundler.bundleTag(
                        state,
                        'main',
                        prefixes
                    );

                    expect(bundle).not.toEqual(null);
                    expect(bundle.error).toBeTruthy();
                    expect(bundle).toMatchSnapshot();
                });

                it('should execute entry points in bot ID alphabetical order', async () => {
                    const state = {
                        def: createPrecalculatedBot('def', {
                            main: `${firstPrefix}globalThis.func1("second");`,
                        }),
                        abc: createPrecalculatedBot('abc', {
                            main: `${secondPrefix}globalThis.func1("first");`,
                        }),
                    };

                    const bundle = await bundler.bundleTag(
                        state,
                        'main',
                        prefixes
                    );

                    expect(bundle).not.toEqual(null);
                    expect(bundle.source).toBeTruthy();

                    eval(bundle.source);

                    expect(func1).toBeCalledTimes(2);
                    expect(func1).toHaveBeenNthCalledWith(1, 'first');
                    expect(func1).toHaveBeenNthCalledWith(2, 'second');
                });

                it('should be able to import scripts from other tags', async () => {
                    const state = {
                        abc: createPrecalculatedBot('abc', {
                            main: `${firstPrefix}import "${secondPrefix}other"; globalThis.func1("main");`,
                            other: `${secondPrefix}globalThis.func1("other");`,
                        }),
                    };

                    const bundle = await bundler.bundleTag(
                        state,
                        'main',
                        prefixes
                    );

                    expect(bundle).not.toEqual(null);
                    expect(bundle.source).toBeTruthy();

                    eval(bundle.source);

                    expect(func1).toBeCalledTimes(2);
                    expect(func1).toHaveBeenNthCalledWith(1, 'other');
                    expect(func1).toHaveBeenNthCalledWith(2, 'main');
                });

                it('should handle modules that reference each other', async () => {
                    const state = {
                        abc: createPrecalculatedBot('abc', {
                            main: `${firstPrefix}import "${secondPrefix}other"; globalThis.func1("main");`,
                            other: `${secondPrefix}import "${firstPrefix}main"; globalThis.func1("other");`,
                        }),
                    };

                    const bundle = await bundler.bundleTag(
                        state,
                        'main',
                        prefixes
                    );

                    expect(bundle).not.toEqual(null);
                    expect(bundle.source).toBeTruthy();

                    eval(bundle.source);

                    expect(func1).toBeCalledTimes(2);
                    expect(func1).toHaveBeenNthCalledWith(1, 'other');
                    expect(func1).toHaveBeenNthCalledWith(2, 'main');
                });

                it('should report which bots and tags are included in the bundle', async () => {
                    const state = {
                        bot1: createPrecalculatedBot('bot1', {
                            main: `${firstPrefix}console.log("abc")`,
                            different: true,
                        }),
                        bot2: createPrecalculatedBot('bot2', {
                            main: `${secondPrefix}import "${secondPrefix}second"; console.log("def")`,
                            second: `${secondPrefix}let test = 123;`,
                        }),
                        bot3: createPrecalculatedBot('bot3', {
                            main: `no prefix`,
                        }),
                        bot4: createPrecalculatedBot('bot4', {
                            other: `no prefix`,
                        }),
                    };

                    const bundle = await bundler.bundleTag(
                        state,
                        'main',
                        prefixes
                    );

                    expect(bundle).not.toEqual(null);
                    expect(bundle.modules).toEqual({
                        bot1: new Set(['main']),
                        bot2: new Set(['main', 'second']),
                    });
                });

                describe('imports', () => {
                    beforeEach(() => {
                        require('axios').__reset();
                    });

                    it('should try to load modules from skypack', async () => {
                        require('axios').__setResponse({
                            data: `export const fun = globalThis.func1;`,
                        });

                        const state = {
                            bot1: createPrecalculatedBot('bot1', {
                                main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                            }),
                        };

                        const bundle = await bundler.bundleTag(
                            state,
                            'main',
                            prefixes
                        );

                        await waitAsync();

                        expect(bundle).not.toEqual(null);
                        expect(bundle.source).toBeTruthy();
                        let [url] = require('axios').__getLastGet();

                        expect(url).toBe(`${DEFAULT_BASE_MODULE_URL}/lodash`);

                        eval(bundle.source);

                        expect(func1).toBeCalledTimes(1);
                    });

                    it('should report errors that occur while fetching data', async () => {
                        require('axios').__setFail(true);

                        const state = {
                            bot1: createPrecalculatedBot('bot1', {
                                main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                            }),
                        };

                        const bundle = await bundler.bundleTag(
                            state,
                            'main',
                            prefixes
                        );

                        expect(bundle).not.toEqual(null);
                        expect(bundle.error).toBeTruthy();
                        expect(bundle.error).toMatchSnapshot();
                    });

                    it('should support HTTPS modules that have relative references', async () => {
                        require('axios')
                            .__setNextResponse({
                                data: `export * from './fun';`,
                            })
                            .__setNextResponse({
                                data: `export const fun = globalThis.func1;`,
                            });

                        const state = {
                            bot1: createPrecalculatedBot('bot1', {
                                main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                            }),
                        };

                        const bundle = await bundler.bundleTag(
                            state,
                            'main',
                            prefixes
                        );

                        expect(bundle).not.toEqual(null);
                        expect(bundle.source).toBeTruthy();
                        let requests = require('axios').__getRequests();

                        expect(requests).toEqual([
                            ['get', `${DEFAULT_BASE_MODULE_URL}/lodash`],
                            ['get', `${DEFAULT_BASE_MODULE_URL}/lodash/fun`],
                        ]);

                        eval(bundle.source);

                        expect(func1).toBeCalledTimes(1);
                    });

                    it('should support HTTPS modules that have absolute references', async () => {
                        require('axios')
                            .__setNextResponse({
                                data: `export * from '/fun';`,
                            })
                            .__setNextResponse({
                                data: `export const fun = globalThis.func1;`,
                            });

                        const state = {
                            bot1: createPrecalculatedBot('bot1', {
                                main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                            }),
                        };

                        const bundle = await bundler.bundleTag(
                            state,
                            'main',
                            prefixes
                        );

                        expect(bundle).not.toEqual(null);
                        expect(bundle.source).toBeTruthy();

                        let requests = require('axios').__getRequests();

                        expect(requests).toEqual([
                            ['get', `${DEFAULT_BASE_MODULE_URL}/lodash`],
                            ['get', `${DEFAULT_BASE_MODULE_URL}/fun`],
                        ]);

                        eval(bundle.source);

                        expect(func1).toBeCalledTimes(1);
                    });

                    it('should support HTTPS modules that have nested references', async () => {
                        require('axios')
                            .__setNextResponse({
                                data: `export * from './fun';`,
                            })
                            .__setNextResponse({
                                data: `export * from './other';`,
                            })
                            .__setNextResponse({
                                data: `export * from '/final';`,
                            })
                            .__setNextResponse({
                                data: `export const fun = globalThis.func1;`,
                            });

                        const state = {
                            bot1: createPrecalculatedBot('bot1', {
                                main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                            }),
                        };

                        const bundle = await bundler.bundleTag(
                            state,
                            'main',
                            prefixes
                        );

                        expect(bundle).not.toEqual(null);
                        expect(bundle.source).toBeTruthy();

                        let requests = require('axios').__getRequests();

                        expect(requests).toEqual([
                            ['get', `${DEFAULT_BASE_MODULE_URL}/lodash`],
                            ['get', `${DEFAULT_BASE_MODULE_URL}/lodash/fun`],
                            [
                                'get',
                                `${DEFAULT_BASE_MODULE_URL}/lodash/fun/other`,
                            ],
                            ['get', `${DEFAULT_BASE_MODULE_URL}/final`],
                        ]);

                        eval(bundle.source);

                        expect(func1).toBeCalledTimes(1);
                    });

                    it('should cache HTTP modules across builds', async () => {
                        require('axios')
                            .__setNextResponse({
                                data: `export const fun = globalThis.func1;`,
                            })
                            .__setNextResponse({
                                data: `export const fun = globalThis.func2;`,
                            });

                        const state = {
                            bot1: createPrecalculatedBot('bot1', {
                                main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                            }),
                        };

                        const bundle1 = await bundler.bundleTag(
                            state,
                            'main',
                            prefixes
                        );
                        const bundle2 = await bundler.bundleTag(
                            state,
                            'main',
                            prefixes
                        );

                        let requests = require('axios').__getRequests();

                        expect(requests).toEqual([
                            ['get', `${DEFAULT_BASE_MODULE_URL}/lodash`],
                        ]);
                        expect(bundle1).toEqual(bundle2);
                    });

                    it('should cache HTTP modules that are requested concurrently', async () => {
                        require('axios')
                            .__setNextResponse({
                                data: `export const fun = globalThis.func1;`,
                            })
                            .__setNextResponse({
                                data: `export const fun = globalThis.func2;`,
                            });

                        const state = {
                            bot1: createPrecalculatedBot('bot1', {
                                main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                            }),
                        };

                        const [bundle1, bundle2] = await Promise.all([
                            bundler.bundleTag(state, 'main', prefixes),
                            bundler.bundleTag(state, 'main', prefixes),
                        ]);

                        let requests = require('axios').__getRequests();

                        expect(requests).toEqual([
                            ['get', `${DEFAULT_BASE_MODULE_URL}/lodash`],
                        ]);
                        expect(bundle1).toEqual(bundle2);
                    });

                    it('should report external modules that were imported', async () => {
                        require('axios').__setResponse({
                            data: `export const fun = globalThis.func1;`,
                        });

                        const state = {
                            bot1: createPrecalculatedBot('bot1', {
                                main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                            }),
                        };

                        const bundle = await bundler.bundleTag(
                            state,
                            'main',
                            prefixes
                        );

                        await waitAsync();

                        expect(bundle).not.toEqual(null);
                        expect(bundle.modules[EXTERNAL_MODULE_SYMBOL]).toEqual(
                            new Set(['lodash'])
                        );
                    });
                });
            }
        );

        it('should support typescript', async () => {
            const state = {
                bot1: createPrecalculatedBot('bot1', {
                    main: `📖let abc: string = "Hello!";`,
                }),
            };

            const bundle = await bundler.bundleTag(state, 'main', [
                {
                    prefix: '📖',
                    language: 'typescript',
                },
            ]);

            expect(bundle).not.toEqual(null);
            expect(bundle.source).toBeTruthy();
            expect(bundle).toMatchSnapshot();
        });

        it('should support JSON', async () => {
            const state = {
                bot1: createPrecalculatedBot('bot1', {
                    main: `📖{ "abc": "def" }`,
                }),
            };

            const bundle = await bundler.bundleTag(state, 'main', [
                {
                    prefix: '📖',
                    language: 'json',
                },
            ]);

            expect(bundle).not.toEqual(null);
            expect(bundle.source).toBeTruthy();
            expect(bundle).toMatchSnapshot();
        });

        it('should support JSX', async () => {
            const state = {
                bot1: createPrecalculatedBot('bot1', {
                    main: `📖let element = (<h1>Hello!</h1>);`,
                }),
            };

            const bundle = await bundler.bundleTag(state, 'main', [
                {
                    prefix: '📖',
                    language: 'jsx',
                },
            ]);

            expect(bundle).not.toEqual(null);
            expect(bundle.source).toBeTruthy();
            expect(bundle).toMatchSnapshot();
        });

        it('should support TSX', async () => {
            const state = {
                bot1: createPrecalculatedBot('bot1', {
                    main: `📖let element: any = (<h1>Hello!</h1>);`,
                }),
            };

            const bundle = await bundler.bundleTag(state, 'main', [
                {
                    prefix: '📖',
                    language: 'tsx',
                },
            ]);

            expect(bundle).not.toEqual(null);
            expect(bundle.source).toBeTruthy();
            expect(bundle).toMatchSnapshot();
        });

        it('should support prefixes in the given tag name', async () => {
            const prefixes: ScriptPrefix[] = [
                {
                    prefix: '🔺',
                    language: 'javascript',
                },
                {
                    prefix: '📖',
                    language: 'javascript',
                },
            ];
            const state = {
                bot1: createPrecalculatedBot('bot1', {
                    main: `🔺globalThis.func1("first");`,
                }),
                bot2: createPrecalculatedBot('bot2', {
                    main: `📖globalThis.func1("second");`,
                }),
            };

            const bundle = await bundler.bundleTag(state, `🔺main`, prefixes);

            expect(bundle).not.toEqual(null);
            expect(bundle.source).toBeTruthy();

            eval(bundle.source);

            expect(func1).toBeCalledTimes(1);
            expect(func1).toBeCalledWith('first');
        });

        it('should importing separate prefixes from special entry prefixes', async () => {
            const prefixes: ScriptPrefix[] = [
                {
                    prefix: '🔺',
                    language: 'javascript',
                },
                {
                    prefix: '📖',
                    language: 'javascript',
                },
            ];
            const state = {
                bot1: createPrecalculatedBot('bot1', {
                    main: `🔺import "📖main"; globalThis.func1("first");`,
                }),
                bot2: createPrecalculatedBot('bot2', {
                    main: `📖globalThis.func1("second");`,
                }),
            };

            const bundle = await bundler.bundleTag(state, `🔺main`, prefixes);

            expect(bundle).not.toEqual(null);
            expect(bundle.source).toBeTruthy();

            eval(bundle.source);

            expect(func1).toBeCalledTimes(2);
            expect(func1).toHaveBeenNthCalledWith(1, 'second');
            expect(func1).toHaveBeenNthCalledWith(2, 'first');
        });
    });
});
