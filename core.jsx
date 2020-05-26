import _ from 'lodash';
import { attach } from 'neovim';
import React, { Component } from 'react';
import clear from 'clear';
import net from 'net';
import path from 'path';
import { promises as fs } from 'fs';
import SimpleGit from 'simple-git/promise';
import blessed from 'neo-blessed';
import { createBlessedRenderer } from 'react-blessed';
import exec from 'async-exec';
import fuzzy from './fuzzy';

const getGitDir = async (fpath) => {
  if (fpath === '/') {
    return null;
  }
  const files = await fs.readdir(fpath);
  for (const file of files) {
    if (file === '.git') {
      return fpath;
    }
  }
  return await getGitDir(path.dirname(fpath));
};

const connect = async () => {
  const nvim = await attach({
    socket: process.env.NVIM_LISTEN_ADDRESS,
    options: {
      logger: {
        debug: () => {},
        info: () => {},
        error: () => {}
      }
    }
  });
  return nvim;
};

const gitRoot = async () => {
  const nvim = await connect();
  const buf = await nvim.buffer;
  const filename = await buf.name;
  const fpath = path.dirname(filename);
  const gitDir = (await getGitDir(fpath)) || fpath;
  return gitDir;
};

const lines = async () => {
  const nvim = await connect();
  const buf = await nvim.buffer;
  G.winheight = await nvim.call('winheight', ["win_getid()"]);
  G.winline = await nvim.call('winline', []);
  const win = await nvim.window;
  G.initHighlight = (await win.cursor)[0] - 1;
  const raw_lines = await buf.lines;
  const strlen = `${raw_lines.length + 1}`;
  return raw_lines.map((text, i) => ({
    text,
    strlen,
    i
  }));
};

const gitFiles = async (gitDir) => {
  const git = SimpleGit(gitDir);
  const status = await git.status();
  const untracked = status.not_added.concat(status.created);
  const tracked_raw = await git.raw(["ls-files"]);
  const tracked = tracked_raw.split("\n")
        .map(s => s.trim())
        .filter(s => s !== "");
  return untracked.concat(tracked).map(text => ({ text }));
};

const getStart = async () => {
  const nvim = await connect();
  const win = await nvim.window;
  const cursor = await win.cursor;
  const buffer = await nvim.buffer;
  const name = await buffer.name;
  return { name, cursor: [...cursor] };
};

const screen = blessed.screen({
  autoPadding: true,
  smartCSR: true,
  title: 'react-blessed hello world'
});

const keypress = (() => {
  const subs = {};
  let nextSubId = 1;
  return {
    push: (v) => Object.keys(subs).forEach(id => subs[id] && subs[id](v)),
    on: (f) => {
      const subId = nextSubId;
      subs[subId] = f;
      nextSubId++;
      return () => { delete subs[subId]; };
    }
  };
})();

const Dims = React.createContext();
const Ref = React.createContext();
const Reset = React.createContext();

const G = {
  tabs: [{ stack: [], pos: -1 }],
  tabId: 0,
  recent: [],
};

const pushTab = (nextName, cursor = null) => {
  const { tabs, tabId } = G;
  const { stack, pos } = tabs[tabId];
  const { name } = stack[pos] || {};
  if (name === nextName && !cursor) {
    return;
  }
  const seen = {};
  G.recent = [nextName || name, ...G.recent]
    .filter((f) => {
      if (seen[f]) { return false; }
      seen[f] = true;
      return true;
    });
  G.tabs[tabId] = {
    last: Math.max(pos, 0),
    stack: [...stack.slice(0, pos + 1), { name: nextName || name, cursor }],
    pos: pos + 1
  };
};

const handleEnter = async () => {
  if (G.p_start) {
    return;
  }
  const { name } = await getStart();
  pushTab(name);
};

const zvim_port = parseInt(process.env.ZVIM_PORT);
const looking_glass_port = parseInt(process.env.LOOKING_GLASS_PORT);
const client = new net.Socket();
client.connect(looking_glass_port, 'localhost', () => {
  const server = new net.Server();
  server.listen(zvim_port, () => {});
  server.on('connection', (socket) => {
    socket.setEncoding("utf8");
    socket.on('data', (data) => {
      const msg = JSON.parse(data);
      if (msg.type === 'enter') {
        handleEnter();
      }
      if (msg.type === 'open') {
        G.p_start = getStart();
      }
      if (msg.type === 'exit' || msg.type === 'open') {
        client.write(data);
      }
    });
  });
});

