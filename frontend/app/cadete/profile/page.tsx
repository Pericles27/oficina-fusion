'use client';

import { useState } from 'react';
import { User, Mail, Phone, MapPin, Shield, Bell, Moon, Sun, LogOut, Award, TrendingUp } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { useTheme } from '@/app/providers';

const stats = [
  { label: 'Operaciones', value: 248, icon: TrendingUp },
  { label: 'E-Tickets', value: 186, icon: Award },
  { label: 'Días activo', value: 92, icon: User },
];

const info = [
  { icon: Mail, label: 'Email', value: 'carlos.perez@oficinafusion.com' },
  { icon: Phone, label: 'Teléfono', value: '+54 9 11 2345-6789' },
  { icon: MapPin, label: 'Sucursal', value: 'Casa Central — CABA' },
  { icon: Shield, label: 'Rol', value: 'Cadete' },
];

export default function ProfilePage() {
  const { theme, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="page animate-in">
      <header>
        <h1>Mi Perfil</h1>
        <p className="text-small m-0 mt-1" style={{ color: 'var(--warm-gray-2)' }}>
          Información personal y preferencias
        </p>
      </header>

      {/* Identidad */}
      <section className="card p-5 sm:p-6 flex flex-col xs:flex-row items-center xs:items-start gap-5 text-center xs:text-left">
        <Avatar initials="CP" size="xl" status="online" bordered />
        <div className="min-w-0 flex-1">
          <h2 className="heading-2">Carlos Pérez</h2>
          <p className="m-0 mt-0.5 text-small" style={{ color: 'var(--warm-gray-2)' }}>
            Cadete · Legajo #1042
          </p>
          <div className="flex flex-wrap gap-2 mt-3 justify-center xs:justify-start">
            <span className="badge badge-success">Activo</span>
            <span className="badge badge-blue">Verificado</span>
          </div>
        </div>
      </section>

      {/* Métricas */}
      <section className="grid-3">
        {stats.map((s) => (
          <article key={s.label} className="card stat-card">
            <div className="flex items-center justify-between gap-2">
              <span className="stat-label truncate">{s.label}</span>
              <s.icon className="w-[18px] h-[18px] shrink-0" style={{ color: 'var(--warm-gray-3)' }} />
            </div>
            <span className="stat-value">{s.value}</span>
          </article>
        ))}
      </section>

      {/* Datos */}
      <section className="card p-5">
        <span className="label">Información de contacto</span>
        <ul className="list-none p-0 m-0 mt-3 flex flex-col">
          {info.map((i, idx) => (
            <li key={i.label}
                className="flex items-start gap-3 py-3"
                style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border)' }}>
              <i.icon className="w-[18px] h-[18px] shrink-0 mt-0.5" style={{ color: 'var(--warm-gray-3)' }} />
              <div className="min-w-0">
                <p className="m-0 caption" style={{ color: 'var(--warm-gray-3)' }}>{i.label}</p>
                <p className="m-0 text-[14.5px] break-words">{i.value}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Preferencias */}
      <section className="card p-5">
        <span className="label">Preferencias</span>
        <div className="mt-3 flex flex-col">
          <Toggle
            icon={theme === 'dark' ? Moon : Sun}
            title="Tema oscuro"
            desc="Cambiar apariencia de la interfaz"
            checked={theme === 'dark'}
            onChange={toggleTheme}
            first
          />
          <Toggle
            icon={Bell}
            title="Notificaciones"
            desc="Alertas de nuevas operaciones"
            checked={notifications}
            onChange={() => setNotifications((n) => !n)}
          />
        </div>
      </section>

      <button className="btn btn-danger btn-full">
        <LogOut className="w-4 h-4" />
        Cerrar sesión
      </button>
    </div>
  );
}

function Toggle({
  icon: Icon, title, desc, checked, onChange, first = false,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
  first?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5"
         style={{ borderTop: first ? 'none' : '1px solid var(--border)' }}>
      <div className="flex items-start gap-3 min-w-0">
        <Icon className="w-[18px] h-[18px] shrink-0 mt-0.5" style={{ color: 'var(--warm-gray-3)' }} />
        <div className="min-w-0">
          <p className="m-0 text-[14.5px] font-medium">{title}</p>
          <p className="m-0 caption" style={{ color: 'var(--warm-gray-3)' }}>{desc}</p>
        </div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={onChange}
        className={`switch shrink-0 ${checked ? 'switch-on' : ''}`}
      >
        <span className="switch-thumb" />
      </button>
    </div>
  );
}
