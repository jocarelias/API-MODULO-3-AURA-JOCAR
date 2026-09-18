# Dados Reais de Teste — Módulo G3 (Avaliações e Horários)

Dataset determinístico semeado pela base de dados local (`prisma/seed.ts`) na porta **5434**.
A geração é **reproduzível**: as notas usam a sequência determinística `(gSeq*7+3) mod (maxScore+1)`,
pelo que `npm run db:reset -- --force` reproduz exactamente este dataset.

> Totais: 1 escola · 16 utilizadores · 10 alunos · 3 disciplinas · 5 professores · 3 turmas ·
> 90 matrículas · 5 avaliações · 40 notas · 90 resultados · 27 horários · 10 situações financeiras (3 com dívida).

## 1. Escola

| Escola | Código | Email | Endereço | Estado | Criado em |
|---|---|---|---|---|---|
| UJAC | UJAC |  |  | ACTIVE | 2026-09-18 |

## 2. Ano Lectivo e Período

| Ano Lectivo | Início | Fim | Estado |
|---|---|---|---|
| 2026 | 2026-01-01 | 2026-12-31 | ACTIVE |
| Período | Início | Fim | Estado |
|---|---|---|---|
| 1º Trimestre | 2026-01-15 | 2026-04-15 | ACTIVE |

## 3. Utilizadores (16)

| Nome | Email | Perfil (RBAC) | Estado |
|---|---|---|---|
| Administrador UCT-JAC | admin@ucjac.ac.mz | SUPER_ADMIN | ACTIVE |
| Armando Correia | prof1@ucjac.ac.mz | TEACHER | ACTIVE |
| Carsolino Sambo | prof3@ucjac.ac.mz | TEACHER | ACTIVE |
| Cidalia da Camara | prof4@ucjac.ac.mz | TEACHER | ACTIVE |
| Fortunato Farao | prof5@ucjac.ac.mz | TEACHER | ACTIVE |
| Leandro Titos | prof2@ucjac.ac.mz | TEACHER | ACTIVE |
| Ana JAC | aluno1@student.ucjac.ac.mz | STUDENT | ACTIVE |
| Berto Catarina | aluno2@student.ucjac.ac.mz | STUDENT | ACTIVE |
| Carlos UC | aluno3@student.ucjac.ac.mz | STUDENT | ACTIVE |
| Diana Maputo | aluno4@student.ucjac.ac.mz | STUDENT | ACTIVE |
| Eduardo Matola | aluno5@student.ucjac.ac.mz | STUDENT | ACTIVE |
| Fátima Nampula | aluno6@student.ucjac.ac.mz | STUDENT | ACTIVE |
| Gabriel Beira | aluno7@student.ucjac.ac.mz | STUDENT | ACTIVE |
| Helena Tete | aluno8@student.ucjac.ac.mz | STUDENT | ACTIVE |
| Ivan Sofala | aluno9@student.ucjac.ac.mz | STUDENT | ACTIVE |
| Julia Zambezia | aluno10@student.ucjac.ac.mz | STUDENT | ACTIVE |

## 4. Turmas (3)

| Turma | Grau | Turno | Sala | Estado |
|---|---|---|---|---|
| Engenharia Informática - 1º Ano | 1 | Manhã | Sala 204 | ACTIVE |
| Engenharia Informática - 2º Ano | 2 | Manhã | Sala 203 | ACTIVE |
| Engenharia Informática - 3º Ano | 3 | Manhã | Sala 201 | ACTIVE |

## 5. Disciplinas (3)

| Disciplina | Código | Estado |
|---|---|---|
| Administração de Redes | SUBJ2 | ACTIVE |
| PTP 3 | SUBJ1 | ACTIVE |
| Programação Paralela | SUBJ3 | ACTIVE |

## 6. Professores (5)

| Professor | Email | Estado |
|---|---|---|
| Armando Correia | prof1@ucjac.ac.mz | ACTIVE |
| Carsolino Sambo | prof3@ucjac.ac.mz | ACTIVE |
| Cidalia da Camara | prof4@ucjac.ac.mz | ACTIVE |
| Fortunato Farao | prof5@ucjac.ac.mz | ACTIVE |
| Leandro Titos | prof2@ucjac.ac.mz | ACTIVE |

## 7. Alunos (10)