const TextInput = ({ onChange = () => {} }) => {
  const [{ value, cursor }, setState] = React.useState({ value: "", cursor: 0 });
  const [blink, setBlink] = React.useState(true);
  React.useEffect(
    () => (
      keypress.on((key) => {
        const isChar = Boolean(key.ch) || (key.name === "space") || (
          Boolean(key.sequence) && key.sequence.toLowerCase() === key.name
        );
        const char = isChar && (key.ch || key.sequence);
        const data = { isChar, char, name: key.name };
        if (isChar) {
          setState({
            value: `${value.slice(0, cursor)}${char}${value.slice(cursor)}`,
            cursor: cursor + 1
          });
        }
        else if (data.name === "left") {
          setState({ value, cursor: Math.max(0, cursor - 1) });
          return;
        }
        else if (data.name === "right") {
          setState({
            value,
            cursor: Math.min(value.length, cursor + 1)
          });
          return;
        }
        else if (data.name === "backspace") {
          setState({
            value: `${value.slice(0, Math.max(0, cursor-1))}${value.slice(cursor)}`,
            cursor: Math.max(0, cursor - 1)
          });
          return;
        }
      })
    ),
  );
  React.useEffect(() => onChange(value), [value]);
  React.useEffect(
    () => {
      setTimeout(() => setBlink(!blink), 1500);
      return;
    },
    [blink]);
  return (
    <box
      height={1}
      style={{ bg: "black" }}
    >
      <box style={{ bold: true, fg: 'brightblack', bg: "black" }} content=" > " />
      {[...Array.from(value), " "].map((c, i) => (
        <box
          height={1}
          width={1}
          key={i}
          left={3 + i}
          style={
            !(blink && (i === cursor)) ? {
              bold: true,
              fg: "white",
              bg: "black",
            } : {
              bold: true,
              fg: "black",
              bg: "brightwhite",
            }}
          content={c}
        />
      ))}
    </box>
  );
};

const getColumns = () => {
  const ref = React.useContext(Ref);
  return ref ? ref.width : 0;
};

const getRows = () => {
  const ref = React.useContext(Ref);
  return ref ? ref.height : 0;
};

const FillWidth = ({ children, c = " ", ...props }) => {
  const columns = getColumns() - 2;
  const length = (typeof children) === "string" ?
        children.length :
        children.reduce((a, b) => a + b.length, 0);
  const content = (typeof children) === "string" ? children : children.join("");
  return (
    <box
      {...props}
      content={`${content}${_.range(columns - length).map(() => c).join("")}`}
     >
    </box>
  );
};

console.log = () => {};
console.error = () => {};
console.warn = () => {};

const getPre = (original) => {
  const strlen = original.strlen;
  const row = original.i + 1;
  const pad = _.range(4 - `${row}`.length).map(() => " ").join("");
  const pre = `${pad}${row}: `;
  return { matches: false, part: pre, alt: true};
};
const exactFilter = (input, items) => (
  input === "" ?
    items.map((original) => ({
      original,
      start: 0,
      pieces: [
        getPre(original),
        { part: original.text, matches: false }
      ]
    })) :
    items
    .filter(({ text }) => text.indexOf(input) >= 0)
    .map(original => {
      const text = original.text;
      const start = text.indexOf(input);
      const end = start + input.length;
      return {
        original,
        start,
        pieces: [
          getPre(original),
          { matches: false, part: text.slice(0, start) },
          { matches: true, part: text.slice(start, end) },
          { matches: false, part: text.slice(end) }
        ]
      };
    })
);


const fuzzyFilter = (input, items) => (
  input === "" ?
    items.map((original) => ({
      original,
      pieces: [{ part: original.text, matches: false }]
    })) :
    fuzzy(input, items, ({ text }) => text)
);

const Last = () => {
  const reset = React.useContext(Reset);
  const ref = React.useRef();
  React.useEffect(
    () => {
      if (ref.current) {
        return () => {};
      }
      ref.current = true;
      (async () => {
        const last = G.tabs[G.tabId].last;
        G.tabs[G.tabId].last = G.tabs[G.tabId].pos;
        G.tabs[G.tabId].pos = last;
        const target = G.tabs[G.tabId].stack[last].name;
        const nvim = await connect();
        await nvim.command(`e! ${target}`);
        reset();
      })();
      return () => {};
    },
    []
  );
  return null;
};

