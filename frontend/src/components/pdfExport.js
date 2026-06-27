/**
 * usePdfExport — genera un PDF del contenido de un elemento HTML.
 * Usa html2canvas + jsPDF cargados dinámicamente desde CDN.
 */

async function loadScript(src) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export async function exportToPdf(elementId, filename = 'reporte.pdf', title = '') {
  // Cargar librerías dinámicamente si no están
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

  const el = document.getElementById(elementId);
  if (!el) throw new Error('Elemento no encontrado: ' + elementId);

  // Capturar el elemento como imagen
  const canvas = await window.html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageW - margin * 2;

  // Header
  pdf.setFillColor(42, 120, 214);
  pdf.rect(0, 0, pageW, 18, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('InduTech Optimizer', margin, 12);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(title || filename, pageW - margin, 12, { align: 'right' });

  // Footer
  const footerY = pageH - 8;
  pdf.setFillColor(240, 238, 235);
  pdf.rect(0, footerY - 4, pageW, 12, 'F');
  pdf.setTextColor(137, 135, 129);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Generado el ${new Date().toLocaleString('es-AR')}`, margin, footerY + 1);
  pdf.text('InduTech Optimizer · UTN FRVM', pageW - margin, footerY + 1, { align: 'right' });

  // Contenido paginado
  const imgW = contentW;
  const imgH = (canvas.height * contentW) / canvas.width;
  const startY = 22;
  const availH = footerY - startY - 6;

  if (imgH <= availH) {
    pdf.addImage(imgData, 'PNG', margin, startY, imgW, imgH);
  } else {
    // Multi-página: cortar la imagen en segmentos
    const totalPages = Math.ceil(imgH / availH);
    for (let i = 0; i < totalPages; i++) {
      if (i > 0) {
        pdf.addPage();
        // Repetir header/footer en cada página
        pdf.setFillColor(42, 120, 214);
        pdf.rect(0, 0, pageW, 18, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text('InduTech Optimizer', margin, 12);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.text(`${title || filename} — pág. ${i + 1}`, pageW - margin, 12, { align: 'right' });
        pdf.setFillColor(240, 238, 235);
        pdf.rect(0, footerY - 4, pageW, 12, 'F');
        pdf.setTextColor(137, 135, 129);
        pdf.setFontSize(8);
        pdf.text(`Generado el ${new Date().toLocaleString('es-AR')}`, margin, footerY + 1);
        pdf.text('InduTech Optimizer · UTN FRVM', pageW - margin, footerY + 1, { align: 'right' });
      }
      pdf.addImage(
        imgData, 'PNG',
        margin, startY - i * availH,
        imgW, imgH,
        '', 'FAST'
      );
    }
  }

  pdf.save(filename);
}
