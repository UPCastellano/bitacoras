# Sistema de Gestión de Documentos PDF

Sistema para subir, visualizar y gestionar archivos PDF utilizando Node.js, Express, MySQL y DataTables.

## Características

- Subida de archivos PDF a MySQL
- Visualización en una tabla con DataTables
- Enlaces para visualizar, descargar y eliminar archivos
- Interfaz responsiva y moderna
- Validación y restricción de archivos (solo PDF)

## Requisitos

- Node.js (v14 o superior)
- MySQL (v5.7 o superior)
- npm

## Instalación

1. Clona el repositorio o descarga los archivos

2. Instala las dependencias:
```bash
npm install
```

3. Configura la base de datos:
```bash
# Conecta a MySQL y ejecuta el script:
mysql -u usuario -p < db_structure.sql
```

4. Configura las variables de entorno (o usa los valores predeterminados en config.js):
```
DB_HOST=localhost
DB_USER=tu_usuario
DB_PASSWORD=tu_contraseña
DB_NAME=sistema_documentos
PORT=3000
UPLOAD_PATH=uploads
```

5. Inicia el servidor:
```bash
npm start
```

6. Abre tu navegador y visita `http://localhost:3000`

## Uso

### Subir un documento PDF

1. Completa el formulario con un nombre y descripción opcional
2. Selecciona un archivo PDF (máximo 50MB)
3. Haz clic en "Subir Documento"

### Ver y gestionar documentos

- La tabla muestra todos los documentos subidos
- Utiliza el botón de "Ver" para visualizar el PDF en un modal
- Utiliza el botón de "Descargar" para guardar el PDF
- Utiliza el botón de "Eliminar" para borrar el documento

## Despliegue en Vercel

1. Asegúrate de tener una cuenta en Vercel y la CLI instalada:
```bash
npm install -g vercel
```

2. Configura las variables de entorno en Vercel:
   - En el dashboard de Vercel, ve a tu proyecto
   - Ve a "Settings" > "Environment Variables"
   - Añade las variables de entorno necesarias (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)

3. Despliega tu aplicación:
```bash
vercel
```

4. Para desplegar a producción:
```bash
vercel --prod
```

**Nota importante**: Para el almacenamiento de archivos en producción, considera usar un servicio de almacenamiento como AWS S3 o similar, ya que Vercel no garantiza persistencia de archivos.

## Scripts de base de datos

### Crear base de datos y tabla

```sql
-- Crear base de datos
CREATE DATABASE IF NOT EXISTS sistema_documentos;
USE sistema_documentos;

-- Crear tabla para almacenar archivos PDF
CREATE TABLE IF NOT EXISTS documentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    ruta_archivo VARCHAR(255) NOT NULL,
    tipo_mime VARCHAR(100) NOT NULL,
    tamano INT NOT NULL,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Consultar documentos

```sql
-- Obtener todos los documentos
SELECT * FROM documentos ORDER BY fecha_subida DESC;

-- Buscar documento por nombre
SELECT * FROM documentos WHERE nombre LIKE '%término_búsqueda%';

-- Buscar documentos por fecha
SELECT * FROM documentos 
WHERE fecha_subida BETWEEN '2023-01-01' AND '2023-12-31';
```

## Licencia

MIT 