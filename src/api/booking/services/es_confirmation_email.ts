import { sendEmail } from './send_email';

interface Visitor {
  visitor_type: string; // 'LOCAL' | 'FOREIGNER'
  age_group: string;
  quantity: number;
}

interface BookingEmailData {
  tour_title: string;
  is_guided: boolean;
  customer_email: string;
  customer_complete_name: string;
  code: string;
  date?: string;
  time?: string;
  visitors: Visitor[];
  total_price?: string;
}

// Etiquetas legibles para cada grupo de edad (locales y extranjeros)
const AGE_LABELS: Record<string, string> = {
  // Nacionales / residentes
  ADULT_OR_YOUTH_13_64: 'Adultos (13 - 64 años)',
  SENIOR_65_PLUS: 'Adultos mayores (65+ años)',
  CHILD_4_12: 'Niños (4 - 12 años)',
  CHILD_0_3: 'Infantes (0 - 3 años)',
  // Extranjeros
  ADULT: 'Adultos (13 - 64 años)',
  SENIOR: 'Adultos mayores (65+ años)',
  CHILD: 'Niños (4 - 12 años)',
  INFANT: 'Infantes (0 - 3 años)',
};

// Evita que texto del cliente rompa o inyecte HTML en el correo
const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// "2026-11-12" -> "12 de noviembre de 2026"
const formatDate = (value?: string): string => {
  if (!value) return '-';
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return value;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toLocaleDateString('es-CR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

// "15:45:00.000" -> "3:45 pm"
const formatTime = (value?: string): string => {
  if (!value) return '-';
  const m = value.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return value;
  const hours = parseInt(m[1], 10);
  const suffix = hours >= 12 ? 'pm' : 'am';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${m[2]} ${suffix}`;
};

// Suma las cantidades por grupo de edad para un tipo de visitante
const groupByAge = (visitors: Visitor[], type: string) => {
  const totals = new Map<string, number>();
  visitors
    .filter((v) => v.visitor_type === type && v.quantity > 0)
    .forEach((v) => {
      totals.set(v.age_group, (totals.get(v.age_group) ?? 0) + v.quantity);
    });
  return Array.from(totals, ([ageGroup, quantity]) => ({ ageGroup, quantity }));
};

// Bloque HTML con la tabla de un tipo de visitante (vacío si no hay ninguno)
const renderGroup = (
  title: string,
  rows: { ageGroup: string; quantity: number }[]
): string => {
  if (rows.length === 0) return '';

  const subtotal = rows.reduce((acc, r) => acc + r.quantity, 0);

  const body = rows
    .map(
      (r) => `
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;">
            ${escapeHtml(AGE_LABELS[r.ageGroup] ?? r.ageGroup)}
          </td>
          <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:bold;">
            ${r.quantity}
          </td>
        </tr>`
    )
    .join('');

  return `
    <h3 style="margin:20px 0 6px;font-size:15px;color:#0f172a;">${escapeHtml(title)}</h3>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;color:#334155;">
      ${body}
      <tr>
        <td style="padding:8px 0;font-weight:bold;">Subtotal</td>
        <td style="padding:8px 0;text-align:right;font-weight:bold;">${subtotal}</td>
      </tr>
    </table>`;
};

export const sendEsConfirmationEmail = async (bookingData: BookingEmailData) => {
  const {
    tour_title,
    is_guided,
    customer_email,
    customer_complete_name,
    code,
    date,
    time,
    visitors,
    total_price,
  } = bookingData;

  const nationals = groupByAge(visitors, 'LOCAL');
  const foreigners = groupByAge(visitors, 'FOREIGNER');
  const totalPeople = [...nationals, ...foreigners].reduce((acc, r) => acc + r.quantity, 0);

  await sendEmail({
    to: customer_email,
    subject: `Confirmación de su reserva en Santuario del Agua (${code})`,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#334155;line-height:1.5;">

        <h2 style="margin:0 0 12px;font-size:18px;color:#0f172a;">Confirmación de reserva</h2>
        <p style="margin:0 0 12px;font-size:15px;color:#334155;">${is_guided ? 'Tour/Actividad con guía' : 'Tour/Actividad'}: <strong>${escapeHtml(tour_title)}</strong></p>

        <p>Estimado/a ${escapeHtml(customer_complete_name)},</p>
        <p>Su reserva ha sido confirmada.</p>

        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;margin:12px 0;">
          <tr>
            <td style="padding:4px 0;color:#64748b;">Código de reserva</td>
            <td style="padding:4px 0;text-align:right;font-weight:bold;">${escapeHtml(code)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#64748b;">Fecha</td>
            <td style="padding:4px 0;text-align:right;font-weight:bold;">${escapeHtml(formatDate(date))}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#64748b;">Hora</td>
            <td style="padding:4px 0;text-align:right;font-weight:bold;">${escapeHtml(formatTime(time))}</td>
          </tr>
        </table>

        ${renderGroup('Nacionales / Residentes', nationals)}
        ${renderGroup('Extranjeros', foreigners)}

        <p style="margin:20px 0 0;font-size:15px;">
          <strong>Total de personas: ${totalPeople}</strong>
        </p>

        <p style="margin:4px 0 0;font-size:15px;">
          <strong>Precio total: CRC ${escapeHtml(total_price ?? '0.00')}</strong>
        </p>

        <p style="margin-top:24px;">¡Gracias por elegir Santuario del Agua!</p>
      </div>
    `,
  });
};