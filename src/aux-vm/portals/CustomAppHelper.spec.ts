import {
    AuxPartitions,
    AuxRuntime,
    BotAction,
    botAdded,
    createBot,
    createMemoryPartition,
    iteratePartitions,
    MemoryPartition,
    registerCustomApp,
} from '@casual-simulation/aux-common';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuxHelper } from '../vm';
import { CustomAppHelper } from './CustomAppHelper';
import { HtmlAppBackend } from './HtmlAppBackend';

describe('CustomAppHelper', () => {
    let runtime: AuxRuntime;
    let actions: BotAction[];
    let memory: MemoryPartition;
    let userId: string = 'user';
    let helper: AuxHelper;
    let portals: CustomAppHelper;
    let sub: Subscription;

    beforeEach(async () => {
        actions = [];
        sub = new Subscription();
        runtime = new AuxRuntime(
            {
                hash: 'hash',
                major: 1,
                minor: 0,
                patch: 0,
                version: 'v1.0.0',
            },
            {
                supportsAR: false,
                supportsVR: false,
                isCollaborative: true,
                ab1BootstrapUrl: 'ab1Bootstrap',
            }
        );
        memory = createMemoryPartition({
            type: 'memory',
            initialState: {},
        });
        memory.space = 'shared';

        await memory.applyEvents([botAdded(createBot('user'))]);

        helper = createHelper({
            shared: memory,
        });

        portals = new CustomAppHelper(helper);
    });

    function createHelper(partitions: AuxPartitions) {
        runtime = new AuxRuntime(
            {
                hash: 'hash',
                major: 1,
                minor: 0,
                patch: 0,
                version: 'v1.0.0',
            },
            {
                supportsAR: false,
                supportsVR: false,
                isCollaborative: true,
                ab1BootstrapUrl: 'ab1Bootstrap',
            }
        );
        const helper = new AuxHelper(partitions, runtime);

        for (let [, partition] of iteratePartitions(partitions)) {
            sub.add(
                partition.onStateUpdated
                    .pipe(
                        tap((e) => {
                            runtime.stateUpdated(e);
                        })
                    )
                    .subscribe(null, (e: any) => console.error(e))
            );
        }

        runtime.userId = userId;
        sub.add(helper.localEvents.subscribe((a) => actions.push(...a)));

        return helper;
    }

    afterEach(() => {
        sub.unsubscribe();
    });

    describe('handleEvents()', () => {
        describe('register_custom_app', () => {
            it('should create a portal for the given event', () => {
                portals.handleEvents([
                    registerCustomApp('htmlPortal', null, { type: 'html' }),
                ]);

                expect([...portals.portals.keys()]).toEqual(['htmlPortal']);
                const values = [...portals.portals.values()];

                expect(values[0]).toBeInstanceOf(HtmlAppBackend);
                expect(values[0].botId).toBe(null);
            });
        });
    });
});
