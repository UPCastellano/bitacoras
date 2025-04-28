// Variables globales
let documentosTable;

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
                            <button class="btn btn-primary btn-sm btn-action view-btn" data-id="${data.id}" data-url="${data.url_vista}" title="Ver PDF">
                                <i class="fas fa-eye"></i>
                            </button>
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
            // Limpiar y volver a cargar la tabla
            documentosTable.clear();
            documentosTable.rows.add(data).draw();
            hideLoading(loading);
        })
        .catch(error => {
            console.error('Error:', error);
            showMessage('error', 'Error al cargar los documentos');
            hideLoading(loading);
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

// Ver documento PDF
function viewDocument(url, nombre) {
    // Configurar el modal
    document.getElementById('pdfViewerModalLabel').textContent = nombre;
    document.getElementById('pdfFrame').src = url;
    document.getElementById('downloadBtn').href = url;
    
    // Abrir el modal
    const modal = new bootstrap.Modal(document.getElementById('pdfViewerModal'));
    modal.show();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar DataTable
    initDataTable();
    
    // Cargar datos
    loadDocumentos();
    
    // Manejar el formulario de subida
    document.getElementById('uploadForm').addEventListener('submit', handleFileUpload);
    
    // Delegación de eventos para botones de la tabla
    document.getElementById('documentosTable').addEventListener('click', function(e) {
        // Botón de ver documento
        if (e.target.closest('.view-btn')) {
            const button = e.target.closest('.view-btn');
            const url = button.getAttribute('data-url');
            const id = button.getAttribute('data-id');
            
            // Obtener el nombre del documento a través de la API
            fetch(`/api/documentos/${id}`)
                .then(response => response.json())
                .then(data => {
                    viewDocument(url, data.nombre);
                })
                .catch(error => {
                    console.error('Error:', error);
                    showMessage('error', 'Error al obtener información del documento');
                });
        }
        
        // Botón de eliminar documento
        if (e.target.closest('.delete-btn')) {
            const id = e.target.closest('.delete-btn').getAttribute('data-id');
            deleteDocumento(id);
        }
    });
}); 