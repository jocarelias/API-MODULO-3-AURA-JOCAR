# Tabela Rota → Roles

> Ficheiro **gerado automaticamente** a partir de `ROUTE_ACCESS`
> (`src/modules/schedules-assessments/infrastructure/auth/routeAccess.ts`).
> Não editar à mão: alterar `ROUTE_ACCESS` e correr `npm run docs:access-table`.

## Rotas públicas

| Método | Rota | Roles | Verificação de posse | Descrição |
| --- | --- | --- | --- | --- |
| `POST` | `/auth/login` | *(público)* | — | Não exige token |
| `POST` | `/auth/refresh` | *(público)* | — | Não exige token |

## Rotas protegidas

| Método | Rota | Roles | Verificação de posse | Descrição |
| --- | --- | --- | --- | --- |
| `POST` | `/auth/logout` | TODOS | — | Revoga o refreshToken do próprio utilizador autenticado |
| `GET` | `/me/financial-status` | STUDENT | `student-own-financial` | Estado financeiro do próprio estudante (ACTIVE/BLOCKED) |
| `GET` | `/assessments` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY, TEACHER, STUDENT | `student-or-teacher-assessment-list` | Lista avaliações; o estudante fica limitado às suas turmas e o docente às avaliações das cadeiras que leciona |
| `POST` | `/assessments` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY, TEACHER | `teacher-own-assessment` | Cria uma avaliação |
| `POST` | `/assessments/plan` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY, TEACHER | `teacher-own-assessment` | Cria o conjunto de avaliações (nomes e pesos) definido pelo docente |
| `GET` | `/assessments/:id` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY, TEACHER, STUDENT | `student-or-teacher-assessment` | Obtém uma avaliação; o estudante só acede às suas turmas e o docente só às avaliações que lhe pertencem |
| `PATCH` | `/assessments/:id` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY, TEACHER | `teacher-own-assessment` | Atualiza uma avaliação |
| `DELETE` | `/assessments/:id` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY, TEACHER | `teacher-own-assessment` | Elimina uma avaliação sem notas lançadas |
| `GET` | `/assessments/:assessmentId/grades` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY, TEACHER, STUDENT | `student-or-teacher-grades` | Lista notas da avaliação; o estudante recebe apenas as suas e o docente só as das cadeiras que leciona |
| `POST` | `/assessments/:assessmentId/grades` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY, TEACHER | `teacher-own-assessment` | Lança a nota de um aluno numa avaliação |
| `PATCH` | `/assessments/:assessmentId/grades/:gradeId` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY, TEACHER | `teacher-own-assessment` | Altera a nota lançada |
| `GET` | `/schedules` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY, TEACHER, STUDENT | `student-or-teacher-schedule-list` | Lista horários; o estudante fica limitado às suas turmas e o docente às aulas que leciona |
| `POST` | `/schedules` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY | `teacher-own-schedule` | Cria um horário (só coordenação/administração) |
| `GET` | `/schedules/:id` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY, TEACHER, STUDENT | `student-or-teacher-schedule` | Obtém um horário; o estudante só acede às suas turmas e o docente só às suas aulas |
| `PATCH` | `/schedules/:id` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY | `teacher-own-schedule` | Atualiza um horário (só coordenação/administração) |
| `DELETE` | `/schedules/:id` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY | `teacher-own-schedule` | Elimina um horário (só coordenação/administração) |
| `GET` | `/results` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY, TEACHER, STUDENT | `student-or-teacher-results` | Lista resultados; o estudante fica limitado aos seus e o docente às cadeiras que leciona |
| `GET` | `/results/calculation-methods` | TODOS | — | Lista os métodos de cálculo do motor académico (metadado sem dados pessoais) |
| `POST` | `/results/calculate` | TODOS | — | Calcula uma média com as notas enviadas no próprio pedido |
| `GET` | `/results/:id` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY, TEACHER, STUDENT | `student-or-teacher-result` | Obtém um resultado; o estudante só acede ao seu e o docente só às cadeiras que leciona |
| `POST` | `/results` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY, TEACHER | `teacher-own-result` | Calcula/atualiza resultados em lote |
| `PATCH` | `/results/:id` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY, TEACHER | `teacher-own-result` | Recalcula um resultado individual |
| `DELETE` | `/results/:id` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY, TEACHER | `teacher-own-result` | Elimina um resultado |
| `GET` | `/print/class/:classId/schedule` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY, TEACHER, STUDENT | `student-class-scope` | Dados para impressão do horário de uma turma; o estudante só imprime as suas turmas |
| `GET` | `/print/class/:classId/pauta` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY, TEACHER, STUDENT | `student-or-teacher-pauta` | Dados para impressão da pauta; o estudante recebe apenas a sua linha e o docente só as cadeiras que leciona |
| `GET` | `/schools` | TODOS | — | Catálogo de escolas |
| `GET` | `/academic-years` | TODOS | — | Catálogo de anos letivos |
| `GET` | `/terms` | TODOS | — | Catálogo de períodos letivos |
| `GET` | `/classes` | TODOS | — | Catálogo de turmas |
| `GET` | `/subjects` | TODOS | — | Catálogo de disciplinas |
| `GET` | `/teachers` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY, TEACHER | — | Catálogo de docentes (dados pessoais) |
| `GET` | `/students` | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, COORDINATOR, SECRETARY, TEACHER | — | Catálogo de estudantes (dados pessoais) |

## Como ler a coluna "Verificação de posse"

Ter o role certo **não** é suficiente: a tabela declara também, para cada rota,
a verificação explícita de posse do objecto (`POSSESSION`). Os guards correspondentes
estão em `infrastructure/auth/accessPolicy.ts` e são aplicados pelo router.

- `student-or-teacher-results` — resultados: o estudante só vê os seus; o docente só os das turmas/disciplinas que leciona.
- `student-or-teacher-result` — um resultado concreto: posse do estudante ou da cadeira lecionada pelo docente.
- `student-or-teacher-assessment-list` — avaliações: limite por turma (estudante) ou por docência (docente).
- `student-or-teacher-assessment` — uma avaliação concreta: turma do estudante ou docência do docente.
- `student-or-teacher-grades` — notas: estudante (turma + dívida regularizada) ou docente (cadeira lecionada).
- `student-or-teacher-schedule-list` — horários: limite por turma (estudante) ou por docência (docente).
- `student-or-teacher-schedule` — um horário concreto: turma do estudante ou aula do docente.
- `student-or-teacher-pauta` — pauta: linha do estudante ou cadeira lecionada pelo docente.
- `student-own-results` — o estudante só acede aos resultados cujo `studentId` é o seu.
- `student-own-financial` — só consulta a própria situação financeira.
- `student-class-scope` — o recurso tem de pertencer a uma turma em que o estudante está inscrito.
- `student-grades-in-class` — notas: turma do recurso **e** dívida regularizada.
- `student-pauta-in-class` — pauta: turma do recurso **e** dívida regularizada.
- `student-own-grades` — o estudante recebe apenas as suas notas.
- `teacher-own-assessment` — só o docente atribuído à avaliação.
- `teacher-own-schedule` — só o docente atribuído ao horário.
- `teacher-own-result` — só o docente que leciona a turma/disciplina do resultado.
