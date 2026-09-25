'use client';

import { User, Mail, Phone, Calendar, MapPin, Shield } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Badge } from '@/components/ui';
import { Avatar } from '@/components/ui';

const cadeteInfo = {
  name: 'Carlos Aguilera',
  mail: 'carlos.aguilera@oficina-fusion.com',
  phone: '+54 11 5555-0123',
  role: 'Cadete',
  startDate: '2026-01-15',
  office: 'Sede Centro',
  license: 'Lic. CBU-0042',
};

export default function ProfilePage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--warm-gray-1)]">Mi Perfil</h1>
        <p className="text-sm text-[var(--warm-gray-2)] mt-1">Información personal y datos de cuenta</p>
      </div>

      {/* Profile card */}
      <div className="card rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
        <div className="px-6 py-5 border-b border-[var(--warm-gray-5)]">
          <div className="flex items-center gap-4">
            <Avatar initials="CA" status="online" size="lg" />
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-[var(--warm-gray-1)]">
                  {cadeteInfo.name}
                </h2>
                <Badge variant="blue">
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    {cadeteInfo.role}
                  </span>
                </Badge>
              </div>
              <p className="text-sm text-[var(--warm-gray-2)] mt-1">{cadeteInfo.office}</p>
            </div>
          </div>
        </div>

        <div className="p-6 grid grid-2 gap-6">
          {/* Personal info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-[var(--warm-gray-2)] uppercase tracking-wide">Datos Personales</h3>

            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-[var(--warm-gray-3)] shrink-0" />
              <div>
                <p className="text-xs text-[var(--warm-gray-3)]">Email</p>
                <p className="text-sm text-[var(--warm-gray-1)]">{cadeteInfo.mail}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-[var(--warm-gray-3)] shrink-0" />
              <div>
                <p className="text-xs text-[var(--warm-gray-3)]">Teléfono</p>
                <p className="text-sm text-[var(--warm-gray-1)]">{cadeteInfo.phone}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-[var(--warm-gray-3)] shrink-0" />
              <div>
                <p className="text-xs text-[var(--warm-gray-3)]">Licencia</p>
                <p className="text-sm text-[var(--warm-gray-1)] font-mono">{cadeteInfo.license}</p>
              </div>
            </div>
          </div>

          {/* Account info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-[var(--warm-gray-2)] uppercase tracking-wide">Cuenta</h3>

            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-[var(--warm-gray-3)] shrink-0" />
              <div>
                <p className="text-xs text-[var(--warm-gray-3)]">Alta</p>
                <p className="text-sm text-[var(--warm-gray-1)]">15 de enero de 2026</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-[var(--warm-gray-3)] shrink-0" />
              <div>
                <p className="text-xs text-[var(--warm-gray-3)]">Oficina</p>
                <p className="text-sm text-[var(--warm-gray-1)]">{cadeteInfo.office}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-3 gap-4">
        <div className="card p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
          <span className="text-sm text-[var(--warm-gray-2)]">Operaciones Realizadas</span>
          <p className="text-2xl font-bold text-[var(--warm-gray-1)] mt-1 tabular">47</p>
        </div>
        <div className="card p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
          <span className="text-sm text-[var(--warm-gray-2)]">E-Tickets Emitidos</span>
          <p className="text-2xl font-bold text-[var(--warm-gray-1)] mt-1 tabular">38</p>
        </div>
        <div className="card p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
          <span className="text-sm text-[var(--warm-gray-2)]">Tasa de Entrega</span>
          <p className="text-2xl font-bold text-[var(--warm-gray-1)] mt-1 tabular">96%</p>
        </div>
      </div>
    </div>
  );
}
