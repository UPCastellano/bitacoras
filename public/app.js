// Variables globales
let documentosTable;
let allDocumentos = []; // Almacena todos los documentos disponibles
let selectedDocId = null; // ID del documento seleccionado actualmente

// Función para mostrar spinner de carga
function showLoading() {
    const spinner = document.createElement('div');
    spinner.className = 'loading-overlay';
    spinner.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(spinner);
    return spinner;
}

// Función para ocultar spinner de carga
function hideLoading(spinner) {
    if (spinner) {
        document.body.removeChild(spinner);
    }
}

// Función para mostrar mensajes
function showMessage(type, message) {
    Swal.fire({
        icon: type,
        title: type === 'success' ? 'Éxito' : 'Error',
        text: message,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
    });
}

// Función para formatear tamaño de archivo
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Función para formatear fecha
function formatDate(dateString) {
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('es-ES', options);
}

// Inicializar DataTables
function initDataTable() {
    documentosTable = $('#documentosTable').DataTable({
        responsive: true,
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.5/i18n/es-ES.json'
        },
        columns: [
            { data: 'id' },
            { data: 'nombre' },
            { data: 'descripcion' },
            { 
                data: 'fecha_subida',
                render: function(data) {
                    return formatDate(data);
                }
            },
            { 
                data: 'tamano',
                render: function(data) {
                    return formatFileSize(data);
                }
            },
            { 
                data: null,
                orderable: false,
                render: function(data) {
                    return `
                        <div class="d-flex justify-content-center">
                            <a href="${data.url_vista}" class="btn btn-primary btn-sm btn-action" target="_blank" title="Ver PDF">
                                <i class="fas fa-eye"></i>
                            </a>
                            <a href="${data.url_vista}" class="btn btn-success btn-sm btn-action" download="${data.nombre}.pdf" title="Descargar">
                                <i class="fas fa-download"></i>
                            </a>
                            <button class="btn btn-danger btn-sm btn-action delete-btn" data-id="${data.id}" title="Eliminar">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `;
                }
            }
        ]
    });
}

// Cargar datos desde la API
function loadDocumentos() {
    const loading = showLoading();
    
    fetch('/api/documentos')
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al obtener los documentos');
            }
            return response.json();
        })
        .then(data => {
            // Guardar todos los documentos
            allDocumentos = data;
            
            // Limpiar y volver a cargar la tabla
            documentosTable.clear();
            documentosTable.rows.add(data).draw();
            
            // Actualizar el selector de documentos
            updateDocumentSelector();
            
            hideLoading(loading);
        })
        .catch(error => {
            console.error('Error:', error);
            showMessage('error', 'Error al cargar los documentos');
            hideLoading(loading);
        });
}

// Actualizar el selector de documentos
function updateDocumentSelector() {
    const select = document.getElementById('documentSelect');
    
    // Limpiar opciones actuales excepto la primera
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    // Agregar nuevos documentos al selector
    allDocumentos.forEach(doc => {
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = doc.nombre;
        select.appendChild(option);
    });
}

// Manejar la subida de archivos
function handleFileUpload(event) {
    event.preventDefault();
    
    const formData = new FormData(document.getElementById('uploadForm'));
    const loading = showLoading();
    
    fetch('/api/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Error al subir el archivo');
            });
        }
        return response.json();
    })
    .then(data => {
        showMessage('success', 'Documento subido correctamente');
        document.getElementById('uploadForm').reset();
        loadDocumentos(); // Recargar la tabla
        hideLoading(loading);
    })
    .catch(error => {
        console.error('Error:', error);
        showMessage('error', error.message || 'Error al subir el documento. Asegúrate de que sea un PDF válido.');
        hideLoading(loading);
    });
}

// Eliminar documento
function deleteDocumento(id) {
    Swal.fire({
        title: '¿Estás seguro?',
        text: "No podrás revertir esta acción",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            const loading = showLoading();
            
            fetch(`/api/documentos/${id}`, {
                method: 'DELETE'
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Error al eliminar el documento');
                }
                return response.json();
            })
            .then(data => {
                showMessage('success', 'Documento eliminado correctamente');
                loadDocumentos(); // Recargar la tabla
                hideLoading(loading);
            })
            .catch(error => {
                console.error('Error:', error);
                showMessage('error', 'Error al eliminar el documento');
                hideLoading(loading);
            });
        }
    });
}

// Abrir el PDF en una nueva pestaña con parámetros de búsqueda
function openPdfInNewTab(documentId, searchTerm = null, pageNumber = null) {
    // Buscar el documento
    const documento = allDocumentos.find(doc => doc.id == documentId);
    if (!documento) {
        showMessage('error', 'Documento no encontrado');
        return;
    }
    
    // Construir la URL base
    let url = documento.url_vista;
    
    // Construir parámetros para la búsqueda
    const params = new URLSearchParams();
    if (searchTerm) {
        params.append('search', searchTerm);
    }
    if (pageNumber) {
        params.append('page', pageNumber);
    }
    
    // Agregar parámetros a la URL si existen
    const queryString = params.toString();
    if (queryString) {
        url = `${url}#${queryString}`;
    }
    
    // Abrir en nueva pestaña
    window.open(url, '_blank');
}

// Buscar por número de serie
function searchBySerialNumber() {
    const serialNumber = document.getElementById('searchSerialInput').value.trim();
    const documentId = document.getElementById('documentSelect').value;
    
    if (!serialNumber) {
        showMessage('warning', 'Ingrese un número de serie para buscar');
        return;
    }
    
    if (!documentId) {
        showMessage('warning', 'Seleccione un documento para realizar la búsqueda');
        return;
    }
    
    // Abrir en nueva pestaña con el parámetro de búsqueda
    openPdfInNewTab(documentId, serialNumber);
}

// Ir a una página específica
function goToPage() {
    const pageNumber = document.getElementById('pageNumberInput').value.trim();
    const documentId = document.getElementById('documentSelect').value;
    
    if (!pageNumber || isNaN(pageNumber) || pageNumber < 1) {
        showMessage('warning', 'Ingrese un número de página válido');
        return;
    }
    
    if (!documentId) {
        showMessage('warning', 'Seleccione un documento para navegar');
        return;
    }
    
    // Abrir en nueva pestaña con el parámetro de página
    openPdfInNewTab(documentId, null, pageNumber);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar DataTable
    initDataTable();
    
    // Cargar datos
    loadDocumentos();
    
    // Manejar el formulario de subida
    document.getElementById('uploadForm').addEventListener('submit', handleFileUpload);
    
    // Cambio en el selector de documentos
    document.getElementById('documentSelect').addEventListener('change', function() {
        selectedDocId = this.value;
    });
    
    // Botón de búsqueda por número de serie
    document.getElementById('searchSerialBtn').addEventListener('click', searchBySerialNumber);
    
    // Búsqueda por número de serie al presionar Enter
    document.getElementById('searchSerialInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchBySerialNumber();
        }
    });
    
    // Botón para ir a una página específica
    document.getElementById('goToPageBtn').addEventListener('click', goToPage);
    
    // Ir a página al presionar Enter
    document.getElementById('pageNumberInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            goToPage();
        }
    });
    
    // Delegación de eventos para botones de la tabla
    document.getElementById('documentosTable').addEventListener('click', function(e) {
        // Botón de eliminar documento
        if (e.target.closest('.delete-btn')) {
            const id = e.target.closest('.delete-btn').getAttribute('data-id');
            deleteDocumento(id);
        }
    });
}); 