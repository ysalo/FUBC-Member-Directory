import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";

export async function createPhotoThumbnail(uri: string): Promise<ArrayBuffer> {
    const context = ImageManipulator.manipulate(uri);
    let original: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
    try {
        original = await context.renderAsync();
        const side = Math.min(original.width, original.height);
        context.crop({ originX: Math.floor((original.width - side) / 2), originY: Math.floor((original.height - side) / 2), width: side, height: side });
        context.resize({ width: Math.min(256, side), height: Math.min(256, side) });
        const thumbnail = await context.renderAsync();
        try {
            const output = await thumbnail.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
            try {
                if (!output.base64) throw new Error("Thumbnail encoding failed.");
                const binary = atob(output.base64);
                const bytes = new Uint8Array(binary.length);
                for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
                return bytes.buffer;
            } finally {
                if (output.uri.startsWith("file://")) new File(output.uri).delete();
                else if (output.uri.startsWith("blob:")) URL.revokeObjectURL(output.uri);
            }
        } finally { thumbnail.release(); }
    } finally { original?.release(); context.release(); }
}