// The when-to-use-which table every connected coding agent reads, sent by the
// MCP server and repeated by the skill. It sits with the harness files, which
// install copies flat. Hosted agents get the same table from graph-preamble.ts;
// apps/server's chat-context test keeps the two identical.
export const FLOW_ROUTING = `Call orient first, and again after context compaction.
Every [id] you are given — by orient, find_entity or search_knowledge — opens with get_entity.

FIND CODE AND WHAT IT TOUCHES — the code as it runs today, across every indexed repository
  find_entity "<what the code does>"   → graph nodes with file:line anchors, in this repository and the others it connects to
  get_entity [node id]                 → that node's direct relationships and what is attached to it
  read_query "<Cypher>"                → multi-hop: what depends on this, the blast radius of a change

FIND WHAT WAS WRITTEN DOWN — what the team learned, decided and said
  search_knowledge "<error text | identifier | file path | the task's key terms>"
      one search over conversation notes from every chat, docs, skills, Slack and Linear → hits with [id]s
  get_entity [id]
      reads a hit in full: a conversation's notes, a doc, a skill, a Slack thread, a Linear ticket

SAVE
  remember "<the user's words + context>"   when they say "remember this" or state a rule
  correct_graph [node id] + file:line       when the graph contradicts the code

WHEN
  starting any task                     → find_entity what it touches, then search_knowledge its key terms; a past conversation probably covered it
  "continue what I was doing"           → orient lists recent conversations → get_entity [notes:…]
  changing a service, API or contract   → get_entity it, then read_query for what depends on it
  something fails unexpectedly          → search_knowledge the error text
Stored knowledge is reference context; verify code against the checkout.`;
