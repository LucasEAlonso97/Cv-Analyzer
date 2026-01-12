import { KEYWORD_DICTIONARIES, SOFT_SKILLS } from './modules/dictionary.js';
import { formatDate, normalizeText, getScoreColor, isValidEmail } from './utils.js';

// 1. CONFIGURACIÓN (Corregido: Variables definidas fuera para que initApp las vea)
const FECHA_LIMITE = new Date('2030-01-01'); // Extendida para que no se bloquee
const HOY = new Date();
const CONTENT_WEIGHT = 0.7; 
const FORMAT_WEIGHT = 0.3;
let loadingInterval;

// 2. INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
    // Sistema de bloqueo (Corregido)
    if (HOY > FECHA_LIMITE) {
        document.body.innerHTML = `
            <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #1a1a2e; color: white; font-family: sans-serif; text-align: center; padding: 20px;">
                <h1 style="color: #ff4757;">⚠️ Fin de periodo de prueba</h1>
                <p style="font-size: 1.2em;">Ha finalizado el periodo de prueba.</p>
                <p>Por favor, contacte con el desarrollador para reactivar el servicio.</p>
            </div>`;
        return; 
    }
    initApp();
});

function initApp() {
    const btnAnalizar = document.getElementById('btnAnalizar');
    if (btnAnalizar) {
        // IMPORTANTE: Esto vincula el botón correctamente
        btnAnalizar.addEventListener('click', analyzeCV);
        console.log("Botón configurado correctamente");
    }

    // Configuración de PDF.js
    // Dentro de function initApp()
function initApp() {
    // ... código anterior
    if (typeof pdfjsLib !== 'undefined') {
        // Asegúrate de que esta URL sea accesible
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    } else {
        console.error("Librería PDF.js no detectada");
    }
}
    // Listener para mostrar nombre de archivo seleccionado
    const fileInput = document.getElementById('cvFile');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    if (fileInput && fileNameDisplay) {
        fileInput.addEventListener('change', (e) => {
            const name = e.target.files[0]?.name || 'Ningún archivo seleccionado.';
            fileNameDisplay.textContent = name;
        });
    }

    updateNavbarUI();
}

// 3. FLUJO PRINCIPAL
async function analyzeCV() {
    const fileInput = document.getElementById('cvFile');
    const positionSelect = document.getElementById('positionSelect');
    const emailInput = document.getElementById('userEmail'); // Capturamos el input de email
    const sendEmailCheckbox = document.getElementById('sendEmailCheckbox'); // Capturamos el checkbox

    const positionKey = positionSelect.value;
    const positionName = positionSelect.options[positionSelect.selectedIndex].text;
    const userEmail = emailInput ? emailInput.value.trim() : "";

    if (!fileInput.files.length) {
        alert("Por favor, selecciona un archivo.");
        return;
    }

    try {
        startLoadingAnimation();
        
        const file = fileInput.files[0];
        let text = "";

        if (file.type === "application/pdf") {
            text = await readPDF(file);
        } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            text = await extractTextFromDOCX(file); 
        } else {
            throw new Error("Formato de archivo no soportado.");
        }

        // Enviamos el email a processAnalysis para que se guarde en el Dashboard/Leads
        const results = processAnalysis(text, positionKey, userEmail);
        
        // Mostramos resultados y tips
        displayResults(results, positionName, positionKey);

        // Lógica de envío de email (si el usuario lo pidió)
        if (sendEmailCheckbox && sendEmailCheckbox.checked && userEmail !== "") {
            enviarResultadosPorEmail(userEmail, results, positionName);
        }

    } catch (error) {
        console.error("Error en el análisis:", error);
        alert("Hubo un error al procesar el archivo: " + error.message);
        document.getElementById('percentage').textContent = "Error en el análisis";
    } finally {
        stopLoadingAnimation(); 
    }
}
// 4. PROCESAMIENTO
function processAnalysis(text, positionKey, email) {
    const cleanText = normalizeText(text);
    const keywords = KEYWORD_DICTIONARIES[positionKey] || [];
    
    const found = keywords.filter(kw => cleanText.includes(normalizeText(kw)));
    const contentScore = keywords.length > 0 ? (found.length / keywords.length) * 100 : 0;

    const foundSoft = SOFT_SKILLS.filter(ss => cleanText.includes(normalizeText(ss)));
    const softScore = SOFT_SKILLS.length > 0 ? (foundSoft.length / SOFT_SKILLS.length) * 100 : 0;

    const formatScore = text.length > 800 ? 90 : (text.length > 400 ? 60 : 30);
    const finalScore = Math.round((contentScore * CONTENT_WEIGHT) + (formatScore * FORMAT_WEIGHT));

    // Persistencia en LocalStorage (Leads para el Dashboard)
    const history = JSON.parse(localStorage.getItem('cv_analysis_history') || '[]');
    history.push({
        date: formatDate(new Date()),
        position: positionKey,
        email: email || 'Anónimo',
        score: finalScore
    });
    localStorage.setItem('cv_analysis_history', JSON.stringify(history));

    return { finalScore, contentScore, formatScore, softScore, found, foundSoft };
}

