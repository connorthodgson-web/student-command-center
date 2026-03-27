import { NextResponse } from "next/server";
import {
  CLASS_MATERIALS_BUCKET,
  mapDbClassMaterial,
  normalizeClassMaterialInput,
  type ClassMaterialInput,
  type DbClassMaterialRow,
} from "../../../lib/class-materials";
import { extractTextFromFile } from "../../../lib/class-materials-extraction";
import { getAuthedSupabase } from "../../../lib/supabase/route-auth";

type CreateClassMaterialRequest = {
  material?: ClassMaterialInput;
};

type DeleteClassMaterialRequest = {
  id?: string;
};

export async function GET(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const classId = new URL(request.url).searchParams.get("classId");

  let query = supabase
    .from("class_materials")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (classId) {
    query = query.eq("class_id", classId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: ((data ?? []) as DbClassMaterialRow[]).map(mapDbClassMaterial),
  });
}

export async function POST(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const body = (await request.json()) as CreateClassMaterialRequest;

  if (!body.material) {
    return NextResponse.json({ error: "Material payload is required." }, { status: 400 });
  }

  try {
    let extractionFields: {
      extractedText?: string;
      extractionStatus?: "completed" | "failed" | "not_supported" | "not_needed";
      extractionError?: string;
    } = {};

    if (body.material.kind === "file" && body.material.storagePath) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(CLASS_MATERIALS_BUCKET)
        .download(body.material.storagePath);

      if (downloadError) {
        extractionFields = {
          extractionStatus: "failed",
          extractionError: downloadError.message,
        };
      } else {
        const fileBytes = Buffer.from(await fileData.arrayBuffer());
        extractionFields = await extractTextFromFile({
          fileName: body.material.fileName,
          mimeType: body.material.mimeType,
          bytes: fileBytes,
        });
      }
    } else if (body.material.kind === "note" && body.material.rawText) {
      extractionFields = {
        extractedText: body.material.rawText,
        extractionStatus: "not_needed",
      };
    }

    const payload = normalizeClassMaterialInput({
      ...body.material,
      ...extractionFields,
    });

    const { data: classRow, error: classError } = await supabase
      .from("classes")
      .select("id")
      .eq("id", payload.class_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (classError || !classRow) {
      return NextResponse.json(
        { error: "That class does not belong to this user." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("class_materials")
      .insert({
        user_id: userId,
        ...payload,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { data: mapDbClassMaterial(data as DbClassMaterialRow) },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid material payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const body = (await request.json()) as DeleteClassMaterialRequest;

  if (!body.id) {
    return NextResponse.json({ error: "Material id is required." }, { status: 400 });
  }

  const { data: material, error: loadError } = await supabase
    .from("class_materials")
    .select("*")
    .eq("id", body.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (loadError || !material) {
    return NextResponse.json({ error: "Material not found." }, { status: 404 });
  }

  const { error } = await supabase
    .from("class_materials")
    .delete()
    .eq("id", body.id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = material as DbClassMaterialRow;
  if (row.storage_path) {
    await supabase.storage.from(CLASS_MATERIALS_BUCKET).remove([row.storage_path]);
  }

  return NextResponse.json({ success: true });
}
