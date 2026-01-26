import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function parseJsonMaybe(value: unknown) {
  if (!value) return null
  if (typeof value === "object") return value as Record<string, unknown>
  if (typeof value !== "string") return null
  try { return JSON.parse(value) } catch (_) { return null }
}

function getCourseModules(row: any) {
  const parsed = parseJsonMaybe(row?.modules)
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === "object") {
    const mods = (parsed as any).modules
    const items = (parsed as any).items
    if (Array.isArray(mods)) return mods
    if (Array.isArray(items)) return items
  }
  const fromData = parseJsonMaybe(row?.data)
  if (fromData && typeof fromData === "object" && Array.isArray((fromData as any).modules)) return (fromData as any).modules
  return []
}

function getModuleLessons(mod: any) {
  if (!mod) return []
  if (Array.isArray(mod.lessons)) return mod.lessons
  if (Array.isArray(mod.aulas)) return mod.aulas
  if (Array.isArray(mod.items)) return mod.items
  if (Array.isArray(mod.module_lessons)) return mod.module_lessons
  return []
}

function getLessonVideoId(lesson: any) {
  const v =
    lesson?.videoId ||
    lesson?.video_id ||
    lesson?.videoID ||
    lesson?.vdocipherVideoId ||
    lesson?.vdocipher_video_id ||
    lesson?.vdo_video_id ||
    (lesson?.metadata && (lesson.metadata.videoId || lesson.metadata.video_id)) ||
    (lesson?.media && (lesson.media.videoId || lesson.media.video_id)) ||
    null
  return typeof v === "string" ? v.trim() : ""
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 })

  try {
    const supabaseAuthClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
    )
    const supabaseAdminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const { data: userData } = await supabaseAuthClient.auth.getUser()
    const viewerId = userData?.user?.id
    if (!viewerId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 })
    }

    const body = await req.json().catch(() => ({} as any))
    const courseId = String(body?.courseId || "").trim()
    const moduleId = String(body?.moduleId || "").trim()
    const lessonId = String(body?.lessonId || "").trim()
    const moduleIndex = Number.isFinite(Number(body?.moduleIndex)) ? Number(body.moduleIndex) : -1
    const lessonIndex = Number.isFinite(Number(body?.lessonIndex)) ? Number(body.lessonIndex) : -1
    if (!courseId) return new Response(JSON.stringify({ error: "missing_course_id" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 })

    const { data: course, error: courseErr } = await supabaseAdminClient
      .from("courses")
      .select("id,user_id,modules,data")
      .eq("id", courseId)
      .maybeSingle()

    if (courseErr) return new Response(JSON.stringify({ error: "course_read_failed", details: courseErr.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 })
    if (!course) return new Response(JSON.stringify({ error: "not_found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 })

    const modules = getCourseModules(course)
    const modulesList = Array.isArray(modules) ? modules : []
    let pickedModule: any = null
    if (moduleId) {
      pickedModule = modulesList.find((m: any) => {
        const mid = String(m?.id || m?.module_id || m?.moduleId || "").trim()
        return mid && mid === moduleId
      }) || null
    }
    if (!pickedModule && lessonId) {
      for (const mod of modulesList) {
        const lessons = getModuleLessons(mod)
        for (const l of (Array.isArray(lessons) ? lessons : [])) {
          const lid = String(l?.id || l?.lesson_id || l?.lessonId || "").trim()
          if (lid && lid === lessonId) {
            pickedModule = mod
            break
          }
        }
        if (pickedModule) break
      }
    }
    if (!pickedModule && moduleIndex >= 0) pickedModule = modulesList[moduleIndex] || null
    if (!pickedModule) pickedModule = modulesList[0] || null

    const lessons = getModuleLessons(pickedModule)
    const lessonsList = Array.isArray(lessons) ? lessons : []
    let pickedLesson: any = null
    if (lessonId) {
      pickedLesson = lessonsList.find((l: any) => {
        const lid = String(l?.id || l?.lesson_id || l?.lessonId || "").trim()
        return lid && lid === lessonId
      }) || null
    }
    if (!pickedLesson && lessonIndex >= 0) pickedLesson = lessonsList[lessonIndex] || null
    if (!pickedLesson) pickedLesson = lessonsList[0] || null

    const videoProvider = String(pickedLesson?.videoProvider || pickedLesson?.video_provider || "").trim().toLowerCase()
    const videoId = getLessonVideoId(pickedLesson)
    if (videoProvider !== "vdocipher" || !videoId) {
      return new Response(JSON.stringify({ error: "video_not_configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 })
    }

    const producerUserId = String(course.user_id || "").trim()
    if (!producerUserId) return new Response(JSON.stringify({ error: "missing_producer" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 })

    const { data: settings, error: settingsErr } = await supabaseAdminClient
      .from("vdocipher_settings")
      .select("api_secret")
      .eq("user_id", producerUserId)
      .maybeSingle()

    if (settingsErr) return new Response(JSON.stringify({ error: "settings_read_failed", details: settingsErr.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 })
    const apiSecret = String(settings?.api_secret || "").trim()
    if (!apiSecret) return new Response(JSON.stringify({ error: "missing_vdocipher_settings" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 })

    const otpRes = await fetch(`https://dev.vdocipher.com/api/videos/${encodeURIComponent(videoId)}/otp`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Apisecret ${apiSecret}`,
      },
      body: JSON.stringify({ ttl: 300, userId: viewerId }),
    })

    if (!otpRes.ok) {
      const txt = await otpRes.text().catch(() => "")
      return new Response(JSON.stringify({ error: "otp_failed", details: txt }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 })
    }

    const otpJson = await otpRes.json().catch(() => ({} as any))
    const otp = String(otpJson?.otp || "").trim()
    const playbackInfo = String(otpJson?.playbackInfo || "").trim()
    if (!otp || !playbackInfo) return new Response(JSON.stringify({ error: "otp_invalid_response" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 })

    return new Response(JSON.stringify({ ok: true, otp, playbackInfo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: "unhandled_error", details: String(e) }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 })
  }
})