| Aluno(a) | Nº de Matrícula | Email | Estado |
|---|---|---|---|
| Ana JAC | UCJAC-2026-001 | aluno1@student.ucjac.ac.mz | ACTIVE |
| Berto Catarina | UCJAC-2026-002 | aluno2@student.ucjac.ac.mz | ACTIVE |
| Carlos UC | UCJAC-2026-003 | aluno3@student.ucjac.ac.mz | ACTIVE |
| Diana Maputo | UCJAC-2026-004 | aluno4@student.ucjac.ac.mz | ACTIVE |
| Eduardo Matola | UCJAC-2026-005 | aluno5@student.ucjac.ac.mz | ACTIVE |
| Fátima Nampula | UCJAC-2026-006 | aluno6@student.ucjac.ac.mz | ACTIVE |
| Gabriel Beira | UCJAC-2026-007 | aluno7@student.ucjac.ac.mz | ACTIVE |
| Helena Tete | UCJAC-2026-008 | aluno8@student.ucjac.ac.mz | ACTIVE |
| Ivan Sofala | UCJAC-2026-009 | aluno9@student.ucjac.ac.mz | ACTIVE |
| Julia Zambezia | UCJAC-2026-010 | aluno10@student.ucjac.ac.mz | ACTIVE |

## 8. Matrículas (90 = 10 alunos × 3 turmas × 3 disciplinas)

| Aluno(a) | Turma | Disciplina | Estado |
|---|---|---|---|
| Ana JAC | Engenharia Informática - 1º Ano | Administração de Redes | ACTIVE |
| Ana JAC | Engenharia Informática - 1º Ano | PTP 3 | ACTIVE |
| Ana JAC | Engenharia Informática - 1º Ano | Programação Paralela | ACTIVE |
| Ana JAC | Engenharia Informática - 2º Ano | Administração de Redes | ACTIVE |
| Ana JAC | Engenharia Informática - 2º Ano | PTP 3 | ACTIVE |
| Ana JAC | Engenharia Informática - 2º Ano | Programação Paralela | ACTIVE |
| Ana JAC | Engenharia Informática - 3º Ano | Administração de Redes | ACTIVE |
| Ana JAC | Engenharia Informática - 3º Ano | PTP 3 | ACTIVE |
| Ana JAC | Engenharia Informática - 3º Ano | Programação Paralela | ACTIVE |
| Berto Catarina | Engenharia Informática - 1º Ano | Administração de Redes | ACTIVE |
| Berto Catarina | Engenharia Informática - 1º Ano | PTP 3 | ACTIVE |
| Berto Catarina | Engenharia Informática - 1º Ano | Programação Paralela | ACTIVE |
| Berto Catarina | Engenharia Informática - 2º Ano | Administração de Redes | ACTIVE |
| Berto Catarina | Engenharia Informática - 2º Ano | PTP 3 | ACTIVE |
| Berto Catarina | Engenharia Informática - 2º Ano | Programação Paralela | ACTIVE |
| Berto Catarina | Engenharia Informática - 3º Ano | Administração de Redes | ACTIVE |
| Berto Catarina | Engenharia Informática - 3º Ano | PTP 3 | ACTIVE |
| Berto Catarina | Engenharia Informática - 3º Ano | Programação Paralela | ACTIVE |
| Carlos UC | Engenharia Informática - 1º Ano | Administração de Redes | ACTIVE |
| Carlos UC | Engenharia Informática - 1º Ano | PTP 3 | ACTIVE |
| Carlos UC | Engenharia Informática - 1º Ano | Programação Paralela | ACTIVE |
| Carlos UC | Engenharia Informática - 2º Ano | Administração de Redes | ACTIVE |
| Carlos UC | Engenharia Informática - 2º Ano | PTP 3 | ACTIVE |
| Carlos UC | Engenharia Informática - 2º Ano | Programação Paralela | ACTIVE |
| Carlos UC | Engenharia Informática - 3º Ano | Administração de Redes | ACTIVE |

_… (as restantes 65 matrículas seguem o mesmo padrão por turma/disciplina); contagem por turma e disciplina:_

