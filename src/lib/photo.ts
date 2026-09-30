// Photos du journal des bocaux : réduites et compressées (JPEG ~150 Ko) avant d'être enregistrées.

export async function compresserPhoto(fichier: File, cote = 1280, qualite = 0.72): Promise<string> {
  const url = URL.createObjectURL(fichier);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ko(new Error("Cette image n'a pas pu être lue."));
      i.src = url;
    });
    // Le navigateur applique déjà l'orientation de la photo (EXIF).
    const r = Math.min(1, cote / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * r));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * r));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Cette image n'a pas pu être réduite.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', qualite);
  } finally {
    URL.revokeObjectURL(url);
  }
}
