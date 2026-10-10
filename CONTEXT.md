# Cronograma

Site para acompanhar em tempo real a programação de um Evento, com as Atividades dispostas numa linha do tempo vertical.

## Language

**Evento**:
O acontecimento como um todo (ex.: um congresso), que pode durar um ou mais Dias.
_Avoid_: programação, agenda

**Atividade**:
Item da programação, com início, fim, nome, local e detalhes, que aparece como um card na linha do tempo.
_Avoid_: evento, sessão, item

**Palestrante**:
Pessoa que apresenta ou conduz o conteúdo de uma Atividade. Opcional.

**Responsável**:
Pessoa que coordena a Atividade nos bastidores e responde por ela. Opcional; pode ser diferente do Palestrante.
_Avoid_: organizador, coordenador

**Estado da Atividade**:
Situação de uma Atividade em relação ao horário atual: **futura** (ainda não começou), **em andamento** (já começou e não terminou) ou **encerrada** (já terminou). Toda Atividade tem início e fim; um marco pontual é uma Atividade de curta duração.

**Dia**:
Uma data do Evento. A linha do tempo mostra um Dia por vez.

**Fuso do Evento**:
O fuso horário em que todos os horários do Evento são expressos e exibidos, independentemente do fuso do aparelho de quem acessa.

**Linha do agora**:
Marcador horizontal que indica o horário atual na linha do tempo do Dia.

## Relationships

- Um **Evento** tem um ou mais **Dias**
- Um **Dia** tem zero ou mais **Atividades**
- Uma **Atividade** pertence ao **Dia** em que começa, mesmo que termine depois da meia-noite
- **Atividades** podem se sobrepor no tempo; nesse caso aparecem lado a lado

## Example dialogue

> **Dev:** "Quando a **Linha do agora** passa do fim de uma **Atividade**, ela some?"
> **Organizador:** "Não, a **Atividade** continua lá, só que com cor sem destaque."
