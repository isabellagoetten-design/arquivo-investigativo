# API de Inteligência e Pesquisa

Este documento descreve as funções de backend da frente de Inteligência, Pesquisa e Dados. As funções exigem sessão Supabase autenticada (verify_jwt: true). A chave Gemini permanece exclusivamente no ambiente das Edge Functions. As funções usam o modelo `gemini-3.8-flash` e a configuração de geração compatível com essa versão da API.

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

- Backend `research-assistant`: publicado, versão 3.
- Backend `evidence-audit`: publicado, versão 2.
- Backend `research-structure`: publicado, versão 2.
- Backend `document-chat`: publicado, versão 9.
- Migração de busca textual ranqueada: aplicada.
- Interface do dossiê conectada a `research-assistant`: implementada.
- Interface de revisão conectada a `research-structure`: implementada.
- Aprovação e persistência conectadas à RPC `accept_research_proposals`: implementadas.
- Atlas atualizado para exibir relações da tabela `connections`.
- Máquina do Tempo atualizada para exibir datas parciais ou desconhecidas.
- Persistência de datas revisada para validar datas reais e preservar mês/ano sem inventar precisão.
- Teste ponta a ponta com sessão real e navegação no navegador: pendente.

A interface deve renderizar `answer` como texto seguro, exibir `citations` como links clicáveis e informar quando `grounded` for falso. Não renderizar HTML retornado pelo modelo.


## 5. Estruturação para Atlas e linha do tempo

**Função:** `research-structure`

**Objetivo:** transformar uma pesquisa já revisada em propostas estruturadas de entidades, acontecimentos, relações e perguntas em aberto.

### Chamada pelo cliente

```js
const { data, error } = await supabase.functions.invoke("research-structure", {
  body: {
    research_text: researchResult.answer,
    citations: researchResult.citations,
    investigation_id: currentInvestigationId // opcional, apenas valida propriedade
  }
});
```

### Resposta

A função retorna:

- `entities`: pessoas, organizações, lugares, acontecimentos e conceitos;
- `events`: datas e acontecimentos para a linha do tempo;
- `relationships`: relações propostas entre entidades;
- `open_questions`: pontos que exigem nova apuração;
- `evidence_refs`: referências que sustentam cada proposta;
- `confidence`: nível de confiança indicado pelo modelo.

**Segurança editorial:** a função retorna `proposals_only: true`, `requires_human_review: true` e `persisted: false`. Não grava automaticamente tópicos, conexões, perfis ou eventos. A interface deve permitir revisar, editar e aceitar cada proposta antes de persistir.


## 6. Aprovação e persistência das propostas

**RPC:** `public.accept_research_proposals`

A pesquisa estruturada não é gravada automaticamente. Depois da revisão do usuário, a interface envia somente as propostas aceitas:

```js
const { data, error } = await supabase.rpc("accept_research_proposals", {
  p_investigation_id: currentInvestigationId,
  p_citations: acceptedResearch.citations,
  p_entities: acceptedEntities,
  p_events: acceptedEvents,
  p_relationships: acceptedRelationships
});
```

A operação é transacional. Ela:

1. Confirma que a investigação pertence ao usuário autenticado.
2. Salva ou reutiliza fontes da mesma investigação.
3. Cria entidades aprovadas em `topics`, com tipo e confiança.
4. Cria acontecimentos aprovados em `timeline_events`, preservando datas parciais sem inventar dia ou mês.
5. Cria relações entre entidades aprovadas em `connections`.
6. Registra a origem de cada proposta em `research_evidence_links`, associando fonte e número de referência à entidade, evento ou conexão.

### Resposta

```json
{
  "persisted": true,
  "investigation_id": "uuid",
  "saved_sources": 3,
  "saved_entities": 5,
  "saved_events": 4,
  "saved_relationships": 2,
  "saved_evidence_links": 11
}
```

### Segurança e integridade

- A RPC exige usuário autenticado e verifica a propriedade da investigação.
- A execução foi revogada para `anon` e concedida a `authenticated`.
- `research_evidence_links` tem RLS e só aceita fonte e destino da mesma investigação e do mesmo usuário.
- Eventos da linha do tempo também validam a propriedade da investigação.
- Os registros de evidência são imutáveis pela API comum; podem ser removidos pelo proprietário.
- A operação não aceita relações cujas duas entidades não tenham sido aprovadas no mesmo lote.

### Estado desta etapa

- Migrações de persistência e segurança: aplicadas.
- Verificação de privilégios: autenticado pode executar; anônimo não pode.
- RLS de evidências: habilitada.
- Integração da RPC na interface do dossiê: implementada.
- Teste ponta a ponta com uma sessão real: pendente.

A interface deve mostrar uma prévia editável e pedir confirmação antes de chamar a RPC. Nunca enviar todas as propostas automaticamente.


## 7. Auditoria cruzada de evidências

**Função:** `evidence-audit` (versão 3)

**Objetivo:** comparar resumos de evidências já vinculados a fontes diferentes dentro de uma investigação e apontar possíveis contradições, divergências, inconsistências cronológicas, corroborações e lacunas.

### Chamada

```js
const { data, error } = await supabase.functions.invoke("evidence-audit", {
  body: { investigation_id: currentInvestigationId }
});
```

### Comportamento

- Exige sessão autenticada e valida a propriedade da investigação.
- Consulta somente vínculos de evidência da investigação indicada.
- Não executa análise quando não há pelo menos dois registros de evidência provenientes de duas fontes distintas.
- Retorna sinalizações com os IDs das evidências que sustentam cada ponto e uma etapa sugerida de verificação.
- Não grava conclusões, não altera registros e exige revisão humana.
- Não acessa novamente o conteúdo integral das páginas originais.

**Limitação importante:** `research_evidence_links.evidence_excerpt` recebe descrições/resumos extraídos pela IA durante a estruturação. A própria coluna está documentada no banco como paráfrase de IA. Esses textos não são citações literais. A auditoria compara esses resumos e os metadados das fontes; ela não certifica que o conteúdo original foi relido.

### Categorias retornadas

- `direct_contradiction`: afirmações explicitamente incompatíveis sobre o mesmo fato;
- `factual_discrepancy`: divergência de detalhe;
- `chronology_inconsistency`: possível incompatibilidade cronológica;
- `unsupported_claim`: afirmação sem apoio suficiente nos registros analisados;
- `corroboration`: possível apoio independente;
- `source_dependence`: possível dependência entre fontes.

A ausência de informação em uma fonte não é tratada automaticamente como contradição. A análise não conclui culpa, intenção ou responsabilidade jurídica.

### Estado desta etapa

- Edge Function `evidence-audit`: publicada, versão 3.
- Painel de auditoria cruzada no dossiê: implementado.
- RLS e permissões da tabela de evidências: acesso anônimo revogado e atualização direta bloqueada.
- Índice para `research_evidence_links.user_id`: criado.
- Evidências atualmente registradas no banco: 0. A função só produzirá uma comparação depois que houver evidências aprovadas de pelo menos duas fontes.
- Teste ponta a ponta com sessão real: pendente.
