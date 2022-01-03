const AWS = require('aws-sdk');
const { readFileSync } = require('fs');
const path = require('path');
const YAML = require('yaml');
const { v4: uuid } = require('uuid');

AWS.config.update({
    region: 'us-east-1',

    // Dummy credentials
    accessKeyId: 'xxxx',
    secretAccessKey: 'xxxx',
});

const ddb = new AWS.DynamoDB({
    endpoint: 'http://localhost:9125',
    apiVersion: '2012-08-10',
});

const s3 = new AWS.S3({
    endpoint: 'http://localhost:4566',
    apiVersion: '2006-03-01',
    s3ForcePathStyle: true,
});

// See env.json
const USERS_TABLE = 'Users';
const USER_SERVICES_TABLE = 'UserServices';
const RECORDS_TABLE = 'Records';
const EMAIL_TABLE = 'EmailRules';
const RECORDS_BUCKET = 'records-bucket';
const PUBLIC_RECORDS_TABLE = 'PublicRecords';
const DATA_TABLE = 'Data';
const FILES_TABLE = 'Files';
const FILES_BUCKET = 'files-bucket';

async function start() {
    const tablesResult = await ddb.listTables({}).promise();
    const reset = process.argv.includes('--reset');

    const templateSrc = readFileSync(
        path.resolve(__dirname, '..', 'serverless', 'aws', 'template.yml'),
        { encoding: 'utf8' }
    );
    const template = YAML.parseDocument(templateSrc).toJSON();

    const hasUsersTable = tablesResult.TableNames.includes(USERS_TABLE);
    if (!hasUsersTable || reset) {
        if (hasUsersTable) {
            console.log('Deleting Users Table');
            await ddb
                .deleteTable({
                    TableName: USERS_TABLE,
                })
                .promise();
        }

        console.log('Creating Users Table');

        const params = template.Resources.UsersTable.Properties;

        await ddb
            .createTable({
                TableName: USERS_TABLE,
                ...params,
            })
            .promise();
    } else {
        console.log('Users Table already exists');
    }

    const hasUserServicesTable =
        tablesResult.TableNames.includes(USER_SERVICES_TABLE);
    if (!hasUserServicesTable || reset) {
        if (hasUserServicesTable) {
            console.log('Deleting UserServices Table');
            await ddb
                .deleteTable({
                    TableName: USER_SERVICES_TABLE,
                })
                .promise();
        }

        console.log('Creating UserServices Table');

        const params = template.Resources.UserServicesTable.Properties;
        await ddb
            .createTable({
                TableName: USER_SERVICES_TABLE,
                ...params,
            })
            .promise();
    } else {
        console.log('UserServices Table already exists');
    }

    const hasRecordsTable = tablesResult.TableNames.includes(RECORDS_TABLE);
    if (!hasRecordsTable || reset) {
        if (hasRecordsTable) {
            console.log('Deleting Records Table');
            await ddb
                .deleteTable({
                    TableName: RECORDS_TABLE,
                })
                .promise();
        }

        console.log('Creating Records Table');

        const params = template.Resources.RecordsTable.Properties;
        await ddb
            .createTable({
                TableName: RECORDS_TABLE,
                ...params,
            })
            .promise();
    } else {
        console.log('Records Table already exists');
    }

    const hasEmailTable = tablesResult.TableNames.includes(EMAIL_TABLE);
    if (!hasEmailTable || reset) {
        if (hasEmailTable) {
            console.log('Deleting Email Table');
            await ddb
                .deleteTable({
                    TableName: EMAIL_TABLE,
                })
                .promise();
        }

        console.log('Creating Email Table');

        const params = template.Resources.EmailRulesTable.Properties;
        await ddb
            .createTable({
                TableName: EMAIL_TABLE,
                ...params,
            })
            .promise();

        await ddb
            .putItem({
                TableName: EMAIL_TABLE,
                Item: {
                    id: { S: uuid() },
                    type: { S: 'allow' },
                    pattern: { S: '@casualsimulation\\.org$' },
                },
            })
            .promise();

        await ddb
            .putItem({
                TableName: EMAIL_TABLE,
                Item: {
                    id: { S: uuid() },
                    type: { S: 'deny' },
                    pattern: { S: '^test@casualsimulation\\.org$' },
                },
            })
            .promise();
    } else {
        console.log('Email Table already exists');
    }

    const hasPublicRecordsTable =
        tablesResult.TableNames.includes(PUBLIC_RECORDS_TABLE);
    if (!hasPublicRecordsTable || reset) {
        if (hasPublicRecordsTable) {
            console.log('Deleting Public Records Table');
            await ddb
                .deleteTable({
                    TableName: PUBLIC_RECORDS_TABLE,
                })
                .promise();
        }

        console.log('Creating Public Records Table');

        const params = template.Resources.PublicRecordsTable.Properties;
        await ddb
            .createTable({
                TableName: PUBLIC_RECORDS_TABLE,
                ...params,
            })
            .promise();
    } else {
        console.log('Public Records Table already exists');
    }

    const hasDataTable = tablesResult.TableNames.includes(DATA_TABLE);
    if (!hasDataTable || reset) {
        if (hasDataTable) {
            console.log('Deleting Data Table');
            await ddb
                .deleteTable({
                    TableName: DATA_TABLE,
                })
                .promise();
        }

        console.log('Creating Data Table');

        const params = template.Resources.DataTable.Properties;
        await ddb
            .createTable({
                TableName: DATA_TABLE,
                ...params,
            })
            .promise();
    } else {
        console.log('Data Table already exists');
    }

    const hasFilesTable = tablesResult.TableNames.includes(FILES_TABLE);
    if (!hasFilesTable || reset) {
        if (hasFilesTable) {
            console.log('Deleting Files Table');
            await ddb
                .deleteTable({
                    TableName: FILES_TABLE,
                })
                .promise();
        }

        console.log('Creating Files Table');

        const params = template.Resources.FilesTable.Properties;
        await ddb
            .createTable({
                TableName: FILES_TABLE,
                ...params,
            })
            .promise();
    } else {
        console.log('Files Table already exists');
    }

    const buckets = await s3.listBuckets().promise();
    const hasRecordsBucket = buckets.Buckets.some(
        (b) => b.Name === RECORDS_BUCKET
    );
    if (!hasRecordsBucket || reset) {
        if (hasRecordsBucket) {
            deleteBucket(RECORDS_BUCKET);
        }

        console.log('Creating Records Bucket');
        await s3
            .createBucket({
                Bucket: RECORDS_BUCKET,
            })
            .promise();
    } else {
        console.log('Records Bucket already exists');
    }

    const hasFilesBucket = buckets.Buckets.some((b) => b.Name === FILES_BUCKET);
    if (!hasFilesBucket || reset) {
        if (hasFilesBucket) {
            await deleteBucket(FILES_BUCKET);
        }

        console.log('Creating Files Bucket');
        await s3
            .createBucket({
                Bucket: FILES_BUCKET,
            })
            .promise();

        await s3
            .putBucketCors({
                Bucket: FILES_BUCKET,
                CORSConfiguration: {
                    CORSRules: [
                        {
                            AllowedHeaders: ['*'],
                            AllowedMethods: ['GET', 'PUT', 'POST'],
                            AllowedOrigins: ['*'],
                            ExposeHeaders: [],
                            MaxAgeSeconds: 3000,
                        },
                    ],
                },
            })
            .promise();
    } else {
        console.log('Files Bucket already exists');
    }
}

start();

async function deleteBucket(bucketName) {
    console.log(`Deleting "${bucketName}" Bucket`);
    const objects = await s3
        .listObjects({
            Bucket: bucketName,
        })
        .promise();
    await Promise.all(
        objects.Contents.map(async (object) => {
            await s3
                .deleteObject({
                    Bucket: bucketName,
                    Key: object.Key,
                })
                .promise();
        })
    );
    await s3
        .deleteBucket({
            Bucket: bucketName,
        })
        .promise();
}
