import { RecordsStore } from './RecordsStore';
import { toBase64String, fromBase64String } from './Utils';
import { createRandomPassword } from '@casual-simulation/crypto';

/**
 * Defines a class that manages records and their keys.
 */
export class RecordsManager {
    private _store: RecordsStore;

    constructor(store: RecordsStore) {
        this._store = store;
    }

    /**
     * Creates a new public record key for the given bucket name.
     * @param name The name of the record.
     * @param userId The ID of the user that is creating the public record.
     * @returns
     */
    async createPublicRecordKey(
        name: string,
        userId: string
    ): Promise<CreatePublicRecordKeyResult> {
        const record = await this._store.getRecordByName(name);

        if (record) {
            if (record.creatorId !== userId) {
                return {
                    success: false,
                    errorCode: 'unauthorized_to_create_record_key',
                    errorMessage:
                        'Another user has already created this record.',
                };
            }

            const password = createRandomPassword();

            await this._store.updateRecord({
                ...record,
                secretHashes: [...record.secretHashes, password.hash],
            });

            return {
                success: true,
                recordKey: formatRecordKey(name, password.password),
                recordName: name,
            };
        } else {
            const password = createRandomPassword();

            await this._store.addRecord({
                name,
                creatorId: userId,
                secretHashes: [password.hash],
            });

            return {
                success: true,
                recordKey: formatRecordKey(name, password.password),
                recordName: name,
            };
        }
    }
}

/**
 * Defines an interface that represents the result of a "create public record key" operation.
 */
export type CreatePublicRecordKeyResult =
    | CreatePublicRecordKeySuccess
    | CreatePublicRecordKeyFailure;

/**
 * Defines an interface that represents a successful "create public record key" result.
 */
export interface CreatePublicRecordKeySuccess {
    /**
     * Whether the operation was successful.
     */
    success: true;

    /**
     * The key that was created.
     */
    recordKey: string;

    /**
     * The name of the record the key was created for.
     */
    recordName: string;
}

/**
 * Defines an interface that represents a failed "create public record key" result.
 */
export interface CreatePublicRecordKeyFailure {
    /**
     * Whether the operation was successful.
     */
    success: false;

    /**
     * The type of error that occurred.
     */
    errorCode: UnauthorizedToCreateRecordKeyError | GeneralRecordError;

    /**
     * The error message.
     */
    errorMessage: string;
}

/**
 * Defines an error that occurs when a user is not authorized to create a key for the public record.
 * This may happen when the user is not the owner of the record.
 */
export type UnauthorizedToCreateRecordKeyError =
    'unauthorized_to_create_record_key';

/**
 * Defines an error that occurs when an unspecified error occurs while creating a public record key.
 */
export type GeneralRecordError = 'general_record_error';

/**
 * Formats the given record name and record secret into a record key.
 * @param recordName The name of the record.
 * @param recordSecret The secret that is used to access the record.
 */
export function formatRecordKey(
    recordName: string,
    recordSecret: string
): string {
    return `vRK1.${toBase64String(recordName)}.${toBase64String(recordSecret)}`;
}

/**
 * Parses the given record key into a name and password pair.
 * Returns null if the key cannot be parsed.
 * @param key The key to parse.
 * @returns
 */
export function parseRecordKey(key: string): [name: string, password: string] {
    if (!key) {
        return null;
    }

    if (!key.startsWith('vRK1.')) {
        return null;
    }

    const withoutVersion = key.slice('vRK1.'.length);
    let nextPeriod = withoutVersion.indexOf('.');
    if (nextPeriod < 0) {
        return null;
    }

    const nameBase64 = withoutVersion.slice(0, nextPeriod);
    const passwordBase64 = withoutVersion.slice(nextPeriod + 1);

    if (nameBase64.length <= 0 || passwordBase64.length <= 0) {
        return null;
    }

    try {
        const name = fromBase64String(nameBase64);
        const password = fromBase64String(passwordBase64);

        return [name, password];
    } catch (err) {
        return null;
    }
}

/**
 * Determines if the given value is a record key.
 * @param key The value to check.
 * @returns
 */
export function isRecordKey(key: unknown): key is string {
    return typeof key === 'string' && parseRecordKey(key) !== null;
}