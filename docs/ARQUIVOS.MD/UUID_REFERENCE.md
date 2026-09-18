# Referência de UUID — Módulo G3 (Avaliações e Horários)

Gerado automaticamente a partir da base de dados real (PostgreSQL 16, banco `smartcampos`).

**Totais:** 1 escola · 1 ano lectivo · 1 período · 3 turmas · 3 disciplinas · 5 professores · 10 alunos · 6 avaliações · 27 horários · 40 notas · 89 resultados.

---

## 1. Contexto Académico

| Entidade | Nome | UUID |
|---|---|---|
| School | UJAC | `c5b3ffee-3ac9-4d6e-9496-5ff73d86a8c1` |
| AcademicYear | 2026 (ACTIVE) | `7059d983-da71-4221-9541-afacb32316c3` |
| Term | 1º Trimestre (ACTIVE) | `b1ec59f2-8ae4-48e2-b9b0-24172da51ce8` |

---

## 2. Turmas

| Nome | Ano | UUID |
|---|---|---|
| Engenharia Informática - 1º Ano | 1º | `df12a7a2-b47b-413e-8308-b0d5b6ef53dd` |
| Engenharia Informática - 2º Ano | 2º | `afadd13d-7f2e-4aeb-a839-9b4ff0e99cac` |
| Engenharia Informática - 3º Ano | 3º | `a9c7e5c3-0c0f-4d00-858a-e2a019f801f6` |

---

## 3. Disciplinas

| Nome | Código | UUID |
|---|---|---|
| PTP 3 | SUBJ1 | `26c5ef3c-67ce-436c-9c45-c2a4cf28ceaf` |
| Administração de Redes | SUBJ2 | `eb659aed-8388-449b-95f6-65d7eb1041b8` |
| Programação Paralela | SUBJ3 | `f733b0de-f907-4501-b9ec-0216bf9c75ad` |

---

## 4. Professores

| Nome | UUID |
|---|---|
| Armando Correia | `e79e30fb-b3e6-4113-ad47-c212aefca3ac` |
| Leandro Titos | `a4b8703f-22bc-46c6-932b-7dae7025d3e9` |
| Carsolino Sambo | `9610a83b-7f68-4de8-915a-b0bfb933204b` |
| Cidalia da Camara | `176d4cfd-ed74-46fa-893a-aaa3ff1a0ea6` |
| Fortunato Farao | `5f2a3271-0a7e-4196-b550-4476191015ac` |

---

## 5. Alunos

| Nome | Nº Matrícula | UUID |
|---|---|---|
| Ana JAC | UCJAC-2026-001 | `99cf22c6-9ad1-4e3b-8402-16de34051558` |
| Berto Catarina | UCJAC-2026-002 | `3fa2c658-25db-4d07-9a92-62085242a74e` |
| Carlos UC | UCJAC-2026-003 | `cad368ba-17c5-401d-af67-e0463bdf12a2` |
| Diana Maputo | UCJAC-2026-004 | `5eda9493-4e6f-43a5-be63-978650eed136` |
| Eduardo Matola | UCJAC-2026-005 | `7706bfcc-aef9-4420-bde3-f934fd26ba1e` |
| Fátima Nampula | UCJAC-2026-006 | `7ec7c2b7-a973-43ef-9cd4-0395d8868b85` |
| Gabriel Beira | UCJAC-2026-007 | `0e1230ce-9077-4678-aaa5-bfa789eb5dce` |
| Helena Tete | UCJAC-2026-008 | `fc8221bd-1f2b-425a-8b5e-687573ab7731` |
| Ivan Sofala | UCJAC-2026-009 | `768ad645-229c-49c5-8f8a-e1703357d0a8` |
| Julia Zambezia | UCJAC-2026-010 | `e899712d-9aa7-4700-a3e9-8bd3e7dfdd63` |

---

## 6. Avaliações

