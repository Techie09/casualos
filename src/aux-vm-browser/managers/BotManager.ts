import {
    Bot,
    merge,
    parseSimulationId,
    createBot,
    DEVICE_BOT_ID,
    LOCAL_BOT_ID,
    botUpdated,
    TEMPORARY_BOT_PARTITION_ID,
    COOKIE_BOT_PARTITION_ID,
    COOKIE_BOT_ID,
    BotTags,
    isBotTags,
    isBot,
    AuxPartitionConfig,
    ADMIN_PARTITION_ID,
    ADMIN_BRANCH_NAME,
    PLAYER_PARTITION_ID,
    OTHER_PLAYERS_PARTITION_ID,
    BOOTSTRAP_PARTITION_ID,
    getTagValueForSpace,
    getUpdateForTagAndSpace,
} from '@casual-simulation/aux-common';

import {
    AuxUser,
    AuxVM,
    BaseSimulation,
    LoginManager,
    getTreeName,
    Simulation,
    AuxConfig,
} from '@casual-simulation/aux-vm';
import { BotPanelManager } from './BotPanelManager';
import { BrowserSimulation } from './BrowserSimulation';
import { AuxVMImpl } from '../vm/AuxVMImpl';
import {
    PortalBundler,
    PortalManager,
    ProgressManager,
} from '@casual-simulation/aux-vm';
import { filter, flatMap, tap, map } from 'rxjs/operators';
import { ConsoleMessages } from '@casual-simulation/causal-trees';
import { Observable, fromEventPattern, Subscription } from 'rxjs';
import { getFinalUrl } from '@casual-simulation/aux-vm-client';
import { LocalStoragePartitionImpl } from '../partitions/LocalStoragePartition';
import { getBotsStateFromStoredAux } from '@casual-simulation/aux-vm/StoredAux';
import ESBuildWasmURL from 'esbuild-wasm/esbuild.wasm';
import { ESBuildPortalBundler } from '@casual-simulation/aux-vm/managers';

/**
 * Defines a class that interfaces with the AppManager and SocketManager
 * to reactively edit bots.
 */
export class BotManager extends BaseSimulation implements BrowserSimulation {
    private _botPanel: BotPanelManager;
    private _login: LoginManager;
    private _progress: ProgressManager;
    private _bundler: PortalBundler;
    private _portals: PortalManager;

    /**
     * Gets the bots panel manager.
     */
    get botPanel() {
        return this._botPanel;
    }

    get login() {
        return this._login;
    }

    get progress() {
        return this._progress;
    }

    get consoleMessages() {
        return <Observable<ConsoleMessages>>(
            this._vm.connectionStateChanged.pipe(
                filter(
                    (m) =>
                        m.type === 'log' ||
                        m.type === 'error' ||
                        m.type === 'warn'
                )
            )
        );
    }

    get portals() {
        return this._portals;
    }

    constructor(
        user: AuxUser,
        id: string,
        config: AuxConfig['config'],
        defaultHost: string = location.origin
    ) {
        super(
            id,
            config,
            createPartitions(),
            (config) => new AuxVMImpl(user, config)
        );
        this.helper.userId = user ? user.id : null;

        this._login = new LoginManager(this._vm);
        this._progress = new ProgressManager(this._vm);

        function createPartitions(): AuxPartitionConfig {
            const parsedId = parseSimulationId(id);
            const host = getFinalUrl(defaultHost, parsedId.host);
            const causalRepoHost = getFinalUrl(
                config.causalRepoConnectionUrl || defaultHost,
                parsedId.host
            );
            const protocol = config.causalRepoConnectionProtocol;

            let partitions: AuxPartitionConfig = {
                shared: {
                    type: 'remote_causal_repo',
                    branch: parsedId.channel,
                    host: causalRepoHost,
                    connectionProtocol: protocol,
                },
                [COOKIE_BOT_PARTITION_ID]: {
                    type: 'proxy',
                    partition: new LocalStoragePartitionImpl({
                        type: 'local_storage',
                        namespace: `aux/${parsedId.channel}`,
                        private: true,
                    }),
                },
                [TEMPORARY_BOT_PARTITION_ID]: {
                    type: 'memory',
                    private: true,
                    initialState: {},
                },
                [PLAYER_PARTITION_ID]: {
                    type: 'remote_causal_repo',
                    branch: `${parsedId.channel}-player-${user.id}`,
                    host: causalRepoHost,
                    connectionProtocol: protocol,
                    temporary: true,
                    remoteEvents: false,
                },
                [OTHER_PLAYERS_PARTITION_ID]: {
                    type: 'other_players_repo',
                    branch: parsedId.channel,
                    host: causalRepoHost,
                    connectionProtocol: protocol,
                },
                [BOOTSTRAP_PARTITION_ID]: {
                    type: 'memory',
                    initialState: config.bootstrapState
                        ? getBotsStateFromStoredAux(config.bootstrapState)
                        : {},
                    private: true,
                },
            };

            // Enable the admin partition and error partition when using the socket.io protocol.
            if (
                !config.causalRepoConnectionProtocol ||
                config.causalRepoConnectionProtocol === 'socket.io'
            ) {
                partitions[ADMIN_PARTITION_ID] = {
                    type: 'remote_causal_repo',
                    branch: ADMIN_BRANCH_NAME,
                    host: causalRepoHost,
                    connectionProtocol: protocol,
                    private: true,
                    static: true,
                };
            }

            return partitions;
        }
    }

    async editBot(
        bot: Bot | BotTags,
        tag: string,
        value: any,
        space: string = null
    ): Promise<void> {
        const val = getTagValueForSpace(
            this.helper.botsState[bot.id],
            tag,
            space
        );
        if (val === value) {
            return;
        }
        if (isBot(bot) && bot.id !== 'empty' && bot.id !== 'mod') {
            await this.helper.updateBot(
                bot,
                getUpdateForTagAndSpace(tag, value, space)
            );
        }
    }

    protected _initManagers() {
        super._initManagers();
        this._botPanel = new BotPanelManager(this._watcher, this._helper);
        this._bundler = new ESBuildPortalBundler({
            esbuildWasmUrl: ESBuildWasmURL,
        });
        this._portals = new PortalManager(
            this._vm,
            this.helper,
            this.watcher,
            this._bundler
        );

        this._subscriptions.push(this._portals);
    }
}
