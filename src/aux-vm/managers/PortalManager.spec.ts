import {
    asyncResult,
    BotIndex,
    BotsState,
    createPrecalculatedBot,
    DEFAULT_CUSTOM_PORTAL_SCRIPT_PREFIXES,
    LocalActions,
    stateUpdatedEvent,
} from '@casual-simulation/aux-common';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { Subject, Subscription } from 'rxjs';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { BotHelper } from './BotHelper';
import { BotWatcher } from './BotWatcher';
import {
    CodeBundle,
    ExternalModule,
    LibraryModule,
    PortalBundler,
    ScriptPrefix,
} from './PortalBundler';
import {
    DEFAULT_SCRIPT_PREFIXES,
    PortalBotData,
    PortalData,
    PortalManager,
    PortalUpdate,
} from './PortalManager';

describe('PortalManager', () => {
    let manager: PortalManager;
    let vm: TestAuxVM;
    let helper: BotHelper;
    let index: BotIndex;
    let watcher: BotWatcher;
    let sub: Subscription;
    let bundler: {
        bundleTag: jest.Mock<
            Promise<CodeBundle>,
            [BotsState, string, ScriptPrefix[]]
        >;
        addLibrary: jest.Mock<void, [LibraryModule]>;
    };
    let localEvents: Subject<LocalActions[]>;

    beforeEach(() => {
        sub = new Subscription();
        vm = new TestAuxVM();
        localEvents = vm.localEvents = new Subject();

        helper = new BotHelper(vm);
        index = new BotIndex();
        watcher = new BotWatcher(
            helper,
            index,
            vm.stateUpdated,
            vm.versionUpdated
        );

        bundler = {
            bundleTag: jest.fn(),
            addLibrary: jest.fn(),
        };
        manager = new PortalManager(vm, helper, watcher, bundler);
    });

    afterEach(() => {
        sub.unsubscribe();
    });

    describe('prefixes', () => {
        let prefixes = [] as ScriptPrefix[];
        let removedPrefixes = [] as string[];

        beforeEach(() => {
            prefixes = [];
            sub.add(
                manager.prefixesDiscovered.subscribe((p) => prefixes.push(...p))
            );
            sub.add(
                manager.prefixesRemoved.subscribe((p) =>
                    removedPrefixes.push(...p)
                )
            );
        });

        it('should resolve with the default prefixes', async () => {
            await waitAsync();
            expect(prefixes).toEqual(DEFAULT_SCRIPT_PREFIXES);
        });

        it('should resolve when a new prefix is added', async () => {
            localEvents.next([
                {
                    type: 'register_prefix',
                    taskId: 'task1',
                    prefix: '🐦',
                    options: {},
                },
            ]);

            await waitAsync();

            expect(prefixes.slice(DEFAULT_SCRIPT_PREFIXES.length)).toEqual([
                {
                    prefix: '🐦',
                    language: 'javascript',
                },
            ]);
        });

        it('should use the language specified on the event', async () => {
            localEvents.next([
                {
                    type: 'register_prefix',
                    taskId: 'task1',
                    prefix: '🐦',
                    options: {
                        language: 'json',
                    },
                },
            ]);

            await waitAsync();

            expect(prefixes.slice(DEFAULT_SCRIPT_PREFIXES.length)).toEqual([
                {
                    prefix: '🐦',
                    language: 'json',
                },
            ]);
        });

        it('should finish the register_prefix task', async () => {
            localEvents.next([
                {
                    type: 'register_prefix',
                    taskId: 'task1',
                    prefix: '🐦',
                    options: {},
                },
            ]);

            await waitAsync();

            expect(vm.events).toEqual([asyncResult('task1', undefined)]);
        });

        it('should do nothing when a prefix is registered twice', async () => {
            localEvents.next([
                {
                    type: 'register_prefix',
                    taskId: 'task1',
                    prefix: '🐦',
                    options: {},
                },
                {
                    type: 'register_prefix',
                    taskId: 'task1',
                    prefix: '🐦',
                    options: {},
                },
            ]);

            await waitAsync();

            expect(prefixes.slice(DEFAULT_SCRIPT_PREFIXES.length)).toEqual([
                {
                    prefix: '🐦',
                    language: 'javascript',
                },
            ]);
        });
    });

    describe('build_bundle', () => {
        it('should build and resolve the given tag', async () => {
            bundler.bundleTag.mockResolvedValueOnce({
                tag: 'script',
                source: 'abc',
                modules: {},
                externals: {},
                libraries: {},
                warnings: [],
            });

            vm.sendState(
                stateUpdatedEvent({
                    test1: createPrecalculatedBot('test1', {
                        script: '🔺console.log("test1");',
                    }),
                })
            );

            localEvents.next([
                {
                    type: 'register_prefix',
                    prefix: '🔺',
                    options: {},
                    taskId: 'task1',
                },
                {
                    type: 'build_bundle',
                    tag: '🔺script',
                    taskId: 'task2',
                },
            ]);

            await waitAsync();

            expect(vm.events.slice(1)).toEqual([
                asyncResult('task2', {
                    tag: 'script',
                    source: 'abc',
                    warnings: [],
                    modules: {},
                    externals: {},
                    libraries: {},
                }),
            ]);
        });
    });

    describe('portalsDiscovered', () => {
        let portals = [] as PortalData[];

        beforeEach(() => {
            portals = [];
            sub.add(
                manager.portalsDiscovered.subscribe((p) => portals.push(...p))
            );
        });

        it('should build and resolve new portals', async () => {
            expect(portals).toEqual([]);

            bundler.bundleTag.mockResolvedValueOnce({
                tag: 'script',
                source: 'abc',
                modules: {},
                externals: {},
                libraries: {},
                warnings: [],
            });

            vm.sendState(
                stateUpdatedEvent({
                    test1: createPrecalculatedBot('test1', {
                        script: '🔺console.log("test1");',
                    }),
                })
            );

            localEvents.next([
                {
                    type: 'register_prefix',
                    prefix: '🔺',
                    options: {},
                    taskId: 'task1',
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    botId: null,
                    tagOrSource: '🔺script',
                    taskId: 'task',
                    options: {
                        style: {
                            abc: 'def',
                        },
                    },
                },
            ]);

            await waitAsync();

            expect(portals).toEqual([
                {
                    id: 'test-portal',
                    source: 'abc',
                    style: {
                        abc: 'def',
                    },
                    error: null,
                    botId: null,
                },
            ]);
        });

        it('should build and resolve portals that were registered without source', async () => {
            bundler.bundleTag.mockResolvedValueOnce({
                tag: 'script',
                modules: {},
                externals: {},
                libraries: {},
                warnings: [],
            });

            localEvents.next([
                {
                    type: 'register_prefix',
                    prefix: '🔺',
                    options: {},
                    taskId: 'task1',
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    botId: null,
                    tagOrSource: '🔺script',
                    taskId: 'task',
                    options: {
                        style: {
                            abc: 'def',
                        },
                    },
                },
            ]);

            await waitAsync();

            expect(portals).toEqual([
                {
                    id: 'test-portal',
                    source: null,
                    style: {
                        abc: 'def',
                    },
                    error: null,
                    botId: null,
                },
            ]);
        });

        it('should handle when the build returns null', async () => {
            bundler.bundleTag.mockResolvedValueOnce(null);

            localEvents.next([
                {
                    type: 'register_prefix',
                    prefix: '🔺',
                    options: {},
                    taskId: 'task1',
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    botId: null,
                    tagOrSource: '🔺script',
                    taskId: 'task',
                    options: {
                        style: {
                            abc: 'def',
                        },
                    },
                },
            ]);

            await waitAsync();

            expect(portals).toEqual([
                {
                    id: 'test-portal',
                    source: null,
                    style: {
                        abc: 'def',
                    },
                    error: null,
                    botId: null,
                },
            ]);
        });

        it('should finish the open_custom_portal task', async () => {
            localEvents.next([
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    botId: null,
                    tagOrSource: 'script',
                    taskId: 'task1',
                    options: {},
                },
            ]);

            await waitAsync();

            expect(vm.events).toEqual([asyncResult('task1', undefined)]);
        });

        it('should resolve new portals loaded from source', async () => {
            expect(portals).toEqual([]);

            vm.sendState(
                stateUpdatedEvent({
                    test1: createPrecalculatedBot('test1', {
                        script: '🔺wrong',
                    }),
                })
            );

            localEvents.next([
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    botId: null,
                    tagOrSource: 'console.log("test1");',
                    taskId: 'task',
                    options: {
                        mode: 'source',
                        style: {
                            abc: 'def',
                        },
                    },
                },
            ]);

            await waitAsync();

            expect(portals).toEqual([
                {
                    id: 'test-portal',
                    source: 'console.log("test1");',
                    style: {
                        abc: 'def',
                    },
                    error: null,
                    botId: null,
                },
            ]);
        });

        it('should resolve new portals loaded from source that override building from a tag', async () => {
            expect(portals).toEqual([]);

            bundler.bundleTag.mockResolvedValueOnce({
                tag: 'script',
                source: 'wrong',
                modules: {},
                externals: {},
                libraries: {},
                warnings: [],
            });

            vm.sendState(
                stateUpdatedEvent({
                    test1: createPrecalculatedBot('test1', {
                        script: '🔺wrong',
                    }),
                })
            );

            localEvents.next([
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    botId: null,
                    tagOrSource: '🔺script',
                    taskId: 'task',
                    options: {
                        style: {
                            abc: 'def',
                        },
                    },
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    botId: null,
                    tagOrSource: 'console.log("test1");',
                    taskId: 'task2',
                    options: {
                        mode: 'source',
                        style: {
                            abc: 'def',
                        },
                    },
                },
            ]);

            await waitAsync();

            expect(portals).toEqual([
                {
                    id: 'test-portal',
                    source: 'console.log("test1");',
                    style: {
                        abc: 'def',
                    },
                    error: null,
                    botId: null,
                },
            ]);
        });

        it('should include a message port for bundles that reference casualos', async () => {
            expect(portals).toEqual([]);

            bundler.bundleTag.mockResolvedValueOnce({
                tag: 'script',
                source: 'abc',
                modules: {},
                externals: {},
                libraries: {
                    casualos: {
                        id: 'casualos',
                        source: '',
                        language: 'javascript',
                    },
                },
                warnings: [],
            });

            vm.sendState(
                stateUpdatedEvent({
                    test1: createPrecalculatedBot('test1', {
                        script: '🔺console.log("test1");',
                    }),
                })
            );

            localEvents.next([
                {
                    type: 'register_prefix',
                    prefix: '🔺',
                    options: {},
                    taskId: 'task1',
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    botId: null,
                    tagOrSource: '🔺script',
                    taskId: 'task',
                    options: {
                        style: {
                            abc: 'def',
                        },
                    },
                },
            ]);

            await waitAsync();

            expect(portals).toEqual([
                {
                    id: 'test-portal',
                    source: 'abc',
                    style: {
                        abc: 'def',
                    },
                    botId: null,
                    error: null,
                    ports: {
                        casualos: expect.any(MessagePort),
                    },
                },
            ]);
        });

        it('should emit null source when portals have a null tag', async () => {
            expect(portals).toEqual([]);

            bundler.bundleTag.mockResolvedValueOnce({
                tag: 'script',
                source: 'abc',
                modules: {},
                externals: {},
                libraries: {},
                warnings: [],
            });

            vm.sendState(
                stateUpdatedEvent({
                    test1: createPrecalculatedBot('test1', {
                        script: '🔺console.log("test1");',
                    }),
                })
            );

            localEvents.next([
                {
                    type: 'register_prefix',
                    prefix: '🔺',
                    options: {},
                    taskId: 'task1',
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    botId: null,
                    tagOrSource: null,
                    taskId: 'task',
                    options: {
                        style: {
                            abc: 'def',
                        },
                    },
                },
            ]);

            await waitAsync();

            expect(bundler.bundleTag).not.toBeCalled();
            expect(portals).toEqual([
                {
                    id: 'test-portal',
                    botId: null,
                    source: null,
                    style: {
                        abc: 'def',
                    },
                    error: null,
                },
            ]);
        });
    });

    describe('portalsUpdated', () => {
        let updates = [] as PortalUpdate[];

        beforeEach(() => {
            updates = [];
            sub.add(
                manager.portalsUpdated.subscribe((p) => updates.push(...p))
            );
        });

        describe('simple updates', () => {
            beforeEach(async () => {
                bundler.bundleTag.mockResolvedValueOnce({
                    tag: 'script',
                    source: 'abc',
                    error: null,
                    modules: {
                        bot1: new Set(['script']),
                    },
                    externals: {},
                    libraries: {},
                    warnings: [],
                });

                vm.sendState(
                    stateUpdatedEvent({
                        bot1: createPrecalculatedBot('bot1', {
                            script: '🔺abc',
                        }),
                    })
                );

                localEvents.next([
                    {
                        type: 'register_prefix',
                        prefix: '🔺',
                        taskId: 'task1',
                        options: {},
                    },
                    {
                        type: 'open_custom_portal',
                        portalId: 'test-portal',
                        botId: null,
                        tagOrSource: 'script',
                        taskId: 'task1',
                        options: {},
                    },
                ]);

                await waitAsync();
            });

            it('should resolve updates to a portal', async () => {
                expect(updates).toEqual([]);

                bundler.bundleTag.mockResolvedValueOnce({
                    tag: 'script',
                    source: 'correct',
                    error: null,
                    modules: {
                        bot1: new Set(['script']),
                    },
                    externals: {},
                    libraries: {},
                    warnings: [],
                });

                vm.sendState(
                    stateUpdatedEvent({
                        bot1: {
                            tags: {
                                script: '🔺def',
                            },
                            values: {
                                script: '🔺def',
                            },
                        },
                    })
                );

                await waitAsync();

                expect(updates).toEqual([
                    {
                        oldPortal: {
                            id: 'test-portal',
                            source: 'abc',
                            error: null,
                            botId: null,
                        },
                        portal: {
                            id: 'test-portal',
                            source: 'correct',
                            error: null,
                            botId: null,
                        },
                    },
                ]);
            });

            it('should update the portal if a bot with a related tag was added', async () => {
                expect(updates).toEqual([]);

                bundler.bundleTag.mockResolvedValueOnce({
                    tag: 'script',
                    source: 'correct',
                    error: null,
                    modules: {
                        bot1: new Set(['script']),
                    },
                    externals: {},
                    libraries: {},
                    warnings: [],
                });

                vm.sendState(
                    stateUpdatedEvent({
                        bot2: createPrecalculatedBot('bot2', {
                            script: 'haha',
                        }),
                    })
                );

                await waitAsync();

                expect(updates).toEqual([
                    {
                        oldPortal: {
                            id: 'test-portal',
                            source: 'abc',
                            error: null,
                            botId: null,
                        },
                        portal: {
                            id: 'test-portal',
                            source: 'correct',
                            error: null,
                            botId: null,
                        },
                    },
                ]);
            });

            it('should update the portal if a bot that was in the bundle was removed', async () => {
                expect(updates).toEqual([]);

                bundler.bundleTag.mockResolvedValueOnce({
                    tag: 'script',
                    source: 'correct',
                    error: null,
                    modules: {},
                    externals: {},
                    libraries: {},
                    warnings: [],
                });

                vm.sendState(
                    stateUpdatedEvent({
                        // bot1 is in the module
                        bot1: null,
                    })
                );

                await waitAsync();

                expect(updates).toEqual([
                    {
                        oldPortal: {
                            id: 'test-portal',
                            source: 'abc',
                            error: null,
                            botId: null,
                        },
                        portal: {
                            id: 'test-portal',
                            source: 'correct',
                            error: null,
                            botId: null,
                        },
                    },
                ]);
            });

            it('should not update the portal if a bot that was not in the bundle was removed', async () => {
                expect(updates).toEqual([]);

                bundler.bundleTag.mockResolvedValueOnce({
                    tag: 'script',
                    source: 'correct',
                    error: null,
                    modules: {},
                    externals: {},
                    libraries: {},
                    warnings: [],
                });

                vm.sendState(
                    stateUpdatedEvent({
                        // bot5 is not in the module
                        bot5: null,
                    })
                );

                await waitAsync();

                expect(updates).toEqual([]);
            });

            it('should not update the portal if a bot that does not have a module tag was added', async () => {
                expect(updates).toEqual([]);

                bundler.bundleTag.mockResolvedValueOnce({
                    tag: 'script',
                    source: 'correct',
                    error: null,
                    modules: {},
                    externals: {},
                    libraries: {},
                    warnings: [],
                });

                vm.sendState(
                    stateUpdatedEvent({
                        // bot5 is not in the module
                        bot5: createPrecalculatedBot('bot5', {
                            not: 'abcd',
                            other: 123,
                        }),
                    })
                );

                await waitAsync();

                expect(updates).toEqual([]);
            });

            it('should not update the portal if non module tag was updated', async () => {
                expect(updates).toEqual([]);

                bundler.bundleTag.mockResolvedValueOnce({
                    tag: 'script',
                    source: 'correct',
                    error: null,
                    modules: {},
                    externals: {},
                    libraries: {},
                    warnings: [],
                });

                vm.sendState(
                    stateUpdatedEvent({
                        // bot5 is not in the module
                        bot1: {
                            tags: {
                                other: true,
                            },
                            values: {
                                other: true,
                            },
                        },
                    })
                );

                await waitAsync();

                expect(updates).toEqual([]);
            });

            it('should resolve settings updates to a portal', async () => {
                expect(updates).toEqual([]);

                bundler.bundleTag.mockResolvedValueOnce({
                    tag: 'script',
                    source: 'abc',
                    error: null,
                    modules: {
                        bot1: new Set(['script']),
                    },
                    externals: {},
                    libraries: {},
                    warnings: [],
                });

                localEvents.next([
                    {
                        type: 'open_custom_portal',
                        portalId: 'test-portal',
                        botId: null,
                        tagOrSource: '🔺script',
                        taskId: 'task1',
                        options: {
                            style: {
                                anything: true,
                            },
                        },
                    },
                ]);

                await waitAsync();

                expect(updates).toEqual([
                    {
                        oldPortal: {
                            id: 'test-portal',
                            source: 'abc',
                            error: null,
                            botId: null,
                        },
                        portal: {
                            id: 'test-portal',
                            source: 'abc',
                            style: {
                                anything: true,
                            },
                            error: null,
                            botId: null,
                        },
                    },
                ]);
            });
        });

        it('should update the portal if there are no modules and the updated tag is an entrypoint', async () => {
            bundler.bundleTag.mockResolvedValueOnce({
                tag: 'script',
                source: 'abc',
                error: null,
                modules: {},
                externals: {},
                libraries: {},
                warnings: [],
            });

            vm.sendState(
                stateUpdatedEvent({
                    bot1: createPrecalculatedBot('bot1', {
                        script: '🔺abc',
                    }),
                })
            );

            localEvents.next([
                {
                    type: 'register_prefix',
                    prefix: '🔺',
                    taskId: 'task1',
                    options: {},
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    botId: null,
                    tagOrSource: '🔺script',
                    taskId: 'task1',
                    options: {},
                },
            ]);

            await waitAsync();

            expect(updates).toEqual([]);

            bundler.bundleTag.mockResolvedValueOnce({
                tag: 'script',
                source: 'correct',
                error: null,
                modules: {
                    bot1: new Set(['script']),
                },
                externals: {},
                libraries: {},
                warnings: [],
            });

            vm.sendState(
                stateUpdatedEvent({
                    bot1: {
                        tags: {
                            script: '🔺def',
                        },
                        values: {
                            script: '🔺def',
                        },
                    },
                })
            );

            await waitAsync();

            expect(updates).toEqual([
                {
                    oldPortal: {
                        id: 'test-portal',
                        source: 'abc',
                        error: null,
                        botId: null,
                    },
                    portal: {
                        id: 'test-portal',
                        source: 'correct',
                        error: null,
                        botId: null,
                    },
                },
            ]);
        });

        it('should update the portal if there are no modules and the added tag is an entrypoint', async () => {
            bundler.bundleTag.mockResolvedValueOnce({
                tag: 'script',
                source: 'abc',
                error: null,
                modules: {},
                externals: {},
                libraries: {},
                warnings: [],
            });

            vm.sendState(
                stateUpdatedEvent({
                    bot1: createPrecalculatedBot('bot1', {
                        script: '🔺abc',
                    }),
                })
            );

            localEvents.next([
                {
                    type: 'register_prefix',
                    prefix: '🔺',
                    taskId: 'task1',
                    options: {},
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    botId: null,
                    tagOrSource: '🔺script',
                    taskId: 'task1',
                    options: {},
                },
            ]);

            await waitAsync();

            expect(updates).toEqual([]);

            bundler.bundleTag.mockResolvedValueOnce({
                tag: 'script',
                source: 'correct',
                error: null,
                modules: {
                    bot1: new Set(['script']),
                },
                externals: {},
                libraries: {},
                warnings: [],
            });

            vm.sendState(
                stateUpdatedEvent({
                    bot2: createPrecalculatedBot('bot2', {
                        script: '🔺new script',
                    }),
                })
            );

            await waitAsync();

            expect(updates).toEqual([
                {
                    oldPortal: {
                        id: 'test-portal',
                        source: 'abc',
                        error: null,
                        botId: null,
                    },
                    portal: {
                        id: 'test-portal',
                        source: 'correct',
                        error: null,
                        botId: null,
                    },
                },
            ]);
        });

        it('should update the portal with the specified source', async () => {
            bundler.bundleTag.mockResolvedValueOnce({
                tag: 'script',
                source: 'abc',
                error: null,
                modules: {},
                externals: {},
                libraries: {},
                warnings: [],
            });

            vm.sendState(
                stateUpdatedEvent({
                    bot1: createPrecalculatedBot('bot1', {
                        script: '🔺abc',
                    }),
                })
            );

            localEvents.next([
                {
                    type: 'register_prefix',
                    prefix: '🔺',
                    taskId: 'task1',
                    options: {},
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    botId: null,
                    tagOrSource: '🔺script',
                    taskId: 'task1',
                    options: {},
                },
            ]);

            await waitAsync();

            expect(updates).toEqual([]);

            localEvents.next([
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    botId: null,
                    tagOrSource: 'my-source',
                    taskId: 'task1',
                    options: {
                        mode: 'source',
                    },
                },
            ]);

            await waitAsync();

            expect(updates).toEqual([
                {
                    oldPortal: {
                        id: 'test-portal',
                        source: 'abc',
                        error: null,
                        botId: null,
                    },
                    portal: {
                        id: 'test-portal',
                        source: 'my-source',
                        error: null,
                        botId: null,
                    },
                },
            ]);
        });
    });

    describe('externalsDiscovered', () => {
        let externals = [] as ExternalModule[];

        beforeEach(() => {
            externals = [];
            sub.add(
                manager.externalsDiscovered.subscribe((p) =>
                    externals.push(...p)
                )
            );
        });

        it('should resolve new external modules from builds', async () => {
            expect(externals).toEqual([]);

            bundler.bundleTag
                .mockResolvedValueOnce({
                    tag: 'script',
                    source: 'abc',
                    modules: {},
                    externals: {
                        lodash: {
                            id: 'lodash',
                            url: 'myLodashURL',
                            typescriptDefinitionsURL: 'lodashDefs',
                        },
                        react: {
                            id: 'react',
                            url: 'myReactURL',
                            typescriptDefinitionsURL: 'reactDefs',
                        },
                    },
                    libraries: {},
                    warnings: [],
                })
                .mockResolvedValueOnce({
                    tag: 'script',
                    source: 'def',
                    modules: {},
                    externals: {
                        lodash: {
                            id: 'lodash',
                            url: 'myLodashURL',
                            typescriptDefinitionsURL: 'lodashDefs',
                        },
                        react: {
                            id: 'react',
                            url: 'myReactURL',
                            typescriptDefinitionsURL: 'reactDefs',
                        },
                        other: {
                            id: 'other',
                            url: 'myOtherURL',
                            typescriptDefinitionsURL: 'otherDefs',
                        },
                    },
                    libraries: {},
                    warnings: [],
                });

            vm.sendState(
                stateUpdatedEvent({
                    test1: createPrecalculatedBot('test1', {
                        script: '🔺console.log("test1");',
                    }),
                })
            );

            localEvents.next([
                {
                    type: 'register_prefix',
                    prefix: '🔺',
                    options: {},
                    taskId: 'task1',
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    botId: null,
                    tagOrSource: '🔺script',
                    taskId: 'task',
                    options: {
                        style: {
                            abc: 'def',
                        },
                    },
                },
            ]);

            await waitAsync();

            vm.sendState(
                stateUpdatedEvent({
                    test1: createPrecalculatedBot('test1', {
                        script: '🔺console.log("test2");',
                    }),
                })
            );

            await waitAsync();

            expect(externals).toEqual([
                {
                    id: 'lodash',
                    url: 'myLodashURL',
                    typescriptDefinitionsURL: 'lodashDefs',
                },
                {
                    id: 'react',
                    url: 'myReactURL',
                    typescriptDefinitionsURL: 'reactDefs',
                },
                {
                    id: 'other',
                    url: 'myOtherURL',
                    typescriptDefinitionsURL: 'otherDefs',
                },
            ]);
        });

        it('should resolve with the externals that have already been discovered', async () => {
            bundler.bundleTag.mockResolvedValueOnce({
                tag: 'script',
                source: 'abc',
                modules: {},
                externals: {
                    lodash: {
                        id: 'lodash',
                        url: 'myLodashURL',
                        typescriptDefinitionsURL: 'lodashDefs',
                    },
                    react: {
                        id: 'react',
                        url: 'myReactURL',
                        typescriptDefinitionsURL: 'reactDefs',
                    },
                },
                libraries: {},
                warnings: [],
            });

            vm.sendState(
                stateUpdatedEvent({
                    test1: createPrecalculatedBot('test1', {
                        script: '🔺console.log("test1");',
                    }),
                })
            );

            localEvents.next([
                {
                    type: 'register_prefix',
                    prefix: '🔺',
                    options: {},
                    taskId: 'task1',
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    botId: null,
                    tagOrSource: '🔺script',
                    taskId: 'task',
                    options: {
                        style: {
                            abc: 'def',
                        },
                    },
                },
            ]);

            await waitAsync();

            const existingExternals: ExternalModule[] = [];
            manager.externalsDiscovered.subscribe((e) =>
                existingExternals.push(...e)
            );

            expect(existingExternals).toEqual([
                {
                    id: 'lodash',
                    url: 'myLodashURL',
                    typescriptDefinitionsURL: 'lodashDefs',
                },
                {
                    id: 'react',
                    url: 'myReactURL',
                    typescriptDefinitionsURL: 'reactDefs',
                },
            ]);
        });

        it('should record external modules from builds', async () => {
            expect(externals).toEqual([]);

            bundler.bundleTag
                .mockResolvedValueOnce({
                    tag: 'script',
                    source: 'abc',
                    modules: {},
                    externals: {
                        lodash: {
                            id: 'lodash',
                            url: 'myLodashURL',
                            typescriptDefinitionsURL: 'lodashDefs',
                        },
                        react: {
                            id: 'react',
                            url: 'myReactURL',
                            typescriptDefinitionsURL: 'reactDefs',
                        },
                    },
                    libraries: {},
                    warnings: [],
                })
                .mockResolvedValueOnce({
                    tag: 'script',
                    source: 'def',
                    modules: {},
                    externals: {
                        lodash: {
                            id: 'lodash',
                            url: 'myLodashURL',
                            typescriptDefinitionsURL: 'lodashDefs',
                        },
                        react: {
                            id: 'react',
                            url: 'myReactURL',
                            typescriptDefinitionsURL: 'reactDefs',
                        },
                        other: {
                            id: 'other',
                            url: 'myOtherURL',
                            typescriptDefinitionsURL: 'otherDefs',
                        },
                    },
                    libraries: {},
                    warnings: [],
                });

            vm.sendState(
                stateUpdatedEvent({
                    test1: createPrecalculatedBot('test1', {
                        script: '🔺console.log("test1");',
                    }),
                })
            );

            localEvents.next([
                {
                    type: 'register_prefix',
                    prefix: '🔺',
                    options: {},
                    taskId: 'task1',
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    botId: null,
                    tagOrSource: '🔺script',
                    taskId: 'task',
                    options: {
                        style: {
                            abc: 'def',
                        },
                    },
                },
            ]);

            await waitAsync();

            vm.sendState(
                stateUpdatedEvent({
                    test1: createPrecalculatedBot('test1', {
                        script: '🔺console.log("test2");',
                    }),
                })
            );

            await waitAsync();

            expect(manager.externalModules).toEqual({
                lodash: {
                    id: 'lodash',
                    url: 'myLodashURL',
                    typescriptDefinitionsURL: 'lodashDefs',
                },
                react: {
                    id: 'react',
                    url: 'myReactURL',
                    typescriptDefinitionsURL: 'reactDefs',
                },
                other: {
                    id: 'other',
                    url: 'myOtherURL',
                    typescriptDefinitionsURL: 'otherDefs',
                },
            });
        });
    });

    describe('librariesDiscovered', () => {
        let externals = [] as LibraryModule[];

        beforeEach(() => {
            externals = [];
            sub.add(
                manager.librariesDiscovered.subscribe((p) =>
                    externals.push(...p)
                )
            );
        });

        it('should resolve new library modules from builds', async () => {
            expect(externals).toEqual([]);

            bundler.bundleTag
                .mockResolvedValueOnce({
                    tag: 'script',
                    source: 'abc',
                    modules: {},
                    externals: {},
                    libraries: {
                        lodash: {
                            id: 'lodash',
                            source: 'lodashSource',
                            language: 'javascript',
                        },
                        react: {
                            id: 'react',
                            source: 'reactSource',
                            language: 'javascript',
                        },
                    },
                    warnings: [],
                })
                .mockResolvedValueOnce({
                    tag: 'script',
                    source: 'def',
                    modules: {},
                    externals: {},
                    libraries: {
                        lodash: {
                            id: 'lodash',
                            source: 'lodashSource',
                            language: 'javascript',
                        },
                        react: {
                            id: 'react',
                            source: 'reactSource',
                            language: 'javascript',
                        },
                        other: {
                            id: 'other',
                            source: 'otherSource',
                            language: 'javascript',
                        },
                    },
                    warnings: [],
                });

            vm.sendState(
                stateUpdatedEvent({
                    test1: createPrecalculatedBot('test1', {
                        script: '🔺console.log("test1");',
                    }),
                })
            );

            localEvents.next([
                {
                    type: 'register_prefix',
                    prefix: '🔺',
                    options: {},
                    taskId: 'task1',
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    botId: null,
                    tagOrSource: '🔺script',
                    taskId: 'task',
                    options: {
                        style: {
                            abc: 'def',
                        },
                    },
                },
            ]);

            await waitAsync();

            vm.sendState(
                stateUpdatedEvent({
                    test1: createPrecalculatedBot('test1', {
                        script: '🔺console.log("test2");',
                    }),
                })
            );

            await waitAsync();

            expect(externals).toEqual([
                {
                    id: 'lodash',
                    source: 'lodashSource',
                    language: 'javascript',
                },
                {
                    id: 'react',
                    source: 'reactSource',
                    language: 'javascript',
                },
                {
                    id: 'other',
                    source: 'otherSource',
                    language: 'javascript',
                },
            ]);
        });

        it('should resolve with the libraries that have already been discovered', async () => {
            bundler.bundleTag.mockResolvedValueOnce({
                tag: 'script',
                source: 'abc',
                modules: {},
                externals: {},
                libraries: {
                    lodash: {
                        id: 'lodash',
                        source: 'lodashSource',
                        language: 'javascript',
                    },
                    react: {
                        id: 'react',
                        source: 'reactSource',
                        language: 'javascript',
                    },
                },
                warnings: [],
            });

            vm.sendState(
                stateUpdatedEvent({
                    test1: createPrecalculatedBot('test1', {
                        script: '🔺console.log("test1");',
                    }),
                })
            );

            localEvents.next([
                {
                    type: 'register_prefix',
                    prefix: '🔺',
                    options: {},
                    taskId: 'task1',
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    botId: null,
                    tagOrSource: '🔺script',
                    taskId: 'task',
                    options: {
                        style: {
                            abc: 'def',
                        },
                    },
                },
            ]);

            await waitAsync();

            const existingExternals: LibraryModule[] = [];
            manager.librariesDiscovered.subscribe((e) =>
                existingExternals.push(...e)
            );

            expect(existingExternals).toEqual([
                {
                    id: 'lodash',
                    source: 'lodashSource',
                    language: 'javascript',
                },
                {
                    id: 'react',
                    source: 'reactSource',
                    language: 'javascript',
                },
            ]);
        });

        it('should record library modules from builds', async () => {
            expect(externals).toEqual([]);

            bundler.bundleTag
                .mockResolvedValueOnce({
                    tag: 'script',
                    source: 'abc',
                    modules: {},
                    externals: {},
                    libraries: {
                        lodash: {
                            id: 'lodash',
                            source: 'lodashSource',
                            language: 'javascript',
                        },
                        react: {
                            id: 'react',
                            source: 'reactSource',
                            language: 'javascript',
                        },
                    },
                    warnings: [],
                })
                .mockResolvedValueOnce({
                    tag: 'script',
                    source: 'def',
                    modules: {},
                    externals: {},
                    libraries: {
                        lodash: {
                            id: 'lodash',
                            source: 'lodashSource',
                            language: 'javascript',
                        },
                        react: {
                            id: 'react',
                            source: 'reactSource',
                            language: 'javascript',
                        },
                        other: {
                            id: 'other',
                            source: 'otherSource',
                            language: 'javascript',
                        },
                    },
                    warnings: [],
                });

            vm.sendState(
                stateUpdatedEvent({
                    test1: createPrecalculatedBot('test1', {
                        script: '🔺console.log("test1");',
                    }),
                })
            );

            localEvents.next([
                {
                    type: 'register_prefix',
                    prefix: '🔺',
                    options: {},
                    taskId: 'task1',
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    botId: null,
                    tagOrSource: '🔺script',
                    taskId: 'task',
                    options: {
                        style: {
                            abc: 'def',
                        },
                    },
                },
            ]);

            await waitAsync();

            vm.sendState(
                stateUpdatedEvent({
                    test1: createPrecalculatedBot('test1', {
                        script: '🔺console.log("test2");',
                    }),
                })
            );

            await waitAsync();

            expect(manager.libraryModules).toEqual({
                lodash: {
                    id: 'lodash',
                    source: 'lodashSource',
                    language: 'javascript',
                },
                react: {
                    id: 'react',
                    source: 'reactSource',
                    language: 'javascript',
                },
                other: {
                    id: 'other',
                    source: 'otherSource',
                    language: 'javascript',
                },
            });
        });
    });

    describe('portalBotIdUpdated', () => {
        let portals = [] as PortalBotData[];

        beforeEach(() => {
            portals = [];
            sub.add(
                manager.portalBotIdUpdated.subscribe((p) => portals.push(...p))
            );
        });

        it('should resolve with new portal bot IDs', async () => {
            expect(portals).toEqual([]);

            bundler.bundleTag.mockResolvedValueOnce({
                tag: 'script',
                source: 'abc',
                modules: {},
                externals: {},
                libraries: {},
                warnings: [],
            });

            vm.sendState(
                stateUpdatedEvent({
                    test1: createPrecalculatedBot('test1', {
                        script: '🔺console.log("test1");',
                    }),
                })
            );

            localEvents.next([
                {
                    type: 'register_prefix',
                    prefix: '🔺',
                    options: {},
                    taskId: 'task1',
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    botId: 'test',
                    tagOrSource: null,
                    taskId: 'task',
                    options: {
                        style: {
                            abc: 'def',
                        },
                    },
                },
            ]);

            await waitAsync();

            expect(portals).toEqual([
                {
                    portalId: 'test-portal',
                    botId: 'test',
                },
            ]);
        });

        it('should resolve with updated portal bot IDs', async () => {
            expect(portals).toEqual([]);

            bundler.bundleTag.mockResolvedValueOnce({
                tag: 'script',
                source: 'abc',
                modules: {},
                externals: {},
                libraries: {},
                warnings: [],
            });

            vm.sendState(
                stateUpdatedEvent({
                    test1: createPrecalculatedBot('test1', {
                        script: '🔺console.log("test1");',
                    }),
                })
            );

            localEvents.next([
                {
                    type: 'register_prefix',
                    prefix: '🔺',
                    options: {},
                    taskId: 'task1',
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    botId: 'test',
                    tagOrSource: null,
                    taskId: 'task',
                    options: {
                        style: {
                            abc: 'def',
                        },
                    },
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    botId: 'different',
                    tagOrSource: null,
                    taskId: 'task',
                    options: {
                        style: {
                            abc: 'def',
                        },
                    },
                },
            ]);

            await waitAsync();

            expect(portals).toEqual([
                {
                    portalId: 'test-portal',
                    botId: 'test',
                },
                {
                    portalId: 'test-portal',
                    botId: 'different',
                },
            ]);
        });
    });
});