| Nome | Tipo | Status | Turma | Disciplina | Professor | UUID |
|---|---|---|---|---|---|---|
| Teste 1 - PTP 3 | TEST | OPEN | Engenharia Informática - 1º Ano | PTP 3 | Armando Correia | `595b586c-ceac-4722-9ac0-49c5501d451d` |
| Teste 1 - Administração de Redes | TEST | OPEN | Engenharia Informática - 1º Ano | Administração de Redes | Fortunato Farao | `f7cc99b8-78a0-4bde-abaa-b3c3a9d5fbe8` |
| Exame Final - PTP 3 | EXAM | OPEN | Engenharia Informática - 2º Ano | PTP 3 | Armando Correia | `5f290cf0-9a8d-480b-bf02-0adb9b8f72cd` |
| Teste 1 - Programação Paralela | TEST | OPEN | Engenharia Informática - 1º Ano | Programação Paralela | Cidalia da Camara | `40c22892-cefa-4bdc-a1cc-cd594ac4f38d` |
| Projeto Final - PTP 3 | TEST | DRAFT | Engenharia Informática - 1º Ano | PTP 3 | Armando Correia | `abf0daf1-a0cd-4651-b800-212d2f4084b7` |
| e2e-acid-1789551516374-342000 | TEST | OPEN | Engenharia Informática - 1º Ano | PTP 3 | Armando Correia | `3331fafa-7fd4-4937-aa27-73151b21e688` |

---

## 7. Horários

| Dia | Hora | Sala | UUID |
|---|---|---|---|
| MONDAY | 08:00–09:40 | Laboratório de Informática | `74da6e64-ea71-494f-804b-9ebbef6f6c52` |
| WEDNESDAY | 08:00–09:40 | Sala 201 | `4093d463-b10f-4159-8ef4-daa911ad73cf` |
| FRIDAY | 08:00–09:40 | Auditório | `0950a158-ec09-49bd-98a1-998c8907ebf6` |
| MONDAY | 08:00–09:40 | Laboratório de Informática | `19b3710b-73c3-4eca-8311-7acc2c0ca0d8` |
| WEDNESDAY | 08:00–09:40 | Sala 201 | `8faf5ed6-0da4-4959-96fd-183adae981fd` |
| FRIDAY | 08:00–09:40 | Auditório | `9dba8050-62d2-4b8f-967f-4677342659dd` |
| MONDAY | 08:00–09:40 | Laboratório de Informática | `0cd42078-8459-4f52-84c4-266505496319` |
| WEDNESDAY | 08:00–09:40 | Sala 201 | `e30f75d8-a6ce-437e-9069-516dd892e7be` |
| FRIDAY | 08:00–09:40 | Auditório | `a0e04d6c-8d87-41a3-a363-fdb59e0387fa` |
| MONDAY | 08:00–09:40 | Laboratório de Informática | `d87be2da-fd8f-461b-94fd-9d5258a24b12` |
| WEDNESDAY | 08:00–09:40 | Sala 201 | `37930af9-3f8d-4707-97f9-5ec0d36101c6` |
| FRIDAY | 08:00–09:40 | Auditório | `0271975a-fc69-4b73-9d73-a922854ca639` |
| MONDAY | 08:00–09:40 | Laboratório de Informática | `0b3d547d-67f9-4837-a146-aba0b23f08f9` |
| WEDNESDAY | 08:00–09:40 | Sala 201 | `678fe93b-cdc6-46c0-b25f-9dbb23c5b181` |
| FRIDAY | 08:00–09:40 | Auditório | `a03d2968-98b5-4983-88f1-a61c583eaa41` |
| MONDAY | 08:00–09:40 | Laboratório de Informática | `a727060d-4270-4f0b-8682-07847bd729fc` |
| WEDNESDAY | 08:00–09:40 | Sala 201 | `8f8f6b9d-4f77-4b6c-843c-63aced396b65` |
| FRIDAY | 08:00–09:40 | Auditório | `2347f500-16b3-419a-9e23-9bc3d0570517` |
| MONDAY | 08:00–09:40 | Laboratório de Informática | `1656ee67-d670-4642-9b1c-780e7bb9d41f` |
| WEDNESDAY | 08:00–09:40 | Sala 201 | `57992da2-cd8e-44c1-92ca-67689dc9ecd5` |
| FRIDAY | 08:00–09:40 | Auditório | `3b77ca91-15c0-408f-bfb1-2f45345bc76d` |
| MONDAY | 08:00–09:40 | Laboratório de Informática | `644c4cd0-24ef-4701-85bd-4866f61d6d5d` |
| WEDNESDAY | 08:00–09:40 | Sala 201 | `071b1e96-c0cb-4210-8a86-08a21937b7a8` |
| FRIDAY | 08:00–09:40 | Auditório | `3c8d8b65-6eff-4c82-9a71-05af7d9b951e` |
| MONDAY | 08:00–09:40 | Laboratório de Informática | `e7333ab3-d7eb-4ac8-b50b-7efb522761d9` |
| WEDNESDAY | 08:00–09:40 | Sala 201 | `ccff3fee-91fd-49d1-93e8-a89cb2ce41ec` |
| FRIDAY | 08:00–09:40 | Auditório | `b1ffc589-c79e-4d93-a38a-9f88589432b6` |

