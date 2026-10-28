import type { Core } from '@strapi/strapi';

// ---------- Tipos ----------
interface VisitorInput {
  visitor_type: string;
  age_group: string;
  quantity: number;
}

interface CreateFullBookingInput {
  code: string;
  total_amount: number;
  status_booking: string;
  customer_complete_name: string;
  customer_email: string;
  customer_phone: string;
  tourDocumentId: string;
  date?: string | null;
  time?: string | null;
  is_guided: boolean;
  local_visitors: VisitorInput[];
  foreigner_visitors: VisitorInput[];
  duration?: number | null;
}

interface FullBookingPayload {
  success: boolean;
  bookingDocumentId: string | null;
  error: string | null;
}

type ContentTypeUID =
  | 'api::booking.booking'
  | 'api::booking-tour.booking-tour'
  | 'api::visitor-detail.visitor-detail';

// ---------- Utilidades ----------

// "07:00:00.000" | "07:00" | "7:00" -> "07:00"
const toHHMM = (value?: string | null): string | null => {
  const m = String(value ?? '').match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
};

// Fecha/hora del tour en hora de Costa Rica (UTC-6, sin horario de verano)
const buildTourDate = (time?: string | null): string => {
  const hhmm = toHHMM(time);
  if (!hhmm) return new Date().toISOString();

  const todayCR = new Date(Date.now() - 6 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  return new Date(`${todayCR}T${hhmm}:00-06:00`).toISOString();
};

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Error desconocido';

// ---------- Extensión de GraphQL ----------
export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    strapi.log.info('>>> Registrando mutation createFullBooking');

    strapi
      .plugin('graphql')
      .service('extension')
      .use({
        typeDefs: `
          input VisitorInput {
            visitor_type: String!
            age_group: String!
            quantity: Int!
          }

          input CreateFullBookingInput {
            code: String!
            total_amount: Float!
            status_booking: String!
            customer_complete_name: String!
            customer_email: String!
            customer_phone: String!
            tourDocumentId: String!
            date: String
            time: String
            is_guided: Boolean!
            local_visitors: [VisitorInput!]!
            foreigner_visitors: [VisitorInput!]!
            duration: Int
          }

          type FullBookingPayload {
            success: Boolean!
            bookingDocumentId: String
            error: String
          }

          extend type Mutation {
            createFullBooking(data: CreateFullBookingInput!): FullBookingPayload!
          }
        `,

        resolvers: {
          Mutation: {
            createFullBooking: async (
              _parent: unknown,
              { data }: { data: CreateFullBookingInput }
            ): Promise<FullBookingPayload> => {
              // Registros creados, para deshacerlos si algo falla a mitad de camino
              const created: { uid: ContentTypeUID; documentId: string }[] = [];

              const create = async (
                uid: ContentTypeUID,
                payload: Record<string, unknown>
              ) => {
                // Cast a any: los tipos de documents() dependen de los tipos
                // generados por Strapi y se vuelven muy estrictos con UIDs dinámicos.
                const doc = await (strapi as any).documents(uid).create({
                  data: payload,
                  status: 'published',
                });
                created.push({ uid, documentId: doc.documentId });
                return doc as { documentId: string };
              };

              try {
                const localList = data.local_visitors ?? [];
                const foreignerList = data.foreigner_visitors ?? [];

                // Validaciones básicas
                const all = [...localList, ...foreignerList];
                if (all.some((v) => v.quantity < 0)) {
                  throw new Error('Las cantidades no pueden ser negativas');
                }

                const totalPax = all.reduce((acc, v) => acc + v.quantity, 0);
                if (totalPax === 0) {
                  throw new Error('La reserva debe incluir al menos 1 visitante');
                }

                // 1. Booking principal
                const booking = await create('api::booking.booking', {
                  code: data.code,
                  total_amount: data.total_amount,
                  status_booking: data.status_booking,
                  customer_complete_name: data.customer_complete_name,
                  customer_email: data.customer_email,
                  customer_phone: data.customer_phone,
                });

                console.log('data', data);

                // 2. BookingTour asociado
                const bookingTour = await create('api::booking-tour.booking-tour', {
                  booking: booking.documentId,
                  tour: data.tourDocumentId,
                  is_guided: data.is_guided,
                  date: data.date,
                  time:data.time,
                  pax_count: totalPax,
                  total_tour_amount: data.total_amount,
                  languague: 'es',
                  duration: data.duration ?? 0,
                  status_tour: 'PENDING',
                });

                // 3. Detalle de visitantes
                const allVisitors: VisitorInput[] = [
                  ...localList.map((v) => ({ ...v, visitor_type: 'LOCAL' })),
                  ...foreignerList.map((v) => ({ ...v, visitor_type: 'FOREIGNER' })),
                ];

                for (const v of allVisitors) {
                  console.log('>>> visitor', bookingTour.documentId, v.visitor_type, v.age_group, v.quantity);
                  if (v.quantity > 0) {
                    for (let i = 0; i < v.quantity; i++) {
                      await create('api::visitor-detail.visitor-detail', {
                        booking_tour: bookingTour.documentId,
                        visitor_type: v.visitor_type,
                        age_group: v.age_group,
                        // quantity: v.quantity,
                    
                    });
                  }}
                }

                return {
                  success: true,
                  bookingDocumentId: booking.documentId,
                  error: null,
                };
              } catch (err) {
                strapi.log.error(`Error en createFullBooking: ${errorMessage(err)}`);

                // Rollback: borra lo creado, de lo último a lo primero
                for (const item of [...created].reverse()) {
                  try {
                    await (strapi as any)
                      .documents(item.uid)
                      .delete({ documentId: item.documentId });
                  } catch (e) {
                    strapi.log.warn(
                      `No se pudo deshacer ${item.uid}: ${errorMessage(e)}`
                    );
                  }
                }

                return {
                  success: false,
                  bookingDocumentId: null,
                  error: errorMessage(err),
                };
              }
            },
          },
        },

        // Formulario público: no requiere sesión
        resolversConfig: {
          'Mutation.createFullBooking': { auth: false },
        },
      });
  },

  bootstrap() {},
};