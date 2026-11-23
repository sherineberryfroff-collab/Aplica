/**
 * Seguimiento de vídeos en Google Sheets (capítulo 07, paso 4) — gratis.
 *
 * 1. Crea una Google Sheet llamada "Montajes" con estas columnas en la fila 1:
 *    Fecha | Título | Cuenta/receta | Duración (s) | Archivo | Estado
 * 2. Extensiones → Apps Script → pega este código.
 * 3. Cambia CLAVE por una cadena aleatoria larga (la misma que SHEET_KEY en config.env).
 * 4. Implementar → Nueva implementación → Tipo "Aplicación web"
 *    Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario.
 * 5. Copia la URL que termina en /exec en SHEET_WEBHOOK_URL de config.env.
 */
const CLAVE = 'CAMBIA-ESTO-por-una-clave-larga-aleatoria';

function doPost(e) {
  const datos = JSON.parse(e.postData.contents);
  if (datos.key !== CLAVE) {
    return ContentService.createTextOutput('no autorizado');
  }
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  hoja.appendRow([
    new Date(),
    datos.titulo || '',
    datos.cuenta || '',
    datos.duracion || '',
    datos.archivo || '',
    datos.estado || 'listo, no publicado',
  ]);
  return ContentService.createTextOutput('ok');
}
