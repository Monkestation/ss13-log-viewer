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
function safeJSONParse(line: string): object | null {
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

function LogDetail({
  entry,
  onBack,
  groupList,
  groupIndex,
  onNavigate,
}: {
  entry: ParsedLog;
  onBack: () => void;
  groupList: ParsedLog[];
  groupIndex: number;
  onNavigate: Function;
}) {
  const inGroup = Array.isArray(groupList) && groupList.length > 1;
  const total = inGroup ? groupList.length : 1;
  return (
    <div>
      <a onClick={onBack}>
        <b>&lt;&lt;&lt;</b>
      </a>
      <br />
      {inGroup && (
        <>
          <a onClick={() => onNavigate(Math.max(groupIndex - 1, 0))}>Prev</a>
          <a onClick={() => onNavigate(Math.min(groupIndex + 1, total - 1))} style={{ marginLeft: "4px" }}>
            Next
          </a>
          <span>
            Runtime {groupIndex + 1} of {total}
          </span>
        </>
      )}
      <br />
      <b>[{entry.ts.toLocaleString()}]</b> {entry.title}
      <br />
      <div className="runtime">
        {entry.msg.split("\n").map((line, i) => (
          <React.Fragment key={i}>
            <span key={i} className="runtime_line">
              {line}
            </span>
          </React.Fragment>
        ))}
      </div>
      {!!entry.wstate && (
        <React.Fragment>
          <h2>WState</h2>
          <WStateDisplay w={entry.wstate} />
          <br />
        </React.Fragment>
      )}
      {!!(entry.data && Object.keys(entry.data).length > 0) && (
        <React.Fragment>
          <hr />
          <h2>Extra Data</h2>
          <ExtraDataDisplay data={entry.data} omit={["desc"] as keyof ParsedLog}></ExtraDataDisplay>
        </React.Fragment>
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
      let fileContent;

      if (typeof result === "string") {
        fileContent = result;
      } else if (result instanceof ArrayBuffer) {
        const decoder = new TextDecoder("utf-8");
        fileContent = decoder.decode(result);
      } else {
        return;
      }

      const lines = fileContent.split(/\r?\n/).filter(Boolean);
      const parsed = lines.map(safeJSONParse).filter(Boolean).map(parseLogLine);
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
      const parsed = lines.map(safeJSONParse).filter(Boolean).map(parseLogLine);
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
  const [logs, setLogs] = React.useState<ParsedLog[]>([]);
  const [organized, setOrganized] = React.useState(false);
  const [sortLogs, setSortLogs] = React.useState(false);
  const [sortAscending, setSortAscending] = React.useState(false);
  const [selected, setSelected] = React.useState<ParsedLog>(null);
  const [groupView, setGroupView] = React.useState<ParsedLog[] | null>(null);
  const [groupList, setGroupList] = React.useState<ParsedLog[] | null>(null);
  const [groupIndex, setGroupIndex] = React.useState(0);
  const [ignoreNonRuntimes, setIgnoreNonRuntimes] = React.useState(false);
  const [uploadFileName, setUploadFileName] = React.useState<string>("No file selected");

  const runtimes = React.useMemo(() => {
    const map = new Map<string, ParsedLog[]>();
    for (const e of logs) {
      if (ignoreNonRuntimes && !e.msg?.includes("runtime error")) continue;
      const key = e.data?.file ? `${e.data.file}:${e.data.line}` : e.title;
      if (!map.has(key)) map.set(key, []);
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
    function onPopState(e) {
      if (selected) {
        setSelected(null);
        window.history.pushState(null, "", window.location.href);
        return;
      }
      if (groupView) {
        setGroupView(null);
        window.history.pushState(null, "", window.location.href);
        return;
      }
    }
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [selected, groupView]);

  if (selected)
    return (
      <LogDetail
        entry={selected}
        onBack={() => setSelected(null)}
        groupList={groupList}
        groupIndex={groupIndex}
        onNavigate={(newIndex) => {
          setGroupIndex(newIndex);
          setSelected(groupList[newIndex]);
        }}
      />
    );

  if (groupView)
    return (
      <div>
        <a onClick={() => setGroupView(null)}>
          <b>&lt;&lt;&lt;</b>
        </a>
        <br />
        {groupView.map((e, i) => (
          <React.Fragment key={i}>
            <a
              key={i}
              onClick={() => {
                setGroupList(groupView);
                setGroupIndex(i);
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
      <hr />
      {!organized &&
        (() => {
          let filtered = logs.filter((e) => (ignoreNonRuntimes ? e.msg.startsWith("runtime error") : true));
          if (sortLogs)
            filtered = filtered.sort((aKey, bKey) => {
              const result = aKey.title.localeCompare(bKey.title);
              return result;
            });
          if (sortAscending) filtered.reverse();
          return filtered.map((e, i) => (
            <React.Fragment key={i}>
              <a onClick={() => setSelected(e)}>
                <b>[{e.ts.toLocaleString()}]</b> {e.title}
              </a>
              <br />
            </React.Fragment>
          ));
        })()}
      {organized &&
        Array.from(runtimes.entries()).map(([k, list], i) => (
          <React.Fragment key={i}>
            <a onClick={() => (list.length === 1 ? setSelected(list[0]) : setGroupView(list))}>
              <b>[{list[0].ts.toLocaleString()}]</b> {list[0].title}
            </a>
            <br />
          </React.Fragment>
        ))}
    </div>
  );
}

const container = document.getElementById("root");
const root = ReactDOM.createRoot(container);
root.render(<MyApp />);