---

## 8. Notas

| Nota | Avaliação | Aluno | Score | UUID |
|---|---|---|---|---|
| 04c1687d | Teste 1 - PTP 3 | Ana JAC | 1 | `04c1687d-b6d4-4c46-b539-68017fc19bc7` |
| 9bdc725b | Teste 1 - PTP 3 | Berto Catarina | 5 | `9bdc725b-64c6-4e52-a055-f74b08ddee2a` |
| 337a726c | Teste 1 - PTP 3 | Carlos UC | 16 | `337a726c-1e19-480a-b9c3-cb88fc995f14` |
| 3f33f65e | Teste 1 - PTP 3 | Diana Maputo | 18 | `3f33f65e-05e3-497e-aed2-898fa60cdc20` |
| 42aa48f1 | Teste 1 - PTP 3 | Eduardo Matola | 3 | `42aa48f1-8ce3-4e20-b8a5-5293b36d1571` |
| d9567ab2 | Teste 1 - PTP 3 | Fátima Nampula | 5 | `d9567ab2-cce0-4160-b497-038efedd98f5` |
| 73eed200 | Teste 1 - PTP 3 | Gabriel Beira | 14 | `73eed200-5c80-454e-967c-43795f063f02` |
| 9e6acd5a | Teste 1 - PTP 3 | Helena Tete | 12 | `9e6acd5a-efaa-49cf-bd99-ab177372d154` |
| cd7eb178 | Teste 1 - PTP 3 | Julia Zambezia | 12 | `cd7eb178-c161-4288-af02-d21be3e90dba` |
| a1dcd0b6 | Teste 1 - Administração de Redes | Ana JAC | 19 | `a1dcd0b6-9e89-497f-9b91-a38c2852e371` |
| 9f665e00 | Teste 1 - Administração de Redes | Berto Catarina | 11 | `9f665e00-6794-4521-ae5d-60fd99ba2c61` |
| 3b92d17d | Teste 1 - Administração de Redes | Carlos UC | 15 | `3b92d17d-9122-434f-8d7c-9d4e7b787508` |
| 0a563c63 | Teste 1 - Administração de Redes | Diana Maputo | 1 | `0a563c63-b4ef-4344-9879-8fc8fabd6522` |
| 6f4c2abe | Teste 1 - Administração de Redes | Eduardo Matola | 7 | `6f4c2abe-60d4-438f-9a5a-309fc9c6fc8d` |
| 4997ef28 | Teste 1 - Administração de Redes | Fátima Nampula | 16 | `4997ef28-d10a-47f4-9e1a-18fa001254c8` |
| 38f11de3 | Teste 1 - Administração de Redes | Gabriel Beira | 2 | `38f11de3-95cb-4cdb-b9cc-c2b00e631d65` |
| faddfcb7 | Teste 1 - Administração de Redes | Helena Tete | 2 | `faddfcb7-22e0-4dce-9ef1-d1fdf5d182f6` |
| 320cc352 | Teste 1 - Administração de Redes | Ivan Sofala | 19 | `320cc352-4ad9-4ae5-a6b5-da1dc646eb11` |
| 18aaa0b4 | Teste 1 - Administração de Redes | Julia Zambezia | 10 | `18aaa0b4-ece3-437d-a665-2be969ab5004` |
| 7b654e7e | Exame Final - PTP 3 | Ana JAC | 13 | `7b654e7e-5c93-40fe-852b-056562075c73` |
| b85d3999 | Exame Final - PTP 3 | Berto Catarina | 15 | `b85d3999-05ea-4b9a-b4dc-5d85127f833b` |
| 57a349e5 | Exame Final - PTP 3 | Carlos UC | 15 | `57a349e5-76af-48f4-907d-0c04768ce72a` |
| c5e91726 | Exame Final - PTP 3 | Diana Maputo | 4 | `c5e91726-f155-44cb-b97c-77dcfe0dea40` |
| ae048ab2 | Exame Final - PTP 3 | Eduardo Matola | 4 | `ae048ab2-17dc-45ec-9184-a34e871f19e9` |
| 64f53073 | Exame Final - PTP 3 | Fátima Nampula | 16 | `64f53073-5ff3-4a6c-814c-d384eb12e19d` |
| 1bff8a00 | Exame Final - PTP 3 | Gabriel Beira | 13 | `1bff8a00-e179-4bc0-8b15-fa5f06423d45` |
| 53e13f59 | Exame Final - PTP 3 | Helena Tete | 20 | `53e13f59-77bb-4394-8f5d-c3dfa673ef14` |
| 7fbed5fd | Exame Final - PTP 3 | Ivan Sofala | 5 | `7fbed5fd-3cb5-4293-9101-70491adebae7` |
| c67f52f8 | Exame Final - PTP 3 | Julia Zambezia | 12 | `c67f52f8-9813-4d6a-a437-3f26a5daaf24` |
| 79dc2d40 | Teste 1 - Programação Paralela | Ana JAC | 18 | `79dc2d40-436d-42e3-b37b-7b5fb19c4c0f` |
| d3b5227f | Teste 1 - Programação Paralela | Berto Catarina | 5 | `d3b5227f-4b03-470f-b533-e10975b3242a` |
| 13da2ea9 | Teste 1 - Programação Paralela | Carlos UC | 4 | `13da2ea9-ea90-44b6-b341-68c65578a94b` |
| af0edbc9 | Teste 1 - Programação Paralela | Diana Maputo | 9 | `af0edbc9-e068-49a2-a39f-8492a2f32fce` |
| 2ce4741e | Teste 1 - Programação Paralela | Eduardo Matola | 20 | `2ce4741e-05ff-4217-acb6-df97c4f0e30a` |
| c78c6e81 | Teste 1 - Programação Paralela | Fátima Nampula | 6 | `c78c6e81-cc34-4dc0-88ce-58e875ecc772` |
| 3b70a09b | Teste 1 - Programação Paralela | Gabriel Beira | 5 | `3b70a09b-12b3-4ff3-982b-8e59ca98cdcc` |
| a80845b2 | Teste 1 - Programação Paralela | Helena Tete | 11 | `a80845b2-a6a3-410c-8fc8-0a13f87c9a2c` |
| ebc7f6c6 | Teste 1 - Programação Paralela | Ivan Sofala | 1 | `ebc7f6c6-2866-43e0-a389-9e4556a4cf26` |
| f0ba8562 | Teste 1 - Programação Paralela | Julia Zambezia | 3 | `f0ba8562-1dd7-4f8e-9b0c-bba8c54278de` |
| 07963e7b | Teste 1 - PTP 3 | Ivan Sofala | 17 | `07963e7b-23ca-49dd-a4f5-ae61f092e488` |

