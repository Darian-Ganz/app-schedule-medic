// infrastructure/eventbridge/EventBridgePublisher.ts
import { EventBridge } from 'aws-sdk';
import { EventPublisher } from '../../adapters/EventPublisher';

export class EventBridgePublisher implements EventPublisher {
  private eventBridge: EventBridge;
  private eventBusName: string;

  constructor(eventBusName: string = 'default') {
    this.eventBridge = new EventBridge();
    this.eventBusName = eventBusName;
  }

  async publish(eventType: string, payload: any): Promise<void> {
    try {
          console.log('Publishing event to EventBridge:', { eventType, payload });
          await this.eventBridge.putEvents({
            Entries: [
              {
                Source: 'appointment.service',
                DetailType: eventType,
                Detail: JSON.stringify(payload),
                EventBusName: this.eventBusName,
              },
            ],
          }).promise();

    console.log('Event published to EventBridge');
    } catch (err) {
      console.error('EventBridge error:', err);
    }
  }
}