| Turma | Disciplina | Matrículas |
|---|---|---|
| Engenharia Informática - 1º Ano | Administração de Redes | 10 |
| Engenharia Informática - 1º Ano | PTP 3 | 10 |
| Engenharia Informática - 1º Ano | Programação Paralela | 10 |
| Engenharia Informática - 2º Ano | Administração de Redes | 10 |
| Engenharia Informática - 2º Ano | PTP 3 | 10 |
| Engenharia Informática - 2º Ano | Programação Paralela | 10 |
| Engenharia Informática - 3º Ano | Administração de Redes | 10 |
| Engenharia Informática - 3º Ano | PTP 3 | 10 |
| Engenharia Informática - 3º Ano | Programação Paralela | 10 |

## 9. Avaliações (5)

| Avaliação | Tipo | Disciplina | Turma | Professor | Data | Máx | Peso | Estado |
|---|---|---|---|---|---|---|---|---|
| Exame Final - PTP 3 | EXAM | PTP 3 | Engenharia Informática - 2º Ano | Armando Correia | 2026-03-10 | 20.00 | 2.000 | OPEN |
| Projeto Final - PTP 3 | TEST | PTP 3 | Engenharia Informática - 1º Ano | Armando Correia | 2026-03-10 | 20.00 | 2.000 | DRAFT |
| Teste 1 - Administração de Redes | TEST | Administração de Redes | Engenharia Informática - 1º Ano | Fortunato Farao | 2026-03-10 | 20.00 | 1.000 | OPEN |
| Teste 1 - PTP 3 | TEST | PTP 3 | Engenharia Informática - 1º Ano | Armando Correia | 2026-03-10 | 20.00 | 1.000 | OPEN |
| Teste 1 - Programação Paralela | TEST | Programação Paralela | Engenharia Informática - 1º Ano | Cidalia da Camara | 2026-03-10 | 20.00 | 1.000 | OPEN |

## 10. Notas (40)

| Aluno(a) | Avaliação | Disciplina | Nota (0–20) | Estado |
|---|---|---|---|---|
| Ana JAC | Exame Final - PTP 3 | PTP 3 | 17.00 | SUBMITTED |
| Berto Catarina | Exame Final - PTP 3 | PTP 3 | 3.00 | SUBMITTED |
| Carlos UC | Exame Final - PTP 3 | PTP 3 | 10.00 | SUBMITTED |
| Diana Maputo | Exame Final - PTP 3 | PTP 3 | 17.00 | SUBMITTED |
| Eduardo Matola | Exame Final - PTP 3 | PTP 3 | 3.00 | SUBMITTED |
| Fátima Nampula | Exame Final - PTP 3 | PTP 3 | 10.00 | SUBMITTED |
| Gabriel Beira | Exame Final - PTP 3 | PTP 3 | 17.00 | SUBMITTED |
| Helena Tete | Exame Final - PTP 3 | PTP 3 | 3.00 | SUBMITTED |
| Ivan Sofala | Exame Final - PTP 3 | PTP 3 | 10.00 | SUBMITTED |
| Julia Zambezia | Exame Final - PTP 3 | PTP 3 | 17.00 | SUBMITTED |
| Ana JAC | Teste 1 - Administração de Redes | Administração de Redes | 10.00 | SUBMITTED |
| Berto Catarina | Teste 1 - Administração de Redes | Administração de Redes | 17.00 | SUBMITTED |
| Carlos UC | Teste 1 - Administração de Redes | Administração de Redes | 3.00 | SUBMITTED |
| Diana Maputo | Teste 1 - Administração de Redes | Administração de Redes | 10.00 | SUBMITTED |
| Eduardo Matola | Teste 1 - Administração de Redes | Administração de Redes | 17.00 | SUBMITTED |
| Fátima Nampula | Teste 1 - Administração de Redes | Administração de Redes | 3.00 | SUBMITTED |
| Gabriel Beira | Teste 1 - Administração de Redes | Administração de Redes | 10.00 | SUBMITTED |
| Helena Tete | Teste 1 - Administração de Redes | Administração de Redes | 17.00 | SUBMITTED |
| Ivan Sofala | Teste 1 - Administração de Redes | Administração de Redes | 3.00 | SUBMITTED |
| Julia Zambezia | Teste 1 - Administração de Redes | Administração de Redes | 10.00 | SUBMITTED |
| Ana JAC | Teste 1 - PTP 3 | PTP 3 | 3.00 | SUBMITTED |
| Berto Catarina | Teste 1 - PTP 3 | PTP 3 | 10.00 | SUBMITTED |
| Carlos UC | Teste 1 - PTP 3 | PTP 3 | 17.00 | SUBMITTED |
| Diana Maputo | Teste 1 - PTP 3 | PTP 3 | 3.00 | SUBMITTED |
| Eduardo Matola | Teste 1 - PTP 3 | PTP 3 | 10.00 | SUBMITTED |
| Fátima Nampula | Teste 1 - PTP 3 | PTP 3 | 17.00 | SUBMITTED |
| Gabriel Beira | Teste 1 - PTP 3 | PTP 3 | 3.00 | SUBMITTED |
| Helena Tete | Teste 1 - PTP 3 | PTP 3 | 10.00 | SUBMITTED |
| Ivan Sofala | Teste 1 - PTP 3 | PTP 3 | 17.00 | SUBMITTED |
| Julia Zambezia | Teste 1 - PTP 3 | PTP 3 | 3.00 | SUBMITTED |
| Ana JAC | Teste 1 - Programação Paralela | Programação Paralela | 3.00 | SUBMITTED |
| Berto Catarina | Teste 1 - Programação Paralela | Programação Paralela | 10.00 | SUBMITTED |
| Carlos UC | Teste 1 - Programação Paralela | Programação Paralela | 17.00 | SUBMITTED |
| Diana Maputo | Teste 1 - Programação Paralela | Programação Paralela | 3.00 | SUBMITTED |
| Eduardo Matola | Teste 1 - Programação Paralela | Programação Paralela | 10.00 | SUBMITTED |
| Fátima Nampula | Teste 1 - Programação Paralela | Programação Paralela | 17.00 | SUBMITTED |
| Gabriel Beira | Teste 1 - Programação Paralela | Programação Paralela | 3.00 | SUBMITTED |
| Helena Tete | Teste 1 - Programação Paralela | Programação Paralela | 10.00 | SUBMITTED |
| Ivan Sofala | Teste 1 - Programação Paralela | Programação Paralela | 17.00 | SUBMITTED |
| Julia Zambezia | Teste 1 - Programação Paralela | Programação Paralela | 3.00 | SUBMITTED |