---

## 9. Resultados

| Resultado | Aluno | Turma | Disciplina | Status | Média | UUID |
|---|---|---|---|---|---|---|
| 7b7e11e7 | Ana JAC | Engenharia Informática - 1º Ano | Administração de Redes | APPROVED | 19 | `7b7e11e7-09c8-4fb2-91fb-b20464ccd7cd` |
| 6ab6115f | Berto Catarina | Engenharia Informática - 1º Ano | Administração de Redes | APPROVED | 11 | `6ab6115f-c66b-4859-a78a-e3cb5e83d71f` |
| 5760e1a4 | Carlos UC | Engenharia Informática - 1º Ano | Administração de Redes | APPROVED | 15 | `5760e1a4-f07b-4900-8e1c-80a8be042c1c` |
| 73a05ec8 | Diana Maputo | Engenharia Informática - 1º Ano | Administração de Redes | FAILED | 1 | `73a05ec8-143a-4a07-9583-df26fa2810c4` |
| d22cc8f9 | Eduardo Matola | Engenharia Informática - 1º Ano | Administração de Redes | FAILED | 7 | `d22cc8f9-316c-46d2-8fad-adc961e44e93` |
| e6f5cb0f | Fátima Nampula | Engenharia Informática - 1º Ano | Administração de Redes | APPROVED | 16 | `e6f5cb0f-6980-4a9b-9e52-c42c2d4f77c4` |
| 44836d94 | Gabriel Beira | Engenharia Informática - 1º Ano | Administração de Redes | FAILED | 2 | `44836d94-eddb-44ee-ab7d-02e9dac3b6d5` |
| 97145e18 | Helena Tete | Engenharia Informática - 1º Ano | Administração de Redes | FAILED | 2 | `97145e18-578d-47a4-9a77-d39b66e15410` |
| ea733d14 | Ivan Sofala | Engenharia Informática - 1º Ano | Administração de Redes | APPROVED | 19 | `ea733d14-3225-47ea-9b86-093e6ab30602` |
| 20bf4d4c | Julia Zambezia | Engenharia Informática - 1º Ano | Administração de Redes | APPROVED | 10 | `20bf4d4c-b08d-4542-92a9-498251cd9cc8` |
| 5c368ee2 | Ana JAC | Engenharia Informática - 1º Ano | Programação Paralela | APPROVED | 18 | `5c368ee2-989c-424b-8132-27ecb8639993` |
| ecfc4d84 | Berto Catarina | Engenharia Informática - 1º Ano | Programação Paralela | FAILED | 5 | `ecfc4d84-2035-4d16-97a9-99bb4eb85ca3` |
| 5fc08649 | Carlos UC | Engenharia Informática - 1º Ano | Programação Paralela | FAILED | 4 | `5fc08649-bacb-4d37-960b-32f0efbc8894` |
| 63e39fe6 | Diana Maputo | Engenharia Informática - 1º Ano | Programação Paralela | RECOVERY | 9 | `63e39fe6-efa3-4168-ba68-994a9054f9fe` |
| 4b5c9e6d | Eduardo Matola | Engenharia Informática - 1º Ano | Programação Paralela | APPROVED | 20 | `4b5c9e6d-d3a6-4216-a515-3ff596eab538` |
| 1c224924 | Fátima Nampula | Engenharia Informática - 1º Ano | Programação Paralela | FAILED | 6 | `1c224924-11a9-4ef2-b56a-76a85c68ab6d` |
| a4031f97 | Gabriel Beira | Engenharia Informática - 1º Ano | Programação Paralela | FAILED | 5 | `a4031f97-397f-496f-8a06-8adcc9a2a183` |
| a92e3f75 | Helena Tete | Engenharia Informática - 1º Ano | Programação Paralela | APPROVED | 11 | `a92e3f75-94ea-40dd-ae07-fb03ca88437c` |
| 2f37d1b4 | Ivan Sofala | Engenharia Informática - 1º Ano | Programação Paralela | FAILED | 1 | `2f37d1b4-4119-47bc-a503-8e954da93505` |
| 7d1b8c47 | Julia Zambezia | Engenharia Informática - 1º Ano | Programação Paralela | FAILED | 3 | `7d1b8c47-0c74-4a2f-adf0-61b8a9808689` |
| d0a746cd | Ana JAC | Engenharia Informática - 2º Ano | PTP 3 | APPROVED | 13 | `d0a746cd-5fe3-414a-b237-0dc5f5c76697` |
| b30893b0 | Berto Catarina | Engenharia Informática - 2º Ano | PTP 3 | APPROVED | 15 | `b30893b0-444e-4e87-98dd-953b060cdb66` |
| be69c48f | Carlos UC | Engenharia Informática - 2º Ano | PTP 3 | APPROVED | 15 | `be69c48f-9596-4325-95bb-1f59494b385b` |
| b2aff825 | Diana Maputo | Engenharia Informática - 2º Ano | PTP 3 | FAILED | 4 | `b2aff825-8da5-4438-8f8c-9d87a0264743` |
| a8707e8f | Eduardo Matola | Engenharia Informática - 2º Ano | PTP 3 | FAILED | 4 | `a8707e8f-4c65-4c47-b4f0-351cc6cf5677` |
| f943fc19 | Fátima Nampula | Engenharia Informática - 2º Ano | PTP 3 | APPROVED | 16 | `f943fc19-4c7a-49ed-bace-73cc267102d4` |
| a06e8f65 | Gabriel Beira | Engenharia Informática - 2º Ano | PTP 3 | APPROVED | 13 | `a06e8f65-208b-4c2c-a939-a47ca20b3506` |
| 7e3cb008 | Helena Tete | Engenharia Informática - 2º Ano | PTP 3 | APPROVED | 20 | `7e3cb008-b0a8-454d-a57f-759511d5bbd8` |
| 6a4a455d | Ivan Sofala | Engenharia Informática - 2º Ano | PTP 3 | FAILED | 5 | `6a4a455d-1099-40de-a321-81fc8765dadf` |
| 4902fd17 | Julia Zambezia | Engenharia Informática - 2º Ano | PTP 3 | APPROVED | 12 | `4902fd17-45ad-4472-80f5-b17d45a343e8` |
| 9cf175ed | Ana JAC | Engenharia Informática - 2º Ano | Administração de Redes | PENDING | — | `9cf175ed-5b12-4c3b-9399-904746cce7dd` |
| d0dac50e | Berto Catarina | Engenharia Informática - 2º Ano | Administração de Redes | PENDING | — | `d0dac50e-a61f-4c55-97c5-4c54c985faf6` |
| 4aa7b364 | Carlos UC | Engenharia Informática - 2º Ano | Administração de Redes | PENDING | — | `4aa7b364-802e-4934-9d82-a26b987e968d` |
| 073d9eec | Diana Maputo | Engenharia Informática - 2º Ano | Administração de Redes | PENDING | — | `073d9eec-ecf6-4588-854c-1117d265ffa9` |
| 6039a9e9 | Eduardo Matola | Engenharia Informática - 2º Ano | Administração de Redes | PENDING | — | `6039a9e9-becf-40f9-8f92-091a91e65693` |
| 8b4d07d9 | Fátima Nampula | Engenharia Informática - 2º Ano | Administração de Redes | PENDING | — | `8b4d07d9-4ad7-4227-bb8a-b73e9443595e` |
| 935a1a7f | Gabriel Beira | Engenharia Informática - 2º Ano | Administração de Redes | PENDING | — | `935a1a7f-4a1d-440c-bc7d-2c0eef5fce30` |
| 64b1b0a7 | Helena Tete | Engenharia Informática - 2º Ano | Administração de Redes | PENDING | — | `64b1b0a7-21b4-42ca-8552-346698270ccc` |
| f2ce8497 | Ivan Sofala | Engenharia Informática - 2º Ano | Administração de Redes | PENDING | — | `f2ce8497-7007-4c8f-b987-779b0048f118` |
| 6cc16fd4 | Julia Zambezia | Engenharia Informática - 2º Ano | Administração de Redes | PENDING | — | `6cc16fd4-8637-42e2-9e80-edd3868bc7d1` |
| fb9bfd2d | Ana JAC | Engenharia Informática - 2º Ano | Programação Paralela | PENDING | — | `fb9bfd2d-f661-43c3-96e8-d6862c6a9652` |
| 05dd45f3 | Berto Catarina | Engenharia Informática - 2º Ano | Programação Paralela | PENDING | — | `05dd45f3-21e9-48b9-ae81-1d43b0edee77` |
| 87d5a316 | Carlos UC | Engenharia Informática - 2º Ano | Programação Paralela | PENDING | — | `87d5a316-a05b-42ee-8b05-7c379bea4672` |
| 64f82952 | Diana Maputo | Engenharia Informática - 2º Ano | Programação Paralela | PENDING | — | `64f82952-76e9-4683-91b7-314b43678f2c` |
| 0beaa355 | Eduardo Matola | Engenharia Informática - 2º Ano | Programação Paralela | PENDING | — | `0beaa355-b1de-4eb3-aae7-abc1daeefbf5` |
| 213fbcc7 | Fátima Nampula | Engenharia Informática - 2º Ano | Programação Paralela | PENDING | — | `213fbcc7-1147-4e5b-b167-36a4533263a1` |
| 079acd91 | Gabriel Beira | Engenharia Informática - 2º Ano | Programação Paralela | PENDING | — | `079acd91-3efd-4acb-bbbc-6edfc8ccfd56` |
| 7efcaefb | Helena Tete | Engenharia Informática - 2º Ano | Programação Paralela | PENDING | — | `7efcaefb-0946-47ba-9766-6b0e824191b0` |
| 30b56ddf | Ivan Sofala | Engenharia Informática - 2º Ano | Programação Paralela | PENDING | — | `30b56ddf-3f9e-4396-bcf5-1bcb26fab1de` |
| 23b5cbef | Julia Zambezia | Engenharia Informática - 2º Ano | Programação Paralela | PENDING | — | `23b5cbef-2286-4775-afc9-1f4eacd72f1f` |
| fb95394a | Ana JAC | Engenharia Informática - 3º Ano | PTP 3 | PENDING | — | `fb95394a-f9ba-4603-9ede-c66dd6e76d79` |
| f36c7a37 | Berto Catarina | Engenharia Informática - 3º Ano | PTP 3 | PENDING | — | `f36c7a37-0416-4631-ad99-71f233b46733` |
| 330565fe | Carlos UC | Engenharia Informática - 3º Ano | PTP 3 | PENDING | — | `330565fe-5286-474c-a9cc-32e0af262d25` |
| 72af3bca | Diana Maputo | Engenharia Informática - 3º Ano | PTP 3 | PENDING | — | `72af3bca-2e94-4e5a-aab7-6969dcfcb67c` |
| 4a0e3f29 | Eduardo Matola | Engenharia Informática - 3º Ano | PTP 3 | PENDING | — | `4a0e3f29-77cc-4cb0-891e-8ee6f006c2c9` |
| 5be3dfcf | Fátima Nampula | Engenharia Informática - 3º Ano | PTP 3 | PENDING | — | `5be3dfcf-69d7-4869-b157-9c24c9ed6d03` |
| d08bc9bb | Gabriel Beira | Engenharia Informática - 3º Ano | PTP 3 | PENDING | — | `d08bc9bb-49e4-4aec-a924-94351595106d` |
| 711b3858 | Helena Tete | Engenharia Informática - 3º Ano | PTP 3 | PENDING | — | `711b3858-aedd-4793-a048-db2883107277` |
| 0447a31d | Ivan Sofala | Engenharia Informática - 3º Ano | PTP 3 | PENDING | — | `0447a31d-3143-4ce7-9393-9af3bb689539` |
| 21f936b2 | Julia Zambezia | Engenharia Informática - 3º Ano | PTP 3 | PENDING | — | `21f936b2-6267-43a2-808d-6c152c2613aa` |
| 2f1fb5c7 | Ana JAC | Engenharia Informática - 3º Ano | Administração de Redes | PENDING | — | `2f1fb5c7-fc97-4bd9-99a6-9cbc3a8da91d` |
| 2b16319f | Berto Catarina | Engenharia Informática - 3º Ano | Administração de Redes | PENDING | — | `2b16319f-54ee-4979-bb9f-9ea6eaa10837` |
| d35269f0 | Carlos UC | Engenharia Informática - 3º Ano | Administração de Redes | PENDING | — | `d35269f0-32a8-4ea6-a2c8-3358fcf9878b` |
| 1c23313d | Diana Maputo | Engenharia Informática - 3º Ano | Administração de Redes | PENDING | — | `1c23313d-5858-48e3-ae93-66187458b24c` |
| b26f5b78 | Eduardo Matola | Engenharia Informática - 3º Ano | Administração de Redes | PENDING | — | `b26f5b78-5818-43d1-ba0f-77ed9ed338b3` |
| 4c949465 | Fátima Nampula | Engenharia Informática - 3º Ano | Administração de Redes | PENDING | — | `4c949465-20a9-41fd-8e93-5ae8f013188a` |
| f06f0323 | Gabriel Beira | Engenharia Informática - 3º Ano | Administração de Redes | PENDING | — | `f06f0323-20ce-4352-98f3-03bab1fd2459` |
| 26320a73 | Helena Tete | Engenharia Informática - 3º Ano | Administração de Redes | PENDING | — | `26320a73-4d42-4984-afa2-1255b01aa904` |
| d17cd149 | Ivan Sofala | Engenharia Informática - 3º Ano | Administração de Redes | PENDING | — | `d17cd149-19ca-4713-b368-7e023490a084` |
| 1a726cb3 | Julia Zambezia | Engenharia Informática - 3º Ano | Administração de Redes | PENDING | — | `1a726cb3-86d7-4e02-803a-180a745c893a` |
| c561992a | Ana JAC | Engenharia Informática - 3º Ano | Programação Paralela | PENDING | — | `c561992a-cd64-4672-a44d-b06b43e0aec6` |
| 8fa013a9 | Berto Catarina | Engenharia Informática - 3º Ano | Programação Paralela | PENDING | — | `8fa013a9-c311-4e68-969c-1a5a00fc2508` |
| 966fa57d | Carlos UC | Engenharia Informática - 3º Ano | Programação Paralela | PENDING | — | `966fa57d-655a-45ab-8555-0dcb3102aac8` |
| 4dada16a | Diana Maputo | Engenharia Informática - 3º Ano | Programação Paralela | PENDING | — | `4dada16a-c17c-48cc-86d5-2edf7d29fb2c` |
| 9a121bcf | Eduardo Matola | Engenharia Informática - 3º Ano | Programação Paralela | PENDING | — | `9a121bcf-7ce6-4268-a550-a2461df77ef3` |
| 1ee8fed1 | Fátima Nampula | Engenharia Informática - 3º Ano | Programação Paralela | PENDING | — | `1ee8fed1-42b1-43da-93a0-1a6f2560865c` |
| 92d33c19 | Gabriel Beira | Engenharia Informática - 3º Ano | Programação Paralela | PENDING | — | `92d33c19-18dc-4499-9dbb-eeed2f342788` |
| 183fbc6f | Helena Tete | Engenharia Informática - 3º Ano | Programação Paralela | PENDING | — | `183fbc6f-63ed-4829-961c-1332c07c69aa` |
| 91120090 | Ivan Sofala | Engenharia Informática - 3º Ano | Programação Paralela | PENDING | — | `91120090-a233-4e42-8f68-d3b501d3307e` |
| 696297c4 | Julia Zambezia | Engenharia Informática - 3º Ano | Programação Paralela | PENDING | — | `696297c4-1fcf-4a00-9e6d-8e30f282b438` |
| cc13a08e | Berto Catarina | Engenharia Informática - 1º Ano | PTP 3 | IN_PROGRESS | 5 | `cc13a08e-27ee-4e84-a0dc-efc351de2e19` |
| 46a0d23c | Julia Zambezia | Engenharia Informática - 1º Ano | PTP 3 | IN_PROGRESS | 12 | `46a0d23c-e375-4141-8da8-2ebacde5519a` |
| d31c010b | Carlos UC | Engenharia Informática - 1º Ano | PTP 3 | IN_PROGRESS | 16 | `d31c010b-7643-4186-91a7-2076affb229b` |
| 4eed4745 | Diana Maputo | Engenharia Informática - 1º Ano | PTP 3 | IN_PROGRESS | 18 | `4eed4745-5148-4fb9-a215-5ae9f1d14e00` |
| ec1061fd | Eduardo Matola | Engenharia Informática - 1º Ano | PTP 3 | IN_PROGRESS | 3 | `ec1061fd-3f44-4dcc-8936-f01a5c9c9fa1` |
| a4bd7df2 | Fátima Nampula | Engenharia Informática - 1º Ano | PTP 3 | IN_PROGRESS | 5 | `a4bd7df2-521d-4a81-acdd-e526480b0eaf` |
| f473a725 | Gabriel Beira | Engenharia Informática - 1º Ano | PTP 3 | IN_PROGRESS | 14 | `f473a725-9c46-4ec8-a7f6-8a9283e7546e` |
| e3ff35e5 | Helena Tete | Engenharia Informática - 1º Ano | PTP 3 | IN_PROGRESS | 12 | `e3ff35e5-4d10-4eef-b5c0-ba1ab604c341` |
| ed0feeb9 | Ivan Sofala | Engenharia Informática - 1º Ano | PTP 3 | IN_PROGRESS | 17 | `ed0feeb9-6402-4dc8-b2a7-b978d93cacc8` |

---

> Ficheiro gerado automaticamente. Para regenerar: `npx tsx scripts/generate-uuid-docs.ts`