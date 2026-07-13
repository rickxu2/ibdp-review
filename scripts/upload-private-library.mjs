import { open, stat } from "node:fs/promises";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((value, i, all) => value.startsWith("--") ? [value.slice(2), all[i + 1]] : null).filter(Boolean));
const studentId = args.student;
const supervisorId = args.supervisor;
const answerPath = args["answer-path"];
const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = "private-study-files";
const targetLimit = 500 * 1024 * 1024;
const chunkSize = 6 * 1024 * 1024;

if (!studentId || !supervisorId || !answerPath) {
  throw new Error("Usage: node scripts/upload-private-library.mjs --student UUID --supervisor UUID --answer-path STORAGE_PATH");
}
if (!url || !secret) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in this terminal. Never save the key in the repository.");

const root = path.resolve(import.meta.dirname, "..");
const resources = [
  { kind: "textbook", subject: "econ_sl", title: "Economics Course Companion", file: "Textbook/Economics - Course Companion - Jocelyn Blink and Ian Dorton - Third Edition - Oxford 2020.pdf", object: `${studentId}/resources/textbooks/econ_sl.pdf` },
  { kind: "textbook", subject: "eng_b_hl", title: "English B Course Companion", file: "Textbook/English B - Course Companion - Saa’d AlDin and Morley - Second Edition - Oxford 2018.pdf", object: `${studentId}/resources/textbooks/eng_b_hl.pdf` },
  { kind: "textbook", subject: "math_aa_hl", title: "Mathematics Analysis and Approaches HL 2", file: "Textbook/Mathematics - Analysis and Approaches HL 2 - Haese 2019.pdf", object: `${studentId}/resources/textbooks/math_aa_hl.pdf` },
  { kind: "textbook", subject: "chem_sl", title: "Chemistry Course Book", file: "Textbook/Oxford_Resources_for_IB_DP_Chemistry_Course_Book__Sergey_Bylikin__Gary_Horner_etc.___Z-Library_.pdf", object: `${studentId}/resources/textbooks/chem_sl.pdf` },
  { kind: "textbook", subject: "phys_hl", title: "Physics Course Companion", file: "Textbook/Physics_-_Course_Companion_-_Homer__Piętka_and_Heathcote_-_Fifth_Edition_-_Oxford_2023.pdf", object: `${studentId}/resources/textbooks/phys_hl.pdf` },
  { kind: "question_paper", subject: "chem_sl", title: "Chemistry 2025 May TZ1 Paper 2", file: "papers/Chemistry_SL/2025_May_TZ1/paper_2.pdf", object: `${studentId}/resources/papers/chem_sl/2025_May_TZ1_P2/question-paper.pdf` },
  { kind: "markscheme", subject: "chem_sl", title: "Chemistry 2025 May TZ1 Paper 2 Markscheme", file: "papers/Chemistry_SL/2025_May_TZ1/paper_2_ms.pdf", object: `${studentId}/resources/papers/chem_sl/2025_May_TZ1_P2/markscheme.pdf` }
];

const apiHeaders = { apikey: secret, authorization: `Bearer ${secret}` };
const api = async (endpoint, options = {}) => {
  const response = await fetch(`${url}${endpoint}`, { ...options, headers: { ...apiHeaders, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`${options.method || "GET"} ${endpoint}: ${response.status} ${await response.text()}`);
  return response;
};

async function ensureBucketLimit() {
  await api(`/storage/v1/bucket/${bucket}`, {
    method: "PUT", headers: { "content-type": "application/json" },
    body: JSON.stringify({ public: false, file_size_limit: targetLimit })
  });
  const info = await (await api(`/storage/v1/bucket/${bucket}`)).json();
  if (Number(info.file_size_limit || 0) < targetLimit) throw new Error(`Bucket limit is still ${info.file_size_limit} bytes. Raise Storage > Global file size limit to at least 500 MB.`);
}

const metadata = values => Object.entries(values).map(([key, value]) => `${key} ${Buffer.from(String(value)).toString("base64")}`).join(",");

async function uploadTus(item) {
  const localPath = path.join(root, item.file);
  const size = (await stat(localPath)).size;
  const projectRef = new URL(url).hostname.split(".")[0];
  const endpoint = `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
  const create = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...apiHeaders, "Tus-Resumable": "1.0.0", "Upload-Length": String(size), "x-upsert": "true",
      "Upload-Metadata": metadata({ bucketName: bucket, objectName: item.object, contentType: "application/pdf", cacheControl: "3600" })
    }
  });
  if (!create.ok) throw new Error(`Create upload for ${item.file}: ${create.status} ${await create.text()}`);
  const location = create.headers.get("location");
  if (!location) throw new Error(`No resumable upload URL returned for ${item.file}`);
  const uploadUrl = new URL(location, endpoint).toString();
  const file = await open(localPath, "r");
  let offset = 0;
  try {
    while (offset < size) {
      const length = Math.min(chunkSize, size - offset);
      const buffer = Buffer.allocUnsafe(length);
      const { bytesRead } = await file.read(buffer, 0, length, offset);
      let response;
      for (let attempt = 1; attempt <= 5; attempt++) {
        response = await fetch(uploadUrl, {
          method: "PATCH",
          headers: { ...apiHeaders, "Tus-Resumable": "1.0.0", "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" },
          body: bytesRead === buffer.length ? buffer : buffer.subarray(0, bytesRead)
        });
        if (response.ok) break;
        if (attempt === 5) throw new Error(`Upload ${item.file}: ${response.status} ${await response.text()}`);
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
      }
      offset = Number(response.headers.get("upload-offset") || offset + bytesRead);
      process.stdout.write(`\r${item.title}: ${Math.floor(offset / size * 100)}%`);
    }
  } finally { await file.close(); }
  process.stdout.write("\n");
  return { ...item, size, localPath };
}

async function registerResource(item) {
  await api(`/rest/v1/learning_resources?on_conflict=bucket_path`, {
    method: "POST",
    headers: { "content-type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ student_id: studentId, title: item.title, kind: item.kind, subject: item.subject, bucket_path: item.object, file_name: path.basename(item.file), mime_type: "application/pdf", size_bytes: item.size, uploaded_by: supervisorId })
  });
}

await ensureBucketLimit();
for (const resource of resources) {
  const uploaded = await uploadTus(resource);
  await registerResource(uploaded);
}

await api(`/rest/v1/attempt_content?student_id=eq.${encodeURIComponent(studentId)}&paper_key=eq.2025_May_TZ1_P2`, {
  method: "PATCH",
  headers: { "content-type": "application/json", Prefer: "return=minimal" },
  body: JSON.stringify({
    question_file_path: `${studentId}/resources/papers/chem_sl/2025_May_TZ1_P2/question-paper.pdf`,
    markscheme_file_path: `${studentId}/resources/papers/chem_sl/2025_May_TZ1_P2/markscheme.pdf`,
    answer_file_path: answerPath,
    textbook_file_path: `${studentId}/resources/textbooks/chem_sl.pdf`
  })
});

console.log(`Uploaded ${resources.length} private resources and linked the current marked paper.`);
