const React = globalThis.React as typeof import("react");
const ReactDOM = globalThis.ReactDOM as unknown as typeof import("react-dom/client");
const Toastify = globalThis.Toastify as typeof import("toastify-js");

interface LogRuntimeData {
  file: string;
  line: number;
  name: string;
  desc: string;
}
interface WState {
  tick_usage: number;
  tick_lag: number;
  time: number;
  timestamp: string;
}

interface JSONLogLine {
  ts: string | Date;
  round_id?: string;
  cat?: string;
  msg?: string;
  data?: any;
  "w-state"?: WState;
  "s-store"?: any;
  id?: number;
  "s-ver"?: string;
  level?: string;
}

interface ParsedLog {
  ts: Date;
  round_id: string;
  cat: string;
  msg: string;
  title: string;
  data: null | any | LogRuntimeData;
  wstate: WState | undefined;
  id: number | undefined;
  originalLine: JSONLogLine;
}

// utils
function safeJSONParse<T>(line: string): T | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

const PROC_PATH_REGEX = /proc name: [\w ]*\((.*)\)/;

function parseLogLine(line: JSONLogLine): ParsedLog {
  let firstLine = line.msg?.split("\n")[0] ?? "(no message)";
  if (firstLine === "runtime error: ") {
    const procname = line.msg!.split("\n").filter((e) => e.includes("proc name"))[0];
    firstLine = `Runtime in ${line.data.file}, line ${line.data.line}: ${PROC_PATH_REGEX.exec(procname)![1]}`;
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
    originalLine: line,
  };
}

function censorLog(log: string) {
  return log.replace(
    /(?<name>[\w ]+) \((?<typepath>\/mob(?:\/\w+)*|\/client|\/datum\/persistent_client)\)/gim,
    "[redacted] ($2)"
  );
}

function quickToast(text: string, duration: number = 5000) {
  Toastify({
    text,
    duration: duration,
    close: true,
    gravity: "bottom",
    position: "left",
    stopOnFocus: true,
  }).showToast();
}
// copmonents

function WStateDisplay({ w }) {
  if (!w) return null;
  return (
    <div className="statusDisplay">
      <div>
        <b>Tick usage:</b> {w.tick_usage}
      </div>
      <div>
        <b>Tick lag:</b> {w.tick_lag}
      </div>
      <div>
        <b>Time:</b> {w.time}
      </div>
      <div>
        <b>Timestamp:</b> {w.timestamp}
      </div>
    </div>
  );
}

function WStateText(w: NonNullable<ParsedLog["wstate"]>) {
  return (
    `Tick usage: ${w.tick_usage}\n` + `Tick lag: ${w.tick_lag}\n` + `Time: ${w.time}\n` + `Timestamp: ${w.timestamp}\n`
  );
}

function DataEntry({ key, label, value }) {
  if (value !== null && typeof value !== "object") {
    return (
      <React.Fragment key={key}>
        <div style={{ clear: "both" }}>
          <span className="statusLabel">{label}:</span>
          {/* Just to be clear, this shit doesn't render properly if i don't use String() */}
          <span className="statusValue">{String(value)}</span>
        </div>
      </React.Fragment>
    );
  }

  if (value === null) {
    return (
      <React.Fragment key={key}>
        <div style={{ clear: "both" }}>
          <span className="statusLabel">{label}:</span>
          <span className="statusValue">null</span>
        </div>
      </React.Fragment>
    );
  }

  const isArray = Array.isArray(value);
  const keys = Object.keys(value);

  return (
    <div style={{ clear: "both", marginBottom: "8px" }}>
      <div className="statusLabel" style={{ width: "100%", color: isArray ? "#FFD700" : "#ADD8E6" }}>
        {label} {isArray ? `[${keys.length}]` : `{${keys.length}}`}
      </div>
      <div
        style={{
          marginLeft: "15px",
          borderLeft: "1px dotted #40628a",
          paddingLeft: "5px",
        }}
      >
        {keys.map((key) => {
          const newLabel = isArray ? `[${key}]` : key;
          const entryValue = value[key];

          return <DataEntry key={key} label={newLabel} value={entryValue} />;
        })}
      </div>
    </div>
  );
}

function dataToText<T = object>(e: T, omit: (keyof T)[]) {
  let sports = "";
  for (const a of Object.keys(e as object)) {
    if (omit.includes(a as keyof T)) continue;
    sports += `${a}: ${e[a]}\n`;
  }
  return sports;
}

