import { User } from '@casual-simulation/causal-trees';
import { CausalRepoClient } from '@casual-simulation/causal-trees/core2';
import {
    SocketManager as SocketIOSocketManager,
    SocketIOConnectionClient,
} from '@casual-simulation/causal-tree-client-socketio';
import { BotHttpClient } from './BotHttpClient';
import {
    PartitionConfig,
    RemoteCausalRepoPartition,
    RemoteCausalRepoPartitionImpl,
    BotPartition,
    BotPartitionImpl,
    OtherPlayersPartition,
    OtherPlayersPartitionImpl,
    RemoteCausalRepoProtocol,
    RemoteYjsPartitionImpl,
    YjsPartition,
} from '@casual-simulation/aux-common';
import {
    SocketManager as ApiarySocketManager,
    AwsSocket,
    ApiaryConnectionClient,
} from '@casual-simulation/causal-tree-client-apiary';

/**
 * A map of hostnames to CausalRepoClients.
 * Helps prevent duplicating websocket connections to the same host.
 */
let socketClientCache = new Map<string, CausalRepoClient>();

/**
 * A map of hostnames to CausalRepoClients.
 * Helps prevent duplicating websocket connections to the same host.
 */
let awsApiaryClientCache = new Map<string, CausalRepoClient>();

/**
 * Gets the causal repo client that should be used for the given host.
 * @param host The host.
 */
export function getClientForHostAndProtocol(
    host: string,
    user: User,
    protocol: RemoteCausalRepoProtocol
): CausalRepoClient {
    if (protocol === 'apiary-aws') {
        return getAWSApiaryClientForHostAndProtocol(host, user);
    } else {
        return getSocketIOClientForHost(host, user);
    }
}

/**
 * Gets the casual repo client that should be used for the given host when connecting over the AWS Apiary protocol.
 * @param host The URl that should be connected to.
 * @param user The user that the connection should be made with.
 */
export function getAWSApiaryClientForHostAndProtocol(
    host: string,
    user: User
): CausalRepoClient {
    let client = awsApiaryClientCache.get(host);
    if (!client) {
        const manager = new ApiarySocketManager(host);
        manager.init();
        const socket = new AwsSocket(manager.socket);
        const connection = new ApiaryConnectionClient(socket, user);
        client = new CausalRepoClient(connection);
        awsApiaryClientCache.set(host, client);

        socket.open();
    }

    return client;
}

/**
 * Gets the causal repo client that should be used for the given host when connecting over the socket.io protocol.
 * @param host The host.
 */
export function getSocketIOClientForHost(
    host: string,
    user: User
): CausalRepoClient {
    let client = socketClientCache.get(host);
    if (!client) {
        const manager = new SocketIOSocketManager(host);
        manager.init();
        const connection = new SocketIOConnectionClient(manager.socket, user);
        client = new CausalRepoClient(connection);
        socketClientCache.set(host, client);
    }

    return client;
}

/**
 * Attempts to create a CausalTree2Partition from the given config.
 * @param config The config.
 */
export async function createRemoteCausalRepoPartition(
    config: PartitionConfig,
    user: User,
    useCache: boolean = true
): Promise<RemoteCausalRepoPartition> {
    if (config.type === 'remote_causal_repo') {
        const client = getClientForHostAndProtocol(
            config.host,
            user,
            config.connectionProtocol
        );
        const partition = new RemoteCausalRepoPartitionImpl(
            user,
            client,
            config
        );
        await partition.init();
        return partition;
    }
    return undefined;
}

/**
 * Attempts to create a CausalTree2Partition from the given config.
 * @param config The config.
 */
export async function createRemoteYjsPartition(
    config: PartitionConfig,
    user: User,
    useCache: boolean = true
): Promise<YjsPartition> {
    if (config.type === 'remote_yjs') {
        const client = getClientForHostAndProtocol(
            config.host,
            user,
            config.connectionProtocol
        );
        const partition = new RemoteYjsPartitionImpl(user, client, config);
        await partition.init();
        return partition;
    }
    return undefined;
}

/**
 * Attempts to create a CausalTree2Partition from the given config.
 * @param config The config.
 */
export async function createOtherPlayersRepoPartition(
    config: PartitionConfig,
    user: User,
    useCache: boolean = true
): Promise<OtherPlayersPartition> {
    if (config.type === 'other_players_repo') {
        const client = getClientForHostAndProtocol(
            config.host,
            user,
            config.connectionProtocol
        );
        const partition = new OtherPlayersPartitionImpl(user, client, config);
        return partition;
    }
    return undefined;
}

export async function createBotPartition(
    config: PartitionConfig
): Promise<BotPartition> {
    if (config.type === 'bot') {
        const client = new BotHttpClient(config.host);
        const partition = new BotPartitionImpl(client, config);
        return partition;
    }
    return undefined;
}
