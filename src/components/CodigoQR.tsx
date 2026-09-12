import QRCode from 'qrcode'

/** Genera el QR en el servidor: no hace falta enviar la librería al navegador. */
export async function CodigoQR({ valor, tamano = 220 }: { valor: string; tamano?: number }) {
  const dataUrl = await QRCode.toDataURL(valor, {
    width: tamano,
    margin: 1,
    errorCorrectionLevel: 'M',
  })
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt="Código QR" width={tamano} height={tamano} />
}
