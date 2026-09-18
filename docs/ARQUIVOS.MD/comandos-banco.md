# Acesso à base de dados (PostgreSQL 16) — API HORARIOS

Banco: container Docker `smart-campos-postgres` | porta **5434** | user/senha `smartcampos`/`smartcampos`

## Acesso via psql local (já instalado)

```bash
psql postgresql://smartcampos:smartcampos@localhost:5434/smartcampos
```

## Acesso via Docker (dispensa psql instalado)

```bash
docker exec -it smart-campos-postgres psql -U smartcampos -d smartcampos
```

## Base de teste (usada nos testes e2e)

```bash
psql postgresql://smartcampos:smartcampos@localhost:5434/smartcampos_test
```

## Uma linha a partir do resultado da query (ex.: listar tabelas)

```bash
psql postgresql://smartcampos:smartcampos@localhost:5434/smartcampos -c '\dt'
```

## Comandos úteis dentro do psql

```sql
\dt                    -- listar tabelas
\d assessments         -- estrutura da tabela
\dn                    -- listar schemas
\q                     -- sair

SELECT count(*) FROM assessments;
SELECT * FROM students LIMIT 5;
SELECT name, status FROM assessments ORDER BY name;
```

## Comandos a partir do projeto (dentro de "API HORARIOS")

```bash
npm run prisma:studio   # interface gráfica no browser
npm run db:seed         # recarregar dados UCT-JAC
npm run db:migrate      # criar/aplicar migrações
npm run db:deploy       # aplicar migrações (produção)
```