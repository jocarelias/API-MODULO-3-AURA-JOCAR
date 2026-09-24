# Sequência — Criação de Horário com Deteção de Conflitos

Fluxo de `POST /api/v1/schedules`.

```mermaid
sequenceDiagram
    participant C as Cliente (API aberta)
    participant RT as Router (validação Zod)
    participant SVC as SchedulesAssessmentsService
    participant DB as PostgreSQL

    C->>RT: POST schedules {termId, classId, subjectId, teacherId, dayOfWeek, startTime, endTime, room}
    RT->>RT: safeParse(createScheduleSchema)
    alt payload inválido (focus)
        RT-->>C: 400 VALIDATION_ERROR
    end
    RT->>SVC: createSchedule(body)
    SVC->>DB: term/class/subject/teacher/academicYear existem?
    alt FK ausente
        SVC-->>C: 404 NOT_FOUND
    end
    SVC->>DB: validateTimeRange(startTime < endTime) → 400
    SVC->>DB: SELECT schedules ACTIVE do mesmo schoolId+termId+dayOfWeek
    SVC->>SVC: findConflicts(proposta, existentes) por overlap
    alt professor ocupado OU turma ocupada OU sala ocupada
        SVC-->>C: 409 CONFLICT + details [TEACHER|CLASS|ROOM]
    else sem conflito
        SVC->>DB: INSERT schedule (ACTIVE)
        SVC-->>C: 201 {data: scheduleDto, meta:{correlationId}}
    end
```

Coberto por `tests/g3.e2e.test.js` (SATURDAY/10:00–11:40 criado com sucesso; reenvio idêntico → 409 com `details`; DELETE → 200).