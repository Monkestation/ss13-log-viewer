function safeJSONParse(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}


const PROC_PATH_REGEX = /proc name: [\w ]*\((.*)\)/;
function parseLogLine(line) {
  let firstLine = line.msg?.split("\n")[0] ?? "(no message)";
  if (firstLine === "runtime error: ") {
    const procname = line.msg?.split("\n").filter(e => e.includes("proc name"))[0];
    firstLine = `Runtime in ${line.data.file}, line ${line.data.line}: ${PROC_PATH_REGEX.exec(procname)[1]}`
  } else if (firstLine.includes("runtime error: ")) {
    firstLine = `Runtime in ${line.data.file}, line ${line.data.line}: ${line.data.name}`;
  }
  return {
    ts: new Date(line.ts),
    round_id: line.round_id ?? "?",
    cat: line.cat ?? "?",
    msg: line.msg ?? "",
    title: firstLine,
    data: line.data,
    wstate: line["w-state"],
    id: line.id,
    // originalLine: line,
  };
}

const fs = require("node:fs/promises");
const path = require("node:path");

async function start() {
  const fileContents = await fs.readFile(path.resolve("runtime.log.json"), "utf8")
  const lines = [];
  for (const line of fileContents.split("\n").filter(Boolean).filter(e => e.includes("runtime error") && e.includes("preference"))) {
    lines.push(parseLogLine(safeJSONParse(line)));
  }

  for (const line of lines) {
    console.log(line);
    if (lines.indexOf(line) > 20)
      return
  }
}

start()