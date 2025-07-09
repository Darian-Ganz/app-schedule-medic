// application/usecases/CreateAppointment.ts
import { EventPublisher } from '../../adapters/EventPublisher';

export class ConfirmAppointment {
  constructor(private publisher: EventPublisher) {}

  async execute(input: { insuredId: string; scheduleId: number; countryISO: string }) {
    
    console.log('ConfirmAppointment: Publishing event...', input);
    
    const eventType = input.countryISO === 'CL' ? 'AppointmentCreatedCL' : 'AppointmentCreatedPE';
    await this.publisher.publish(eventType, input);

    console.log('ConfirmAppointment: Event published');
  }
}
