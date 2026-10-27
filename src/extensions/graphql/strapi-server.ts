// src/extensions/graphql/strapi-server.ts

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
  date?: string;
  is_guided: boolean;
  local_visitors: VisitorInput[];
  foreigner_visitors: VisitorInput[];
  duration?: number;
}

export default ({ strapi }: { strapi: any }) => {
  const extensionService = strapi.plugin('graphql').service('extension');

  extensionService.use(({ nexus }: { nexus: any }) => ({
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
        createFullBooking: async (parent: any, { data }: { data: CreateFullBookingInput }) => {
          try {
            // 1. Crear el Booking principal
            const booking = await strapi.documents('api::booking.booking').create({
              data: {
                code: data.code,
                total_amount: data.total_amount,
                status_booking: data.status_booking,
                customer_complete_name: data.customer_complete_name,
                customer_email: data.customer_email,
                customer_phone: data.customer_phone,
                publishedAt: new Date(),
              },
            });

            // 2. Calcular el total de pasajeros
            const localList = data.local_visitors || [];
            const foreignerList = data.foreigner_visitors || [];

            const totalNat = localList.reduce((acc: number, v: VisitorInput) => acc + v.quantity, 0);
            const totalFor = foreignerList.reduce((acc: number, v: VisitorInput) => acc + v.quantity, 0);

            // 3. Formatear la fecha del tour
            const currentDate = new Date().toISOString().split('T')[0];
            const tourDate = data.date
              ? new Date(`${currentDate}T${data.date}:00.000Z`).toISOString()
              : new Date().toISOString();

            // 4. Crear el BookingTour asociado
            const bookingTour = await strapi.documents('api::booking-tour.booking-tour').create({
              data: {
                booking: booking.documentId,
                tour: data.tourDocumentId,
                is_guided: data.is_guided,
                date: tourDate,
                pax_count: totalNat + totalFor,
                total_tour_amount: data.total_amount,
                languague: 'es',
                duration: data.duration || 0,
                status_tour: 'PENDING',
                publishedAt: new Date(),
              },
            });

            // 5. Consolidar los detalles de visitantes
            const allVisitors = [
              ...localList.map(v => ({ ...v, visitor_type: 'LOCAL' })),
              ...foreignerList.map(v => ({ ...v, visitor_type: 'FOREIGNER' }))
            ];

            // 6. Registrar VisitorDetails en bucle secuencial
            for (const v of allVisitors) {
              if (v.quantity > 0) {
                await strapi.documents('api::visitor-detail.visitor-detail').create({
                  data: {
                    booking_tour: bookingTour.documentId,
                    visitor_type: v.visitor_type,
                    age_group: v.age_group,
                    quantity: v.quantity,
                    publishedAt: new Date(),
                  },
                });
              }
            }

            return {
              success: true,
              bookingDocumentId: booking.documentId,
              error: null,
            };
          } catch (err: any) {
            console.error("Error interno en createFullBooking:", err);
            return {
              success: false,
              bookingDocumentId: null,
              error: err.message || "Error desconocido",
            };
          }
        },
      },
    },
  }));
};