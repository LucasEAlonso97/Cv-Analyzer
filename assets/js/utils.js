/**
 * - UTILIDADES GLOBALES
 * Este archivo contiene funciones auxiliares para formateo, 
 * validación y manipulación de interfaz.
 */

/**
 * 1. FORMATEO DE FECHAS
 * Convierte un objeto Date en un string legible: "24 May, 2025 - 14:30"
 */
export const formatDate = (date) => {
    return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(date));
};

/**
 * 2. NORMALIZACIÓN DE TEXTO
 * Limpia el texto de acentos, caracteres especiales y lo pasa a minúsculas
 * Vital para que el motor de búsqueda de palabras clave no falle.
 */
export const normalizeText = (text) => {
    if (!text) return "";
    return text.toLowerCase()
               .normalize("NFD") // Separa los acentos de las letras
               .replace(/[\u0300-\u036f]/g, "") // Borra los acentos
               .replace(/[^a-z0-9\s]/g, ""); // Borra todo lo que no sea letra o número
};

/**
 * 3. VALIDACIÓN DE EMAIL
 * Valida si el formato de correo electrónico es correcto.
 */
export const isValidEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

/**
 * 4. LÓGICA DE COLORES DE PUNTAJE
 * Devuelve el color hexadecimal según el score obtenido.
 */
export const getScoreColor = (score) => {
    if (score >= 75) return '#4cd137'; // Verde (Success)
    if (score >= 50) return '#f39c12'; // Naranja (Warning)
    return '#e74c3c'; // Rojo (Error)
};

/**
 * 5. GENERADOR DE IDS ÚNICOS
 * Útil para identificar registros en el historial sin usar base de datos.
 */
export const generateUniqueId = () => {
    return `uid-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

/**
 * 6. MANEJO DE NOTIFICACIONES SIMPLES
 * Una forma rápida de mostrar mensajes sin usar alerts nativos feos.
 */
export const showStatusMessage = (elementId, message, type = 'success') => {
    const container = document.getElementById(elementId);
    if (!container) return;

    container.textContent = message;
    container.className = `status-msg ${type}`; // Debes tener estas clases en tu CSS
    container.style.display = 'block';

    setTimeout(() => {
        container.style.display = 'none';
    }, 4000);
};