const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

test("todas as 17 referências cruzadas têm proteção por proprietário", () => {
  const sql = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261023210000_propriedade_referencias.sql"), "utf8")
  assert.match(sql, /security definer/i)
  assert.match(sql, /set search_path = ''/i)
  assert.match(sql, /valor::uuid, new.user_id/)
  assert.match(sql, /from public, anon, authenticated/)
  const exp = [
    ["projects","parent_id","projects"],["projects","area_id","areas"],
    ["captures","area_id","areas"],["capture_projects","capture_id","captures"],
    ["capture_projects","project_id","projects"],["habit_logs","habit_id","habits"],
    ["goal_months","goal_id","goals"],["tasks","project_id","projects"],
    ["exam_topics","subject_id","exam_subjects"],["exam_topics","parent_id","exam_topics"],
    ["study_sessions","subject_id","exam_subjects"],["study_sessions","topic_id","exam_topics"],
    ["insights","book_id","books"],["insights","experiment_id","experiments"],
    ["content_items","editorial_line_id","editorial_lines"],["pages","parent_id","pages"],
    ["collection_items","collection_id","collections"],
  ]
  for (const [tabela,coluna,pai] of exp) {
    assert.ok(sql.includes(`on public.${tabela}\n  for each row execute function app_private.verificar_dono_referencia('${pai}', '${coluna}');`), `${tabela}.${coluna}`)
  }
  assert.equal((sql.match(/create trigger verificar_dono_/g)||[]).length, 17)
})
