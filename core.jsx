import _ from 'lodash';
import { attach } from 'neovim';
import React, { Component } from 'react';
import clear from 'clear';
import net from 'net';
import path from 'path';
import { promises as fs } from 'fs';
import SimpleGit from 'simple-git/promise';
import blessed from 'neo-blessed';
import {createBlessedRenderer} from 'react-blessed';
// import TextInput_ from './TextInput';

const screen = blessed.screen({
  autoPadding: true,
  smartCSR: true,
  title: 'react-blessed hello world'
});

let TextInput_;

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
      if (msg.type === 'exit' || msg.type === 'open') {
        client.write(data);
      }
    });
  });
});

const TextInput = () => {
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
        // else {
          // setState({ value: JSON.stringify(key) });
        // }
      })
    ),
  );
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


const CTRL_C = '\x03';
const ESC = '\x1B';
const ENTER = '\r';
const ARROW_UP = '\u001B[A';
const ARROW_DOWN = '\u001B[B';

const FullWidth = ({ children, c = " " }) => {
  const { columns, rows } = React.useContext(Dims);
  const length = (typeof children) === "string" ?
        children.length :
        children.reduce((a, b) => a + b.length, 0);
  return (
    <>
      {children}
      {_.range(columns - length).map(() => c)}
    </>
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

const Search2 = () => {
  const [input, setInput] = React.useState("");
  const [highlight, setHighlight] = React.useState(0);
  const reset = React.useContext(Reset);
  const onKey = (k) => {
    if (k === CTRL_C) {
      return false;
    }
    else if (k === ENTER) {
      return false;
    }
    else if (k === ARROW_UP) {
      setHighlight(highlight - 1);
      return false;
    }
    else if (k === ARROW_DOWN) {
      setHighlight(highlight + 1);
      return false;
    }
    else if (k === ESC) {
      reset();
      return false;
    }

    return true;
  };

  const items = [
    {text: "abc"},
    {text: "xD"},
    {text: "this is it"},
    {text: "a thing"},
    {text: "lol lmao"},
    {text: "weeeowwww"},
    {text: "what a cool thing"},
    {text: "i made"}
  ];

  return (
    <Box top={0} height="100%" width="100%" flexDirection="column">
      <Color bold blackBright >
        <FullWidth c="-" >
          {""}
        </FullWidth>
      </Color>
      <Box top={0} height={1} width="100%" flexDirection="row" >
        <Color bold blackBright >
          {" > "}
        </Color>
        <Color bold >
          <TextInput onKey={onKey} value={input} onChange={setInput} />
        </Color>
      </Box>
      <Color bold blackBright >
        <FullWidth c="-" >
          {""}
        </FullWidth>
      </Color>
      {items.map(({ text }, i) => (
        <Color
          {...(Object.assign(
            {},
            { key: i },
            highlight === i ? { bgBlack: true } : {}
          ))}
        >
          <FullWidth>
            {" "}
					  {text}
          </FullWidth>
        </Color>
      ))}
    </Box>
  );
};

const Search_ = ({ init }) => {
  const [items, setItems] = React.useState([]);
  React.useEffect(() => init.then(setItems), []);
  const [input, setInput] = React.useState("");
  const [highlight, setHighlight] = React.useState(0);
  const reset = React.useContext(Reset);
  const onKey = (k) => {
    if (k === CTRL_C) {
      return false;
    }
    else if (k === ENTER) {
      return false;
    }
    else if (k === ARROW_UP) {
      setHighlight(highlight - 1);
      return false;
    }
    else if (k === ARROW_DOWN) {
      setHighlight(highlight + 1);
      return false;
    }
    else if (k === ESC) {
      reset();
      return false;
    }

    return true;
  };

  const { columns, rows } = React.useContext(Dims);
  const displayed = items.slice(0, rows - 5);
  return (
    <Box top={0} height="100%" width="100%" flexDirection="column">
      <Color bold blackBright >
        <FullWidth c="-" >
          {""}
        </FullWidth>
      </Color>
      <Box top={0} height={1} width="100%" flexDirection="row" >
        <Color bold blackBright >
          {" > "}
        </Color>
        <Color bold >
          <TextInput onKey={onKey} value={input} onChange={setInput} />
        </Color>
      </Box>
      <Color bold blackBright >
        <FullWidth c="-" >
          {""}
        </FullWidth>
      </Color>
      {displayed.map(({ text }, i) => (
        <Color
          {...(Object.assign(
            {},
            { key: i },
            highlight === i ? { bgBlack: true } : {}
          ))}
        >
          <FullWidth>
            {" "}
					  {text}
          </FullWidth>
        </Color>
      ))}
    </Box>
  );
};


console.log = () => {};
console.error = () => {};
console.warn = () => {};

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
  const buf = await nvim.buffer;
  const filename = await buf.name;
  const fpath = path.dirname(filename);
  const gitDir = (await getGitDir(fpath)) || fpath;
  const git = SimpleGit(gitDir);
  const status = await git.status();
  const untracked = status.not_added.concat(status.created);
  const tracked_raw = await git.raw(["ls-files"]);
  const tracked = tracked_raw.split("\n")
        .map(s => s.trim())
        .filter(s => s !== "");
  return untracked.concat(tracked).map(text => ({ text }));
};

const File_ = () => {
  return (
    <Box>
      <Search init={connect()} />
    </Box>
  );
};

const Last = () => null;
const Search = () => null;
const File = () => {
  const rows = getRows();
  const visible = rows - 4;
  const [items, setItems] = React.useState([]);
  React.useEffect(
    () => {
      connect().then(setItems);
      return;
    },
    []
  );
  const [{ highlight, start }, setState] = React.useState(
    { highlight: 0, start: 0 }
  );
  const reset = React.useContext(Reset);
  const filtered = items;

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
      });
    },
  );

  return (
    <box
      style={{ bg: 'black' }}
    >
      <TextInput />
      <FillWidth
        style={{ bg: 'black', fg: 'brightblack', bold: true }}
        top={1}
        c="-"
      >
        {""}
      </FillWidth>
      {items.slice(start, start + visible).map(({ text }, i) => (
        <box
          key={i}
          top={i + 2}
          content={text}
          style={{
            bg: start + i === highlight ? "white" : "black",
            fg: start + i === highlight ? "black" : "white"
          }}
        />
      ))}
    </box>
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
				h: {
					label: "History",
					Component: Search,
          children: {}
				},
				p: {
					label: "Project",
					Component: File,
          children: {}
				}
			}
		},
		s: {
			label: "Search",
			children: {
				f: {
					label: "File",
					Component: Search,
          children: {}
				},
				p: {
					label: "Project",
					Component: Search,
          children: {}
				}
			}
		}
  }
};

