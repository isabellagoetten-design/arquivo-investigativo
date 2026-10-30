# API de Inteligência e Pesquisa

Este documento descreve as funções de backend da frente de Inteligência, Pesquisa e Dados. As funções exigem sessão Supabase autenticada (verify_jwt: true). A chave Gemini permanece exclusivamente no ambiente das Edge Functions.

## 1. Pesquisa web fundamentada

**Função:** `research-assistant`

**Objetivo:** pesquisar na web com Google Search grounding do Gemini, produzir uma síntese investigativa e devolver referências efetivamente retornadas pela API.

### Chamada pelo cliente

```js
const { data, error } = await supabase.functions.invoke("research-assistant", {
  body: {
    query: "Investigar a cronologia pública do caso ...",
    investigation_id: currentInvestigationId, // opcional
    research_depth: "dossie" // resumo | dossie | academico
  }
});
```

### Resposta de sucesso

```json
{
  "query": "consulta enviada",
  "research_depth": "dossie",
  "answer": "Síntese com referências [1], [2]...",
  "citations": [{ "ref": 1, "url": "https://...", "title": "Título da fonte" }],
  "search_queries": ["consultas efetivamente executadas"],
  "grounded": true,
  "saved_sources": 2,
  "saved_to_investigation": true,
  "researched_at": "2026-10-30T..."
}
```

### Persistência

- Sem `investigation_id`: a função apenas retorna a pesquisa e as referências.
- Com `investigation_id`: valida a propriedade da investigação e salva as fontes em `public.sources`.
- Fontes já existentes com a mesma URL na mesma investigação são ignoradas na verificação prévia.
- A função não cria automaticamente dossiês, tópicos, conexões ou eventos de linha do tempo.

### Profundidades

| Valor | Resultado |
|---|---|
| `resumo` | Síntese, fatos documentados e lacunas |
| `dossie` | Síntese, contexto, cronologia, atores, evidências, divergências e questões abertas |
| `academico` | Análise aprofundada, conceitos, metodologia, divergências e bibliografia comentada |

### Tratamento editorial

O prompt exige priorizar fontes primárias e institucionais, distinguir fato documentado de alegação e inferência, procurar divergências e declarar limitações. As citações são vinculadas aos metadados de grounding retornados pelo Gemini; não são URLs inventadas pelo modelo.

## 2. Consulta a documentos privados

**Função:** `document-chat`

**Objetivo:** responder perguntas usando trechos dos PDFs privados do usuário.

```js
const { data, error } = await supabase.functions.invoke("document-chat", {
  body: {
    question: "Quais fatos o documento registra sobre ...?",
    document_ids: [] // vazio consulta todos os PDFs do usuário
  }
});
```

A recuperação usa a função SQL `public.search_library_document_chunks`, que usa busca textual PostgreSQL em português, aceita termos alternativos com OR, ordena trechos por relevância (`ts_rank_cd`), limita o resultado a 20 trechos, restringe a busca ao usuário autenticado e respeita a seleção opcional de documentos.

**Importante:** a busca é textual ranqueada, não embeddings nem recuperação semântica. A extensão pgvector não está instalada neste projeto.

## 3. Custos e limites

A função `research-assistant` habilita Google Search grounding. O Google informa que, para Gemini 3 e modelos posteriores, a cobrança considera cada consulta de busca executada pelo modelo. A documentação consultada informa uma franquia mensal compartilhada e cobrança após o limite; conferir a tabela vigente antes de liberar a funcionalidade para uso amplo:

- https://ai.google.dev/gemini-api/docs/google-search
- https://ai.google.dev/gemini-api/docs/models

Não chamar a função automaticamente em carregamentos de página. Ela deve ser acionada por uma ação explícita do usuário.

## 4. Estado de integração

- Backend `research-assistant`: publicado, versão 2.
- Backend `document-chat`: publicado, versão 8.
- Migração de busca textual ranqueada: aplicada.
- Integração da interface com `research-assistant`: pendente.
- Teste ponta a ponta com sessão real: pendente.

A interface deve renderizar `answer` como texto seguro, exibir `citations` como links clicáveis e informar quando `grounded` for falso. Não renderizar HTML retornado pelo modelo.
