import { APIGatewayProxyHandler, SQSEvent, Context } from 'aws-lambda';
import { SNS, DynamoDB} from 'aws-sdk';

const sns = new SNS();
const dynamo = new DynamoDB.DocumentClient();

const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN || '';
const DYNAMO_TABLE_NAME = process.env.DYNAMO_TABLE_NAME || 'Appointments';

export const handler = async (event: any, context: Context) => {
  console.log('Event received:', JSON.stringify(event, null, 2));
  
  try {
    // Check if it's an API Gateway event
    if (event.httpMethod) {
      return await handleApiGatewayEvent(event);
    }
    // Check if it's an SQS event
    else if (event.Records && event.Records[0]?.eventSource === 'aws:sqs') {
      return await handleSQSEvent(event, context);
    }
    else {
      throw new Error('Unknown event type');
    }
  } catch (error) {
    console.error('Handler error:', error);
    
    // If it's an API Gateway event, return error response
    if (event.httpMethod) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Error interno' })
      };
    }
    
    // For SQS events, throw the error so it can be retried
    throw error;
  }
};

// Handle API Gateway events
async function handleApiGatewayEvent(event: any) {
  const method = event.httpMethod.toUpperCase();
  
  switch (method) {
    case 'POST':
      return await registerHandler(event);
    case 'GET':
      return await getHandler(event);
    default:
      return {
        statusCode: 405,
        body: JSON.stringify({ message: `Método ${method} no permitido.` }),
      };
  }
}

// Handle SQS events
async function handleSQSEvent(event: SQSEvent, context: Context) {
  return await updateStatusHandler(event, context)
}

async function registerHandler (event: any) {
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
      insuredId: insuredId,
      scheduleId: scheduleId,
      countryISO,
      status: 'pending'
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
  } catch (error) {
    console.error('Error en registerHandler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error interno' })
    };
  }
};

async function getHandler (event: any){
  try {
    const { insuredId } = event.pathParameters || {};

    if (!insuredId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'insuredId es requeridos en la URL.' }),
      };
    }

    // Get item from DynamoDB using AWS SDK v2
    const params: DynamoDB.DocumentClient.GetItemInput = {
      TableName: DYNAMO_TABLE_NAME,
      Key: {
        insuredId: insuredId,
      },
    };

    const response = await dynamo.get(params).promise();

    if (!response.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Record not found',
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        appointment: response.Item,
        message: 'Agendamiento encontrado exitosamente.'
      })
    };
  } catch (error) {
    console.error('Error en getAppointmentHandler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error interno al obtener agendamiento.' })
    };
  }
};

async function updateStatusHandler(event: SQSEvent, context: Context) {
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
    } catch (err) {
      console.error('Error al actualizar estado:', err);
    }
  }
};
