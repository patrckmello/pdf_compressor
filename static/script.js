let selectedFile = null;
let selectedCompression = null;

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('file-name');
const compressBtn = document.getElementById('compress-btn');
const compressionMenu = document.getElementById('compressionMenu');
const closeBtn = document.querySelector('.close-btn');
const startButton = document.getElementById('start-compression');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const statusMessage = document.getElementById('status-message');
const errorMessage = document.getElementById('error-message');
const errorMessage2 = document.getElementById('error-message2');  // Div de erro

// Adiciona evento de clique para o drop-zone, que abre o seletor de arquivos
dropZone.addEventListener('click', () => fileInput.click());

// Eventos de arrastar e soltar
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.backgroundColor = "#e4eaee";
});
dropZone.addEventListener('dragleave', () => {
    dropZone.style.backgroundColor = "#f9f9f9";
});
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.backgroundColor = "#f9f9f9";
    handleFiles(e.dataTransfer.files);
});

// Processa o arquivo selecionado
function handleFiles(files) {
    const file = files[0];
    const previewContainer = document.getElementById("pdf-preview-container");
    const pdfCanvas = document.getElementById("pdf-canvas");
    const pdfInfo = document.getElementById("pdf-info");
    const ctx = pdfCanvas.getContext("2d");

    if (file && file.type === "application/pdf") {
        selectedFile = file;

        // Oculta mensagem de erro
        if (errorMessage) errorMessage.style.display = "none";
        if (errorMessage2) errorMessage2.style.display = "none";

        // Mostra container de preview
        previewContainer.style.display = "block";

        // Tamanho
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        pdfInfo.textContent = `📦 Tamanho: ${fileSizeMB} MB • 📄 Lendo número de páginas...`;

        // Lê como array
        const reader = new FileReader();
        reader.onload = function () {
            const typedarray = new Uint8Array(this.result);

            pdfjsLib.getDocument(typedarray).promise.then(pdf => {
                const totalPages = pdf.numPages;
                pdfInfo.textContent = `📦 Tamanho: ${fileSizeMB} MB 📄 Páginas: ${totalPages}`;

                // Renderiza a primeira página
                pdf.getPage(1).then(page => {
                    const viewport = page.getViewport({ scale: 1.5 }); // ajuste o scale se quiser
                    pdfCanvas.height = viewport.height;
                    pdfCanvas.width = viewport.width;

                    const renderContext = {
                        canvasContext: ctx,
                        viewport: viewport
                    };
                    page.render(renderContext);
                });
            }).catch(err => {
                pdfInfo.textContent = `Erro ao ler número de páginas.`;
                console.error(err);
            });
        };
        reader.readAsArrayBuffer(file);

        compressBtn.disabled = false;
    } else {
        if (errorMessage) {
            errorMessage.textContent = "Por favor, selecione um arquivo PDF.";
            errorMessage.style.display = "block";
        }
        selectedFile = null;
        compressBtn.disabled = true;

        // Esconde preview e limpa canvas/info
        previewContainer.style.display = "none";
        pdfCanvas.getContext("2d").clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
        pdfInfo.textContent = "";
    }
}

// Evento para input de arquivo
fileInput.addEventListener('change', function () {
    handleFiles(this.files);
});

// Abre o menu lateral de compressão
function openCompressionMenu() {
    if (selectedFile) {
        compressionMenu.style.right = '0';
    }
}

// Fecha o menu lateral
function closeCompressionMenu() {
    compressionMenu.style.right = '-500px';
}

// Seleciona o tipo de compressão
function selectCompression(element) {
    document.querySelectorAll('.compression-option').forEach(opt => {
        opt.classList.remove('selected');
        opt.style.opacity = '0.6';
    });

    element.classList.add('selected');
    element.style.opacity = '1';
    selectedCompression = element.getAttribute('data-type');  // Define o tipo de compressão
    startButton.disabled = false;
}

// Inicia a compressão real com barra de progresso baseada no backend
function startCompression() {
    if (!selectedFile || !selectedCompression) {
        alert("Selecione um arquivo e o modo de compressão.");
        return;
    }

    progressContainer.style.display = 'block';
    statusMessage.style.display = 'block';
    statusMessage.textContent = 'Enviando arquivo...';

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('compression', selectedCompression);

    fetch('/compress', {
        method: 'POST',
        body: formData,
    })
    .then(response => response.json())
    .then(data => {
        const taskId = data.task_id;
        pollProgress(taskId);
    })
    .catch(error => {
        console.error('Erro ao iniciar compressão:', error);
        statusMessage.textContent = 'Erro ao iniciar compressão.';
    });
}

// Função que verifica o progresso real da tarefa
function pollProgress(taskId) {
    const interval = setInterval(() => {
        fetch(`/progress/${taskId}`)
            .then(response => {
                if (!response.ok) throw new Error("Erro ao verificar progresso");
                return response.json();
            })
            .then(data => {
                const percent = data.percent;
                const status = data.status;

                progressBar.style.width = percent + '%';
                statusMessage.textContent = status;

                if (percent >= 100) {
                    clearInterval(interval);
                    setTimeout(() => {
                        window.location.href = `/download/${taskId}`;
                    }, 1000);
                }

                if (percent >= 100) {
                    clearInterval(interval);
                    statusMessage.textContent = 'Compressão concluída';
                
                    // Cooldown de 5 segundos antes de recarregar a página
                    setTimeout(() => {
                        location.reload();  // Reinicia a página
                    }, 5000);  // 5000 ms = 5 segundos
                }
            })
            .catch(err => {
                clearInterval(interval);
                console.error('Erro ao buscar progresso:', err);
                statusMessage.textContent = 'Erro ao buscar progresso.';
            });
    }, 1000);
}

// Fechar o menu de compressão
closeBtn.addEventListener('click', closeCompressionMenu);

// Abrir menu quando botão principal for clicado
document.addEventListener('DOMContentLoaded', () => {
    compressBtn.addEventListener('click', () => {
        if (!selectedFile) {
            // Se nenhum arquivo for selecionado, exibe a mensagem de erro
            if (errorMessage2) errorMessage2.style.display = "block";
        } else {
            openCompressionMenu();
        }
    });
});

// Corrige comportamento dos botões de compressão
document.querySelectorAll('.compression-option').forEach(opt => {
    opt.addEventListener('click', function () {
        selectCompression(opt);
    });
});
