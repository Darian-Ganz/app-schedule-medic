import { SQSRecord } from 'aws-lambda';

export interface MessageData {
    insuredId: string;
    scheduleId: number;
    countryISO: string;
}

export function parseMessage(record: SQSRecord): MessageData {
    try {
        const snsBody = JSON.parse(record.body);
        const message: MessageData = JSON.parse(snsBody.Message);
        return message;
    } catch (error) {
        throw new Error(`Message parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}