# Escuela de Natación — Cruz Roja Mexicana, Delegación Cancún

Control de mensualidades, folios con código QR, lockers y cobranza.

## Qué resuelve

Cada alumno tiene un **folio anual** (`CRM-2026-0042`) y un **código QR**. Al
escanearlo, el alumno ve su estado de cuenta y un profesor ve un semáforo que
dice si puede pasar a la alberca. Capturista ve la cobranza del mes.

## Requisitos

- Node.js 22 o superior
- Docker (solo para la base de datos local)

## Arranque

```bash
docker compose up -d      # PostgreSQL en el puerto 5433
npm install
npx prisma migrate deploy # crea las tablas
npm run db:seed           # usuarios, periodos, tarifas, lockers y datos de ejemplo
npm run dev               # http://localhost:3000
```

## El primer usuario

No hay usuarios escritos en el código. El seeder crea **un administrador** con
lo que digan estas variables del `.env`:

```
ADMIN_EMAIL="tu-correo@ejemplo.com"
ADMIN_PASSWORD="una contraseña larga"
ADMIN_NOMBRE="Tu nombre"
```

Sin ellas no crea ninguna cuenta y te avisa al terminar. Los demás usuarios
—capturistas y profesores— se dan de alta desde **Panel de control →
Usuarios**, ya con la sesión iniciada.

Una contraseña escrita en el código queda a la vista de cualquiera que lea el
repositorio, y esta cuenta puede todo dentro del sistema. Por eso vive en el
`.env`, que nunca se sube.

También hace falta un `SESSION_SECRET` propio antes de publicar el sistema.

## Rutas

| Ruta | Quién entra | Para qué |
|---|---|---|
| `/acceso` | Personal | Iniciar sesión |
| `/panel` | Administrador, Capturista | Cobranza del mes |
| `/panel/alumnos` | Administrador, Capturista | Padrón y alta |
| `/panel/alumnos/{id}/credencial` | Administrador, Capturista | Credencial con QR para imprimir |
| `/panel/pagos` | Administrador, Capturista | Registrar pagos |
| `/panel/lockers` | Administrador, Capturista | Ocupación y asignación |
| `/profesor` | Profesor | Escanear QR y ver el semáforo |
| `/q/{token}` | Alumno | Su estado de cuenta. **Sin contraseña** |

## Reglas de negocio

- **Un solo periodo mensual** para todos, con fecha límite al **5.º día hábil**
  del mes, descontando fines de semana y festivos.
- **Recargo de $50** al pasar la fecha límite. Configurable por periodo.
- **La deuda no se arrastra:** cada mes nace limpio. Un mes impago queda
  marcado en el historial pero no afecta al siguiente.
- **Tarifas por categoría** (Niños / General), con precio propio por mes y año.
- **Descuentos** (INAPAM, beca) sobre la mensualidad, nunca sobre los lockers.
- **Comisión trasladada:** el cobro en línea se calcula hacia atrás para que la
  delegación reciba su neto completo. Se presenta como precio por método, no
  como recargo por tarjeta.
- **Quien sube comprobante a tiempo no paga recargo** aunque Capturista tarde en
  validarlo.

## Notas técnicas

- **Los montos se guardan en centavos**, como enteros. Nunca decimales.
- La zona horaria es `America/Cancun`, sin horario de verano.
- La lógica de negocio vive en `src/lib/` sin tocar base de datos ni React, y
  se prueba directamente con Vitest.
- El código del cliente Prisma se genera en `npm install`, y antes de
  `dev`, `build` y `test`.

## Pruebas

```bash
npm test
```

## Lo que falta (fases siguientes)

- Stripe: tarjeta, SPEI y OXXO, con webhooks firmados y corte de OXXO
- Subida de comprobantes por el alumno, con bandeja de validación
- Solicitudes de facturación con su estatus
- Reportes exportables a CSV
- Asistencia

Diseño completo en `docs/superpowers/specs/`, plan en `docs/superpowers/plans/`.