## 11. Resultados (90)

| Aluno(a) | Disciplina | Turma | Média | Método | Estado |
|---|---|---|---|---|---|
| Ana JAC | PTP 3 | Engenharia Informática - 2º Ano | 17.00 |  | APPROVED |
| Ana JAC | Administração de Redes | Engenharia Informática - 1º Ano | 10.00 |  | APPROVED |
| Berto Catarina | Administração de Redes | Engenharia Informática - 1º Ano | 17.00 |  | APPROVED |
| Berto Catarina | Programação Paralela | Engenharia Informática - 1º Ano | 10.00 |  | APPROVED |
| Berto Catarina | PTP 3 | Engenharia Informática - 1º Ano | 10.00 |  | APPROVED |
| Carlos UC | PTP 3 | Engenharia Informática - 1º Ano | 17.00 |  | APPROVED |
| Carlos UC | Programação Paralela | Engenharia Informática - 1º Ano | 17.00 |  | APPROVED |
| Carlos UC | PTP 3 | Engenharia Informática - 2º Ano | 10.00 |  | APPROVED |
| Diana Maputo | Administração de Redes | Engenharia Informática - 1º Ano | 10.00 |  | APPROVED |
| Diana Maputo | PTP 3 | Engenharia Informática - 2º Ano | 17.00 |  | APPROVED |
| Eduardo Matola | Administração de Redes | Engenharia Informática - 1º Ano | 17.00 |  | APPROVED |
| Eduardo Matola | PTP 3 | Engenharia Informática - 1º Ano | 10.00 |  | APPROVED |
| Eduardo Matola | Programação Paralela | Engenharia Informática - 1º Ano | 10.00 |  | APPROVED |
| Fátima Nampula | PTP 3 | Engenharia Informática - 1º Ano | 17.00 |  | APPROVED |
| Fátima Nampula | Programação Paralela | Engenharia Informática - 1º Ano | 17.00 |  | APPROVED |
| Fátima Nampula | PTP 3 | Engenharia Informática - 2º Ano | 10.00 |  | APPROVED |
| Gabriel Beira | Administração de Redes | Engenharia Informática - 1º Ano | 10.00 |  | APPROVED |
| Gabriel Beira | PTP 3 | Engenharia Informática - 2º Ano | 17.00 |  | APPROVED |

