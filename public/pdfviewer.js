// Configuración de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// Variables globales para el visor de PDF
let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;
let scale = 1.5;
let canvas = null;
let ctx = null;
let currentPdfUrl = null;
let searchMatches = [];
let currentMatchIndex = -1;

// Función para cargar un PDF
function loadPdf(url, searchText = null) {
    currentPdfUrl = url;
    
    const loadingTask = pdfjsLib.getDocument(url);
    loadingTask.promise.then(pdfDocument => {
        pdfDoc = pdfDocument;
        
        // Actualizar información de páginas
        document.getElementById('pdfPageInfo').textContent = `Página ${pageNum} de ${pdfDoc.numPages}`;
        
        // Renderizar primera página
        renderPage(pageNum);
        
        // Si hay texto para buscar, iniciar búsqueda
        if (searchText) {
            searchInPdf(searchText);
        }
    }).catch(error => {
        console.error('Error al cargar el PDF:', error);
        showMessage('error', 'Error al cargar el documento PDF');
    });
}

// Renderizar una página específica
function renderPage(num) {
    pageRendering = true;
    
    // Crear o reiniciar el canvas para la página
    const container = document.getElementById('pdfViewer');
    container.innerHTML = '';
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
    ctx = canvas.getContext('2d');
    
    // Obtener la página
    pdfDoc.getPage(num).then(page => {
        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Renderizar la página en el canvas
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        
        page.render(renderContext).promise.then(() => {
            pageRendering = false;
            
            // Si hay una página pendiente, renderizarla
            if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
            }
            
            // Resaltar las coincidencias de búsqueda si hay alguna
            highlightMatches();
        });
        
        // Actualizar información de página actual
        document.getElementById('pdfPageInfo').textContent = `Página ${num} de ${pdfDoc.numPages}`;
    });
}

// Cambiar página
function queueRenderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

// Ir a la página anterior
function prevPage() {
    if (pageNum <= 1) {
        return;
    }
    pageNum--;
    queueRenderPage(pageNum);
}

// Ir a la página siguiente
function nextPage() {
    if (pageNum >= pdfDoc.numPages) {
        return;
    }
    pageNum++;
    queueRenderPage(pageNum);
}

// Ir a una página específica
function goToPage(num) {
    if (num < 1 || num > pdfDoc.numPages) {
        return;
    }
    pageNum = num;
    queueRenderPage(pageNum);
}

// Buscar texto en el PDF completo
async function searchInPdf(searchText) {
    if (!pdfDoc || !searchText) return;
    
    searchMatches = [];
    currentMatchIndex = -1;
    
    const searchPattern = new RegExp(searchText.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'gi');
    
    // Mostrar spinner de carga
    const loading = showLoading();
    
    try {
        // Buscar en cada página
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            const textItems = textContent.items;
            
            for (let j = 0; j < textItems.length; j++) {
                const textItem = textItems[j];
                const text = textItem.str;
                
                // Buscar coincidencias en este fragmento de texto
                let match;
                while ((match = searchPattern.exec(text)) !== null) {
                    searchMatches.push({
                        pageNum: i,
                        textItem: textItem,
                        matchIndex: match.index,
                        matchText: match[0]
                    });
                }
            }
        }
        
        hideLoading(loading);
        
        // Si se encontraron coincidencias, ir a la primera
        if (searchMatches.length > 0) {
            navigateToNextMatch();
            showMessage('success', `Se encontraron ${searchMatches.length} coincidencias`);
        } else {
            showMessage('info', 'No se encontraron coincidencias');
        }
    } catch (error) {
        hideLoading(loading);
        console.error('Error en la búsqueda:', error);
        showMessage('error', 'Error al realizar la búsqueda');
    }
}

// Navegar a la siguiente coincidencia
function navigateToNextMatch() {
    if (searchMatches.length === 0) return;
    
    currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length;
    const match = searchMatches[currentMatchIndex];
    
    // Ir a la página de la coincidencia
    if (pageNum !== match.pageNum) {
        goToPage(match.pageNum);
    } else {
        // Si ya estamos en la página correcta, solo resaltar
        highlightMatches();
    }
}

// Navegar a la coincidencia anterior
function navigateToPrevMatch() {
    if (searchMatches.length === 0) return;
    
    currentMatchIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    const match = searchMatches[currentMatchIndex];
    
    // Ir a la página de la coincidencia
    if (pageNum !== match.pageNum) {
        goToPage(match.pageNum);
    } else {
        // Si ya estamos en la página correcta, solo resaltar
        highlightMatches();
    }
}

// Resaltar las coincidencias en la página actual
function highlightMatches() {
    if (!ctx || searchMatches.length === 0) return;
    
    // Filtrar coincidencias para la página actual
    const pageMatches = searchMatches.filter(match => match.pageNum === pageNum);
    
    // Resaltar cada coincidencia
    for (let i = 0; i < pageMatches.length; i++) {
        const match = pageMatches[i];
        const textItem = match.textItem;
        
        // Obtener las coordenadas aproximadas del texto
        const x = textItem.transform[4];
        const y = textItem.transform[5];
        const width = textItem.width;
        const height = textItem.height || 15; // Altura aproximada si no está disponible
        
        // Dibujar un rectángulo amarillo semitransparente sobre el texto
        ctx.fillStyle = i === currentMatchIndex ? 'rgba(255, 165, 0, 0.5)' : 'rgba(255, 255, 0, 0.3)';
        ctx.fillRect(x, y - height + 2, width, height);
    }
    
    // Si la coincidencia actual está en esta página, asegurarse de que sea visible
    if (currentMatchIndex >= 0 && searchMatches[currentMatchIndex].pageNum === pageNum) {
        const match = searchMatches[currentMatchIndex];
        const textItem = match.textItem;
        
        // Obtener posición aproximada
        const x = textItem.transform[4];
        const y = textItem.transform[5];
        
        // Desplazar la vista al área de la coincidencia
        document.getElementById('pdfContainer').scrollTo({
            top: y - 100,
            behavior: 'smooth'
        });
    }
}

// Buscar número de serie específico
function searchSerialNumber(serialNumber) {
    if (!serialNumber) return;
    
    // Primero abrir el modal si no está abierto
    const modal = new bootstrap.Modal(document.getElementById('pdfViewerModal'));
    modal.show();
    
    // Esperar a que se cargue el PDF antes de buscar
    setTimeout(() => {
        // Realizar la búsqueda
        searchInPdf(serialNumber);
    }, 1000);
}

// Event listeners para el visor de PDF
document.addEventListener('DOMContentLoaded', function() {
    // Botones de navegación de páginas
    document.getElementById('pdfPrevBtn').addEventListener('click', prevPage);
    document.getElementById('pdfNextBtn').addEventListener('click', nextPage);
    
    // Búsqueda en PDF
    document.getElementById('pdfSearchBtn').addEventListener('click', function() {
        const searchText = document.getElementById('pdfSearchInput').value;
        if (searchText) {
            searchInPdf(searchText);
        }
    });
    
    // Buscar al presionar Enter en el campo de búsqueda
    document.getElementById('pdfSearchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const searchText = this.value;
            if (searchText) {
                searchInPdf(searchText);
            }
        }
    });
    
    // Buscar número de serie
    document.getElementById('searchSerialBtn').addEventListener('click', function() {
        const serialNumber = document.getElementById('searchSerialInput').value;
        if (serialNumber) {
            // Buscar en el documento actualmente cargado o en el más reciente
            if (currentPdfUrl) {
                searchSerialNumber(serialNumber);
            } else {
                showMessage('info', 'Primero debe abrir un documento PDF');
            }
        }
    });
}); 