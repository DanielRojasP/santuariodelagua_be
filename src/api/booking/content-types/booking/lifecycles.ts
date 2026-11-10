

module.exports = {
    async afterCreate(event: any) {
        const { data } = event.params;


        console.log("🚀 ~ file: lifecycles.ts:4 ~ beforeCreate ~ data:", data);

    }
}

