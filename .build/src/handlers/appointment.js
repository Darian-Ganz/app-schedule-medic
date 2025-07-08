"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateStatusHandler = exports.registerHandler = void 0;
const aws_sdk_1 = require("aws-sdk");
const sns = new aws_sdk_1.SNS();
const dynamo = new aws_sdk_1.DynamoDB.DocumentClient();
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN || '';
const DYNAMO_TABLE_NAME = process.env.DYNAMO_TABLE_NAME || 'Appointments';
const registerHandler = async (event) => {
    try {
        const body = JSON.parse(event.body || '{}');
        const { insuredId, scheduleId, countryISO } = body;
        if (!insuredId || !scheduleId || !countryISO || !['PE', 'CL'].includes(countryISO)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Campos inválidos.' }),
            };
        }
        const item = {
            insuredId,
            scheduleId,
            countryISO,
            status: 'pending',
            requestedAt: new Date().toISOString()
        };
        await dynamo.put({
            TableName: DYNAMO_TABLE_NAME,
            Item: item
        }).promise();
        await sns.publish({
            TopicArn: SNS_TOPIC_ARN,
            Message: JSON.stringify(item),
            MessageAttributes: {
                countryISO: {
                    DataType: 'String',
                    StringValue: countryISO
                }
            }
        }).promise();
        return {
            statusCode: 202,
            body: JSON.stringify({ message: 'El agendamiento está en proceso.' })
        };
    }
    catch (error) {
        console.error('Error en registerHandler:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Error interno' })
        };
    }
};
exports.registerHandler = registerHandler;
const updateStatusHandler = async (event, context) => {
    for (const record of event.Records) {
        try {
            const body = JSON.parse(record.body);
            const { insuredId, scheduleId } = body;
            await dynamo.update({
                TableName: DYNAMO_TABLE_NAME,
                Key: {
                    insuredId,
                    scheduleId
                },
                UpdateExpression: 'set #s = :status',
                ExpressionAttributeNames: {
                    '#s': 'status'
                },
                ExpressionAttributeValues: {
                    ':status': 'completed'
                }
            }).promise();
            console.log(`Estado actualizado a 'completed' para insuredId=${insuredId}, scheduleId=${scheduleId}`);
        }
        catch (err) {
            console.error('Error al actualizar estado:', err);
        }
    }
};
exports.updateStatusHandler = updateStatusHandler;