function dataToMarkdown<T = object>(e: T, omit: (keyof T)[]) {
  let sports = "";
  for (const a of Object.keys(e as object)) {
    if (omit.includes(a as keyof T)) continue;
    sports += `${a}: \`${e[a]}\`\n`;
  }
  return sports;
}

function ExtraDataDisplay({ data, omit }) {
  if (!data || typeof data !== "object") return null;

  const keys = Object.keys(data);

  return (
    <div className="statusDisplay">
      {keys
        .filter((e) => !omit.includes(e))
        .map((key) => (
          <DataEntry key={key} label={key} value={data[key]} />
        ))}
      <br />
    </div>
  );
}

function logToMarkdown(entry: ParsedLog) {
  return `[<t:${Math.floor(entry.ts.getTime() / 1000)}:f>/${entry.ts.toUTCString()}]\nTitle: ${entry.title}\n\`\`\`\n${
    entry.msg
  }\`\`\``;
}

function LogDetail({
  entry,
  onBack,
  logIndex,
  logs,
  groupList,
  groupIndex,
  specials,
  onNavigate,
}: {
  entry: ParsedLog;
  onBack: () => void;
  logIndex: number;
  logs: ParsedLog[];
  groupList: ParsedLog[];
  groupIndex: number;
  specials: boolean;
  onNavigate: Function;
}) {
  const inGroup = Array.isArray(groupList) && groupList.length > 1;
  const total = inGroup ? groupList.length : 1;
  const logsTotal = logs.length;

  const handleCopy = (e: React.MouseEvent, text: string, supportCensor = false) => {
    navigator.clipboard.writeText(specials && supportCensor ? censorLog(text) : text);
    quickToast(supportCensor ? "Copied censored text to clipboard." : "Copied to clipboard.", 5000);
  };

  const copyLogButtons = [
    { label: "Copy Log", text: entry.msg },
    { label: "(Markdown)", text: logToMarkdown(entry) },
    null,
    { label: "Copy Raw Log", text: JSON.stringify(entry.originalLine) },
    { label: "(Formatted)", text: JSON.stringify(entry.originalLine, null, "  ") },
  ];

  const fileLineButtons = entry?.data?.file
    ? [
        { label: "P:#", text: `${entry.data.file}:${entry.data.line}` },
        { label: "P:L#", text: `${entry.data.file}:L${entry.data.line}` },
        { label: "P,#", text: `${entry.data.file},${entry.data.line}` },
        { label: "P,L#", text: `${entry.data.file},L${entry.data.line}` },
      ]
    : [];

  const wstateButtons = entry.wstate
    ? [
        { label: "Copy", text: WStateText(entry.wstate) },
        { label: "Copy Raw", text: JSON.stringify(entry.wstate) },
        { label: "(Formatted)", text: JSON.stringify(entry.wstate, null, "  ") },
      ]
    : [];

  const extraDataButtons =
    entry.data && Object.keys(entry.data).length > 0
      ? [
          { label: "Copy", text: dataToText(entry.data, ["desc"]) },
          { label: "(Markdown)", text: dataToMarkdown(entry.data, ["desc"]) },
          null,
          { label: "Copy Raw", text: JSON.stringify(entry.data) },
          { label: "(Formatted)", text: JSON.stringify(entry.data, null, "  ") },
        ]
      : [];

  return (
    <div>
      <a onClick={onBack}>
        <b>&lt;&lt;&lt;</b>
      </a>
      <span>
        Entry #{logIndex + 1} of {logsTotal}
      </span>
      <br />
      {copyLogButtons.map((btn, idx) => {
        if (btn === null) {
          return " | ";
        } else
          return (
            <React.Fragment key={idx}>
              <a onClick={(e) => handleCopy(e, btn.text, true)}>{btn.label}</a>{" "}
            </React.Fragment>
          );
      })}
      {fileLineButtons.length > 0 && (
        <>
          {" | "}Copy file/line:{" "}
          {fileLineButtons.map((btn, idx) => (
            <React.Fragment key={idx}>
              <a onClick={(e) => handleCopy(e, btn.text)}>{btn.label}</a>{" "}
            </React.Fragment>
          ))}
        </>
      )}
      {specials ? " | Copies will be censored (Ckeys, mob names, clients) (May not always work)" : ""}
      {inGroup && (
        <>
          <br />
          <a onClick={() => onNavigate(Math.max(groupIndex - 1, 0))}>Prev</a>
          <a onClick={() => onNavigate(Math.min(groupIndex + 1, total - 1))} style={{ marginLeft: "4px" }}>
            Next
          </a>
          <span>
            {groupIndex + 1} of {total} in group
          </span>
        </>
      )}
      <br />
      <b>[{entry.ts.toLocaleString()}]</b> {entry.title}
      <br />
      <pre className="runtime">{entry.msg}</pre>
      {entry.wstate && (
        <>
          <h2>WState</h2>
          {wstateButtons.map((btn, idx) => (
            <React.Fragment key={idx}>
              <a onClick={(e) => handleCopy(e, btn.text)}>{btn.label}</a>{" "}
            </React.Fragment>
          ))}
          <WStateDisplay w={entry.wstate} />
          <br />
        </>
      )}
      {extraDataButtons.length > 0 && (
        <>
          <hr />
          <h2>Extra Data</h2>
          Omits <code>"desc"</code>
          <br />
          {extraDataButtons.map((btn, idx) =>
            btn === null ? (
              <>{" | "}</>
            ) : (
              <React.Fragment key={idx}>
                <a onClick={(e) => handleCopy(e, btn.text, true)}>{btn.label}</a>{" "}
              </React.Fragment>
            )
          )}
          {specials ? " | Copies will be censored (Ckeys, mob names, clients) (May not always work)" : ""}
          <ExtraDataDisplay data={entry.data} omit={["desc"] as unknown as keyof ParsedLog[]} />
        </>
      )}
    </div>
  );
}