const SearchItems = (props) => {
  const {
    start, highlight, onChange, visible, items, leftPad = 0
  } = props;
  const renderPieces = (item, i) => {
    let left = 0;
    const pieces = [
      { part: _.range(leftPad).map(() => " ").join(""), matches: false },
      ...(item.pieces || [])
    ];
    return pieces.map(({ part, matches, alt }, j) => {
      const thisLeft = left;
      left += part.length;
      const isHighlight = start + i === highlight;
      const bg = isHighlight ? "brightmagenta" : "black";
      const fg = ({
        [true]: {
					[true]: {
						[true]: "blue",
						[false]: "blue",
					},
					[false]: {
						[true]: "green",
						[false]: "green",
					}
        },
        [false]: {
					[true]: {
						[true]: "brightwhite",
						[false]: "brightwhite",
					},
					[false]: {
						[true]: "black",
						[false]: "white",
					}
        },
      })[alt || false][matches][isHighlight];
      const bold = matches || isHighlight;
      return (
        <box
          key={j}
          height={1}
          top={i + 2}
          left={thisLeft}
          style={{ bold, bg, fg }}
          content={part}
        />
      );
    });
  };

  return (
    <box
      style={{ bg: 'black' }}
    >
      <TextInput onChange={onChange} />
      <FillWidth
        style={{ bg: 'black', fg: 'brightblack', bold: true }}
        top={1}
        c="-"
      >
        {""}
      </FillWidth>
      {items.slice(start, start + visible).map((item, i) => (
        renderPieces(item, i)
      ))}
    </box>
  );
};

const FilterSearch = (props) => {
  const {
    leftPad,
    filter,
    init,
    onEnter = () => {},
    onTab = () => {},
    onHighlight = () => {},
    getPos = () => new Promise(
      resolve => resolve({ start: 0, highlight: 0 })
    )
  } = props;
  const rows = getRows();
  const [search, setSearch] = React.useState("");
  const [items, setItems] = React.useState([]);
  const [{ highlight, start }, setState] = React.useState(
    { highlight: 0, start: 0 }
  );
  React.useEffect(
    () => {
      init.then((items) => {
        getPos(filter(search, items)).then(state => {
          setState(state);
          setItems(items);
        });
      });
      return;
    },
    []
  );
  const reset = React.useContext(Reset);
  const filtered = filter(search, items);
  const visible = Math.min(rows - 4, filtered.length);
  React.useEffect(
    () => (
      filtered[highlight] &&
        onHighlight(filtered[highlight].original)
    ),
    [filtered[highlight] &&
     filtered[highlight].original &&
     filtered[highlight].original.i]
  );

  React.useEffect(
    () => {
      return keypress.on((key) => {
        if (key.name === "up") {
          setState({
            start: Math.max(0, start + 1 === highlight ? start - 1 : start),
            highlight: Math.max(0, highlight - 1)
          });
          return;
        }
        else if (key.name === "down") {
          setState({
            start: Math.min(
              filtered.length - visible,
              start + visible - 2 === highlight ? start + 1 : start
            ),
            highlight: Math.min(filtered.length - 1, highlight + 1)
          });
          return;
        }
        else if (key.name === 'enter') {
          onEnter(filtered[highlight]);
        }
        else if (key.name === 'tab') {
          onTab(filtered[highlight]);
        }
      });
    },
  );

  const onChange = (s) => {
    getPos(filter(s, items)).then(state => {
      setState(state);
      setSearch(s);
    });
  };

  return (
    <SearchItems
      leftPad={leftPad}
      items={filtered}
      start={start}
      highlight={highlight}
      onChange={onChange}
      visible={visible}
    />
  );
};

