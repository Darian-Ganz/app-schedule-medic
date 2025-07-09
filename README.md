# Backend de Agendamiento Médico (Serverless AWS)

Este proyecto implementa una aplicación backend serverless en AWS que permite a asegurados agendar citas médicas. El sistema procesa solicitudes para dos países (Perú y Chile) y distribuye los eventos de forma asincrónica según el país.

---

## Funcionalidad principal

- Agendamiento de citas médicas (`POST /appointments`)
- Consulta de citas agendadas (`GET /appointments/{insuredId}`)
- Procesamiento asincrónico por país (PE o CL)
- Publicación de eventos a SNS y (opcional) EventBridge
- Persistencia en DynamoDB (estado inicial) y RDS (procesamiento final)

---

## Endpoints disponibles

### `POST /appointments`

Agendar una cita médica.

**Body JSON**:
{
  "insuredId": "00042",
  "scheduleId": 100,
  "countryISO": "PE"
}

### `GET /appointments/{insuredId}`

Consultar una cita médica.