function UploadButton({ onUpload }) {
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      let result = event.target?.result;
      if (!result) return;
      let fileContent: string;

      if (typeof result === "string") {
        fileContent = result;
      } else if (result instanceof ArrayBuffer) {
        const decoder = new TextDecoder("utf-8");
        fileContent = decoder.decode(result);
      } else {
        return;
      }

      const lines: string[] = fileContent.split(/\r?\n/).filter(Boolean);
      const parsed = lines
        .map(safeJSONParse<JSONLogLine>)
        .filter(Boolean)
        .map((v) => parseLogLine(v!));
      onUpload(parsed, file.name);
    };

    reader.readAsText(file);
  }
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleUploadClick = (e) => {
    e.preventDefault();
    inputRef.current?.click();
  };

  const handleExampleClick = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("example_log.json");
      if (!res.ok) throw new Error("Failed to load example_log.json");
      const text = await res.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      const parsed = lines
        .map(safeJSONParse<JSONLogLine>)
        .filter(Boolean)
        .map((v) => parseLogLine(v!));
      onUpload(parsed, "example_log.json");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <label className="inlineblock">
      <a href="#" onClick={handleUploadClick}>
        Upload Log
      </a>
      <a href="#" onClick={handleExampleClick} style={{ padding: "1px 2px" }} title="Load Example Log File">
        (?)
      </a>
      <input ref={inputRef} type="file" style={{ display: "none" }} onChange={handleFile} />
    </label>
  );
}

