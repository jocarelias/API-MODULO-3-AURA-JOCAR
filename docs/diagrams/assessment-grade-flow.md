# Sequência — Lançar Nota com Recálculo Atómico (ACID)

Fluxo de `POST /api/v1/assessments/:assessmentId/grades`.

```mermaid
sequenceDiagram
    participant C as Cliente (API aberta)
    participant RT as Router (validação Zod)
    participant SVC as SchedulesAssessmentsService
    participant TX as prisma.$transaction
    participant DB as PostgreSQL

    C->>RT: POST grades {studentId, score}
    RT->>RT: safeParse(createGradeSchema)
    alt payload inválido
        RT-->>C: 400 VALIDATION_ERROR (details)
    end

    RT->>SVC: createGrade(assessmentId, body)
    SVC->>DB: assessment (status MUST be OPEN, maxScore)
    alt não encontrada
        SVC-->>C: 404 NOT_FOUND
    end
    alt not OPEN
        SVC-->>C: 409 CONFLICT
    end
    SVC->>DB: validateScore(score <= maxScore) ∈ domínio → 400
    SVC->>DB: matrícula aluno na turma+disciplina → 400/404
    SVC->>DB: grade única (assessmentId+studentId) → duplicata 409

    SVC->>TX: BEGIN
    TX->>DB: INSERT grade (SUBMITTED)
    TX->>DB: SELECT assessments + grades da turma/disciplina/período
    TX->>TX: weightedAverage = Σ(nota×peso)/Σ(pesos) (round2)
    TX->>TX: resolveResultStatus(...)
    TX->>DB: UPSERT result (studentId+classId+subjectId+termId)
    alt qualquer passo falha (ex.: erro forçado no recálculo)
        TX-->>SVC: ROLLBACK (nota NÃO persistida)
        SVC-->>C: 500 INTERNAL_ERROR
    else sucesso
        TX-->>SVC: COMMIT (nota + resultado consistentes)
        SVC-->>C: 201 {data: gradeDto, meta:{correlationId}}
    end
```

Coberto por `tests/g3.transaction.e2e.test.js` (rollback forçado via stub de `_recalculateInTx`: a nota transacionada não fica persistida e o resultado anterior mantém-se).