const App_ = () => {
  const [ons, setOns] = React.useState(0);
  const [rerender, setRerender] = React.useState(false);
  const [columns, rows] = useStdoutDimensions();
  React.useEffect(
    () => {
      clear();
      setRerender(!rerender);
    },
    [columns, rows]
  );
  const { stdin, setRawMode } = React.useContext(StdinContext);
  const [path, setPath] = React.useState([]);
  let curr = COMMANDS;
  let title = "Commands";
  path.forEach(k => {
    title += ` > ${curr.children[k].label}`;
    curr = curr.children[k];
  });
  const { children = {}, label, Component } = curr;
  const ref = React.useRef();
  const reset = () => {
    client.write(JSON.stringify({ type: "close" }));
    setTimeout(
      () => setPath([]),
      100
    );
  };
  ref.current = (data) => {
		const k = String(data);
    if (k === ESC) {
      reset();
      return;
    }
    if (children[k]) {
      setPath([...path, k]);
      return;
    }
  };
  React.useEffect(
    () => {
      stdin.setMaxListeners(20);
    },
    []
  );
  React.useEffect(
    () => {
      if (Component) {
        return () => {};
      }
		  setRawMode(true);
      const f = (data) => ref.current(data);
		  stdin.on('data', f);
      return () => {
		    stdin.removeListener('data', f);
		    setRawMode(false);
      };
    },
    [Boolean(Component)]
  );
  const keys = Object.keys(children);
  const perGroup = Math.ceil(keys.length / 3);
  const groups = [
    keys.slice(0, perGroup),
    keys.slice(perGroup, 2 * perGroup),
    keys.slice(2 * perGroup, 3 * perGroup)
  ];

  const menu = (
    <>
      <Box>
        <FullWidth> {""} </FullWidth>
      </Box>
			<Box flexDirection="row" width="100%" justifyContent="space-around">
				{groups.map((group, i) => (
					<Box key={i} flexDirection="column" justifyContent="space-between">
						{group.map(key => (
							<Box key={key} flexGrow="1" >
								<Color bold cyan >
									[{key}]
								</Color>
								<Color blackBright >
									{" → "}
								</Color>
								<Color
									{...(Object.keys(children[key].children).length > 0 ?
                       { magentaBright: true, bold: true } :
                       { yellowBright: true, bold: true }
											)}
								>
									{children[key].label}
								</Color>
							</Box>
						))}
					</Box>
				))}
			</Box>
    </>
  );

  return (
    <Reset.Provider value={reset}>
      <Dims.Provider value={{ columns, rows }} >
				<Box width="100%" flexDirection="column">
						<Box>
								<Color bold white bgBlue >
								<FullWidth>
										{rerender ? " " : "/"}
										{title}
								</FullWidth>
								</Color>
						</Box>
						{Component ? <Component/> : menu}
				</Box>
			</Dims.Provider>
    </Reset.Provider>
  );
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
    setTimeout(
      () => setPath([]),
      100
    );
  };

  React.useEffect(
    () => (
      keypress.on((key) => {
        if (children[key.name]) {
          setPath([...path, key.name]);
        }
        else if (key.name === 'escape') {
          reset();
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
