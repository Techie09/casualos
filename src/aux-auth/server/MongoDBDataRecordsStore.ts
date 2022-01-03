import {
    Record,
    RecordsStore,
    DataRecordsStore,
    SetDataResult,
    GetDataStoreResult,
} from '@casual-simulation/aux-records';
import { Collection } from 'mongodb';

export class MongoDBDataRecordsStore implements DataRecordsStore {
    private _collection: Collection<DataRecord>;

    constructor(collection: Collection<DataRecord>) {
        this._collection = collection;
    }

    async setData(
        recordName: string,
        address: string,
        data: any,
        publisherId: string,
        subjectId: string
    ): Promise<SetDataResult> {
        await this._collection.updateOne(
            {
                recordName: recordName,
                address: address,
            },
            {
                $set: {
                    recordName: recordName,
                    address: address,
                    data: data,
                    publisherId: publisherId,
                    subjectId: subjectId,
                },
            },
            {
                upsert: true,
            }
        );

        return {
            success: true,
        };
    }

    async getData(
        recordName: string,
        address: string
    ): Promise<GetDataStoreResult> {
        const record = await this._collection.findOne({
            recordName: recordName,
            address: address,
        });

        if (record) {
            return {
                success: true,
                data: record.data,
                publisherId: record.publisherId,
                subjectId: record.subjectId,
            };
        }

        return {
            success: false,
            errorCode: 'data_not_found',
            errorMessage: 'The data was not found.',
        };
    }
}

export interface DataRecord {
    recordName: string;
    address: string;
    data: any;
    publisherId: string;
    subjectId: string;
}
