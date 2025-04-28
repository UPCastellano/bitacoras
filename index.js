const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();
const config = require('./config');

// Crear la aplicación Express
const app = express();
const port = config.server.port;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, config.upload.path)));

// Asegurarse de que el directorio de subidas exista
const uploadDir = path.join(__dirname, config.upload.path);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configurar multer para la subida de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generar un nombre único para evitar sobrescrituras
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// Filtro para aceptar solo archivos PDF
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos PDF'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // Límite aumentado a 50MB
});

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

// Rutas
// 1. Subir archivo PDF
app.post('/api/upload', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ningún archivo PDF' });
    }

    const { nombre, descripcion } = req.body;
    const archivo = req.file;

    // Guardar la información en la base de datos
    const [result] = await pool.execute(
      'INSERT INTO documentos (nombre, descripcion, ruta_archivo, tipo_mime, tamano) VALUES (?, ?, ?, ?, ?)',
      [
        nombre || archivo.originalname,
        descripcion || '',
        archivo.filename,
        archivo.mimetype,
        archivo.size
      ]
    );

    res.json({
      success: true,
      mensaje: 'Archivo subido correctamente',
      documento: {
        id: result.insertId,
        nombre: nombre || archivo.originalname,
        ruta_archivo: archivo.filename
      }
    });
  } catch (error) {
    console.error('Error al subir el archivo:', error);
    res.status(500).json({ error: 'Error al procesar la subida del archivo' });
  }
});

// 2. Obtener todos los documentos
app.get('/api/documentos', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM documentos ORDER BY fecha_subida DESC');
    
    // Añadir URL completa para cada documento
    const documentos = rows.map(doc => ({
      ...doc,
      url_vista: `/uploads/${doc.ruta_archivo}`
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
      url_vista: `/uploads/${rows[0].ruta_archivo}`
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

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor ejecutándose en http://localhost:${port}`);
}); 