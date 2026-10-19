'use client';

import { useId, useMemo, useState, type KeyboardEvent, type Ref } from 'react';
import { UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useCaja } from '@/lib/caja-store';
import { NuevoCliente } from '@/components/ClienteForms';
import { nombreCliente } from '@/lib/customers';

export interface ClienteElegido {
  id: string | null;
  nombre: string;
}

/**
 * B3 — Combobox de cliente de la planilla. Resuelve siempre a un `clienteId`:
 * busca entre los clientes cargados y, si no hay coincidencia, ofrece
 * "Crear cliente «…»" (POST /customers, el mismo alta de C3) sin salir de la
 * planilla. Un texto que no resuelve a un cliente queda con `id: null` y el
 * store rechaza la operación con un error visible (B1).
 */
export function ClientePicker({ value, onChange, inputRef, placeholder = 'cliente', autoFocus }: {
  value: ClienteElegido;
  onChange: (v: ClienteElegido) => void;
  inputRef?: Ref<HTMLInputElement>;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const { state, dispatch } = useCaja();
  const { user } = useAuth();
  const puedeCrear = !!user?.roles.includes('ADMIN');
  const listId = useId();
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [creando, setCreando] = useState(false);

  const texto = value.nombre.trim().toLowerCase();
  const coincidencias = useMemo(() => {
    if (!texto) return state.clientes.slice(0, 8);
    return state.clientes.filter((c) => c.nombre.toLowerCase().includes(texto)).slice(0, 8);
  }, [state.clientes, texto]);
  const exacta = state.clientes.find((c) => c.nombre.toLowerCase() === texto);
  const ofrecerCrear = !!texto && !exacta;
  const opciones = coincidencias.length + (ofrecerCrear ? 1 : 0);

  function elegir(i: number) {
    if (i < coincidencias.length) {
      const c = coincidencias[i];
      onChange({ id: c.id, nombre: c.nombre });
    } else if (puedeCrear) {
      setCreando(true);
    }
    setAbierto(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!abierto || opciones === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((a) => (a + 1) % opciones); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((a) => (a - 1 + opciones) % opciones); }
    else if (e.key === 'Enter' && !value.id) {
      // Con la lista abierta, Enter elige; no confirma la fila todavía.
      e.preventDefault();
      e.stopPropagation();
      elegir(activo);
    } else if (e.key === 'Escape') { setAbierto(false); }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        className="input-inline input-inline-text"
        placeholder={placeholder}
        value={value.nombre}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={abierto && opciones > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={!!value.nombre.trim() && !value.id}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 120)}
        onChange={(e) => {
          const nombre = e.target.value;
          const match = state.clientes.find((c) => c.nombre.toLowerCase() === nombre.trim().toLowerCase());
          onChange({ id: match?.id ?? null, nombre });
          setActivo(0);
          setAbierto(true);
        }}
        onKeyDown={onKeyDown}
      />
      {abierto && opciones > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="card absolute z-40 left-0 mt-1 p-1 flex flex-col"
          style={{ minWidth: 220, maxHeight: 260, overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}
        >
          {coincidencias.map((c, i) => (
            <li
              key={c.id}
              role="option"
              aria-selected={i === activo}
              className="px-2.5 py-1.5 rounded-md cursor-pointer text-[13.5px]"
              style={{ background: i === activo ? 'var(--accent-subtle)' : undefined }}
              onMouseDown={(e) => { e.preventDefault(); elegir(i); }}
              onMouseEnter={() => setActivo(i)}
            >
              {c.nombre}
              {c.doc && <span className="caption ml-1.5" style={{ color: 'var(--warm-gray-3)' }}>{c.doc}</span>}
            </li>
          ))}
          {ofrecerCrear && (
            <li
              role="option"
              aria-selected={activo === coincidencias.length}
              className="px-2.5 py-1.5 rounded-md text-[13.5px] flex items-center gap-1.5"
              style={{
                background: activo === coincidencias.length ? 'var(--accent-subtle)' : undefined,
                cursor: puedeCrear ? 'pointer' : 'default',
                color: puedeCrear ? 'var(--accent)' : 'var(--warm-gray-3)',
              }}
              onMouseDown={(e) => { e.preventDefault(); elegir(coincidencias.length); }}
              onMouseEnter={() => setActivo(coincidencias.length)}
            >
              <UserPlus className="w-3.5 h-3.5" />
              {puedeCrear ? `Crear cliente «${value.nombre.trim()}»` : 'Cliente inexistente: lo tiene que dar de alta un admin'}
            </li>
          )}
        </ul>
      )}
      {creando && (
        <NuevoCliente
          nombreInicial={value.nombre.trim()}
          onCerrar={() => setCreando(false)}
          onCreado={(c) => {
            setCreando(false);
            dispatch({ type: 'ADD_CLIENTE', cliente: { id: c.id, nombre: nombreCliente(c), doc: c.doc ?? '' } });
            onChange({ id: c.id, nombre: nombreCliente(c) });
          }}
        />
      )}
    </div>
  );
}
