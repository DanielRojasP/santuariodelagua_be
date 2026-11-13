
export const getTourTitle = async (tourDocumentId: string, language: string): Promise<string> => {
  try {
    const tour = await strapi.db.query("api::tour.tour").findOne({
      where: { documentId: tourDocumentId, locale: language },
      select: ["title"],
    });
    return tour.title;
  } catch (error) {
    strapi.log.error(`Error fetching tour title for ID ${tourDocumentId}: ${error}`);
    throw new Error("Failed to fetch tour title");
  }
};