const express = require('express');
const multer = require('multer');
const path = require('path');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();
const config = require('./config');
const { uploadFileToDrive, oauth2Client, drive } = require('./googleDrive');
const { google } = require('googleapis');

// Crear la aplicación Express
const app = express();
const port = config.server.port;

// Middleware
app.use(cors({
  origin: '*', // O pon tu dominio en producción para mayor seguridad
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'X-CSRF-Token', 'X-Requested-With', 'Accept', 'Accept-Version',
    'Content-Length', 'Content-MD5', 'Content-Type', 'Date', 'X-Api-Version'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use('/uploads', express.static(path.join(__dirname, config.upload.path)));

// Multer en memoria (no en disco)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Conexión a la base de datos
const pool = mysql.createPool({
  host: config.database.host,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const FOLDER_ID = '18W0EM6vs0sJ1M0Qrpu6HC2r32ZQ8IIgV';

// Rutas
// 1. Subir archivo PDF
app.post('/api/upload', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ningún archivo PDF' });
    }

    // Subir a Google Drive
    const url = await uploadFileToDrive(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      FOLDER_ID
    );

    const { nombre, descripcion } = req.body;

    // Guardar la información en la base de datos
    const [result] = await pool.execute(
      'INSERT INTO documentos (nombre, descripcion, ruta_archivo, tipo_mime, tamano) VALUES (?, ?, ?, ?, ?)',
      [
        nombre || req.file.originalname,
        descripcion || '',
        url, // Guardamos el enlace de Google Drive
        req.file.mimetype,
        req.file.size
      ]
    );

    res.json({
      success: true,
      mensaje: 'Archivo subido correctamente a Google Drive',
      url,
      documento: {
        id: result.insertId,
        nombre: nombre || req.file.originalname,
        ruta_archivo: url
      }
    });
  } catch (error) {
    console.error('Error al subir el archivo:', error);
    res.status(500).json({ error: 'Error al procesar la subida del archivo a Google Drive' });
  }
});

// 2. Obtener todos los documentos
app.get('/api/documentos', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM documentos ORDER BY fecha_subida DESC');
    
    // Añadir URL completa para cada documento
    const documentos = rows.map(doc => ({
      ...doc,
      url_vista: doc.ruta_archivo.startsWith('http') ? doc.ruta_archivo : `/uploads/${doc.ruta_archivo}`
    }));
    
    res.json(documentos);
  } catch (error) {
    console.error('Error al obtener documentos:', error);
    res.status(500).json({ error: 'Error al obtener la lista de documentos' });
  }
});

// 3. Obtener un documento específico
app.get('/api/documentos/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM documentos WHERE id = ?', [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    
    const documento = {
      ...rows[0],
      url_vista: rows[0].ruta_archivo.startsWith('http') ? rows[0].ruta_archivo : `/uploads/${rows[0].ruta_archivo}`
    };
    
    res.json(documento);
  } catch (error) {
    console.error('Error al obtener documento:', error);
    res.status(500).json({ error: 'Error al obtener el documento' });
  }
});

// 4. Eliminar un documento
app.delete('/api/documentos/:id', async (req, res) => {
  try {
    // Primero obtenemos la información del documento para eliminar el archivo
    const [rows] = await pool.execute('SELECT ruta_archivo FROM documentos WHERE id = ?', [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    
    const rutaArchivo = path.join(uploadDir, rows[0].ruta_archivo);
    
    // Eliminar de la base de datos
    await pool.execute('DELETE FROM documentos WHERE id = ?', [req.params.id]);
    
    // Eliminar el archivo físico
    if (fs.existsSync(rutaArchivo)) {
      fs.unlinkSync(rutaArchivo);
    }
    
    res.json({ success: true, mensaje: 'Documento eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar documento:', error);
    res.status(500).json({ error: 'Error al eliminar el documento' });
  }
});

// Endpoint de prueba de conexión a la base de datos
app.get('/api/test-db', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT 1');
    res.json({ ok: true, rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Ruta de la página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware para manejar errores de Multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        error: 'El archivo excede el tamaño máximo permitido de 50MB' 
      });
    }
  }
  next(err);
});

app.get('/api/descargar/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM documentos WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).send('Documento no encontrado');
    }
    const doc = rows[0];
    // Solo Google Drive
    if (doc.ruta_archivo.startsWith('http')) {
      const fileId = extraerIdDeGoogleDrive(doc.ruta_archivo);
      const driveRes = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );
      res.setHeader('Content-Type', 'application/pdf');
      driveRes.data.pipe(res);
    } else {
      // Si tienes archivos locales antiguos, puedes mostrar un mensaje de error
      res.status(404).send('El archivo solo está disponible en Google Drive');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al descargar el archivo');
  }
});

function extraerIdDeGoogleDrive(url) {
  // Extrae el ID del enlace de Google Drive
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor ejecutándose en http://localhost:${port}`);
}); 