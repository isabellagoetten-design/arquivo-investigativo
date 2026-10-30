import { withSupabase } from "npm:@supabase/server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });

const depthInstructions: Record<string, string> = {
  resumo: "Produza um resumo investigativo objetivo, com contexto, fatos documentados e lacunas.",
  dossie: "Organize em síntese, contexto, cronologia, atores/instituições, evidências, divergências e perguntas em aberto.",
  academico: "Produza análise aprofundada, com contexto histórico, conceitos, metodologia das fontes, divergências, limitações e bibliografia comentada.",
};

function addInlineReferences(
  answer: string,
  supports: Array<{ segment?: { endIndex?: number }; groundingChunkIndices?: number[] }>,
  refMap: Map<number, number>,
) {
  const byPosition = new Map<number, Set<number>>();
  for (const support of supports ?? []) {
    const end = support.segment?.endIndex;
    if (typeof end !== "number" || end < 0 || end > answer.length) continue;
    const refs = (support.groundingChunkIndices ?? [])
      .map((index) => refMap.get(index))
      .filter((ref): ref is number => typeof ref === "number");
    if (!refs.length) continue;
    if (!byPosition.has(end)) byPosition.set(end, new Set());
    for (const ref of refs) byPosition.get(end)!.add(ref);
  }
  const insertions = [...byPosition.entries()].sort((a, b) => b[0] - a[0]);
  let result = answer;
  for (const [index, refs] of insertions) {
    result = result.slice(0, index) + " " + [...refs].map((n) => "[" + n + "]").join("") + result.slice(index);
  }
  return result;
}

