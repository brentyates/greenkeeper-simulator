import { Scene } from "@babylonjs/core/scene";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Engine } from "@babylonjs/core/Engines/engine";

const MAX_DIMENSION = 4096;

export function createFileInput(
  accept: string,
  onFile: (file: File) => void
): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.style.display = "none";
  document.body.appendChild(input);

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) {
      onFile(file);
      input.value = "";
    }
  });

  return input;
}

export function loadImageAsTexture(
  file: File,
  scene: Scene,
  callback: (texture: RawTexture, width: number, height: number) => void
): void {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;

      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(w, h);
        w = Math.floor(w * scale);
        h = Math.floor(h * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const pixels = new Uint8Array(imageData.data.buffer);

      const texture = RawTexture.CreateRGBATexture(
        pixels, w, h, scene, false, false,
        Engine.TEXTURE_BILINEAR_SAMPLINGMODE
      );

      callback(texture, w, h);
    };
    img.src = reader.result as string;
  };
  reader.readAsDataURL(file);
}
