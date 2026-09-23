import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";

type RenderedImage = Awaited<ReturnType<ReturnType<typeof ImageManipulator.manipulate>["renderAsync"]>>;

async function encodePhoto(image: RenderedImage, limit: number) {
    for (const compress of [0.8, 0.75, 0.7]) {
        const output = await image.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
        try {
            if (!output.base64) throw new Error("Photo encoding failed.");
            const binary = atob(output.base64);
            if (binary.length === 0) throw new Error("Photo encoding failed.");
            if (binary.length > limit) continue;
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
            return { bytes: bytes.buffer, uri: `data:image/jpeg;base64,${output.base64}` };
        } finally {
            if (output.uri.startsWith("file://")) new File(output.uri).delete();
            else if (output.uri.startsWith("blob:")) URL.revokeObjectURL(output.uri);
        }
    }
    throw new Error("Photo cannot fit the upload limit. Choose a simpler or smaller image.");
}

export async function createPhotoRenditions(uri: string) {
    const context = ImageManipulator.manipulate(uri);
    let original: RenderedImage | undefined;
    let profile: RenderedImage | undefined;
    try {
        original = await context.renderAsync();
        const longest = Math.max(original.width, original.height);
        if (!Number.isFinite(longest) || Math.min(original.width, original.height) < 1) throw new Error("Invalid photo dimensions.");
        if (longest > 1280) {
            const scale = 1280 / longest;
            context.resize({ width: Math.max(1, Math.round(original.width * scale)), height: Math.max(1, Math.round(original.height * scale)) });
        }
        profile = await context.renderAsync();
        const encoded = await encodePhoto(profile, 512 * 1024);
        const thumbnail = await createPhotoThumbnail(original);
        return { ...encoded, thumbnail, mimeType: "image/jpeg" as const };
    } finally { profile?.release(); original?.release(); context.release(); }
}

export async function createPhotoThumbnail(uri: string | RenderedImage): Promise<ArrayBuffer> {
    const context = ImageManipulator.manipulate(uri);
    let original: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
    try {
        original = await context.renderAsync();
        const side = Math.min(original.width, original.height);
        context.crop({ originX: Math.floor((original.width - side) / 2), originY: Math.floor((original.height - side) / 2), width: side, height: side });
        context.resize({ width: Math.min(256, side), height: Math.min(256, side) });
        const thumbnail = await context.renderAsync();
        try {
            return (await encodePhoto(thumbnail, 50 * 1024)).bytes;
        } finally { thumbnail.release(); }
    } finally { original?.release(); context.release(); }
}