const Ag = (props) => {
  const {
    onHighlight = () => {},
  } = props;


  const onEnter= async (item) => {
    const fname = item.full_path;
    const nvim = await connect();
    const win = await nvim.window;
    await nvim.command(`e! +${item.row} ${fname}`);
    pushTab(fname, [item.row, item.col]);
    win.cursor = [item.row, item.col];
    await win.cursor;
    reset();
  };

  const onTab= async (item) => {
    const fname = item.full_path;
    const nvim = await connect();
    await nvim.command(`e! +${item.row} ${fname}`);
  };

  const rows = getRows();
  const [items, setItems] = React.useState([]);
  const [{ highlight, start }, setState] = React.useState(
    { highlight: 0, start: 0 }
  );
  const reset = React.useContext(Reset);
  const visible = Math.min(rows - 4, items.length);

  React.useEffect(
    () => {
      return keypress.on((key) => {
        if (key.name === "up") {
          setState({
            start: Math.max(0, start + 1 === highlight ? start - 1 : start),
            highlight: Math.max(0, highlight - 1)
          });
          return;
        }
        else if (key.name === "down") {
          setState({
            start: Math.min(
              items.length - visible,
              start + visible - 2 === highlight ? start + 1 : start
            ),
            highlight: Math.min(items.length - 1, highlight + 1)
          });
          return;
        }
        else if (key.name === 'enter') {
          onEnter(items[highlight]);
        }
        else if (key.name === 'tab') {
          onTab(items[highlight]);
        }
      });
    },
  );

  const onChange = (s) => {
    ((async () => {
      const gitDir = await gitRoot();
      const c = `ag "${s}" ${gitDir} --vimgrep`;
      const results = await exec(c);
      const items = results
            .split("\n")
            .filter(s => s !== "")
            .map((res_line) => {
              const pieces = res_line.split(":");
              const full_path = pieces[0];
              const row = parseInt(pieces[1]);
              const col = parseInt(pieces[2]) - 1;
              const text = pieces.slice(3).join(":");
              const rel_path = path.relative(gitDir, full_path);
              const pre = `${rel_path}:${row} `;
              const regexp = new RegExp(s);
              const res = regexp.exec(text);
              const match = res[0];
              const start = res.index;
              return {
                original: { text },
                full_path,
                row,
                col,
                pieces: [
                  { matches: false, part: pre, alt: true },
                  { matches: false, part: text.slice(0, start) },
                  { matches: true, part: match },
                  { matches: false, part: text.slice(start + match.length) }
                ]
              };
            });
      setItems(items);
      setState({ start: 0, highlight: 0 });
    })());
  };

  return (
    <SearchItems
      items={items}
      start={start}
      highlight={highlight}
      onChange={onChange}
      visible={visible}
    />
  );
};

const File = () => {
  const reset = React.useContext(Reset);
  const r_dir = React.useRef();
  const r_files = React.useRef();
  if (!r_dir.current) {
    r_dir.current = gitRoot();
    r_files.current = r_dir.current.then(gitFiles);
  }
  return (
    <FilterSearch
      leftPad={3}
      filter={fuzzyFilter}
      init={r_files.current}
      onEnter={async (item) => {
        const text = item.original.text;
        const dir = await r_dir.current;
        const fname = path.join(dir, text);
        const nvim = await connect();
        await nvim.command(`e! ${fname}`);
        pushTab(fname);
        reset();
      }}
      onTab={async (item) => {
        const text = item.original.text;
        const dir = await r_dir.current;
        const fname = path.join(dir, text);
        const nvim = await connect();
        await nvim.command(`e! ${fname}`);
      }}
    />
  );
};

const Recent = () => {
  const reset = React.useContext(Reset);
  const r_history = React.useRef();
  if (!r_history.current) {
    r_history.current = (async () => {
      const seen = {};
      const gitDir = await gitRoot();
      return G.recent
        .slice(1)
        .map(text => ({ text: path.relative(gitDir, text) }));
    })();
  }
  return (
    <FilterSearch
      leftPad={3}
      filter={fuzzyFilter}
      init={r_history.current}
      onEnter={async (item) => {
        const text = item.original.text;
        const dir = await gitRoot();
        const fname = path.join(dir, text);
        const nvim = await connect();
        await nvim.command(`e! ${fname}`);
        pushTab(fname);
        reset();
      }}
      onTab={async (item) => {
        const text = item.original.text;
        const dir = await gitRoot();
        const fname = path.join(dir, text);
        const nvim = await connect();
        await nvim.command(`e! ${fname}`);
      }}
    />
  );
};