function MyApp() {
  // no i will NOT use react router FUCK YOU! :3
  const [logs, setLogs] = React.useState<ParsedLog[]>([]);
  const [organized, setOrganized] = React.useState(false);
  const [sortLogs, setSortLogs] = React.useState(false);
  const [sortAscending, setSortAscending] = React.useState(false);
  const [selected, setSelected] = React.useState<ParsedLog | null>(null);
  const [groupView, setGroupView] = React.useState<ParsedLog[] | null>(null);
  const [groupList, setGroupList] = React.useState<ParsedLog[] | null>(null);
  const [groupIndex, setGroupIndex] = React.useState(0);
  const [ignoreNonRuntimes, setIgnoreNonRuntimes] = React.useState(false);
  const [uploadFileName, setUploadFileName] = React.useState<string>("No file selected");

  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [searchUseRegex, setSearchUseRegex] = React.useState<boolean>(false);
  const searchRef = React.useRef<HTMLInputElement>(null);
  // holding down shift, basically.
  const [showSpecials, setShowSpecials] = React.useState(false);

  const runtimes = React.useMemo(() => {
    const map = new Map<string, ParsedLog[]>();
    for (const e of logs) {
      if (ignoreNonRuntimes && !e.msg?.includes("runtime error")) continue;
      let customKey = false;
      let key: string;
      if (typeof e?.title === "string")
        if (e.title.startsWith("## TESTING: GC")) key = "## TESTING: GC...";
        else if (e.title.startsWith("DEBUG: isbanned():")) key = "DEBUG: isbanned(): ...";
        else if (e.title.startsWith("## ERROR: Prefs failed to setup (SS)"))
          key = "## ERROR: Prefs failed to setup (SS)...";
        else if (e.title.startsWith("## ERROR: Prefs failed to setup (datum)"))
          key = "## ERROR: Prefs failed to setup (datum)...";
        else if (
          e.title.match(/(\[S\d+-\d+\/\d+\] )?Initialized [\w ]+ subsystem within ([+-]?(\d*\.)?\d+)+ seconds!/i)
        )
          key = "Initialized ... subsystem within ... seconds";
        else if (e.title.match(/Shutting down [\w ]+ subsystem/i)) key = "Shutting down ... subsystem.";

      if (!key) {
        key = e.data?.file ? `${e.data.file}:${e.data.line}` : e.title;
      } else {
        customKey = true;
      }

      if (!map.has(key)) {
        const e = [];
        // @ts-expect-error You can just. do things. ya know? yeah! you can just fuckin do shit! with javascript! isnt it cool?
        // the linters wont like you but nothing stops you from using an array like an object.
        // reminds me of something.....
        e.customKey = customKey;
        map.set(key, e);
      }
      map.get(key)!.push(e);
    }

    let entries = Array.from(map.entries());
    if (sortLogs)
      entries = entries.sort(([aKey], [bKey]) => {
        const result = aKey.localeCompare(bKey);
        return result;
      });

    if (sortAscending) entries.reverse();

    return new Map(entries);
  }, [logs, ignoreNonRuntimes, sortLogs, sortAscending]);

  // back button thing
  React.useEffect(() => {
    window.history.replaceState({ view: "home" }, "");
    function onPopState(e: PopStateEvent) {
      const state = e.state?.view;

      // back from runtime > group view
      if (state === "group") {
        setSelected(null);
        return;
      }

      // back from group > home
      if (state === "home") {
        setGroupView(null);
        setSelected(null);
        return;
      }

      if (!state) {
        setGroupView(null);
        setSelected(null);
      }
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // key handling:
  // space - search box
  // arrow keys (only in runtimes) - navigate between runtimes
  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Shift") {
        setShowSpecials(true);
      }
      if (e.key === "Enter" && !selected && !groupView && !e.target.matches("input, textarea")) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (e.key === "Backspace" && !e.target.matches("input, textarea")) {
        e.preventDefault();
        window.history.back();
        return;
      }

      if (!selected) return;

      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();

        // inside groups
        if (groupList && groupList.length > 1) {
          if (e.key === "ArrowRight" && groupIndex < groupList.length - 1) {
            setGroupIndex(groupIndex + 1);
            setSelected(groupList[groupIndex + 1]);
          } else if (e.key === "ArrowLeft" && groupIndex > 0) {
            setGroupIndex(groupIndex - 1);
            setSelected(groupList[groupIndex - 1]);
          }
          return;
        }

        // const logs = logs.filter((l) => l.msg?.includes("runtime error"));
        const currentIndex = logs.findIndex((l) => l === selected);
        if (currentIndex === -1) return;

        if (e.key === "ArrowRight" && currentIndex < logs.length - 1) {
          setSelected(logs[currentIndex + 1]);
        } else if (e.key === "ArrowLeft" && currentIndex > 0) {
          setSelected(logs[currentIndex - 1]);
        }
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === "Shift") {
        setShowSpecials(false);
      }
    }

    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keydown", handleKeyUp);
    };
  }, [selected, groupList, groupIndex, logs]);

  if (selected)
    return (
      <LogDetail
        entry={selected}
        onBack={() => setSelected(null)}
        logs={logs}
        logIndex={logs.indexOf(selected)}
        // It will never be null since groupList is set in the onClick for items in the groupView.
        groupList={groupList!}
        groupIndex={groupIndex}
        specials={showSpecials}
        onNavigate={(newIndex) => {
          setGroupIndex(newIndex);
          // same here
          setSelected(groupList![newIndex]);
        }}
      />
    );

  if (groupView)
    return (
      <div>
        <a
          onClick={() => {
            window.history.replaceState({ view: "home" }, "");
            setGroupView(null);
          }}
        >
          <b>&lt;&lt;&lt;</b>
        </a>
        <br />
        {groupView.length} Entries in group
        <br />
        {groupView.map((e, i) => (
          <React.Fragment key={i}>
            <a
              key={i}
              onClick={() => {
                setGroupList(groupView);
                setGroupIndex(i);
                window.history.pushState({ view: "log" }, "");
                setSelected(e);
              }}
            >
              <b>[{e.ts.toLocaleString()}]</b> {e.title}
            </a>
            <br />
          </React.Fragment>
        ))}
      </div>
    );

  return (
    <div>
      <UploadButton
        onUpload={(result: ParsedLog[], filename: string) => {
          setLogs(result);
          setUploadFileName(filename);
        }}
      />
      {uploadFileName}
      <br />
      {logs.length} Logs
      <br />
      {/* YES I KNOW THERES A BETTER WAY TO DO THIS BUT I CANNOT BE BOTHERED RIGHT NOWWWWWWWWW AAAAAAAAAAAAAA */}
      {logs.filter((e) => e.msg.startsWith("runtime error")).length} Runtimes |{" "}
      {new Set(logs.filter((e) => e.msg.startsWith("runtime error")).map((e) => e.title)).size} Unique <br />
      <b>Filters/Sorts:</b> <a onClick={() => setOrganized(!organized)}>{!organized ? "Linear" : "Organized"}</a> |{" "}
      <a onClick={() => setIgnoreNonRuntimes((v) => !v)}>
        {ignoreNonRuntimes ? "Show non-runtimes" : "Ignore non-runtimes"}
      </a>{" "}
      | <a onClick={() => setSortAscending((a) => !a)}>{sortAscending ? "Descending" : "Ascending"}</a> |{" "}
      <a onClick={() => setSortLogs((a) => !a)}>{sortLogs ? "Alphabetically" : "In Order"}</a>
      <div style={{ position: "absolute", top: 8, right: 8, textAlign: "right" }}>
        <input
          type="text"
          ref={searchRef}
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "200px",
          }}
        />
        <input
          type="checkbox"
          checked={searchUseRegex}
          onChange={(e) => setSearchUseRegex(e.target.checked)}
          style={{ marginRight: "4px" }}
        />
        Regex
      </div>
      <hr />
      {!organized &&
        (() => {
          let filtered = logs.filter((e) => {
            if (ignoreNonRuntimes && !e.msg.startsWith("runtime error")) return false;
            if (!searchQuery) return true;

            const target = (e.msg ?? "") + " " + (e.title ?? "") + " " + (e.data?.file ?? "");
            if (searchUseRegex) {
              try {
                const regex = new RegExp(searchQuery, "i");
                return regex.test(target);
              } catch {
                return false;
              }
            }

            return target.toLowerCase().includes(searchQuery.toLowerCase());
          });

          if (sortLogs)
            filtered = filtered.sort((aKey, bKey) => {
              const result = aKey.title.localeCompare(bKey.title);
              return result;
            });
          if (sortAscending) filtered.reverse();
          return filtered.map((e, i) => (
            <React.Fragment key={i}>
              <a
                onClick={() => {
                  window.history.pushState({ view: "log" }, "");
                  setSelected(e);
                }}
              >
                <b>[{e.ts.toLocaleString()}]</b> {e.title}
              </a>
              <br />
            </React.Fragment>
          ));
        })()}
      {organized &&
        Array.from(runtimes.entries())
          .filter(([k, list]) => {
            if (!searchQuery) return true;

            if (searchUseRegex) {
              try {
                const regex = new RegExp(searchQuery, "i");
                return (
                  regex.test(k) ||
                  list.some(
                    (e) => regex.test(e.title ?? "") || regex.test(e.msg ?? "") || regex.test(e.data?.file ?? "")
                  )
                );
              } catch {
                return false;
              }
            }
            const q = searchQuery.toLowerCase();
            return (
              k.toLowerCase().includes(q) ||
              list.some(
                (e) =>
                  e.title?.toLowerCase().includes(q) ||
                  e.msg?.toLowerCase().includes(q) ||
                  e.data?.file?.toLowerCase?.().includes(q)
              )
            );
          })
          .map(([k, list], i) => (
            <React.Fragment key={i}>
              <a
                onClick={() => {
                  if (list.length === 1) {
                    window.history.pushState({ view: "log" }, "");
                    setSelected(list[0]);
                  } else {
                    window.history.pushState({ view: "group" }, "");
                    setGroupView(list);
                  }
                }}
              >
                <b>[{list[0].ts.toLocaleString()}]</b> {list.customKey ? k : list[0].title}
              </a>
              {list.length > 1 && <>x{list.length}</>}
              <br />
            </React.Fragment>
          ))}
    </div>
  );
}

const container = document.getElementById("root") as Element;
const root = ReactDOM.createRoot(container);
root.render(<MyApp />);