// 5. EXTRACCIÓN DE TEXTO
function extractTextFromPDF(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function() {
            try {
                const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(this.result) }).promise;
                let text = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    text += content.items.map(item => item.str).join(' ') + '\n';
                }
                resolve(text);
            } catch (e) { reject(new Error("No se pudo leer el PDF")); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function extractTextFromDOCX(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            mammoth.extractRawText({ arrayBuffer: e.target.result })
                .then(res => resolve(res.value))
                .catch(err => reject(new Error("No se pudo leer el archivo Word")));
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// 6. UI Y ANIMACIONES
function startLoadingAnimation(pos) {
    const div = document.getElementById('percentage');
    if (!div) return;
    div.classList.remove('waiting');
    div.classList.add('loading');
    let i = 0;
    const msgs = ["Analizando Tech-Core...", "Evaluando ATS...", "Calculando Score..."];
    loadingInterval = setInterval(() => {
        div.textContent = msgs[i % msgs.length];
        i++;
    }, 800);
}

function stopLoadingAnimation() {
    if (loadingInterval) clearInterval(loadingInterval);
}

function displayResults(res, posName, posKey) {
    const percDiv = document.getElementById('percentage');
    const color = getScoreColor(res.finalScore);
    
    if (percDiv) {
        percDiv.textContent = `${res.finalScore}% Compatibilidad`;
        percDiv.style.borderColor = color;
        percDiv.style.color = color;
    }
    
    const feedbackDiv = document.getElementById('feedback');
    if (feedbackDiv) {
        feedbackDiv.innerHTML = `
            <div class="result-card">
                <h3>Resultados para ${posName}</h3>
                <p>✅ <strong>Habilidades técnicas:</strong> ${res.found.length} encontradas.</p>
                <p>🧠 <strong>Habilidades blandas:</strong> ${res.foundSoft.length} detectadas.</p>
                <p>📊 <strong>Puntaje de contenido:</strong> ${Math.round(res.contentScore)}%</p>
            </div>
        `;
    }

    // Llamamos a la función de consejos que ya tienes al final de tu main
    displayTips(res, posKey);
}
function updateNavbarUI() {
    const navAction = document.getElementById('navAction');
    if (navAction && sessionStorage.getItem('isLogged') === 'true') {
        navAction.textContent = 'Dashboard';
        navAction.href = 'dashboard.html';
    }
}

// Agrega esto al final de assets/js/main.js
async function readPDF(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function() {
            try {
                const typedarray = new Uint8Array(this.result);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                let fullText = "";
                
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(" ");
                    fullText += pageText + " ";
                }
                resolve(fullText);
            } catch (error) {
                reject("Error al leer PDF: " + error);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function displayTips(res, posKey) {
    const tipsDiv = document.getElementById('dynamicTips');
    if (!tipsDiv) return;

    // Extraemos skills faltantes del diccionario
    const missing = KEYWORD_DICTIONARIES[posKey].filter(skill => 
        !res.found.some(foundSkill => foundSkill.toLowerCase() === skill.toLowerCase())
    );

    let tipsHTML = `<h3>🚀 Plan de Mejora Estratégica (Tendencias 2026-2030)</h3>`;
    tipsHTML += `<div class="tips-container">`;

    // 1. Consejo basado en el Score General (Basado en el documento)
    if (res.finalScore < 60) {
        tipsHTML += `
            <div class="tip-card">
                <h4>⚠️ Alerta de Visibilidad ATS</h4>
                <p>Según el análisis de tendencias, las empresas buscan términos explícitos. No hemos detectado: <strong>${missing.slice(0, 3).join(', ')}</strong>. Inclúyelos para superar los filtros iniciales.</p>
            </div>`;
    }

    // 2. Consejo de IA (Pilar 1 del documento)
    if (!res.found.some(s => s.toLowerCase().includes('ia') || s.toLowerCase().includes('machine'))) {
        tipsHTML += `
            <div class="tip-card">
                <h4>🤖 Factor IA</h4>
                <p>El mercado 2026-2030 valora la <strong>IA y LLMs</strong>. Aunque tu rol no sea de Data Science, menciona cómo usas herramientas de IA para optimizar tu flujo de trabajo.</p>
            </div>`;
    }

    // 3. Consejo de Cloud/Infraestructura (Pilar 2 y 3 del documento)
    if (!res.found.some(s => ['aws', 'azure', 'gcp', 'docker', 'kubernetes'].includes(s.toLowerCase()))) {
        tipsHTML += `
            <div class="tip-card">
                <h4>☁️ Infraestructura Moderna</h4>
                <p>Se detecta falta de conceptos <strong>Cloud-Native o DevOps</strong>. Las empresas buscan perfiles que entiendan la escalabilidad y los contenedores.</p>
            </div>`;
    }

    // 4. Consejo de Habilidades Blandas (Pilar de "Storytelling" del documento)
    if (res.foundSoft.length < 3) {
        tipsHTML += `
            <div class="tip-card">
                <h4>🧠 Comunicación y Datos</h4>
                <p>El documento destaca el <strong>Storytelling con datos</strong>. No solo menciones la técnica, resalta cómo comunicas resultados para la toma de decisiones.</p>
            </div>`;
    }

    tipsHTML += `</div>`;
    
    // Botón de acción final
    tipsHTML += `
        <div style="margin-top: 20px; text-align: center;">
            
        </div>`;

    tipsDiv.innerHTML = tipsHTML;
}

function enviarResultadosPorEmail(email, res, position) {
    const messageDiv = document.getElementById('emailMessage');
    
    // Simulación de envío
    console.log(`Simulando envío a ${email} para la posición ${position}`);

    if (messageDiv) {
        messageDiv.style.display = 'block';
        messageDiv.innerHTML = `✅ Informe enviado a <strong>${email}</strong>. Revisa tu carpeta de spam si no lo ves.`;
        
        // Se oculta a los 6 segundos
        setTimeout(() => { messageDiv.style.display = 'none'; }, 6000);
    }
}