_… (as restantes 72 linhas seguem o mesmo padrão); distribuição por estado:_

| Estado | Quantidade |
|---|---|
| PENDING | 50 |
| APPROVED | 26 |
| FAILED | 14 |

## 12. Horários (27)

| Turma | Disciplina | Professor | Dia | Início | Fim | Sala | Estado |
|---|---|---|---|---|---|---|---|
| Engenharia Informática - 1º Ano | PTP 3 | Armando Correia | MONDAY | 08:00 | 09:40 | Laboratório de Informática | ACTIVE |
| Engenharia Informática - 2º Ano | PTP 3 | Armando Correia | MONDAY | 08:00 | 09:40 | Laboratório de Informática | ACTIVE |
| Engenharia Informática - 3º Ano | PTP 3 | Armando Correia | MONDAY | 08:00 | 09:40 | Laboratório de Informática | ACTIVE |
| Engenharia Informática - 1º Ano | Administração de Redes | Armando Correia | MONDAY | 08:00 | 09:40 | Laboratório de Informática | ACTIVE |
| Engenharia Informática - 2º Ano | Administração de Redes | Armando Correia | MONDAY | 08:00 | 09:40 | Laboratório de Informática | ACTIVE |
| Engenharia Informática - 3º Ano | Administração de Redes | Armando Correia | MONDAY | 08:00 | 09:40 | Laboratório de Informática | ACTIVE |
| Engenharia Informática - 1º Ano | Programação Paralela | Armando Correia | MONDAY | 08:00 | 09:40 | Laboratório de Informática | ACTIVE |
| Engenharia Informática - 2º Ano | Programação Paralela | Armando Correia | MONDAY | 08:00 | 09:40 | Laboratório de Informática | ACTIVE |
| Engenharia Informática - 3º Ano | Programação Paralela | Armando Correia | MONDAY | 08:00 | 09:40 | Laboratório de Informática | ACTIVE |
| Engenharia Informática - 1º Ano | PTP 3 | Leandro Titos | WEDNESDAY | 08:00 | 09:40 | Sala 201 | ACTIVE |
| Engenharia Informática - 2º Ano | PTP 3 | Leandro Titos | WEDNESDAY | 08:00 | 09:40 | Sala 201 | ACTIVE |
| Engenharia Informática - 3º Ano | PTP 3 | Leandro Titos | WEDNESDAY | 08:00 | 09:40 | Sala 201 | ACTIVE |
| Engenharia Informática - 1º Ano | Administração de Redes | Leandro Titos | WEDNESDAY | 08:00 | 09:40 | Sala 201 | ACTIVE |
| Engenharia Informática - 2º Ano | Administração de Redes | Leandro Titos | WEDNESDAY | 08:00 | 09:40 | Sala 201 | ACTIVE |
| Engenharia Informática - 3º Ano | Administração de Redes | Leandro Titos | WEDNESDAY | 08:00 | 09:40 | Sala 201 | ACTIVE |

_… (as restantes 12 linhas seguem o mesmo padrão por turma/dia)._


## 13. Situação Financeira dos Alunos (10 — 3 com dívida)

| Aluno(a) | Com dívida | Estado financeiro | Montante em dívida (MT) | Actualizado em |
|---|---|---|---|---|
| Ana JAC | Sim | IN_DEBT | 17500.00 | 2026-09-18 |
| Berto Catarina | Sim | IN_DEBT | 17500.00 | 2026-09-18 |
| Carlos UC | Sim | IN_DEBT | 17500.00 | 2026-09-18 |
| Diana Maputo | Não | REGULAR | 0.00 | 2026-09-18 |
| Eduardo Matola | Não | REGULAR | 0.00 | 2026-09-18 |
| Fátima Nampula | Não | REGULAR | 0.00 | 2026-09-18 |
| Gabriel Beira | Não | REGULAR | 0.00 | 2026-09-18 |
| Helena Tete | Não | REGULAR | 0.00 | 2026-09-18 |
| Ivan Sofala | Não | REGULAR | 0.00 | 2026-09-18 |
| Julia Zambezia | Não | REGULAR | 0.00 | 2026-09-18 |

> Os 3 alunos com dívida (`IN_DEBT`) são bloqueados pela **regra financeira** do módulo G3
> ao consultar notas/resultados (`403 FORBIDDEN` com código `STUDENT_HAS_DEBT`).
