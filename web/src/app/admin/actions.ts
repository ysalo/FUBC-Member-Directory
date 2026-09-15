"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireEditor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const value = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const allowedPhotoTypes = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);

async function uploadPhoto(supabase: Awaited<ReturnType<typeof createClient>>, photo: FormDataEntryValue | null) {
  if (!(photo instanceof File) || photo.size === 0) return null;
  const extension = allowedPhotoTypes.get(photo.type);
  if (!extension) throw new Error("Photos must be JPG, PNG, or WebP files.");
  if (photo.size > 4 * 1024 * 1024) throw new Error("Photos must be 4 MB or smaller.");

  const path = `${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("member-photos").upload(path, photo, {
    contentType: photo.type,
    upsert: false,
  });
  if (error) throw new Error("Unable to upload this photo.");
  return path;
}

export async function addMember(formData: FormData) {
  const { supabase } = await requireEditor();

  const firstName = value(formData, "firstName");
  const lastName = value(formData, "lastName");
  if (!firstName || !lastName) throw new Error("First and last name are required.");

  const photoPath = await uploadPhoto(supabase, formData.get("photo"));

  const { error } = await supabase.from("people").insert({
    first_name: firstName,
    last_name: lastName,
    date_of_birth: value(formData, "dateOfBirth") || null,
    phone: value(formData, "phone") || null,
    address_line_1: value(formData, "addressLine1") || null,
    city: value(formData, "city") || null,
    state: value(formData, "state") || null,
    postal_code: value(formData, "postalCode") || null,
    photo_path: photoPath,
  });
  if (error) {
    if (photoPath) await supabase.storage.from("member-photos").remove([photoPath]);
    throw new Error("Unable to add this member.");
  }

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function updateMember(memberId: string, formData: FormData) {
  const { supabase } = await requireEditor();
  const firstName = value(formData, "firstName");
  const lastName = value(formData, "lastName");
  if (!firstName || !lastName) throw new Error("First and last name are required.");

  const { data: current, error: loadError } = await supabase
    .from("people")
    .select("photo_path")
    .eq("id", memberId)
    .single();
  if (loadError) throw new Error("Unable to load this member.");

  const newPhotoPath = await uploadPhoto(supabase, formData.get("photo"));
  const removePhoto = value(formData, "removePhoto") === "on";
  const photoPath = newPhotoPath ?? (removePhoto ? null : current.photo_path);
  const { error } = await supabase.from("people").update({
    first_name: firstName,
    last_name: lastName,
    date_of_birth: value(formData, "dateOfBirth") || null,
    phone: value(formData, "phone") || null,
    address_line_1: value(formData, "addressLine1") || null,
    address_line_2: value(formData, "addressLine2") || null,
    city: value(formData, "city") || null,
    state: value(formData, "state") || null,
    postal_code: value(formData, "postalCode") || null,
    notes: value(formData, "notes") || null,
    photo_path: photoPath,
    updated_at: new Date().toISOString(),
  }).eq("id", memberId);

  if (error) {
    if (newPhotoPath) await supabase.storage.from("member-photos").remove([newPhotoPath]);
    throw new Error("Unable to update this member.");
  }
  if (current.photo_path && !current.photo_path.startsWith("/") && current.photo_path !== photoPath) {
    await supabase.storage.from("member-photos").remove([current.photo_path]);
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/admin/${memberId}`);
  redirect("/admin");
}

export async function archiveMember(memberId: string) {
  const { supabase } = await requireEditor();
  const { error } = await supabase.from("people").update({
    archived_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", memberId);
  if (error) throw new Error("Unable to archive this member.");
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function restoreMember(memberId: string) {
  const { supabase } = await requireEditor();
  const { error } = await supabase.from("people").update({
    archived_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", memberId);
  if (error) throw new Error("Unable to restore this member.");
  revalidatePath("/");
  revalidatePath("/admin");
}
