// Configuración de la base de datos y otras variables
module.exports = {
  database: {
    host: process.env.DB_HOST || 'b9bifbbpdpxex5rtkjba-mysql.services.clever-cloud.com',
    user: process.env.DB_USER || 'u10vawhkeqpflq8e',
    password: process.env.DB_PASSWORD || 'dLrHAL9rvCnHjuHLGhIW',
    database: process.env.DB_NAME || 'b9bifbbpdpxex5rtkjba'
  },
  server: {
    port: process.env.PORT || 3000
  },
  upload: {
    path: process.env.UPLOAD_PATH || 'uploads'
  }
}; 