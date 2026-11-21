-- Reserva de sala comunitaria: esquema para Supabase (PostgreSQL).
-- Ejecutar UNA vez en Supabase > SQL Editor. No contiene claves ni PIN reales.
--
-- Seguridad:
--  * Las tablas tienen RLS activado y NINGUNA política: el navegador no puede leerlas
--    ni escribirlas directamente. Solo puede llamar a las 4 funciones del final.
--  * Los PIN se guardan cifrados (bcrypt) y se comprueban en el servidor.
--  * 5 PIN erróneos bloquean 15 minutos (4 cifras se podrían adivinar sin este límite).
--  * La base de datos impide solapes con una restricción de exclusión.

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tablas ----------
create table public.bookings (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(btrim(name)) between 1 and 40),
  during          tstzrange not null check (not isempty(during) and lower(during) < upper(during)),
  pin_hash        text not null,
  failed_attempts int not null default 0,
  locked_until    timestamptz,
  created_at      timestamptz not null default now(),
  constraint no_overlap exclude using gist (during with &&)
);
alter table public.bookings enable row level security;

-- Una sola fila con el PIN de administrador cifrado.
create table public.admin_config (
  id              boolean primary key default true check (id),
  pin_hash        text not null,
  failed_attempts int not null default 0,
  locked_until    timestamptz
);
alter table public.admin_config enable row level security;

revoke all on public.bookings, public.admin_config from anon, authenticated;

-- ---------- Funciones (únicas puertas de entrada) ----------

-- Lista las reservas que aún no han terminado. Nunca devuelve PIN.
create or replace function public.list_bookings()
returns table (id uuid, name text, start_at timestamptz, end_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select b.id, b.name, lower(b.during), upper(b.during)
  from bookings b
  where upper(b.during) > now()
  order by lower(b.during);
$$;

-- Crea una reserva. Errores: datos_invalidos, inicio_pasado, solape, demasiadas_reservas.
create or replace function public.create_booking(p_name text, p_start timestamptz, p_end timestamptz, p_pin text)
returns uuid
language plpgsql volatile security definer set search_path = public, extensions
as $$
declare new_id uuid;
begin
  if p_name is null or char_length(btrim(p_name)) not between 1 and 40
     or p_start is null or p_end is null or p_end <= p_start
     or p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception 'datos_invalidos' using errcode = 'P0001';
  end if;
  if p_start < date_trunc('minute', now()) then
    raise exception 'inicio_pasado' using errcode = 'P0001';
  end if;
  -- Freno anti-spam (propuesta, se puede quitar): máx. 5 reservas futuras por nombre.
  if (select count(*) from bookings
      where lower(btrim(name)) = lower(btrim(p_name)) and upper(during) > now()) >= 5 then
    raise exception 'demasiadas_reservas' using errcode = 'P0001';
  end if;
  insert into bookings (name, during, pin_hash)
  values (btrim(p_name), tstzrange(p_start, p_end, '[)'), crypt(p_pin, gen_salt('bf')))
  returning id into new_id;
  return new_id;
exception when exclusion_violation then
  raise exception 'solape' using errcode = 'P0001';
end;
$$;

-- Cancela con el PIN de la reserva.
-- Devuelve 'ok', 'pin_incorrecto', 'bloqueado' o 'no_existe'. No lanza error para un PIN malo,
-- porque un error revertiría el contador de intentos fallidos.
create or replace function public.cancel_booking(p_id uuid, p_pin text)
returns text
language plpgsql volatile security definer set search_path = public, extensions
as $$
declare b bookings;
begin
  select * into b from bookings where id = p_id for update;
  if not found then return 'no_existe'; end if;
  if b.locked_until is not null and b.locked_until > now() then return 'bloqueado'; end if;

  if p_pin is not null and b.pin_hash = crypt(p_pin, b.pin_hash) then
    delete from bookings where id = p_id;
    return 'ok';
  end if;

  update bookings
    set failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end,
        locked_until   = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' end
    where id = p_id;
  return 'pin_incorrecto';
end;
$$;

-- Cancela cualquier reserva con el PIN de administrador (bloqueo propio, separado del de los vecinos,
-- para que nadie pueda dejar fuera al administrador equivocándose a propósito en una reserva).
-- Devuelve 'ok', 'pin_incorrecto', 'bloqueado', 'no_existe' o 'sin_admin'.
create or replace function public.admin_cancel_booking(p_id uuid, p_pin text)
returns text
language plpgsql volatile security definer set search_path = public, extensions
as $$
declare a admin_config;
begin
  select * into a from admin_config for update;
  if not found then return 'sin_admin'; end if;
  if a.locked_until is not null and a.locked_until > now() then return 'bloqueado'; end if;

  if p_pin is not null and a.pin_hash = crypt(p_pin, a.pin_hash) then
    update admin_config set failed_attempts = 0, locked_until = null;
    delete from bookings where id = p_id;
    if not found then return 'no_existe'; end if;
    return 'ok';
  end if;

  update admin_config
    set failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end,
        locked_until   = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' end;
  return 'pin_incorrecto';
end;
$$;

revoke all on function public.list_bookings(), public.create_booking(text, timestamptz, timestamptz, text),
  public.cancel_booking(uuid, text), public.admin_cancel_booking(uuid, text) from public;
grant execute on function public.list_bookings(), public.create_booking(text, timestamptz, timestamptz, text),
  public.cancel_booking(uuid, text), public.admin_cancel_booking(uuid, text) to anon;

-- ---------- PIN de administrador (NO guardar este paso en el repositorio) ----------
-- Ejecútalo tú directamente en el SQL Editor, cambiando el texto entre comillas por tu PIN:
--   insert into public.admin_config (pin_hash) values (extensions.crypt('TU_PIN_AQUI', extensions.gen_salt('bf')));
-- Para cambiarlo más adelante:
--   update public.admin_config set pin_hash = extensions.crypt('NUEVO_PIN', extensions.gen_salt('bf'));
