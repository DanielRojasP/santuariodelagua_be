export default [
  {
    name: 'strapi::cors',
    config: {
      origin: [
        'http://localhost:3000',      
        'http://localhost:1337', 
        'https://refreshing-passion-2f31c9361b.strapiapp.com',        
        'https://dev-santuariodelagua.netlify.app',       
        'https://relieved-maggot-logical.ngrok-free.app'
      ],
      headers: [
        'Content-Type',
        'Authorization',
        'Origin',
        'Accept',
        'ngrok-skip-browser-warning' 
      ],
      credentials: true,
    },
  },
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
