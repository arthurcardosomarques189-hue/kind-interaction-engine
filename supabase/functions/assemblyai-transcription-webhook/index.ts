import { createClient } from "npm:@supabase/supabase-js@2";

type Segment = { start: number; end: number; text: string };

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY_OLD")!;
const assemblyKey = Deno.env.get("ASSEMBLYAI_API_KEY")!;
const webhookSecret = Deno.env.get("ASSEMBLYAI_WEBHOOK_SECRET") ?? "";
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
      Authorization: "Bearer " + openAiKey,
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
            'Você é o motor do CORTES AI. Analise segmentos de uma transcrição e selecione até 5 trechos curtos e interessantes para Shorts, Reels e TikTok. Retorne apenas JSON válido no formato {"clips":[{"segmentStart":0,"segmentEnd":1,"title":"...","score":85}]}. Use somente índices de segmentos fornecidos. Prefira momentos com gancho, informação útil, emoção, surpresa ou conclusão forte. Cada corte deve ter entre 15 e 90 segundos quando houver material suficiente. Não invente fatos.',
        },
        { role: "user", content: input },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("Falha na análise de melhores momentos: " + response.status);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("A IA não retornou uma análise válida.");
  }
  return JSON.parse(content) as {
    clips?: Array<{
      segmentStart: number;
      segmentEnd: number;
      title: string;
      score: number;
    }>;
  };
}

function buildSegments(words: Array<{ start?: number; end?: number; text?: string }>) {
  const segments: Segment[] = [];

  for (const word of words) {
    const start = Number(word.start ?? 0) / 1000;
    const end = Number(word.end ?? 0) / 1000;
    const value = String(word.text ?? "").trim();

    if (!value || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

    const current = segments[segments.length - 1];
    if (current && start - current.end <= 1.2 && current.end - current.start < 12) {
      current.text = (current.text + " " + value).trim();
      current.end = end;
    } else {
      segments.push({ start, end, text: value });
    }
  }

  return segments.filter((segment) => segment.end > segment.start && segment.text);
}

async function processCompletedTranscript(transcriptId: string) {
  const transcriptResponse = await fetch(
    "https://api.assemblyai.com/v2/transcript/" + transcriptId,
    { headers: { authorization: assemblyKey } },
  );
  const transcript = await transcriptResponse.json();

  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id,user_id,video_path,transcription_job_id")
    .eq("transcription_job_id", transcriptId)
    .single();

  if (projectError || !project) {
    throw new Error("Projeto associado à transcrição não foi encontrado.");
  }

  if (transcript.status === "error") {
    await admin
      .from("projects")
      .update({
        status: "failed",
        transcription_status: "error",
        error_message: transcript.error ?? "Falha na transcrição.",
      })
      .eq("id", project.id);

    await admin.rpc("refund_processing_for_project", {
      target: project.user_id,
      project_id: project.id,
      amount: 5,
      reason: "transcription_provider_failed",
    });
    return;
  }

  if (transcript.status !== "completed") return;

  const text = typeof transcript.text === "string" ? transcript.text : "";
  const words = Array.isArray(transcript.words) ? transcript.words : [];
  const segments = buildSegments(words);

  if (!text || segments.length === 0) {
    throw new Error("A transcrição não trouxe segmentos com tempo suficiente para criar cortes.");
  }

  await admin.from("transcripts").delete().eq("project_id", project.id);
  const { error: transcriptError } = await admin.from("transcripts").insert({
    project_id: project.id,
    user_id: project.user_id,
    text,
    language: transcript.language ?? null,
  });
  if (transcriptError) throw transcriptError;

  await admin
    .from("projects")
    .update({
      progress: 65,
      transcription_status: "completed",
    })
    .eq("id", project.id);

  const indexedSegments = segments
    .slice(0, 300)
    .map(
      (segment, index) =>
        index +
        ": [" +
        segment.start.toFixed(2) +
        "s-" +
        segment.end.toFixed(2) +
        "s] " +
        segment.text,
    )
    .join("\n");

  const analysis = await openAiJson(
    "Selecione os melhores momentos desta transcrição segmentada.\n\n" +
      indexedSegments,
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

  const durationMinutes = Math.max(0, Number(transcript.audio_duration ?? 0) / 60);

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
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    const providedSecret = req.headers.get("X-AssemblyAI-Webhook-Secret") ?? "";
    if (!webhookSecret || providedSecret !== webhookSecret) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = (await req.json()) as {
      transcript_id?: string;
      status?: string;
    };

    if (!body.transcript_id) {
      return jsonResponse({ error: "transcript_id is required" }, 400);
    }

    EdgeRuntime.waitUntil(
      processCompletedTranscript(body.transcript_id).catch(async (error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Erro no processamento da transcrição";

        const { data: failedProject } = await admin
          .from("projects")
          .select("id,user_id")
          .eq("transcription_job_id", body.transcript_id)
          .single();

        if (failedProject) {
          await admin
            .from("projects")
            .update({
              status: "failed",
              transcription_status: "error",
              error_message: message,
            })
            .eq("id", failedProject.id);

          await admin.rpc("refund_processing_for_project", {
            target: failedProject.user_id,
            project_id: failedProject.id,
            amount: 5,
            reason: "transcription_processing_failed",
          });
        }
      }),
    );

    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: "Invalid webhook" }, 400);
  }
});
