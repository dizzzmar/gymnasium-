---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# Surface brief: index.html (reserva de sala)

Scope and mode: Operate. Una sola pantalla, móvil primero. Task: reservar la sala, ver cuándo está libre, cancelar con PIN.

Audience and job: vecinos, sin cuenta, desde el móvil. Reservar en menos de un minuto. Admin cancela cualquiera.

Constraints: solo español; solo nombre y horas visibles; sin datos personales; datos de ejemplo (maqueta); ningún PIN real ni clave en el código.

Unresolved: base de datos (Supabase o Firebase); el PIN de admin real se validará en servidor.

## Direction contract

THESIS: La sala se lee como un cartel de gimnasio nocturno: un estado enorme y ancho (LIBRE / OCUPADA) manda sobre todo, y el calendario es una tira de 24 h por día, no una rejilla de tarjetas. Rechaza el calendario mensual de panel de administración.

OWN-WORLD: Negro casi puro (#0a0a0b), superficies un punto más claras, filetes finos grises, un único rojo granate (#d11a38) para ocupado y acción principal. Titulares en Anybody ancho y pesado en mayúsculas; texto en Archivo. Botones planos, cuadrados, sin sombras. Etiquetas en mayúsculas con espaciado. Inspiración declarada: la estética de kxu.co.uk, sin su logotipo, textos, fotos ni tipografía de pago.

STORY: El vecino ve al instante si la sala está libre, rellena nombre, inicio, fin y PIN, recibe confirmación con su PIN y ve su bloque rojo en la tira del día. Para cancelar, escribe el PIN en la propia fila.

FIRST VIEWPORT: Móvil: cabecera mínima, estado gigante (LIBRE / OCUPADA) con la siguiente franja debajo, y justo después el formulario con el botón rojo RESERVAR. Escritorio: estado a todo el ancho arriba; debajo, formulario fijo a la izquierda (~400 px) y a la derecha los próximos 7 días como tiras de 24 h con sus reservas en lista.

FORM: Pinned por el usuario: "esta estética" (https://www.kxu.co.uk). seed: none (pinned)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
