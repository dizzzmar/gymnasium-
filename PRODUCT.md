# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: HTML/CSS/JS estático (sin framework ni build). La página no necesita más y es fácil de alojar gratis y de conectar después a una base de datos.

## Users

Vecinos de una comunidad que reservan la única sala del gimnasio comunitario. Lo usan sobre todo desde el móvil, sin cuenta de usuario. Hay además un administrador (el promotor del proyecto) que puede cancelar cualquier reserva.

## Product Purpose

Reservar la sala del gimnasio comunitario en cualquier momento, siempre que no esté ocupada, y ver de un vistazo cuándo está libre. Éxito: un vecino reserva en menos de un minuto y nunca hay dos reservas solapadas.

## Positioning

Una sola sala compartida por vecinos, sin cuentas ni datos personales: se reserva con un nombre y se cancela con un PIN.

## Operating Context

- Reserva con nombre, fecha y hora de inicio, fecha y hora de fin, y un PIN de 4 cifras que elige el vecino.
- Sin horario de apertura ni duración máxima. Una reserva puede cruzar la medianoche.
- Solo se bloquea por solape con otra reserva o por inicio en el pasado.
- El vecino cancela su reserva con su PIN. El administrador cancela cualquiera con el PIN de admin.
- Los demás ven solo nombre y horas. No se recoge piso ni otros datos personales.

## Capabilities and Constraints

- Solo español.
- Persistencia compartida entre vecinos: base de datos gratuita en la nube (Supabase o Firebase), aún sin decidir. La maqueta usa datos de ejemplo.
- Ninguna clave, token ni PIN de admin en el código ni en el repositorio.
- Sin cuentas de usuario.

## Brand Commitments

Referencia visual indicada por el usuario: https://www.kxu.co.uk (estética oscura de gimnasio). Se toma como inspiración, no como copia: ni logotipo, ni textos, ni imágenes ni tipografías de pago de KXU.

## Evidence on Hand

Sin contenido real todavía: no hay nombre del gimnasio ni de la comunidad, ni logotipo, ni fotos. No se deben inventar.

## Product Principles

- Una acción principal: reservar. Todo lo demás es secundario.
- Mostrar claramente qué está ocupado y qué libre.
- Privacidad por defecto: solo nombre y horas.
- Que no se pueda cancelar la reserva de otro sin su PIN.
- Pensado primero para el móvil.
