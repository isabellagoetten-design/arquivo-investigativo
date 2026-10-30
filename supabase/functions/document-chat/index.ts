import { withSupabase } from "npm:@supabase/server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: cors });

Deno.serve(withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const { data: authData, error: authError } = await ctx.supabase.auth.getUser();
    const userId = authData?.user?.id;
    if (authError || !userId) {
      return json({ code: "AUTH_REQUIRED", error: "Sua sessão expirou. Entre novamente para consultar seus documentos." }, 401);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ code: "INVALID_JSON", error: "Não foi possível interpretar a solicitação." }, 400);
    }

    const question = body.question;
    const requestedIds = body.document_ids ?? [];
    if (typeof question !== "string" || question.trim().length < 3 || question.length > 2000) {
      return json({ code: "INVALID_QUESTION", error: "Escreva uma pergunta entre 3 e 2.000 caracteres." }, 400);
    }
    if (!Array.isArray(requestedIds) || requestedIds.length > 20 ||
        requestedIds.some((id) => typeof id !== "string" || id.length > 80)) {
      return json({ code: "INVALID_DOCUMENTS", error: "A seleção de documentos é inválida. Atualize a página e tente novamente." }, 400);
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return json({ code: "AI_KEY_MISSING", error: "A chave da IA não está configurada no Supabase." }, 503);
    }

    let query = ctx.supabase
      .from("library_document_chunks")
      .select("document_id,page_number,content")
      .eq("user_id", userId)
      .limit(12);

    if (requestedIds.length) query = query.in("document_id", requestedIds);

    const terms = question.toLocaleLowerCase("pt-BR")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word: string) => word.length > 3)
      .slice(0, 8);

    if (terms.length) {
      query = query.textSearch("content", terms.join(" | "), {
        type: "websearch",
        config: "portuguese",
      });
    }

    const { data: chunks, error: chunksError } = await query;
    if (chunksError) {
      console.error("document-chat retrieval failed", chunksError.code ?? "DB_ERROR");
      return json({ code: "DOCUMENT_SEARCH_ERROR", error: "Não foi possível pesquisar os documentos agora. Tente novamente." }, 500);
    }

    if (!chunks?.length) {
      return json({
        answer: "Não encontrei trechos relevantes nos PDFs selecionados. Reformule a pergunta ou confira se os documentos têm texto selecionável.",
        citations: [],
        grounded: false,
      });
    }

    const documentIds = [...new Set(chunks.map((chunk: { document_id: string }) => chunk.document_id))];
    const { data: docs, error: docsError } = await ctx.supabase
      .from("library_documents")
      .select("id,title,author")
      .eq("user_id", userId)
      .in("id", documentIds);

    if (docsError) {
      console.error("document-chat metadata lookup failed", docsError.code ?? "DB_ERROR");
      return json({ code: "DOCUMENT_METADATA_ERROR", error: "Não foi possível carregar as referências dos documentos." }, 500);
    }

    const evidence = chunks.map((chunk: { document_id: string; page_number: number | null; content: string }, index: number) => {
      const doc = docs?.find((item: { id: string }) => item.id === chunk.document_id);
      return {
        ref: index + 1,
        document: doc?.title ?? "Documento",
        author: doc?.author ?? "Autoria não informada",
        page: chunk.page_number,
        excerpt: String(chunk.content ?? "").slice(0, 1800),
      };
    });

    const evidenceText = evidence.map((item) =>
      `[${item.ref}] Documento: ${item.document}; autor: ${item.author}; página: ${item.page ?? "não identificada"}\n${item.excerpt}`
    ).join("\n\n");

    const prompt = `Você é o assistente de pesquisa do Arquivo Investigativo. Responda em português brasileiro, com clareza e precisão.
REGRAS:
- Use exclusivamente as evidências fornecidas abaixo.
- Não invente fatos, páginas, autores ou referências.
- Se as evidências não responderem à pergunta, diga explicitamente que não há informação suficiente.
- Diferencie afirmações presentes na fonte de inferências.
- Cite afirmações factuais usando somente os números de referência disponíveis, no formato [1].
- Ao final, inclua "Fontes consultadas", com título e página.
- Não reproduza longos trechos literalmente.

PERGUNTA:
${question.trim()}

EVIDÊNCIAS:
${evidenceText}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 900 },
          }),
          signal: controller.signal,
        },
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return json({
          code: "AI_TIMEOUT",
          error: "A IA não respondeu dentro do tempo disponível. Seus documentos continuam salvos. Tente novamente em instantes.",
        }, 504);
      }
      console.error("document-chat provider connection failed");
      return json({ code: "AI_CONNECTION_ERROR", error: "Não foi possível conectar ao serviço de IA. Tente novamente." }, 503);
    } finally {
      clearTimeout(timeout);
    }

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const providerStatus = response.status;
      console.error("Gemini request failed", providerStatus, result?.error?.status ?? "unknown");
      if (providerStatus === 429 || providerStatus === 503 || providerStatus === 504) {
        return json({
          code: "AI_BUSY",
          error: "O serviço de IA está temporariamente ocupado. Seus documentos continuam salvos. Aguarde um pouco e tente novamente.",
        }, 503);
      }
      return json({
        code: "AI_PROVIDER_ERROR",
        error: "O serviço de IA recusou a solicitação. Verifique a configuração da integração ou tente novamente mais tarde.",
      }, 502);
    }

    const answer = result.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();

    if (!answer) {
      return json({
        code: "AI_EMPTY_RESPONSE",
        error: "A IA não retornou uma resposta utilizável. Reformule a pergunta e tente novamente.",
      }, 502);
    }

    return json({
      answer,
      citations: evidence.map((item) => ({
        ref: item.ref,
        document: item.document,
        page: item.page,
      })),
      grounded: true,
    });
  } catch (error) {
    console.error("document-chat unexpected error", error instanceof Error ? error.message : "unknown");
    return json({
      code: "DOCUMENT_CHAT_ERROR",
      error: "Não foi possível consultar os documentos agora. Tente novamente mais tarde.",
    }, 500);
  }
}));