const Swoop = () => {
  const rows = getRows();
  const reset = React.useContext(Reset);
  const r_lines = React.useRef();
  if (!r_lines.current) {
    r_lines.current = lines();
  }
  React.useEffect(
    () => () => {
      delete G.winheight;
      delete G.winline;
      delete G.initHighlight;
    }
  );
  return (
    <FilterSearch
      filter={exactFilter}
      init={r_lines.current}
      getPos={async (items) => {
        const nvim = await connect();
        const buf = await nvim.buffer;
        const winheight = await nvim.call('winheight', ["win_getid()"]);
        const winline = await nvim.call('winline', []);
        const win = await nvim.window;
        const cursor = await win.cursor;
        const currHighlight = cursor[0] - 1;
        const eqOrAfterHighlight = items
              .map((item, i) => ({
                i, eqOrAfter: item.original.i >= currHighlight
              }))
              .filter(({ eqOrAfter }) => eqOrAfter);
        const highlight = (eqOrAfterHighlight[0] || { i: currHighlight }).i;
        const offset = Math.ceil((winline / winheight) * rows);
        return { highlight, start: Math.max(0, highlight - offset) };
      }}
      onHighlight={
        ({ i }) => {
          (async () => {
            const nvim = await connect();
            const win = await nvim.window;
            await nvim.command(`${i+1}`);
          })();
          return undefined;
        }
      }
      onEnter={async (item) => {
        const col = item.start;
        const row = item.original.i + 1;
        const nvim = await connect();
        const win = await nvim.window;
        win.cursor = [row, col];
        await win.cursor;
        pushTab(null, [row, col]);
        reset();
      }}
    />
  );
};

const COMMANDS = {
  label: "Commands",
  children: {
    tab: {
      label: "Last Buffer",
			Component: Last,
      children: {},
    },
		f: {
			label: "Files",
			children: {
				p: {
					label: "Project",
					Component: File,
          children: {}
				},
				r: {
					label: "Recent",
					Component: Recent,
          children: {}
				},
			}
		},
		s: {
			label: "Search",
			children: {
				f: {
					label: "File",
					Component: Swoop,
          children: {}
				},
				p: {
					label: "Project",
					Component: Ag,
          children: {}
				}
			}
		}
  }
};

const escape = async () => {
  const { name, cursor } = await G.p_start;
  const nvim = await connect();
  const win = await nvim.window;
  win.cursor = cursor;
  await nvim.command(`e! ${name}`);
  await win.cursor;
  return;
};

const Main = () => {
  const [path, setPath] = React.useState([]);
  let curr = COMMANDS;
  let title = "Commands";
  path.forEach(k => {
    title += ` > ${curr.children[k].label}`;
    curr = curr.children[k];
  });
  const { children = {}, label, Component } = curr;
  const reset = () => {
    client.write(JSON.stringify({ type: "close" }));
    setTimeout(() => { setPath([]); G.p_start = null; }, 100);
  };
  const full_reset = () => escape().then(reset);

  React.useEffect(
    () => (
      keypress.on((key) => {
        if (children[key.name]) {
          setPath([...path, key.name]);
        }
        else if (key.name === 'escape') {
          full_reset();
        }
      })
    ),
  );

  const keys = Object.keys(children);
  const perGroup = Math.ceil(keys.length / 3);
  const groups = [
    keys.slice(0, perGroup),
    keys.slice(perGroup, 2 * perGroup),
    keys.slice(2 * perGroup, 3 * perGroup)
  ];

  const lefts = ["0", "33%", "66%"];
  const menu = (
		<box top={1} style={{ bg: 'black' }} >
			{groups.map((group, i) => (
				<box
          key={i}
          left={lefts[i]}
          width="33%"
          style={{ bg: 'black' }}
        >
					{group.map((key, j) => (
						<box
              key={key}
              top={j}
              style={{ bg: 'black' }}
            >
							<box
                bold cyan
                style={{ bold: true, fg: "cyan", bg: 'black' }}
                content={`   [${key}]`}
              />
							<box
                left={key.length + 5}
                style={{ fg: "white", bg: 'black' }}
                content=" → "
              />
							<box
                left={key.length + 8}
                content= {children[key].label}
                style={{
                  bold: true,
                  bg: 'black',
                  fg: (Object.keys(children[key].children).length > 0 ?
                       "brightmagenta" :
                       "brightyellow"
                      )
                }}
							/>
						</box>
					))}
				</box>
			))}
		</box>
  );

  const [ref, setRef] = React.useState();
  return (
    <Ref.Provider value={ref}>
      <Reset.Provider value={reset}>
        <box
          ref={ref => ref && setRef(ref)}
          label={` ${title} `}
          top="center"
          left="center"
          width="100%"
          height="100%"
          border={{type: 'line'}}
          style={{
            bg: "black",
            border: { fg: 'blue', bg: 'black' },
            label: { bg: 'black', fg: 'red', bold: true }
          }}
        >
          {Component ? <Component/> : menu}
        </box>
      </Reset.Provider>
    </Ref.Provider>
  );
};

class App extends Component {
  render() {
    return <Main />;
  }
}

screen.on('keypress', (_, key) => {
  keypress.push(key);
});


const render = createBlessedRenderer(blessed);

export default () => render(<App />, screen);
