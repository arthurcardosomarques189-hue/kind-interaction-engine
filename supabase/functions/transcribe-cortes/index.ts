import { createClient } from "npm:@supabase/supabase-js@2";

type Segment = {
  start: number;
  end: number;
  text: string;
};

type Job = { projectId: string };

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY_OLD")!;
const openAiKey = Deno.env.get("OPENAI_API_KEY")!;

const admin = createClient(supabaseUrl, serviceKey);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function openAiJson(input: string) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Você é o motor do CORTES AI. Analise segmentos de uma transcrição e selecione até 5 trechos curtos e interessantes para Shorts, Reels e TikTok. Retorne apenas JSON válido no formato {"clips":[{"segmentStart":0,"segmentEnd":1,"title":"...","score":85}]}. Use somente índices de segmentos fornecidos. Prefira momentos com gancho, informação útil, emoção, surpresa ou conclusão forte. Cada corte deve ter entre 15 e 90 segundos quando houver material suficiente. Não invente fatos.",
        },
        {
          role: "user",
          content: input,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha na análise de melhores momentos: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("A IA não retornou uma análise válida.");
  return JSON.parse(content) as {
    clips?: Array<{
      segmentStart: number;
      segmentEnd: number;
      title: string;
      score: number;
    }>;
  };
}

async function processProject(projectId: string) {
  const { data: project, error } = await admin
    .from("projects")
    .select("id,user_id,video_path")
    .eq("id", projectId)
    .single();

  if (error || !project?.video_path) {
    throw new Error("Projeto ou vídeo não encontrado.");
  }

  await admin
    .from("projects")
    .update({ status: "processing", progress: 30, error_message: null })
    .eq("id", project.id);

  const { data: video, error: downloadError } = await admin.storage
    .from("cortes-videos")
    .download(project.video_path);

  if (downloadError || !video) {
    throw new Error("Não foi possível baixar o vídeo.");
  }

  if (video.size > 24 * 1024 * 1024) {
    throw new Error(
      "Este MVP aceita vídeos de até 24 MB por processamento. Vamos adicionar processamento de arquivos maiores na próxima etapa.",
    );
  }

  const form = new FormData();
  form.append(
    "file",
    new File([video], "audio-source.mp4", {
      type: video.type || "video/mp4",
    }),
  );
  form.append("model", "gpt-4o-mini-transcribe");
  form.append("response_format", "verbose_json");

  const transcriptionResponse = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}` },
      body: form,
    },
  );

  if (!transcriptionResponse.ok) {
    throw new Error(`Falha na transcrição: ${transcriptionResponse.status}`);
  }

  const transcription = await transcriptionResponse.json();
  const text = typeof transcription.text === "string" ? transcription.text : "";
  const segments: Segment[] = Array.isArray(transcription.segments)
    ? transcription.segments
        .map((segment: Segment) => ({
          start: Number(segment.start),
          end: Number(segment.end),
          text: String(segment.text ?? "").trim(),
        }))
        .filter(
          (segment: Segment) =>
            Number.isFinite(segment.start) &&
            Number.isFinite(segment.end) &&
            segment.end > segment.start &&
            segment.text,
        )
    : [];

  if (!text || segments.length === 0) {
    throw new Error("A transcrição não trouxe segmentos com tempo suficiente para criar cortes.");
  }

  await admin.from("transcripts").delete().eq("project_id", project.id);
  const { error: transcriptError } = await admin.from("transcripts").insert({
    project_id: project.id,
    user_id: project.user_id,
    text,
    language: transcription.language ?? null,
  });

  if (transcriptError) throw transcriptError;

  await admin
    .from("projects")
    .update({ progress: 65 })
    .eq("id", project.id);

  const indexedSegments = segments
    .slice(0, 160)
    .map(
      (segment, index) =>
        `${index}: [${segment.start.toFixed(2)}s-${segment.end.toFixed(2)}s] ${segment.text}`,
    )
    .join("\n");

  const analysis = await openAiJson(
    `Selecione os melhores momentos desta transcrição segmentada.\n\n${indexedSegments}`,
  );

  const clips = (analysis.clips ?? [])
    .map((clip) => {
      const startIndex = Math.max(
        0,
        Math.min(segments.length - 1, Math.round(clip.segmentStart)),
      );
      const endIndex = Math.max(
        startIndex,
        Math.min(segments.length - 1, Math.round(clip.segmentEnd)),
      );
      const start = segments[startIndex].start;
      const end = segments[endIndex].end;
      return {
        project_id: project.id,
        user_id: project.user_id,
        title: String(clip.title || "Melhor momento").slice(0, 160),
        start_seconds: start,
        end_seconds: Math.min(end, start + 90),
        score: Math.max(0, Math.min(100, Math.round(Number(clip.score) || 70))),
        video_path: project.video_path,
      };
    })
    .filter((clip) => clip.end_seconds > clip.start_seconds + 3)
    .slice(0, 5);

  await admin.from("clips").delete().eq("project_id", project.id);

  if (clips.length > 0) {
    const { error: clipsError } = await admin.from("clips").insert(clips);
    if (clipsError) throw clipsError;
  }

  const durationMinutes = Math.max(
    0,
    (segments[segments.length - 1]?.end ?? 0) / 60,
  );

  await admin
    .from("projects")
    .update({
      status: "completed",
      progress: 100,
      cuts: clips.length,
      minutes: Math.round(durationMinutes * 100) / 100,
      error_message: null,
    })
    .eq("id", project.id);
}

Deno.serve(async (req) => {
  try {
    const body = (await req.json()) as Job;
    if (!body.projectId) return jsonResponse({ error: "projectId is required" }, 400);

    EdgeRuntime.waitUntil(
      processProject(body.projectId).catch(async (error) => {
        const message =
          error instanceof Error ? error.message : "Erro de processamento";
        const { data: failedProject } = await admin
          .from("projects")
          .update({
            status: "failed",
            error_message: message,
          })
          .eq("id", body.projectId)
          .select("user_id")
          .single();

        // The processing reservation was made before this async job started.
        // Refund it when the background job fails.
        if (failedProject?.user_id) {
          await admin.rpc("refund_processing_for_project", {
            target: failedProject.user_id,
            project_id: body.projectId,
            amount: 5,
            reason: "processing_failed",
          });
        }
      }),
    );

    return jsonResponse({
      ok: true,
      projectId: body.projectId,
      status: "processing",
    });
  } catch {
    return jsonResponse({ error: "Invalid request" }, 400);
  }
});