Deno.serve(withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED", error: "Método não permitido." }, 405);

  try {
    const { data: authData, error: authError } = await ctx.supabase.auth.getUser();
    const userId = authData?.user?.id;
    if (authError || !userId) return json({ code: "AUTH_REQUIRED", error: "Sua sessão expirou. Entre novamente para pesquisar." }, 401);

    let body: Record<string, unknown>;
    try { body = await req.json(); }
    catch { return json({ code: "INVALID_JSON", error: "Não foi possível interpretar a solicitação." }, 400); }

    const query = body.query;
    const investigationId = body.investigation_id ?? null;
    const depth = typeof body.research_depth === "string" ? body.research_depth : "dossie";

    if (typeof query !== "string" || query.trim().length < 5 || query.length > 1200) {
      return json({ code: "INVALID_QUERY", error: "A pesquisa deve ter entre 5 e 1.200 caracteres." }, 400);
    }
    if (!Object.hasOwn(depthInstructions, depth)) return json({ code: "INVALID_DEPTH", error: "Profundidade de pesquisa inválida." }, 400);
    if (investigationId !== null && (typeof investigationId !== "string" || !/^[0-9a-f-]{36}$/i.test(investigationId))) {
      return json({ code: "INVALID_INVESTIGATION", error: "A investigação selecionada é inválida." }, 400);
    }

    if (investigationId) {
      const { data: investigation, error } = await ctx.supabase.from("investigations")
        .select("id").eq("id", investigationId).eq("user_id", userId).maybeSingle();
      if (error) {
        console.error("research-assistant investigation check failed", error.code ?? "DB_ERROR");
        return json({ code: "INVESTIGATION_CHECK_ERROR", error: "Não foi possível validar a investigação selecionada." }, 500);
      }
      if (!investigation) return json({ code: "INVESTIGATION_NOT_FOUND", error: "A investigação não existe ou não pertence à sua conta." }, 404);
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ code: "AI_KEY_MISSING", error: "A chave da IA não está configurada no Supabase." }, 503);

    const prompt = "Você é o módulo de pesquisa investigativa do Arquivo Investigativo. Realize pesquisa na web usando a ferramenta de busca habilitada; não responda apenas com conhecimento prévio.\n" +
      "Consulta: " + query.trim() + "\nProfundidade: " + depth + ". " + depthInstructions[depth] + "\n\n" +
      "PADRÃO DE PESQUISA:\n" +
      "- Priorize fontes primárias e institucionais: legislação, decisões judiciais, órgãos públicos, arquivos, bases oficiais, universidades e artigos científicos.\n" +
      "- Use veículos jornalísticos reconhecidos para contexto e apuração, identificando-os como fontes secundárias.\n" +
      "- Procure fontes independentes e, quando relevante, evidências que contradigam a hipótese inicial.\n" +
      "- Diferencie fato documentado, alegação, interpretação e inferência.\n" +
      "- Não trate ausência de resultado como prova de inexistência.\n" +
      "- Não invente nomes, datas, documentos, citações ou URLs.\n" +
      "- Não exponha dados pessoais sensíveis ou detalhes privados sem relevância pública.\n" +
      "- Indique quando uma fonte não permite confirmar uma afirmação.\n" +
      "- Se houver versões conflitantes, descreva a divergência sem escolher uma versão sem evidência.\n" +
      "- Escreva em português brasileiro, com subtítulos claros. Não invente números de referência; o sistema vinculará as citações aos resultados efetivamente retornados.\n" +
      "Finalize com uma seção Limitações e questões em aberto.";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    let upstream: Response;
    try {
      upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { maxOutputTokens: 3000 },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return json({ code: "RESEARCH_TIMEOUT", error: "A pesquisa excedeu o tempo disponível. Tente uma consulta mais específica." }, 504);
      }
      console.error("research-assistant provider connection failed");
      return json({ code: "AI_CONNECTION_ERROR", error: "Não foi possível conectar ao serviço de pesquisa." }, 503);
    } finally { clearTimeout(timeout); }

    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error("research-assistant provider failed", upstream.status, result?.error?.status ?? "unknown");
      if ([429, 503, 504].includes(upstream.status)) {
        return json({ code: "RESEARCH_PROVIDER_BUSY", error: "A pesquisa está temporariamente indisponível. Tente novamente mais tarde." }, 503);
      }
      return json({ code: "RESEARCH_PROVIDER_ERROR", error: "O serviço de pesquisa recusou a solicitação. Verifique a configuração da integração." }, 502);
    }

    const candidate = result.candidates?.[0];
    const answerText = candidate?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("").trim();
    if (!answerText) return json({ code: "EMPTY_RESEARCH", error: "A pesquisa não retornou conteúdo. Reformule a consulta." }, 502);

    const metadata = candidate?.groundingMetadata ?? {};
    const seen = new Set<string>();
    const refMap = new Map<number, number>();
    const citations: Array<{ ref: number; url: string; title: string }> = [];
    for (const [index, chunk] of (metadata.groundingChunks ?? []).entries()) {
      const url = chunk.web?.uri ?? "";
      if (!/^https?:\/\//i.test(url) || seen.has(url) || citations.length >= 20) continue;
      seen.add(url);
      const ref = citations.length + 1;
      refMap.set(index, ref);
      citations.push({ ref, url, title: chunk.web?.title ?? "Fonte sem título" });
    }

    const answer = addInlineReferences(answerText, metadata.groundingSupports ?? [], refMap);
    const searchQueries = Array.isArray(metadata.webSearchQueries) ? metadata.webSearchQueries.slice(0, 12) : [];

    let savedSources = 0;
    if (investigationId && citations.length) {
      const urls = citations.map((item: { url: string }) => item.url);
      const { data: existing, error: existingError } = await ctx.supabase.from("sources")
        .select("url").eq("user_id", userId).eq("investigation_id", investigationId).in("url", urls);
      if (existingError) {
        console.error("research-assistant existing source lookup failed", existingError.code ?? "DB_ERROR");
        return json({ code: "SOURCE_SAVE_CHECK_ERROR", error: "A pesquisa foi concluída, mas não foi possível verificar as fontes já salvas.", answer, citations, search_queries: searchQueries, grounded: citations.length > 0 }, 500);
      }

      const existingUrls = new Set((existing ?? []).map((item: { url: string }) => item.url));
      const rows = citations.filter((item: { url: string }) => !existingUrls.has(item.url)).map((item: { url: string; title: string; ref: number }) => ({
        user_id: userId,
        investigation_id: investigationId,
        title: item.title,
        url: item.url,
        source_type: "site",
        notes: "Fonte localizada pela pesquisa assistida do Arquivo Investigativo. Consulta: " + query.trim().slice(0, 500) + ". Referência: [" + item.ref + "].",
      }));

      if (rows.length) {
        const { error: insertError, data: inserted } = await ctx.supabase.from("sources").insert(rows).select("id");
        if (insertError) {
          console.error("research-assistant source save failed", insertError.code ?? "DB_ERROR");
          return json({ code: "SOURCE_SAVE_ERROR", error: "A pesquisa foi concluída, mas não foi possível salvar as fontes na investigação.", answer, citations, search_queries: searchQueries, grounded: citations.length > 0 }, 500);
        }
        savedSources = inserted?.length ?? rows.length;
      }
    }

    return json({
      query: query.trim(),
      research_depth: depth,
      answer,
      citations,
      search_queries: searchQueries,
      grounded: citations.length > 0,
      saved_sources: savedSources,
      saved_to_investigation: Boolean(investigationId),
      researched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("research-assistant unexpected error", error instanceof Error ? error.message : "unknown");
    return json({ code: "RESEARCH_ERROR", error: "Não foi possível concluir a pesquisa agora." }, 500);
  }
}));
