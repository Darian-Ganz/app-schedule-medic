
import { Signer } from "@aws-sdk/rds-signer";
import mysql from 'mysql2/promise';
import { SQSEvent, SQSRecord } from 'aws-lambda';
import { EventBridge } from 'aws-sdk';
import { EventBridgePublisher } from '../infrastructure/eventbridge/EventBridgePublisher';
import { ConfirmAppointment } from '../application/usecases/ConfirmAppointment';
import { parseMessage } from '../infrastructure/sqs/MessageParser';


const host_name  = process.env.HOST_NAME!
const port = parseInt(process.env.PORT!)
const db_name = process.env.DB_NAME!
const db_user_name = process.env.DB_USER_NAME!
const db_password = process.env.DB_PASSWORD!
const aws_region = process.env.APP_REGION!

const publisher = new EventBridgePublisher();
const useCase = new ConfirmAppointment(publisher);

interface MessageData {
    insuredId: string;
    scheduleId: number;
    countryISO: string;
}

async function dbOps(insuredId: string, scheduleId: number, countryISO: string): Promise<mysql.QueryResult | undefined> {
    try {
        const conn = await mysql.createConnection({
            host: host_name,
            user: db_user_name,
            password: db_password,
            database: db_name
            //ssl: 'Amazon RDS' // Ensure you have the CA bundle for SSL connection
        });

        // Insert query with varchar and int columns
        const insertQuery = 'INSERT INTO Appointments (insuredId, scheduleId, countryISO) VALUES (?, ?, ?)';
        const [result] = await conn.execute(insertQuery, [insuredId, scheduleId, countryISO]);
        
        console.log('Insert result:', result);
        
        // Close the connection
        await conn.end();
        
        return result as mysql.ResultSetHeader;
    }
    catch (err) {
        console.log(err);
        throw err;
    }
}

async function processMessage(messageData: MessageData): Promise<{ success: boolean; message: string; insertId?: number }> {
    try {
        
        // Validate the message data
        if (!messageData.insuredId || typeof messageData.insuredId !== 'string') {
            throw new Error('Invalid or missing insuredId field');
        }
        
        if (!messageData.scheduleId || typeof messageData.scheduleId !== 'number') {
            throw new Error('Invalid or missing scheduleId field');
        }

        if (!messageData.countryISO || typeof messageData.countryISO !== 'string') {
            throw new Error('Invalid or missing countryISO field');
        }
        
        // Insert into database
        const result = await dbOps(messageData.insuredId, messageData.scheduleId, messageData.countryISO);
        
        if (!result) {
            throw new Error('Database operation failed');
        }
        
        return {
            success: true,
            message: `Successfully inserted record for ${messageData.insuredId}`   
        };
        
    } catch (error) {
        console.error('Error processing message:', error);
        return {
            success: false,
            message: `Failed to process message: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}

export const handler = async (event: SQSEvent): Promise<{ statusCode: number; body: string }> => {    
    console.log('Received SQS event with', event.Records.length, 'records');
    
    const results = [];

    for (const record of event.Records) {
        console.log('Processing message:', record.messageId);
        console.log('Data message:', record);

        // Parse the message body
        const messageData = parseMessage(record);
        const result = await processMessage(messageData);

        if (result.success) {
           await useCase.execute({
                insuredId: messageData.insuredId,
                scheduleId: messageData.scheduleId,
                countryISO: messageData.countryISO
            });
        }

        results.push({
            messageId: record.messageId,
            success: result.success
        });
    }

    // Check if all messages were processed successfully
    const failedMessages = results.filter(r => !r.success);
    
    if (failedMessages.length > 0) {
        console.error('Some messages failed to process:', failedMessages);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Some messages failed to process',
                results: results,
                failedCount: failedMessages.length,
                successCount: results.length - failedMessages.length
            })
        };
    }
    
    // All messages processed successfully
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'All messages processed successfully',
            results: results,
            processedCount: results.length
        })
    };    
};