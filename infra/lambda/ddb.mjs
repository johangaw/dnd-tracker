// The only module that touches the AWS SDK.
//
// Everything else takes this as an injected dependency, so the routing and
// authorisation logic can be tested without the SDK present at all. The SDK
// ships inside the managed Node runtime, which is why this Lambda needs no npm
// install and no bundler.

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    QueryCommand,
    PutCommand
} from '@aws-sdk/lib-dynamodb';
import { COLLECTIONS } from './router.mjs';

const SK_PREFIX_TO_COLLECTION = Object.fromEntries(
    Object.entries(COLLECTIONS).map(([col, prefix]) => [prefix, col])
);

export function createDdb({ tableName, client }) {
    const doc = DynamoDBDocumentClient.from(client ?? new DynamoDBClient({}), {
        marshallOptions: { removeUndefinedValues: true }
    });

    const partitionKey = sub => `USER#${sub}`;
    const sortKey = record => `${COLLECTIONS[record.col]}#${record.id}`;

    return {
        // Delta pull. The LSI is sparse - it only contains items that carry an
        // `sv` attribute - and is queried on the same partition as the table,
        // so a user can only ever read their own records.
        async listChanges({ sub, sinceSv, limit }) {
            const records = [];
            let maxSv = sinceSv;
            let exclusiveStartKey;

            do {
                const page = await doc.send(new QueryCommand({
                    TableName: tableName,
                    IndexName: 'ChangesBySv',
                    KeyConditionExpression: 'PK = :pk AND sv > :since',
                    ExpressionAttributeValues: { ':pk': partitionKey(sub), ':since': sinceSv },
                    Limit: limit,
                    ExclusiveStartKey: exclusiveStartKey
                }));

                for (const item of page.Items ?? []) {
                    const [prefix, ...rest] = item.SK.split('#');
                    const col = SK_PREFIX_TO_COLLECTION[prefix];
                    if (!col) continue; // an item type this version does not know about

                    records.push({
                        col,
                        id: rest.join('#'),
                        sv: item.sv,
                        updatedAt: item.updatedAt,
                        deletedAt: item.deletedAt ?? null,
                        data: item.data ? JSON.parse(item.data) : null
                    });
                    if (item.sv > maxSv) maxSv = item.sv;
                }

                exclusiveStartKey = page.LastEvaluatedKey;
            } while (exclusiveStartKey && records.length < limit);

            return { records, maxSv };
        },

        // Last-write-wins, enforced server side. The condition means a stale
        // push cannot overwrite a newer record even if the client's own
        // comparison was wrong or its clock was skewed.
        async putRecords({ sub, records }) {
            const applied = [];
            const conflicts = [];

            const results = await Promise.allSettled(records.map(record =>
                doc.send(new PutCommand({
                    TableName: tableName,
                    Item: {
                        PK: partitionKey(sub),
                        SK: sortKey(record),
                        sv: record.sv,
                        updatedAt: record.updatedAt,
                        deletedAt: record.deletedAt ?? null,
                        // Stored as a JSON string: DynamoDB rejects empty
                        // strings and empty sets inside maps, which arbitrary
                        // character sheets would otherwise trip over.
                        data: record.deletedAt != null ? undefined : JSON.stringify(record.data)
                    },
                    ConditionExpression: 'attribute_not_exists(PK) OR updatedAt <= :updatedAt',
                    ExpressionAttributeValues: { ':updatedAt': record.updatedAt }
                }))
            ));

            const losers = [];
            results.forEach((result, index) => {
                const record = records[index];
                if (result.status === 'fulfilled') {
                    applied.push({ col: record.col, id: record.id, sv: record.sv });
                } else if (result.reason?.name === 'ConditionalCheckFailedException') {
                    losers.push(record);
                } else {
                    throw result.reason;
                }
            });

            // A rejected push means the stored copy is newer, so hand it back
            // and let the client adopt it.
            for (const record of losers) {
                const current = await doc.send(new QueryCommand({
                    TableName: tableName,
                    KeyConditionExpression: 'PK = :pk AND SK = :sk',
                    ExpressionAttributeValues: {
                        ':pk': partitionKey(sub),
                        ':sk': sortKey(record)
                    },
                    Limit: 1
                }));

                const item = current.Items?.[0];
                if (!item) continue;

                conflicts.push({
                    col: record.col,
                    id: record.id,
                    sv: item.sv,
                    updatedAt: item.updatedAt,
                    deletedAt: item.deletedAt ?? null,
                    data: item.data ? JSON.parse(item.data) : null
                });
            }

            return { applied, conflicts };
        }
    };
}

export default { createDdb };
